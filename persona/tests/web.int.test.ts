import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// Server-rendered Persona pages (signup, login, account, profile edit).
describe('web UI (integration)', () => {
  const app = buildApp(buildContainer());
  const email = `web-int-${Date.now()}@example.com`;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('redirects / to /login when signed out', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('serves the signup page', async () => {
    const res = await request(app).get('/signup');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create your Persona');
  });

  it('signs up and lands on the account page', async () => {
    const agent = request.agent(app);
    let res = await agent
      .post('/signup')
      .type('form')
      .send({ fullName: 'Web Signup', email, password: 'password123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/account');

    res = await agent.get('/account');
    expect(res.status).toBe(200);
    expect(res.text).toContain(email);
  });

  it('shows vault items on the account page', async () => {
    const agent = request.agent(app);
    await agent.post('/login').type('form').send({ email, password: 'password123' });

    const container = buildContainer();
    const user = await prisma.user.findUnique({ where: { email } });
    await container.repositories.vault.create({
      userId: user!.id,
      kind: 'name',
      value: 'Web Tester',
      nameContext: 'preferred',
      isDefault: true,
    });

    const account = await agent.get('/account');
    expect(account.text).toContain('Web Tester');
  });

  it('protects the account page', async () => {
    const res = await request(app).get('/account');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
