import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// Vault API against the real (Docker) database.
describe('vault API (integration)', () => {
  const app = buildApp(buildContainer());
  const email = `vault-int-${Date.now()}@example.com`;
  const agent = request.agent(app);

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await agent
      .post('/api/auth/register')
      .send({ fullName: 'Vault Tester', email, password: 'password123' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/vault')).status).toBe(401);
    expect((await request(app).post('/api/vault/items').send({})).status).toBe(401);
  });

  it('starts with the sign-up name and email as defaults', async () => {
    const res = await agent.get('/api/vault');
    expect(res.status).toBe(200);

    const items = res.body.data.items;
    const name = items.find((i: { kind: string }) => i.kind === 'name');
    const mail = items.find((i: { kind: string }) => i.kind === 'email');
    expect(name.value).toBe('Vault Tester');
    expect(name.isDefault).toBe(true);
    expect(name.sensitive).toBe(false);
    expect(mail.value).toBe(email);
    expect(mail.isDefault).toBe(true);
  });

  it('adds a second email and switches the default', async () => {
    const created = await agent
      .post('/api/vault/items')
      .send({ kind: 'email', value: 'work@acme.co', label: 'Work' });
    expect(created.status).toBe(201);
    expect(created.body.data.isDefault).toBe(false);

    const promoted = await agent
      .put(`/api/vault/items/${created.body.data.id}`)
      .send({ isDefault: true });
    expect(promoted.status).toBe(200);
    expect(promoted.body.data.isDefault).toBe(true);

    const list = await agent.get('/api/vault');
    const emails = list.body.data.items.filter((i: { kind: string }) => i.kind === 'email');
    expect(emails.filter((i: { isDefault: boolean }) => i.isDefault)).toHaveLength(1);
  });

  it('stores a document with its detail and flags it sensitive', async () => {
    const res = await agent.post('/api/vault/items').send({
      kind: 'document',
      value: '1032456789',
      detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.sensitive).toBe(true);
    expect(res.body.data.detail.type).toBe('CC');
  });

  it('rejects invalid payloads', async () => {
    // document without its detail
    let res = await agent.post('/api/vault/items').send({ kind: 'document', value: '99' });
    expect(res.status).toBe(400);

    // eps outside the catalog
    res = await agent.post('/api/vault/items').send({ kind: 'eps', value: 'NOT_AN_EPS' });
    expect(res.status).toBe(400);

    // unknown kind
    res = await agent.post('/api/vault/items').send({ kind: 'shoe_size', value: '42' });
    expect(res.status).toBe(400);
  });

  it('allows only one value for a single-value kind', async () => {
    const first = await agent.post('/api/vault/items').send({ kind: 'blood_type', value: 'O_POS' });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/vault/items')
      .send({ kind: 'blood_type', value: 'A_POS' });
    expect(second.status).toBe(409);
  });

  it('deletes an item', async () => {
    const created = await agent
      .post('/api/vault/items')
      .send({ kind: 'phone', value: '+57 300 555 0000' });
    const res = await agent.delete(`/api/vault/items/${created.body.data.id}`);
    expect(res.status).toBe(204);

    const list = await agent.get('/api/vault');
    expect(
      list.body.data.items.find((i: { id: string }) => i.id === created.body.data.id),
    ).toBeUndefined();
  });

  it('serves the public catalog', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.documentTypes).toContain('CC');
    expect(res.body.data.epsProviders).toContain('SANITAS');
    expect(res.body.data.kinds.address.sensitive).toBe(true);
  });
});
