/**
 * Who is about to watch. Passed to the provider on every signing request.
 *
 * This exists because of why Panda was chosen at all: the watermark burned
 * into playback carries the viewer's own identity, which is what makes a
 * leaked recording traceable. A provider that ignores these fields is still a
 * valid implementation — the fake one does — but the information has to reach
 * it, so the interface carries it rather than making each provider dig.
 */
export interface Viewer {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  /** null for Kosmos staff previewing their own content. */
  readonly tenantId: string | null;
  readonly ip: string;
}

export interface SignedPlayback {
  /** Short-lived, viewer-specific. Never cache this across users. */
  readonly url: string;
  readonly expiresAt: Date;
}

/**
 * How Kosmos Galaxy plays video.
 *
 * The application never talks to a video vendor directly, for the same reason
 * it never talks to a mail vendor directly: the choice is a product decision
 * that should cost one file to revisit, not a rewrite of every service.
 *
 * The abstraction is deliberately thin, and stops here. Minting a URL and
 * reading a duration are genuinely vendor-shaped operations. The *player* is
 * not — every vendor ships its own embed and its own JavaScript API, so
 * swapping vendors still means rewriting the player component in the web
 * package. Pretending this interface makes the front end portable would buy a
 * false sense of safety, so it does not try.
 */
export interface VideoProvider {
  readonly name: string;

  /**
   * A URL that plays exactly this video, for exactly this viewer, for a
   * limited time.
   *
   * Implementations must not return a URL that outlives `expiresInSeconds`,
   * and must not return one that works for a different viewer. Both are what
   * make the assignment check upstream worth doing at all — a URL that can be
   * pasted into a group chat and still play makes the whole chain decorative.
   */
  signPlaybackUrl(
    videoId: string,
    options: { readonly expiresInSeconds: number; readonly viewer: Viewer },
  ): Promise<SignedPlayback>;

  /**
   * The real length of the video, in seconds, according to the vendor.
   *
   * Returns null when the vendor does not know yet — a freshly uploaded video
   * is still encoding, and guessing would write a wrong number that later
   * silently decides whether somebody "finished" the lesson.
   */
  fetchDurationSeconds(videoId: string): Promise<number | null>;
}
