import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    confirmSensitive: z.boolean().optional(),
    notifyAccess: z.boolean().optional(),
  })
  .strict();

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
