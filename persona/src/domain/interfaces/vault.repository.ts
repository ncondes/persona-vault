import { DocumentDetail, NameContext, VaultItem, VaultKind } from '../models';

export interface CreateVaultItemInput {
  userId: string;
  kind: VaultKind;
  value: string;
  label?: string | null;
  detail?: DocumentDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export interface UpdateVaultItemInput {
  value?: string;
  label?: string | null;
  detail?: DocumentDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export interface VaultRepository {
  listForUser(userId: string): Promise<VaultItem[]>;
  listByKind(userId: string, kind: VaultKind): Promise<VaultItem[]>;
  findByIds(userId: string, ids: string[]): Promise<VaultItem[]>;
  create(input: CreateVaultItemInput): Promise<VaultItem>;
  update(userId: string, id: string, patch: UpdateVaultItemInput): Promise<VaultItem>;
  delete(userId: string, id: string): Promise<void>;
  // Clears the default flag on every item of the kind (before setting a new one).
  clearDefault(userId: string, kind: VaultKind): Promise<void>;
}
