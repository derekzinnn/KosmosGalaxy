import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from '../db/prisma.js';
import type { ScopedDb } from '../db/scoped-db.js';

/**
 * TrackAssignment is the only tenant-scoped model in the content area, which
 * makes it the safe door into a client's view of the library. Reads that must
 * be limited to one company start here and reach the track through the
 * relation, so the tenant guard sees — and checks — the filter.
 */

export function createAssignment(
  db: ScopedDb,
  input: { trackId: string; tenantId: string; assignedByUserId: string | null },
): Promise<Prisma.TrackAssignmentModel> {
  return db.trackAssignment.create({
    trackId: input.trackId,
    tenantId: input.tenantId,
    assignedByUserId: input.assignedByUserId,
  });
}

export function findAssignment(
  db: ScopedDb,
  trackId: string,
  tenantId: string,
): Promise<Prisma.TrackAssignmentModel | null> {
  return db.trackAssignment.findFirst({ where: { trackId, tenantId } });
}

export async function removeAssignment(
  db: ScopedDb,
  trackId: string,
  tenantId: string,
): Promise<boolean> {
  const result = await db.trackAssignment.deleteMany({ where: { trackId, tenantId } });
  return result.count > 0;
}

/** Every tenant a track is assigned to. Kosmos staff only, so global scope. */
export function listAssignmentsForTrack(client: DbClient, trackId: string) {
  return client.trackAssignment.findMany({
    where: { trackId },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function countAssignmentsForTrack(client: DbClient, trackId: string): Promise<number> {
  return client.trackAssignment.count({ where: { trackId } });
}

/**
 * A client's own tracks, read from the guarded side of the relation.
 *
 * The mirror-image query — `track.findMany({ where: { assignments: { some:
 * { tenantId } } } })` — would return the same rows today and silently return
 * every client's tracks the day somebody edits the filter, because Prisma
 * reports it as one operation on an unscoped model and the guard never sees it.
 */
export function listAssignedTracks(db: ScopedDb) {
  return db.trackAssignment.findMany({
    where: { track: { published: true } },
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
