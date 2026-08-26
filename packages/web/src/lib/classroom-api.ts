import { request } from './api-client';

/**
 * The classroom half of the API: playing a lesson, and reporting progress.
 *
 * Note what is absent — there is no video id anywhere in these types. The
 * client receives a URL that is already signed, already bound to this viewer
 * and already expiring. That is the whole point of `/playback` existing
 * instead of the lesson simply carrying the id.
 */

export interface Playback {
  lessonId: string;
  /** Signed, viewer-specific, short-lived. Never cache or share this. */
  url: string;
  expiresAt: string;
  durationSeconds: number | null;
  /** Where this viewer had reached, so we can offer to resume. */
  resumeAtSeconds: number;
}

export interface LessonProgress {
  lessonId: string;
  locked: boolean;
  completed: boolean;
  maxPositionSeconds: number;
  totalWatchedSeconds: number;
}

export interface TrackProgress {
  trackId: string;
  completed: boolean;
  nextLessonId: string | null;
  lessons: LessonProgress[];
}

export interface HeartbeatResult {
  lessonId: string;
  maxPositionSeconds: number;
  totalWatchedSeconds: number;
  completed: boolean;
  /** True only on the beat that finished it, so we celebrate exactly once. */
  justCompleted: boolean;
  trackCompleted: boolean;
  unlockedLessonIds: string[];
}

export const classroomApi = {
  playback: (lessonId: string) => request<{ playback: Playback }>(`/lessons/${lessonId}/playback`),

  progress: (lessonId: string) =>
    request<{ progress: TrackProgress }>(`/lessons/${lessonId}/progress`),

  heartbeat: (lessonId: string, positionSeconds: number) =>
    request<{ progress: HeartbeatResult }>(`/lessons/${lessonId}/heartbeat`, {
      method: 'POST',
      body: { positionSeconds },
    }),
};
