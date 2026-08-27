import type { Request, Response } from 'express';
import { listLibraryVideos } from '../services/video.service.js';

export async function listVideosHandler(_req: Request, res: Response): Promise<void> {
  // The list changes as staff upload; a stale cache would hide a video that
  // was just added, which is exactly when someone is looking for it.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ videos: await listLibraryVideos() });
}
