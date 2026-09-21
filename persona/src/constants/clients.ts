// Seed data for the demo relying parties. The OIDC provider reads clients from
// the database; this list only exists so a clean clone comes up with the four
// demo apps already registered, through the same service the console uses.

// Where each app answers, and the secret it authenticates with. Both are read
// from the environment so a hosted copy can register its real addresses, and
// both fall back to the local ones so a clean clone still works untouched —
// which the integration tests rely on, since they build their redirect URIs
// from this list.
function demoOrigin(name: string, port: number): string {
  return process.env[`${name.toUpperCase()}_URL`] ?? `http://localhost:${port}`;
}

function demoSecret(name: string): string {
  return process.env[`${name.toUpperCase()}_CLIENT_SECRET`] ?? `${name}-dev-secret`;
}

export interface DemoClient {
  id: string;
  // Whether the seed records this app as having proved its domain.
  //
  // The proof itself cannot happen locally: verification requires https on a
  // public address, and these run on localhost. So the seed states the outcome
  // for the three products, the way it states their client secrets — the demo
  // world is fabricated on purpose. The mechanism that would produce that
  // outcome is tested for real in verification.service.test.ts and
  // challenge-fetch.int.test.ts, and the three demos serve the challenge file
  // so a hosted copy can go through it properly.
  //
  // Probe is left unverified, because that is the case worth seeing.
  verified?: boolean;
  name: string;
  description: string;
  purpose: string;
  accent: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  devSecret: string;
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    id: 'clinic',
    name: 'City Health Clinic',
    description: 'New patient intake — skip the paperwork.',
    purpose: 'healthcare',
    accent: 'blue',
    allowedScopes: [
      'name',
      'given_name',
      'family_name',
      'email',
      'phone',
      'address',
      'birth_date',
      'document',
      'blood_type',
      'eps',
      'allergies',
    ],
    requiredScopes: ['name', 'email', 'document', 'eps'],
    redirectUris: [`${demoOrigin('clinic', 4411)}/callback`],
    devSecret: demoSecret('clinic'),
    verified: true,
  },
  {
    id: 'forum',
    name: 'Hobbyist Forum',
    description: 'Join the conversation under your public name.',
    purpose: 'social',
    accent: 'violet',
    allowedScopes: ['name', 'username'],
    requiredScopes: ['name'],
    redirectUris: [`${demoOrigin('forum', 4412)}/callback`],
    devSecret: demoSecret('forum'),
    verified: true,
  },
  {
    id: 'store',
    name: 'Tiger Store',
    description: 'One-click checkout with your shipping details.',
    purpose: 'retail',
    accent: 'rust',
    allowedScopes: ['username', 'name', 'email', 'phone', 'address'],
    requiredScopes: ['username', 'address'],
    redirectUris: [`${demoOrigin('store', 4413)}/callback`],
    devSecret: demoSecret('store'),
    verified: true,
  },
  // The adversary. Registered exactly like the other three, and deliberately
  // modest about it: a social app asking for a name and a handle. What it then
  // goes after is health data, other people's vaults, and tokens it should not
  // be able to use. Everything it is refused is refused because of what it
  // registered as, which is the point the evaluation chapter is making.
  {
    id: 'probe',
    name: 'Probe',
    description: 'An adversarial relying party, used to test what Persona refuses.',
    purpose: 'social',
    accent: 'rust',
    allowedScopes: ['name', 'username'],
    requiredScopes: ['username'],
    redirectUris: [`${demoOrigin('probe', 4414)}/callback`],
    devSecret: demoSecret('probe'),
  },
];
