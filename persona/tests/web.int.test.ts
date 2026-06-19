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
    let res = await agent.post('/signup').type('form').send({ email, password: 'password123' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/account');

    res = await agent.get('/account');
    expect(res.status).toBe(200);
    expect(res.text).toContain(email);
  });

  it('saves the profile from the form', async () => {
    const agent = request.agent(app);
    await agent.post('/login').type('form').send({ email, password: 'password123' });

    const save = await agent
      .post('/account/profile')
      .type('form')
      .send({ n_legal: 'Web Tester', f_email: email });
    expect(save.status).toBe(302);

    const account = await agent.get('/account');
    expect(account.text).toContain('Web Tester');
  });

  it('protects the account page', async () => {
    const res = await request(app).get('/account');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
