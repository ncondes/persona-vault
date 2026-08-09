import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Container } from '../src/container';
import { testContainer } from './support/app';
import { interactionLogin } from './support/otp';
import { buildApp } from '../src/server';
import { DEMO_CLIENTS } from '../src/constants/clients';
import { createOidcProvider } from '../src/oidc/provider';
import { hashPassword } from '../src/infrastructure/auth/password';
import { prisma } from '../src/infrastructure/db/prisma';

// Taken from the seed list so a change to a demo app's redirect URI cannot
// silently break these flows.
const REDIRECT_URI: Record<string, string> = Object.fromEntries(
  DEMO_CLIENTS.map((client) => [client.id, client.redirectUris[0]]),
);

// Full "Connect with Persona" flow, driven through the JSON interaction API:
// authorize -> login -> consent details -> decision -> token -> userinfo.
// Each test uses its own fresh user so the serial flows stay independent.
describe('Connect with Persona — end to end', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;
  const password = 'password123';
  let counter = 0;

  beforeAll(async () => {
    container = testContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'oidc-e2e-' } } });
    await prisma.$disconnect();
  });

  interface SeededUser {
    email: string;
    itemIds: Record<string, string>;
  }

  async function makeUser(withEps = false): Promise<SeededUser> {
    const email = `oidc-e2e-${Date.now()}-${counter++}@example.com`;
    const itemIds: Record<string, string> = {};
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: await hashPassword(password) });
      const add = async (key: string, input: Parameters<typeof repos.vault.create>[0]) => {
        const item = await repos.vault.create(input);
        itemIds[key] = item.id;
      };
      await add('legalName', {
        userId: user.id,
        kind: 'name',
        value: 'María de los Ángeles',
        detail: { firstName: 'María', lastName: 'de los Ángeles' },
        nameContext: 'legal',
      });
      await add('publicName', {
        userId: user.id,
        kind: 'name',
        value: 'Mara P.',
        detail: { firstName: 'Mara', lastName: 'P.' },
        nameContext: 'public',
        isDefault: true,
      });
      await add('personalEmail', { userId: user.id, kind: 'email', value: email, isDefault: true });
      await add('workEmail', {
        userId: user.id,
        kind: 'email',
        value: 'work@acme.co',
        label: 'Work',
      });
      await add('username', { userId: user.id, kind: 'username', value: 'marap' });
      await add('address', {
        userId: user.id,
        kind: 'address',
        value: '12 Kings Road',
        isDefault: true,
      });
      await add('document', {
        userId: user.id,
        kind: 'document',
        value: '1032456789',
        detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
        isDefault: true,
      });
      if (withEps) {
        await add('eps', { userId: user.id, kind: 'eps', value: 'SANITAS' });
      }
    });
    return { email, itemIds };
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

  const asJson = { Accept: 'application/json' };

  // Drives authorize -> login -> consent details, returning the consent uid so
  // the test can shape its own decision.
  async function startConsent(agent: TestAgent, clientId: string, scope: string, email: string) {
    const redirectUri = REDIRECT_URI[clientId];

    let res = await agent
      .get('/oidc/auth')
      .query({ client_id: clientId, response_type: 'code', scope, redirect_uri: redirectUri, state: 'xyz' });
    const loginUid = uidFrom(res.headers.location);

    res = await interactionLogin(agent, loginUid, email, password);
    expect(res.status).toBe(200);

    res = await agent.get(toPath(res.body.redirectTo));
    const consentUid = uidFrom(res.headers.location);

    const details = await agent.get(`/interaction/${consentUid}`).set(asJson);
    expect(details.status).toBe(200);
    expect(details.body.prompt).toBe('consent');
    return { consentUid, details: details.body, redirectUri };
  }

  // Posts the decision and exchanges the code for tokens + userinfo claims.
  async function completeConsent(
    agent: TestAgent,
    clientId: string,
    secret: string,
    consentUid: string,
    redirectUri: string,
    decision: Record<string, unknown> = {},
  ) {
    let res = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send(decision);
    expect(res.status).toBe(200);

    res = await agent.get(toPath(res.body.redirectTo));
    const code = new URL(res.headers.location).searchParams.get('code') as string;

    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth(clientId, secret)
      .send({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    expect(token.status).toBe(200);

    const userinfo = await agent
      .get('/oidc/me')
      .set('Authorization', `Bearer ${token.body.access_token}`);
    return { claims: userinfo.body, accessToken: token.body.access_token as string };
  }

  it('clinic flow: context suggests the legal name, the user picks the work email', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid, details, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid name email eps',
      user.email,
    );

    // the healthcare context pre-selects the legal name
    const nameField = details.fields.find((f: { scope: string }) => f.scope === 'name');
    expect(nameField.suggestedIds).toEqual([user.itemIds.legalName]);
    expect(nameField.options).toHaveLength(2);

    const { claims } = await completeConsent(agent, 'clinic', 'clinic-dev-secret', consentUid, redirectUri, {
      selections: { email: [user.itemIds.workEmail] },
    });
    expect(claims.name).toBe('María de los Ángeles'); // suggestion applied
    expect(claims.email).toBe('work@acme.co'); // user's pick applied
    expect(claims.eps).toBe('SANITAS');
  });

  it('a client can request just one part of the name', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid given_name email eps',
      user.email,
    );

    const { claims } = await completeConsent(agent, 'clinic', 'clinic-dev-secret', consentUid, redirectUri);
    expect(claims.given_name).toBe('María'); // first part of the legal name
    expect(claims).not.toHaveProperty('name');
    expect(claims).not.toHaveProperty('family_name');
  });

  it('the user can override the suggested name — their choice wins at userinfo', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid name email eps',
      user.email,
    );

    const { claims } = await completeConsent(agent, 'clinic', 'clinic-dev-secret', consentUid, redirectUri, {
      selections: { name: [user.itemIds.publicName] },
    });
    expect(claims.name).toBe('Mara P.');
  });

  it('excluding an optional sensitive scope keeps it out of the release', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid, details, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid name email eps address',
      user.email,
    );

    const addressField = details.fields.find((f: { scope: string }) => f.scope === 'address');
    expect(addressField.sensitive).toBe(true);
    expect(addressField.required).toBe(false);

    const { claims } = await completeConsent(agent, 'clinic', 'clinic-dev-secret', consentUid, redirectUri, {
      excludedScopes: ['address'],
    });
    expect(claims.name).toBe('María de los Ángeles');
    expect(claims).not.toHaveProperty('address');
  });

  it('rejects a decision that excludes a required scope', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid } = await startConsent(agent, 'clinic', 'openid name email eps', user.email);

    const res = await agent
      .post(`/interaction/${consentUid}/decision`)
      .set(asJson)
      .send({ excludedScopes: ['email'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DECISION');
  });

  it('missing required data blocks consent until it is added to the vault inline', async () => {
    const user = await makeUser(false); // no EPS yet
    const agent = request.agent(app);
    const { consentUid, details, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid name email eps',
      user.email,
    );

    const epsField = details.fields.find((f: { scope: string }) => f.scope === 'eps');
    expect(epsField.missing).toBe(true);
    expect(epsField.required).toBe(true);

    // the decision cannot complete yet
    let res = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELDS');
    expect(res.body.error.fields.scopes).toContain('eps');

    // the consent page saves the missing value straight into the vault (the
    // interaction login set the session cookie) and retries
    res = await agent.post('/api/vault/items').send({ kind: 'eps', value: 'SURA' });
    expect(res.status).toBe(201);

    const { claims } = await completeConsent(agent, 'clinic', 'clinic-dev-secret', consentUid, redirectUri);
    expect(claims.eps).toBe('SURA');

    // and the value now lives in the vault for next time
    const vault = await agent.get('/api/vault');
    expect(
      vault.body.data.items.find((i: { kind: string }) => i.kind === 'eps')?.value,
    ).toBe('SURA');
  });

  it('store one-click: an empty decision shares the defaults', async () => {
    const user = await makeUser(false);
    const agent = request.agent(app);
    const { consentUid, redirectUri } = await startConsent(
      agent,
      'store',
      'openid username',
      user.email,
    );

    const { claims } = await completeConsent(agent, 'store', 'store-dev-secret', consentUid, redirectUri);
    expect(claims.username).toBe('marap');
    expect(Object.keys(claims).sort()).toEqual(['sub', 'username']);
  });

  it('prompt=login forces the sign-in screen so a different account can be used', async () => {
    const user = await makeUser(false);
    const redirectUri = REDIRECT_URI.forum;
    const agent = request.agent(app);

    // sign in and consent once — this sets Persona's session on the agent
    const { consentUid } = await startConsent(agent, 'forum', 'openid name', user.email);
    let res = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send({});
    await agent.get(toPath(res.body.redirectTo));

    const authorize = (extra: Record<string, string> = {}) =>
      agent.get('/oidc/auth').query({
        client_id: 'forum',
        response_type: 'code',
        scope: 'openid name',
        redirect_uri: redirectUri,
        state: 'xyz',
        ...extra,
      });

    // without prompt=login: already signed in and consented, so Persona returns
    // a code silently (single sign-on) — no sign-in screen
    res = await authorize();
    expect(res.status).toBe(303);
    expect(res.headers.location).toContain('code=');

    // with prompt=login: the sign-in screen is shown again, so the user can
    // switch to a different Persona account
    res = await authorize({ prompt: 'login' });
    expect(res.headers.location).toContain('/interaction/');
    const page = await agent.get(toPath(res.headers.location));
    expect(page.status).toBe(200);
    expect(page.text).toContain('Sign in');
  });

  it('revoking a connection cuts the app off', async () => {
    const user = await makeUser(true);
    const agent = request.agent(app);
    const { consentUid, redirectUri } = await startConsent(
      agent,
      'clinic',
      'openid name email eps',
      user.email,
    );
    const { accessToken } = await completeConsent(
      agent,
      'clinic',
      'clinic-dev-secret',
      consentUid,
      redirectUri,
    );

    const before = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);
    expect(before.status).toBe(200);

    const revoke = await agent.delete('/api/connections/clinic');
    expect(revoke.status).toBe(204);

    const after = await agent.get('/oidc/me').set('Authorization', `Bearer ${accessToken}`);
    expect(after.status).toBe(401);
  });

  // Everything the provider issues now lives in Postgres. These assert on the
  // table directly: a "build a second provider" test would pass even with the
  // in-memory adapter, whose storage is module-level.
  describe('persistence', () => {
    it('writes sessions, grants, codes and tokens to oidc_payload', async () => {
      const user = await makeUser(false);
      const agent = request.agent(app);
      const { consentUid, redirectUri } = await startConsent(
        agent,
        'forum',
        'openid name',
        user.email,
      );
      await completeConsent(agent, 'forum', 'forum-dev-secret', consentUid, redirectUri);

      const models = await prisma.oidcPayload.groupBy({ by: ['model'], _count: { _all: true } });
      const byModel = new Map(models.map((row) => [row.model, row._count._all]));

      expect(byModel.get('Session') ?? 0).toBeGreaterThan(0);
      // Clients are owned by the console and read from `client` instead.
      expect(byModel.get('Client')).toBeUndefined();

      // Scoped to this flow's grant. The table is never truncated between runs, so
      // an unqualified findFirst picks up whatever an earlier test left behind.
      const consent = await prisma.consent.findFirst({
        where: { clientId: 'forum', user: { email: user.email } },
      });
      const grantId = consent?.grantId as string;
      expect(grantId).toBeTruthy();

      const mine = await prisma.oidcPayload.groupBy({
        by: ['model'],
        where: { grantId },
        _count: { _all: true },
      });
      const byModelForGrant = new Map(mine.map((row) => [row.model, row._count._all]));
      for (const model of ['AuthorizationCode', 'AccessToken']) {
        expect(byModelForGrant.get(model) ?? 0).toBeGreaterThan(0);
      }
      // A Grant row is keyed by its own id, not by `grantId`.
      expect(await prisma.oidcPayload.count({ where: { model: 'Grant', id: grantId } })).toBe(1);

      const code = await prisma.oidcPayload.findFirst({
        where: { model: 'AuthorizationCode', grantId },
      });
      expect(typeof (code?.payload as { consumed?: unknown }).consumed).toBe('number');
    });

    it('drops the token rows when a connection is revoked', async () => {
      const user = await makeUser(false);
      const agent = request.agent(app);
      const { consentUid, redirectUri } = await startConsent(
        agent,
        'forum',
        'openid name',
        user.email,
      );
      await completeConsent(agent, 'forum', 'forum-dev-secret', consentUid, redirectUri);

      const consent = await prisma.consent.findFirst({
        where: { clientId: 'forum', user: { email: user.email } },
      });
      const grantId = consent?.grantId as string;
      expect(grantId).toBeTruthy();
      expect(await prisma.oidcPayload.count({ where: { grantId } })).toBeGreaterThan(0);

      expect((await agent.delete('/api/connections/forum')).status).toBe(204);

      expect(await prisma.oidcPayload.count({ where: { grantId } })).toBe(0);
      expect(await prisma.oidcPayload.count({ where: { model: 'Grant', id: grantId } })).toBe(0);
    });

    // Re-consenting replaces the grant. Before grants were persisted the
    // superseded one evaporated on restart; now it has to be revoked.
    it('invalidates the previous token when the user consents again', async () => {
      const user = await makeUser(false);
      const agent = request.agent(app);

      const first = await startConsent(agent, 'forum', 'openid name', user.email);
      const { accessToken: firstToken } = await completeConsent(
        agent,
        'forum',
        'forum-dev-secret',
        first.consentUid,
        first.redirectUri,
      );
      expect((await agent.get('/oidc/me').auth(firstToken, { type: 'bearer' })).status).toBe(200);

      // The session already exists, so this goes straight to consent.
      const reauth = await agent.get('/oidc/auth').query({
        client_id: 'forum',
        response_type: 'code',
        scope: 'openid name',
        redirect_uri: first.redirectUri,
        state: 'xyz',
        prompt: 'consent',
      });
      const { accessToken: secondToken } = await completeConsent(
        agent,
        'forum',
        'forum-dev-secret',
        uidFrom(reauth.headers.location),
        first.redirectUri,
      );

      expect((await agent.get('/oidc/me').auth(firstToken, { type: 'bearer' })).status).toBe(401);
      expect((await agent.get('/oidc/me').auth(secondToken, { type: 'bearer' })).status).toBe(200);
    });
  });
});
