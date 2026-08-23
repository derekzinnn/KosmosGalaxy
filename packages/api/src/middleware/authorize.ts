import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import { ForbiddenError } from '../lib/errors.js';
import { requireContext } from './authenticate.js';

/**
 * Coarse role gate.
 *
 * This answers "may this kind of user call this endpoint at all?" — never
 * "may they touch this particular row". Row-level questions belong to the
 * tenant guard, which cannot be forgotten; a role check here that stood in
 * for one would be exactly the scattered `if` this codebase avoids.
 */
export function requireRole(...roles: readonly Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context = requireContext(req);

    if (!roles.includes(context.role)) {
      next(
        new ForbiddenError(
          `This endpoint requires one of: ${roles.join(', ')}`,
          'INSUFFICIENT_ROLE',
        ),
      );
      return;
    }

    next();
  };
}
