/**
 * A single rocket that drifts diagonally across the login background and then
 * waits off-screen before crossing again. Decoration only (aria-hidden); it
 * sits behind the panel content and is hidden under `prefers-reduced-motion`.
 * The timing lives in index.css (`uk-fly`).
 *
 * The rocket itself is hand-drawn SVG — no library, nothing licensed.
 */
export function RocketFlyby() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="uk-fly absolute bottom-0 left-0">
        <Rocket />
      </div>
    </div>
  );
}

function Rocket() {
  return (
    <svg width="34" height="52" viewBox="0 0 32 48" fill="none" focusable="false">
      {/* Exhaust, trailing behind. */}
      <path d="M12 30 L16 46 L20 30 Z" fill="#3b6fe0" />
      <path d="M14 30 L16 40 L18 30 Z" fill="#cfe0f8" />

      {/* Fins */}
      <path d="M11 25 L6 33 L11 31 Z" fill="#0140bf" />
      <path d="M21 25 L26 33 L21 31 Z" fill="#0140bf" />

      {/* Body + nose */}
      <path d="M16 2 L11 13 L21 13 Z" fill="#0140bf" />
      <rect x="11" y="12" width="10" height="19" rx="4.5" fill="#ffffff" stroke="#0140bf" strokeWidth="1.8" />
      <circle cx="16" cy="19" r="2.4" fill="#0140bf" />
    </svg>
  );
}
