import { createContext } from 'react';
import type { AuthenticatedUser, SessionResponse } from '@/lib/api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Used by the invite flow, which signs the user in as part of accepting. */
  adoptSession: (session: SessionResponse) => void;
  /** Replace the signed-in user in place — after they edit their own profile. */
  updateUser: (user: AuthenticatedUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
