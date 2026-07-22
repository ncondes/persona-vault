import { z } from 'zod';
import { VAULT_KINDS } from '../constants/vault';
import { VaultKind } from '../domain/models';

const kindSchema = z.enum(VAULT_KINDS as [VaultKind, ...VaultKind[]]);

const nameContextSchema = z.enum(['legal', 'preferred', 'professional', 'public']);

// Details are flat string maps (name, phone, address or document parts); the
// vault service enforces the kind-specific shape and catalog codes. Composed
// kinds (name, phone, address) derive `value` server-side.
const detailSchema = z.record(z.string(), z.string());

export const createVaultItemSchema = z
  .object({
    kind: kindSchema,
    value: z.string().min(1).optional(),
    label: z.string().min(1).max(60).nullish(),
    detail: detailSchema.nullish(),
    isDefault: z.boolean().optional(),
    nameContext: nameContextSchema.nullish(),
  })
  .strict();

export const updateVaultItemSchema = z
  .object({
    value: z.string().min(1).optional(),
    label: z.string().min(1).max(60).nullish(),
    detail: detailSchema.nullish(),
    isDefault: z.boolean().optional(),
    nameContext: nameContextSchema.nullish(),
  })
  .strict();

export type CreateVaultItemDto = z.infer<typeof createVaultItemSchema>;
export type UpdateVaultItemDto = z.infer<typeof updateVaultItemSchema>;
