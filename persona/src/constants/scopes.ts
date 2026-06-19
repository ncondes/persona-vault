import { NameVariantKind, ProfileFieldKey } from '../domain/models';

// The scope that releases a (context-appropriate) name variant.
export const NAME_SCOPE = 'name';

// Each non-name scope maps one-to-one to a profile field.
export const SCOPE_FIELD: Record<string, ProfileFieldKey> = {
  email: 'email',
  phone: 'phone',
  address: 'address',
  dob: 'dob',
};

// Which name variant a client receives, based on its declared purpose.
export const PURPOSE_VARIANT: Record<string, NameVariantKind> = {
  healthcare: 'legal',
  employment: 'professional',
  social: 'public',
};

export const DEFAULT_VARIANT: NameVariantKind = 'preferred';
