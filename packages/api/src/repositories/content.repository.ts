import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from '../db/prisma.js';

/**
 * Queries for Kosmos-authored course content.
 *
 * Track, Module, Lesson and Resource carry no tenant column: there is one
 * library, authored by Kosmos, and a client's access to any of it is derived
 * through TrackAssignment. They are therefore deliberately absent from the
 * tenant guard's model map, and these functions take a raw DbClient rather
 * than a ScopedDb. Anything that must be limited to one client's view goes
 * through assignment.repository.ts instead.
 */

// ── Tracks ────────────────────────────────────────────────────────────────

export function findTrackById(client: DbClient, id: string): Promise<Prisma.TrackModel | null> {
  return client.track.findUnique({ where: { id } });
}

export function findTrackBySlug(client: DbClient, slug: string): Promise<Prisma.TrackModel | null> {
  return client.track.findUnique({ where: { slug } });
}

export async function takenTrackSlugs(client: DbClient): Promise<Set<string>> {
  const rows = await client.track.findMany({ select: { slug: true } });
  return new Set(rows.map((row) => row.slug));
}

export function listTracks(client: DbClient): Promise<Prisma.TrackModel[]> {
  return client.track.findMany({ orderBy: [{ createdAt: 'desc' }] });
}

/**
 * A whole track, nested.
 *
 * Every model in this include is global content, so there is no tenant filter
 * to lose. The nested-read caveat in CLAUDE.md applies to includes that reach
 * a tenant-scoped model; this one deliberately does not, and `assignments` is
 * fetched separately by the caller when it is needed.
 */
export function findTrackWithContent(client: DbClient, id: string) {
  return client.track.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            include: { resources: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
}

export function createTrack(
  client: DbClient,
  data: Prisma.TrackUncheckedCreateInput,
): Promise<Prisma.TrackModel> {
  return client.track.create({ data });
}

export function updateTrack(
  client: DbClient,
  id: string,
  data: Prisma.TrackUncheckedUpdateInput,
): Promise<Prisma.TrackModel> {
  return client.track.update({ where: { id }, data });
}

export async function deleteTrack(client: DbClient, id: string): Promise<void> {
  await client.track.delete({ where: { id } });
}

// ── Modules ───────────────────────────────────────────────────────────────

export function findModuleById(client: DbClient, id: string): Promise<Prisma.ModuleModel | null> {
  return client.module.findUnique({ where: { id } });
}

export function listModules(client: DbClient, trackId: string): Promise<Prisma.ModuleModel[]> {
  return client.module.findMany({ where: { trackId }, orderBy: { order: 'asc' } });
}

export function createModule(
  client: DbClient,
  data: Prisma.ModuleUncheckedCreateInput,
): Promise<Prisma.ModuleModel> {
  return client.module.create({ data });
}

export function updateModule(
  client: DbClient,
  id: string,
  data: Prisma.ModuleUncheckedUpdateInput,
): Promise<Prisma.ModuleModel> {
  return client.module.update({ where: { id }, data });
}

export async function deleteModule(client: DbClient, id: string): Promise<void> {
  await client.module.delete({ where: { id } });
}

// ── Lessons ───────────────────────────────────────────────────────────────

export function findLessonById(client: DbClient, id: string): Promise<Prisma.LessonModel | null> {
  return client.lesson.findUnique({ where: { id } });
}

export function listLessons(client: DbClient, moduleId: string): Promise<Prisma.LessonModel[]> {
  return client.lesson.findMany({ where: { moduleId }, orderBy: { order: 'asc' } });
}

export function listLessonsForTrack(
  client: DbClient,
  trackId: string,
): Promise<Prisma.LessonModel[]> {
  return client.lesson.findMany({ where: { module: { trackId } } });
}

export function createLesson(
  client: DbClient,
  data: Prisma.LessonUncheckedCreateInput,
): Promise<Prisma.LessonModel> {
  return client.lesson.create({ data });
}

export function updateLesson(
  client: DbClient,
  id: string,
  data: Prisma.LessonUncheckedUpdateInput,
): Promise<Prisma.LessonModel> {
  return client.lesson.update({ where: { id }, data });
}

export async function deleteLesson(client: DbClient, id: string): Promise<void> {
  await client.lesson.delete({ where: { id } });
}

// ── Resources ─────────────────────────────────────────────────────────────

export function findResourceById(
  client: DbClient,
  id: string,
): Promise<Prisma.ResourceModel | null> {
  return client.resource.findUnique({ where: { id } });
}

export function createResource(
  client: DbClient,
  data: Prisma.ResourceUncheckedCreateInput,
): Promise<Prisma.ResourceModel> {
  return client.resource.create({ data });
}

export async function deleteResource(client: DbClient, id: string): Promise<void> {
  await client.resource.delete({ where: { id } });
}

// ── Ordering ──────────────────────────────────────────────────────────────

/**
 * The next free position among a parent's children.
 *
 * Derived from the current maximum rather than from a count, so deleting an
 * item in the middle cannot hand the next new item a position that is already
 * taken.
 */
export async function nextModuleOrder(client: DbClient, trackId: string): Promise<number> {
  const result = await client.module.aggregate({
    where: { trackId },
    _max: { order: true },
  });
  return (result._max.order ?? -1) + 1;
}

export async function nextLessonOrder(client: DbClient, moduleId: string): Promise<number> {
  const result = await client.lesson.aggregate({
    where: { moduleId },
    _max: { order: true },
  });
  return (result._max.order ?? -1) + 1;
}

export async function nextResourceOrder(client: DbClient, lessonId: string): Promise<number> {
  const result = await client.resource.aggregate({
    where: { lessonId },
    _max: { order: true },
  });
  return (result._max.order ?? -1) + 1;
}

// ── Progress guards (Phase 2 writes these rows; Phase 1 must not orphan them) ──
//
// LessonProgress *is* tenant-scoped, so these two run only under the global
// scope a SUPERADMIN authoring content already holds. That is the point: the
// question being asked is "has any client anywhere started this lesson?", and
// only Kosmos staff are ever in a position to ask it.

export function countProgressForLesson(client: DbClient, lessonId: string): Promise<number> {
  return client.lessonProgress.count({ where: { lessonId } });
}

export function countProgressForModule(client: DbClient, moduleId: string): Promise<number> {
  return client.lessonProgress.count({ where: { lesson: { moduleId } } });
}
