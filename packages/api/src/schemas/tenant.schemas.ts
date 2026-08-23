import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa').max(160),
  /**
   * A short URL-safe identifier for the company. Lowercase letters, digits and
   * single hyphens only, so it can appear in a link without being escaped.
   */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens'),
  contractSignedAt: z.iso.datetime({ offset: true }).nullish(),
});

export type CreateTenantBody = z.infer<typeof createTenantSchema>;
