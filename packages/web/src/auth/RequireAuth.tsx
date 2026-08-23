import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoader } from '@/components/states/FullPageLoader';
import type { AuthenticatedUser } from '@/lib/api-client';
import { useAuth } from './useAuth';

interface RequireAuthProps {
  /** When set, only these roles may pass; anyone else is sent home. */
  allow?: readonly AuthenticatedUser['role'][];
}

/**
 * The route guard.
 *
 * While the session is still being restored it renders a loader rather than
 * redirecting — otherwise every page reload would flash the login screen for
 * a moment before landing the user back where they were.
 */
export function RequireAuth({ allow }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageLoader label="Carregando sua conta…" />;
  }

  if (status === 'unauthenticated' || !user) {
    // Remember where they were headed so login can send them back there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user away from the login and invite screens. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
