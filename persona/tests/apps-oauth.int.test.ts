import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Container } from '../src/container';
import { testContainer } from './support/app';
import { interactionLogin, registerVerified } from './support/otp';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { prisma } from '../src/infrastructure/db/prisma';

// The point of the developer console: an app registered at runtime through the
// REST API is a first-class OAuth client, and the scopes it declares are the
// hard ceiling on what a token for it can ever release.
describe('a console-registered app can run the real OAuth flow', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;

  const stamp = Date.now();
  const email = `apps-oauth-${stamp}@example.com`;
  const password = 'password123';
  const redirectUri = 'http://localhost:4498/callback';
  const asJson = { Accept: 'application/json' };

  let agent: TestAgent;
  let clientId = '';
  let clientSecret = '';

  beforeAll(async () => {
    container = testContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);

    await prisma.user.deleteMany({ where: { email } });
    agent = request.agent(app);

    await registerVerified(agent, { firstName: 'Ada', lastName: 'Lovelace', email, password });

    // Registration seeds a name and an email; add a username so the app can
    // ask for something outside the defaults.
    await agent.post('/api/vault/items').send({ kind: 'username', value: 'ada' });

    const created = await agent.post('/api/apps').send({
      name: 'Runtime App',
      purpose: 'social',
      allowedScopes: ['name', 'username', 'email'],
      requiredScopes: ['name'],
      redirectUris: [redirectUri],
    });
    expect(created.status).toBe(201);
    clientId = created.body.data.id;
    clientSecret = created.body.data.secret;
  });

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  const uidFrom = (location: string) => location.split('/interaction/')[1];
  // Interaction redirects are relative; resume URLs are absolute.
  const toPath = (loc: string) => {
    try {
      const url = new URL(loc);
      return url.pathname + url.search;
    } catch {
      return loc;
    }
  };

  function authorize(scope: string, overrides: Record<string, string> = {}) {
    return agent.get('/oidc/auth').query({
      client_id: clientId,
      response_type: 'code',
      scope,
      redirect_uri: redirectUri,
      state: 'xyz',
      ...overrides,
    });
  }

  // Walks the interaction to the consent step. The signed-in developer already
  // holds a session cookie, so the login prompt is usually satisfied silently
  // and the interaction returns a resume URL instead of a prompt.
  async function reachConsent(startLocation: string): Promise<string> {
    let uid = uidFrom(startLocation);

    for (let step = 0; step < 3; step += 1) {
      const details = await agent.get(`/interaction/${uid}`).set(asJson);
      if (details.body.prompt === 'consent') return uid;

      if (details.body.prompt === 'login') {
        const login = await interactionLogin(agent, uid, email, password);
        expect(login.status).toBe(200);
        uid = uidFrom((await agent.get(toPath(login.body.redirectTo))).headers.location);
        continue;
      }

      // Silent SSO: follow the resume URL to the next interaction.
      uid = uidFrom((await agent.get(toPath(details.body.redirectTo))).headers.location);
    }

    throw new Error('never reached the consent step');
  }

  // authorize -> (login) -> consent -> code -> token
  async function connect(
    scope: string,
    app: { id?: string; secret?: string; uri?: string } = {},
  ) {
    const id = app.id ?? clientId;
    const secret = app.secret ?? clientSecret;
    const uri = app.uri ?? redirectUri;

    // prompt=consent so a second connection still shows the screen instead of
    // being answered straight from the existing grant.
    const started = await agent.get('/oidc/auth').query({
      client_id: id,
      response_type: 'code',
      scope,
      redirect_uri: uri,
      state: 'xyz',
      prompt: 'consent',
    });
    const uid = await reachConsent(started.headers.location);

    let res = await agent.post(`/interaction/${uid}/decision`).set(asJson).send({});
    expect(res.status).toBe(200);

    res = await agent.get(toPath(res.body.redirectTo));
    const code = new URL(res.headers.location).searchParams.get('code') as string;

    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth(id, secret)
      .send({ grant_type: 'authorization_code', code, redirect_uri: uri });

    return { token, code };
  }

  it('completes the flow and releases the declared scopes', async () => {
    const { token } = await connect('openid name username');
    expect(token.status).toBe(200);

    const userinfo = await agent
      .get('/oidc/me')
      .set('Authorization', `Bearer ${token.body.access_token}`);

    expect(userinfo.status).toBe(200);
    // purpose 'social' suggests the public name; registration only stored one.
    expect(userinfo.body.name).toBe('Ada Lovelace');
    expect(userinfo.body.username).toBe('ada');
    // Never asked for, so never released.
    expect(userinfo.body).not.toHaveProperty('email');
  });

  it('refuses a scope the app did not declare', async () => {
    const res = await authorize('openid name document');
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain('error=invalid_scope');
  });

  // An unregistered redirect URI must not be redirected to — that would turn
  // the error itself into an open redirect.
  it('refuses an unregistered redirect URI without redirecting', async () => {
    const res = await agent.get('/oidc/auth').query({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid name',
      redirect_uri: 'http://evil.test/callback',
      state: 'xyz',
    });
    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('refuses a wrong client secret at the token endpoint', async () => {
    const { token } = await connect('openid name', { secret: 'not-the-secret' });
    expect(token.status).toBe(401);
    expect(token.body.error).toBe('invalid_client');
  });

  it('stops honouring an issued token once the app narrows its scopes', async () => {
    const { token } = await connect('openid name username');
    const accessToken = token.body.access_token as string;
    expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(200);

    const narrowed = await agent
      .put(`/api/apps/${clientId}`)
      .send({ allowedScopes: ['name'], requiredScopes: ['name'] });
    expect(narrowed.status).toBe(200);

    // The consent behind the token was revoked with the scope it named.
    expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(401);

    const res = await authorize('openid name username');
    expect(res.headers.location).toContain('error=invalid_scope');

    await agent.put(`/api/apps/${clientId}`).send({
      allowedScopes: ['name', 'username', 'email'],
      requiredScopes: ['name'],
    });
  });

  it('refuses to authorize a disabled app', async () => {
    await agent.put(`/api/apps/${clientId}`).send({ status: 'disabled' });
    const res = await authorize('openid name');
    expect(res.status).toBe(400);
    expect(res.text).toContain('invalid_client');
    await agent.put(`/api/apps/${clientId}`).send({ status: 'active' });
  });

  it('kills live tokens when the app is deleted', async () => {
    const uri = 'http://localhost:4497/callback';
    const created = await agent.post('/api/apps').send({
      name: 'Doomed App',
      purpose: 'social',
      allowedScopes: ['name'],
      requiredScopes: ['name'],
      redirectUris: [uri],
    });
    const { id, secret } = created.body.data;

    const { token } = await connect('openid name', { id, secret, uri });
    const accessToken = token.body.access_token as string;
    expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(200);

    expect((await agent.delete(`/api/apps/${id}`)).status).toBe(204);
    expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(401);
  });
});
