import type Provider from 'oidc-provider' with { 'resolution-mode': 'import' };
import { config } from '../config/config';

// oidc-provider is ESM-only, so it is loaded with a dynamic import from this
// CommonJS project. Returns a configured provider ready to mount in Express.
export async function createOidcProvider(): Promise<Provider> {
  const { default: OidcProvider } = await import('oidc-provider');

  const provider = new OidcProvider(config.oidcIssuer, {
    // The relying parties that may use "Connect with Persona".
    clients: [
      {
        client_id: 'clinic',
        client_secret: 'clinic-dev-secret',
        redirect_uris: ['http://localhost:4410/callback/clinic'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'openid name email phone address',
      },
      {
        client_id: 'forum',
        client_secret: 'forum-dev-secret',
        redirect_uris: ['http://localhost:4410/callback/forum'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        scope: 'openid name',
      },
    ],
    // Persona's custom scopes and the claims they release.
    scopes: ['name', 'email', 'phone', 'address'],
    claims: {
      name: ['name'],
      email: ['email'],
      phone: ['phone'],
      address: ['address'],
    },
    cookies: { keys: [config.authSecret] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return provider;
}
