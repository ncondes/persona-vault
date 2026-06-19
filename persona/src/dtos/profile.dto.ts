import { z } from 'zod';

const fieldSchema = z.object({
  value: z.string().min(1),
  sensitive: z.boolean().optional(),
});

// A partial update: only the name variants and fields provided are changed.
// `.strict()` rejects unknown keys (e.g. a misspelled name variant).
export const updateProfileSchema = z
  .object({
    names: z
      .object({
        legal: z.string().min(1).optional(),
        preferred: z.string().min(1).optional(),
        professional: z.string().min(1).optional(),
        public: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    fields: z
      .object({
        email: fieldSchema.optional(),
        phone: fieldSchema.optional(),
        address: fieldSchema.optional(),
        dob: fieldSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
