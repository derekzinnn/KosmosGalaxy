import type { Role } from '../generated/prisma/enums.js';
import { runInGlobalScope } from '../db/scoped-db.js';
import { ForbiddenError } from '../lib/errors.js';
import { listAuditLogs } from '../repositories/audit.repository.js';
import type { ListAuditLogsQuery } from '../schemas/audit.schemas.js';
import type { RequestContext } from '../types/request-context.js';

/**
 * One line of the ledger, shaped for reading.
 *
 * The actor is a snapshot — `actorEmail` and `actorRole` were copied in when
 * the row was written, so they survive the user later being renamed or
 * deleted, which is the whole point of an audit log. `tenantName` is resolved
 * at read time for display and may be null if that company was since removed.
 */
export interface AuditLogEntry {
  readonly id: string;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly actorEmail: string | null;
  readonly actorRole: Role | null;
  readonly tenantId: string | null;
  readonly tenantName: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

export interface AuditLogList {
  readonly entries: AuditLogEntry[];
  /** Pass back as `cursor` to fetch the next page; null when the list ends. */
  readonly nextCursor: string | null;
}

/**
 * Read the audit log. Kosmos staff only.
 *
 * The log spans every tenant and many rows have no tenant at all (a superadmin
 * override, a failed login before any tenant is known), so this is a global
 * read by nature — there is nothing to scope it to. The route restricts it to
 * SUPERADMIN and this re-checks, because the service is where the security
 * boundary lives and a future caller might reach it another way.
 *
 * Tenant names are looked up once per page rather than joined: the ledger
 * carries no foreign key (see the AuditLog decision in CLAUDE.md), so the
 * names are resolved here from the ids the page happens to contain.
 */
export function listAuditLog(
  context: RequestContext,
  query: ListAuditLogsQuery,
): Promise<AuditLogList> {
  if (context.role !== 'SUPERADMIN') {
    throw new ForbiddenError('Only Kosmos staff can read the audit log', 'FORBIDDEN_SCOPE');
  }

  return runInGlobalScope('superadmin:audit-read', async (db) => {
    const rows = await listAuditLogs(
      db.raw,
      {
        action: query.action,
        entityType: query.entityType,
        tenantId: query.tenantId,
        actorUserId: query.actorUserId,
        entityId: query.entityId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      { cursor: query.cursor, limit: query.limit },
    );

    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((id): id is string => !!id))];
    const names = new Map<string, string>();
    if (tenantIds.length > 0) {
      const tenants = await db.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      });
      for (const tenant of tenants) names.set(tenant.id, tenant.name);
    }

    const entries = rows.map<AuditLogEntry>((row) => ({
      id: row.id,
      action: row.action,
      actorUserId: row.actorUserId,
      actorEmail: row.actorEmail,
      actorRole: row.actorRole,
      tenantId: row.tenantId,
      tenantName: row.tenantId ? (names.get(row.tenantId) ?? null) : null,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before ?? null,
      after: row.after ?? null,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
    }));

    // A full page implies there may be more; a short one is the end. The cursor
    // is the last id seen, which the next request steps past.
    const nextCursor =
      entries.length === query.limit ? (entries[entries.length - 1]?.id ?? null) : null;

    return { entries, nextCursor };
  });
}
