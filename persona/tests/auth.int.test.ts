import { CookieAccessInfo } from 'cookiejar';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { config } from '../src/config/config';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// End-to-end auth flow against the real (Docker) database. Run with
// `npm run db:up` first, then `npm run test:int`.
describe('auth flow (integration)', () => {
  const app = buildApp(buildContainer());
  const email = `auth-int-${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-int-' } } });
    await prisma.$disconnect();
  });

  it('registers, exposes /me, then logout ends the session', async () => {
    const agent = request.agent(app); // keeps the session cookie between calls

    const reg = await agent
      .post('/api/auth/register')
      .send({ firstName: 'Auth', lastName: 'Tester', email, password: 'password123' });
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

    const good = await agent.post('/api/auth/login').send({ email, password: 'password123' });
    expect(good.status).toBe(200);
    expect(good.body.data.email).toBe(email);
  });

  it('rejects registration with an invalid body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ firstName: '', lastName: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registering an email that already exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ firstName: 'Auth', lastName: 'Tester', email, password: 'password123' });
    expect(res.status).toBe(409);
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
      await agent.post('/api/auth/login').send({ email, password: 'password123' });

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
    const reg = await agent
      .post('/api/auth/register')
      .send({ firstName: 'Ghost', lastName: 'User', email: ghostEmail, password: 'password123' });
    expect(reg.status).toBe(201);

    await prisma.user.delete({ where: { email: ghostEmail } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});
