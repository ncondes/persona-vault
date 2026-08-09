import { NameContext, VaultKind } from '../domain/models';
import { KIND_META, VAULT_KINDS } from './vault';

// Each data scope maps to a vault kind. Claim names mirror scope names;
// `given_name`/`family_name` release one part of the chosen name (the standard
// OIDC claim names), and `allergies` releases every `allergy` item as a list.
export const SCOPE_KIND: Record<string, VaultKind> = {
  name: 'name',
  given_name: 'name',
  family_name: 'name',
  username: 'username',
  email: 'email',
  phone: 'phone',
  address: 'address',
  birth_date: 'birth_date',
  document: 'document',
  blood_type: 'blood_type',
  eps: 'eps',
  allergies: 'allergy',
};

export const ALL_SCOPES = Object.keys(SCOPE_KIND);

// What a registering app says it is for. The purpose drives which name variant
// the consent screen suggests.
export const PURPOSES = [
  'healthcare',
  'employment',
  'social',
  'retail',
  'education',
  'government',
  'finance',
  'other',
] as const;

export type Purpose = (typeof PURPOSES)[number];

// Which name context a client's purpose suggests on the consent screen.
// Purposes with no entry fall back to DEFAULT_VARIANT.
export const PURPOSE_VARIANT: Record<string, NameContext> = {
  healthcare: 'legal',
  government: 'legal',
  finance: 'legal',
  employment: 'professional',
  education: 'professional',
  social: 'public',
};

export const DEFAULT_VARIANT: NameContext = 'preferred';

const SCOPE_LABEL: Record<string, string> = {
  name: 'Full name',
  given_name: 'First name',
  family_name: 'Last name',
  username: 'Username',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  birth_date: 'Date of birth',
  document: 'Document',
  blood_type: 'Blood type',
  eps: 'Health insurer (EPS)',
  allergies: 'Allergies',
};

// Shapes mirror itemClaimValue in services/context.service.ts, so a developer
// reading the catalog sees the same structure the userinfo endpoint returns.
const SCOPE_SAMPLE: Record<string, unknown> = {
  name: 'Camila Restrepo',
  given_name: 'Camila',
  family_name: 'Restrepo',
  username: 'camir',
  email: 'camila@example.com',
  phone: '+57 300 555 1234',
  address: {
    formatted: 'Calle 10 #4-56, Apt 302, Bogotá',
    line1: 'Calle 10 #4-56',
    line2: 'Apt 302',
    line3: null,
    city: 'Bogotá',
    postalCode: '110111',
    country: 'CO',
  },
  birth_date: '1996-04-18',
  document: { type: 'CC', number: '1020304050', issueDate: '2014-05-02', issuePlace: 'Bogotá' },
  blood_type: 'O+',
  eps: 'SURA',
  allergies: ['Penicillin', 'Peanuts'],
};

// Scopes are grouped by what the data is about, not by how risky it is. A
// picker organised by risk reads as a warning list; one organised by subject
// reads as a description of the app.
export const SCOPE_GROUPS = ['identity', 'contact', 'document', 'health'] as const;

export type ScopeGroup = (typeof SCOPE_GROUPS)[number];

const GROUP_OF: Record<string, ScopeGroup> = {
  name: 'identity',
  given_name: 'identity',
  family_name: 'identity',
  username: 'identity',
  birth_date: 'identity',
  email: 'contact',
  phone: 'contact',
  address: 'contact',
  document: 'document',
  blood_type: 'health',
  eps: 'health',
  allergies: 'health',
};

export interface ScopeMeta {
  scope: string;
  kind: VaultKind;
  group: ScopeGroup;
  sensitive: boolean;
  label: string;
  sample: unknown;
}

// The single description of what Persona can release. The consent screen, the
// developer console and the public catalog endpoint all read from here.
export const SCOPE_CATALOG: ScopeMeta[] = ALL_SCOPES.map((scope) => ({
  scope,
  kind: SCOPE_KIND[scope],
  group: GROUP_OF[scope],
  sensitive: KIND_META[SCOPE_KIND[scope]].sensitive,
  label: SCOPE_LABEL[scope],
  sample: SCOPE_SAMPLE[scope],
}));

// The scope a kind is released under, or null when it cannot be shared at all.
// `avatar` is storable but has no claim, so it is null by construction rather
// than by omission.
export const KIND_SCOPE: Record<VaultKind, string | null> = Object.fromEntries(
  VAULT_KINDS.map((kind) => [kind, ALL_SCOPES.find((scope) => SCOPE_KIND[scope] === kind) ?? null]),
) as Record<VaultKind, string | null>;
