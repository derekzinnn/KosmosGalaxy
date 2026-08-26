import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface LessonPlayerProps {
  /** Signed, viewer-specific and expiring. Comes from `/lessons/:id/playback`. */
  readonly url: string;
  readonly title: string;
  readonly resumeAtSeconds: number;
  readonly onPosition: (seconds: number) => void;
  readonly onPlayingChange: (playing: boolean) => void;
  readonly onEnded?: () => void;
}

/**
 * The one component that knows how a video is put on screen.
 *
 * **This is the vendor swap point, and it is the only one.** Everything around
 * it — the unlock rule, the heartbeat, the progress bar, the resume offer —
 * works against positions in seconds and knows nothing about who hosts the
 * file. Changing provider means rewriting this file and
 * `packages/api/src/services/video/`, and nothing else.
 *
 * Today it is a plain `<video>`, which plays a direct MP4 or an HLS stream on
 * Safari. Two things will change it, and both are expected:
 *
 *   - **HLS outside Safari** needs `hls.js`. Deliberately not added yet: it is
 *     a dependency bought for a provider that has not been wired up.
 *   - **A watermarked or DRM stream** cannot be a bare `<video>` at all. The
 *     per-viewer watermark is burned in by the provider's own player, so this
 *     becomes an `<iframe>` and positions arrive through their JS API instead
 *     of `timeupdate`. The props below are the contract that survives that
 *     change — which is why they are seconds and booleans, not a media element.
 *
 * With `VIDEO_PROVIDER=fake` the URL points at nothing and this shows its
 * error state. That is correct behaviour, not a bug: the surrounding classroom
 * is still fully exercisable.
 */
export function LessonPlayer({
  url,
  title,
  resumeAtSeconds,
  onPosition,
  onPlayingChange,
  onEnded,
}: LessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Which URL failed, rather than a boolean "it failed". Derived state costs
  // no effect and cannot get out of step: a freshly minted URL after the old
  // one expired is simply not the one that failed, so the player comes back
  // on its own.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  // Resume once per URL, for the same reason: a re-mint mid-lesson must not
  // drag the viewer back to where they were when they first opened the page.
  const resumedForUrl = useRef<string | null>(null);

  const handleLoadedMetadata = (): void => {
    const video = videoRef.current;
    if (!video || resumedForUrl.current === url) return;
    resumedForUrl.current = url;

    // Not to the very end: somebody who finished and came back should land
    // just before the close rather than on a frozen final frame.
    if (resumeAtSeconds > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(resumeAtSeconds, Math.max(0, video.duration - 5));
    }
  };

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted p-6 text-center">
        <AlertTriangle className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Não conseguimos carregar este vídeo</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          O link de reprodução pode ter expirado. Recarregue a página para gerar um novo.
        </p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      title={title}
      controls
      // The URL is already viewer-specific and expiring; letting a browser or
      // proxy keep a copy would quietly undo that.
      preload="metadata"
      controlsList="nodownload"
      disablePictureInPicture={false}
      className="aspect-video w-full rounded-xl bg-black"
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={(event) => {
        onPosition(event.currentTarget.currentTime);
      }}
      onPlay={() => {
        onPlayingChange(true);
      }}
      onPause={() => {
        onPlayingChange(false);
      }}
      onEnded={() => {
        onPlayingChange(false);
        onEnded?.();
      }}
      onError={() => {
        setFailedUrl(url);
        onPlayingChange(false);
      }}
    >
      Seu navegador não consegue reproduzir este vídeo.
    </video>
  );
}
