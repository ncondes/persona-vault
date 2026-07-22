import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
  VaultRepository,
} from '../domain/interfaces/vault.repository';
import { NotFoundError } from '../domain/errors';
import { DocumentDetail, VaultItem, VaultKind } from '../domain/models';
import { DbClient } from '../infrastructure/db/db-client';
import { Prisma } from '../generated/prisma/client';

// Prisma stores `detail` as Json; the domain types it as DocumentDetail.
function toItem(row: Omit<VaultItem, 'detail'> & { detail: unknown }): VaultItem {
  return { ...row, detail: (row.detail as DocumentDetail | null) ?? null };
}

function toJson(detail: DocumentDetail | null | undefined): Prisma.InputJsonValue | undefined {
  return detail == null ? undefined : (detail as unknown as Prisma.InputJsonValue);
}

export class PrismaVaultRepository implements VaultRepository {
  constructor(private readonly db: DbClient) {}

  async listForUser(userId: string): Promise<VaultItem[]> {
    const rows = await this.db.vaultItem.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toItem);
  }

  async listByKind(userId: string, kind: VaultKind): Promise<VaultItem[]> {
    const rows = await this.db.vaultItem.findMany({
      where: { userId, kind },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toItem);
  }

  async findByIds(userId: string, ids: string[]): Promise<VaultItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.vaultItem.findMany({ where: { userId, id: { in: ids } } });
    return rows.map(toItem);
  }

  async create(input: CreateVaultItemInput): Promise<VaultItem> {
    const row = await this.db.vaultItem.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        value: input.value,
        label: input.label ?? null,
        detail: toJson(input.detail),
        isDefault: input.isDefault ?? false,
        nameContext: input.nameContext ?? null,
      },
    });
    return toItem(row);
  }

  async update(userId: string, id: string, patch: UpdateVaultItemInput): Promise<VaultItem> {
    const { count } = await this.db.vaultItem.updateMany({
      where: { id, userId },
      data: {
        value: patch.value,
        label: patch.label,
        detail: toJson(patch.detail),
        isDefault: patch.isDefault,
        nameContext: patch.nameContext,
      },
    });
    if (count === 0) {
      throw new NotFoundError('Vault item not found', 'VAULT_ITEM_NOT_FOUND');
    }
    const row = await this.db.vaultItem.findUnique({ where: { id } });
    return toItem(row!);
  }

  async delete(userId: string, id: string): Promise<void> {
    const { count } = await this.db.vaultItem.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new NotFoundError('Vault item not found', 'VAULT_ITEM_NOT_FOUND');
    }
  }

  async clearDefault(userId: string, kind: VaultKind): Promise<void> {
    await this.db.vaultItem.updateMany({
      where: { userId, kind, isDefault: true },
      data: { isDefault: false },
    });
  }
}
