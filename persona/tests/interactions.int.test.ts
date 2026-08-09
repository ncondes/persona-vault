import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Container } from '../src/container';
import { testContainer } from './support/app';
import { TEST_CODE, forceCode, interactionLogin, loginVerified } from './support/otp';
import { DEMO_CLIENTS } from '../src/constants/clients';
import { hashPassword } from '../src/infrastructure/auth/password';
import { prisma } from '../src/infrastructure/db/prisma';
import { createOidcProvider } from '../src/oidc/provider';
import { buildApp } from '../src/server';

// The half of `src/oidc/interactions.ts` a successful connection never touches:
// declining, signing in wrong, and arriving with a request that has expired or
// is out of order. These are the paths a real user hits by accident.
describe('OIDC interactions — the unhappy paths', () => {
  let app: ReturnType<typeof buildApp>;
  let container: Container;
  const password = 'password123';
  const redirectUri = DEMO_CLIENTS.find((c) => c.id === 'forum')!.redirectUris[0];
  let counter = 0;

  const asJson = { Accept: 'application/json' };
  const uidFrom = (location: string) => location.split('/interaction/')[1];

  beforeAll(async () => {
    container = testContainer();
    app = buildApp(container, await createOidcProvider(container));
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'interaction-int-' } } });
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const email = `interaction-int-${Date.now()}-${counter++}@example.com`;
    await container.unitOfWork.run(async (repos) => {
      const user = await repos.users.create({ email, passwordHash: await hashPassword(password) });
      await repos.vault.create({
        userId: user.id,
        kind: 'name',
        value: 'Mara P.',
        detail: { firstName: 'Mara', lastName: 'P.' },
        nameContext: 'public',
        isDefault: true,
      });
    });
    return email;
  }

  // Starts an authorization and returns the login interaction id.
  async function startAuth(agent: TestAgent, query: Record<string, string> = {}) {
    const res = await agent.get('/oidc/auth').query({
      client_id: 'forum',
      response_type: 'code',
      scope: 'openid name',
      redirect_uri: redirectUri,
      state: 'xyz',
      ...query,
    });
    return uidFrom(res.headers.location);
  }

  describe('signing in', () => {
    it('rejects a wrong password with 401 and keeps the interaction alive', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const bad = await agent
        .post(`/interaction/${uid}/login`)
        .set(asJson)
        .send({ email, password: 'not-the-password' });

      expect(bad.status).toBe(401);
      expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

      // The same uid still works, so the person can simply try again.
      const good = await interactionLogin(agent, uid, email, password);
      expect(good.status).toBe(200);
      expect(good.body.redirectTo).toBeTruthy();
    });

    // The consent screen is a sign-in like any other, so it gets the same code
    // step. Without this it would be a way around the whole thing.
    it('asks for a code rather than signing in on the password alone', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const res = await agent
        .post(`/interaction/${uid}/login`)
        .set(asJson)
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.challengeId).toBeTruthy();
      expect(res.body.email).toBe(email);
      // Not signed in yet: no session cookie, and no way past the login prompt.
      expect(res.body.redirectTo).toBeUndefined();
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a wrong code and leaves the interaction alone', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const started = await agent
        .post(`/interaction/${uid}/login`)
        .set(asJson)
        .send({ email, password });
      const bad = await agent
        .post(`/interaction/${uid}/verify`)
        .set(asJson)
        .send({ challengeId: started.body.challengeId, code: '999999' });

      expect(bad.status).toBe(401);
      expect(bad.body.error.code).toBe('OTP_INVALID');

      // The right code still finishes it.
      const good = await interactionLogin(agent, uid, email, password);
      expect(good.status).toBe(200);
      expect(good.body.redirectTo).toBeTruthy();
    });

    it('rejects an unknown email the same way, without saying which part was wrong', async () => {
      const agent = request.agent(app);
      const uid = await startAuth(agent);

      const res = await agent
        .post(`/interaction/${uid}/login`)
        .set(asJson)
        .send({ email: 'nobody@example.com', password });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    // WEB_URL is empty in the integration environment, so this is the HTML
    // fallback the provider serves on its own.
    it('re-renders the sign-in page with an error for a form post', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const res = await agent
        .post(`/interaction/${uid}/login`)
        .type('form')
        .send({ email, password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.text).toContain('Invalid email or password');
      expect(res.text).toContain(`/interaction/${uid}/login`);
    });

    // A wrong code keeps the form up so the person can try again; a spent one
    // has nothing left to try against, so it goes back to the password step.
    it('re-renders the code form for a form post, and gives up once it is spent', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      await agent.post(`/interaction/${uid}/login`).type('form').send({ email, password });
      const challenge = await prisma.otpChallenge.findFirst({ where: { email } });

      const wrong = await agent
        .post(`/interaction/${uid}/verify`)
        .type('form')
        .send({ challengeId: challenge!.id, code: '999999', email });
      expect(wrong.status).toBe(401);
      expect(wrong.text).toContain('Check your email');
      expect(wrong.text).toContain('That code is not right');

      const gone = await agent
        .post(`/interaction/${uid}/verify`)
        .type('form')
        .send({ challengeId: 'no-such-challenge', code: '999999', email });
      expect(gone.status).toBe(401);
      expect(gone.text).toContain('Sign in');
      expect(gone.text).toContain(`/interaction/${uid}/login`);
    });
  });

  describe('declining', () => {
    it('sends access_denied back to the app', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const login = await interactionLogin(agent, uid, email, password);
      const consent = await agent.get(new URL(login.body.redirectTo).pathname);
      const consentUid = uidFrom(consent.headers.location);

      const abort = await agent.post(`/interaction/${consentUid}/abort`).set(asJson).send({});
      expect(abort.status).toBe(200);

      const back = await agent.get(new URL(abort.body.redirectTo).pathname + new URL(abort.body.redirectTo).search);
      const target = new URL(back.headers.location);
      expect(target.searchParams.get('error')).toBe('access_denied');
      expect(target.origin + target.pathname).toBe(redirectUri);

      // Declining must not leave a standing consent behind.
      const user = await prisma.user.findUnique({ where: { email } });
      expect(
        await prisma.consent.count({ where: { userId: user!.id, clientId: 'forum' } }),
      ).toBe(0);
    });
  });

  describe('expired or out-of-order requests', () => {
    it('answers an unknown interaction id with 410 for the JSON client', async () => {
      const res = await request(app).get('/interaction/not-a-real-uid').set(asJson);

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('INTERACTION_EXPIRED');
    });

    it('renders the expired page for a browser instead', async () => {
      const res = await request(app).get('/interaction/not-a-real-uid');

      expect(res.status).toBe(400);
      expect(res.text).toContain('Request expired');
    });

    it.each([['decision'], ['abort']])(
      'answers a POST to /%s on a dead interaction with 410',
      async (step) => {
        const res = await request(app)
          .post(`/interaction/not-a-real-uid/${step}`)
          .set(asJson)
          .send({});

        expect(res.status).toBe(410);
        expect(res.body.error.code).toBe('INTERACTION_EXPIRED');
      },
    );

    // /login checks the interaction before the password, so a dead uid is caught
    // before anyone is sent a code they could never use.
    it('answers a POST to /login on a dead interaction with 410', async () => {
      const email = await makeUser();

      const res = await request(app)
        .post('/interaction/not-a-real-uid/login')
        .set(asJson)
        .send({ email, password });

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('INTERACTION_EXPIRED');
      expect(await prisma.otpChallenge.count({ where: { email } })).toBe(0);
    });

    // A decision posted while the interaction is still at the login step has no
    // session to read an account from. Before the guard this was a 500.
    it('rejects a decision that arrives before sign-in', async () => {
      const agent = request.agent(app);
      const uid = await startAuth(agent);

      const res = await agent.post(`/interaction/${uid}/decision`).set(asJson).send({});

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('INTERACTION_EXPIRED');
    });
  });

  // WEB_URL is blank here, so a browser gets Persona's own pages and posts real
  // forms. This is the path a person hits if the Next app is not running.
  describe('the HTML fallback', () => {
    it('renders the consent page and completes a form-driven decision', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      // The password step now renders the code form instead of finishing.
      const login = await agent
        .post(`/interaction/${uid}/login`)
        .type('form')
        .send({ email, password });
      expect(login.status).toBe(200);
      expect(login.text).toContain('Check your email');
      expect(login.text).toContain(`/interaction/${uid}/verify`);

      const challenge = await prisma.otpChallenge.findFirst({ where: { email } });
      await forceCode(challenge!.id);
      const verified = await agent
        .post(`/interaction/${uid}/verify`)
        .type('form')
        .send({ challengeId: challenge!.id, code: TEST_CODE, email });
      expect(verified.status).toBe(303);

      const resume = await agent.get(new URL(verified.headers.location).pathname);
      const consentUid = uidFrom(resume.headers.location);

      const consent = await agent.get(`/interaction/${consentUid}`);
      expect(consent.status).toBe(200);
      expect(consent.text).toContain('Share your details?');
      expect(consent.text).toContain('<li>Full name</li>');
      expect(consent.text).toContain(`/interaction/${consentUid}/decision`);

      // Posting the form with no body shares the context-suggested defaults.
      const decision = await agent.post(`/interaction/${consentUid}/decision`).type('form').send({});
      expect(decision.status).toBe(303);

      const back = await agent.get(new URL(decision.headers.location).pathname + new URL(decision.headers.location).search);
      expect(new URL(back.headers.location).searchParams.get('code')).toBeTruthy();

      const user = await prisma.user.findUnique({ where: { email } });
      const consentRow = await prisma.consent.findFirst({
        where: { userId: user!.id, clientId: 'forum' },
      });
      expect(consentRow?.scopes).toContain('name');
    });
  });

  // The grant lives in the OIDC store and cannot join a Prisma transaction, so
  // `interactions.ts` revokes it by hand if the consent and audit rows fail to
  // commit. Without that, a database blip would leave an app holding a working
  // grant that Persona has no record of — invisible and unrevokable.
  describe('when the database fails mid-decision', () => {
    it('rolls the grant back rather than leaving it orphaned', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      const uid = await startAuth(agent);

      const login = await interactionLogin(agent, uid, email, password);
      const resume = await agent.get(new URL(login.body.redirectTo).pathname);
      const consentUid = uidFrom(resume.headers.location);

      const before = await prisma.oidcPayload.count({ where: { model: 'Grant' } });
      const spy = jest
        .spyOn(container.unitOfWork, 'run')
        .mockRejectedValueOnce(new Error('database went away'));

      const decision = await agent.post(`/interaction/${consentUid}/decision`).set(asJson).send({});
      expect(decision.status).toBe(500);

      spy.mockRestore();

      // No consent was written, and the grant it had already created is gone.
      const user = await prisma.user.findUnique({ where: { email } });
      expect(await prisma.consent.count({ where: { userId: user!.id } })).toBe(0);
      expect(await prisma.oidcPayload.count({ where: { model: 'Grant' } })).toBe(before);
    });
  });

  describe('signing in silently', () => {
    // An existing Persona session should not make the person type their password
    // again — the login prompt resolves without a screen.
    it('skips the login screen when the browser already has a session', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      expect((await loginVerified(agent, email, password)).status).toBe(200);

      const uid = await startAuth(agent);
      const res = await agent.get(`/interaction/${uid}`).set(asJson);

      expect(res.status).toBe(200);
      expect(res.body.redirectTo).toBeTruthy();
      expect(res.body.prompt).toBeUndefined();
    });

    it('shows the login screen anyway when the app asks with prompt=login', async () => {
      const agent = request.agent(app);
      const email = await makeUser();
      await loginVerified(agent, email, password);

      const uid = await startAuth(agent, { prompt: 'login' });
      const res = await agent.get(`/interaction/${uid}`).set(asJson);

      expect(res.status).toBe(200);
      expect(res.body.prompt).toBe('login');
      expect(res.body.client).toMatchObject({ id: 'forum', name: expect.any(String) });
    });
  });
});
