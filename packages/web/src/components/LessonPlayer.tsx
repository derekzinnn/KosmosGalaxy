import { useEffect, useRef, useState } from 'react';
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

/** A timeupdate this many ms stale means the video is no longer playing. */
const PAUSE_AFTER_SILENCE_MS = 1500;

/** Any message from Panda arrives from a host under this domain. */
function isPandaOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith('.pandavideo.com.br');
  } catch {
    return false;
  }
}

/**
 * The one component that knows how a video is put on screen.
 *
 * **This is the vendor swap point, and it is the only one.** Everything around
 * it — the unlock rule, the heartbeat, the progress bar, the resume offer —
 * works against positions in seconds and knows nothing about who hosts the
 * file. This contract (a URL and callbacks in, seconds and a playing flag out)
 * survived the move from a bare `<video>` to Panda's `<iframe>` without any of
 * that surrounding code changing, which was the entire point of keeping it thin.
 *
 * Panda burns the per-viewer watermark into the picture itself, which is why
 * this has to be their iframe and cannot be a `<video>` pointed at a file: the
 * watermark is the reason Panda was chosen, and it only exists inside their
 * player. The iframe talks to us through `postMessage`.
 *
 * **Playing/paused is derived from the cadence of `panda_timeupdate`, not from
 * a play/pause event.** `panda_timeupdate` is the one message Panda documents
 * by name; the others it does not. So rather than guess event names that would
 * fail silently, this treats "timeupdates are still arriving" as playing and
 * "they went quiet" as paused — which is exactly the signal the heartbeat
 * needs, and is immune to the parts of Panda's message vocabulary we cannot
 * verify. If a named play/pause/ended message does arrive, it is honoured too.
 */
export function LessonPlayer({
  url,
  title,
  resumeAtSeconds,
  onPosition,
  onPlayingChange,
  onEnded,
}: LessonPlayerProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === url;

  // Callbacks in refs so the effect below can be bound to `url` alone. If it
  // depended on the callback identities, an unstable parent would tear the
  // message listener down and rebuild it on every render.
  const onPositionRef = useRef(onPosition);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onPositionRef.current = onPosition;
    onPlayingChangeRef.current = onPlayingChange;
    onEndedRef.current = onEnded;
  });

  useEffect(() => {
    let playing = false;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;

    const setPlaying = (next: boolean): void => {
      if (next === playing) return;
      playing = next;
      onPlayingChangeRef.current(next);
    };

    const markActivity = (): void => {
      setPlaying(true);
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        setPlaying(false);
      }, PAUSE_AFTER_SILENCE_MS);
    };

    const onMessage = (event: MessageEvent): void => {
      if (!isPandaOrigin(event.origin)) return;

      const data = event.data as { message?: unknown; currentTime?: unknown } | null;
      if (typeof data !== 'object' || data === null) return;

      switch (data.message) {
        case 'panda_timeupdate': {
          if (typeof data.currentTime === 'number' && Number.isFinite(data.currentTime)) {
            onPositionRef.current(data.currentTime);
          }
          // The heartbeat of the player itself: while these arrive, it plays.
          markActivity();
          break;
        }
        // These fire only if Panda names them; the cadence logic above does
        // not depend on them, so honouring them is a bonus, not a crutch.
        case 'panda_play':
          markActivity();
          break;
        case 'panda_pause':
          if (silenceTimer) clearTimeout(silenceTimer);
          setPlaying(false);
          break;
        case 'panda_ended':
          if (silenceTimer) clearTimeout(silenceTimer);
          setPlaying(false);
          onEndedRef.current?.();
          break;
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
      if (silenceTimer) clearTimeout(silenceTimer);
      setPlaying(false);
    };
  }, [url]);

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

  // The resume position rides on the URL as a fragment, so it is applied by the
  // player at load without a seek call we would have to guess the shape of, and
  // a re-mint mid-lesson (the old token expired) does not drag the viewer back:
  // the fragment always carries where they actually are now.
  const src = resumeAtSeconds > 0 ? `${url}#t=${String(Math.floor(resumeAtSeconds))}` : url;

  return (
    <iframe
      key={url}
      src={src}
      title={title}
      // Panda serves its own controls, watermark and DRM inside the frame.
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      className="aspect-video w-full rounded-xl border-0 bg-black"
      onError={() => {
        setFailedUrl(url);
        onPlayingChange(false);
      }}
    />
  );
}
