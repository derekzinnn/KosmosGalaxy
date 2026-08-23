import { cn } from '@/lib/utils';

/**
 * The mark: a ring with a single orbiting point. Drawn rather than imported
 * so it inherits the accent colour from the theme and stays crisp at any size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 24 24"
        className="size-6 text-primary"
        fill="none"
        aria-hidden
        focusable="false"
      >
        <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <ellipse
          cx="12"
          cy="12"
          rx="10.5"
          ry="4.25"
          stroke="currentColor"
          strokeWidth="1.5"
          transform="rotate(-24 12 12)"
        />
        <circle cx="12" cy="12" r="2.75" fill="currentColor" />
      </svg>
      <span className="text-[0.95rem] font-semibold tracking-tight">Kosmos Galaxy</span>
    </span>
  );
}
