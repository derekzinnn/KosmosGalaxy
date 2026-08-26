import { useEffect, useRef } from 'react';
import { classroomApi, type HeartbeatResult } from '@/lib/classroom-api';

interface UseHeartbeatOptions {
  readonly lessonId: string;
  /** Report only while the video is actually playing. */
  readonly playing: boolean;
  readonly intervalSeconds: number;
  /** Reads the player's current position at the moment of sending. */
  readonly getPosition: () => number;
  readonly onResult?: (result: HeartbeatResult) => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Tells the API where the player has reached, every few seconds, while it plays.
 *
 * Three behaviours worth knowing about:
 *
 * **It reports only while playing.** A paused video covers no new ground, and
 * the server credits new ground only — so beating through a pause would cost
 * a request per interval and change nothing.
 *
 * **It never overlaps itself.** On a slow connection a beat can outlive its
 * interval. Firing the next one anyway would queue requests that arrive out
 * of order, and the later-but-lower position would be the one the server saw
 * last. One in flight at a time.
 *
 * **It flushes on pause and on unmount.** Somebody who watches fourteen
 * seconds and closes the tab watched fourteen seconds. Without a final beat
 * that tail is simply lost, and the loss is always in the same direction —
 * progress would read low for everyone, forever.
 */
export function useHeartbeat({
  lessonId,
  playing,
  intervalSeconds,
  getPosition,
  onResult,
  onError,
}: UseHeartbeatOptions): void {
  // Held in refs so a changing callback identity does not tear down and
  // rebuild the interval — which would reset the clock on every render and,
  // with an unstable parent, mean a beat never actually fires.
  const getPositionRef = useRef(getPosition);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const inFlightRef = useRef(false);
  const lastSentRef = useRef<number | null>(null);

  useEffect(() => {
    getPositionRef.current = getPosition;
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;

    const send = (): void => {
      if (inFlightRef.current) return;

      const position = getPositionRef.current();
      if (!Number.isFinite(position) || position < 0) return;

      // Nothing moved since the last report: the server would credit zero and
      // write a telemetry row saying so.
      if (lastSentRef.current !== null && Math.abs(position - lastSentRef.current) < 1) return;

      inFlightRef.current = true;
      lastSentRef.current = position;

      classroomApi
        .heartbeat(lessonId, Math.floor(position))
        .then((response) => {
          if (!cancelled) onResultRef.current?.(response.progress);
        })
        .catch((error: unknown) => {
          if (!cancelled) onErrorRef.current?.(error);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    if (!playing) return;

    const timer = setInterval(send, intervalSeconds * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      // The flush. `cancelled` is already true, so the response is ignored —
      // this is fire-and-forget on purpose: the component may be gone, and
      // what matters is that the position reached the server.
      const position = getPositionRef.current();
      if (Number.isFinite(position) && position > 0) {
        void classroomApi.heartbeat(lessonId, Math.floor(position)).catch(() => {
          // A failed flush is not worth surfacing: the viewer has already
          // paused or navigated away, and there is nothing for them to do.
        });
      }
    };
  }, [lessonId, playing, intervalSeconds]);
}
