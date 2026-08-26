import { beforeEach, describe, expect, it } from 'vitest';
import { runInTenantScope } from '../src/db/scoped-db.js';
import { listProgressForLessons } from '../src/repositories/progress.repository.js';
import { FakeVideoProvider } from '../src/services/video/fake-video-provider.js';
import { setVideoProvider } from '../src/services/video/index.js';
import { api, bearer, loginAs } from './helpers/api.js';
import { rawQuery } from './helpers/database.js';
import {
  assignTrackToTenant,
  completeLesson,
  createTenantWithUsers,
  createTrackWithLessons,
} from './helpers/factories.js';

/**
 * The Phase 2 counterpart to `tenant-isolation` and `content-isolation`.
 *
 * The question here is sharper than "can Alfa read Beta's track?", because the
 * library is shared on purpose — one Track row, many companies, and both may
 * legitimately hold the same trilha. The question is whether Alfa can learn
 * anything about **Beta's people**: what they watched, how far they got,
 * whether they started at all.
 *
 * Progress is where a leak would be most personal, and least visible.
 */

async function twoCompaniesOnTheSameTrack() {
  const alfa = await createTenantWithUsers('Alfa');
  const beta = await createTenantWithUsers('Beta');

  const { track, lessons } = await createTrackWithLessons(3);

  await assignTrackToTenant(track.id, alfa.tenant.id);
  await assignTrackToTenant(track.id, beta.tenant.id);

  return { alfa, beta, track, lessons };
}

beforeEach(() => {
  setVideoProvider(new FakeVideoProvider());
});

describe('progress isolation — the same trilha, two companies', () => {
  it('shows a client their own progress and never their neighbour-s', async () => {
    const { alfa, beta, lessons } = await twoCompaniesOnTheSameTrack();

    // Beta is one lesson in. Alfa has watched nothing.
    await completeLesson(beta.owner.id, lessons[0]!.id, beta.tenant.id);

    const token = await loginAs(alfa.owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/progress`)
      .set('Authorization', bearer(token))
      .expect(200);

    const body = response.body as {
      progress: { lessons: { completed: boolean; locked: boolean }[] };
    };

    // Alfa sees their own state: nothing done, only the first lesson open.
    expect(body.progress.lessons[0]!.completed).toBe(false);
    expect(body.progress.lessons[1]!.locked).toBe(true);
  });

  it('does not let one company-s progress unlock another company-s lessons', async () => {
    const { alfa, beta, lessons } = await twoCompaniesOnTheSameTrack();

    await completeLesson(beta.owner.id, lessons[0]!.id, beta.tenant.id);

    const token = await loginAs(alfa.owner.email);

    // Beta finished lesson 1. That must do nothing whatsoever for Alfa.
    const response = await api()
      .get(`/lessons/${lessons[1]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(403);

    expect((response.body as { error: { code: string } }).error.code).toBe('LESSON_LOCKED');
  });

  it('writes a heartbeat against the caller-s own tenant, never the other', async () => {
    const { alfa, beta, lessons } = await twoCompaniesOnTheSameTrack();

    const token = await loginAs(alfa.owner.email);

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 12 })
      .expect(200);

    const rows = await rawQuery<{ tenant_id: string; user_id: string }>(
      'SELECT tenant_id, user_id FROM lesson_progress',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenant_id).toBe(alfa.tenant.id);
    expect(rows[0]!.tenant_id).not.toBe(beta.tenant.id);
    expect(rows[0]!.user_id).toBe(alfa.owner.id);
  });

  it('keeps two companies-s watch events apart in the telemetry table', async () => {
    const { alfa, beta, lessons } = await twoCompaniesOnTheSameTrack();

    const alfaToken = await loginAs(alfa.owner.email);
    const betaToken = await loginAs(beta.owner.email);

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(alfaToken))
      .send({ positionSeconds: 10 })
      .expect(200);

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(betaToken))
      .send({ positionSeconds: 20 })
      .expect(200);

    const alfaEvents = await rawQuery<{ position_seconds: number }>(
      'SELECT position_seconds FROM watch_events WHERE tenant_id = $1',
      [alfa.tenant.id],
    );
    const betaEvents = await rawQuery<{ position_seconds: number }>(
      'SELECT position_seconds FROM watch_events WHERE tenant_id = $1',
      [beta.tenant.id],
    );

    expect(alfaEvents.map((row) => row.position_seconds)).toEqual([10]);
    expect(betaEvents.map((row) => row.position_seconds)).toEqual([20]);
  });

  /**
   * The data layer directly, with no HTTP in the way.
   *
   * The endpoint tests above could all pass while the repository happily
   * returned everybody's rows, if the service filtered them afterwards.
   * Filtering after the fact is exactly the kind of protection that survives
   * until somebody adds a second caller.
   */
  it('returns nothing for the other company even when called from the data layer', async () => {
    const { alfa, beta, lessons } = await twoCompaniesOnTheSameTrack();

    await completeLesson(beta.owner.id, lessons[0]!.id, beta.tenant.id);

    const lessonIds = lessons.map((lesson) => lesson.id);

    // Asking, from inside Alfa's scope, for Beta's user id.
    const rows = await runInTenantScope(alfa.tenant.id, (db) =>
      listProgressForLessons(db, beta.owner.id, lessonIds),
    );

    expect(rows).toHaveLength(0);
  });
});

describe('progress isolation — a trilha only one company has', () => {
  it('answers 404 rather than 403 for a lesson the caller was never given', async () => {
    const alfa = await createTenantWithUsers('Alfa');
    const beta = await createTenantWithUsers('Beta');

    const { track, lessons } = await createTrackWithLessons(2);
    await assignTrackToTenant(track.id, beta.tenant.id);

    const token = await loginAs(alfa.owner.email);

    // Alfa must not be able to tell the difference between "Beta has this"
    // and "this does not exist".
    for (const path of [
      `/lessons/${lessons[0]!.id}/playback`,
      `/lessons/${lessons[0]!.id}/progress`,
    ]) {
      const response = await api().get(path).set('Authorization', bearer(token)).expect(404);
      expect((response.body as { error: { code: string } }).error.code).toBe('LESSON_NOT_FOUND');
    }
  });

  it('refuses a heartbeat for a lesson the caller was never given', async () => {
    const alfa = await createTenantWithUsers('Alfa');
    const beta = await createTenantWithUsers('Beta');

    const { track, lessons } = await createTrackWithLessons(1);
    await assignTrackToTenant(track.id, beta.tenant.id);

    const token = await loginAs(alfa.owner.email);

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 10 })
      .expect(404);

    // And nothing was written on the way to being refused.
    const rows = await rawQuery('SELECT id FROM lesson_progress');
    expect(rows).toHaveLength(0);
  });

  it('does not leak the other company-s progress through an unpublished trilha', async () => {
    const alfa = await createTenantWithUsers('Alfa');
    const { track, lessons } = await createTrackWithLessons(1, { published: false });
    await assignTrackToTenant(track.id, alfa.tenant.id);

    const token = await loginAs(alfa.owner.email);

    // Assigned, but still a draft. A client partway through a half-authored
    // trilha is worse than one who cannot see it yet.
    await api()
      .get(`/lessons/${lessons[0]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(404);
  });
});
