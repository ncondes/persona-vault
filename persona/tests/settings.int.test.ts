import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { prisma } from '../src/infrastructure/db/prisma';

// Settings, data export and account deletion against the real database.
describe('settings, export & delete account (integration)', () => {
  let app: ReturnType<typeof buildApp>;
  const email = `settings-int-${Date.now()}@example.com`;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const container = buildContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);
    agent = request.agent(app);

    await prisma.user.deleteMany({ where: { email } });
    await agent
      .post('/api/auth/register')
      .send({ fullName: 'Settings Tester', email, password: 'password123' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/settings')).status).toBe(401);
    expect((await request(app).get('/api/export')).status).toBe(401);
    expect((await request(app).delete('/api/account')).status).toBe(401);
  });

  it('reads and updates the privacy settings', async () => {
    let res = await agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ confirmSensitive: true, notifyAccess: false });

    res = await agent.put('/api/settings').send({ notifyAccess: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ confirmSensitive: true, notifyAccess: true });

    res = await agent.put('/api/settings').send({ shoeSize: 42 });
    expect(res.status).toBe(400);
  });

  it('exports everything as a download', async () => {
    const res = await agent.get('/api/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('persona-export.json');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.settings.notifyAccess).toBe(true);
    expect(res.body.vault.length).toBeGreaterThanOrEqual(2); // name + email from signup
    expect(Array.isArray(res.body.connections)).toBe(true);
    expect(Array.isArray(res.body.audit)).toBe(true);
  });

  it('deletes the account and everything with it', async () => {
    const res = await agent.delete('/api/account');
    expect(res.status).toBe(204);

    // the session is gone and so is the user
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
