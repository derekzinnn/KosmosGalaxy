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

const PANDA_API_SRC = 'https://player.pandavideo.com.br/api.v2.js';

interface PandaPlayerInstance {
  onReady?: () => void;
  setCurrentTime?: (seconds: number) => void;
  destroy?: () => void;
}
type PandaPlayerCtor = new (
  elementId: string,
  options: { onReady?: () => void; onError?: (event: unknown) => void },
) => PandaPlayerInstance;

declare global {
  interface Window {
    PandaPlayer?: PandaPlayerCtor;
  }
}

/** Any message from Panda arrives from a host under this domain. */
function isPandaOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith('.pandavideo.com.br');
  } catch {
    return false;
  }
}

/** The video id Panda embeds with, carried in the `v` query of the signed URL. */
function videoIdFrom(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

/** Load Panda's player API once, shared across every player on the page. */
let pandaScriptPromise: Promise<void> | null = null;
function loadPandaApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PandaPlayer) return Promise.resolve();
  pandaScriptPromise ??= new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PANDA_API_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PANDA_API_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true }); // fall back to raw messages
    document.head.appendChild(script);
  });
  return pandaScriptPromise;
}

/**
 * The one component that knows how a video is put on screen.
 *
 * **This is the vendor swap point, and it is the only one.** Everything around
 * it — the unlock rule, the heartbeat, the progress bar, the resume — works
 * against positions in seconds and knows nothing about who hosts the file. The
 * contract (a URL and callbacks in, seconds and a playing flag out) is what let
 * the surrounding classroom stay unchanged through the move from a bare
 * `<video>` to Panda's iframe.
 *
 * **Two channels talk to the iframe.** Panda's own `api.v2.js` player is
 * instantiated over the iframe: that handshake is what makes Panda start
 * broadcasting `panda_timeupdate` at all, and it is how the saved position is
 * restored — `setCurrentTime` on ready. The position and play/pause state are
 * then *received* by listening to the `postMessage` events that handshake
 * turns on. If the script fails to load, the message listener still works for
 * everything except the resume seek.
 *
 * **Playing/paused is derived from the cadence of `panda_timeupdate`.** It is
 * the one message Panda documents by name; while these arrive it plays, when
 * they go quiet it is paused. Named play/pause/ended are honoured if they come.
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

  // React owns this empty div and nothing inside it. The iframe is created and
  // removed by hand below, so Panda's player — which reparents and rewrites the
  // frame — never touches a node React is also tracking. That collision was the
  // crash: on unmount React reached for an iframe Panda had moved and found
  // null. Isolating the frame this way removes the collision at its source.
  const containerRef = useRef<HTMLDivElement>(null);

  // Callbacks in refs so the effects bind to `url` alone. If they depended on
  // callback identity, an unstable parent would tear the listener down and
  // rebuild it every render.
  const onPositionRef = useRef(onPosition);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onEndedRef = useRef(onEnded);
  const resumeRef = useRef(resumeAtSeconds);

  useEffect(() => {
    onPositionRef.current = onPosition;
    onPlayingChangeRef.current = onPlayingChange;
    onEndedRef.current = onEnded;
    resumeRef.current = resumeAtSeconds;
  });

  // ── Receive: position and play/pause, over postMessage ──────────────────
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
          markActivity();
          break;
        }
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

  // ── Build the iframe by hand, then hand it to Panda's player ────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setFailedUrl((prev) => (prev === url ? null : prev));
    const videoId = videoIdFrom(url);
    const frameId = videoId ? `panda-${videoId}` : undefined;

    const iframe = document.createElement('iframe');
    if (frameId) iframe.id = frameId;
    iframe.src = url;
    iframe.title = title;
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.className = 'aspect-video w-full rounded-xl border-0 bg-black';
    iframe.addEventListener('error', () => {
      setFailedUrl(url);
      onPlayingChangeRef.current(false);
    });
    container.replaceChildren(iframe);

    let player: PandaPlayerInstance | undefined;
    let cancelled = false;

    // Panda only starts broadcasting timeupdates once its player wraps the
    // iframe, and that player is also how the saved position is restored.
    void loadPandaApi().then(() => {
      if (cancelled || !window.PandaPlayer || !frameId) return;
      try {
        player = new window.PandaPlayer(frameId, {
          onReady: () => {
            const resume = Math.floor(resumeRef.current);
            if (resume > 0) player?.setCurrentTime?.(resume);
          },
        });
      } catch {
        // The message listener still delivers position and play state; only
        // the resume seek is lost, and starting from the top is safe.
      }
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy?.();
      } catch {
        /* Panda may already have torn its own listeners down */
      }
      // We put the iframe here, so we take it away — never React, which would
      // reach for a node Panda had already moved.
      try {
        container.replaceChildren();
      } catch {
        /* nothing to clear */
      }
    };
  }, [url, title]);

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

  // The iframe lives inside this div, put there by the effect above — never by
  // React, so Panda can reshape it without leaving React a stale node to trip on.
  return <div ref={containerRef} className="aspect-video w-full" />;
}
