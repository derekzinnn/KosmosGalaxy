import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/** The banner's default shape. 5:2 matches the track card; callers override it. */
const DEFAULT_ASPECT = 5 / 2;
const DEFAULT_OUTPUT_WIDTH = 1280;
const MAX_ZOOM = 4;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Pick which part of an image becomes a stored image — a track banner (5:2) or,
 * with `aspect={1}` and `rounded`, a square profile photo.
 *
 * The target box has a fixed shape, so an image of any other shape would be
 * cropped by the browser wherever it happened to land — a face cut in half, a
 * logo off the edge. This lets the person choose the framing instead: pan and
 * zoom inside the window, and what is inside it is what ships. The result is
 * drawn to a fixed `outputWidth × outputWidth/aspect` canvas, so every stored
 * image has the exact shape its slot expects and a bounded size, whatever came
 * in.
 *
 * The visible position is clamped at render time (never in an effect), so the
 * image always covers the window with no gaps and the maths has one source of
 * truth.
 */
export function BannerCropper({
  file,
  onCancel,
  onApply,
  aspect = DEFAULT_ASPECT,
  outputWidth = DEFAULT_OUTPUT_WIDTH,
  rounded = false,
  hint = 'Arraste para reposicionar e use o controle para aproximar. A área dentro do quadro é o que vira o banner.',
}: {
  file: File;
  onCancel: () => void;
  onApply: (cropped: File) => void;
  /** Width ÷ height of the crop window and output. Default 5/2 (a banner). */
  aspect?: number;
  /** Output canvas width in pixels; height is derived from `aspect`. */
  outputWidth?: number;
  /** Show a circular mask over the window, for a profile photo. */
  rounded?: boolean;
  /** The instruction line above the window. */
  hint?: string;
}) {
  const ASPECT = aspect;
  const OUTPUT_WIDTH = outputWidth;
  const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / ASPECT);
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const drag = useRef<{ startX: number; startY: number; origin: Point } | null>(null);

  // Create the object URL inside the effect, not in a memo, so React StrictMode's
  // mount-time double-invoke recreates a fresh URL after its own cleanup revokes
  // the first one — a memo would hand the image a URL that was already revoked.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the object URL's lifetime to the file is the intended use of this effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const frameHeight = frameWidth / ASPECT;

  // The scale at which the image just covers the frame; zoom multiplies it.
  const coverScale =
    natural && frameWidth ? Math.max(frameWidth / natural.w, frameHeight / natural.h) : 1;
  const dispW = natural ? natural.w * coverScale * zoom : 0;
  const dispH = natural ? natural.h * coverScale * zoom : 0;

  const clamp = useCallback(
    (p: Point): Point => ({
      x: Math.min(0, Math.max(frameWidth - dispW, p.x)),
      y: Math.min(0, Math.max(frameHeight - dispH, p.y)),
    }),
    [frameWidth, frameHeight, dispW, dispH],
  );

  const shown = clamp(pos);

  // A callback ref measures the frame without a layout effect, and keeps it in
  // step on resize.
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const measure = () => setFrameWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
  }, []);

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setPos({ x: 0, y: 0 });
  }

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, origin: shown };
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag.current) return;
    setPos(
      clamp({
        x: drag.current.origin.x + (event.clientX - drag.current.startX),
        y: drag.current.origin.y + (event.clientY - drag.current.startY),
      }),
    );
  }

  function onPointerUp(event: React.PointerEvent) {
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onZoom(nextZoom: number) {
    if (!natural) return;
    // Keep the point under the frame's centre fixed while zooming.
    const centre = { x: frameWidth / 2, y: frameHeight / 2 };
    const source = {
      x: (centre.x - shown.x) / (coverScale * zoom),
      y: (centre.y - shown.y) / (coverScale * zoom),
    };
    setZoom(nextZoom);
    setPos({
      x: centre.x - source.x * coverScale * nextZoom,
      y: centre.y - source.y * coverScale * nextZoom,
    });
  }

  async function apply() {
    if (!natural) return;
    setBusy(true);
    try {
      // The source rectangle the frame currently reveals, in the image's own
      // pixels. Decode straight from the file's bytes so the source never
      // depends on whether the on-screen <img> happens to be painted yet.
      const scale = coverScale * zoom;
      const sx = -shown.x / scale;
      const sy = -shown.y / scale;
      const sw = frameWidth / scale;
      const sh = frameHeight / scale;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');

      const bitmap = await createImageBitmap(file);
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      bitmap.close();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85),
      );
      if (!blob) throw new Error('could not encode');

      const name = file.name.replace(/\.[^.]+$/, '') || 'banner';
      onApply(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{hint}</p>

      <div
        ref={frameRef}
        className="relative mx-auto w-full touch-none overflow-hidden border border-border bg-black select-none"
        style={{
          aspectRatio: String(ASPECT),
          borderRadius: rounded ? '9999px' : '0.5rem',
          maxWidth: rounded ? 280 : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={url ?? undefined}
          alt=""
          draggable={false}
          onLoad={onImageLoad}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: dispW || undefined,
            height: dispH || undefined,
            transform: `translate(${String(shown.x)}px, ${String(shown.y)}px)`,
            cursor: 'grab',
            maxWidth: 'none',
          }}
        />
      </div>

      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        Aproximar
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
          className="flex-1 accent-primary"
          aria-label="Aproximar a imagem"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void apply()} loading={busy} disabled={!natural}>
          Aplicar recorte
        </Button>
      </div>
    </div>
  );
}
