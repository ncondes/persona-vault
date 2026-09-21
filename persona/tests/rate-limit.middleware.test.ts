import { NextFunction, Request, Response } from 'express';
import { RATE_LIMIT_POLICIES } from '../src/constants/rate-limits';
import { TooManyRequestsError } from '../src/domain/errors';
import { Clock, RateLimitStore, RateLimitVerdict } from '../src/domain/interfaces/rate-limit';
import { MemoryRateLimitStore } from '../src/infrastructure/rate-limit/memory.store';
import { buildRateLimiter } from '../src/middlewares/rateLimit.middleware';

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
  };
  return res as unknown as Response & { headers: Record<string, string> };
}

// A clock the test moves by hand. Nothing in this codebase uses fake timers;
// time is always something the caller supplies.
function stoppedClock(at = 1_000): Clock & { advance(ms: number): void } {
  let now = at;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

async function call(
  handler: ReturnType<ReturnType<typeof buildRateLimiter>>,
  req: Partial<Request>,
  res = fakeResponse(),
) {
  const next = jest.fn();
  await handler(req as Request, res, next as unknown as NextFunction);
  return { next, res };
}

describe('rate limit middleware', () => {
  let clock: ReturnType<typeof stoppedClock>;
  let store: MemoryRateLimitStore;
  let limit: ReturnType<typeof buildRateLimiter>;

  beforeEach(() => {
    clock = stoppedClock();
    store = new MemoryRateLimitStore(clock);
    limit = buildRateLimiter(store, clock);
  });

  afterEach(async () => {
    await store.close();
  });

  it('refuses once the budget is spent, and says for how long', async () => {
    const handler = limit('authRegister');
    const req = { body: { email: 'camila@example.com' }, headers: {}, params: {}, query: {} };
    const { limit: budget } = RATE_LIMIT_POLICIES.authRegister;

    for (let i = 0; i < budget; i += 1) {
      const { next } = await call(handler, req);
      expect(next).toHaveBeenCalledWith();
    }

    const { next } = await call(handler, req);
    const err = next.mock.calls[0][0] as TooManyRequestsError;
    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('lets the caller back in once the bucket has refilled', async () => {
    const handler = limit('authRegister');
    const req = { body: { email: 'camila@example.com' }, headers: {}, params: {}, query: {} };
    for (let i = 0; i < RATE_LIMIT_POLICIES.authRegister.limit; i += 1) await call(handler, req);
    expect((await call(handler, req)).next.mock.calls[0][0]).toBeInstanceOf(TooManyRequestsError);

    clock.advance(RATE_LIMIT_POLICIES.authRegister.windowMs);
    expect((await call(handler, req)).next).toHaveBeenCalledWith();
  });

  it('gives two addresses their own budgets', async () => {
    const handler = limit('authRegister');
    const mine = { body: { email: 'camila@example.com' }, headers: {}, params: {}, query: {} };
    const yours = { body: { email: 'dev@example.com' }, headers: {}, params: {}, query: {} };
    for (let i = 0; i < RATE_LIMIT_POLICIES.authRegister.limit; i += 1) await call(handler, mine);

    expect((await call(handler, mine)).next.mock.calls[0][0]).toBeInstanceOf(TooManyRequestsError);
    expect((await call(handler, yours)).next).toHaveBeenCalledWith();
  });

  // The two sign-in doors share one policy on purpose: alternating between the
  // API and the consent screen must not buy a second budget.
  it('shares one budget between the API and the consent-screen sign-in', async () => {
    const api = limit('authLogin');
    const consent = limit('authLogin');
    const body = { email: 'camila@example.com' };
    const req = { body, headers: {}, params: { uid: 'abc' }, query: {} };

    for (let i = 0; i < RATE_LIMIT_POLICIES.authLogin.limit; i += 1) {
      await call(i % 2 === 0 ? api : consent, req);
    }
    expect((await call(consent, req)).next.mock.calls[0][0]).toBeInstanceOf(TooManyRequestsError);
  });

  it('advertises the policy and what is left on every response', async () => {
    const { res } = await call(limit('authRegister'), {
      body: { email: 'camila@example.com' },
      headers: {},
      params: {},
      query: {},
    });
    expect(res.headers['RateLimit-Policy']).toBe('"authRegister";q=5;w=3600');
    expect(res.headers['RateLimit']).toBe('"authRegister";r=4;t=0');
  });

  it('never writes the identifier into the cache key', async () => {
    const consume = jest.spyOn(store, 'consume');
    await call(limit('authRegister'), {
      body: { email: 'camila@example.com' },
      headers: {},
      params: {},
      query: {},
    });
    const key = consume.mock.calls[0][0];
    expect(key).toMatch(/^rl:authRegister:[0-9a-f]{32}$/);
    expect(key).not.toContain('camila');
    expect(key).not.toContain('example.com');
  });

  it.each([
    ['challenge', 'authVerify', { body: { challengeId: 'chal-1' } }],
    ['interaction', 'interactionVerify', { params: { uid: 'uid-1' } }],
    ['user', 'apiRead', { userId: 'user-1' }],
    ['client basic auth', 'oidcToken', {
      headers: { authorization: `Basic ${Buffer.from('clinic:secret').toString('base64')}` },
    }],
    ['client query', 'oidcAuthorize', { query: { client_id: 'clinic' } }],
    ['bearer', 'oidcUserinfo', { headers: { authorization: 'Bearer opaque-token' } }],
    ['ip', 'publicRead', { ip: '203.0.113.7' }],
  ] as const)('keys %s requests', async (_label, policy, shape) => {
    const consume = jest.spyOn(store, 'consume');
    const req = { body: {}, headers: {}, params: {}, query: {}, ...shape };
    const { next } = await call(limit(policy), req);
    expect(next).toHaveBeenCalledWith();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume.mock.calls[0][0]).toMatch(new RegExp(`^rl:${policy}:[0-9a-f]{32}$`));
  });

  // A request with nothing to key on is the validator's problem, not the
  // limiter's. Refusing here would turn every malformed body into a 429.
  it('stands aside when there is nothing to key on', async () => {
    const consume = jest.spyOn(store, 'consume');
    const { next } = await call(limit('authRegister'), {
      body: {},
      headers: {},
      params: {},
      query: {},
    });
    expect(next).toHaveBeenCalledWith();
    expect(consume).not.toHaveBeenCalled();
  });

  describe('when the store is unreachable', () => {
    const broken: RateLimitStore = {
      consume: () => Promise.reject(new Error('redis is down')),
      reset: async () => {},
      close: async () => {},
    };

    it('refuses a credential request, because guessing is worse than an outage', async () => {
      const handler = buildRateLimiter(broken, stoppedClock())('authLogin');
      const { next } = await call(handler, {
        body: { email: 'camila@example.com' },
        headers: {},
        params: {},
        query: {},
      });
      expect(next.mock.calls[0][0]).toBeInstanceOf(TooManyRequestsError);
    });

    it('lets an ordinary read through, because an outage is worse than the abuse', async () => {
      const handler = buildRateLimiter(broken, stoppedClock())('apiRead');
      const { next } = await call(handler, {
        body: {},
        headers: {},
        params: {},
        query: {},
        userId: 'user-1',
      });
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('agrees with the arithmetic in token-bucket.ts', async () => {
    const verdicts: RateLimitVerdict[] = [];
    for (let i = 0; i < 3; i += 1) {
      verdicts.push(await store.consume('k', 2, 2 / 1_000, clock.now()));
    }
    expect(verdicts.map((v) => v.allowed)).toEqual([true, true, false]);
    expect(verdicts[2].retryAfterMs).toBe(500);
  });
});

describe('policy table', () => {
  // Every policy has to be reachable by the key it declares, and the report
  // quotes these numbers, so a typo here is a wrong claim in the write-up.
  it('declares a sane budget and a fail mode for every policy', () => {
    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      expect(policy.limit).toBeGreaterThan(0);
      expect(policy.windowMs).toBeGreaterThan(0);
      expect(policy.criteria.length).toBeGreaterThan(0);
      expect(policy.reason.length).toBeGreaterThan(20);
      expect(['open', 'closed']).toContain(policy.failMode);
    }
  });

  it('keys nothing but public reads on the IP address', () => {
    const byIp = Object.values(RATE_LIMIT_POLICIES).filter((p) => p.keyOn === 'ip');
    expect(byIp.map((p) => p.name)).toEqual(['publicRead']);
  });

  it('fails closed on every credential surface', () => {
    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      if (policy.criteria.includes('C1') || policy.criteria.includes('C2')) {
        expect(policy.failMode).toBe('closed');
      }
    }
  });
});
