import type { Request, Response } from 'express';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../lib/cookies.js';
import { requireContext } from '../middleware/authenticate.js';
import type { ForgotPasswordBody, LoginBody, ResetPasswordBody } from '../schemas/auth.schemas.js';
import type { AuthSession } from '../services/auth.service.js';
import {
  currentUser,
  login,
  logout,
  refresh,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service.js';

/**
 * Controllers do three things and nothing else: read the request, call one
 * service, shape the response. Every rule about who may do what, and every
 * database access, lives in the service layer — if a decision is being made
 * in this file, it is in the wrong file.
 */

/**
 * The refresh token is returned as a cookie and never in the response body.
 * A body would land in JavaScript's hands, and therefore in the hands of any
 * script that manages to run on the page.
 */
function sessionResponse(res: Response, session: AuthSession, status = 200): void {
  setRefreshCookie(res, session.refreshToken);
  res.status(status).json({
    accessToken: session.accessToken,
    expiresInSeconds: session.expiresInSeconds,
    user: session.user,
  });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginBody;
  sessionResponse(res, await login(email, password, req.metadata));
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    clearRefreshCookie(res);
    res.status(401).json({
      error: { code: 'REFRESH_TOKEN_MISSING', message: 'No refresh token present' },
    });
    return;
  }

  try {
    sessionResponse(res, await refresh(token, req.metadata));
  } catch (error) {
    // A refresh that fails leaves a cookie the browser would keep retrying
    // with. Clearing it turns an endless 401 loop into one clean redirect.
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME];

  await logout(typeof token === 'string' ? token : undefined, req.context ?? null, req.metadata);

  clearRefreshCookie(res);
  res.status(204).send();
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  res.json({ user: await currentUser(requireContext(req)) });
}

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordBody;
  await requestPasswordReset(email, req.metadata);

  // Always 202, whether or not that address belongs to anyone. Answering
  // differently would turn this endpoint into a free way to discover which of
  // Kosmos's clients have accounts.
  res.status(202).json({
    message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.',
  });
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as ResetPasswordBody;
  await resetPassword(token, password, req.metadata);

  // Every session is now revoked, including this browser's. Clearing the
  // cookie keeps the client's state honest about that.
  clearRefreshCookie(res);
  res.status(204).send();
}
