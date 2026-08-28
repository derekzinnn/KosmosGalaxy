import type { Request, Response } from 'express';
import { requireContext } from '../middleware/authenticate.js';
import { ValidationError } from '../lib/errors.js';
import { listAuditLogsSchema } from '../schemas/audit.schemas.js';
import { listAuditLog } from '../services/audit-query.service.js';

/**
 * Query parameters are parsed here rather than in a middleware because Express
 * 5 makes `req.query` a read-only getter, so the validated result cannot be
 * written back over it the way `validateBody` replaces `req.body`.
 */
export async function listAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const result = listAuditLogsSchema.safeParse(req.query);

  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  res.json(await listAuditLog(requireContext(req), result.data));
}
