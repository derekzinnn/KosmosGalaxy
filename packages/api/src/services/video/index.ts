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
        // All four, not two: the watermark is the whole reason for choosing
        // Panda, and it needs its group id and secret. Refusing here, at
        // first use, beats discovering a missing secret when a client presses
        // play and the token signs against `undefined`.
        const missing = (
          [
            ['PANDA_API_KEY', env.PANDA_API_KEY],
            ['PANDA_LIBRARY_ID', env.PANDA_LIBRARY_ID],
            ['PANDA_WATERMARK_GROUP_ID', env.PANDA_WATERMARK_GROUP_ID],
            ['PANDA_WATERMARK_SECRET', env.PANDA_WATERMARK_SECRET],
          ] as const
        )
          .filter(([, value]) => !value)
          .map(([name]) => name);

        if (missing.length > 0) {
          throw new Error(`VIDEO_PROVIDER=panda requires: ${missing.join(', ')}.`);
        }

        return new PandaVideoProvider({
          apiKey: env.PANDA_API_KEY!,
          libraryId: env.PANDA_LIBRARY_ID!,
          watermarkGroupId: env.PANDA_WATERMARK_GROUP_ID!,
          watermarkSecret: env.PANDA_WATERMARK_SECRET!,
        });
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
