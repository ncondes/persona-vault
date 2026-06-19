import type Provider from 'oidc-provider' with { 'resolution-mode': 'import' };
import { config } from '../config/config';
import type { Container } from '../container';
import { loadDevJwks } from './keys';

// Relying parties that may use "Connect with Persona". Their client_id matches
// the Client row in the database (which carries the purpose + allowed scopes).
const CLIENTS = [
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
];

export async function createOidcProvider(container: Container): Promise<Provider> {
  const { default: OidcProvider } = await import('oidc-provider');

  const provider = new OidcProvider(config.oidcIssuer, {
    clients: CLIENTS,
    jwks: loadDevJwks(),
    scopes: ['name', 'email', 'phone', 'address'],
    claims: {
      name: ['name'],
      email: ['email'],
      phone: ['phone'],
      address: ['address'],
    },
    cookies: { keys: [config.authSecret] },
    features: {
      devInteractions: { enabled: false },
    },
    interactions: {
      url(_ctx: unknown, interaction: { uid: string }): string {
        return `/interaction/${interaction.uid}`;
      },
    },
    // Releases claims through Persona's context engine: the client's purpose and
    // the granted scopes decide which fields and which name variant are returned.
    async findAccount(ctx: { oidc?: { client?: { clientId?: string } } }, sub: string) {
      const clientId = ctx?.oidc?.client?.clientId;
      return {
        accountId: sub,
        async claims(use: string, scope: string): Promise<Record<string, unknown>> {
          if (!clientId) return { sub };
          const granted = scope.split(' ').filter(Boolean);
          const resolved = await container.contextService.resolveForClient(
            sub,
            clientId,
            granted,
            granted,
          );
          if (use === 'userinfo' && resolved.scopesReleased.length > 0) {
            await container.repositories.audit.recordRelease({
              userId: sub,
              clientId,
              context: resolved.context,
              scopesReleased: resolved.scopesReleased,
              fieldsReleased: Object.keys(resolved.claims),
            });
          }
          return { sub, ...resolved.claims };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return provider;
}
