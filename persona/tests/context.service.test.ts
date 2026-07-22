import {
  resolveClaims,
  suggestSelections,
} from '../src/services/context.service';
import { VaultItem, VaultKind } from '../src/domain/models';

let counter = 0;
function item(kind: VaultKind, value: string, extra: Partial<VaultItem> = {}): VaultItem {
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

const legalName = item('name', 'Camila Andrea Rodríguez García', {
  nameContext: 'legal',
  detail: { firstName: 'Camila Andrea', lastName: 'Rodríguez García' },
});
const preferredName = item('name', 'Cami Rodríguez', {
  nameContext: 'preferred',
  isDefault: true,
  detail: { firstName: 'Cami', lastName: 'Rodríguez' },
});
const publicName = item('name', 'Camila R.', {
  nameContext: 'public',
  detail: { firstName: 'Camila', lastName: 'R.' },
});
const homeAddress = item('address', 'Cra 7 # 45-10, Bogotá', {
  isDefault: true,
  detail: { street: 'Cra 7 # 45-10', city: 'Bogotá', country: 'CO' },
});
const personalEmail = item('email', 'personal@example.com', { label: 'Personal', isDefault: true });
const workEmail = item('email', 'work@acme.co', { label: 'Work' });
const cedula = item('document', '1032456789', {
  isDefault: true,
  detail: { type: 'CC', issueDate: '2012-09-01', issuePlace: 'Bogotá D.C.' },
});
const penicillin = item('allergy', 'Penicillin');
const peanuts = item('allergy', 'Peanuts');

const items = [
  legalName,
  preferredName,
  publicName,
  homeAddress,
  personalEmail,
  workEmail,
  cedula,
  penicillin,
  peanuts,
];

describe('suggestSelections (consent pre-selection)', () => {
  it('suggests the name matching the client purpose', () => {
    const byPurpose = (purpose: string) =>
      suggestSelections(purpose, ['name'], ['name'], items)[0].suggestedIds;

    expect(byPurpose('healthcare')).toEqual([legalName.id]);
    expect(byPurpose('social')).toEqual([publicName.id]);
    expect(byPurpose('mystery')).toEqual([preferredName.id]); // preferred fallback
  });

  it('suggests the default value for non-name kinds', () => {
    const [email] = suggestSelections('retail', ['email'], ['email'], items);
    expect(email.suggestedIds).toEqual([personalEmail.id]);
    expect(email.options).toHaveLength(2);
  });

  it('suggests every allergy at once', () => {
    const [allergies] = suggestSelections('healthcare', ['allergies'], ['allergies'], items);
    expect(allergies.suggestedIds).toEqual([penicillin.id, peanuts.id]);
  });

  it('flags a requested scope the vault has no data for', () => {
    const [eps] = suggestSelections('healthcare', ['eps'], ['eps'], items);
    expect(eps.missing).toBe(true);
    expect(eps.suggestedIds).toEqual([]);
    expect(eps.sensitive).toBe(true);
  });

  it('silently skips scopes the client is not allowed', () => {
    const suggestions = suggestSelections('social', ['name'], ['name', 'email', 'document'], items);
    expect(suggestions.map((s) => s.scope)).toEqual(['name']);
  });
});

describe('resolveClaims (release from stored selections)', () => {
  it('releases exactly the selected value — the user override beats the suggestion', () => {
    const out = resolveClaims({
      purpose: 'healthcare', // would suggest the legal name
      allowedScopes: ['name', 'email'],
      grantedScopes: ['name', 'email'],
      selections: [
        { scope: 'name', itemIds: [publicName.id], snapshot: [] },
        { scope: 'email', itemIds: [workEmail.id], snapshot: [] },
      ],
      items,
    });
    expect(out.claims.name).toBe('Camila R.');
    expect(out.claims.email).toBe('work@acme.co');
  });

  it('falls back to the context suggestion when no selection is stored', () => {
    const out = resolveClaims({
      purpose: 'healthcare',
      allowedScopes: ['name', 'email'],
      grantedScopes: ['name', 'email'],
      selections: [],
      items,
    });
    expect(out.claims.name).toBe('Camila Andrea Rodríguez García');
    expect(out.claims.email).toBe('personal@example.com');
  });

  it('never releases a scope outside the granted or allowed sets', () => {
    const out = resolveClaims({
      purpose: 'social',
      allowedScopes: ['name'],
      grantedScopes: ['name', 'email', 'document'], // email/document not allowed
      selections: [],
      items,
    });
    expect(Object.keys(out.claims)).toEqual(['name']);
  });

  it('releases a document as an object with its detail parts', () => {
    const out = resolveClaims({
      purpose: 'healthcare',
      allowedScopes: ['document'],
      grantedScopes: ['document'],
      selections: [{ scope: 'document', itemIds: [cedula.id], snapshot: [] }],
      items,
    });
    expect(out.claims.document).toEqual({
      type: 'CC',
      number: '1032456789',
      issueDate: '2012-09-01',
      issuePlace: 'Bogotá D.C.',
    });
  });

  it('releases one part of the chosen name for given_name/family_name', () => {
    const out = resolveClaims({
      purpose: 'healthcare', // suggests the legal name
      allowedScopes: ['given_name', 'family_name'],
      grantedScopes: ['given_name', 'family_name'],
      selections: [],
      items,
    });
    expect(out.claims.given_name).toBe('Camila Andrea');
    expect(out.claims.family_name).toBe('Rodríguez García');
    expect(out.claims).not.toHaveProperty('name');
  });

  it('releases an address as a structured object', () => {
    const out = resolveClaims({
      purpose: 'retail',
      allowedScopes: ['address'],
      grantedScopes: ['address'],
      selections: [],
      items,
    });
    expect(out.claims.address).toEqual({
      formatted: 'Cra 7 # 45-10, Bogotá',
      street: 'Cra 7 # 45-10',
      city: 'Bogotá',
      region: null,
      postalCode: null,
      country: 'CO',
      details: null,
    });
  });

  it('releases allergies as a list', () => {
    const out = resolveClaims({
      purpose: 'healthcare',
      allowedScopes: ['allergies'],
      grantedScopes: ['allergies'],
      selections: [{ scope: 'allergies', itemIds: [penicillin.id, peanuts.id], snapshot: [] }],
      items,
    });
    expect(out.claims.allergies).toEqual(['Penicillin', 'Peanuts']);
  });

  it('drops the claim when the selected item was deleted from the vault', () => {
    const out = resolveClaims({
      purpose: 'healthcare',
      allowedScopes: ['name', 'email'],
      grantedScopes: ['name', 'email'],
      selections: [
        { scope: 'name', itemIds: ['gone-1'], snapshot: [{ label: null, value: 'Old', detail: null }] },
        { scope: 'email', itemIds: [personalEmail.id], snapshot: [] },
      ],
      items,
    });
    expect(out.claims).not.toHaveProperty('name');
    expect(out.claims.email).toBe('personal@example.com');
    expect(out.scopesReleased).toEqual(['email']);
  });

  it('releases nothing from an empty vault', () => {
    const out = resolveClaims({
      purpose: 'healthcare',
      allowedScopes: ['name', 'eps'],
      grantedScopes: ['name', 'eps'],
      selections: [],
      items: [],
    });
    expect(out.claims).toEqual({});
    expect(out.scopesReleased).toEqual([]);
  });
});
