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

/**
 * One video in the provider's library, as an author needs to see it when
 * choosing which one a lesson plays. The id here is the one the *player*
 * embeds with — for Panda that is `video_external_id`, not the row id, a
 * distinction that otherwise attaches a video that never loads.
 */
export interface VideoSummary {
  readonly id: string;
  readonly title: string;
  readonly durationSeconds: number | null;
  /** Only a ready video can be attached; the picker hides the rest. */
  readonly ready: boolean;
  readonly thumbnailUrl: string | null;
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

  /**
   * The provider's library, for the authoring picker.
   *
   * Staff-only upstream: this is how an author chooses a video without ever
   * pasting an id, and without the browser ever seeing the API key. Returns
   * ready and not-yet-ready videos alike; the caller decides what to show.
   */
  listVideos(): Promise<VideoSummary[]>;
}
