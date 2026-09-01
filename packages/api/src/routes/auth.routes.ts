import { raw, Router } from 'express';
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  removeAvatarHandler,
  resetPasswordHandler,
  setAvatarHandler,
  updateProfileHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimiters, passwordResetRateLimiters } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../schemas/auth.schemas.js';

export const authRouter: Router = Router();

authRouter.post('/login', ...loginRateLimiters, validateBody(loginSchema), loginHandler);

// Not rate limited by IP the way login is: a browser refreshes on a timer and
// a shared office NAT would trip a strict limit for everyone behind it. The
// token itself is single-use, and reuse detection is the real defence here.
authRouter.post('/refresh', refreshHandler);

authRouter.post('/logout', logoutHandler);

authRouter.get('/me', authenticate, meHandler);

// A user editing their own account. All three act on the authenticated id, so
// no role gate is needed — you can only ever reach yourself.
authRouter.patch('/me', authenticate, validateBody(updateProfileSchema), updateProfileHandler);

// The avatar is a raw image, not multipart. 50 MB ceiling: the browser crops
// and re-encodes to a small JPEG before upload, so this only bounds a direct
// API caller — the same shape as the track banner route, one size up.
authRouter.post(
  '/me/avatar',
  authenticate,
  raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '50mb' }),
  setAvatarHandler,
);
authRouter.delete('/me/avatar', authenticate, removeAvatarHandler);

authRouter.post(
  '/forgot-password',
  ...passwordResetRateLimiters,
  validateBody(forgotPasswordSchema),
  forgotPasswordHandler,
);

authRouter.post(
  '/reset-password',
  ...passwordResetRateLimiters,
  validateBody(resetPasswordSchema),
  resetPasswordHandler,
);
