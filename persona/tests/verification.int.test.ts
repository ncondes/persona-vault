import request from 'supertest';
import { CHALLENGE_PATH } from '../src/constants/verification';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';
import { testContainer } from './support/app';
import { registerVerified } from './support/otp';

// The console's half of domain verification, end to end against the database.
describe('domain verification (integration)', () => {
  const container = testContainer();
  const app = buildApp(container);
  const stamp = Date.now();
  const email = `verify-int-${stamp}@example.com`;
  const agent = request.agent(app);

  let appId: string;

  beforeAll(async () => {
    await registerVerified(agent, {
      firstName: 'Verify',
      lastName: 'Tester',
      email,
      password: 'password123',
    });
    const created = await agent.post('/api/apps').send({
      name: `Verify Clinic ${stamp}`,
      purpose: 'healthcare',
      accent: 'teal',
      allowedScopes: ['name', 'email'],
      requiredScopes: ['name'],
      redirectUris: ['https://clinic.example/callback'],
    });
    expect(created.status).toBe(201);
    appId = created.body.data.id;
  });

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { id: appId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'verify-int-' } } });
    await prisma.$disconnect();
  });

  it('starts unverified, and says so in the console', async () => {
    const res = await agent.get(`/api/apps/${appId}`);
    expect(res.body.data.verifiedDomain).toBeNull();
    expect(res.body.data.verifiedAt).toBeNull();
  });

  it('hands back the domain, the path to serve, and a token', async () => {
    const res = await agent.post(`/api/apps/${appId}/verification`);
    expect(res.status).toBe(200);
    expect(res.body.data.domain).toBe('clinic.example');
    expect(res.body.data.url).toBe(`https://clinic.example${CHALLENGE_PATH}`);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  // The whole point of the SSRF guard, reached through the route a developer
  // actually calls: clinic.example does not resolve, so this is refused rather
  // than attempted.
  it('reports a failure rather than a server error when the domain cannot answer', async () => {
    await agent.post(`/api/apps/${appId}/verification`);
    const res = await agent.post(`/api/apps/${appId}/verification/check`);

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.reason).toEqual(expect.any(String));
  });

  it('refuses to check before a challenge was issued', async () => {
    const fresh = await agent.post('/api/apps').send({
      name: `Unstarted ${stamp}`,
      purpose: 'social',
      accent: 'teal',
      allowedScopes: ['name'],
      requiredScopes: ['name'],
      redirectUris: ['https://other.example/callback'],
    });
    const res = await agent.post(`/api/apps/${fresh.body.data.id}/verification/check`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_CHALLENGE');
    await prisma.client.delete({ where: { id: fresh.body.data.id } });
  });

  it('refuses to verify an app whose redirect URIs are on different domains', async () => {
    const split = await agent.post('/api/apps').send({
      name: `Split ${stamp}`,
      purpose: 'social',
      accent: 'teal',
      allowedScopes: ['name'],
      requiredScopes: ['name'],
      redirectUris: ['https://a.example/cb', 'https://b.example/cb'],
    });
    const res = await agent.post(`/api/apps/${split.body.data.id}/verification`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REDIRECT_URIS_DIFFER');
    await prisma.client.delete({ where: { id: split.body.data.id } });
  });

  it('hides another developer’s app behind the same 404 as everything else', async () => {
    const stranger = request.agent(app);
    await registerVerified(stranger, {
      firstName: 'Other',
      lastName: 'Dev',
      email: `verify-int-other-${stamp}@example.com`,
      password: 'password123',
    });
    const res = await stranger.post(`/api/apps/${appId}/verification`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APP_NOT_FOUND');
  });

  describe('when the app moves', () => {
    beforeEach(async () => {
      await prisma.client.update({
        where: { id: appId },
        data: {
          verifiedDomain: 'clinic.example',
          verifiedAt: new Date(),
          redirectUris: ['https://clinic.example/callback'],
        },
      });
    });

    // The failure that would matter: an unverified app still wearing a badge.
    it('takes the badge down when the redirect URIs move to another domain', async () => {
      const res = await agent
        .put(`/api/apps/${appId}`)
        .send({ redirectUris: ['https://somewhere-else.example/callback'] });

      expect(res.status).toBe(200);
      expect(res.body.data.verifiedDomain).toBeNull();
    });

    it('keeps it when only the path changes on the same domain', async () => {
      const res = await agent
        .put(`/api/apps/${appId}`)
        .send({ redirectUris: ['https://clinic.example/auth/callback'] });

      expect(res.status).toBe(200);
      expect(res.body.data.verifiedDomain).toBe('clinic.example');
    });

    it('keeps it when a second URI is added on the same domain', async () => {
      const res = await agent.put(`/api/apps/${appId}`).send({
        redirectUris: ['https://clinic.example/callback', 'https://clinic.example/other'],
      });

      expect(res.status).toBe(200);
      expect(res.body.data.verifiedDomain).toBe('clinic.example');
    });
  });
});
