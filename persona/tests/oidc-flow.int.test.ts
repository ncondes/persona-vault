import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { hashPassword } from '../src/infrastructure/auth/password';
import { prisma } from '../src/infrastructure/db/prisma';

// Full "Connect with Persona" flow, driven programmatically:
// authorize -> login -> consent -> token -> userinfo.
describe('Connect with Persona — end to end', () => {
  let app: ReturnType<typeof buildApp>;
  const email = `oidc-e2e-${Date.now()}@example.com`;
  const password = 'password123';

  beforeAll(async () => {
    const container = buildContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);

    await prisma.user.deleteMany({ where: { email } });
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: await hashPassword(password) });
      await repos.profiles.setNameVariant(user.id, 'legal', 'María de los Ángeles');
      await repos.profiles.setNameVariant(user.id, 'public', 'Mara P.');
      await repos.profiles.setProfileField(user.id, 'email', email, false);
      await repos.profiles.setProfileField(user.id, 'phone', '12345', true);
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  const uidFrom = (location: string) => location.split('/interaction/')[1];

  // oidc-provider redirects with absolute (issuer) URLs; follow only the path so
  // the request stays on the supertest server (and keeps the agent's cookies).
  const toPath = (loc: string) => {
    try {
      const u = new URL(loc);
      return u.pathname + u.search;
    } catch {
      return loc;
    }
  };

  async function connect(clientId: string, secret: string, scope: string) {
    const redirectUri = `http://localhost:4410/callback/${clientId}`;
    const agent = request.agent(app);

    // 1. authorize -> redirected to the login interaction
    let res = await agent
      .get('/oidc/auth')
      .query({ client_id: clientId, response_type: 'code', scope, redirect_uri: redirectUri, state: 'xyz' });
    let uid = uidFrom(res.headers.location);

    // 2. submit credentials -> resume
    res = await agent.post(`/interaction/${uid}/login`).type('form').send({ email, password });
    res = await agent.get(toPath(res.headers.location));

    // 3. consent -> resume -> redirect back to the client with a code
    uid = uidFrom(res.headers.location);
    res = await agent.post(`/interaction/${uid}/confirm`).type('form').send({});
    res = await agent.get(toPath(res.headers.location));
    const code = new URL(res.headers.location).searchParams.get('code') as string;

    // 4. exchange the code for tokens
    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth(clientId, secret)
      .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

    // 5. fetch the profile (userinfo)
    const userinfo = await agent
      .get('/oidc/me')
      .set('Authorization', `Bearer ${token.body.access_token}`);

    return { tokenStatus: token.status, claims: userinfo.body };
  }

  it('clinic (healthcare) receives the legal name + email', async () => {
    const { tokenStatus, claims } = await connect('clinic', 'clinic-dev-secret', 'openid name email');
    // eslint-disable-next-line no-console
    console.log('CLINIC userinfo:', JSON.stringify(claims));
    expect(tokenStatus).toBe(200);
    expect(claims.name).toBe('María de los Ángeles');
    expect(claims.email).toBe(email);
  });

  it('forum (social) receives only the public name', async () => {
    const { tokenStatus, claims } = await connect('forum', 'forum-dev-secret', 'openid name');
    // eslint-disable-next-line no-console
    console.log('FORUM userinfo:', JSON.stringify(claims));
    expect(tokenStatus).toBe(200);
    expect(claims.name).toBe('Mara P.');
    expect(claims.email).toBeUndefined();
  });
});
