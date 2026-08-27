import { Router } from 'express';
import { listVideosHandler } from '../controllers/video.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';

/**
 * The video library, for authoring. Kosmos staff only: it exists so an author
 * can pick a video instead of pasting an id, and it reaches the vendor with a
 * key no client may ever hold.
 */
export const videoRouter: Router = Router();

videoRouter.use(authenticate, requireRole('SUPERADMIN'));
videoRouter.get('/', listVideosHandler);
