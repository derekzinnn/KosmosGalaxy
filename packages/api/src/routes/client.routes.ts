import { Router } from 'express';
import { clientDrilldownHandler } from '../controllers/client-drilldown.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';

export const clientRouter: Router = Router();

clientRouter.use(authenticate);

/**
 * The per-client drill-down — one company's onboarding, lesson by lesson.
 * Kosmos staff only, and the service reaches into that one tenant through
 * `runAsSuperadminOnTenant`, which records the access as `TENANT_SCOPE_OVERRIDDEN`.
 */
clientRouter.get('/:tenantId', requireRole('SUPERADMIN'), clientDrilldownHandler);
