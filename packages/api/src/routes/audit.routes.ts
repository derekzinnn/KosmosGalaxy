import { Router } from 'express';
import { listAuditLogsHandler } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';

export const auditRouter: Router = Router();

auditRouter.use(authenticate);

/**
 * The audit viewer. Kosmos staff only — the ledger records actions across
 * every client, so it is not something a client account may read even for
 * their own company. The service re-checks the same rule.
 */
auditRouter.get('/', requireRole('SUPERADMIN'), listAuditLogsHandler);
