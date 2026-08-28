import { beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import { readAuditActions } from './helpers/database.js';
import {
  assignTrackToTenant,
  completeLesson,
  createSuperadmin,
  createTenantWithUsers,
  createTrackWithLessons,
} from './helpers/factories.js';

/**
 * The per-client drill-down — one company's onboarding, lesson by lesson.
 * This is the audited reach into a single tenant, so the tests assert both the
 * data and that opening it left a TENANT_SCOPE_OVERRIDDEN line behind.
 */
describe('client drill-down', () => {
  let superadminToken: string;

  beforeEach(async () => {
    useCapturingEmails();
    superadminToken = await loginAs((await createSuperadmin()).email);
  });

  it('is refused to a client owner', async () => {
    const alfa = await createTenantWithUsers('Alfa');
    const ownerToken = await loginAs(alfa.owner.email);

    const response = await api()
      .get(`/clients/${alfa.tenant.id}`)
      .set('Authorization', bearer(ownerToken))
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns the members, tracks and per-lesson progress', async () => {
    const alfa = await createTenantWithUsers('Alfa');
    const { track, lessons } = await createTrackWithLessons(2);
    await assignTrackToTenant(track.id, alfa.tenant.id);
    await completeLesson(alfa.owner.id, lessons[0]!.id, alfa.tenant.id);

    const response = await api()
      .get(`/clients/${alfa.tenant.id}`)
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    const body = response.body as {
      tenant: { id: string; name: string };
      members: { id: string; role: string; lessonsCompleted: number; lessonsTotal: number; percent: number }[];
      tracks: { id: string; modules: { lessons: { id: string }[] }[] }[];
      progress: { userId: string; lessonId: string; status: string }[];
    };

    expect(body.tenant.id).toBe(alfa.tenant.id);

    // Owner and member are both listed.
    expect(body.members).toHaveLength(2);
    const owner = body.members.find((m) => m.id === alfa.owner.id);
    expect(owner?.lessonsCompleted).toBe(1);
    expect(owner?.lessonsTotal).toBe(2);
    expect(owner?.percent).toBe(50);

    // The assigned track and its two lessons are present.
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0]?.modules[0]?.lessons).toHaveLength(2);

    // The sparse matrix has exactly the one completed cell.
    expect(body.progress).toHaveLength(1);
    expect(body.progress[0]).toMatchObject({
      userId: alfa.owner.id,
      lessonId: lessons[0]!.id,
      status: 'completed',
    });
  });

  it('records the access as a scope override in the audit log', async () => {
    const alfa = await createTenantWithUsers('Alfa');

    await api()
      .get(`/clients/${alfa.tenant.id}`)
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    expect(await readAuditActions()).toContain('TENANT_SCOPE_OVERRIDDEN');
  });

  it('never leaks another tenant into the drill-down', async () => {
    const { track, lessons } = await createTrackWithLessons(2);

    const alfa = await createTenantWithUsers('Alfa');
    await assignTrackToTenant(track.id, alfa.tenant.id);

    // Beta shares the same track and has its own progress on it.
    const beta = await createTenantWithUsers('Beta');
    await assignTrackToTenant(track.id, beta.tenant.id);
    await completeLesson(beta.owner.id, lessons[0]!.id, beta.tenant.id);

    const response = await api()
      .get(`/clients/${alfa.tenant.id}`)
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    const body = response.body as {
      members: { id: string }[];
      progress: { userId: string }[];
    };

    const memberIds = new Set(body.members.map((m) => m.id));
    expect(memberIds.has(beta.owner.id)).toBe(false);
    expect(memberIds.has(alfa.owner.id)).toBe(true);
    // Beta's completion on the shared lesson must not appear here.
    expect(body.progress.every((p) => p.userId !== beta.owner.id)).toBe(true);
    expect(body.progress).toHaveLength(0);
  });

  it('answers 404 for a tenant that does not exist', async () => {
    await api()
      .get('/clients/01a00000-0000-7000-8000-000000000000')
      .set('Authorization', bearer(superadminToken))
      .expect(404);
  });
});
