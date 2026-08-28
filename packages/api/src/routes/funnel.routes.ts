import { Router } from 'express';
import { getFunnelHandler } from '../controllers/funnel.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';

export const funnelRouter: Router = Router();

funnelRouter.use(authenticate);

/**
 * The onboarding funnel — every client's stage at a glance. Kosmos staff only;
 * it reads across all tenants, which no client account may do. The service
 * re-checks the role.
 */
funnelRouter.get('/', requireRole('SUPERADMIN'), getFunnelHandler);
