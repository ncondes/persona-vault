import { OidcPayloadRepository } from '../src/domain/interfaces/oidc-payload.repository';
import { prisma } from '../src/infrastructure/db/prisma';
import { PrismaOidcPayloadRepository } from '../src/repositories/oidc-payload.repository';
import { FakePayloads } from './support/fakes';

// Everything oidc-provider issues lands in one table. `oidc-flow.int.test.ts`
// proves the rows appear during a real flow; this covers the parts the flow never
// reaches — expiry, the sweeper, and the device-code lookup.
describe('oidc payload repository (integration)', () => {
  const repo = new PrismaOidcPayloadRepository(prisma);
  const stamp = Date.now();
  const ids: string[] = [];

  const past = new Date(Date.now() - 60_000);
  const future = new Date(Date.now() + 60_000);

  function id(suffix: string): string {
    const value = `payload-int-${stamp}-${suffix}`;
    ids.push(value);
    return value;
  }

  afterAll(async () => {
    await prisma.oidcPayload.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('round-trips a payload and overwrites it on a second upsert', async () => {
    const rowId = id('round-trip');
    await repo.upsert({
      model: 'AccessToken',
      id: rowId,
      payload: { scope: 'openid name', accountId: 'user-1' },
      grantId: null,
      userCode: null,
      uid: null,
      expiresAt: future,
    });

    expect(await repo.find('AccessToken', rowId)).toEqual({
      scope: 'openid name',
      accountId: 'user-1',
    });

    await repo.upsert({
      model: 'AccessToken',
      id: rowId,
      payload: { scope: 'openid' },
      grantId: null,
      userCode: null,
      uid: null,
      expiresAt: future,
    });

    expect(await repo.find('AccessToken', rowId)).toEqual({ scope: 'openid' });
    expect(await prisma.oidcPayload.count({ where: { id: rowId } })).toBe(1);
  });

  // The same id can exist under two models; a lookup must not cross over.
  it('keys rows by model as well as id', async () => {
    const shared = id('shared');
    for (const model of ['Session', 'Interaction']) {
      await repo.upsert({
        model,
        id: shared,
        payload: { which: model },
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: null,
      });
    }

    expect(await repo.find('Session', shared)).toEqual({ which: 'Session' });
    expect(await repo.find('Interaction', shared)).toEqual({ which: 'Interaction' });

    await repo.destroy('Session', shared);
    expect(await repo.find('Session', shared)).toBeNull();
    expect(await repo.find('Interaction', shared)).toEqual({ which: 'Interaction' });
  });

  describe('expiry', () => {
    it('hides a row whose expiry has passed, without deleting it', async () => {
      const rowId = id('expired');
      await repo.upsert({
        model: 'AccessToken',
        id: rowId,
        payload: { scope: 'openid' },
        grantId: null,
        userCode: null,
        uid: `uid-${rowId}`,
        expiresAt: past,
      });

      expect(await repo.find('AccessToken', rowId)).toBeNull();
      expect(await repo.findByUid(`uid-${rowId}`)).toBeNull();
      // Still on disk — it is the sweeper's job to remove it, not the reader's.
      expect(await prisma.oidcPayload.count({ where: { id: rowId } })).toBe(1);
    });

    it('keeps a row with no expiry at all', async () => {
      const rowId = id('eternal');
      await repo.upsert({
        model: 'Grant',
        id: rowId,
        payload: { ok: true },
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: null,
      });

      expect(await repo.find('Grant', rowId)).toEqual({ ok: true });
    });

    // The expiry cutoff has to be read at query time. Every other expiry test
    // here creates a row that was already stale, which a cutoff frozen at import
    // still rejects correctly — so none of them can catch a stale cutoff. This
    // one expires a row *during* the test, which is the only way to tell the
    // two apart.
    it('stops finding a row the moment it expires, not just one that was already stale', async () => {
      const rowId = id('expires-mid-test');
      await repo.upsert({
        model: 'AccessToken',
        id: rowId,
        payload: { scope: 'openid' },
        grantId: null,
        userCode: null,
        uid: null,
        expiresAt: new Date(Date.now() + 300),
      });

      expect(await repo.find('AccessToken', rowId)).toEqual({ scope: 'openid' });

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(await repo.find('AccessToken', rowId)).toBeNull();
    });

    // Called only from the 15-minute sweep in src/index.ts, so nothing else
    // exercises it.
    it('deleteExpired removes past rows and leaves live ones', async () => {
      const dead = id('sweep-dead');
      const alive = id('sweep-alive');
      const eternal = id('sweep-eternal');

      for (const [rowId, expiresAt] of [
        [dead, past],
        [alive, future],
        [eternal, null],
      ] as const) {
        await repo.upsert({
          model: 'AuthorizationCode',
          id: rowId,
          payload: {},
          grantId: null,
          userCode: null,
          uid: null,
          expiresAt,
        });
      }

      const removed = await repo.deleteExpired();

      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await prisma.oidcPayload.count({ where: { id: dead } })).toBe(0);
      expect(await prisma.oidcPayload.count({ where: { id: alive } })).toBe(1);
      expect(await prisma.oidcPayload.count({ where: { id: eternal } })).toBe(1);
    });
  });

  describe('secondary lookups', () => {
    it('finds a row by uid', async () => {
      const rowId = id('by-uid');
      await repo.upsert({
        model: 'Session',
        id: rowId,
        payload: { accountId: 'user-1' },
        grantId: null,
        userCode: null,
        uid: `uid-${rowId}`,
        expiresAt: future,
      });

      expect(await repo.findByUid(`uid-${rowId}`)).toEqual({ accountId: 'user-1' });
      expect(await repo.findByUid('no-such-uid')).toBeNull();
    });

    // The device flow is off, so nothing else ever writes a user code — but the
    // adapter contract requires the lookup to work.
    it('finds a row by user code', async () => {
      const rowId = id('by-code');
      await repo.upsert({
        model: 'DeviceCode',
        id: rowId,
        payload: { deviceCode: true },
        grantId: null,
        userCode: `CODE-${stamp}`,
        uid: null,
        expiresAt: future,
      });

      expect(await repo.findByUserCode(`CODE-${stamp}`)).toEqual({ deviceCode: true });
      expect(await repo.findByUserCode('NOPE')).toBeNull();
    });
  });

  describe('deleteByGrantId', () => {
    it('clears the credentials but spares the in-flight interaction', async () => {
      const grantId = `grant-${stamp}`;
      const token = id('grant-token');
      const code = id('grant-code');
      const interaction = id('grant-interaction');

      for (const [model, rowId] of [
        ['AccessToken', token],
        ['AuthorizationCode', code],
        ['Interaction', interaction],
      ] as const) {
        await repo.upsert({
          model,
          id: rowId,
          payload: {},
          grantId,
          userCode: null,
          uid: null,
          expiresAt: future,
        });
      }

      await repo.deleteByGrantId(grantId);

      expect(await repo.find('AccessToken', token)).toBeNull();
      expect(await repo.find('AuthorizationCode', code)).toBeNull();
      // Deleting this would destroy the very request doing the revoking.
      expect(await repo.find('Interaction', interaction)).toEqual({});
    });
  });

  it('destroys a row that is already gone without complaining', async () => {
    await expect(repo.destroy('AccessToken', 'never-existed')).resolves.toBeUndefined();
    await expect(repo.deleteByGrantId('never-existed')).resolves.toBeUndefined();
  });

  it('setPayload on a missing row is a no-op rather than an insert', async () => {
    await repo.setPayload('AccessToken', 'never-existed', { consumed: 1 });
    expect(await repo.find('AccessToken', 'never-existed')).toBeNull();
  });

  // The unit tests for the OIDC adapter run against an in-memory fake. If the fake
  // and the real repository disagree, those tests are proving nothing — so run the
  // same script of operations through both and compare every answer.
  describe('the in-memory fake behaves like the real repository', () => {
    async function script(store: OidcPayloadRepository, prefix: string) {
      const seen: unknown[] = [];
      const row = (suffix: string) => {
        const value = `${prefix}-${suffix}`;
        ids.push(value);
        return value;
      };

      const live = row('live');
      const dead = row('dead');
      const held = row('held');

      await store.upsert({
        model: 'AccessToken',
        id: live,
        payload: { scope: 'openid' },
        grantId: 'g1',
        userCode: 'UC-1',
        uid: 'U-1',
        expiresAt: future,
      });
      await store.upsert({
        model: 'AccessToken',
        id: dead,
        payload: { scope: 'openid email' },
        grantId: 'g1',
        userCode: null,
        uid: 'U-2',
        expiresAt: past,
      });
      await store.upsert({
        model: 'Interaction',
        id: held,
        payload: { step: 'consent' },
        grantId: 'g1',
        userCode: null,
        uid: null,
        expiresAt: future,
      });

      seen.push(await store.find('AccessToken', live));
      seen.push(await store.find('AccessToken', dead));
      seen.push(await store.find('AccessToken', 'absent'));
      seen.push(await store.findByUid('U-1'));
      seen.push(await store.findByUid('U-2'));
      seen.push(await store.findByUserCode('UC-1'));
      seen.push(await store.findByUserCode('UC-missing'));

      await store.setPayload('AccessToken', live, { scope: 'openid', consumed: 1 });
      seen.push(await store.find('AccessToken', live));
      await store.setPayload('AccessToken', 'absent', { scope: 'nope' });
      seen.push(await store.find('AccessToken', 'absent'));

      await store.deleteByGrantId('g1');
      seen.push(await store.find('AccessToken', live));
      seen.push(await store.find('Interaction', held));

      await store.destroy('Interaction', held);
      await store.destroy('Interaction', held);
      seen.push(await store.find('Interaction', held));

      return seen;
    }

    it('gives the same answers to the same operations', async () => {
      const real = await script(new PrismaOidcPayloadRepository(prisma), `contract-real-${stamp}`);
      const fake = await script(new FakePayloads(), `contract-fake-${stamp}`);

      expect(fake).toEqual(real);
    });
  });
});
