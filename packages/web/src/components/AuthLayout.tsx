import { Logo } from '@/components/Logo';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The frame every signed-out screen shares.
 *
 * One column, centred, nothing else on the page. There is exactly one thing
 * to do on each of these screens, and the layout should make that obvious
 * without a word of explanation.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-backdrop flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[26rem]">
        <div className="mb-9 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow-sm sm:p-8">
          <div className="mb-6 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>

          {children}
        </div>

        {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
      </div>
    </div>
  );
}
