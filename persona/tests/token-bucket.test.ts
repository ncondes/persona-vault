import {
  Bucket,
  idleMs,
  pour,
  refillPerMs,
} from '../src/infrastructure/rate-limit/token-bucket';

// The arithmetic both stores share. Tested here so the Lua script and the
// in-process map can be checked against one agreed answer rather than against
// each other.
describe('token bucket', () => {
  const capacity = 5;
  const windowMs = 60_000;
  const rate = refillPerMs(capacity, windowMs);

  function drain(from: Bucket | undefined, times: number, at: number) {
    let bucket = from;
    let verdict = pour(bucket, capacity, rate, at).verdict;
    for (let i = 0; i < times; i += 1) {
      const step = pour(bucket, capacity, rate, at);
      bucket = step.bucket;
      verdict = step.verdict;
    }
    return { bucket: bucket as Bucket, verdict };
  }

  it('allows a full burst on a cold bucket and refuses the next one', () => {
    const { bucket, verdict } = drain(undefined, capacity, 1_000);
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(0);

    const refused = pour(bucket, capacity, rate, 1_000).verdict;
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
  });

  it('reports how long until one token is back', () => {
    const { bucket } = drain(undefined, capacity, 0);
    const refused = pour(bucket, capacity, rate, 0).verdict;
    // One token per twelve seconds at five a minute.
    expect(refused.retryAfterMs).toBe(12_000);
  });

  it('refills over time rather than at a window boundary', () => {
    const { bucket } = drain(undefined, capacity, 0);
    expect(pour(bucket, capacity, rate, 11_999).verdict.allowed).toBe(false);
    expect(pour(bucket, capacity, rate, 12_000).verdict.allowed).toBe(true);
  });

  // The failure a fixed window has and this does not: spend the budget at the
  // end of one window and again at the start of the next, and a limit of five
  // is really ten back to back.
  it('never allows more than the capacity in any window-length span', () => {
    let bucket: Bucket | undefined;
    let allowed = 0;
    for (let at = 0; at <= windowMs; at += 1_000) {
      const step = pour(bucket, capacity, rate, at);
      bucket = step.bucket;
      if (step.verdict.allowed) allowed += 1;
    }
    // Five from the cold burst, plus one per twelve seconds over the minute.
    expect(allowed).toBeLessThanOrEqual(capacity * 2);
  });

  it('never refills past capacity however long it idles', () => {
    const { bucket } = drain(undefined, capacity, 0);
    const later = pour(bucket, capacity, rate, 10 * windowMs);
    expect(later.bucket.tokens).toBe(capacity - 1);
  });

  // A clock that jumps backwards must not drain the bucket, or a leap second
  // becomes a lockout.
  it('ignores a clock that went backwards', () => {
    const first = pour(undefined, capacity, rate, 10_000);
    const back = pour(first.bucket, capacity, rate, 5_000);
    expect(back.verdict.allowed).toBe(true);
    expect(back.bucket.tokens).toBe(capacity - 2);
  });

  it('expires a key once it would be full again', () => {
    const { bucket } = drain(undefined, capacity, 0);
    expect(idleMs(bucket, capacity, rate)).toBe(windowMs + 1_000);
  });
});
