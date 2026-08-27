import { request } from './api-client';

export interface Resource {
  id: string;
  type: 'FILE' | 'LINK';
  title: string;
  url: string;
  fileSizeBytes: number | null;
  order: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  order: number;
  durationSeconds: number | null;
  isRequired: boolean;
  hasVideo: boolean;
  /** Present only in the Kosmos authoring view; never sent to a client. */
  externalVideoId?: string | null;
  resources: Resource[];
}

export interface Module {
  id: string;
  trackId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
}

export interface Track {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  modules?: Module[];
  moduleCount?: number;
  lessonCount?: number;
  assignedTenantCount?: number;
}

export interface PublishProblem {
  code: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface LibraryVideo {
  id: string;
  title: string;
  durationSeconds: number | null;
  ready: boolean;
  thumbnailUrl: string | null;
  /** Whether some lesson already points at this video. */
  inUse?: boolean;
}

export const contentApi = {
  /** The Panda library, for the authoring video picker. Staff only. */
  listVideos: () => request<{ videos: LibraryVideo[] }>('/videos'),

  listTracks: () => request<{ tracks: Track[] }>('/tracks'),

  getTrack: (trackId: string) => request<{ track: Track }>(`/tracks/${trackId}`),

  createTrack: (body: { title: string; description?: string | null }) =>
    request<{ track: Track }>('/tracks', { method: 'POST', body }),

  updateTrack: (trackId: string, body: { title?: string; description?: string | null }) =>
    request<{ track: Track }>(`/tracks/${trackId}`, { method: 'PATCH', body }),

  deleteTrack: (trackId: string) => request<void>(`/tracks/${trackId}`, { method: 'DELETE' }),

  readiness: (trackId: string) =>
    request<{ ready: boolean; problems: PublishProblem[] }>(`/tracks/${trackId}/readiness`),

  publish: (trackId: string) =>
    request<{ track: Track }>(`/tracks/${trackId}/publish`, { method: 'POST' }),

  unpublish: (trackId: string) =>
    request<{ track: Track }>(`/tracks/${trackId}/unpublish`, { method: 'POST' }),

  createModule: (trackId: string, body: { title: string; description?: string | null }) =>
    request<{ module: Module }>(`/tracks/${trackId}/modules`, { method: 'POST', body }),

  updateModule: (moduleId: string, body: { title?: string; description?: string | null }) =>
    request<{ module: Module }>(`/modules/${moduleId}`, { method: 'PATCH', body }),

  deleteModule: (moduleId: string) => request<void>(`/modules/${moduleId}`, { method: 'DELETE' }),

  reorderModules: (trackId: string, orderedIds: string[]) =>
    request<{ modules: Module[] }>(`/tracks/${trackId}/modules/reorder`, {
      method: 'POST',
      body: { orderedIds },
    }),

  createLesson: (
    moduleId: string,
    body: {
      title: string;
      description?: string | null;
      externalVideoId?: string | null;
      durationSeconds?: number | null;
      isRequired?: boolean;
    },
  ) => request<{ lesson: Lesson }>(`/modules/${moduleId}/lessons`, { method: 'POST', body }),

  updateLesson: (
    lessonId: string,
    body: {
      title?: string;
      description?: string | null;
      externalVideoId?: string | null;
      durationSeconds?: number | null;
      isRequired?: boolean;
    },
  ) => request<{ lesson: Lesson }>(`/lessons/${lessonId}`, { method: 'PATCH', body }),

  deleteLesson: (lessonId: string) => request<void>(`/lessons/${lessonId}`, { method: 'DELETE' }),

  reorderLessons: (moduleId: string, orderedIds: string[]) =>
    request<{ lessons: Lesson[] }>(`/modules/${moduleId}/lessons/reorder`, {
      method: 'POST',
      body: { orderedIds },
    }),

  listAssignments: (trackId: string) =>
    request<{ tenants: Tenant[] }>(`/tracks/${trackId}/assignments`),

  assign: (trackId: string, tenantId: string) =>
    request<{ assigned: boolean }>(`/tracks/${trackId}/assignments`, {
      method: 'POST',
      body: { tenantId },
    }),

  unassign: (trackId: string, tenantId: string) =>
    request<void>(`/tracks/${trackId}/assignments/${tenantId}`, { method: 'DELETE' }),

  /** The caller's own company's published tracks. */
  myTracks: () => request<{ tracks: Track[] }>('/tracks/mine'),
};

export interface CreatedInvitation {
  id: string;
  email: string;
  role: string;
  /** The one-time magic link. Present only on creation; never listed later. */
  acceptUrl: string;
}

export const invitationApi = {
  create: (body: { email: string; role: 'CLIENT_OWNER' | 'CLIENT_MEMBER'; tenantId: string }) =>
    request<{ invitation: CreatedInvitation }>('/invitations', { method: 'POST', body }),
};

export const tenantApi = {
  list: () => request<{ tenants: Tenant[] }>('/tenants'),

  create: (body: { name: string; slug: string }) =>
    request<{ tenant: Tenant }>('/tenants', { method: 'POST', body }),
};
