import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// End-to-end auth flow against the real (Docker) database. Run with
// `npm run db:up` first, then `npm run test:int`.
describe('auth flow (integration)', () => {
  const app = buildApp(buildContainer());
  const email = `auth-int-${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('registers, exposes /me, then logout ends the session', async () => {
    const agent = request.agent(app); // keeps the session cookie between calls

    const reg = await agent
      .post('/api/auth/register')
      .send({ fullName: 'Auth Tester', email, password: 'password123' });
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
      .send({ fullName: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
