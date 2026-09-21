// A clock the code can be handed instead of reading the wall directly. Nothing
// else in this codebase injects one — time is simulated by mutating the row a
// service reads. A token bucket has no row to mutate, so it takes the clock.
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface RateLimitVerdict {
  allowed: boolean;
  // Tokens left after this request. Reported to the caller so a well-behaved
  // client can slow down before it is refused.
  remaining: number;
  // How long until one token is back. Zero when the request was allowed.
  retryAfterMs: number;
}

// One bucket's worth of state, addressed by key. Two implementations: Redis for
// anything deployed, an in-process map for unit tests and local work.
export interface RateLimitStore {
  // Takes one token from `key`'s bucket, refilling it first for the time that
  // has passed. Atomic: two requests arriving together cannot both be told they
  // took the last token.
  consume(
    key: string,
    capacity: number,
    refillPerMs: number,
    now: number,
  ): Promise<RateLimitVerdict>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
}
