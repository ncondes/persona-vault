// Storage for oidc-provider's artifacts. One row per (model, id); the extra
// columns are the secondary lookups its adapter contract requires.
export type OidcPayloadData = Record<string, unknown>;

export interface UpsertOidcPayloadInput {
  model: string;
  id: string;
  payload: OidcPayloadData;
  grantId: string | null;
  userCode: string | null;
  uid: string | null;
  expiresAt: Date | null;
}

export interface OidcPayloadRepository {
  upsert(input: UpsertOidcPayloadInput): Promise<void>;
  find(model: string, id: string): Promise<OidcPayloadData | null>;
  findByUid(uid: string): Promise<OidcPayloadData | null>;
  findByUserCode(userCode: string): Promise<OidcPayloadData | null>;
  setPayload(model: string, id: string, payload: OidcPayloadData): Promise<void>;
  destroy(model: string, id: string): Promise<void>;
  deleteByGrantId(grantId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
