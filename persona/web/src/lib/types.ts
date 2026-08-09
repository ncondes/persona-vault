export type VaultKind =
  | "name"
  | "username"
  | "avatar"
  | "birth_date"
  | "document"
  | "email"
  | "phone"
  | "address"
  | "blood_type"
  | "eps"
  | "allergy";

export type NameContext = "legal" | "preferred" | "professional" | "public";

export interface DocumentDetail {
  type: string;
  issueDate: string;
  issuePlace: string;
}

export interface NameDetail {
  firstName: string;
  lastName: string;
}

export interface PhoneDetail {
  countryCode: string;
  number: string;
}

export interface AddressDetail {
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  postalCode?: string;
  country: string;
}

export type ItemDetail = DocumentDetail | NameDetail | PhoneDetail | AddressDetail;

export function docDetail(detail: ItemDetail | null): DocumentDetail | null {
  return detail && "issueDate" in detail ? detail : null;
}

export function nameDetail(detail: ItemDetail | null): NameDetail | null {
  return detail && "firstName" in detail ? detail : null;
}

export function phoneDetail(detail: ItemDetail | null): PhoneDetail | null {
  return detail && "countryCode" in detail ? detail : null;
}

export function addressDetail(detail: ItemDetail | null): AddressDetail | null {
  return detail && "line1" in detail ? detail : null;
}

export interface VaultItem {
  id: string;
  kind: VaultKind;
  label: string | null;
  value: string;
  detail: ItemDetail | null;
  isDefault: boolean;
  nameContext: NameContext | null;
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewVaultItem {
  kind: VaultKind;
  value?: string;
  label?: string | null;
  detail?: ItemDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export type ScopeGroup = "identity" | "contact" | "document" | "health";

export interface ScopeMeta {
  scope: string;
  kind: VaultKind;
  group: ScopeGroup;
  sensitive: boolean;
  label: string;
  sample: unknown;
}

export interface Catalog {
  issuer: string;
  documentTypes: string[];
  bloodTypes: string[];
  epsProviders: string[];
  countries: Array<{ code: string; dial: string }>;
  purposes: string[];
  scopeGroups: ScopeGroup[];
  scopes: ScopeMeta[];
  kinds: Record<VaultKind, { sensitive: boolean; multi: boolean; scope: string | null }>;
}

export type AppStatus = "active" | "disabled";

export interface AppView {
  id: string;
  name: string;
  description: string | null;
  purpose: string;
  accent: string;
  allowedScopes: string[];
  requiredScopes: string[];
  redirectUris: string[];
  status: AppStatus;
  secretLastFour: string;
  createdAt: string;
  updatedAt: string;
}

// Only ever returned by create and rotate; the plaintext is unrecoverable after.
export interface AppWithSecret extends AppView {
  secret: string;
}

export interface NewApp {
  name: string;
  description?: string | null;
  purpose: string;
  accent?: string;
  allowedScopes: string[];
  requiredScopes?: string[];
  redirectUris: string[];
}

export type AppPatch = Partial<NewApp> & { status?: AppStatus };

export interface PreviewResult {
  claims: Record<string, unknown>;
  missing: string[];
}

export interface ActivityEvent {
  at: string;
  type: "grant" | "release" | "revoke";
  scopes: string[];
}

export interface ActivityView {
  users: number;
  grants: number;
  releases: number;
  revocations: number;
  recent: ActivityEvent[];
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// A sign-up or sign-in waiting on its emailed code. The code is deliberately
// not in here: the only way to get it is to open the inbox.
export interface OtpChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
}

export interface SharedScope {
  scope: string;
  sensitive: boolean;
  snapshot: Array<{ label: string | null; value: string; detail: ItemDetail | null }>;
}

export interface Connection {
  clientId: string;
  clientName: string;
  purpose: string;
  scopes: string[];
  grantedAt: string;
  shared: SharedScope[];
}

export interface AuditEntry {
  id: string;
  at: string;
  clientId: string;
  clientName: string;
  type: "grant" | "release" | "revoke";
  context: string;
  scopesReleased: string[];
  fieldsReleased: string[];
}

export interface Settings {
  confirmSensitive: boolean;
  notifyAccess: boolean;
}

export interface InteractionClient {
  id: string;
  name?: string;
  purpose?: string;
}

export interface InteractionOption {
  id: string;
  label: string | null;
  value: string;
  detail: ItemDetail | null;
  isDefault: boolean;
  nameContext: NameContext | null;
}

export interface InteractionField {
  scope: string;
  kind: VaultKind;
  required: boolean;
  sensitive: boolean;
  missing: boolean;
  suggestedIds: string[];
  options: InteractionOption[];
}

export interface LoginPrompt {
  uid: string;
  prompt: "login";
  client: InteractionClient;
}

export interface ConsentPrompt {
  uid: string;
  prompt: "consent";
  client: { id: string; name: string; purpose: string };
  settings: { confirmSensitive: boolean };
  fields: InteractionField[];
}

// GET /interaction/:uid can also answer with a redirect (silent sign-on).
export type Interaction = LoginPrompt | ConsentPrompt | { redirectTo: string };

export interface Decision {
  selections?: Record<string, string[]>;
  excludedScopes?: string[];
}
