import type { NextFunction, Request, Response } from 'express';

/**
 * Captures where a request came from, before anyone is authenticated.
 *
 * Every audit row records this, so a failed login attempt is still traceable
 * even though it belongs to no user. `req.ip` is only trustworthy when
 * TRUST_PROXY matches the real number of proxies in front of the API — see
 * "Infra requirements" in CLAUDE.md.
 */
export function requestMetadata(req: Request, _res: Response, next: NextFunction): void {
  const userAgent = req.get('user-agent');

  req.metadata = {
    ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: userAgent ? userAgent.slice(0, 512) : null,
  };

  next();
}
