import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';
import type { RequestContext } from '../types/request-context.js';

/**
 * Turns an access token into a RequestContext.
 *
 * This runs once per request and is the only place a token is read. Nothing
 * downstream ever parses a token again, so there is exactly one answer to
 * "who is this?" for the whole request.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing bearer token', 'TOKEN_MISSING'));
    return;
  }

  try {
    const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());

    const context: RequestContext = {
      userId: claims.userId,
      email: claims.email,
      role: claims.role,
      tenantId: claims.tenantId,
      ip: req.metadata.ip,
      userAgent: req.metadata.userAgent,
    };

    req.context = context;
    next();
  } catch (error) {
    next(error);
  }
}

/** Narrow `req.context` from optional to guaranteed for handlers behind authenticate. */
export function requireContext(req: Request): RequestContext {
  if (!req.context) {
    throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
  }
  return req.context;
}
