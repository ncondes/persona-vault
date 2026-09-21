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

export type ClientStatus = 'active' | 'disabled';

export type OtpPurpose = 'signup' | 'login';

// Where a signing key is in its rollover. Only `active` signs.
export type KeyState = 'incoming' | 'active' | 'retiring';

export interface SigningKey {
  // The RFC 7638 thumbprint of the public key.
  kid: string;
  alg: string;
  publicJwk: unknown;
  privateEncrypted: string;
  state: KeyState;
  createdAt: Date;
  activatedAt: Date | null;
  retiresAt: Date | null;
}

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
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  postalCode?: string;
  country: string;
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

// A relying party registered through the developer console. `secretEncrypted`
// never leaves the service layer; the console only ever sees `secretLastFour`.
export interface Client {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  purpose: string;
  accent: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  secretEncrypted: string;
  secretLastFour: string;
  status: ClientStatus;
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

// A sign-up or sign-in waiting on its emailed code. A `signup` challenge carries
// the account that does not exist yet; a `login` one points at the account it
// will open. `codeHash` is a digest — the code itself only ever exists in the
// email and in the request that answers it.
export interface OtpChallenge {
  id: string;
  purpose: OtpPurpose;
  email: string;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string | null;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sends: number;
  lastSentAt: Date;
  createdAt: Date;
}
