// Seed data for the demo relying parties. The OIDC provider reads clients from
// the database; this list only exists so a clean clone comes up with the three
// demo apps already registered, through the same service the console uses.

export interface DemoClient {
  id: string;
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
    redirectUris: ['http://localhost:4411/callback'],
    devSecret: 'clinic-dev-secret',
  },
  {
    id: 'forum',
    name: 'Hobbyist Forum',
    description: 'Join the conversation under your public name.',
    purpose: 'social',
    accent: 'violet',
    allowedScopes: ['name', 'username'],
    requiredScopes: ['name'],
    redirectUris: ['http://localhost:4412/callback'],
    devSecret: 'forum-dev-secret',
  },
  {
    id: 'store',
    name: 'Tiger Store',
    description: 'One-click checkout with your shipping details.',
    purpose: 'retail',
    accent: 'rust',
    allowedScopes: ['username', 'name', 'email', 'phone', 'address'],
    requiredScopes: ['username', 'address'],
    redirectUris: ['http://localhost:4413/callback'],
    devSecret: 'store-dev-secret',
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
    redirectUris: ['http://localhost:4414/callback'],
    devSecret: 'probe-dev-secret',
  },
];
