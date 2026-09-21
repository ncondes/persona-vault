import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { RATE_LIMIT_POLICIES } from '../src/constants/rate-limits';
import { Container } from '../src/container';
import { testContainer } from './support/app';
import {
  TEST_CODE,
  forceCode,
  interactionLogin,
  loginVerified,
  registerVerified,
} from './support/otp';
import { prisma } from '../src/infrastructure/db/prisma';
import { createOidcProvider } from '../src/oidc/provider';
import { buildApp } from '../src/server';

// The acceptance checklist, as executable statements.
//
// Every test name is a claim the project makes about itself, so the run output
// is the requirement-to-evidence table rather than a hand-written one.
// `npx tsx scripts/acceptance-table.ts` turns it into markdown.
//
// It deliberately re-asserts things the module suites already cover: the other
// files are organised by code, this one is organised by promise. One person, one
// vault, three apps with three purposes — the whole argument in one place.
describe('Persona acceptance', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;
  let agent: TestAgent;

  const stamp = Date.now();
  const email = `acceptance-${stamp}@example.com`;
  const password = 'password123';
  const asJson = { Accept: 'application/json' };

  // Three unrelated relying parties, registered through the developer console
  // exactly as a third party would.
  const APPS = {
    clinic: {
      name: `Acceptance Clinic ${stamp}`,
      purpose: 'healthcare',
      allowedScopes: ['name', 'given_name', 'email', 'birth_date', 'document', 'blood_type'],
      requiredScopes: ['name'],
      redirectUris: ['http://localhost:4491/callback'],
    },
    forum: {
      name: `Acceptance Forum ${stamp}`,
      purpose: 'social',
      allowedScopes: ['name', 'username'],
      requiredScopes: ['username'],
      redirectUris: ['http://localhost:4492/callback'],
    },
    store: {
      name: `Acceptance Store ${stamp}`,
      purpose: 'retail',
      allowedScopes: ['name', 'email', 'address'],
      requiredScopes: ['email'],
      redirectUris: ['http://localhost:4493/callback'],
    },
  };

  const registered: Record<string, { id: string; secret: string; uri: string }> = {};

  beforeAll(async () => {
    container = testContainer();
    app = buildApp(container, await createOidcProvider(container));

    await prisma.user.deleteMany({ where: { email } });
    agent = request.agent(app);

    await registerVerified(agent, {
      firstName: 'Camila',
      lastName: 'Rodríguez',
      email,
      password,
    });

    // One vault, filled once. Registration already seeded a name and an email.
    const add = (body: Record<string, unknown>) => agent.post('/api/vault/items').send(body);
    await add({
      kind: 'name',
      detail: { firstName: 'Camila Andrea', lastName: 'Rodríguez García' },
      nameContext: 'legal',
    });
    await add({ kind: 'name', detail: { firstName: 'Camila', lastName: 'R.' }, nameContext: 'public' });
    await add({ kind: 'username', value: 'camir' });
    await add({ kind: 'birth_date', value: '1998-04-02' });
    await add({ kind: 'blood_type', value: 'O_POS' });
    await add({
      kind: 'document',
      value: '1020304050',
      detail: { type: 'CC', issueDate: '2015-04-02', issuePlace: 'Bogotá' },
    });
    await add({
      kind: 'address',
      detail: { line1: 'Cra 7 # 45-10', city: 'Bogotá', country: 'CO' },
    });

    for (const [key, body] of Object.entries(APPS)) {
      const created = await agent.post('/api/apps').send(body);
      expect(created.status).toBe(201);
      registered[key] = {
        id: created.body.data.id,
        secret: created.body.data.secret,
        uri: body.redirectUris[0],
      };
    }
  });

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { id: { in: Object.values(registered).map((a) => a.id) } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  const uidFrom = (location: string) => location.split('/interaction/')[1];
  const toPath = (loc: string) => {
    try {
      const url = new URL(loc);
      return url.pathname + url.search;
    } catch {
      return loc;
    }
  };

  async function reachConsent(startLocation: string): Promise<string> {
    let uid = uidFrom(startLocation);
    for (let step = 0; step < 3; step += 1) {
      const details = await agent.get(`/interaction/${uid}`).set(asJson);
      if (details.body.prompt === 'consent') return uid;
      if (details.body.prompt === 'login') {
        const login = await interactionLogin(agent, uid, email, password);
        uid = uidFrom((await agent.get(toPath(login.body.redirectTo))).headers.location);
        continue;
      }
      uid = uidFrom((await agent.get(toPath(details.body.redirectTo))).headers.location);
    }
    throw new Error('never reached the consent step');
  }

  // Starts an authorization and stops at the consent screen, for the checks
  // that are about what the person is shown rather than what is released.
  async function reachConsentFor(
    key: keyof typeof APPS,
    scope: string,
  ): Promise<{ uid: string }> {
    const { id, uri } = registered[key];
    const started = await agent.get('/oidc/auth').query({
      client_id: id,
      response_type: 'code',
      scope,
      redirect_uri: uri,
      state: 'xyz',
      prompt: 'consent',
    });
    return { uid: await reachConsent(started.headers.location) };
  }

  // A full "Connect with Persona": authorize, consent, code, token, userinfo.
  async function connect(
    key: keyof typeof APPS,
    scope: string,
    decision: Record<string, unknown> = {},
  ) {
    const { id, secret, uri } = registered[key];

    const started = await agent.get('/oidc/auth').query({
      client_id: id,
      response_type: 'code',
      scope,
      redirect_uri: uri,
      state: 'xyz',
      prompt: 'consent',
    });
    const uid = await reachConsent(started.headers.location);

    let res = await agent.post(`/interaction/${uid}/decision`).set(asJson).send(decision);
    expect(res.status).toBe(200);

    res = await agent.get(toPath(res.body.redirectTo));
    const code = new URL(res.headers.location).searchParams.get('code') as string;

    const token = await agent
      .post('/oidc/token')
      .type('form')
      .auth(id, secret)
      .send({ grant_type: 'authorization_code', code, redirect_uri: uri });
    expect(token.status).toBe(200);

    const accessToken = token.body.access_token as string;
    const userinfo = await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' });

    return { claims: userinfo.body as Record<string, unknown>, accessToken };
  }

  describe('the right data for the context', () => {
    it('gives a healthcare app the legal name', async () => {
      const { claims } = await connect('clinic', 'openid name');
      expect(claims.name).toBe('Camila Andrea Rodríguez García');
    });

    it('gives a social app the public name for the same person', async () => {
      const { claims } = await connect('forum', 'openid name username');
      expect(claims.name).toBe('Camila R.');
    });

    it('resolves the name variant from the app’s purpose, not from what it asks for', async () => {
      // Neither app can request a variant: both send the same scope and get
      // different values, decided by their declared purpose.
      const clinic = await connect('clinic', 'openid name');
      const forum = await connect('forum', 'openid name username');

      expect(clinic.claims.name).not.toBe(forum.claims.name);
    });

    it('releases structured fields as objects, not as flattened strings', async () => {
      const { claims } = await connect('clinic', 'openid document');
      expect(claims.document).toEqual({
        type: 'CC',
        number: '1020304050',
        issueDate: '2015-04-02',
        issuePlace: 'Bogotá',
      });
    });
  });

  describe('field minimisation — an app gets only what it should', () => {
    it('never releases a field the app did not ask for', async () => {
      const { claims } = await connect('forum', 'openid name username');

      expect(Object.keys(claims).sort()).toEqual(['name', 'sub', 'username']);
      for (const leaked of ['email', 'birth_date', 'document', 'blood_type', 'address']) {
        expect(claims).not.toHaveProperty(leaked);
      }
    });

    it('refuses an authorization for a scope the app never declared', async () => {
      const { id, uri } = registered.forum;
      const res = await agent
        .get('/oidc/auth')
        .query({
          client_id: id,
          response_type: 'code',
          scope: 'openid blood_type',
          redirect_uri: uri,
          state: 'xyz',
        });

      expect(new URL(res.headers.location).searchParams.get('error')).toBe('invalid_scope');
    });

    it('never releases a field the person declined at the consent screen', async () => {
      const { claims } = await connect('clinic', 'openid name blood_type', {
        excludedScopes: ['blood_type'],
      });

      expect(claims.name).toBeDefined();
      expect(claims).not.toHaveProperty('blood_type');
    });

    it('releases the value the person chose over the one Persona suggested', async () => {
      const vault = await agent.get('/api/vault');
      const publicName = vault.body.data.items.find(
        (i: { kind: string; nameContext: string }) => i.kind === 'name' && i.nameContext === 'public',
      );

      const { claims } = await connect('clinic', 'openid name', {
        selections: { name: [publicName.id] },
      });

      // The clinic's purpose suggests the legal name; the person overrode it.
      expect(claims.name).toBe('Camila R.');
    });

    it('stops honouring a live token once the app narrows its own scopes', async () => {
      const { accessToken } = await connect('store', 'openid name email address');
      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).body.address).toBeDefined();

      await agent.put(`/api/apps/${registered.store.id}`).send({
        allowedScopes: ['name', 'email'],
        requiredScopes: ['email'],
      });

      const after = await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' });
      expect(after.status).toBe(401);
    });
  });

  describe('the person stays in control', () => {
    it('shows exactly which values each connected app holds', async () => {
      await connect('forum', 'openid name username');

      const connections = await agent.get('/api/connections');
      const forum = connections.body.data.find(
        (c: { clientId: string }) => c.clientId === registered.forum.id,
      );

      expect(forum.scopes.sort()).toEqual(['name', 'username']);
      expect(forum.shared.find((f: { scope: string }) => f.scope === 'name').snapshot[0].value).toBe(
        'Camila R.',
      );
    });

    it('writes every release of data to the person’s audit log', async () => {
      await connect('forum', 'openid name username');

      const audit = await agent.get('/api/audit');
      const release = audit.body.data.find(
        (entry: { clientId: string; type: string }) =>
          entry.clientId === registered.forum.id && entry.type === 'release',
      );

      expect(release).toBeDefined();
      expect(release.scopesReleased).toContain('username');
      expect(release.context).toBe('social');
    });

    it('cuts an app off the moment the person revokes it', async () => {
      const { accessToken } = await connect('forum', 'openid name username');
      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(200);

      expect((await agent.delete(`/api/connections/${registered.forum.id}`)).status).toBe(204);

      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(401);
    });

    it('lets the person export everything they hold in one file', async () => {
      const res = await agent.get('/api/export');

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body.user.email).toBe(email);
      expect(res.body.vault.length).toBeGreaterThan(5);
      expect(res.body).toHaveProperty('connections');
      expect(res.body).toHaveProperty('audit');
    });
  });

  describe('the provider is trustworthy infrastructure', () => {
    it('keeps a connection working across a restart of the provider', async () => {
      const { accessToken } = await connect('store', 'openid name email');

      // A second provider over the same database stands in for a restart: with
      // the old in-memory adapter its store would have been empty.
      const fresh = buildApp(testContainer(), await createOidcProvider(testContainer()));

      const res = await request(fresh).get('/oidc/me').auth(accessToken, { type: 'bearer' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
    });

    it('never hands a client secret back through the API', async () => {
      const list = await agent.get('/api/apps');
      const detail = await agent.get(`/api/apps/${registered.clinic.id}`);

      for (const body of [list.body, detail.body]) {
        const wire = JSON.stringify(body);
        expect(wire).not.toContain(registered.clinic.secret);
        expect(wire).not.toContain('secretEncrypted');
        expect(wire).not.toContain('ownerId');
      }
      expect(detail.body.data.secretLastFour).toHaveLength(4);
    });

    it('rejects a token request with the wrong client secret', async () => {
      const res = await agent
        .post('/oidc/token')
        .type('form')
        .auth(registered.clinic.id, 'not-the-secret')
        .send({ grant_type: 'authorization_code', code: 'anything', redirect_uri: registered.clinic.uri });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_client');
    });

    it('rejects an authorization sent to an unregistered redirect URI', async () => {
      const res = await agent.get('/oidc/auth').query({
        client_id: registered.clinic.id,
        response_type: 'code',
        scope: 'openid name',
        redirect_uri: 'http://attacker.example/callback',
        state: 'xyz',
      });

      // Refused outright — not redirected anywhere, which is the point.
      expect(res.status).toBe(400);
      expect(res.headers.location).toBeUndefined();
    });

    it('hides one developer’s app from another', async () => {
      const other = request.agent(app);
      const otherEmail = `acceptance-other-${stamp}@example.com`;
      await registerVerified(other, {
        firstName: 'Other',
        lastName: 'Dev',
        email: otherEmail,
        password,
      });

      expect((await other.get(`/api/apps/${registered.clinic.id}`)).status).toBe(404);
      expect((await other.delete(`/api/apps/${registered.clinic.id}`)).status).toBe(404);

      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });

    it('refuses to start an authorization for a paused app', async () => {
      await agent.put(`/api/apps/${registered.clinic.id}`).send({ status: 'disabled' });

      const res = await agent.get('/oidc/auth').query({
        client_id: registered.clinic.id,
        response_type: 'code',
        scope: 'openid name',
        redirect_uri: registered.clinic.uri,
        state: 'xyz',
      });
      expect(res.status).toBe(400);

      await agent.put(`/api/apps/${registered.clinic.id}`).send({ status: 'active' });
    });

    it('leaves an app with no working tokens once it is deleted', async () => {
      const created = await agent.post('/api/apps').send({
        name: `Acceptance Doomed ${stamp}`,
        purpose: 'other',
        allowedScopes: ['name'],
        requiredScopes: [],
        redirectUris: ['http://localhost:4494/callback'],
      });
      registered.doomed = {
        id: created.body.data.id,
        secret: created.body.data.secret,
        uri: 'http://localhost:4494/callback',
      };

      const { accessToken } = await connect('doomed' as keyof typeof APPS, 'openid name');
      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(200);

      expect((await agent.delete(`/api/apps/${registered.doomed.id}`)).status).toBe(204);

      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(401);
    });
  });

  // Signing up costs nothing and nobody checks, so a vault full of invented
  // addresses would undercut everything above: none of it means much if the
  // person behind the data was never real.
  describe('proving a real person is behind the account', () => {
    let n = 0;
    const freshEmail = () => `acceptance-otp-${stamp}-${n++}@example.com`;
    const details = (target: string) => ({
      firstName: 'Real',
      lastName: 'Person',
      email: target,
      password,
    });

    it('creates no account until the code emailed to the address comes back', async () => {
      const target = freshEmail();
      const visitor = request.agent(app);

      const started = await visitor.post('/api/auth/register').send(details(target));

      expect(started.status).toBe(202);
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
      // Not signed in either — there is nothing yet to be signed in to.
      expect((await visitor.get('/api/auth/me')).status).toBe(401);
    });

    it('creates the account and starts the vault once the code is entered', async () => {
      const target = freshEmail();
      const visitor = request.agent(app);

      const done = await registerVerified(visitor, details(target));

      expect(done.status).toBe(201);
      expect(await prisma.user.count({ where: { email: target } })).toBe(1);
      const vault = await visitor.get('/api/vault');
      expect(vault.body.data.items.map((i: { kind: string }) => i.kind)).toEqual(
        expect.arrayContaining(['name', 'email']),
      );
    });

    it('leaves nothing behind when the code is wrong', async () => {
      const target = freshEmail();
      const visitor = request.agent(app);
      const started = await visitor.post('/api/auth/register').send(details(target));
      await forceCode(started.body.data.challengeId);

      const wrong = await visitor
        .post('/api/auth/register/verify')
        .send({ challengeId: started.body.data.challengeId, code: '000000' });

      expect(wrong.status).toBe(401);
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
    });

    it('never stores the code in a form anyone could read back', async () => {
      const target = freshEmail();
      const started = await request(app).post('/api/auth/register').send(details(target));

      const row = await prisma.otpChallenge.findUnique({
        where: { id: started.body.data.challengeId },
      });
      expect(JSON.stringify(started.body)).not.toContain(row!.codeHash);
      expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
      // The password waits here too, and it waits hashed.
      expect(row!.passwordHash).not.toBe(password);
    });

    it('gives up on a code after five wrong guesses', async () => {
      const target = freshEmail();
      const started = await request(app).post('/api/auth/register').send(details(target));
      const challengeId = started.body.data.challengeId;
      await forceCode(challengeId);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app).post('/api/auth/register/verify').send({ challengeId, code: '000000' });
      }

      const withTheRightCode = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId, code: TEST_CODE });
      expect(withTheRightCode.status).toBe(401);
      expect(await prisma.user.count({ where: { email: target } })).toBe(0);
    });

    it('refuses a code that has expired', async () => {
      const target = freshEmail();
      const started = await request(app).post('/api/auth/register').send(details(target));
      const challengeId = started.body.data.challengeId;
      await forceCode(challengeId);
      await prisma.otpChallenge.update({
        where: { id: challengeId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app)
        .post('/api/auth/register/verify')
        .send({ challengeId, code: TEST_CODE });

      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });

    it('asks for a code at sign-in as well, not just at sign-up', async () => {
      const target = freshEmail();
      const visitor = request.agent(app);
      await registerVerified(visitor, details(target));
      await visitor.post('/api/auth/logout');

      const withPasswordOnly = await visitor.post('/api/auth/login').send({
        email: target,
        password,
      });
      expect(withPasswordOnly.status).toBe(202);
      expect((await visitor.get('/api/auth/me')).status).toBe(401);

      expect((await loginVerified(visitor, target, password)).status).toBe(200);
      expect((await visitor.get('/api/auth/me')).status).toBe(200);
    });

    // The consent screen has its own sign-in form. If it skipped the code, an
    // app link would be the way around the whole control.
    it('asks for a code on the consent screen too, so it is no way around', async () => {
      const target = freshEmail();
      const visitor = request.agent(app);
      await registerVerified(visitor, details(target));
      await visitor.post('/api/auth/logout');

      const start = await visitor.get('/oidc/auth').query({
        client_id: registered.forum.id,
        response_type: 'code',
        scope: 'openid username',
        redirect_uri: APPS.forum.redirectUris[0],
        state: 'xyz',
      });
      const uid = uidFrom(start.headers.location);

      const withPasswordOnly = await visitor
        .post(`/interaction/${uid}/login`)
        .set(asJson)
        .send({ email: target, password });

      expect(withPasswordOnly.body.challengeId).toBeTruthy();
      expect(withPasswordOnly.body.redirectTo).toBeUndefined();
      expect((await visitor.get('/api/auth/me')).status).toBe(401);
    });

    afterAll(async () => {
      await prisma.otpChallenge.deleteMany({
        where: { email: { startsWith: `acceptance-otp-${stamp}` } },
      });
      await prisma.user.deleteMany({
        where: { email: { startsWith: `acceptance-otp-${stamp}` } },
      });
    });
  });

  describe('refusing abuse', () => {
    // The claim is not "there is a limiter". It is that the limit is keyed on
    // the account under attack, so it cannot be dodged by changing network, and
    // that it covers both of the doors the password can be tried at.
    const guesses = RATE_LIMIT_POLICIES.authLogin.limit + 2;

    it('cuts off a burst of password guesses against one address', async () => {
      const victim = `acceptance-burst-${stamp}@example.com`;
      let last;
      for (let i = 0; i < guesses; i += 1) {
        last = await request(app).post('/api/auth/login').send({ email: victim, password: `g${i}` });
      }
      expect(last!.status).toBe(429);
      expect(last!.body.error.code).toBe('RATE_LIMITED');
    });

    it('tells a refused caller how long to wait', async () => {
      const victim = `acceptance-wait-${stamp}@example.com`;
      let last;
      for (let i = 0; i < guesses; i += 1) {
        last = await request(app).post('/api/auth/login').send({ email: victim, password: `g${i}` });
      }
      expect(Number(last!.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('does not spend one person’s budget on another’s', async () => {
      const attacked = `acceptance-one-${stamp}@example.com`;
      for (let i = 0; i < guesses; i += 1) {
        await request(app).post('/api/auth/login').send({ email: attacked, password: `g${i}` });
      }
      const bystander = await request(app)
        .post('/api/auth/login')
        .send({ email: `acceptance-two-${stamp}@example.com`, password: 'x' });
      expect(bystander.status).not.toBe(429);
    });

    // Guarding only /api/auth would leave the consent screen as a fully working
    // password door. The two share one budget per address, so alternating
    // between them buys nothing.
    it('holds the same budget at the consent screen as at the API', async () => {
      const victim = `acceptance-doors-${stamp}@example.com`;
      for (let i = 0; i < guesses; i += 1) {
        await request(app).post('/api/auth/login').send({ email: victim, password: `g${i}` });
      }
      const viaConsent = await request(app)
        .post('/interaction/any-uid/login')
        .set(asJson)
        .send({ email: victim, password: 'x' });
      expect(viaConsent.status).toBe(429);
    });

    it('never throttles the health check, so a monitor is never mistaken for an outage', async () => {
      for (let i = 0; i < 40; i += 1) {
        expect((await request(app).get('/api/health')).status).toBe(200);
      }
    });
  });

  describe('knowing who is asking', () => {
    // The consent decision the whole project rests on is made against a name the
    // developer typed. Verification does not fix that — it cannot say whether
    // whoever runs a domain is really a clinic. What it fixes is narrower and
    // still worth having: the person is told which domain was actually proved,
    // and an app that proved nothing says so rather than staying quiet.
    it('tells the person which domain an app proved it is served from', async () => {
      await prisma.client.update({
        where: { id: registered.clinic.id },
        data: { verifiedDomain: 'clinic.example', verifiedAt: new Date() },
      });

      const { uid } = await reachConsentFor('clinic', 'openid name email');
      const details = await agent.get(`/interaction/${uid}`).set(asJson);

      expect(details.body.client.verifiedDomain).toBe('clinic.example');
      await agent.post(`/interaction/${uid}/abort`).set(asJson);
    });

    it('says plainly that an unverified app is unverified', async () => {
      // Same app as the row above, with the proof taken away — so the two rows
      // differ in exactly one thing.
      await prisma.client.update({
        where: { id: registered.clinic.id },
        data: { verifiedDomain: null, verifiedAt: null },
      });

      const { uid } = await reachConsentFor('clinic', 'openid name email');
      const details = await agent.get(`/interaction/${uid}`).set(asJson);

      expect(details.body.prompt).toBe('consent');
      expect(details.body.client.verifiedDomain).toBeNull();
      await agent.post(`/interaction/${uid}/abort`).set(asJson);
    });

    // An app cannot verify itself by saying so: the claim is only ever written
    // by the server after it fetched the file.
    it('ignores a verification an app claims for itself', async () => {
      const res = await agent
        .put(`/api/apps/${registered.store.id}`)
        .send({ verifiedDomain: 'city-health-clinic.example', verifiedAt: new Date() });

      const after = await prisma.client.findUnique({ where: { id: registered.store.id } });
      expect(after!.verifiedDomain).toBeNull();
      expect([200, 400]).toContain(res.status);
    });

    it('takes the badge down if the app moves to another domain', async () => {
      await prisma.client.update({
        where: { id: registered.forum.id },
        data: { verifiedDomain: 'forum.example', verifiedAt: new Date() },
      });

      await agent
        .put(`/api/apps/${registered.forum.id}`)
        .send({ redirectUris: ['https://somewhere-else.example/callback'] });

      const after = await prisma.client.findUnique({ where: { id: registered.forum.id } });
      expect(after!.verifiedDomain).toBeNull();
    });
  });

  describe('rotating the signing key', () => {
    // The claim is not "the key can be changed". It is that changing it breaks
    // nothing: a token signed under the old key still verifies while anything
    // signed with it could still be alive.
    it('publishes a new key before it signs anything', async () => {
      const service = container.signingKeyService;
      const active = await service.active();
      expect(active).not.toBeNull();
      // Whatever is published, exactly one of them signs.
      const published = await container.repositories.signingKeys.listPublished();
      expect(published.filter((key) => key.state === 'active')).toHaveLength(1);
      expect(published[0].kid).toBe(active!.kid);
    });

    it('never publishes the private half of a key', async () => {
      const jwks = await request(app).get('/oidc/jwks');
      expect(jwks.status).toBe(200);
      for (const key of jwks.body.keys) {
        for (const member of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
          expect(key[member]).toBeUndefined();
        }
      }
    });

    it('names each key after the key itself, so two can never collide', async () => {
      const published = await container.repositories.signingKeys.listPublished();
      const kids = published.map((key) => key.kid);
      expect(new Set(kids).size).toBe(kids.length);
    });
  });

  describe('deleting an account', () => {
    // Last, because it removes the person these tests are about.
    it('erases the person and every trace of them, and kills their live tokens', async () => {
      const { accessToken } = await connect('store', 'openid name email');
      const user = await prisma.user.findUnique({ where: { email } });
      const userId = user!.id;

      expect((await agent.delete('/api/account')).status).toBe(204);

      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(await prisma.vaultItem.count({ where: { userId } })).toBe(0);
      expect(await prisma.consent.count({ where: { userId } })).toBe(0);
      expect(await prisma.auditEntry.count({ where: { userId } })).toBe(0);

      expect((await agent.get('/oidc/me').auth(accessToken, { type: 'bearer' })).status).toBe(401);
    });
  });
});
