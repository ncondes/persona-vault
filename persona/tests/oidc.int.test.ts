import { RequestHandler } from 'express';
import request from 'supertest';
import { buildContainer } from '../src/container';
import { buildApp } from '../src/server';
import { createOidcProvider } from '../src/oidc/provider';
import { prisma } from '../src/infrastructure/db/prisma';

describe('OIDC provider (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('serves the OpenID discovery document', async () => {
    const provider = await createOidcProvider();
    const app = buildApp(buildContainer(), provider.callback() as unknown as RequestHandler);

    const res = await request(app).get('/oidc/.well-known/openid-configuration');

    expect(res.status).toBe(200);
    expect(res.body.issuer).toBe('http://localhost:4400/oidc');
    expect(res.body.scopes_supported).toContain('name');
    expect(res.body.authorization_endpoint).toContain('/oidc/auth');
  });
});
