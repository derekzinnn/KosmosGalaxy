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

/**
 * Renaming a client. Only the display name changes — the slug is deliberately
 * left alone, because it is the stable identifier a shared link points at (see
 * the slug decision in Phase 1).
 */
export const updateTenantSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa').max(160),
});

export type UpdateTenantBody = z.infer<typeof updateTenantSchema>;
