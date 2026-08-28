import type { Request, Response } from 'express';
import { BadRequestError } from '../lib/errors.js';
import { requireContext } from '../middleware/authenticate.js';
import { removeTrackCover, setTrackCover } from '../services/track-cover.service.js';

/**
 * The image arrives as a raw body, not multipart: the route mounts
 * `express.raw` for image content types, so `req.body` is the Buffer itself and
 * `Content-Type` names the format. When the type is not one of the allowed
 * images, `express.raw` does not parse it and `req.body` is not a Buffer —
 * which is the caller sending something that is not an image.
 */
export async function setTrackCoverHandler(req: Request, res: Response): Promise<void> {
  const trackId = req.params.trackId as string;

  if (!Buffer.isBuffer(req.body)) {
    throw new BadRequestError('Banner must be a JPEG, PNG or WebP image', 'UNSUPPORTED_IMAGE_TYPE');
  }

  const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
  const track = await setTrackCover(requireContext(req), trackId, req.body, contentType);
  res.json({ track });
}

export async function removeTrackCoverHandler(req: Request, res: Response): Promise<void> {
  const trackId = req.params.trackId as string;
  const track = await removeTrackCover(requireContext(req), trackId);
  res.json({ track });
}
