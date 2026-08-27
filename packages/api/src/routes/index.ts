import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { contentRouter, lessonRouter, moduleRouter, resourceRouter } from './content.routes.js';
import { invitationRouter } from './invitation.routes.js';
import { tenantRouter } from './tenant.routes.js';
import { videoRouter } from './video.routes.js';

export const apiRouter: Router = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kosmos-galaxy-api' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/invitations', invitationRouter);
apiRouter.use('/tenants', tenantRouter);
apiRouter.use('/tracks', contentRouter);
apiRouter.use('/modules', moduleRouter);
apiRouter.use('/lessons', lessonRouter);
apiRouter.use('/resources', resourceRouter);
apiRouter.use('/videos', videoRouter);
