import { Router } from 'express';
import {
  acceptInvitationHandler,
  createInvitationHandler,
  listInvitationsHandler,
  previewInvitationHandler,
} from '../controllers/invitation.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validateBody } from '../middleware/validate.js';
import { acceptInvitationSchema, createInvitationSchema } from '../schemas/invitation.schemas.js';

export const invitationRouter: Router = Router();

// ── Public: the accept page has no session yet ────────────────────────────
invitationRouter.get('/:token', previewInvitationHandler);
invitationRouter.post(
  '/:token/accept',
  validateBody(acceptInvitationSchema),
  acceptInvitationHandler,
);

// ── Authenticated ─────────────────────────────────────────────────────────
invitationRouter.post(
  '/',
  authenticate,
  requireRole('SUPERADMIN', 'CLIENT_OWNER'),
  validateBody(createInvitationSchema),
  createInvitationHandler,
);

invitationRouter.get(
  '/',
  authenticate,
  requireRole('SUPERADMIN', 'CLIENT_OWNER'),
  listInvitationsHandler,
);
