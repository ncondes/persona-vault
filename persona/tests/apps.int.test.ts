import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// The developer console API surface: ownership, secret handling and validation.
describe('apps API (integration)', () => {
  const container = buildContainer();
  const app = buildApp(container);
  const stamp = Date.now();
  const email = `apps-int-${stamp}@example.com`;
  const otherEmail = `apps-other-${stamp}@example.com`;
  const agent = request.agent(app);
  const other = request.agent(app);

  const validApp = {
    name: 'Console Test App',
    description: 'Registered by the integration suite.',
    purpose: 'retail',
    accent: 'amber',
    allowedScopes: ['username', 'email'],
    requiredScopes: ['username'],
    redirectUris: ['http://localhost:4499/callback'],
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await agent
      .post('/api/auth/register')
      .send({ firstName: 'Dev', lastName: 'One', email, password: 'password123' });
    await other
      .post('/api/auth/register')
      .send({ firstName: 'Dev', lastName: 'Two', email: otherEmail, password: 'password123' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await prisma.$disconnect();
  });

  it('requires authentication on every route', async () => {
    const anon = request(app);
    expect((await anon.get('/api/apps')).status).toBe(401);
    expect((await anon.post('/api/apps').send(validApp)).status).toBe(401);
    expect((await anon.get('/api/apps/whatever')).status).toBe(401);
    expect((await anon.delete('/api/apps/whatever')).status).toBe(401);
  });

  it('creates an app, returns the secret once, and never leaks it again', async () => {
    const created = await agent.post('/api/apps').send(validApp);
    expect(created.status).toBe(201);

    const { id, secret, secretLastFour } = created.body.data;
    expect(id).toMatch(/^console-test-app-[0-9a-f]{6}$/);
    expect(secret).toBeTruthy();
    expect(secretLastFour).toBe(secret.slice(-4));

    const fetched = await agent.get(`/api/apps/${id}`);
    expect(fetched.status).toBe(200);

    const body = JSON.stringify(fetched.body);
    expect(body).not.toContain(secret);
    expect(body).not.toContain('secretEncrypted');
    expect(body).not.toContain('ownerId');
    expect(fetched.body.data.secretLastFour).toBe(secretLastFour);

    await agent.delete(`/api/apps/${id}`);
  });

  it('rejects an invalid body before it reaches the service', async () => {
    const res = await agent.post('/api/apps').send({ ...validApp, allowedScopes: ['shoe_size'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a redirect URI that is not a URL', async () => {
    const res = await agent.post('/api/apps').send({ ...validApp, redirectUris: ['not-a-url'] });
    expect(res.status).toBe(400);
  });

  it('scopes the list to the signed-in developer', async () => {
    const mine = await agent.post('/api/apps').send({ ...validApp, name: 'Mine Only' });
    const theirs = await other.post('/api/apps').send({ ...validApp, name: 'Theirs Only' });

    const list = await agent.get('/api/apps');
    const ids = list.body.data.map((row: { id: string }) => row.id);
    expect(ids).toContain(mine.body.data.id);
    expect(ids).not.toContain(theirs.body.data.id);

    await agent.delete(`/api/apps/${mine.body.data.id}`);
    await other.delete(`/api/apps/${theirs.body.data.id}`);
  });

  it('hides another developer’s app behind a 404', async () => {
    const theirs = await other.post('/api/apps').send({ ...validApp, name: 'Not Yours' });
    const id = theirs.body.data.id;

    expect((await agent.get(`/api/apps/${id}`)).status).toBe(404);
    expect((await agent.put(`/api/apps/${id}`).send({ name: 'Hijacked' })).status).toBe(404);
    expect((await agent.post(`/api/apps/${id}/secret`)).status).toBe(404);
    expect((await agent.get(`/api/apps/${id}/activity`)).status).toBe(404);
    expect((await agent.delete(`/api/apps/${id}`)).status).toBe(404);

    await other.delete(`/api/apps/${id}`);
  });

  it('updates an app and rotates its secret', async () => {
    const created = await agent.post('/api/apps').send({ ...validApp, name: 'Editable App' });
    const { id, secretLastFour } = created.body.data;

    const updated = await agent.put(`/api/apps/${id}`).send({ description: 'Changed.' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Changed.');

    const rotated = await agent.post(`/api/apps/${id}/secret`);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.secret).toBeTruthy();
    expect(rotated.body.data.secretLastFour).not.toBe(secretLastFour);

    expect((await agent.delete(`/api/apps/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/apps/${id}`)).status).toBe(404);
  });

  it('previews the payload against the caller’s own vault', async () => {
    const res = await agent.post('/api/apps/preview').send({
      purpose: 'healthcare',
      scopes: ['name', 'email', 'blood_type'],
    });
    expect(res.status).toBe(200);
    // Registration seeds a name and an email, but no blood type.
    expect(res.body.data.claims).toHaveProperty('name');
    expect(res.body.data.claims).toHaveProperty('email');
    expect(res.body.data.missing).toContain('blood_type');
  });

  it('reports empty activity for a brand new app', async () => {
    const created = await agent.post('/api/apps').send({ ...validApp, name: 'Quiet App' });
    const res = await agent.get(`/api/apps/${created.body.data.id}/activity`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ users: 0, grants: 0, releases: 0, revocations: 0 });
    expect(res.body.data.recent).toEqual([]);

    await agent.delete(`/api/apps/${created.body.data.id}`);
  });

  it('publishes the scope catalog for the console to read', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.scopes.length).toBeGreaterThan(0);
    expect(res.body.data.purposes).toContain('healthcare');
    // avatar can be stored but never shared.
    expect(res.body.data.kinds.avatar.scope).toBeNull();

    // The console groups the picker by these and builds its integration
    // snippets from the issuer.
    expect(res.body.data.scopeGroups).toEqual(['identity', 'contact', 'document', 'health']);
    expect(res.body.data.issuer).toMatch(/\/oidc$/);
    for (const meta of res.body.data.scopes) {
      expect(res.body.data.scopeGroups).toContain(meta.group);
    }
  });
});
