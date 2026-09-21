import { RateLimitVerdict } from '../../domain/interfaces/rate-limit';

// A token bucket rather than a fixed window. A fixed window lets a caller spend
// its whole budget at the end of one window and again at the start of the next,
// so a limit of ten is really twenty back to back — which on a password
// endpoint is the number that matters. A bucket refills continuously and has no
// boundary to sit on.
//
// The arithmetic lives here so the in-process store and the Lua script are
// demonstrably the same algorithm, and so it can be unit tested without either.
export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function refillPerMs(limit: number, windowMs: number): number {
  return limit / windowMs;
}

export function pour(
  bucket: Bucket | undefined,
  capacity: number,
  rate: number,
  now: number,
): { bucket: Bucket; verdict: RateLimitVerdict } {
  let tokens = bucket ? bucket.tokens : capacity;
  const since = bucket ? now - bucket.updatedAt : 0;
  // A clock that went backwards refills nothing rather than draining the bucket.
  if (since > 0) {
    tokens = Math.min(capacity, tokens + since * rate);
  }

  if (tokens >= 1) {
    tokens -= 1;
    return {
      bucket: { tokens, updatedAt: now },
      verdict: { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 },
    };
  }

  return {
    bucket: { tokens, updatedAt: now },
    verdict: {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.ceil((1 - tokens) / rate),
    },
  };
}

// When the bucket will be full again, which is the last moment its state is
// worth keeping. Both stores use it to expire idle keys.
export function idleMs(bucket: Bucket, capacity: number, rate: number): number {
  return Math.ceil((capacity - bucket.tokens) / rate) + 1000;
}
