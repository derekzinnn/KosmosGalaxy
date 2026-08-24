import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Readonly<Record<string, string>> = {
  SUPERADMIN: 'Equipe Kosmos',
  CLIENT_OWNER: 'Responsável',
  CLIENT_MEMBER: 'Participante',
};

/**
 * `end` on the root link so "Início" is not highlighted on every nested page —
 * without it, `/` matches `/admin/tracks` too and two tabs look active at once.
 */
function StaffLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * The frame every signed-in screen shares. Phase 0 has one page inside it;
 * the classroom navigation arrives in Phase 3 and slots in here.
 */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-6">
            <Logo />

            {user?.role === 'SUPERADMIN' ? (
              <nav aria-label="Áreas da Kosmos" className="hidden gap-1 sm:flex">
                <StaffLink to="/">Início</StaffLink>
                <StaffLink to="/admin/clients">Clientes</StaffLink>
                <StaffLink to="/admin/tracks">Trilhas</StaffLink>
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm leading-tight font-medium">{user.name}</p>
                  <p className="text-xs leading-tight text-muted-foreground">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </p>
                </div>
                <span
                  className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  aria-hidden
                >
                  {initialsOf(user.name)}
                </span>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void logout()}
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      {user?.role === 'SUPERADMIN' ? (
        <nav
          aria-label="Áreas da Kosmos"
          // Sticks directly beneath the 4rem header, so switching sections on a
          // phone never requires scrolling back to the top of a long editor.
          className="sticky top-16 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card/80 px-5 py-2 backdrop-blur-sm sm:hidden"
        >
          <StaffLink to="/">Início</StaffLink>
          <StaffLink to="/admin/clients">Clientes</StaffLink>
          <StaffLink to="/admin/tracks">Trilhas</StaffLink>
        </nav>
      ) : null}

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-5 py-6 text-xs text-muted-foreground">
          Kosmos Inteligência Digital
        </div>
      </footer>
    </div>
  );
}
