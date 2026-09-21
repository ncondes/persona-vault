import { Redis } from 'ioredis';
import { RateLimitStore, RateLimitVerdict } from '../../domain/interfaces/rate-limit';
import { logger } from '../logger/logger';

// The same token bucket as token-bucket.ts, in Lua so that reading the bucket,
// refilling it and taking a token are one atomic step. Two requests arriving
// together cannot both be told they took the last token.
//
// `now` is passed in rather than read from redis.call('TIME'). That keeps the
// script deterministic, and it is what lets the tests drive the clock instead
// of sleeping — this codebase has no fake timers anywhere, so time is always
// something the caller supplies.
const CONSUME = `
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])

local state  = redis.call('HMGET', key, 'tokens', 'at')
local tokens = tonumber(state[1])
local at     = tonumber(state[2])

if tokens == nil then
  tokens = capacity
  at = now
end

local since = now - at
if since > 0 then
  tokens = math.min(capacity, tokens + since * rate)
end

local allowed = 0
local retry = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
else
  retry = math.ceil((1 - tokens) / rate)
end

redis.call('HSET', key, 'tokens', tokens, 'at', now)
redis.call('PEXPIRE', key, math.ceil((capacity - tokens) / rate) + 1000)

return { allowed, math.floor(tokens), retry }
`;

interface WithConsume {
  rlConsume(key: string, capacity: string, rate: string, now: string): Promise<[number, number, number]>;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis & WithConsume;

  constructor(url: string) {
    // A limiter that queues indefinitely while it reconnects turns a cache blip
    // into a stall, so every wait is bounded and the policy's fail mode decides
    // what a timeout means.
    //
    // The queue stays on, though. Turning it off rejects any command issued
    // before the socket is ready, which is every request in the first moments
    // after a deploy — and with the credential policies failing closed, that
    // would answer the first sign-ins of each release with a 429. `commandTimeout`
    // is what stops the queue becoming unbounded.
    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      commandTimeout: 1000,
      connectTimeout: 2000,
      lazyConnect: false,
    });
    redis.on('error', (err) => logger.warn({ err }, 'redis error'));
    redis.defineCommand('rlConsume', { numberOfKeys: 1, lua: CONSUME });
    this.redis = redis as Redis & WithConsume;
  }

  async consume(
    key: string,
    capacity: number,
    rate: number,
    now: number,
  ): Promise<RateLimitVerdict> {
    const [allowed, remaining, retryAfterMs] = await this.redis.rlConsume(
      key,
      String(capacity),
      String(rate),
      String(now),
    );
    return { allowed: allowed === 1, remaining, retryAfterMs };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
