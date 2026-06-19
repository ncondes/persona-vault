import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { prisma } from '../src/infrastructure/db/prisma';

// End-to-end profile flow against the real (Docker) database.
describe('profile API (integration)', () => {
  const app = buildApp(buildContainer());
  const email = `profile-int-${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('rejects profile access without authentication', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('lets a logged-in user update and read their profile', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email, password: 'password123' }).expect(201);

    const updated = await agent.put('/api/profile').send({
      names: { legal: 'María de los Ángeles', public: 'Mara' },
      fields: { email: { value: email }, phone: { value: '+44 7700 900999' } },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.names.legal).toBe('María de los Ángeles');
    expect(updated.body.data.fields.phone).toEqual({ value: '+44 7700 900999', sensitive: true });

    const fetched = await agent.get('/api/profile');
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.names.public).toBe('Mara');
  });

  it('rejects an invalid profile body', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password: 'password123' }).expect(200);

    const res = await agent.put('/api/profile').send({ names: { nickname: 'oops' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
