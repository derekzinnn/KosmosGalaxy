import { z } from 'zod';
import { AuditAction, AuditEntity } from '../services/audit.actions.js';

const actionValues = Object.values(AuditAction) as [string, ...string[]];
const entityValues = Object.values(AuditEntity) as [string, ...string[]];

/**
 * Query parameters for the audit viewer.
 *
 * Everything is optional: with nothing set the endpoint returns the newest
 * page of the whole ledger. `action` and `entityType` are validated against
 * the known sets so a typo comes back as a 422 rather than an always-empty
 * result the caller has to puzzle over.
 *
 * Pagination is keyset, not offset. The cursor is the `id` of the last row
 * already seen — and because ids are UUIDv7, ordering by id descending is the
 * same as newest-first, so a page cannot skip or repeat a row when new entries
 * land between requests the way an offset would.
 */
export const listAuditLogsSchema = z.object({
  action: z.enum(actionValues).optional(),
  entityType: z.enum(entityValues).optional(),
  tenantId: z.string().trim().min(1).max(64).optional(),
  actorUserId: z.string().trim().min(1).max(64).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  /** Inclusive lower bound on `createdAt`. */
  from: z.iso.datetime({ offset: true }).optional(),
  /** Exclusive upper bound on `createdAt`. */
  to: z.iso.datetime({ offset: true }).optional(),
  /** The `id` of the last row from the previous page. */
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
