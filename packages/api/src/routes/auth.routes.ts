import { Router } from 'express';
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  resetPasswordHandler,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimiters, passwordResetRateLimiters } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../schemas/auth.schemas.js';

export const authRouter: Router = Router();

authRouter.post('/login', ...loginRateLimiters, validateBody(loginSchema), loginHandler);

// Not rate limited by IP the way login is: a browser refreshes on a timer and
// a shared office NAT would trip a strict limit for everyone behind it. The
// token itself is single-use, and reuse detection is the real defence here.
authRouter.post('/refresh', refreshHandler);

authRouter.post('/logout', logoutHandler);

authRouter.get('/me', authenticate, meHandler);

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
