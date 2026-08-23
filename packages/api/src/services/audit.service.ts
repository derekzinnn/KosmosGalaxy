import type { Prisma } from '../generated/prisma/client.js';
import type { Role } from '../generated/prisma/enums.js';
import type { DbClient } from '../db/prisma.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import type { RequestMetadata } from '../types/request-context.js';
import type { AuditActionValue, AuditEntityValue } from './audit.actions.js';

export interface AuditActor {
  readonly id: string | null;
  readonly email: string | null;
  readonly role: Role | null;
}

export interface AuditInput {
  readonly action: AuditActionValue;
  readonly actor?: AuditActor;
  readonly tenantId?: string | null;
  readonly entityType?: AuditEntityValue;
  readonly entityId?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly request?: RequestMetadata;
}

/**
 * Field names that must never reach the audit log. The log is append-only,
 * so a secret written here cannot be deleted afterwards — the only safe move
 * is not to write it in the first place.
 */
const FORBIDDEN_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'passwordhash',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'secret',
  'authorization',
  'cookie',
]);

/**
 * Write an audit entry using the caller's own database handle.
 *
 * Pass the transaction client and the entry shares the fate of the action it
 * describes: if the action rolls back, so does its log line. There is no way
 * to end up with "we recorded that we created the user" and no user.
 */
export async function audit(client: DbClient, input: AuditInput): Promise<void> {
  await client.auditLog.create({ data: toRow(input) });
}

/**
 * Write an audit entry in its own transaction, independently of whatever the
 * caller is doing.
 *
 * This exists for one specific reason. A failed login must be recorded and
 * then rejected — but if the rejection threw inside the same transaction as
 * the log line, the rollback would erase the evidence of the attempt. Failure
 * events therefore commit on their own.
 *
 * It never throws: a logging problem must not turn into a 500 on a request
 * that was otherwise handled correctly. It is logged loudly instead.
 */
export async function auditDetached(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: toRow(input) });
  } catch (error) {
    logger.error(
      { error, action: input.action, tenantId: input.tenantId },
      'Failed to write detached audit entry',
    );
  }
}

function toRow(input: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  const row: Prisma.AuditLogUncheckedCreateInput = {
    action: input.action,
    actorUserId: input.actor?.id ?? null,
    actorEmail: input.actor?.email ?? null,
    actorRole: input.actor?.role ?? null,
    tenantId: input.tenantId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    ip: input.request?.ip ?? null,
    userAgent: input.request?.userAgent ?? null,
  };

  const before = sanitize(input.before);
  const after = sanitize(input.after);

  if (before !== undefined) row.before = before;
  if (after !== undefined) row.after = after;

  return row;
}

/**
 * Deep-copy a value for storage, dropping anything that looks like a secret
 * and anything Postgres cannot represent as JSON.
 */
function sanitize(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  const cleaned = clean(value, 0);
  return cleaned as Prisma.InputJsonValue;
}

function clean(value: unknown, depth: number): unknown {
  if (depth > 6) return '[truncated]';

  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = FORBIDDEN_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : clean(item, depth + 1);
    }
    return output;
  }

  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
}

/**
 * There is deliberately no updateAudit, deleteAudit or purgeAudit function in
 * this file or anywhere else in the codebase. The database rejects both
 * operations (see prisma/migrations/*_phase0_guarantees), ESLint forbids
 * calling them, and this comment exists so nobody adds one by accident.
 */
