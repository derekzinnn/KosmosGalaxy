import { Router } from 'express';
import {
  createTenantHandler,
  getTenantHandler,
  listTenantsHandler,
  updateTenantHandler,
} from '../controllers/tenant.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validateBody } from '../middleware/validate.js';
import { createTenantSchema, updateTenantSchema } from '../schemas/tenant.schemas.js';

export const tenantRouter: Router = Router();

tenantRouter.use(authenticate);

tenantRouter.post(
  '/',
  requireRole('SUPERADMIN'),
  validateBody(createTenantSchema),
  createTenantHandler,
);

/**
 * Not restricted by role: the tenant guard already limits a client user to
 * their own company, so this returns every tenant for Kosmos staff and
 * exactly one for everybody else.
 */
tenantRouter.get('/', listTenantsHandler);
tenantRouter.get('/:id', getTenantHandler);

tenantRouter.patch(
  '/:id',
  requireRole('SUPERADMIN'),
  validateBody(updateTenantSchema),
  updateTenantHandler,
);
