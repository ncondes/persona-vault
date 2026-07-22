import { z } from 'zod';
import { VAULT_KINDS } from '../constants/vault';
import { VaultKind } from '../domain/models';

const kindSchema = z.enum(VAULT_KINDS as [VaultKind, ...VaultKind[]]);

const nameContextSchema = z.enum(['legal', 'preferred', 'professional', 'public']);

const detailSchema = z.object({
  type: z.string().min(1),
  issueDate: z.string().min(1),
  issuePlace: z.string().min(1),
});

// Structural checks only; kind-specific rules (catalog codes, document detail)
// live in the vault service, which also covers updates.
export const createVaultItemSchema = z
  .object({
    kind: kindSchema,
    value: z.string().min(1),
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
