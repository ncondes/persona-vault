import request from 'supertest';
import { RATE_LIMIT_POLICIES } from '../src/constants/rate-limits';
import { Clock } from '../src/domain/interfaces/rate-limit';
import { buildContainer } from '../src/container';
import { prisma } from '../src/infrastructure/db/prisma';
import { RedisRateLimitStore } from '../src/infrastructure/rate-limit/redis.store';
import { refillPerMs } from '../src/infrastructure/rate-limit/token-bucket';
import { buildApp } from '../src/server';
import { NullMailer } from './support/otp';

// The limiter against a real Redis, because the interesting part of the Lua
// script is that it is atomic, and an in-process map cannot show that.
// `npm run db:up` starts one alongside Postgres.
const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://localhost:56379';

function stoppedClock(at = Date.now()): Clock & { advance(ms: number): void } {
  let now = at;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

describe('rate limiting (integration)', () => {
  let store: RedisRateLimitStore;
  const clock = stoppedClock();

  beforeAll(() => {
    store = new RedisRateLimitStore(REDIS_URL);
  });

  afterAll(async () => {
    await store.close();
    await prisma.$disconnect();
  });

  describe('the Lua bucket', () => {
    const key = () => `rl:test:${Math.random().toString(36).slice(2)}`;

    it('matches the arithmetic the in-process store uses', async () => {
      const k = key();
      const rate = refillPerMs(5, 60_000);
      const verdicts = [];
      for (let i = 0; i < 6; i += 1) {
        verdicts.push(await store.consume(k, 5, rate, 1_000));
      }
      expect(verdicts.map((v) => v.allowed)).toEqual([true, true, true, true, true, false]);
      expect(verdicts.map((v) => v.remaining)).toEqual([4, 3, 2, 1, 0, 0]);
      expect(verdicts[5].retryAfterMs).toBe(12_000);
      await store.reset(k);
    });

    // The reason it is a Lua script and not three round trips. Fifty callers
    // arrive at once on a bucket of ten; exactly ten may pass.
    it('lets exactly the capacity through when fifty requests arrive together', async () => {
      const k = key();
      const rate = refillPerMs(10, 60_000);
      const results = await Promise.all(
        Array.from({ length: 50 }, () => store.consume(k, 10, rate, 2_000)),
      );
      expect(results.filter((r) => r.allowed)).toHaveLength(10);
      await store.reset(k);
    });

    it('refills over time rather than at a window boundary', async () => {
      const k = key();
      const rate = refillPerMs(5, 60_000);
      for (let i = 0; i < 5; i += 1) await store.consume(k, 5, rate, 0);

      expect((await store.consume(k, 5, rate, 11_999)).allowed).toBe(false);
      expect((await store.consume(k, 5, rate, 12_000)).allowed).toBe(true);
      await store.reset(k);
    });

    it('starts a key over when it is reset', async () => {
      const k = key();
      const rate = refillPerMs(1, 60_000);
      expect((await store.consume(k, 1, rate, 0)).allowed).toBe(true);
      expect((await store.consume(k, 1, rate, 0)).allowed).toBe(false);

      await store.reset(k);
      expect((await store.consume(k, 1, rate, 0)).allowed).toBe(true);
      await store.reset(k);
    });

    it('forgets a bucket once it would be full again', async () => {
      const k = key();
      // A bucket of one that refills in 100ms should carry a TTL near 1.1s.
      await store.consume(k, 1, refillPerMs(1, 100), 0);
      const ttl = await (store as unknown as { redis: { pttl(k: string): Promise<number> } }).redis.pttl(k);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1_200);
      await store.reset(k);
    });
  });

  describe('over HTTP', () => {
    const app = buildApp(
      buildContainer({ mailer: new NullMailer(), rateLimitStore: store, clock }),
    );
    const email = `rl-int-${Date.now()}@example.com`;

    // The buckets are left to expire on their own: every address here is unique
    // per run, so nothing carries over into the next one.
    afterAll(async () => {
      await prisma.otpChallenge.deleteMany({ where: { email: { startsWith: 'rl-int-' } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: 'rl-int-' } } });
    });

    it('advertises the policy on an ordinary response', async () => {
      const res = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
      const { limit, windowMs } = RATE_LIMIT_POLICIES.authLogin;
      expect(res.headers['ratelimit-policy']).toBe(
        `"authLogin";q=${limit};w=${windowMs / 1000}`,
      );
      expect(res.headers['ratelimit']).toMatch(/^"authLogin";r=\d+;t=\d+$/);
    });

    // A13. Password guessing against one address, keyed on the address rather
    // than the caller, so it cannot be dodged by changing network.
    it('refuses a burst of password guesses with 429 and a Retry-After', async () => {
      const victim = `rl-int-burst-${Date.now()}@example.com`;
      const { limit } = RATE_LIMIT_POLICIES.authLogin;

      let refused;
      for (let i = 0; i <= limit + 1; i += 1) {
        refused = await request(app)
          .post('/api/auth/login')
          .send({ email: victim, password: `guess-${i}` });
      }

      expect(refused!.status).toBe(429);
      expect(refused!.body.error.code).toBe('RATE_LIMITED');
      expect(Number(refused!.headers['retry-after'])).toBeGreaterThan(0);
      expect(refused!.headers['ratelimit']).toContain('r=0');
    });

    it('does not spend one address budget on another', async () => {
      const a = `rl-int-a-${Date.now()}@example.com`;
      const b = `rl-int-b-${Date.now()}@example.com`;
      for (let i = 0; i <= RATE_LIMIT_POLICIES.authLogin.limit + 1; i += 1) {
        await request(app).post('/api/auth/login').send({ email: a, password: 'x' });
      }
      const other = await request(app).post('/api/auth/login').send({ email: b, password: 'x' });
      expect(other.status).not.toBe(429);
    });

    it('lets the caller back in once the bucket refills', async () => {
      const victim = `rl-int-refill-${Date.now()}@example.com`;
      for (let i = 0; i <= RATE_LIMIT_POLICIES.authLogin.limit + 1; i += 1) {
        await request(app).post('/api/auth/login').send({ email: victim, password: 'x' });
      }
      expect(
        (await request(app).post('/api/auth/login').send({ email: victim, password: 'x' })).status,
      ).toBe(429);

      clock.advance(RATE_LIMIT_POLICIES.authLogin.windowMs);

      expect(
        (await request(app).post('/api/auth/login').send({ email: victim, password: 'x' })).status,
      ).not.toBe(429);
    });

    // The health check is deliberately outside the table: a throttled monitor
    // reads as an outage.
    it('never limits the health check', async () => {
      for (let i = 0; i < 50; i += 1) {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.headers['ratelimit']).toBeUndefined();
      }
    });
  });
});
