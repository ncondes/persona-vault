import { Client, ClientStatus } from '../models';

export interface SaveClientInput {
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
}

export interface UpdateClientInput {
  name?: string;
  description?: string | null;
  purpose?: string;
  accent?: string;
  allowedScopes?: string[];
  requiredScopes?: string[];
  redirectUris?: string[];
  secretEncrypted?: string;
  secretLastFour?: string;
  status?: ClientStatus;
  verifiedDomain?: string | null;
  verifiedAt?: Date | null;
  verificationToken?: string | null;
  verificationIssuedAt?: Date | null;
}

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  list(): Promise<Client[]>;
  listByOwner(ownerId: string): Promise<Client[]>;
  // Upsert so re-running the seed is idempotent and keeps existing consents.
  upsert(input: SaveClientInput): Promise<Client>;
  update(id: string, patch: UpdateClientInput): Promise<Client>;
  delete(id: string): Promise<void>;
}
