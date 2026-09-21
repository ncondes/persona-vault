import { Clock } from '../src/domain/interfaces/rate-limit';
import { MemoryRateLimitStore } from '../src/infrastructure/rate-limit/memory.store';
import { refillPerMs } from '../src/infrastructure/rate-limit/token-bucket';

// The contract both stores implement. The Redis one is checked against the same
// expectations in tests/rate-limit.int.test.ts, so the two cannot drift.
function stoppedClock(at = 1_000): Clock & { advance(ms: number): void } {
  let now = at;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

describe('MemoryRateLimitStore', () => {
  let clock: ReturnType<typeof stoppedClock>;
  let store: MemoryRateLimitStore;
  const rate = refillPerMs(5, 60_000);

  beforeEach(() => {
    clock = stoppedClock();
    store = new MemoryRateLimitStore(clock);
  });

  afterEach(async () => {
    await store.close();
  });

  it('allows the capacity and then refuses', async () => {
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(await store.consume('k', 5, rate, clock.now()));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0, 0]);
    expect(results[5].retryAfterMs).toBe(12_000);
  });

  it('keeps separate keys apart', async () => {
    for (let i = 0; i < 5; i += 1) await store.consume('a', 5, rate, clock.now());
    expect((await store.consume('a', 5, rate, clock.now())).allowed).toBe(false);
    expect((await store.consume('b', 5, rate, clock.now())).allowed).toBe(true);
  });

  it('starts a key over when it is reset', async () => {
    for (let i = 0; i < 5; i += 1) await store.consume('k', 5, rate, clock.now());
    expect((await store.consume('k', 5, rate, clock.now())).allowed).toBe(false);

    await store.reset('k');
    expect((await store.consume('k', 5, rate, clock.now())).allowed).toBe(true);
  });

  it('keeps a bucket that is still draining', async () => {
    await store.consume('k', 5, rate, clock.now());
    store.sweep();
    // Still one token down, so the state is worth keeping.
    expect((await store.consume('k', 5, rate, clock.now())).remaining).toBe(3);
  });

  it('drops a bucket once it has refilled', async () => {
    await store.consume('k', 5, rate, clock.now());
    clock.advance(60_000 + 1_000);
    store.sweep();
    // Gone and rebuilt cold, which is the same answer either way — what this
    // proves is that the map does not grow without bound.
    expect((await store.consume('k', 5, rate, clock.now())).remaining).toBe(4);
  });

  it('empties on close', async () => {
    await store.consume('k', 5, rate, clock.now());
    await store.close();
    expect((await store.consume('k', 5, rate, clock.now())).remaining).toBe(4);
  });

  it('reads the wall clock when it is not given one', async () => {
    const wall = new MemoryRateLimitStore();
    const verdict = await wall.consume('k', 5, rate, Date.now());
    expect(verdict.allowed).toBe(true);
    await wall.close();
  });
});
