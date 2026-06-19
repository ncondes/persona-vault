export type NameVariantKind = 'legal' | 'preferred' | 'professional' | 'public';
export type ProfileFieldKey = 'email' | 'phone' | 'address' | 'dob';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NameVariant {
  id: string;
  userId: string;
  kind: NameVariantKind;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileField {
  id: string;
  userId: string;
  key: ProfileFieldKey;
  value: string;
  sensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  purpose: string;
  allowedScopes: string[];
  redirectUris: string[];
  secretHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Consent {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  grantId: string | null;
  grantedAt: Date;
}

export interface AuditEntry {
  id: string;
  at: Date;
  userId: string;
  clientId: string;
  context: string;
  scopesReleased: string[];
  fieldsReleased: string[];
}
