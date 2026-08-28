import type { DbClient } from '../db/prisma.js';

/**
 * The raw materials the onboarding funnel is assembled from.
 *
 * Every function here reads across all tenants, so callers must run them in a
 * global scope — the funnel is a Kosmos-staff overview by definition. The
 * assembly (who is at which stage) lives in the service; this file only pulls
 * the columns that assembly needs, and nothing more, so the queries stay cheap
 * enough to run on every dashboard load.
 */

export interface FunnelTenantRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: Date;
}

export function listFunnelTenants(db: DbClient): Promise<FunnelTenantRow[]> {
  return db.tenant.findMany({
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
}

export interface FunnelUserRow {
  readonly tenantId: string | null;
  readonly lastLoginAt: Date | null;
}

/** Client accounts only — Kosmos staff have no tenant and are not onboarded. */
export function listFunnelClientUsers(db: DbClient): Promise<FunnelUserRow[]> {
  return db.user.findMany({
    where: { role: { in: ['CLIENT_OWNER', 'CLIENT_MEMBER'] } },
    select: { tenantId: true, lastLoginAt: true },
  });
}

export interface FunnelAssignmentRow {
  readonly tenantId: string;
  readonly trackId: string;
}

export function listFunnelAssignments(db: DbClient): Promise<FunnelAssignmentRow[]> {
  return db.trackAssignment.findMany({ select: { tenantId: true, trackId: true } });
}

/**
 * One row per required lesson, carrying the track it belongs to (through its
 * module). Counted per track by the service to learn how many lessons a client
 * must finish to be "done" with a track they were assigned.
 */
export function listRequiredLessonTracks(db: DbClient): Promise<{ trackId: string }[]> {
  return db.lesson
    .findMany({
      where: { isRequired: true },
      select: { module: { select: { trackId: true } } },
    })
    .then((rows) => rows.map((row) => ({ trackId: row.module.trackId })));
}

export interface FunnelProgressRow {
  readonly tenantId: string;
  readonly completedAt: Date | null;
  readonly updatedAt: Date;
}

export function listFunnelProgress(db: DbClient): Promise<FunnelProgressRow[]> {
  return db.lessonProgress.findMany({
    select: { tenantId: true, completedAt: true, updatedAt: true },
  });
}
