import { AppError } from '../src/domain/errors';
import { InteractionService } from '../src/services/interaction.service';
import { client, errorFrom, fakeRepositories, vaultItem } from './support/fakes';

// The consent engine. `oidc-flow.int.test.ts` proves the happy paths end to end;
// these cover the rejections, which are cheaper and clearer to provoke here than
// through a real authorization flow.

const USER = 'owner-1';

function build(
  items = [
    vaultItem('name', 'Camila Rodríguez García', { nameContext: 'legal', isDefault: true }),
    vaultItem('name', 'Camila R.', { nameContext: 'public' }),
    vaultItem('email', 'camila@example.com', { isDefault: true }),
    vaultItem('email', 'work@example.com'),
  ],
) {
  const fakes = fakeRepositories(items);
  return { ...fakes, service: new InteractionService(fakes.repositories) };
}

async function withClient(overrides = {}, items?: Parameters<typeof build>[0]) {
  const ctx = build(items);
  await ctx.clients.upsert(
    client({ id: 'app', allowedScopes: ['name', 'email'], requiredScopes: [], ...overrides }),
  );
  return ctx;
}

describe('interaction service', () => {
  describe('consentDetails', () => {
    it('rejects an unknown client', async () => {
      const { service } = build();
      const err = await errorFrom<AppError>(
        service.consentDetails('uid-1', 'nope', ['openid', 'name'], USER),
      );
      expect(err.code).toBe('UNKNOWN_CLIENT');
      expect(err.statusCode).toBe(404);
    });

    it('drops openid and suggests the variant matching the purpose', async () => {
      const { service } = await withClient({ purpose: 'social' });

      const details = await service.consentDetails('uid-1', 'app', ['openid', 'name'], USER);

      expect(details.fields.map((f) => f.scope)).toEqual(['name']);
      const suggested = details.fields[0].options.find(
        (o) => o.id === details.fields[0].suggestedIds[0],
      );
      expect(suggested?.nameContext).toBe('public');
    });

    it('marks a scope required only when the client declared it required', async () => {
      const { service } = await withClient({ requiredScopes: ['email'] });

      const details = await service.consentDetails('uid-1', 'app', ['name', 'email'], USER);

      expect(details.fields.find((f) => f.scope === 'email')?.required).toBe(true);
      expect(details.fields.find((f) => f.scope === 'name')?.required).toBe(false);
    });

    // A missing user row must not quietly turn the sensitive-data confirmation
    // off — the safe default is to keep asking.
    it('defaults confirmSensitive to true when the user row is gone', async () => {
      const { service } = await withClient();
      const details = await service.consentDetails('uid-1', 'app', ['name'], 'ghost');
      expect(details.settings.confirmSensitive).toBe(true);
    });

    it('reads confirmSensitive from the user when they have one', async () => {
      const ctx = await withClient();
      const user = await ctx.users.create({ email: 'u@example.com', passwordHash: 'x' });
      await ctx.users.updateSettings(user.id, { confirmSensitive: false });

      const details = await ctx.service.consentDetails('uid-1', 'app', ['name'], user.id);
      expect(details.settings.confirmSensitive).toBe(false);
    });
  });

  describe('applyDecision', () => {
    it('rejects an unknown client', async () => {
      const { service } = build();
      const err = await errorFrom<AppError>(service.applyDecision(USER, 'nope', ['name'], {}));
      expect(err.code).toBe('UNKNOWN_CLIENT');
    });

    it('refuses to let the user exclude a required scope', async () => {
      const { service } = await withClient({ requiredScopes: ['name'] });

      const err = await errorFrom<AppError>(
        service.applyDecision(USER, 'app', ['name', 'email'], { excludedScopes: ['name'] }),
      );

      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_DECISION');
      expect(err.message).toContain('name');
    });

    it('rejects a value id the user was never offered', async () => {
      const { service } = await withClient();

      const err = await errorFrom<AppError>(
        service.applyDecision(USER, 'app', ['name'], { selections: { name: ['item-does-not-exist'] } }),
      );

      expect(err.code).toBe('INVALID_DECISION');
      expect(err.message).toContain('Unknown value selected');
    });

    // Someone could otherwise post two ids and leak a second email address under
    // a scope the app believes is single-valued.
    it('rejects two values for a single-valued scope', async () => {
      const ctx = await withClient();
      const [, , first, second] = ctx.vault.rows;

      const err = await errorFrom<AppError>(
        ctx.service.applyDecision(USER, 'app', ['email'], {
          selections: { email: [first.id, second.id] },
        }),
      );

      expect(err.code).toBe('INVALID_DECISION');
      expect(err.message).toContain('Only one value can be shared');
    });

    it('accepts several allergies, because that scope is a list', async () => {
      const items = [
        vaultItem('allergy', 'Penicillin'),
        vaultItem('allergy', 'Peanuts'),
        vaultItem('allergy', 'Latex'),
      ];
      const ctx = await withClient({ allowedScopes: ['allergies'] }, items);

      const decision = await ctx.service.applyDecision(USER, 'app', ['allergies'], {
        selections: { allergies: [items[0].id, items[1].id] },
      });

      expect(decision.grantedScopes).toEqual(['allergies']);
      expect(decision.selections[0].itemIds).toEqual([items[0].id, items[1].id]);
      expect(decision.selections[0].snapshot).toHaveLength(2);
    });

    it('ignores a scope the client never declared', async () => {
      const { service } = await withClient({ allowedScopes: ['name'] });

      const decision = await service.applyDecision(USER, 'app', ['name', 'email'], {});

      expect(decision.grantedScopes).toEqual(['name']);
      expect(decision.rejectedScopes).toEqual([]);
    });

    it('drops an optional scope the vault has no data for', async () => {
      const ctx = await withClient({ allowedScopes: ['name', 'phone'] });

      const decision = await ctx.service.applyDecision(USER, 'app', ['name', 'phone'], {});

      expect(decision.grantedScopes).toEqual(['name']);
      expect(decision.rejectedScopes).toEqual(['phone']);
    });

    it('blocks the decision when a required scope has no data', async () => {
      const ctx = await withClient({
        allowedScopes: ['name', 'phone'],
        requiredScopes: ['phone'],
      });

      const err = await errorFrom<AppError>(
        ctx.service.applyDecision(USER, 'app', ['name', 'phone'], {}),
      );

      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('MISSING_FIELDS');
      expect(err.fields).toEqual({ scopes: 'phone' });
    });

    it('records the user override rather than the suggestion', async () => {
      const ctx = await withClient({ purpose: 'healthcare' });
      const publicName = ctx.vault.rows.find((row) => row.nameContext === 'public')!;

      const decision = await ctx.service.applyDecision(USER, 'app', ['name'], {
        selections: { name: [publicName.id] },
      });

      expect(decision.selections[0].itemIds).toEqual([publicName.id]);
      expect(decision.selections[0].snapshot[0].value).toBe('Camila R.');
    });

    it('falls back to the context suggestion when the user picks nothing', async () => {
      const ctx = await withClient({ purpose: 'healthcare' });

      const decision = await ctx.service.applyDecision(USER, 'app', ['name'], {});

      expect(decision.purpose).toBe('healthcare');
      expect(decision.selections[0].snapshot[0].value).toBe('Camila Rodríguez García');
    });

    it('reports an excluded optional scope as rejected, not granted', async () => {
      const ctx = await withClient();

      const decision = await ctx.service.applyDecision(USER, 'app', ['name', 'email'], {
        excludedScopes: ['email'],
      });

      expect(decision.grantedScopes).toEqual(['name']);
      expect(decision.rejectedScopes).toEqual(['email']);
    });
  });
});
