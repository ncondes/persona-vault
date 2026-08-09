import type Provider from 'oidc-provider' with { 'resolution-mode': 'import' };
import { config } from '../config/config';
import { ALL_SCOPES } from '../constants/scopes';
import type { Container } from '../container';
import { createOidcAdapter } from './adapter';
import { loadDevJwks } from './keys';

// Each data scope releases a claim of the same name.
const CLAIMS = Object.fromEntries(ALL_SCOPES.map((scope) => [scope, [scope]]));

export async function createOidcProvider(container: Container): Promise<Provider> {
  const { default: OidcProvider } = await import('oidc-provider');

  // No static `clients`: relying parties are registered through the developer
  // console and resolved from Postgres by the adapter.
  const provider = new OidcProvider(config.oidcIssuer, {
    adapter: createOidcAdapter(container.repositories),
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
