import { env } from '../../config/env.js';
import { FakeVideoProvider } from './fake-video-provider.js';
import { PandaVideoProvider } from './panda-video-provider.js';
import type { VideoProvider } from './video-provider.js';

let provider: VideoProvider | undefined;

/**
 * Which video provider this process talks to.
 *
 * Resolved once and cached, exactly like `emailProvider()`. Selecting `panda`
 * fails here, at first use, with a message naming what is missing — rather
 * than deep inside a request when a client presses play.
 */
export function videoProvider(): VideoProvider {
  provider ??= (() => {
    switch (env.VIDEO_PROVIDER) {
      case 'fake':
        return new FakeVideoProvider();
      case 'panda': {
        if (!env.PANDA_API_KEY || !env.PANDA_LIBRARY_ID) {
          throw new Error(
            'VIDEO_PROVIDER=panda requires PANDA_API_KEY and PANDA_LIBRARY_ID to be set.',
          );
        }
        return new PandaVideoProvider(env.PANDA_API_KEY, env.PANDA_LIBRARY_ID);
      }
    }
  })();
  return provider;
}

/** Test seam, mirroring `setEmailProvider`. */
export function setVideoProvider(next: VideoProvider): void {
  provider = next;
}

export type { SignedPlayback, VideoProvider, Viewer } from './video-provider.js';
