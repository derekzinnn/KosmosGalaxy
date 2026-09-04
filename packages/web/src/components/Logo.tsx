import { cn } from '@/lib/utils';

/**
 * The Universo Kosmos mark: the brand's ringed planet, drawn as an SVG so it
 * inherits the current text colour (black on light, white on dark) and stays
 * crisp at any size. The ring is knocked out of the planet as negative space —
 * the same treatment as the brand logo — with two solid tips continuing its
 * line beyond the body.
 *
 * If the official `planet.svg` is dropped into `public/`, swap the inline
 * markup for an <img>; the wordmark and layout stay as they are.
 */
export function PlanetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden focusable="false">
      <mask id="uk-planet" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="black" />
        <circle cx="16" cy="16" r="10" fill="white" />
        {/* The ring's negative-space band, cut through the planet. */}
        <rect x="-2" y="14.7" width="36" height="2.6" rx="1.3" fill="black" transform="rotate(-19 16 16)" />
      </mask>

      <circle cx="16" cy="16" r="10" fill="currentColor" mask="url(#uk-planet)" />

      {/* The ring tips, continuing the band beyond the planet on both sides. */}
      <g transform="rotate(-19 16 16)">
        <rect x="2.4" y="14.7" width="4.4" height="2.6" rx="1.3" fill="currentColor" />
        <rect x="25.2" y="14.7" width="4.4" height="2.6" rx="1.3" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * The lockup used in the header: the planet mark beside the wordmark, both in
 * the current text colour. The wordmark is set in Quicksand, the brand's
 * display face.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <PlanetMark className="size-7" />
      <span className="font-display text-[1.05rem] font-bold tracking-tight whitespace-nowrap">
        Universo Kosmos
      </span>
    </span>
  );
}
