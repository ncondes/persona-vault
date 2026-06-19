import { resolveClaims } from '../src/services/context.service';

const names = {
  legal: 'María de los Ángeles Pérez Ruiz',
  preferred: 'Mara',
  professional: 'Dr. M. Pérez Ruiz',
  public: 'Mara P.',
};

const fields = {
  email: 'mara@example.com',
  phone: '+44 7700 900123',
  address: '12 Kings Road, London',
  dob: '1990-04-12',
};

describe('resolveClaims (context engine)', () => {
  it('a healthcare client gets the legal name + consented contact fields', () => {
    const out = resolveClaims({
      names,
      fields,
      purpose: 'healthcare',
      allowedScopes: ['name', 'email', 'phone', 'address'],
      requestedScopes: ['name', 'email', 'phone', 'address'],
      consentedScopes: ['name', 'email', 'phone', 'address'],
    });
    expect(out.context).toBe('healthcare');
    expect(out.claims.name).toBe(names.legal);
    expect(out.claims.email).toBe(fields.email);
    expect(out.claims.phone).toBe(fields.phone);
    expect(out.claims.address).toBe(fields.address);
  });

  // --- LEAK / minimisation tests ---

  it('a social client only ever gets the public name, never contact fields', () => {
    const out = resolveClaims({
      names,
      fields,
      purpose: 'social',
      allowedScopes: ['name'],
      requestedScopes: ['name', 'email', 'phone', 'address', 'dob'], // asks for everything
      consentedScopes: ['name', 'email', 'phone', 'address', 'dob'],
    });
    expect(out.claims.name).toBe(names.public);
    expect(out.claims).not.toHaveProperty('email');
    expect(out.claims).not.toHaveProperty('phone');
    expect(out.claims).not.toHaveProperty('address');
    expect(JSON.stringify(out.claims)).not.toContain(names.legal);
  });

  it('withholds a scope the user did not consent to, even when allowed and requested', () => {
    const out = resolveClaims({
      names,
      fields,
      purpose: 'healthcare',
      allowedScopes: ['name', 'email', 'phone', 'address'],
      requestedScopes: ['name', 'email', 'phone'],
      consentedScopes: ['name', 'email'], // no phone
    });
    expect(out.claims).toHaveProperty('email');
    expect(out.claims).not.toHaveProperty('phone');
  });

  it('selects the name variant from the purpose, defaulting to preferred', () => {
    const pick = (purpose: string) =>
      resolveClaims({
        names,
        fields,
        purpose,
        allowedScopes: ['name'],
        requestedScopes: ['name'],
        consentedScopes: ['name'],
      }).claims.name;

    expect(pick('healthcare')).toBe(names.legal);
    expect(pick('employment')).toBe(names.professional);
    expect(pick('social')).toBe(names.public);
    expect(pick('mystery')).toBe(names.preferred); // fallback
  });

  it('omits a scope when the underlying data is missing', () => {
    const out = resolveClaims({
      names: { public: 'Only Public' },
      fields: {},
      purpose: 'healthcare', // wants legal, which is missing
      allowedScopes: ['name', 'email'],
      requestedScopes: ['name', 'email'],
      consentedScopes: ['name', 'email'],
    });
    expect(out.claims).not.toHaveProperty('name');
    expect(out.claims).not.toHaveProperty('email');
    expect(out.scopesReleased).toEqual([]);
  });
});
