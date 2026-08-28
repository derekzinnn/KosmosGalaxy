import type { Request, Response } from 'express';
import { requireContext } from '../middleware/authenticate.js';
import { getClientDrilldown } from '../services/client-drilldown.service.js';

export async function clientDrilldownHandler(req: Request, res: Response): Promise<void> {
  const tenantId = req.params.tenantId as string;
  res.json(await getClientDrilldown(requireContext(req), tenantId));
}
