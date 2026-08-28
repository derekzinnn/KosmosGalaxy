/**
 * Every trilha gets its own little cosmos.
 *
 * There are no uploaded cover images, and generic stock would flatten the
 * product's own identity — Kosmos, a galaxy. So each trilha draws the orbit
 * mark from the logo, tinted a colour derived from its id: the same trilha is
 * always the same constellation and the same hue, distinct from its neighbours,
 * and unmistakably part of this product rather than any other.
 *
 * The hue stays on the indigo→violet→blue arc so the covers read as a family,
 * never a rainbow. It is the one place colour is spent freely; everything
 * around it stays quiet.
 */
export function TrackCover({
  seed,
  className,
  imageUrl,
}: {
  seed: string;
  className?: string;
  /** An uploaded banner. When present it replaces the generated cosmos. */
  imageUrl?: string | null;
}) {
  const hue = hueFromSeed(seed);
  const tilt = (hashOf(seed) % 60) - 30;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className={className}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(140deg, oklch(0.52 0.16 ${String(hue)}), oklch(0.38 0.14 ${String(hue + 20)}))`,
      }}
    >
      <svg
        viewBox="0 0 200 120"
        className="size-full"
        fill="none"
        aria-hidden
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="white" strokeOpacity="0.28" strokeWidth="1.25">
          <ellipse cx="100" cy="60" rx="78" ry="30" transform={`rotate(${String(tilt)} 100 60)`} />
          <ellipse
            cx="100"
            cy="60"
            rx="58"
            ry="22"
            transform={`rotate(${String(tilt + 40)} 100 60)`}
          />
          <circle cx="100" cy="60" r="40" strokeOpacity="0.18" />
        </g>
        <circle cx="100" cy="60" r="9" fill="white" fillOpacity="0.9" />
        {/* A single orbiting point, placed by the seed — the mark's moving part. */}
        <circle
          cx={100 + 78 * Math.cos((tilt * Math.PI) / 180)}
          cy={60 + 30 * Math.sin((tilt * Math.PI) / 180)}
          r="4"
          fill="white"
        />
      </svg>
    </div>
  );
}

function hashOf(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return hash;
}

/** On the indigo→violet→blue arc (230–320), so covers stay a family. */
function hueFromSeed(seed: string): number {
  return 230 + (hashOf(seed) % 90);
}
