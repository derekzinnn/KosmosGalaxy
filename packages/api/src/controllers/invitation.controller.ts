import type { Request, Response } from 'express';
import { setRefreshCookie } from '../lib/cookies.js';
import { requireContext } from '../middleware/authenticate.js';
import type { AcceptInvitationBody, CreateInvitationBody } from '../schemas/invitation.schemas.js';
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
} from '../services/invitation.service.js';

export async function createInvitationHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateInvitationBody;

  const invitation = await createInvitation(requireContext(req), {
    email: body.email,
    role: body.role,
    tenantId: body.tenantId ?? null,
  });

  res.status(201).json({ invitation });
}

export async function listInvitationsHandler(req: Request, res: Response): Promise<void> {
  res.json({ invitations: await listInvitations(requireContext(req)) });
}

/**
 * Public. Deliberately returns the bare minimum the accept page needs to
 * render: the invited email, the company name, the role. Nothing that would
 * be useful to someone who found the link by accident.
 */
export async function previewInvitationHandler(req: Request, res: Response): Promise<void> {
  const token = req.params.token as string;
  res.json({ invitation: await previewInvitation(token) });
}

export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  const token = req.params.token as string;
  const body = req.body as AcceptInvitationBody;

  const session = await acceptInvitation(
    token,
    { name: body.name, password: body.password },
    req.metadata,
  );

  setRefreshCookie(res, session.refreshToken);
  res.status(201).json({
    accessToken: session.accessToken,
    expiresInSeconds: session.expiresInSeconds,
    user: session.user,
  });
}
