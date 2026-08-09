import { AppError } from '../src/domain/errors';
import { VaultItem } from '../src/domain/models';
import { decryptSecret } from '../src/infrastructure/crypto/secret-box';
import { ClientServiceImpl, NewApp } from '../src/services/client.service';
import { resolveClaims } from '../src/services/context.service';
import { fakeRepositories, vaultItem } from './support/fakes';

function build(items: VaultItem[] = []) {
  const fakes = fakeRepositories(items);
  return { ...fakes, service: new ClientServiceImpl(fakes.repositories) };
}

const validApp: NewApp = {
  name: 'City Health Clinic',
  purpose: 'healthcare',
  allowedScopes: ['name', 'email', 'document'],
  requiredScopes: ['name'],
  redirectUris: ['http://localhost:4411/callback'],
};

async function errorFrom(run: Promise<unknown>): Promise<AppError> {
  try {
    await run;
  } catch (err) {
    return err as AppError;
  }
  throw new Error('expected the call to reject');
}

describe('client service', () => {
  describe('create', () => {
    it('derives a readable id and returns the secret exactly once', async () => {
      const { clients, service } = build();
      const created = await service.create('owner-1', validApp);

      expect(created.id).toMatch(/^city-health-clinic-[0-9a-f]{6}$/);
      expect(created.secret).toHaveLength(43);
      expect(created.secretLastFour).toBe(created.secret.slice(-4));

      // The row keeps ciphertext only; re-reading never exposes the plaintext.
      const stored = clients.rows[0];
      expect(stored.secretEncrypted).not.toContain(created.secret);
      expect(decryptSecret(stored.secretEncrypted)).toBe(created.secret);

      const fetched = await service.get('owner-1', created.id);
      expect(fetched).not.toHaveProperty('secret');
    });

    it('defaults the optional fields', async () => {
      const { service } = build();
      const created = await service.create('owner-1', {
        name: 'Bare App',
        purpose: 'other',
        allowedScopes: ['username'],
        redirectUris: ['https://example.test/cb'],
      });
      expect(created.description).toBeNull();
      expect(created.accent).toBe('teal');
      expect(created.requiredScopes).toEqual([]);
    });

    it('rejects a required scope that is not also allowed', async () => {
      const { service } = build();
      const err = await errorFrom(
        service.create('owner-1', { ...validApp, requiredScopes: ['phone'] }),
      );
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.fields).toHaveProperty('requiredScopes');
    });

    // An unknown scope in the row would make the OIDC layer reject the client
    // when it loads its metadata, bricking the app at authorize time.
    it('rejects an unknown scope', async () => {
      const { service } = build();
      const err = await errorFrom(
        service.create('owner-1', { ...validApp, allowedScopes: ['name', 'shoe_size'] }),
      );
      expect(err.statusCode).toBe(400);
      expect(err.fields?.allowedScopes).toContain('shoe_size');
    });

    it('rejects an unknown purpose', async () => {
      const { service } = build();
      const err = await errorFrom(service.create('owner-1', { ...validApp, purpose: 'wizardry' }));
      expect(err.fields).toHaveProperty('purpose');
    });
  });

  describe('ownership', () => {
    // 404 rather than 403 so a signed-in developer cannot probe for client ids
    // that belong to someone else.
    it('reports another developer’s app as missing on every route', async () => {
      const { service } = build();
      const mine = await service.create('owner-1', validApp);

      for (const call of [
        service.get('intruder', mine.id),
        service.update('intruder', mine.id, { name: 'Stolen' }),
        service.remove('intruder', mine.id),
        service.rotateSecret('intruder', mine.id),
        service.activity('intruder', mine.id),
      ]) {
        const err = await errorFrom(call);
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('APP_NOT_FOUND');
      }
    });

    it('lists only the caller’s apps', async () => {
      const { service } = build();
      await service.create('owner-1', validApp);
      await service.create('owner-2', { ...validApp, name: 'Other App' });
      expect(await service.listForOwner('owner-1')).toHaveLength(1);
    });
  });

  it('rotates the secret and invalidates the old one', async () => {
    const { clients, service } = build();
    const created = await service.create('owner-1', validApp);
    const rotated = await service.rotateSecret('owner-1', created.id);

    expect(rotated.secret).not.toBe(created.secret);
    expect(rotated.secretLastFour).toBe(rotated.secret.slice(-4));
    expect(decryptSecret(clients.rows[0].secretEncrypted)).toBe(rotated.secret);
  });

  describe('narrowing scopes', () => {
    it('revokes standing consent when a scope is removed', async () => {
      const { consents, audit, service } = build();
      const app = await service.create('owner-1', validApp);
      consents.rows.push({
        id: 'c1',
        userId: 'user-9',
        clientId: app.id,
        scopes: ['name', 'email'],
        selections: [],
        grantId: 'grant-9',
        grantedAt: new Date(),
      });

      const result = await service.update('owner-1', app.id, { allowedScopes: ['name'] });

      expect(result.revokedGrantIds).toEqual(['grant-9']);
      expect(consents.rows).toHaveLength(0);
      expect(audit.rows).toEqual([expect.objectContaining({ type: 'revoke', clientId: app.id })]);
    });

    it('leaves consent alone when scopes only widen', async () => {
      const { consents, service } = build();
      const app = await service.create('owner-1', validApp);
      consents.rows.push({
        id: 'c1',
        userId: 'user-9',
        clientId: app.id,
        scopes: ['name'],
        selections: [],
        grantId: 'grant-9',
        grantedAt: new Date(),
      });

      const result = await service.update('owner-1', app.id, {
        allowedScopes: ['name', 'email', 'document', 'phone'],
      });

      expect(result.revokedGrantIds).toEqual([]);
      expect(consents.rows).toHaveLength(1);
    });
  });

  describe('preview', () => {
    const legalName = vaultItem('name', 'Camila Rodríguez', {
      nameContext: 'legal',
      detail: { firstName: 'Camila', lastName: 'Rodríguez' },
    });
    const publicName = vaultItem('name', 'Cami R.', {
      nameContext: 'public',
      isDefault: true,
      detail: { firstName: 'Cami', lastName: 'R.' },
    });
    const email = vaultItem('email', 'camila@example.com', { isDefault: true });

    // Must go through the same engine the consent screen and userinfo use, not
    // a parallel implementation that could drift.
    it('matches resolveClaims for the same inputs', async () => {
      const items = [legalName, publicName, email];
      const { service } = build(items);
      const scopes = ['name', 'email'];

      const preview = await service.preview('owner-1', 'healthcare', scopes);
      const expected = resolveClaims({
        purpose: 'healthcare',
        allowedScopes: scopes,
        grantedScopes: scopes,
        selections: [],
        items,
      });

      expect(preview.claims).toEqual({ sub: 'owner-1', ...expected.claims });
      expect(preview.claims.name).toBe('Camila Rodríguez');
    });

    it('follows the purpose when suggesting a name', async () => {
      const { service } = build([legalName, publicName]);
      const social = await service.preview('owner-1', 'social', ['name']);
      expect(social.claims.name).toBe('Cami R.');
    });

    it('lists scopes the vault has no data for', async () => {
      const { service } = build([email]);
      const preview = await service.preview('owner-1', 'healthcare', ['email', 'blood_type']);
      expect(preview.missing).toEqual(['blood_type']);
      expect(preview.claims).not.toHaveProperty('blood_type');
    });

    it('ignores scopes the provider does not support', async () => {
      const { service } = build([email]);
      const preview = await service.preview('owner-1', 'other', ['email', 'shoe_size']);
      expect(Object.keys(preview.claims).sort()).toEqual(['email', 'sub']);
    });
  });

  describe('activity', () => {
    it('reports volume without identifying anyone', async () => {
      const { consents, audit, service } = build();
      const app = await service.create('owner-1', validApp);
      consents.rows.push({
        id: 'c1',
        userId: 'user-9',
        clientId: app.id,
        scopes: ['name'],
        selections: [],
        grantId: 'g1',
        grantedAt: new Date(),
      });
      await audit.record({
        userId: 'user-9',
        clientId: app.id,
        type: 'release',
        context: 'healthcare',
        scopesReleased: ['name'],
        fieldsReleased: ['name'],
      });

      const activity = await service.activity('owner-1', app.id);

      expect(activity).toMatchObject({ users: 1, releases: 1, grants: 0, revocations: 0 });
      expect(activity.recent).toEqual([
        { at: expect.any(Date), type: 'release', scopes: ['name'] },
      ]);
      expect(JSON.stringify(activity)).not.toContain('user-9');
    });
  });

  it('removes an app and returns its grant ids', async () => {
    const { clients, consents, service } = build();
    const app = await service.create('owner-1', validApp);
    consents.rows.push({
      id: 'c1',
      userId: 'user-9',
      clientId: app.id,
      scopes: ['name'],
      selections: [],
      grantId: 'grant-9',
      grantedAt: new Date(),
    });

    expect(await service.remove('owner-1', app.id)).toEqual(['grant-9']);
    expect(clients.rows).toHaveLength(0);
  });

  describe('registration rules the console form should never send', () => {
    it('rejects an app that asks for nothing', async () => {
      const err = await errorFrom(build().service.create('owner-1', { ...validApp, allowedScopes: [] }));
      expect(err.fields?.allowedScopes).toMatch(/at least one scope/i);
    });

    it('rejects an app with nowhere to redirect', async () => {
      const err = await errorFrom(build().service.create('owner-1', { ...validApp, redirectUris: [] }));
      expect(err.fields?.redirectUris).toMatch(/at least one redirect/i);
    });

    // The id carries six random hex characters, so this needs the collision
    // forced. It matters because an id collision would otherwise overwrite
    // another developer's app.
    it('refuses to reuse an id that already exists', async () => {
      const { clients, service } = build();
      const spy = jest
        .spyOn(clients, 'findById')
        .mockResolvedValueOnce({ id: 'taken' } as never);

      const err = await errorFrom(service.create('owner-1', validApp));

      expect(err.code).toBe('APP_ID_TAKEN');
      expect(err.statusCode).toBe(409);
      expect(clients.rows).toHaveLength(0);
      spy.mockRestore();
    });
  });

  // `register` is how the seed installs the three demo apps: a fixed id and a
  // fixed secret, upserted so restarting the stack keeps existing consents.
  describe('register (the seed path)', () => {
    it('stores an app at a chosen id and secret', async () => {
      const { clients, service } = build();

      const app = await service.register('owner-1', 'clinic', 'clinic-dev-secret', validApp);

      expect(app.id).toBe('clinic');
      expect(app.secretLastFour).toBe('cret');
      expect(decryptSecret(clients.rows[0].secretEncrypted)).toBe('clinic-dev-secret');
      expect(app).not.toHaveProperty('secret');
    });

    it('is idempotent, so re-seeding does not create a second app', async () => {
      const { clients, service } = build();

      await service.register('owner-1', 'clinic', 'clinic-dev-secret', validApp);
      await service.register('owner-1', 'clinic', 'clinic-dev-secret', {
        ...validApp,
        name: 'City Health Clinic (renamed)',
      });

      expect(clients.rows).toHaveLength(1);
      expect(clients.rows[0].name).toBe('City Health Clinic (renamed)');
    });

    it('validates the same way create does', async () => {
      const err = await errorFrom(
        build().service.register('owner-1', 'clinic', 'secret', {
          ...validApp,
          allowedScopes: ['shoe_size'],
        }),
      );
      expect(err.fields?.allowedScopes).toBeDefined();
    });
  });
});
