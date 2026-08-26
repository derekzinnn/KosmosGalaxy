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
import {
  heartbeatHandler,
  lessonProgressHandler,
  playbackHandler,
} from '../controllers/progress.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validateBody } from '../middleware/validate.js';
import { heartbeatSchema } from '../schemas/progress.schemas.js';
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
lessonRouter.use(authenticate);

/**
 * Playback and progress, for whoever is entitled to them.
 *
 * Deliberately not behind a role check. "Are you staff?" is the wrong
 * question here and would answer it backwards: staff may preview any lesson,
 * a client may reach only what their company was assigned and has unlocked.
 * Both services resolve that themselves, from the assignment and the unlock
 * rule — a finer test than any role gate could apply.
 */
lessonRouter.get('/:lessonId/playback', playbackHandler);
lessonRouter.get('/:lessonId/progress', lessonProgressHandler);
lessonRouter.post('/:lessonId/heartbeat', validateBody(heartbeatSchema), heartbeatHandler);

// ── Authoring, Kosmos staff only ──────────────────────────────────────────
const lessonStaffOnly = requireRole('SUPERADMIN');

lessonRouter.patch(
  '/:lessonId',
  lessonStaffOnly,
  validateBody(updateLessonSchema),
  updateLessonHandler,
);
lessonRouter.delete('/:lessonId', lessonStaffOnly, deleteLessonHandler);
lessonRouter.post(
  '/:lessonId/resources',
  lessonStaffOnly,
  validateBody(resourceSchema),
  createResourceHandler,
);

export const resourceRouter: Router = Router();
resourceRouter.use(authenticate, requireRole('SUPERADMIN'));

resourceRouter.delete('/:resourceId', deleteResourceHandler);
