import type { Prisma } from '../generated/prisma/client.js';
import type { ScopedDb } from '../db/scoped-db.js';

/**
 * Progress queries.
 *
 * Every one of these runs through ScopedDb, because LessonProgress and
 * WatchEvent both carry a denormalised `tenantId` and are both in the guard's
 * model map. Writes set that column as a scalar: a nested `connect` would
 * reach the same row and be invisible to the tripwire, which is the one thing
 * the guard cannot forgive.
 */

/**
 * The caller's own track, reached from the guarded side of the relation.
 *
 * This is both the authorisation check and the content read, in one query. It
 * starts at TrackAssignment — the only tenant-scoped model in the content area
 * — and filters *through* the relation to the lesson. The mirror-image query
 * starting at Track would return the same row today and every tenant's rows
 * the day the filter is edited, because the guard never sees it.
 *
 * Published-only, matching `listAssignedTracks`: an unpublished track is a
 * draft, and a draft is not something a client can be partway through.
 */
export async function findAssignedTrackContainingLesson(db: ScopedDb, lessonId: string) {
  const [assignment] = await db.trackAssignment.findMany({
    where: {
      track: { published: true, modules: { some: { lessons: { some: { id: lessonId } } } } },
    },
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
    take: 1,
  });

  return assignment ?? null;
}

export function findProgress(
  db: ScopedDb,
  userId: string,
  lessonId: string,
): Promise<Prisma.LessonProgressModel | null> {
  return db.lessonProgress.findFirst({ where: { userId, lessonId } });
}

/** Every row this user has for the given lessons, for building a track view. */
export function listProgressForLessons(
  db: ScopedDb,
  userId: string,
  lessonIds: readonly string[],
): Promise<Prisma.LessonProgressModel[]> {
  if (lessonIds.length === 0) return Promise.resolve([]);
  return db.lessonProgress.findMany({ where: { userId, lessonId: { in: [...lessonIds] } } });
}

export interface ProgressWrite {
  readonly userId: string;
  readonly lessonId: string;
  readonly tenantId: string;
  readonly maxPositionSeconds: number;
  readonly totalWatchedSeconds: number;
  readonly completedAt: Date | null;
}

/**
 * Insert or advance one progress row.
 *
 * An upsert rather than find-then-create because two heartbeats can arrive at
 * the same instant — a second tab, or a retry after a timeout — and
 * `@@unique([userId, lessonId])` would turn that race into a 500. PostgreSQL
 * resolves it; application code cannot.
 */
export function upsertProgress(
  db: ScopedDb,
  write: ProgressWrite,
): Promise<Prisma.LessonProgressModel> {
  return db.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId: write.userId, lessonId: write.lessonId },
      tenantId: write.tenantId,
    },
    create: {
      userId: write.userId,
      lessonId: write.lessonId,
      tenantId: write.tenantId,
      maxPositionSeconds: write.maxPositionSeconds,
      totalWatchedSeconds: write.totalWatchedSeconds,
      completedAt: write.completedAt,
    },
    update: {
      maxPositionSeconds: write.maxPositionSeconds,
      totalWatchedSeconds: write.totalWatchedSeconds,
      completedAt: write.completedAt,
    },
  });
}

export function recordWatchEvent(
  db: ScopedDb,
  input: {
    userId: string;
    lessonId: string;
    tenantId: string;
    positionSeconds: number;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<Prisma.WatchEventModel> {
  return db.watchEvent.create({
    userId: input.userId,
    lessonId: input.lessonId,
    tenantId: input.tenantId,
    positionSeconds: input.positionSeconds,
    ip: input.ip,
    userAgent: input.userAgent,
  });
}
