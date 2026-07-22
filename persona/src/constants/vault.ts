import { VaultKind } from '../domain/models';

export interface KindMeta {
  // Sensitive kinds get extra friction on the consent screen.
  sensitive: boolean;
  // Whether the kind can hold more than one value.
  multi: boolean;
}

export const KIND_META: Record<VaultKind, KindMeta> = {
  name: { sensitive: false, multi: true },
  username: { sensitive: false, multi: false },
  avatar: { sensitive: false, multi: false },
  birth_date: { sensitive: true, multi: false },
  document: { sensitive: true, multi: true },
  email: { sensitive: false, multi: true },
  phone: { sensitive: false, multi: true },
  address: { sensitive: true, multi: true },
  blood_type: { sensitive: true, multi: false },
  eps: { sensitive: true, multi: false },
  allergy: { sensitive: true, multi: true },
};

export const VAULT_KINDS = Object.keys(KIND_META) as VaultKind[];
