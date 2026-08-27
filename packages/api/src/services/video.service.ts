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
export function listLibraryVideos(): Promise<VideoSummary[]> {
  return videoProvider().listVideos();
}
