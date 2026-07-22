import { NameContext, VaultKind } from '../domain/models';

export const NAME_SCOPE = 'name';

// Each data scope maps one-to-one to a vault kind. Claim names mirror scope
// names; `allergies` releases every `allergy` item as a list.
export const SCOPE_KIND: Record<string, VaultKind> = {
  name: 'name',
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

// Which name context a client's purpose suggests on the consent screen.
export const PURPOSE_VARIANT: Record<string, NameContext> = {
  healthcare: 'legal',
  employment: 'professional',
  social: 'public',
};

export const DEFAULT_VARIANT: NameContext = 'preferred';
