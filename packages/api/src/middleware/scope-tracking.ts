import type { NextFunction, Request, Response } from 'express';
import { withScopeOverrideTracking } from '../services/scope.service.js';

/**
 * Opens a per-request ledger of tenant-scope overrides.
 *
 * Everything `next()` triggers — however deep, however many awaits later —
 * shares this ledger, which is what makes "one audit row per admin action"
 * possible instead of one per query.
 */
export function scopeTracking(_req: Request, _res: Response, next: NextFunction): void {
  withScopeOverrideTracking(() => {
    next();
  });
}
