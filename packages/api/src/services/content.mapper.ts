import type { Prisma } from '../generated/prisma/client.js';
import type { ResourceType } from '../generated/prisma/enums.js';

/**
 * Content shapes that leave the API.
 *
 * Built field by field for the same reason as PublicUser: a column added to
 * the schema later stays invisible to clients until somebody decides it should
 * not be. In Phase 2 that matters concretely — `externalVideoId` must never reach
 * a client browser, since playback will go through a signed URL instead.
 */

export interface PublicResource {
  readonly id: string;
  readonly type: ResourceType;
  readonly title: string;
  readonly url: string;
  readonly fileSizeBytes: number | null;
  readonly order: number;
}

export interface PublicLesson {
  readonly id: string;
  readonly moduleId: string;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly durationSeconds: number | null;
  readonly isRequired: boolean;
  /** Whether a video has been attached yet — never the id itself. */
  readonly hasVideo: boolean;
  readonly resources: readonly PublicResource[];
}

export interface PublicModule {
  readonly id: string;
  readonly trackId: string;
  readonly title: string;
  readonly description: string | null;
  readonly order: number;
  readonly lessons: readonly PublicLesson[];
}

export interface PublicTrack {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly published: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly modules?: readonly PublicModule[];
  /** Present only for Kosmos staff, who are allowed to see the whole picture. */
  readonly moduleCount?: number;
  readonly lessonCount?: number;
  readonly assignedTenantCount?: number;
}

/**
 * The authoring view adds the one field the admin needs and the client must
 * never receive: which video at the provider is attached.
 */
export interface AdminLesson extends PublicLesson {
  readonly externalVideoId: string | null;
}

export function toPublicResource(resource: Prisma.ResourceModel): PublicResource {
  return {
    id: resource.id,
    type: resource.type,
    title: resource.title,
    url: resource.url,
    fileSizeBytes: resource.fileSizeBytes,
    order: resource.order,
  };
}

type LessonWithResources = Prisma.LessonModel & { resources?: Prisma.ResourceModel[] };

export function toPublicLesson(lesson: LessonWithResources): PublicLesson {
  return {
    id: lesson.id,
    moduleId: lesson.moduleId,
    title: lesson.title,
    description: lesson.description,
    order: lesson.order,
    durationSeconds: lesson.durationSeconds,
    isRequired: lesson.isRequired,
    hasVideo: lesson.externalVideoId !== null,
    resources: (lesson.resources ?? []).map(toPublicResource),
  };
}

export function toAdminLesson(lesson: LessonWithResources): AdminLesson {
  return { ...toPublicLesson(lesson), externalVideoId: lesson.externalVideoId };
}

type ModuleWithLessons = Prisma.ModuleModel & { lessons?: LessonWithResources[] };

export function toPublicModule(module: ModuleWithLessons, forAdmin = false): PublicModule {
  return {
    id: module.id,
    trackId: module.trackId,
    title: module.title,
    description: module.description,
    order: module.order,
    lessons: (module.lessons ?? []).map((lesson) =>
      forAdmin ? toAdminLesson(lesson) : toPublicLesson(lesson),
    ),
  };
}

type TrackWithModules = Prisma.TrackModel & { modules?: ModuleWithLessons[] };

export function toPublicTrack(
  track: TrackWithModules,
  options: { forAdmin?: boolean; assignedTenantCount?: number } = {},
): PublicTrack {
  const modules = track.modules?.map((module) => toPublicModule(module, options.forAdmin));

  const base: PublicTrack = {
    id: track.id,
    slug: track.slug,
    title: track.title,
    description: track.description,
    published: track.published,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };

  if (!modules) return base;

  return {
    ...base,
    modules,
    moduleCount: modules.length,
    lessonCount: modules.reduce((total, module) => total + module.lessons.length, 0),
    ...(options.assignedTenantCount === undefined
      ? {}
      : { assignedTenantCount: options.assignedTenantCount }),
  };
}
