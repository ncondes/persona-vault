// The demo relying parties. Single source of truth: the database seed and the
// OIDC provider both register clients from this list.

export interface DemoClient {
  id: string;
  name: string;
  purpose: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  devSecret: string;
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    id: 'clinic',
    name: 'City Health Clinic',
    purpose: 'healthcare',
    allowedScopes: [
      'name',
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
    redirectUris: ['http://localhost:4410/callback/clinic'],
    devSecret: 'clinic-dev-secret',
  },
  {
    id: 'forum',
    name: 'Hobbyist Forum',
    purpose: 'social',
    allowedScopes: ['name', 'username'],
    requiredScopes: ['name'],
    redirectUris: ['http://localhost:4410/callback/forum'],
    devSecret: 'forum-dev-secret',
  },
  {
    id: 'store',
    name: 'Tiger Store',
    purpose: 'retail',
    allowedScopes: ['username'],
    requiredScopes: ['username'],
    redirectUris: ['http://localhost:4410/callback/store'],
    devSecret: 'store-dev-secret',
  },
];
