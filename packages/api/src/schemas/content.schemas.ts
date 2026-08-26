import { z } from 'zod';

const title = z.string().trim().min(2, 'Informe um título').max(160, 'O título é longo demais');
const description = z.string().trim().max(2000, 'A descrição é longa demais').nullish();

export const createTrackSchema = z.object({
  title,
  /**
   * Optional. Left out, it is derived from the title and made unique. Given
   * explicitly, it is never silently altered — a link that was shared and then
   * changed underneath is worse than a rejected request.
   */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens')
    .nullish(),
  description,
});

export const updateTrackSchema = z
  .object({ title: title.optional(), description })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualizar',
  });

export const moduleSchema = z.object({ title, description });

export const updateModuleSchema = z
  .object({ title: title.optional(), description })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualizar',
  });

export const lessonSchema = z.object({
  title,
  description,
  /** The video provider's own identifier. Phase 2 turns it into a signed URL. */
  externalVideoId: z.string().trim().min(1).max(200).nullish(),
  durationSeconds: z.number().int().positive().max(86_400).nullish(),
  isRequired: z.boolean().optional(),
});

export const updateLessonSchema = lessonSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualizar',
  });

export const resourceSchema = z.object({
  type: z.enum(['FILE', 'LINK']),
  title,
  url: z.url('Informe um endereço válido').max(2000),
  fileSizeBytes: z.number().int().nonnegative().nullish(),
});

/**
 * A reorder names the complete new order, not a single move.
 *
 * Sending "move item 3 to position 1" would need the server to guess what the
 * client believed the rest of the list looked like. Sending the whole list
 * makes a stale view detectable: the service rejects any set that does not
 * match exactly what exists.
 */
export const reorderSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1, 'Informe a nova ordem').max(500),
});

export const assignTrackSchema = z.object({
  tenantId: z.uuid(),
});

export type CreateTrackBody = z.infer<typeof createTrackSchema>;
export type UpdateTrackBody = z.infer<typeof updateTrackSchema>;
export type ModuleBody = z.infer<typeof moduleSchema>;
export type UpdateModuleBody = z.infer<typeof updateModuleSchema>;
export type LessonBody = z.infer<typeof lessonSchema>;
export type UpdateLessonBody = z.infer<typeof updateLessonSchema>;
export type ResourceBody = z.infer<typeof resourceSchema>;
export type ReorderBody = z.infer<typeof reorderSchema>;
export type AssignTrackBody = z.infer<typeof assignTrackSchema>;
