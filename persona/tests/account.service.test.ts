import { AppError } from '../src/domain/errors';
import { AccountServiceImpl } from '../src/services/account.service';
import { client, errorFrom, fakeRepositories, vaultItem } from './support/fakes';

// The transparency and portability surface: what a person can see about an app,
// what they get when they export, and what happens when they revoke or delete.
// `settings.int.test.ts` covers these over HTTP; these cover the branches that
// need a half-broken state to reach.

function build(items = [vaultItem('email', 'camila@example.com', { userId: 'user-1' })]) {
  const fakes = fakeRepositories(items);
  return { ...fakes, service: new AccountServiceImpl(fakes.repositories) };
}

async function withConnection(ctx: ReturnType<typeof build>, grantId: string | null = 'grant-1') {
  await ctx.clients.upsert(client({ id: 'clinic', name: 'City Health Clinic' }));
  await ctx.consents.record({
    userId: 'user-1',
    clientId: 'clinic',
    scopes: ['name', 'document'],
    grantId: grantId as string,
    selections: [
      { scope: 'name', itemIds: ['i1'], snapshot: [{ label: null, value: 'Camila', detail: null }] },
      {
        scope: 'document',
        itemIds: ['i2'],
        snapshot: [{ label: null, value: '1020304050', detail: null }],
      },
    ],
  });
}

describe('account service', () => {
  describe('connections', () => {
    it('flags which of the shared fields are sensitive', async () => {
      const ctx = build();
      await withConnection(ctx);

      const [connection] = await ctx.service.connections('user-1');

      expect(connection.clientName).toBe('City Health Clinic');
      expect(connection.shared.find((f) => f.scope === 'document')?.sensitive).toBe(true);
      expect(connection.shared.find((f) => f.scope === 'name')?.sensitive).toBe(false);
    });

    // An app can be deleted while a person still holds the record of it. The
    // connection must still render rather than crash on the missing row.
    it('falls back to the client id when the app row is gone', async () => {
      const ctx = build();
      await withConnection(ctx);
      await ctx.clients.delete('clinic');

      const [connection] = await ctx.service.connections('user-1');

      expect(connection.clientName).toBe('clinic');
      expect(connection.purpose).toBe('');
    });
  });

  describe('auditHistory', () => {
    it('names the app behind each entry', async () => {
      const ctx = build();
      await ctx.clients.upsert(client({ id: 'clinic', name: 'City Health Clinic' }));
      await ctx.audit.record({
        userId: 'user-1',
        clientId: 'clinic',
        type: 'release',
        context: 'healthcare',
        scopesReleased: ['name'],
        fieldsReleased: ['name'],
      });

      const [entry] = await ctx.service.auditHistory('user-1');
      expect(entry.clientName).toBe('City Health Clinic');
    });

    it('falls back to the id for an app that no longer exists', async () => {
      const ctx = build();
      await ctx.audit.record({
        userId: 'user-1',
        clientId: 'ghost',
        type: 'revoke',
        context: '',
        scopesReleased: [],
        fieldsReleased: [],
      });

      const [entry] = await ctx.service.auditHistory('user-1');
      expect(entry.clientName).toBe('ghost');
    });
  });

  describe('revokeConnection', () => {
    it('returns the grant id and writes a revoke entry', async () => {
      const ctx = build();
      await withConnection(ctx);

      const grantId = await ctx.service.revokeConnection('user-1', 'clinic');

      expect(grantId).toBe('grant-1');
      expect(await ctx.consents.findByUserAndClient('user-1', 'clinic')).toBeNull();
      expect(ctx.audit.rows).toEqual([
        expect.objectContaining({ type: 'revoke', clientId: 'clinic', scopesReleased: ['name', 'document'] }),
      ]);
    });

    // Revoking twice, or revoking something never connected, is a no-op — not an
    // error and not a spurious audit entry.
    it('returns null and audits nothing when there is no connection', async () => {
      const ctx = build();

      expect(await ctx.service.revokeConnection('user-1', 'clinic')).toBeNull();
      expect(ctx.audit.rows).toEqual([]);
    });

    it('returns null for a consent that never had a grant', async () => {
      const ctx = build();
      await withConnection(ctx, null);

      expect(await ctx.service.revokeConnection('user-1', 'clinic')).toBeNull();
      // The consent is still cleared and the revocation still audited.
      expect(await ctx.consents.findByUserAndClient('user-1', 'clinic')).toBeNull();
      expect(ctx.audit.rows).toHaveLength(1);
    });
  });

  describe('settings', () => {
    it('rejects a user that does not exist', async () => {
      const err = await errorFrom<AppError>(build().service.settings('ghost'));
      expect(err.code).toBe('USER_NOT_FOUND');
      expect(err.statusCode).toBe(404);
    });

    it('reads and updates the two privacy flags', async () => {
      const ctx = build();
      const user = await ctx.users.create({ email: 'a@example.com', passwordHash: 'x' });

      expect(await ctx.service.settings(user.id)).toEqual({
        confirmSensitive: true,
        notifyAccess: false,
      });
      expect(await ctx.service.updateSettings(user.id, { notifyAccess: true })).toEqual({
        confirmSensitive: true,
        notifyAccess: true,
      });
    });
  });

  describe('exportData', () => {
    it('rejects a user that does not exist', async () => {
      const err = await errorFrom<AppError>(build().service.exportData('ghost'));
      expect(err.code).toBe('USER_NOT_FOUND');
    });

    it('bundles the vault, connections and audit, marking sensitive items', async () => {
      const ctx = build([
        vaultItem('email', 'camila@example.com', { userId: 'user-1' }),
        vaultItem('document', '1020304050', { userId: 'user-1' }),
      ]);
      const user = await ctx.users.create({ email: 'camila@example.com', passwordHash: 'x' });
      ctx.vault.rows.forEach((row) => (row.userId = user.id));
      await ctx.clients.upsert(client({ id: 'clinic' }));
      await ctx.consents.record({
        userId: user.id,
        clientId: 'clinic',
        scopes: ['email'],
        grantId: 'grant-1',
        selections: [],
      });

      const dump = await ctx.service.exportData(user.id);

      expect(dump.user.email).toBe('camila@example.com');
      expect(dump.vault).toHaveLength(2);
      expect(dump.vault).toContainEqual(expect.objectContaining({ kind: 'document', sensitive: true }));
      expect(dump.vault).toContainEqual(expect.objectContaining({ kind: 'email', sensitive: false }));
      expect(dump.connections).toHaveLength(1);
    });
  });

  describe('deleteAccount', () => {
    // The route revokes these grants after the row is gone; if the list came back
    // short, an app would keep a working token for a deleted person.
    it('returns every live grant id before removing the user', async () => {
      const ctx = build();
      await withConnection(ctx);
      await ctx.consents.record({
        userId: 'user-1',
        clientId: 'forum',
        scopes: ['name'],
        grantId: 'grant-2',
        selections: [],
      });
      const user = await ctx.users.create({ email: 'a@example.com', passwordHash: 'x' });
      ctx.consents.rows.forEach((row) => (row.userId = user.id));

      const grantIds = await ctx.service.deleteAccount(user.id);

      expect(grantIds.sort()).toEqual(['grant-1', 'grant-2']);
      expect(await ctx.users.findById(user.id)).toBeNull();
    });

    it('skips consents that never got a grant', async () => {
      const ctx = build();
      await withConnection(ctx, null);

      expect(await ctx.service.deleteAccount('user-1')).toEqual([]);
    });
  });
});
