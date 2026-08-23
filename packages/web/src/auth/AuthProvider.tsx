import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  authApi,
  setAccessToken,
  setSessionExpiredListener,
  type AuthenticatedUser,
  type SessionResponse,
} from '@/lib/api-client';
import { AuthContext, type AuthStatus } from './auth-context';

/**
 * Renew this many seconds before the access token actually expires, so a
 * request never has to fail and retry to discover the token has gone stale.
 */
const RENEW_MARGIN_SECONDS = 60;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const renewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleNext = useRef<(expiresInSeconds: number) => void>(() => undefined);

  const clearSession = useCallback(() => {
    clearTimeout(renewTimer.current);
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const adoptSession = useCallback((session: SessionResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  /**
   * Silent refresh.
   *
   * The point is that the client never notices. Left to expire, the token
   * would lapse mid-click and the first request after that would stall while
   * it renewed; renewing a minute early means every request already has a
   * valid token in hand.
   */
  const scheduleRenewal = useCallback(
    (expiresInSeconds: number) => {
      clearTimeout(renewTimer.current);

      const delay = Math.max(expiresInSeconds - RENEW_MARGIN_SECONDS, 30) * 1000;

      renewTimer.current = setTimeout(() => {
        void (async () => {
          const session = await authApi.restore();
          if (session) {
            adoptSession(session);
            // Each renewal schedules the next one. The call goes through a ref
            // because a useCallback cannot reference itself while it is still
            // being defined.
            scheduleNext.current(session.expiresInSeconds);
          } else {
            clearSession();
          }
        })();
      }, delay);
    },
    [adoptSession, clearSession],
  );

  // Kept in sync in an effect, not during render: a ref written while
  // rendering can be stale or torn under concurrent rendering.
  useEffect(() => {
    scheduleNext.current = scheduleRenewal;
  }, [scheduleRenewal]);

  // On boot, ask whether the refresh cookie still holds a session. This is
  // what makes a page reload keep you signed in without storing a token where
  // a script could read it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = await authApi.restore();
      if (cancelled) return;

      if (session) {
        adoptSession(session);
        scheduleRenewal(session.expiresInSeconds);
      } else {
        setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(renewTimer.current);
    };
  }, [adoptSession, scheduleRenewal]);

  // If a renewal fails deep inside some other request, the client tells us here.
  useEffect(() => {
    setSessionExpiredListener(clearSession);
    return () => setSessionExpiredListener(() => undefined);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login(email, password);
      adoptSession(session);
      scheduleRenewal(session.expiresInSeconds);
    },
    [adoptSession, scheduleRenewal],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Even if the call failed, this browser is done with the session.
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ status, user, login, logout, adoptSession }),
    [status, user, login, logout, adoptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
