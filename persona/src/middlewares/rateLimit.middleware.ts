import { createHmac } from 'node:crypto';
import { Request, RequestHandler } from 'express';
import { config } from '../config/config';
import {
  RATE_LIMIT_POLICIES,
  RateLimitKeySource,
  RateLimitPolicy,
  RateLimitPolicyName,
} from '../constants/rate-limits';
import { TooManyRequestsError } from '../domain/errors';
import { Clock, RateLimitStore } from '../domain/interfaces/rate-limit';
import { logger } from '../infrastructure/logger/logger';
import { refillPerMs } from '../infrastructure/rate-limit/token-bucket';

// Identifiers are hashed before they become cache keys. A privacy system should
// not leave a browsable list of the addresses that tried to sign in sitting in
// Redis, and the limiter only ever needs to know that two requests came from
// the same place, not where.
const pepper = Buffer.from('persona.rate-limit');

function fingerprint(value: string): string {
  return createHmac('sha256', config.authSecret)
    .update(pepper)
    .update(value.toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

function basicAuthClientId(header: string | undefined): string | null {
  if (!header?.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 1) return null;
  // client_secret_basic percent-encodes both halves (RFC 6749 §2.3.1).
  try {
    return decodeURIComponent(decoded.slice(0, separator));
  } catch {
    return decoded.slice(0, separator);
  }
}

function bearerToken(header: string | undefined): string | null {
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

// Pulls the thing a policy keys on out of the request. Returns null when it is
// not there, which is treated as "not this policy's business" rather than as a
// refusal — an unparseable body is the validator's problem, and failing here
// would turn every malformed request into a 429.
function identify(source: RateLimitKeySource, req: Request): string | null {
  const body = (req.body ?? {}) as Record<string, unknown>;
  switch (source) {
    case 'email':
      return typeof body.email === 'string' ? body.email : null;
    case 'challenge':
      return typeof body.challengeId === 'string' ? body.challengeId : null;
    case 'interaction':
      return typeof req.params.uid === 'string' ? req.params.uid : null;
    case 'user':
      return req.userId ?? null;
    case 'client':
      return (
        basicAuthClientId(req.headers.authorization) ??
        (typeof req.query.client_id === 'string' ? req.query.client_id : null)
      );
    case 'bearer':
      return bearerToken(req.headers.authorization);
    case 'ip':
      return req.ip ?? null;
  }
}

export interface RateLimiter {
  (policy: RateLimitPolicyName): RequestHandler;
}

export function buildRateLimiter(store: RateLimitStore, clock: Clock): RateLimiter {
  return function rateLimit(name: RateLimitPolicyName): RequestHandler {
    const policy: RateLimitPolicy = RATE_LIMIT_POLICIES[name];
    const rate = refillPerMs(policy.limit, policy.windowMs);
    const windowSeconds = Math.round(policy.windowMs / 1000);

    return async (req, res, next) => {
      if (!config.rateLimitEnabled) return next();

      const identifier = identify(policy.keyOn, req);
      if (identifier === null) return next();

      const key = `rl:${policy.name}:${fingerprint(identifier)}`;
      let verdict;
      try {
        verdict = await store.consume(key, policy.limit, rate, clock.now());
      } catch (err) {
        // The store is unreachable. Refusing every sign-in because a cache
        // blipped is bad; allowing unlimited password guesses because a cache
        // blipped is worse. Each policy has already made that call.
        logger.error({ err, policy: policy.name }, 'rate limit store unavailable');
        if (policy.failMode === 'open') return next();
        return next(
          new TooManyRequestsError(
            'Too many requests. Try again shortly.',
            'RATE_LIMITED',
            windowSeconds,
          ),
        );
      }

      // draft-ietf-httpapi-ratelimit-headers-11. Advertised on every response,
      // not only on a refusal, so a client can slow down before it is cut off.
      res.setHeader('RateLimit-Policy', `"${policy.name}";q=${policy.limit};w=${windowSeconds}`);
      res.setHeader(
        'RateLimit',
        `"${policy.name}";r=${verdict.remaining};t=${Math.ceil(verdict.retryAfterMs / 1000)}`,
      );

      if (verdict.allowed) return next();

      next(
        new TooManyRequestsError(
          'Too many requests. Try again shortly.',
          'RATE_LIMITED',
          Math.ceil(verdict.retryAfterMs / 1000),
        ),
      );
    };
  };
}
