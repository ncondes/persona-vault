import request from 'supertest';
import type { Express } from 'express';
// Pure and config-free, so importing it at the top does not defeat the point.
import { hashOtp } from '../src/infrastructure/auth/otp';

// `tests/int.setup.js` blanks WEB_URL so the rest of the suite exercises the
// built-in HTML pages. That leaves the branches Docker actually runs — where
// Persona hands the browser to the Next app — with no coverage at all.
//
// `config.ts` parses the environment once at import, so this file rebuilds the
// module graph with WEB_URL set. Everything is required inside `isolateModules`
// for that reason; a top-level import would capture the blank config first.
const WEB_URL = 'http://localhost:4420';
const CODE = '123456';

describe('OIDC interactions — with a web frontend configured', () => {
  let app: Express;
  let prisma: typeof import('../src/infrastructure/db/prisma').prisma;
  let redirectUri: string;
  let email: string;
  const password = 'password123';

  beforeAll(async () => {
    const previous = process.env.WEB_URL;
    process.env.WEB_URL = WEB_URL;

    await jest.isolateModulesAsync(async () => {
      const { config } = require('../src/config/config');
      expect(config.webUrl).toBe(WEB_URL);

      const { buildContainer } = require('../src/container');
      const { buildApp } = require('../src/server');
      const { createOidcProvider } = require('../src/oidc/provider');
      const { hashPassword } = require('../src/infrastructure/auth/password');
      const { DEMO_CLIENTS } = require('../src/constants/clients');
      ({ prisma } = require('../src/infrastructure/db/prisma'));

      redirectUri = DEMO_CLIENTS.find((c: { id: string }) => c.id === 'forum').redirectUris[0];

      // Nothing here should reach Resend; a bare object satisfies Mailer.
      const container = buildContainer({ mailer: { send: async () => {} } });
      app = buildApp(container, await createOidcProvider(container));

      email = `interaction-web-${Date.now()}@example.com`;
      await container.unitOfWork.run(async (repos: never) => {
        const r = repos as unknown as import('../src/domain/interfaces/unit-of-work').Repositories;
        const user = await r.users.create({ email, passwordHash: await hashPassword(password) });
        await r.vault.create({
          userId: user.id,
          kind: 'name',
          value: 'Mara P.',
          detail: { firstName: 'Mara', lastName: 'P.' },
          nameContext: 'public',
          isDefault: true,
        });
      });
    });

    process.env.WEB_URL = previous;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'interaction-web-' } } });
    await prisma.$disconnect();
  });

  const uidFrom = (location: string) => location.split('/interaction/')[1];

  async function startAuth(agent: ReturnType<typeof request.agent>) {
    const res = await agent.get('/oidc/auth').query({
      client_id: 'forum',
      response_type: 'code',
      scope: 'openid name',
      redirect_uri: redirectUri,
      state: 'xyz',
    });
    return uidFrom(res.headers.location);
  }

  it('sends a browser at the login step to the Next app', async () => {
    const agent = request.agent(app);
    const uid = await startAuth(agent);

    const res = await agent.get(`/interaction/${uid}`);

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`${WEB_URL}/authorize/${uid}`);
    expect(res.text).not.toContain('<form');
  });

  it('sends a browser at the consent step to the same place', async () => {
    const agent = request.agent(app);
    const uid = await startAuth(agent);

    // Spelled out rather than using tests/support/otp.ts, whose prisma comes
    // from the outer module registry rather than the isolated one built above.
    const asJson = { Accept: 'application/json' };
    const started = await agent
      .post(`/interaction/${uid}/login`)
      .set(asJson)
      .send({ email, password });
    await prisma.otpChallenge.update({
      where: { id: started.body.challengeId },
      data: { codeHash: hashOtp(CODE) },
    });
    const login = await agent
      .post(`/interaction/${uid}/verify`)
      .set(asJson)
      .send({ challengeId: started.body.challengeId, code: CODE });

    const resume = await agent.get(new URL(login.body.redirectTo).pathname);
    const consentUid = uidFrom(resume.headers.location);

    const res = await agent.get(`/interaction/${consentUid}`);

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`${WEB_URL}/authorize/${consentUid}`);
  });

  // An expired request must not dead-end on Persona's own error page when the
  // real UI lives somewhere else.
  it('sends a browser with a dead interaction to the Next app, not the fallback page', async () => {
    const res = await request(app).get('/interaction/not-a-real-uid');

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`${WEB_URL}/authorize/not-a-real-uid`);
    expect(res.text).not.toContain('Request expired');
  });

  // The JSON client is the Next app itself, which handles its own routing.
  it('still answers the JSON client with 410 rather than a redirect', async () => {
    const res = await request(app)
      .get('/interaction/not-a-real-uid')
      .set({ Accept: 'application/json' });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('INTERACTION_EXPIRED');
  });
});
