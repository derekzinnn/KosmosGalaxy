import { Router } from 'express';
import {
  assignTrackHandler,
  createLessonHandler,
  createModuleHandler,
  createResourceHandler,
  createTrackHandler,
  deleteLessonHandler,
  deleteModuleHandler,
  deleteResourceHandler,
  deleteTrackHandler,
  getTrackHandler,
  listTrackAssignmentsHandler,
  listTracksHandler,
  myTracksHandler,
  publishTrackHandler,
  reorderLessonsHandler,
  reorderModulesHandler,
  trackReadinessHandler,
  unassignTrackHandler,
  unpublishTrackHandler,
  updateLessonHandler,
  updateModuleHandler,
  updateTrackHandler,
} from '../controllers/content.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validateBody } from '../middleware/validate.js';
import {
  assignTrackSchema,
  createTrackSchema,
  lessonSchema,
  moduleSchema,
  reorderSchema,
  resourceSchema,
  updateLessonSchema,
  updateModuleSchema,
  updateTrackSchema,
} from '../schemas/content.schemas.js';

/**
 * Course content.
 *
 * Authoring is Kosmos-only and gated at the route, so no service below has to
 * ask again. The single exception is `/tracks/mine`, which is what a client
 * calls to see their own assigned trilhas — the tenant guard, not a role
 * check, is what limits that to their own company.
 */
export const contentRouter: Router = Router();

contentRouter.use(authenticate);

// ── Client-facing ─────────────────────────────────────────────────────────
contentRouter.get('/mine', myTracksHandler);

// ── Everything below is Kosmos staff only ─────────────────────────────────
const staffOnly = requireRole('SUPERADMIN');

contentRouter.post('/', staffOnly, validateBody(createTrackSchema), createTrackHandler);
contentRouter.get('/', staffOnly, listTracksHandler);
contentRouter.get('/:trackId', staffOnly, getTrackHandler);
contentRouter.patch('/:trackId', staffOnly, validateBody(updateTrackSchema), updateTrackHandler);
contentRouter.delete('/:trackId', staffOnly, deleteTrackHandler);

contentRouter.get('/:trackId/readiness', staffOnly, trackReadinessHandler);
contentRouter.post('/:trackId/publish', staffOnly, publishTrackHandler);
contentRouter.post('/:trackId/unpublish', staffOnly, unpublishTrackHandler);

contentRouter.get('/:trackId/assignments', staffOnly, listTrackAssignmentsHandler);
contentRouter.post(
  '/:trackId/assignments',
  staffOnly,
  validateBody(assignTrackSchema),
  assignTrackHandler,
);
contentRouter.delete('/:trackId/assignments/:tenantId', staffOnly, unassignTrackHandler);

contentRouter.post('/:trackId/modules', staffOnly, validateBody(moduleSchema), createModuleHandler);
contentRouter.post(
  '/:trackId/modules/reorder',
  staffOnly,
  validateBody(reorderSchema),
  reorderModulesHandler,
);

/**
 * Modules, lessons and resources live at the top level rather than nested
 * under their whole ancestry. `/modules/:moduleId` is unambiguous because ids
 * are unique, and `/tracks/:trackId/modules/:moduleId/lessons/:lessonId` would
 * invite exactly the bug where the ancestry in the URL disagrees with reality.
 */
export const moduleRouter: Router = Router();
moduleRouter.use(authenticate, requireRole('SUPERADMIN'));

moduleRouter.patch('/:moduleId', validateBody(updateModuleSchema), updateModuleHandler);
moduleRouter.delete('/:moduleId', deleteModuleHandler);
moduleRouter.post('/:moduleId/lessons', validateBody(lessonSchema), createLessonHandler);
moduleRouter.post('/:moduleId/lessons/reorder', validateBody(reorderSchema), reorderLessonsHandler);

export const lessonRouter: Router = Router();
lessonRouter.use(authenticate, requireRole('SUPERADMIN'));

lessonRouter.patch('/:lessonId', validateBody(updateLessonSchema), updateLessonHandler);
lessonRouter.delete('/:lessonId', deleteLessonHandler);
lessonRouter.post('/:lessonId/resources', validateBody(resourceSchema), createResourceHandler);

export const resourceRouter: Router = Router();
resourceRouter.use(authenticate, requireRole('SUPERADMIN'));

resourceRouter.delete('/:resourceId', deleteResourceHandler);
