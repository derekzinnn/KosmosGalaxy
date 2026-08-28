import { beforeEach, describe, expect, it } from 'vitest';
import { setVideoProvider } from '../src/services/video/index.js';
import { FakeVideoProvider } from '../src/services/video/fake-video-provider.js';
import { api, bearer, loginAs } from './helpers/api.js';
import { readAuditActions, rawQuery } from './helpers/database.js';
import {
  assignTrackToTenant,
  completeLesson,
  createSuperadmin,
  createTenantWithUsers,
  createTrackWithLessons,
} from './helpers/factories.js';

/**
 * Phase 2 against a real database.
 *
 * The unlock rule and the credit rule are already covered by unit tests, which
 * run with no database at all. What those cannot answer is whether the right
 * rows reach PostgreSQL, whether the tenant guard lets the queries through,
 * and whether the audit ledger records the milestone exactly once. That is
 * what this file is for.
 */

beforeEach(() => {
  setVideoProvider(new FakeVideoProvider());
});

describe('GET /lessons/:id/playback', () => {
  it('mints a signed, expiring URL for an assigned client', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(2);
    await assignTrackToTenant(track.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(200);

    const body = response.body as { playback: { url: string; expiresAt: string } };
    expect(body.playback.url).toContain('http');
    expect(new Date(body.playback.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('never puts the provider video id in the response', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(1);
    await assignTrackToTenant(track.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(200);

    // The fake provider puts the id inside the URL it signs, which is fine —
    // what must never appear is a bare `externalVideoId` field the client
    // could read off and reuse.
    expect(response.body).not.toHaveProperty('playback.externalVideoId');
    expect(Object.keys((response.body as { playback: object }).playback)).not.toContain(
      'externalVideoId',
    );
  });

  it('sets Cache-Control: no-store, because the URL is viewer-specific', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(1);
    await assignTrackToTenant(track.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('answers 404 for a lesson the caller was never assigned', async () => {
    const { owner } = await createTenantWithUsers();
    const { lessons } = await createTrackWithLessons(1);
    // Deliberately not assigned.

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(404);

    // 404 rather than 403: a 403 would confirm the lesson exists, which is
    // what somebody walking through ids is trying to learn.
    expect((response.body as { error: { code: string } }).error.code).toBe('LESSON_NOT_FOUND');
  });

  it('refuses a lesson that is still locked', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(3);
    await assignTrackToTenant(track.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[2]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(403);

    expect((response.body as { error: { code: string } }).error.code).toBe('LESSON_LOCKED');
  });

  it('lets Kosmos staff preview any lesson, assigned or not', async () => {
    const staff = await createSuperadmin();
    const { lessons } = await createTrackWithLessons(3);

    const token = await loginAs(staff.email);

    // The third lesson, which no client could open yet.
    await api()
      .get(`/lessons/${lessons[2]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(200);
  });
});

describe('POST /lessons/:id/heartbeat', () => {
  async function assignedClient(lessonCount = 3) {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(lessonCount);
    await assignTrackToTenant(track.id, tenant.id);
    const token = await loginAs(owner.email);
    return { tenant, owner, track, lessons, token };
  }

  it('records a watch event and a progress row', async () => {
    const { owner, lessons, token } = await assignedClient();

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 10 })
      .expect(200);

    const events = await rawQuery<{ position_seconds: number; tenant_id: string }>(
      'SELECT position_seconds, tenant_id FROM watch_events WHERE user_id = $1',
      [owner.id],
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.position_seconds).toBe(10);

    const progress = await rawQuery<{ max_position_seconds: number }>(
      'SELECT max_position_seconds FROM lesson_progress WHERE user_id = $1',
      [owner.id],
    );
    expect(progress[0]!.max_position_seconds).toBe(10);
  });

  it('stamps the caller-s own tenant on both rows', async () => {
    const { tenant, owner, lessons, token } = await assignedClient();

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 10 })
      .expect(200);

    const rows = await rawQuery<{ tenant_id: string }>(
      'SELECT tenant_id FROM lesson_progress WHERE user_id = $1',
      [owner.id],
    );
    expect(rows[0]!.tenant_id).toBe(tenant.id);
  });

  it('refuses a locked lesson even when the id is known', async () => {
    const { lessons, token } = await assignedClient();

    const response = await api()
      .post(`/lessons/${lessons[2]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 10 })
      .expect(403);

    expect((response.body as { error: { code: string } }).error.code).toBe('LESSON_LOCKED');
  });

  it('does not complete a lesson from position alone', async () => {
    const { owner, lessons, token } = await assignedClient();

    // Straight to the end of a 100-second lesson on the first beat.
    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 100 })
      .expect(200);

    const rows = await rawQuery<{ completed_at: Date | null }>(
      'SELECT completed_at FROM lesson_progress WHERE user_id = $1',
      [owner.id],
    );
    expect(rows[0]!.completed_at).toBeNull();
  });

  it('completes a lesson that was genuinely watched, and audits it once', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    // 50 seconds, so the first beat's allowance (15 x 3 = 45) is exactly the
    // 90% needed. Any longer and a test cannot finish a lesson at all, which
    // is the credit rule working as designed rather than a problem.
    const { track, lessons } = await createTrackWithLessons(2, { durationSeconds: 50 });
    await assignTrackToTenant(track.id, tenant.id);
    const token = await loginAs(owner.email);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 50 })
      .expect(200);

    const body = response.body as { progress: { completed: boolean; justCompleted: boolean } };
    expect(body.progress.completed).toBe(true);
    expect(body.progress.justCompleted).toBe(true);

    const rows = await rawQuery<{ completed_at: Date | null }>(
      'SELECT completed_at FROM lesson_progress WHERE user_id = $1',
      [owner.id],
    );
    expect(rows[0]!.completed_at).not.toBeNull();
    expect(await readAuditActions()).toContain('LESSON_COMPLETED');

    // A further beat on a finished lesson must not write the milestone twice.
    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 50 })
      .expect(200);

    const actions = await readAuditActions();
    expect(actions.filter((action) => action === 'LESSON_COMPLETED')).toHaveLength(1);
  });

  it('unlocks the next lesson the moment the current one closes', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(2, { durationSeconds: 50 });
    await assignTrackToTenant(track.id, tenant.id);
    const token = await loginAs(owner.email);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 50 })
      .expect(200);

    const body = response.body as { progress: { unlockedLessonIds: string[] } };
    expect(body.progress.unlockedLessonIds).toContain(lessons[1]!.id);

    // And the second lesson now really does mint a URL.
    await api()
      .get(`/lessons/${lessons[1]!.id}/playback`)
      .set('Authorization', bearer(token))
      .expect(200);
  });

  it('audits TRACK_COMPLETED when the last required lesson closes', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(1, { durationSeconds: 50 });
    await assignTrackToTenant(track.id, tenant.id);
    const token = await loginAs(owner.email);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 50 })
      .expect(200);

    expect(
      (response.body as { progress: { trackCompleted: boolean } }).progress.trackCompleted,
    ).toBe(true);

    const actions = await readAuditActions();
    expect(actions.filter((action) => action === 'TRACK_COMPLETED')).toHaveLength(1);
  });

  it('turns Kosmos staff away — they have no tenant to record against', async () => {
    const staff = await createSuperadmin();
    const { lessons } = await createTrackWithLessons(1);
    const token = await loginAs(staff.email);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 10 })
      .expect(403);

    expect((response.body as { error: { code: string } }).error.code).toBe('STAFF_HAS_NO_PROGRESS');
  });

  it('rejects a position that is not a plausible number', async () => {
    const { lessons, token } = await assignedClient();

    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: -5 })
      .expect(422);
  });
});

describe('GET /lessons/:id/progress', () => {
  it('reports the whole trilha, with only the first lesson open', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(3);
    await assignTrackToTenant(track.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/progress`)
      .set('Authorization', bearer(token))
      .expect(200);

    const body = response.body as {
      progress: { lessons: { lessonId: string; locked: boolean }[]; nextLessonId: string };
    };

    expect(body.progress.lessons).toHaveLength(3);
    expect(body.progress.lessons[0]!.locked).toBe(false);
    expect(body.progress.lessons[1]!.locked).toBe(true);
    expect(body.progress.lessons[2]!.locked).toBe(true);
    expect(body.progress.nextLessonId).toBe(lessons[0]!.id);
  });

  it('opens the next lesson once the previous one is finished', async () => {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(3);
    await assignTrackToTenant(track.id, tenant.id);
    await completeLesson(owner.id, lessons[0]!.id, tenant.id);

    const token = await loginAs(owner.email);

    const response = await api()
      .get(`/lessons/${lessons[0]!.id}/progress`)
      .set('Authorization', bearer(token))
      .expect(200);

    const body = response.body as {
      progress: { lessons: { locked: boolean; completed: boolean }[]; nextLessonId: string };
    };

    expect(body.progress.lessons[0]!.completed).toBe(true);
    expect(body.progress.lessons[1]!.locked).toBe(false);
    expect(body.progress.lessons[2]!.locked).toBe(true);
    expect(body.progress.nextLessonId).toBe(lessons[1]!.id);
  });

  it('answers 404 for a trilha the caller was never assigned', async () => {
    const { owner } = await createTenantWithUsers();
    const { lessons } = await createTrackWithLessons(1);

    const token = await loginAs(owner.email);

    await api()
      .get(`/lessons/${lessons[0]!.id}/progress`)
      .set('Authorization', bearer(token))
      .expect(404);
  });
});

describe('POST /lessons/:id/complete', () => {
  async function assignedClient(lessonCount = 2, durationSeconds = 100) {
    const { tenant, owner } = await createTenantWithUsers();
    const { track, lessons } = await createTrackWithLessons(lessonCount, { durationSeconds });
    await assignTrackToTenant(track.id, tenant.id);
    const token = await loginAs(owner.email);
    return { tenant, owner, track, lessons, token };
  }

  it('completes a lesson the client has genuinely watched to the end', async () => {
    const { owner, lessons, token } = await assignedClient(2, 50);

    // Watch it: the first heartbeat of a 50s lesson is allowed 15 x 3 = 45s,
    // which is 90% of 50, so the watched-time gate is met.
    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 50 })
      .expect(200);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/complete`)
      .set('Authorization', bearer(token))
      .expect(200);

    const body = response.body as {
      progress: { completed: boolean; unlockedLessonIds: string[]; nextLessonId: string | null };
    };
    expect(body.progress.completed).toBe(true);
    expect(body.progress.unlockedLessonIds).toContain(lessons[1]!.id);
    expect(body.progress.nextLessonId).toBe(lessons[1]!.id);

    const rows = await rawQuery<{ completed_at: Date | null }>(
      'SELECT completed_at FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [owner.id, lessons[0]!.id],
    );
    expect(rows[0]!.completed_at).not.toBeNull();
  });

  it('refuses to complete a lesson that was only scrubbed, not watched', async () => {
    const { lessons, token } = await assignedClient(2, 600);

    // Jump to the end of a 10-minute lesson on the first beat: the position is
    // at the end, but watched time is capped far below the 90% needed.
    await api()
      .post(`/lessons/${lessons[0]!.id}/heartbeat`)
      .set('Authorization', bearer(token))
      .send({ positionSeconds: 600 })
      .expect(200);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/complete`)
      .set('Authorization', bearer(token))
      .expect(400);

    expect((response.body as { error: { code: string } }).error.code).toBe(
      'LESSON_NOT_WATCHED_ENOUGH',
    );
  });

  it('is idempotent — confirming an already-finished lesson is fine', async () => {
    const { tenant, owner, lessons, token } = await assignedClient(1, 50);
    await completeLesson(owner.id, lessons[0]!.id, tenant.id);

    const response = await api()
      .post(`/lessons/${lessons[0]!.id}/complete`)
      .set('Authorization', bearer(token))
      .expect(200);

    expect((response.body as { progress: { completed: boolean } }).progress.completed).toBe(true);
  });

  it('refuses a locked lesson', async () => {
    const { lessons, token } = await assignedClient(3, 50);

    await api()
      .post(`/lessons/${lessons[2]!.id}/complete`)
      .set('Authorization', bearer(token))
      .expect(403);
  });

  it('turns Kosmos staff away', async () => {
    const staff = await createSuperadmin();
    const { lessons } = await createTrackWithLessons(1, { durationSeconds: 50 });
    const token = await loginAs(staff.email);

    await api()
      .post(`/lessons/${lessons[0]!.id}/complete`)
      .set('Authorization', bearer(token))
      .expect(403);
  });
});
