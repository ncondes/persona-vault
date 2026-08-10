import { BLOOD_TYPES, COUNTRIES, DOCUMENT_TYPES, EPS_PROVIDERS } from '../constants/catalog';
import { FIELD_ERRORS } from '../constants/field-errors';
import { KIND_META } from '../constants/vault';
import { ConflictError, ValidationError } from '../domain/errors';
import {
  CreateVaultItemInput,
  UpdateVaultItemInput,
} from '../domain/interfaces/vault.repository';
import { Repositories, UnitOfWork } from '../domain/interfaces/unit-of-work';
import {
  AddressDetail,
  DocumentDetail,
  ItemDetail,
  NameContext,
  NameDetail,
  PhoneDetail,
  VaultItem,
  VaultKind,
} from '../domain/models';

// A vault item as the API returns it: the stored fields plus the sensitivity
// derived from the kind.
export interface VaultItemView extends VaultItem {
  sensitive: boolean;
}

export interface NewVaultItem {
  kind: VaultKind;
  value?: string;
  label?: string | null;
  detail?: ItemDetail | null;
  isDefault?: boolean;
  nameContext?: NameContext | null;
}

export interface VaultItemPatch {
  value?: string;
  label?: string | null;
  detail?: ItemDetail | null;
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

// The shape alone would accept 2025-13-45, so the parsed date has to round-trip
// back to the same string — that rules out impossible months and days, and the
// silent rollover Date does for them.
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}
const DIAL_CODES = new Set<string>(COUNTRIES.map((c) => c.dial));
const COUNTRY_CODES = new Set<string>(COUNTRIES.map((c) => c.code));

// Kinds whose parts live in `detail`; their `value` is composed from them.
const COMPOSED_KINDS: VaultKind[] = ['name', 'phone', 'address'];

function composeValue(kind: VaultKind, detail: ItemDetail): string {
  if (kind === 'name') {
    const name = detail as NameDetail;
    return `${name.firstName} ${name.lastName}`.trim();
  }
  if (kind === 'phone') {
    const phone = detail as PhoneDetail;
    return `${phone.countryCode} ${phone.number}`.trim();
  }
  const address = detail as AddressDetail;
  return [address.line1, address.line2, address.line3, address.city].filter(Boolean).join(', ');
}

// Kind-specific rules shared by create and update: catalog codes for coded
// kinds, a complete detail block for structured kinds, name contexts only on
// names. Returns field errors instead of throwing so callers can aggregate.
function validateForKind(
  kind: VaultKind,
  payload: { value?: string; detail?: ItemDetail | null; nameContext?: NameContext | null },
): Record<string, string> {
  const fields: Record<string, string> = {};
  const detail = (payload.detail ?? undefined) as Record<string, string | undefined> | undefined;

  if (payload.value !== undefined) {
    if (kind === 'blood_type' && !(BLOOD_TYPES as readonly string[]).includes(payload.value)) {
      fields.value = FIELD_ERRORS.NOT_ALLOWED;
    }
    if (kind === 'eps' && !(EPS_PROVIDERS as readonly string[]).includes(payload.value)) {
      fields.value = FIELD_ERRORS.NOT_ALLOWED;
    }
    if (kind === 'birth_date' && !isCalendarDate(payload.value)) {
      fields.value = FIELD_ERRORS.INVALID_DATE;
    }
    if (kind === 'email' && !payload.value.includes('@')) {
      fields.value = FIELD_ERRORS.INVALID_EMAIL;
    }
  }

  if (kind === 'name' && detail) {
    if (!detail.firstName) fields['detail.firstName'] = FIELD_ERRORS.REQUIRED;
    if (!detail.lastName) fields['detail.lastName'] = FIELD_ERRORS.REQUIRED;
  }

  if (kind === 'phone' && detail) {
    if (!detail.countryCode || !DIAL_CODES.has(detail.countryCode)) {
      fields['detail.countryCode'] = FIELD_ERRORS.NOT_ALLOWED;
    }
    if (!detail.number) fields['detail.number'] = FIELD_ERRORS.REQUIRED;
  }

  if (kind === 'address' && detail) {
    if (!detail.line1) fields['detail.line1'] = FIELD_ERRORS.REQUIRED;
    if (!detail.city) fields['detail.city'] = FIELD_ERRORS.REQUIRED;
    if (!detail.country || !COUNTRY_CODES.has(detail.country)) {
      fields['detail.country'] = FIELD_ERRORS.NOT_ALLOWED;
    }
  }

  if (kind === 'document') {
    if (payload.value !== undefined && detail === undefined) {
      fields.detail = FIELD_ERRORS.REQUIRED;
    }
    if (detail) {
      if (!detail.type || !(DOCUMENT_TYPES as readonly string[]).includes(detail.type)) {
        fields['detail.type'] = FIELD_ERRORS.NOT_ALLOWED;
      }
      if (!detail.issueDate || !isCalendarDate(detail.issueDate)) {
        fields['detail.issueDate'] = FIELD_ERRORS.INVALID_DATE;
      }
      if (!detail.issuePlace) {
        fields['detail.issuePlace'] = FIELD_ERRORS.REQUIRED;
      }
    }
  }

  const structured: VaultKind[] = [...COMPOSED_KINDS, 'document'];
  if (!structured.includes(kind) && detail) {
    fields.detail = FIELD_ERRORS.NOT_APPLICABLE;
  }

  if (payload.nameContext != null && kind !== 'name') {
    fields.nameContext = FIELD_ERRORS.NOT_APPLICABLE;
  }

  return fields;
}

function assertValid(fields: Record<string, string>): void {
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

  async addItem(userId: string, input: NewVaultItem): Promise<VaultItemView> {
    const fields = validateForKind(input.kind, input);
    if (COMPOSED_KINDS.includes(input.kind) && !input.detail) {
      fields.detail = FIELD_ERRORS.REQUIRED;
    }
    if (!COMPOSED_KINDS.includes(input.kind) && !input.value) {
      fields.value = FIELD_ERRORS.REQUIRED;
    }
    assertValid(fields);

    const value = COMPOSED_KINDS.includes(input.kind)
      ? composeValue(input.kind, input.detail!)
      : input.value!;

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
      return repos.vault.create({ ...input, userId, value, isDefault } as CreateVaultItemInput);
    });

    return this.toView(item);
  }

  async list(userId: string): Promise<VaultItemView[]> {
    const items = await this.repositories.vault.listForUser(userId);
    return items.map((item) => this.toView(item));
  }

  async updateItem(userId: string, id: string, patch: VaultItemPatch): Promise<VaultItemView> {
    const item = await this.unitOfWork.run(async (repos) => {
      const [existing] = await repos.vault.findByIds(userId, [id]);
      if (!existing) {
        // Let the repository raise its not-found error consistently.
        return repos.vault.update(userId, id, {});
      }

      assertValid(validateForKind(existing.kind, patch));

      const applied: UpdateVaultItemInput = { ...patch };
      if (COMPOSED_KINDS.includes(existing.kind) && patch.detail) {
        applied.value = composeValue(existing.kind, patch.detail);
      }

      if (patch.isDefault === true) {
        await repos.vault.clearDefault(userId, existing.kind);
      }
      return repos.vault.update(userId, id, applied);
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
