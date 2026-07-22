export type VaultKind =
  | 'name'
  | 'username'
  | 'avatar'
  | 'birth_date'
  | 'document'
  | 'email'
  | 'phone'
  | 'address'
  | 'blood_type'
  | 'eps'
  | 'allergy';

export type NameContext = 'legal' | 'preferred' | 'professional' | 'public';

export type AuditType = 'grant' | 'release' | 'revoke';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  confirmSensitive: boolean;
  notifyAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Extra parts of a document item; the item's `value` holds the number.
export interface DocumentDetail {
  type: string;
  issueDate: string;
  issuePlace: string;
}

// Parts of a name item; the item's `value` holds the composed full name.
export interface NameDetail {
  firstName: string;
  lastName: string;
}

// Parts of a phone item; the item's `value` holds "+57 300 555 1234".
export interface PhoneDetail {
  countryCode: string;
  number: string;
}

// Parts of an address item; the item's `value` holds a one-line summary.
export interface AddressDetail {
  street: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  details?: string;
}

export type ItemDetail = DocumentDetail | NameDetail | PhoneDetail | AddressDetail;

export interface VaultItem {
  id: string;
  userId: string;
  kind: VaultKind;
  label: string | null;
  value: string;
  detail: ItemDetail | null;
  isDefault: boolean;
  nameContext: NameContext | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  purpose: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  secretHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// The values a user approved for one scope: the live item ids that back the
// claim, plus a snapshot of what the values were at approval time.
export interface ConsentSelection {
  scope: string;
  itemIds: string[];
  snapshot: Array<{
    label: string | null;
    value: string;
    detail: ItemDetail | null;
  }>;
}

export interface Consent {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  selections: ConsentSelection[];
  grantId: string | null;
  grantedAt: Date;
}

export interface AuditEntry {
  id: string;
  at: Date;
  userId: string;
  clientId: string;
  type: AuditType;
  context: string;
  scopesReleased: string[];
  fieldsReleased: string[];
}
