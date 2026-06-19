import request from 'supertest';
import { buildContainer, Container } from '../src/container';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { hashPassword } from '../src/infrastructure/auth/password';
import { prisma } from '../src/infrastructure/db/prisma';

// Full "Connect with Persona" flow, driven programmatically:
// authorize -> login -> consent -> token -> userinfo. Each test uses its own
// fresh user so the serial flows stay independent.
describe('Connect with Persona — end to end', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;
  const password = 'password123';
  let counter = 0;

  beforeAll(async () => {
    container = buildContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'oidc-e2e-' } } });
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const email = `oidc-e2e-${Date.now()}-${counter++}@example.com`;
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: await hashPassword(password) });
      await repos.profiles.setNameVariant(user.id, 'legal', 'María de los Ángeles');
      await repos.profiles.setNameVariant(user.id, 'public', 'Mara P.');
      await repos.profiles.setProfileField(user.id, 'email', email, false);
      await repos.profiles.setProfileField(user.id, 'phone', '12345', true);
    });
    return email;
  }

  const uidFrom = (location: string) => location.split('/interaction/')[1];
  const toPath = (loc: string) => {
    try {
      const u = new URL(loc);
      return u.pathname + u.search;
    } catch {
      return loc;
    }
  };

  async function connect(clientId: string, secret: string, scope: string, email: string) {
    const redirectUri = `http://localhost:4410/callback/${clientId}`;
    const agent = request.agent(app);

    let res = await agent
      .get('/oidc/auth')
      .query({ client_id: clientId, response_type: 'code', scope, redirect_uri: redirectUri, state: 'xyz' });
    let uid = uidFrom(res.headers.location);

    res = await agent.post(`/interaction/${uid}/login`).type('form').send({ email, password });
    res = await agent.get(toPath(res.headers.location));

    uid = uidFrom(res.headers.location);
    res = await agent.post(`/interaction/${uid}/confirm`).type('form').send({});
    res = await agent.get(toPath(res.headers.location));
    const code = new URL(res.headers.location).searchParams.get('code') as string;

    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth(clientId, secret)
      .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

    const userinfo = await agent
      .get('/oidc/me')
      .set('Authorization', `Bearer ${token.body.access_token}`);

    return {
      tokenStatus: token.status,
      claims: userinfo.body,
      accessToken: token.body.access_token as string,
      agent,
    };
  }

  it('clinic (healthcare) receives the legal name + email', async () => {
    const email = await makeUser();
    const { tokenStatus, claims } = await connect('clinic', 'clinic-dev-secret', 'openid name email', email);
    expect(tokenStatus).toBe(200);
    expect(claims.name).toBe('María de los Ángeles');
    expect(claims.email).toBe(email);
  });

  it('forum (social) receives only the public name', async () => {
    const email = await makeUser();
    const { tokenStatus, claims } = await connect('forum', 'forum-dev-secret', 'openid name', email);
    expect(tokenStatus).toBe(200);
    expect(claims.name).toBe('Mara P.');
    expect(claims.email).toBeUndefined();
  });

  it('revoking a connection cuts the app off', async () => {
    const email = await makeUser();
    const { accessToken, agent } = await connect('clinic', 'clinic-dev-secret', 'openid name email', email);

    const before = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);
    expect(before.status).toBe(200);

    const revoke = await agent.delete('/api/connections/clinic');
    expect(revoke.status).toBe(204);

    const after = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);
    expect(after.status).toBe(401);
  });
});
