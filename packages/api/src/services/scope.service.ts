import { AsyncLocalStorage } from 'node:async_hooks';
import type { ScopedDb } from '../db/scoped-db.js';
import { runInGlobalScope, runInTenantScope } from '../db/scoped-db.js';
import { ForbiddenError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { RequestContext } from '../types/request-context.js';
import { metadataOf } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { auditDetached } from './audit.service.js';

/**
 * Remembers which scope overrides have already been recorded for the request
 * currently in flight, so one admin action produces one audit row rather than
 * one per query it happens to run.
 */
const recordedOverrides = new AsyncLocalStorage<Set<string>>();

export function withScopeOverrideTracking<T>(fn: () => T): T {
  return recordedOverrides.run(new Set<string>(), fn);
}

/**
 * Run work as the caller, in the scope their role implies.
 *
 * A client user is pinned to their own tenant. Kosmos staff have no tenant of
 * their own, so they run globally — this is their normal job, not an override,
 * and it is deliberately not audited. Listing every client on the admin
 * dashboard would otherwise write an audit row on every page load, and a log
 * that is 95% noise is a log nobody reads.
 */
export function runAsContext<T>(
  context: RequestContext,
  fn: (db: ScopedDb) => Promise<T>,
): Promise<T> {
  if (context.role === 'SUPERADMIN') {
    return runInGlobalScope('superadmin:own-role', fn);
  }

  if (!context.tenantId) {
    // The database CHECK constraint makes this unreachable; if it ever fires,
    // something is very wrong and denying access is the only safe answer.
    throw new ForbiddenError('Account has no tenant assigned', 'TENANT_MISSING');
  }

  return runInTenantScope(context.tenantId, fn);
}

/**
 * Kosmos staff deliberately reaching into one named client's data.
 *
 * This is the audited act: not "an admin looked at the dashboard", but "an
 * admin opened Tenant X". Recorded once per request per target tenant, with
 * who, when, from where, and why.
 */
export async function runAsSuperadminOnTenant<T>(
  context: RequestContext,
  tenantId: string,
  reason: string,
  fn: (db: ScopedDb) => Promise<T>,
): Promise<T> {
  if (context.role !== 'SUPERADMIN') {
    throw new ForbiddenError('Only Kosmos staff can access another tenant', 'FORBIDDEN_SCOPE');
  }

  const key = `${tenantId}:${reason}`;
  const alreadyRecorded = recordedOverrides.getStore();

  if (!alreadyRecorded?.has(key)) {
    alreadyRecorded?.add(key);

    logger.info(
      { actorUserId: context.userId, tenantId, reason },
      'Superadmin overrode tenant scope',
    );

    // Detached: an attempted access is worth recording even if the work that
    // followed it failed and rolled back.
    await auditDetached({
      action: AuditAction.TENANT_SCOPE_OVERRIDDEN,
      actor: { id: context.userId, email: context.email, role: context.role },
      tenantId,
      entityType: AuditEntity.TENANT,
      entityId: tenantId,
      after: { reason },
      request: metadataOf(context),
    });
  }

  return runInTenantScope(tenantId, fn);
}
