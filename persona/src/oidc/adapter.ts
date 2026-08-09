import type { OidcPayloadData } from '../domain/interfaces/oidc-payload.repository';
import type { Repositories } from '../domain/interfaces/unit-of-work';
import { Client } from '../domain/models';
import { decryptSecret } from '../infrastructure/crypto/secret-box';
import { logger } from '../infrastructure/logger/logger';

const epochSeconds = (): number => Math.floor(Date.now() / 1000);

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// Key order is deliberate. oidc-provider caches resolved clients under a hash
// of this object's JSON, so editing an app in the console produces a different
// hash and the stale entry is bypassed — there is no cache to invalidate.
function toClientMetadata(client: Client): OidcPayloadData {
  return {
    client_id: client.id,
    client_secret: decryptSecret(client.secretEncrypted),
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_basic',
    scope: ['openid', ...client.allowedScopes].join(' '),
  };
}

// Backs every oidc-provider model with Postgres. Clients are the exception:
// they are owned by the console and read from the `client` table instead.
class PrismaAdapter {
  constructor(
    private readonly model: string,
    private readonly repositories: Repositories,
  ) {}

  async upsert(id: string, payload: OidcPayloadData, expiresIn?: number): Promise<void> {
    await this.repositories.oidcPayloads.upsert({
      model: this.model,
      id,
      payload,
      grantId: asString(payload.grantId),
      userCode: asString(payload.userCode),
      uid: asString(payload.uid),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    });
  }

  async find(id: string): Promise<OidcPayloadData | undefined> {
    if (this.model === 'Client') {
      const client = await this.repositories.clients.findById(id);
      if (!client || client.status !== 'active') return undefined;
      try {
        return toClientMetadata(client);
      } catch {
        // The secret is encrypted with a key derived from AUTH_SECRET, so a
        // changed secret makes every stored client unreadable. Report the app
        // as unknown rather than failing the request opaquely.
        logger.error(
          { clientId: id },
          'could not decrypt the client secret — has AUTH_SECRET changed since this app was registered?',
        );
        return undefined;
      }
    }
    return (await this.repositories.oidcPayloads.find(this.model, id)) ?? undefined;
  }

  async findByUid(uid: string): Promise<OidcPayloadData | undefined> {
    return (await this.repositories.oidcPayloads.findByUid(uid)) ?? undefined;
  }

  async findByUserCode(userCode: string): Promise<OidcPayloadData | undefined> {
    return (await this.repositories.oidcPayloads.findByUserCode(userCode)) ?? undefined;
  }

  // Marks a single-use artifact (an authorization code, mostly) as spent.
  async consume(id: string): Promise<void> {
    const payload = await this.repositories.oidcPayloads.find(this.model, id);
    if (!payload) return;
    await this.repositories.oidcPayloads.setPayload(this.model, id, {
      ...payload,
      consumed: epochSeconds(),
    });
  }

  async destroy(id: string): Promise<void> {
    await this.repositories.oidcPayloads.destroy(this.model, id);
  }

  // Grant rows carry no grantId of their own, so they survive this and are
  // destroyed separately by revokeGrant in ./grants.
  async revokeByGrantId(grantId: string): Promise<void> {
    await this.repositories.oidcPayloads.deleteByGrantId(grantId);
  }
}

// The returned value must stay an arrow function. oidc-provider calls the
// adapter with `new` when it looks constructable and as a plain factory
// otherwise; arrow functions have no prototype, so the factory branch is taken.
export function createOidcAdapter(repositories: Repositories) {
  return (model: string): PrismaAdapter => new PrismaAdapter(model, repositories);
}
