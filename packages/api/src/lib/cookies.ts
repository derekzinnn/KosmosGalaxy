import type { Response } from 'express';
import { env } from '../config/env.js';

export const REFRESH_COOKIE_NAME = 'kg_refresh';

/**
 * The refresh token lives in a cookie the browser can hold but JavaScript
 * cannot read.
 *
 * - httpOnly: `document.cookie` cannot see it, so a cross-site scripting bug
 *   cannot steal a 30-day session.
 * - secure: only ever sent over HTTPS. Disabled in development because
 *   http://localhost would otherwise drop it silently.
 * - sameSite=lax: the browser sends it to our own site but not when a
 *   different site triggers the request, which is what defeats CSRF.
 *   This requires the API and the web app to share a registrable domain in
 *   production — see "Infra requirements" in CLAUDE.md.
 * - path=/auth: the cookie is only attached to authentication endpoints.
 *   Every other API call travels without it.
 */
const COOKIE_PATH = '/auth';

function baseOptions() {
  return {
    httpOnly: true,
    secure: !env.isDevelopment && !env.isTest,
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}
