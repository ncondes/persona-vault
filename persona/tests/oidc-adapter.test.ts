import { ClientRepository } from '../src/domain/interfaces/client.repository';
import { Repositories } from '../src/domain/interfaces/unit-of-work';
import { Client } from '../src/domain/models';
import { encryptSecret } from '../src/infrastructure/crypto/secret-box';
import { createOidcAdapter } from '../src/oidc/adapter';
import { FakePayloads } from './support/fakes';

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'clinic',
    ownerId: 'dev-1',
    name: 'City Health Clinic',
    description: null,
    purpose: 'healthcare',
    accent: 'blue',
    allowedScopes: ['name', 'email'],
    requiredScopes: ['name'],
    redirectUris: ['http://localhost:4411/callback'],
    secretEncrypted: encryptSecret('clinic-dev-secret'),
    secretLastFour: 'cret',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeClients implements Pick<ClientRepository, 'findById'> {
  constructor(private readonly rows: Client[]) {}
  async findById(id: string): Promise<Client | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}

function build(clients: Client[] = [client()]) {
  const payloads = new FakePayloads();
  const repositories = {
    clients: new FakeClients(clients),
    oidcPayloads: payloads,
  } as unknown as Repositories;
  return { payloads, adapter: createOidcAdapter(repositories) };
}

describe('OIDC Prisma adapter', () => {
  // oidc-provider calls the adapter with `new` when it looks constructable and
  // as a plain factory otherwise. Arrow functions have no prototype.
  it('returns a factory that is not constructable', () => {
    const { adapter } = build();
    expect((adapter as unknown as { prototype?: unknown }).prototype).toBeUndefined();
  });

  it('round-trips a payload', async () => {
    const { adapter } = build();
    const sessions = adapter('Session');
    await sessions.upsert('s1', { uid: 'u1', accountId: 'user-1' }, 60);
    expect(await sessions.find('s1')).toEqual({ uid: 'u1', accountId: 'user-1' });
    expect(await sessions.find('missing')).toBeUndefined();
  });

  it('finds by uid and user code', async () => {
    const { adapter } = build();
    await adapter('Session').upsert('s1', { uid: 'u1' }, 60);
    await adapter('DeviceCode').upsert('d1', { userCode: 'ABCD' }, 60);
    expect(await adapter('Session').findByUid('u1')).toEqual({ uid: 'u1' });
    expect(await adapter('DeviceCode').findByUserCode('ABCD')).toEqual({ userCode: 'ABCD' });
  });

  it('marks a consumed artifact with an epoch-second timestamp', async () => {
    const { adapter } = build();
    const codes = adapter('AuthorizationCode');
    await codes.upsert('c1', { grantId: 'g1' }, 60);
    await codes.consume('c1');
    const payload = (await codes.find('c1')) as { consumed: number };
    expect(Number.isInteger(payload.consumed)).toBe(true);
    expect(payload.consumed).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('destroys only the addressed model and id', async () => {
    const { adapter } = build();
    await adapter('Session').upsert('shared', { a: 1 }, 60);
    await adapter('Grant').upsert('shared', { b: 2 }, 60);
    await adapter('Session').destroy('shared');
    expect(await adapter('Session').find('shared')).toBeUndefined();
    expect(await adapter('Grant').find('shared')).toEqual({ b: 2 });
  });

  it('revokes every credential carrying a grant id, and nothing else', async () => {
    const { adapter } = build();
    await adapter('AccessToken').upsert('at1', { grantId: 'g1' }, 60);
    await adapter('AuthorizationCode').upsert('ac1', { grantId: 'g1' }, 60);
    await adapter('AccessToken').upsert('at2', { grantId: 'g2' }, 60);
    await adapter('Session').upsert('s1', { uid: 'u1' }, 60);

    await adapter('AccessToken').revokeByGrantId('g1');

    expect(await adapter('AccessToken').find('at1')).toBeUndefined();
    expect(await adapter('AuthorizationCode').find('ac1')).toBeUndefined();
    expect(await adapter('AccessToken').find('at2')).toEqual({ grantId: 'g2' });
    expect(await adapter('Session').find('s1')).toEqual({ uid: 'u1' });
  });

  // A re-consent revokes the previous grant from inside the interaction that
  // resumed it, so destroying interactions by grant id would kill the request
  // doing the revoking.
  it('spares the in-flight interaction when revoking its grant', async () => {
    const { adapter } = build();
    await adapter('Interaction').upsert('i1', { grantId: 'g1' }, 60);
    await adapter('AccessToken').upsert('at1', { grantId: 'g1' }, 60);

    await adapter('AccessToken').revokeByGrantId('g1');

    expect(await adapter('AccessToken').find('at1')).toBeUndefined();
    expect(await adapter('Interaction').find('i1')).toEqual({ grantId: 'g1' });
  });

  it('destroying an artifact that is already gone is not an error', async () => {
    const { adapter } = build();
    await expect(adapter('Grant').destroy('never-existed')).resolves.toBeUndefined();
    await expect(adapter('AccessToken').revokeByGrantId('never-existed')).resolves.toBeUndefined();
  });

  describe('clients', () => {
    it('reads client metadata from the client table with a decrypted secret', async () => {
      const { adapter, payloads } = build();
      const found = await adapter('Client').find('clinic');

      expect(found).toMatchObject({
        client_id: 'clinic',
        client_secret: 'clinic-dev-secret',
        redirect_uris: ['http://localhost:4411/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_basic',
        scope: 'openid name email',
      });
      // Clients live in `client`, never in the payload table.
      expect(payloads.rows).toHaveLength(0);
    });

    it('hides disabled and unknown clients', async () => {
      const { adapter } = build([client({ status: 'disabled' })]);
      expect(await adapter('Client').find('clinic')).toBeUndefined();
      expect(await adapter('Client').find('nope')).toBeUndefined();
    });

    // oidc-provider caches clients under a hash of this JSON, so an unstable
    // key order would defeat the cache on every request.
    it('serialises client metadata identically across calls', async () => {
      const { adapter } = build();
      const a = JSON.stringify(await adapter('Client').find('clinic'));
      const b = JSON.stringify(await adapter('Client').find('clinic'));
      expect(a).toBe(b);
    });

    it('stores a client upsert without an expiry', async () => {
      const { adapter, payloads } = build();
      await adapter('Session').upsert('s1', { uid: 'u1' });
      expect(payloads.rows[0].expiresAt).toBeNull();
    });

    // Rotating AUTH_SECRET makes every stored secret undecryptable. The app has
    // to read as unknown rather than take the whole provider down — and it must
    // not fall through to a client with no secret, which would authenticate
    // anyone.
    it('reports a client whose secret will not decrypt as unknown', async () => {
      const { adapter } = build([client({ secretEncrypted: 'not-valid-ciphertext' })]);

      await expect(adapter('Client').find('clinic')).resolves.toBeUndefined();
    });

    it('survives ciphertext that decrypts but fails its auth tag', async () => {
      const real = encryptSecret('clinic-dev-secret');
      const tampered = Buffer.from(real, 'base64');
      tampered[tampered.length - 1] ^= 0xff;

      const { adapter } = build([client({ secretEncrypted: tampered.toString('base64') })]);

      await expect(adapter('Client').find('clinic')).resolves.toBeUndefined();
    });
  });
});
