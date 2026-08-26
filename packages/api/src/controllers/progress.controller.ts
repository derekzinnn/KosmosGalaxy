import type { Request, Response } from 'express';
import { requireContext } from '../middleware/authenticate.js';
import type { HeartbeatBody } from '../schemas/progress.schemas.js';
import { issuePlayback } from '../services/playback.service.js';
import { describeTrackProgress, recordHeartbeat } from '../services/progress.service.js';

function param(req: Request, name: string): string {
  return req.params[name] as string;
}

export async function playbackHandler(req: Request, res: Response): Promise<void> {
  const ticket = await issuePlayback(requireContext(req), param(req, 'lessonId'));

  // A signed, viewer-specific, expiring URL is the definition of something a
  // shared cache must never keep. Belt and braces alongside the short TTL.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ playback: ticket });
}

export async function heartbeatHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as HeartbeatBody;

  const progress = await recordHeartbeat(
    requireContext(req),
    param(req, 'lessonId'),
    body.positionSeconds,
  );

  res.json({ progress });
}

export async function lessonProgressHandler(req: Request, res: Response): Promise<void> {
  const progress = await describeTrackProgress(requireContext(req), param(req, 'lessonId'));
  res.json({ progress });
}
