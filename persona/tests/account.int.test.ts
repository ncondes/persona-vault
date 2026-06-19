import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// Audit history + connected-apps endpoints. (Revoking the live OIDC grant needs
// the provider; here we verify the consent record is removed.)
describe('account API (integration)', () => {
  const container = buildContainer();
  const app = buildApp(container);
  const email = `account-int-${Date.now()}@example.com`;
  const agent = request.agent(app);
  let userId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const reg = await agent.post('/api/auth/register').send({ email, password: 'password123' });
    userId = reg.body.data.id;

    await container.repositories.audit.recordRelease({
      userId,
      clientId: 'clinic',
      context: 'healthcare',
      scopesReleased: ['name', 'email'],
      fieldsReleased: ['name', 'email'],
    });
    await container.repositories.consents.record({
      userId,
      clientId: 'clinic',
      scopes: ['openid', 'name', 'email'],
      grantId: 'grant-test-1',
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/audit')).status).toBe(401);
    expect((await request(app).get('/api/connections')).status).toBe(401);
  });

  it('returns the audit history', async () => {
    const res = await agent.get('/api/audit');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].clientId).toBe('clinic');
    expect(res.body.data[0].fieldsReleased).toContain('email');
  });

  it('lists connections with the client name, then revokes one', async () => {
    let res = await agent.get('/api/connections');
    expect(res.status).toBe(200);
    const clinic = res.body.data.find((c: { clientId: string }) => c.clientId === 'clinic');
    expect(clinic).toBeDefined();
    expect(clinic.clientName).toBe('City Health Clinic');

    res = await agent.delete('/api/connections/clinic');
    expect(res.status).toBe(204);

    res = await agent.get('/api/connections');
    expect(res.body.data.find((c: { clientId: string }) => c.clientId === 'clinic')).toBeUndefined();
  });
});
