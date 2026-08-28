import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from '../db/prisma.js';

export interface AuditLogFilters {
  readonly action?: string;
  readonly entityType?: string;
  readonly tenantId?: string;
  readonly actorUserId?: string;
  readonly entityId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface AuditLogPage {
  readonly cursor?: string;
  readonly limit: number;
}

/**
 * Reads from the append-only ledger. There is no write path here on purpose —
 * `audit.service.ts` owns the one way a row is ever created, and the database
 * refuses UPDATE and DELETE outright.
 *
 * `AuditLog` carries no tenant column the guard checks, so this queries the
 * base client directly; the route restricts the whole thing to Kosmos staff.
 * Ordering is by `id` descending: ids are UUIDv7, so that is newest-first and
 * gives keyset pagination a stable, index-backed cursor.
 */
export function listAuditLogs(
  client: DbClient,
  filters: AuditLogFilters,
  page: AuditLogPage,
): Promise<Prisma.AuditLogModel[]> {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.tenantId) where.tenantId = filters.tenantId;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.entityId) where.entityId = filters.entityId;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lt: filters.to } : {}),
    };
  }

  return client.auditLog.findMany({
    where,
    orderBy: { id: 'desc' },
    take: page.limit,
    // `skip: 1` steps past the cursor row itself, which the caller already has.
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
}
