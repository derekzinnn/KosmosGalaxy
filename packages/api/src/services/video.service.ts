import { runInGlobalScope } from '../db/scoped-db.js';
import { listUsedExternalVideoIds } from '../repositories/content.repository.js';
import type { VideoSummary } from './video/index.js';
import { videoProvider } from './video/index.js';

/**
 * The provider's library, for the authoring UI.
 *
 * A thin pass-through to the configured `VideoProvider`, existing so the
 * controller depends on a service rather than reaching into the provider
 * directly — and so the API key never has any path to the browser. The route
 * above is staff-only; this makes no second authorisation decision.
 */
export async function listLibraryVideos(): Promise<VideoSummary[]> {
  const videos = await videoProvider().listVideos();

  // Which of them a lesson already uses. Global scope because Lesson is shared
  // content with no tenant, and this endpoint is staff-only.
  const used = await runInGlobalScope('superadmin:video-library', (db) =>
    listUsedExternalVideoIds(db.raw),
  );
  const usedSet = new Set(used);

  return videos.map((video) => ({ ...video, inUse: usedSet.has(video.id) }));
}
