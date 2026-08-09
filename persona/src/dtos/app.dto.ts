import { z } from 'zod';
import { ALL_SCOPES, PURPOSES } from '../constants/scopes';

const scopeSchema = z.enum(ALL_SCOPES as [string, ...string[]]);
const purposeSchema = z.enum(PURPOSES);

// A fragment would never survive the redirect, and the OIDC layer matches
// redirect URIs by exact string, so it is rejected up front.
const redirectUriSchema = z
  .string()
  .url()
  .refine((value) => !value.includes('#'), { message: 'must not contain a fragment' });

const appFields = {
  name: z.string().min(1).max(60),
  description: z.string().max(200).nullish(),
  purpose: purposeSchema,
  accent: z.string().min(1).max(20),
  allowedScopes: z.array(scopeSchema).min(1),
  requiredScopes: z.array(scopeSchema),
  redirectUris: z.array(redirectUriSchema).min(1).max(5),
};

export const createAppSchema = z
  .object(appFields)
  .partial({ description: true, accent: true, requiredScopes: true })
  .strict();

export const updateAppSchema = z
  .object({ ...appFields, status: z.enum(['active', 'disabled']) })
  .partial()
  .strict();

export const previewAppSchema = z
  .object({ purpose: purposeSchema, scopes: z.array(scopeSchema) })
  .strict();

export type CreateAppDto = z.infer<typeof createAppSchema>;
export type UpdateAppDto = z.infer<typeof updateAppSchema>;
export type PreviewAppDto = z.infer<typeof previewAppSchema>;
