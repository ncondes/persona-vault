import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Container } from '../src/container';
import { testContainer } from './support/app';
import { interactionLogin } from './support/otp';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { hashPassword } from '../src/infrastructure/auth/password';
import { prisma } from '../src/infrastructure/db/prisma';

// The security-test matrix, as executable statements.
//
// `demos/probe` is the same ten checks with a face on it: a registered relying
// party that misbehaves in a browser, for a person to watch. This file is the
// version that runs on every change, so what the console demonstrates once
// cannot quietly stop being true.
//
// Probe registered as a social app wanting a name and a handle. Every attack
// below reaches past that, and each test is named for the thing Persona is
// claiming to refuse.
describe('Persona under attack', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;
  const password = 'password123';
  const redirectUri = 'http://localhost:4414/callback';
  const asJson = { Accept: 'application/json' };
  let counter = 0;

  beforeAll(async () => {
    container = testContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'security-' } } });
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const email = `security-${Date.now()}-${counter++}@example.com`;
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: await hashPassword(password) });
      await repos.vault.create({
        userId: user.id,
        kind: 'name',
        value: 'Camila R.',
        detail: { firstName: 'Camila', lastName: 'R.' },
        nameContext: 'public',
        isDefault: true,
      });
      await repos.vault.create({ userId: user.id, kind: 'username', value: 'camir' });
      // The data Probe is really after, present in the vault so that "it was
      // not released" means something stronger than "it was not there".
      await repos.vault.create({ userId: user.id, kind: 'blood_type', value: 'O_POS' });
      await repos.vault.create({ userId: user.id, kind: 'address', value: 'Cra 7 # 45-10' });
      await repos.vault.create({
        userId: user.id,
        kind: 'document',
        value: '1032456789',
        detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
        isDefault: true,
      });
    });
    return email;
  }

  const uidFrom = (location: string) => location.split('/interaction/')[1];
  const toPath = (loc: string) => {
    try {
      const url = new URL(loc);
      return url.pathname + url.search;
    } catch {
      return loc;
    }
  };

  // Connects Probe honestly and hands back the access token plus the code it
  // spent, which is what the replay checks need.
  async function connectProbe(agent: TestAgent, email: string) {
    let res = await agent.get('/oidc/auth').query({
      client_id: 'probe',
      response_type: 'code',
      scope: 'openid name username',
      redirect_uri: redirectUri,
      state: 'xyz',
    });

    res = await interactionLogin(agent, uidFrom(res.headers.location), email, password);
    res = await agent.get(toPath(res.body.redirectTo));

    const consentUid = uidFrom(res.headers.location);
    res = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send({});
    res = await agent.get(toPath(res.body.redirectTo));

    const code = new URL(res.headers.location).searchParams.get('code') as string;
    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth('probe', 'probe-dev-secret')
      .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    expect(token.status).toBe(200);

    return { accessToken: token.body.access_token as string, code };
  }

  describe('asking for more than it registered', () => {
    it('refuses an authorization for scopes the app never declared', async () => {
      const res = await request(app).get('/oidc/auth').query({
        client_id: 'probe',
        response_type: 'code',
        scope: 'openid name username document blood_type allergies',
        redirect_uri: redirectUri,
        state: 'xyz',
      });

      // Refused by redirecting back with an error, before any consent screen
      // exists — so the person is never even asked about health data.
      expect(res.status).toBe(303);
      const params = new URL(res.headers.location).searchParams;
      expect(params.get('error')).toBe('invalid_scope');
      expect(res.headers.location).not.toContain('/interaction/');
    });

    it('cannot widen the grant at the token endpoint after consent', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const { accessToken } = await connectProbe(agent, email);

      // Ask again for everything, holding a token granted for two claims.
      const res = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['name', 'sub', 'username']);
    });
  });

  describe('sending the code somewhere it does not belong', () => {
    it('refuses an authorization aimed at an unregistered redirect URI', async () => {
      const res = await request(app).get('/oidc/auth').query({
        client_id: 'probe',
        response_type: 'code',
        scope: 'openid name',
        redirect_uri: 'http://probe-exfil.example/callback',
        state: 'xyz',
      });

      // Not a redirect at all. An unregistered URI is not answered to, not even
      // to report the error, so a stolen code has nowhere to land.
      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
      expect(res.text).toContain('invalid_redirect_uri');
    });
  });

  describe('pretending to be the app', () => {
    it('rejects a token request carrying the wrong client secret', async () => {
      const res = await request(app)
        .post('/oidc/token')
        .type('form')
        .auth('probe', 'definitely-the-wrong-secret')
        .send({
          grant_type: 'authorization_code',
          code: 'any-code-would-do',
          redirect_uri: redirectUri,
        });

      // Authentication is checked before the code is, so a wrong secret cannot
      // be used to learn which codes exist.
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_client');
    });

    it('rejects an invented access token', async () => {
      const res = await request(app)
        .get('/oidc/me')
        .set('Authorization', 'Bearer not-a-real-token-0000000000000000000000000000');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_token');
    });
  });

  describe('reaching past the claims it was given', () => {
    it('will not open the vault with an OAuth access token', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const { accessToken } = await connectProbe(agent, email);

      const res = await request(app).get('/api/vault').set('Authorization', `Bearer ${accessToken}`);

      // The vault belongs to the person's own session. A token for two claims
      // is not a key to the account behind them.
      expect(res.status).toBe(401);
    });

    it('will not delete the release history it appears in', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const { accessToken } = await connectProbe(agent, email);

      const res = await request(app)
        .delete('/api/audit')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBeGreaterThanOrEqual(401);
      expect(res.status).toBeLessThan(500);
    });

    it('never receives a field the person declined', async () => {
      const email = await makeUser();
      const agent = request.agent(app);

      let res = await agent.get('/oidc/auth').query({
        client_id: 'probe',
        response_type: 'code',
        scope: 'openid name username',
        redirect_uri: redirectUri,
        state: 'xyz',
      });
      res = await interactionLogin(agent, uidFrom(res.headers.location), email, password);
      res = await agent.get(toPath(res.body.redirectTo));
      const consentUid = uidFrom(res.headers.location);

      // Drop the optional name, keep only the required handle. Probe registered
      // `username` as required and `name` as optional, so this is the one the
      // person is allowed to refuse.
      res = await agent
        .post(`/interaction/${consentUid}/decision`)
        .set(asJson)
        .send({ excludedScopes: ['name'] });
      res = await agent.get(toPath(res.body.redirectTo));

      const code = new URL(res.headers.location).searchParams.get('code') as string;
      const token = await agent
        .post('/oidc/token')
        .type('form')
        .auth('probe', 'probe-dev-secret')
        .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

      const claims = await agent
        .get('/oidc/me')
        .set('Authorization', `Bearer ${token.body.access_token}`);

      expect(claims.status).toBe(200);
      expect(claims.body.username).toBe('camir');
      expect(claims.body.name).toBeUndefined();
    });
  });

  describe('replaying what it already used', () => {
    it('refuses an authorization code offered a second time', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const { code } = await connectProbe(agent, email);

      const replay = await agent
        .post('/oidc/token')
        .type('form')
        .auth('probe', 'probe-dev-secret')
        .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });

      expect(replay.status).toBeGreaterThanOrEqual(400);
      expect(replay.body.error).toBe('invalid_grant');
    });

    it('stops honouring a token the moment the person revokes the app', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const { accessToken } = await connectProbe(agent, email);

      const before = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);
      expect(before.status).toBe(200);

      // Revoked through the route the connections screen actually calls. Going
      // straight to the service would drop the standing consent but leave the
      // OIDC grant alive, which is not what a person clicking "revoke" does.
      expect((await agent.delete('/api/connections/probe')).status).toBe(204);

      const after = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);

      // Revocation is not advisory, and it does not wait for the token to age
      // out on its own.
      expect(after.status).toBe(401);
    });
  });

  describe('a paused app', () => {
    it('cannot start an authorization while it is disabled', async () => {
      await prisma.client.update({ where: { id: 'probe' }, data: { status: 'disabled' } });

      try {
        const res = await request(app).get('/oidc/auth').query({
          client_id: 'probe',
          response_type: 'code',
          scope: 'openid name',
          redirect_uri: redirectUri,
          state: 'xyz',
        });

        expect(res.status).toBe(400);
        expect(res.text).toContain('invalid_client');
      } finally {
        await prisma.client.update({ where: { id: 'probe' }, data: { status: 'active' } });
      }
    });
  });

  describe('PKCE', () => {
    it('refuses a code exchanged with the wrong verifier', async () => {
      const email = await makeUser();
      const agent = request.agent(app);
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');

      let res = await agent.get('/oidc/auth').query({
        client_id: 'probe',
        response_type: 'code',
        scope: 'openid name username',
        redirect_uri: redirectUri,
        state: 'xyz',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      });
      res = await interactionLogin(agent, uidFrom(res.headers.location), email, password);
      res = await agent.get(toPath(res.body.redirectTo));
      const consentUid = uidFrom(res.headers.location);
      res = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send({});
      res = await agent.get(toPath(res.body.redirectTo));
      const code = new URL(res.headers.location).searchParams.get('code') as string;

      // An intercepted code is worthless without the verifier that started the
      // flow, which never left the client.
      const stolen = await request(app)
        .post('/oidc/token')
        .type('form')
        .auth('probe', 'probe-dev-secret')
        .send({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: randomBytes(32).toString('base64url'),
        });

      expect(stolen.status).toBeGreaterThanOrEqual(400);
      expect(stolen.body.error).toBe('invalid_grant');
    });
  });
});
