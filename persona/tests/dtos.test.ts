import { createAppSchema, previewAppSchema, updateAppSchema } from '../src/dtos/app.dto';
import { registerSchema } from '../src/dtos/auth.dto';
import { updateSettingsSchema } from '../src/dtos/settings.dto';
import { createVaultItemSchema, updateVaultItemSchema } from '../src/dtos/vault.dto';

// The HTTP suites only ever see these as a 400. Tested directly, they document
// the registration contract — and the fragment rule below is a real defence, not
// a formality: the OIDC layer matches redirect URIs by exact string, so a URI
// that a browser would strip a fragment from could never match again.

const validApp = {
  name: 'City Health Clinic',
  purpose: 'healthcare',
  allowedScopes: ['name', 'email'],
  requiredScopes: ['name'],
  redirectUris: ['http://localhost:4411/callback'],
};

function fieldsOf(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('createAppSchema', () => {
  it('accepts a minimal app and fills nothing in that it should not', () => {
    const result = createAppSchema.safeParse(validApp);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ name: 'City Health Clinic', purpose: 'healthcare' });
  });

  it('treats description, accent and requiredScopes as optional', () => {
    expect(createAppSchema.safeParse({ ...validApp, requiredScopes: undefined }).success).toBe(true);
  });

  it('rejects an unknown key rather than ignoring it', () => {
    const result = createAppSchema.safeParse({ ...validApp, isAdmin: true });
    expect(result.success).toBe(false);
  });

  it.each([
    ['an unknown scope', { allowedScopes: ['shoe_size'] }],
    ['no scopes at all', { allowedScopes: [] }],
    ['an unknown purpose', { purpose: 'espionage' }],
    ['an empty name', { name: '' }],
    ['a name over 60 characters', { name: 'x'.repeat(61) }],
    ['a description over 200 characters', { description: 'x'.repeat(201) }],
    ['no redirect URI', { redirectUris: [] }],
    ['a redirect URI that is not a URL', { redirectUris: ['/callback'] }],
    ['more than five redirect URIs', {
      redirectUris: Array.from({ length: 6 }, (_, i) => `http://localhost:44${i}0/cb`),
    }],
    ['an accent over 20 characters', { accent: 'x'.repeat(21) }],
  ])('rejects %s', (_label, patch) => {
    expect(createAppSchema.safeParse({ ...validApp, ...patch }).success).toBe(false);
  });

  it('rejects a redirect URI carrying a fragment', () => {
    const result = createAppSchema.safeParse({
      ...validApp,
      redirectUris: ['http://localhost:4411/callback#token'],
    });

    expect(result.success).toBe(false);
    expect(fieldsOf(result)).toContain('redirectUris.0');
    expect(result.error?.issues[0].message).toBe('must not contain a fragment');
  });
});

describe('updateAppSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateAppSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a status change', () => {
    expect(updateAppSchema.safeParse({ status: 'disabled' }).success).toBe(true);
    expect(updateAppSchema.safeParse({ status: 'paused' }).success).toBe(false);
  });

  // Without .strict() a typo'd key would be silently dropped and the developer
  // would see a successful save that changed nothing.
  it('rejects an unknown key', () => {
    expect(updateAppSchema.safeParse({ ownerId: 'someone-else' }).success).toBe(false);
  });

  it('still validates the fields it is given', () => {
    expect(updateAppSchema.safeParse({ allowedScopes: ['shoe_size'] }).success).toBe(false);
  });
});

describe('previewAppSchema', () => {
  it('accepts a purpose and a scope list', () => {
    expect(previewAppSchema.safeParse({ purpose: 'retail', scopes: ['email'] }).success).toBe(true);
  });

  it('accepts an empty scope list', () => {
    expect(previewAppSchema.safeParse({ purpose: 'retail', scopes: [] }).success).toBe(true);
  });

  it.each([
    ['an unknown scope', { purpose: 'retail', scopes: ['shoe_size'] }],
    ['a missing purpose', { scopes: [] }],
    ['an unknown key', { purpose: 'retail', scopes: [], userId: 'someone-else' }],
  ])('rejects %s', (_label, body) => {
    expect(previewAppSchema.safeParse(body).success).toBe(false);
  });
});

describe('vault schemas', () => {
  it('accepts a document with its detail', () => {
    const result = createVaultItemSchema.safeParse({
      kind: 'document',
      value: '1020304050',
      detail: { type: 'CC', issueDate: '2015-04-02', issuePlace: 'Bogotá' },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['an unknown kind', { kind: 'shoe_size', value: '42' }],
    ['an unknown name context', { kind: 'name', value: 'C', nameContext: 'ceremonial' }],
    ['an unknown key', { kind: 'email', value: 'a@example.com', userId: 'someone-else' }],
  ])('rejects %s', (_label, body) => {
    expect(createVaultItemSchema.safeParse(body).success).toBe(false);
  });

  it('accepts an empty update patch but rejects an unknown key', () => {
    expect(updateVaultItemSchema.safeParse({}).success).toBe(true);
    expect(updateVaultItemSchema.safeParse({ kind: 'email' }).success).toBe(false);
  });
});

describe('auth and settings schemas', () => {
  it('reports every bad registration field at once, not just the first', () => {
    const result = registerSchema.safeParse({
      firstName: '',
      lastName: '',
      email: 'not-an-email',
      password: 'short',
    });

    expect(result.success).toBe(false);
    expect(fieldsOf(result).sort()).toEqual(['email', 'firstName', 'lastName', 'password']);
  });

  it('rejects a settings key it does not know', () => {
    expect(updateSettingsSchema.safeParse({ notifyAccess: true }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ shoeSize: 42 }).success).toBe(false);
  });
});
