import { createHmac } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { SignedPlayback, VideoProvider, Viewer } from './video-provider.js';

/**
 * Development and test provider: mints a URL that plays nothing.
 *
 * It signs and expires for real, using the same JWT secret the rest of the
 * service already trusts. That is not theatre — the tests that matter in this
 * phase ask "does a client who was never assigned this track get a URL at
 * all?" and "does the URL carry an expiry?", and both can be answered without
 * a vendor account. What it cannot answer is whether Panda accepts the
 * signature, which is exactly the question the real provider exists to settle.
 */
export class FakeVideoProvider implements VideoProvider {
  readonly name = 'fake';

  signPlaybackUrl(
    videoId: string,
    options: { expiresInSeconds: number; viewer: Viewer },
  ): Promise<SignedPlayback> {
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

    // Bound to the viewer as well as the clock, so a test can prove that one
    // client's URL is not another client's URL.
    const signature = createHmac('sha256', env.JWT_SECRET)
      .update(`${videoId}:${options.viewer.userId}:${String(expiresAtUnix)}`)
      .digest('hex');

    const url =
      `https://video.invalid/fake-playback/${encodeURIComponent(videoId)}` +
      `?expires=${String(expiresAtUnix)}&signature=${signature}`;

    logger.debug(
      { videoId, viewerId: options.viewer.userId, expiresAt },
      'Fake playback URL minted (VIDEO_PROVIDER=fake — this plays nothing)',
    );

    return Promise.resolve({ url, expiresAt });
  }

  /**
   * Always null: an imaginary video has no real length, and returning a
   * plausible-looking number would let a wrong duration decide who "finished"
   * a lesson. Authored durations stand until a real provider overrules them.
   */
  fetchDurationSeconds(): Promise<number | null> {
    return Promise.resolve(null);
  }
}
