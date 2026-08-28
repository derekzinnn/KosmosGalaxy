import type { Prisma } from '../generated/prisma/client.js';
import type { ScopedDb } from '../db/scoped-db.js';

/**
 * The per-client drill-down reads, every one of them tenant-scoped.
 *
 * The caller runs these inside `runAsSuperadminOnTenant`, so the ScopedDb is
 * pinned to one tenant and the guard filters `user`, `lessonProgress` and
 * `trackAssignment` automatically. Content (track/module/lesson) carries no
 * tenant column, so it is reached **through the assignment** — the guarded
 * side of the relation — never through `track.findMany`, per CLAUDE.md's
 * "Known limits".
 */

export function findClientTenant(
  db: ScopedDb,
  tenantId: string,
): Promise<Prisma.TenantModel | null> {
  return db.tenant.findFirst({ where: { id: tenantId } });
}

export interface ClientMemberRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
  readonly lastLoginAt: Date | null;
}

/** Client accounts only, and never the password hash. */
export function listClientMembers(db: ScopedDb): Promise<ClientMemberRow[]> {
  return db.user.findMany({
    where: { role: { in: ['CLIENT_OWNER', 'CLIENT_MEMBER'] } },
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Every track this client was assigned, with its modules and lessons — read
 * through `trackAssignment` so the tenant filter is one the guard can see.
 * Not limited to published: a track unpublished after assignment still counts
 * for the people who were working through it.
 */
export function listClientAssignedTracks(db: ScopedDb) {
  return db.trackAssignment.findMany({
    include: {
      track: {
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: { lessons: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export interface ClientProgressRow {
  readonly userId: string;
  readonly lessonId: string;
  readonly completedAt: Date | null;
  readonly maxPositionSeconds: number;
  readonly updatedAt: Date;
}

export function listClientProgress(db: ScopedDb): Promise<ClientProgressRow[]> {
  return db.lessonProgress.findMany({
    select: {
      userId: true,
      lessonId: true,
      completedAt: true,
      maxPositionSeconds: true,
      updatedAt: true,
    },
  });
}
