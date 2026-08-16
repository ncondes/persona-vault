import { CookieAccessInfo } from 'cookiejar';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS } from '../src/constants/otp';
import { config } from '../src/config/config';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';
import { testContainer } from './support/app';
import { TEST_CODE, forceCode, loginVerified, registerVerified } from './support/otp';

// End-to-end auth flow against the real (Docker) database. Run with
// `npm run db:up` first, then `npm run test:int`.
describe('auth flow (integration)', () => {
  const app = buildApp(testContainer());
  const email = `auth-int-${Date.now()}@example.com`;
  const details = { firstName: 'Auth', lastName: 'Tester', email, password: 'password123' };

  afterAll(async () => {
    await prisma.otpChallenge.deleteMany({ where: { email: { startsWith: 'auth-int-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-int-' } } });
    await prisma.$disconnect();
  });

  it('registers, exposes /me, then logout ends the session', async () => {
    const agent = request.agent(app); // keeps the session cookie between calls

    const reg = await registerVerified(agent, details);
    expect(reg.status).toBe(201);
    expect(reg.body.data.email).toBe(email);
    expect(reg.body.data.passwordHash).toBeUndefined();

    // Registration starts the vault with the essentials.
    const vault = await agent.get('/api/vault');
    const kinds = vault.body.data.items.map((i: { kind: string }) => i.kind);
    expect(kinds).toContain('name');
    expect(kinds).toContain('email');

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    await agent.post('/api/auth/logout').expect(204);

    const meAfter = await agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
  });

  it('rejects /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const agent = request.agent(app);

    const bad = await agent.post('/api/auth/login').send({ email, password: 'wrong' });
    expect(bad.status).toBe(401);

    const good = await loginVerified(agent, email, 'password123');
    expect(good.status).toBe(200);
    expect(good.body.data.email).toBe(email);
  });

  // The development helper, mounted only outside production: it returns a working
  // code so a sign-in can be finished without a reachable inbox.
  it('signs in through the dev endpoint without an email or a password', async () => {
    const agent = request.agent(app);

    const dev = await agent.post('/api/auth/dev/login').send({ email });
    expect(dev.status).toBe(200);
    expect(dev.body.data.code).toMatch(/^\d{6}$/);

    const verified = await agent
      .post('/api/auth/login/verify')
      .send({ challengeId: dev.body.data.challengeId, code: dev.body.data.code });
    expect(verified.status).toBe(200);
    expect(verified.body.data.email).toBe(email);

    const me = await agent.get('/api/auth/me');
    expect(me.body.data.email).toBe(email);
  });

  it('rejects registration with an invalid body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ firstName: '', lastName: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registering an email that already exists', async () => {
    const res = await request(app).post('/api/auth/register').send(details);
    expect(res.status).toBe(409);
  });

  // The point of the whole two-step dance.
  describe('the emailed code', () => {
    const fresh = () => `auth-int-otp-${Date.now()}-${Math.floor(process.hrtime()[1])}@example.com`;

    it('starts a sign-up without creating anything', async () => {
      const target = fresh();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });

      expect(res.status).toBe(202);
      expect(res.body.data.challengeId).toBeTruthy();
      expect(res.body.data.email).toBe(target);
      // No session, and no account.
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
    });

    it('never puts the code in the response or the database in the clear', async () => {
      const target = fresh();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      await forceCode(res.body.data.challengeId);

      const row = await prisma.otpChallenge.findUnique({
        where: { id: res.body.data.challengeId },
      });
      expect(JSON.stringify(res.body)).not.toContain(TEST_CODE);
      expect(row!.codeHash).not.toBe(TEST_CODE);
      expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('leaves no account behind when the code is wrong', async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      await forceCode(started.body.data.challengeId);

      const res = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId: started.body.data.challengeId, code: '999999' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('OTP_INVALID');
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
    });

    it(`burns the challenge after ${OTP_MAX_ATTEMPTS} wrong codes`, async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      const challengeId = started.body.data.challengeId;
      await forceCode(challengeId);

      let last;
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
        last = await request(app)
          .post('/api/auth/register/verify')
          .send({ challengeId, code: '999999' });
      }

      expect(last!.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
      // Even the right code is no good now.
      const after = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId, code: TEST_CODE });
      expect(after.body.error.code).toBe('CHALLENGE_NOT_FOUND');
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
    });

    it('refuses a code that has expired', async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      const challengeId = started.body.data.challengeId;
      await forceCode(challengeId);
      await prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId, code: TEST_CODE });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });

    it('rejects a code that is not six digits before it costs an attempt', async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      const challengeId = started.body.data.challengeId;

      for (const code of ['12345', '1234567', 'abcdef', '']) {
        const res = await request(app)
          .post('/api/auth/register/verify')
          .send({ challengeId, code });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }

      const row = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
      expect(row!.attempts).toBe(0);
    });

    it('holds the cooldown, then counts the resend', async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      const challengeId = started.body.data.challengeId;

      const tooSoon = await request(app).post('/api/auth/otp/resend').send({ challengeId });
      expect(tooSoon.status).toBe(429);
      expect(tooSoon.body.error.code).toBe('OTP_RESEND_TOO_SOON');

      await prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { lastSentAt: new Date(0) },
      });
      const resent = await request(app).post('/api/auth/otp/resend').send({ challengeId });

      expect(resent.status).toBe(202);
      expect(resent.body.data.challengeId).toBe(challengeId);
      const row = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
      expect(row!.sends).toBe(2);
    });

    // Asking again returns the same challenge and sends nothing, which is what
    // caps how much mail one address can be made to receive.
    it(`caps an address at ${OTP_MAX_SENDS} codes however you ask for them`, async () => {
      const target = fresh();
      const started = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      const challengeId = started.body.data.challengeId;

      for (let sent = 1; sent < OTP_MAX_SENDS; sent += 1) {
        await prisma.otpChallenge.update({
          where: { id: challengeId },
          data: { lastSentAt: new Date(0) },
        });
        await request(app).post('/api/auth/otp/resend').send({ challengeId }).expect(202);
      }
      await prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { lastSentAt: new Date(0) },
      });

      const capped = await request(app).post('/api/auth/otp/resend').send({ challengeId });
      expect(capped.status).toBe(429);
      expect(capped.body.error.code).toBe('OTP_SEND_LIMIT');

      // The front door is not a way around it: same challenge, nothing sent.
      const again = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      expect(again.status).toBe(202);
      expect(again.body.data.challengeId).toBe(challengeId);
      const row = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
      expect(row!.sends).toBe(OTP_MAX_SENDS);
      expect(await prisma.otpChallenge.count({ where: { email: target } })).toBe(1);
    });

    it('will not let a sign-up code finish a sign-in, or the other way round', async () => {
      const target = fresh();
      const signup = await request(app)
        .post('/api/auth/register')
        .send({ ...details, email: target });
      await forceCode(signup.body.data.challengeId);

      const asLogin = await request(app)
        .post('/api/auth/login/verify')
        .send({ challengeId: signup.body.data.challengeId, code: TEST_CODE });
      expect(asLogin.status).toBe(401);
      expect(asLogin.body.error.code).toBe('CHALLENGE_NOT_FOUND');

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'password123' });
      await forceCode(login.body.data.challengeId);
      const asSignup = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId: login.body.data.challengeId, code: TEST_CODE });
      expect(asSignup.status).toBe(401);
      expect(asSignup.body.error.code).toBe('CHALLENGE_NOT_FOUND');
    });

    it('sends nothing and says nothing for an unknown sign-in address', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `auth-int-nobody-${Date.now()}@example.com`, password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(await prisma.otpChallenge.count({ where: { email: { startsWith: 'auth-int-nobody' } } }))
        .toBe(0);
    });
  });

  // The session cookie is a signed JWT and nothing else. These are the ways
  // someone would try to walk in with one they made up.
  describe('forged session cookies', () => {
    it.each([
      ['a token signed with another key', jwt.sign({ sub: 'user-1' }, 'attacker-secret')],
      ['a token with no subject', jwt.sign({ role: 'admin' }, config.authSecret)],
      ['an expired token', jwt.sign({ sub: 'user-1' }, config.authSecret, { expiresIn: -1 })],
      ['a token that is not a JWT', 'just-some-string'],
    ])('rejects %s', async (_label, token) => {
      const res = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a token whose payload was swapped after signing', async () => {
      const agent = request.agent(app);
      await loginVerified(agent, email, 'password123');

      const real = (agent.jar.getCookie('token', CookieAccessInfo.All) as { value: string }).value;
      const [header, , signature] = real.split('.');
      const swapped = Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url');

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`token=${header}.${swapped}.${signature}`]);
      expect(res.status).toBe(401);
    });
  });

  // A perfectly valid token can outlive the account it names. The route has to
  // notice rather than hand back a half-built user.
  it('rejects a valid token for a user that no longer exists', async () => {
    const ghostEmail = `auth-int-ghost-${Date.now()}@example.com`;
    const agent = request.agent(app);
    const reg = await registerVerified(agent, {
      firstName: 'Ghost',
      lastName: 'User',
      email: ghostEmail,
      password: 'password123',
    });
    expect(reg.status).toBe(201);

    await prisma.user.delete({ where: { email: ghostEmail } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});
