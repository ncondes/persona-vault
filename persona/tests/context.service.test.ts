import { resolveDefaultClaims } from '../src/services/context.service';
import { VaultItem, VaultKind } from '../src/domain/models';

let counter = 0;
function item(
  kind: VaultKind,
  value: string,
  extra: Partial<VaultItem> = {},
): VaultItem {
  counter += 1;
  return {
    id: `item-${counter}`,
    userId: 'user-1',
    kind,
    label: null,
    value,
    detail: null,
    isDefault: false,
    nameContext: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  };
}

const items: VaultItem[] = [
  item('name', 'Camila Andrea Rodríguez García', { nameContext: 'legal' }),
  item('name', 'Cami Rodríguez', { nameContext: 'preferred', isDefault: true }),
  item('name', 'Camila R.', { nameContext: 'public' }),
  item('email', 'personal@example.com', { label: 'Personal', isDefault: true }),
  item('email', 'work@acme.co', { label: 'Work' }),
  item('document', '1032456789', {
    isDefault: true,
    detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
  }),
  item('allergy', 'Penicillin'),
  item('allergy', 'Peanuts'),
];

describe('resolveDefaultClaims (context engine, vault defaults)', () => {
  it('a healthcare client gets the legal name and the default email', () => {
    const out = resolveDefaultClaims({
      purpose: 'healthcare',
      allowedScopes: ['name', 'email'],
      grantedScopes: ['name', 'email'],
      items,
    });
    expect(out.context).toBe('healthcare');
    expect(out.claims.name).toBe('Camila Andrea Rodríguez García');
    expect(out.claims.email).toBe('personal@example.com');
  });

  it('a social client only ever gets the public name, never other scopes', () => {
    const out = resolveDefaultClaims({
      purpose: 'social',
      allowedScopes: ['name'],
      grantedScopes: ['name', 'email', 'document', 'allergies'], // asks for everything
      items,
    });
    expect(out.claims.name).toBe('Camila R.');
    expect(out.claims).not.toHaveProperty('email');
    expect(out.claims).not.toHaveProperty('document');
    expect(out.claims).not.toHaveProperty('allergies');
  });

  it('falls back to the preferred name for an unknown purpose', () => {
    const out = resolveDefaultClaims({
      purpose: 'mystery',
      allowedScopes: ['name'],
      grantedScopes: ['name'],
      items,
    });
    expect(out.claims.name).toBe('Cami Rodríguez');
  });

  it('releases a document as an object with its detail parts', () => {
    const out = resolveDefaultClaims({
      purpose: 'healthcare',
      allowedScopes: ['document'],
      grantedScopes: ['document'],
      items,
    });
    expect(out.claims.document).toEqual({
      type: 'CC',
      number: '1032456789',
      issueDate: '2012-09-01',
      issuePlace: 'Bogotá D.C.',
    });
  });

  it('releases every allergy as a list', () => {
    const out = resolveDefaultClaims({
      purpose: 'healthcare',
      allowedScopes: ['allergies'],
      grantedScopes: ['allergies'],
      items,
    });
    expect(out.claims.allergies).toEqual(['Penicillin', 'Peanuts']);
  });

  it('omits a scope when the vault has no data for it', () => {
    const out = resolveDefaultClaims({
      purpose: 'healthcare',
      allowedScopes: ['name', 'eps'],
      grantedScopes: ['name', 'eps'],
      items: [],
    });
    expect(out.claims).toEqual({});
    expect(out.scopesReleased).toEqual([]);
  });
});
