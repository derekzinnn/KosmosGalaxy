import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The frame every signed-out screen shares.
 *
 * **Exactly one thing on the page is actionable.** That principle has held
 * since Phase 0 and still holds — but it is a rule about actions, not about
 * space. On a laptop the form alone left most of the screen empty, and an
 * empty screen is not restraint, it is an unfinished one.
 *
 * So: a brand panel on the left from `lg` up, carrying the mark, what this is
 * and who it is from. Nothing in it can be clicked, so the form on the right
 * is still the only thing to do. Below `lg` the panel disappears entirely
 * rather than stacking above the form — on a phone, brand messaging between
 * the address bar and the e-mail field is just something to scroll past.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ── Brand, desktop only ──────────────────────────────────────── */}
      <aside className="auth-backdrop relative hidden overflow-hidden border-r border-border lg:flex lg:w-[44%] lg:max-w-2xl lg:flex-col lg:justify-between lg:p-12">
        <OrbitMotif />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-md space-y-4">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Seu onboarding com a Kosmos, do começo ao fim.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Suas trilhas, suas aulas e seu progresso em um só lugar. Avance no seu ritmo — a gente
            acompanha junto.
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground">Kosmos Inteligência Digital</p>
      </aside>

      {/* ── The form ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pt-5 lg:justify-end lg:px-8">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-center justify-center px-5 py-10 lg:px-8">
          <div className="w-full max-w-[24rem]">
            <div className="mb-7 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>

            {children}

            {footer ? <div className="mt-7 text-sm">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Three orbits, echoing the mark, drawn very faintly.
 *
 * Atmosphere rather than decoration — at this opacity it registers as texture
 * before anyone consciously sees a shape, which is the point. `aria-hidden`
 * because there is nothing here to describe.
 */
function OrbitMotif() {
  return (
    <svg
      className="pointer-events-none absolute -right-24 -bottom-24 size-[34rem] text-primary opacity-[0.07]"
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <ellipse
        cx="100"
        cy="100"
        rx="92"
        ry="38"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-24 100 100)"
      />
      <ellipse
        cx="100"
        cy="100"
        rx="72"
        ry="30"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(18 100 100)"
      />
      <circle cx="100" cy="100" r="52" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="14" fill="currentColor" />
    </svg>
  );
}
