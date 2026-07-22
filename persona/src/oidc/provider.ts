import type Provider from 'oidc-provider' with { 'resolution-mode': 'import' };
import { config } from '../config/config';
import { DEMO_CLIENTS } from '../constants/clients';
import { ALL_SCOPES } from '../constants/scopes';
import type { Container } from '../container';
import { loadDevJwks } from './keys';

// Relying parties that may use "Connect with Persona", built from the same list
// the database seed uses. client_id matches the Client row (purpose + scopes).
const CLIENTS = DEMO_CLIENTS.map((client) => ({
  client_id: client.id,
  client_secret: client.devSecret,
  redirect_uris: client.redirectUris,
  grant_types: ['authorization_code'],
  response_types: ['code'],
  scope: ['openid', ...client.allowedScopes].join(' '),
}));

// Each data scope releases a claim of the same name.
const CLAIMS = Object.fromEntries(ALL_SCOPES.map((scope) => [scope, [scope]]));

export async function createOidcProvider(container: Container): Promise<Provider> {
  const { default: OidcProvider } = await import('oidc-provider');

  const provider = new OidcProvider(config.oidcIssuer, {
    clients: CLIENTS,
    jwks: loadDevJwks(),
    scopes: ALL_SCOPES,
    claims: CLAIMS,
    cookies: { keys: [config.authSecret] },
    features: {
      devInteractions: { enabled: false },
    },
    interactions: {
      url(_ctx: unknown, interaction: { uid: string }): string {
        return `/interaction/${interaction.uid}`;
      },
    },
    // Releases claims through Persona's context engine, resolved from the
    // user's vault for the granted scopes.
    async findAccount(ctx: { oidc?: { client?: { clientId?: string } } }, sub: string) {
      const clientId = ctx?.oidc?.client?.clientId;
      return {
        accountId: sub,
        async claims(use: string, scope: string): Promise<Record<string, unknown>> {
          if (!clientId) return { sub };
          const granted = scope.split(' ').filter(Boolean);
          const resolved = await container.contextService.resolveForClient(sub, clientId, granted);
          if (use === 'userinfo' && resolved.scopesReleased.length > 0) {
            await container.repositories.audit.record({
              userId: sub,
              clientId,
              type: 'release',
              context: resolved.context,
              scopesReleased: resolved.scopesReleased,
              fieldsReleased: resolved.scopesReleased,
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
