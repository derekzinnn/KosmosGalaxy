import type { SignedPlayback, VideoProvider, Viewer } from './video-provider.js';

/**
 * Panda Video — not implemented yet, on purpose.
 *
 * The vendor decision is made and recorded (CLAUDE.md → "Decisions taken
 * ahead of Phase 2"). What is not yet in hand is Panda's signing scheme: the
 * exact parameter names, the hash input and its ordering, and which of the
 * library, tenant or viewer identifiers belong in it.
 *
 * That gap is left open rather than guessed. A signing implementation written
 * from memory looks finished, typechecks, passes every test that does not talk
 * to Panda, and then returns 403 from the player in production — after the
 * content is uploaded and a client is waiting. An unmistakable failure at boot
 * is cheaper than a plausible one at runtime, and matches how this service
 * already treats configuration it cannot trust.
 *
 * To finish this file you need, from the Panda dashboard and API docs:
 *
 *   1. The API key and the library (vz) identifier          → env
 *   2. The signed-playback scheme — parameter names, the string that gets
 *      hashed, the algorithm, and where the signature is carried
 *   3. The viewer-watermark fields, so `Viewer` is actually burned into
 *      playback rather than merely passed in and dropped
 *   4. The endpoint that reports a video's real duration
 *
 * Everything upstream of this file is finished and exercised against
 * `FakeVideoProvider`: the assignment check, the unlock rule, the expiry, the
 * audit row. Only the last hop is missing.
 */
export class PandaVideoProvider implements VideoProvider {
  readonly name = 'panda';

  constructor(
    private readonly apiKey: string,
    private readonly libraryId: string,
  ) {}

  signPlaybackUrl(
    _videoId: string,
    _options: { expiresInSeconds: number; viewer: Viewer },
  ): Promise<SignedPlayback> {
    return Promise.reject(
      new Error(
        'PandaVideoProvider.signPlaybackUrl is not implemented. ' +
          'See the checklist in panda-video-provider.ts — the signing scheme has ' +
          'to come from the Panda API documentation, not from a guess.',
      ),
    );
  }

  fetchDurationSeconds(_videoId: string): Promise<number | null> {
    return Promise.reject(
      new Error(
        'PandaVideoProvider.fetchDurationSeconds is not implemented. ' +
          'See the checklist in panda-video-provider.ts.',
      ),
    );
  }
}
