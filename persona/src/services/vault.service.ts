import { BLOOD_TYPES, DOCUMENT_TYPES, EPS_PROVIDERS } from '../constants/catalog';
import { KIND_META } from '../constants/vault';
import { ConflictError, ValidationError } from '../domain/errors';
import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
} from '../domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../domain/interfaces/unit-of-work';
import { DocumentDetail, NameContext, VaultItem, VaultKind } from '../domain/models';

// A vault item as the API returns it: the stored fields plus the sensitivity
// derived from the kind.
export interface VaultItemView extends VaultItem {
  sensitive: boolean;
}

export interface NewVaultItem {
  kind: VaultKind;
  value: string;
  label?: string | null;
  detail?: DocumentDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export interface VaultItemPatch {
  value?: string;
  label?: string | null;
  detail?: DocumentDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export interface VaultService {
  list(userId: string): Promise<VaultItemView[]>;
  addItem(userId: string, input: NewVaultItem): Promise<VaultItemView>;
  updateItem(userId: string, id: string, patch: VaultItemPatch): Promise<VaultItemView>;
  removeItem(userId: string, id: string): Promise<void>;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Kind-specific rules shared by create and update: catalog codes for coded
// kinds, a full detail block for documents, name contexts only on names.
function validateForKind(
  kind: VaultKind,
  payload: { value?: string; detail?: DocumentDetail | null; nameContext?: NameContext | null },
): void {
  const fields: Record<string, string> = {};

  if (payload.value !== undefined) {
    if (kind === 'blood_type' && !(BLOOD_TYPES as readonly string[]).includes(payload.value)) {
      fields.value = `must be one of: ${BLOOD_TYPES.join(', ')}`;
    }
    if (kind === 'eps' && !(EPS_PROVIDERS as readonly string[]).includes(payload.value)) {
      fields.value = `must be one of: ${EPS_PROVIDERS.join(', ')}`;
    }
    if (kind === 'birth_date' && !DATE_PATTERN.test(payload.value)) {
      fields.value = 'must be a date in YYYY-MM-DD format';
    }
    if (kind === 'email' && !payload.value.includes('@')) {
      fields.value = 'must be an email address';
    }
  }

  if (kind === 'document') {
    if (payload.value !== undefined && payload.detail === undefined) {
      fields.detail = 'a document needs its detail (type, issueDate, issuePlace)';
    }
    if (payload.detail != null) {
      if (!(DOCUMENT_TYPES as readonly string[]).includes(payload.detail.type)) {
        fields['detail.type'] = `must be one of: ${DOCUMENT_TYPES.join(', ')}`;
      }
      if (!DATE_PATTERN.test(payload.detail.issueDate)) {
        fields['detail.issueDate'] = 'must be a date in YYYY-MM-DD format';
      }
      if (!payload.detail.issuePlace) {
        fields['detail.issuePlace'] = 'is required';
      }
    }
  } else if (payload.detail != null) {
    fields.detail = 'only document items carry a detail';
  }

  if (payload.nameContext != null && kind !== 'name') {
    fields.nameContext = 'only name items carry a name context';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError('Validation failed', fields);
  }
}

export class VaultServiceImpl implements VaultService {
  constructor(
    private readonly repositories: Repositories,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  private toView(item: VaultItem): VaultItemView {
    return { ...item, sensitive: KIND_META[item.kind].sensitive };
  }

  async list(userId: string): Promise<VaultItemView[]> {
    const items = await this.repositories.vault.listForUser(userId);
    return items.map((item) => this.toView(item));
  }

  async addItem(userId: string, input: NewVaultItem): Promise<VaultItemView> {
    validateForKind(input.kind, input);

    const item = await this.unitOfWork.run(async (repos) => {
      const existing = await repos.vault.listByKind(userId, input.kind);
      if (!KIND_META[input.kind].multi && existing.length > 0) {
        throw new ConflictError(
          `Only one ${input.kind} value is allowed — edit the existing one`,
          'SINGLE_VALUE_KIND',
        );
      }

      // The first value of a kind becomes the default automatically.
      const isDefault = input.isDefault || existing.length === 0;
      if (isDefault) {
        await repos.vault.clearDefault(userId, input.kind);
      }
      return repos.vault.create({ ...input, userId, isDefault } as CreateVaultItemInput);
    });

    return this.toView(item);
  }

  async updateItem(userId: string, id: string, patch: VaultItemPatch): Promise<VaultItemView> {
    const item = await this.unitOfWork.run(async (repos) => {
      const [existing] = await repos.vault.findByIds(userId, [id]);
      if (!existing) {
        // Let the repository raise its not-found error consistently.
        return repos.vault.update(userId, id, {});
      }

      validateForKind(existing.kind, patch);

      if (patch.isDefault === true) {
        await repos.vault.clearDefault(userId, existing.kind);
      }
      return repos.vault.update(userId, id, patch as UpdateVaultItemInput);
    });

    return this.toView(item);
  }

  async removeItem(userId: string, id: string): Promise<void> {
    await this.unitOfWork.run(async (repos) => {
      const [existing] = await repos.vault.findByIds(userId, [id]);
      if (!existing) {
        await repos.vault.delete(userId, id);
        return;
      }

      await repos.vault.delete(userId, id);

      // Keep one default while values remain: promote the oldest survivor.
      if (existing.isDefault) {
        const remaining = await repos.vault.listByKind(userId, existing.kind);
        if (remaining.length > 0) {
          await repos.vault.update(userId, remaining[0].id, { isDefault: true });
        }
      }
    });
  }
}
