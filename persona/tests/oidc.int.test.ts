import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { prisma } from '../src/infrastructure/db/prisma';

describe('OIDC provider (integration)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const container = buildContainer();
    const provider = await createOidcProvider(container);
    app = buildApp(container, provider);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serves the OpenID discovery document', async () => {
    const res = await request(app).get('/oidc/.well-known/openid-configuration');

    expect(res.status).toBe(200);
    expect(res.body.issuer).toBe('http://localhost:4400/oidc');
    expect(res.body.scopes_supported).toContain('name');
    expect(res.body.authorization_endpoint).toContain('/oidc/auth');
  });

  it('redirects an authorization request into the Persona interaction (login/consent)', async () => {
    const res = await request(app).get('/oidc/auth').query({
      client_id: 'clinic',
      response_type: 'code',
      redirect_uri: 'http://localhost:4411/callback',
      scope: 'openid name email',
      state: 'xyz',
    });

    expect([302, 303]).toContain(res.status);
    expect(res.headers.location).toMatch(/\/interaction\//);
  });
});
