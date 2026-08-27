import { SignJWT } from 'jose';
import { logger } from '../../lib/logger.js';
import type { SignedPlayback, VideoProvider, VideoSummary, Viewer } from './video-provider.js';

interface PandaConfig {
  readonly apiKey: string;
  /** The pull-zone name, e.g. `vz-a7b51d2b-af7`. */
  readonly libraryId: string;
  readonly watermarkGroupId: string;
  readonly watermarkSecret: string;
}

/**
 * Panda Video, in production.
 *
 * **Panda does not sign an expiring URL the way Bunny does.** There is no
 * timestamped, HMAC-signed link. Protection comes from three things that
 * work together, and the URL this returns leans on all three:
 *
 *   1. **Domain lock** — the player only runs when embedded on a domain on
 *      Panda's allow-list. This is what actually stops a pasted URL from
 *      playing elsewhere, and it lives in the Panda dashboard, not here.
 *   2. **A per-viewer watermark** — a short-lived JWT, signed with the
 *      watermark group's own secret, that burns the viewer's identity into
 *      the picture. This is what makes a screen-recorded leak traceable, and
 *      it is the reason Panda was chosen over Bunny at all.
 *   3. **The unlock and assignment checks upstream**, which already ran before
 *      this method was called.
 *
 * So `expiresInSeconds` here bounds the **watermark token**, not the URL. A
 * copied link keeps playing until the token expires *and* only on an allowed
 * domain — the honest description of what the protection is, which the
 * `SignedPlayback.expiresAt` contract still holds to.
 */
export class PandaVideoProvider implements VideoProvider {
  readonly name = 'panda';

  private readonly secret: Uint8Array;

  constructor(private readonly config: PandaConfig) {
    this.secret = new TextEncoder().encode(config.watermarkSecret);
  }

  async signPlaybackUrl(
    videoId: string,
    options: { expiresInSeconds: number; viewer: Viewer },
  ): Promise<SignedPlayback> {
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);

    /*
     * The watermark JWT. HS256 signed with the group secret, the scheme Panda
     * documents. The three free-text fields are what the viewer sees stamped
     * on the video, so they carry the identity that makes a leak traceable —
     * the email above all, because it points at exactly one account.
     */
    const watermark = await new SignJWT({
      drm_group_id: this.config.watermarkGroupId,
      string1: 'Licenciado para uso exclusivo',
      string2: options.viewer.email,
      string3: `Acesso: ${new Date().toISOString().slice(0, 10)}`,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresAt)
      .sign(this.secret);

    // The library id is the player subdomain; the video id and the watermark
    // token are query parameters. This is Panda's embed URL shape, and it is
    // the one contract LessonPlayer on the web side has to match.
    const url =
      `https://player-${this.config.libraryId}.tv.pandavideo.com.br/embed/` +
      `?v=${encodeURIComponent(videoId)}&watermark=${encodeURIComponent(watermark)}`;

    logger.debug(
      { videoId, viewerId: options.viewer.userId, expiresAt },
      'Panda playback URL minted',
    );

    return { url, expiresAt };
  }

  /** The library, for the authoring picker. See `listVideosImpl` below. */
  listVideos(): Promise<VideoSummary[]> {
    return listVideosImpl(this.config.apiKey);
  }

  /**
   * The real duration, from `GET /videos/{id}`.
   *
   * Returns null on anything other than a clean answer with a positive length:
   * a video still encoding, a transient API error, a missing field. Every one
   * of those means "not known yet", and the progress rule treats an unknown
   * duration as a lesson that can be watched but never auto-completes — which
   * is safe. Guessing a number here would let a wrong one decide who finished.
   */
  async fetchDurationSeconds(videoId: string): Promise<number | null> {
    let response: Response;
    try {
      response = await fetch(
        `https://api-v2.pandavideo.com.br/videos/${encodeURIComponent(videoId)}`,
        { headers: { Authorization: this.config.apiKey } },
      );
    } catch (error) {
      logger.warn({ videoId, error }, 'Could not reach Panda to read a duration');
      return null;
    }

    if (!response.ok) {
      logger.warn(
        { videoId, status: response.status },
        'Panda did not return a video; leaving the duration unknown',
      );
      return null;
    }

    const body: unknown = await response.json().catch(() => null);
    const seconds = readDuration(body);

    return seconds !== null && seconds > 0 ? Math.round(seconds) : null;
  }
}

/**
 * The library, from GET /videos.
 *
 * Maps to the id the *player* embeds with — `video_external_id`, confirmed
 * against the URL Panda itself returns in `video_player`. Using the row `id`
 * would attach a video that signs fine and then never loads. A video with no
 * external id yet is still encoding and is dropped rather than offered.
 */
async function listVideosImpl(apiKey: string): Promise<VideoSummary[]> {
  let response: Response;
  try {
    response = await fetch('https://api-v2.pandavideo.com.br/videos?limit=200', {
      headers: { Authorization: apiKey },
    });
  } catch (error) {
    throw new Error('Não foi possível consultar a biblioteca do Panda.', { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Panda respondeu ${String(response.status)} ao listar os vídeos.`);
  }
  const body: unknown = await response.json().catch(() => null);
  const raw = extractVideos(body);

  return raw
    .map((v): VideoSummary | null => {
      const id = typeof v.video_external_id === 'string' ? v.video_external_id : null;
      if (!id) return null;
      const length =
        typeof v.length === 'number' && Number.isFinite(v.length) ? Math.round(v.length) : null;
      return {
        id,
        title: typeof v.title === 'string' ? v.title : id,
        durationSeconds: length,
        ready: v.status === 'CONVERTED' && v.playable === true,
        thumbnailUrl: typeof v.thumbnail === 'string' ? v.thumbnail : null,
      };
    })
    .filter((v): v is VideoSummary => v !== null);
}

function extractVideos(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (typeof body === 'object' && body !== null) {
    const list = (body as { videos?: unknown }).videos;
    if (Array.isArray(list)) return list as Record<string, unknown>[];
  }
  return [];
}

/**
 * Pull a duration out of Panda's response without trusting its exact shape.
 *
 * The field has been reported under a few names across the API's history, and
 * an encoding video may carry none of them. Reading defensively here costs a
 * few lines and means a schema tweak on their end degrades to "unknown"
 * rather than crashing a heartbeat.
 */
function readDuration(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  for (const key of ['length', 'duration', 'video_duration', 'durationSeconds']) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}
