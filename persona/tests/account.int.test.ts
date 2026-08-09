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
    const reg = await agent
      .post('/api/auth/register')
      .send({ firstName: 'Account', lastName: 'Tester', email, password: 'password123' });
    userId = reg.body.data.id;

    await container.repositories.audit.record({
      userId,
      clientId: 'clinic',
      type: 'release',
      context: 'healthcare',
      scopesReleased: ['name', 'email'],
      fieldsReleased: ['name', 'email'],
    });
    await container.repositories.consents.record({
      userId,
      clientId: 'clinic',
      scopes: ['name', 'email'],
      selections: [
        {
          scope: 'email',
          itemIds: ['item-x'],
          snapshot: [{ label: 'Personal', value: email, detail: null }],
        },
      ],
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

  it('returns the audit history with type and client name', async () => {
    const res = await agent.get('/api/audit');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].clientId).toBe('clinic');
    expect(res.body.data[0].clientName).toBe('City Health Clinic');
    expect(res.body.data[0].type).toBe('release');
    expect(res.body.data[0].fieldsReleased).toContain('email');
  });

  it('lists connections with the exact values shared, then revokes one', async () => {
    let res = await agent.get('/api/connections');
    expect(res.status).toBe(200);
    const clinic = res.body.data.find((c: { clientId: string }) => c.clientId === 'clinic');
    expect(clinic).toBeDefined();
    expect(clinic.clientName).toBe('City Health Clinic');
    expect(clinic.purpose).toBe('healthcare');
    expect(clinic.shared[0].scope).toBe('email');
    expect(clinic.shared[0].snapshot[0].value).toBe(email);

    res = await agent.delete('/api/connections/clinic');
    expect(res.status).toBe(204);

    res = await agent.get('/api/connections');
    expect(res.body.data.find((c: { clientId: string }) => c.clientId === 'clinic')).toBeUndefined();

    // the revocation itself is on the audit trail
    res = await agent.get('/api/audit');
    expect(res.body.data.some((a: { type: string }) => a.type === 'revoke')).toBe(true);
  });

  // Revoking twice, or revoking an app that was never connected, is not an
  // error — the person's intent ("this app should not have my data") is already
  // satisfied, and a 404 here would just be noise in the UI.
  it.each([
    ['a connection that was already revoked', 'clinic'],
    ['an app that was never connected', 'store'],
    ['an app that does not exist at all', 'no-such-app'],
  ])('answers 204 when revoking %s', async (_label, clientId) => {
    expect((await agent.delete(`/api/connections/${clientId}`)).status).toBe(204);
  });
});
