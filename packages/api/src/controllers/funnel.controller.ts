import type { Request, Response } from 'express';
import { requireContext } from '../middleware/authenticate.js';
import { getFunnel } from '../services/funnel.service.js';

export async function getFunnelHandler(req: Request, res: Response): Promise<void> {
  res.json(await getFunnel(requireContext(req)));
}
