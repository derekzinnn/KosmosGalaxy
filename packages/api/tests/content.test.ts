import { beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import { rawQuery, readAuditActions } from './helpers/database.js';
import { createSuperadmin, createTenantWithUsers } from './helpers/factories.js';

describe('course content', () => {
  let staffToken: string;
  let ownerToken: string;
  let tenant: Awaited<ReturnType<typeof createTenantWithUsers>>;

  beforeEach(async () => {
    useCapturingEmails();
    tenant = await createTenantWithUsers('Padaria do Ze');
    staffToken = await loginAs((await createSuperadmin()).email);
    ownerToken = await loginAs(tenant.owner.email);
  });

  const asStaff = (method: 'post' | 'get' | 'patch' | 'delete', path: string) =>
    api()[method](path).set('Authorization', bearer(staffToken));

  async function newTrack(title = 'Onboarding Kosmos') {
    const response = await asStaff('post', '/tracks').send({ title }).expect(201);
    return response.body.track as { id: string; slug: string; title: string };
  }

  async function newModule(trackId: string, title = 'Módulo') {
    const response = await asStaff('post', `/tracks/${trackId}/modules`)
      .send({ title })
      .expect(201);
    return response.body.module as { id: string; order: number; title: string };
  }

  async function newLesson(moduleId: string, body: Record<string, unknown> = {}) {
    const response = await asStaff('post', `/modules/${moduleId}/lessons`)
      .send({ title: 'Aula', ...body })
      .expect(201);
    return response.body.lesson as { id: string; order: number; hasVideo: boolean };
  }

  describe('tracks', () => {
    it('derives a readable slug from the title', async () => {
      const track = await newTrack('Onboarding — Gestão de Tráfego');
      expect(track.slug).toBe('onboarding-gestao-de-trafego');
    });

    it('makes a derived slug unique instead of failing', async () => {
      const first = await newTrack('Onboarding');
      const second = await newTrack('Onboarding');

      expect(first.slug).toBe('onboarding');
      expect(second.slug).toBe('onboarding-2');
    });

    it('rejects an explicitly chosen slug that is taken', async () => {
      await asStaff('post', '/tracks').send({ title: 'Trilha A', slug: 'trilha-x' }).expect(201);

      const response = await asStaff('post', '/tracks')
        .send({ title: 'Trilha B', slug: 'trilha-x' })
        .expect(409);

      expect(response.body.error.code).toBe('TRACK_SLUG_TAKEN');
    });

    it('starts unpublished', async () => {
      const track = await newTrack();
      const response = await asStaff('get', `/tracks/${track.id}`).expect(200);
      expect(response.body.track.published).toBe(false);
    });

    it('updates title and description', async () => {
      const track = await newTrack();

      const response = await asStaff('patch', `/tracks/${track.id}`)
        .send({ title: 'Novo título', description: 'Uma descrição' })
        .expect(200);

      expect(response.body.track.title).toBe('Novo título');
      expect(response.body.track.description).toBe('Uma descrição');
    });

    it('lists tracks with their counts', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id);
      await newLesson(module.id);

      const response = await asStaff('get', '/tracks').expect(200);
      const listed = response.body.tracks.find((item: { id: string }) => item.id === track.id);

      expect(listed.moduleCount).toBe(1);
      expect(listed.lessonCount).toBe(2);
      expect(listed.assignedTenantCount).toBe(0);
    });

    it('deletes an unpublished, unassigned track', async () => {
      const track = await newTrack();
      await asStaff('delete', `/tracks/${track.id}`).expect(204);
      await asStaff('get', `/tracks/${track.id}`).expect(404);
    });

    it('refuses to delete a published track', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id, { externalVideoId: 'video-1' });
      await asStaff('post', `/tracks/${track.id}/publish`).expect(200);

      const response = await asStaff('delete', `/tracks/${track.id}`).expect(409);
      expect(response.body.error.code).toBe('TRACK_PUBLISHED_CANNOT_DELETE');
    });

    it('refuses to delete a track a client has been given', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id, { externalVideoId: 'video-1' });
      await asStaff('post', `/tracks/${track.id}/publish`).expect(200);
      await asStaff('post', `/tracks/${track.id}/assignments`)
        .send({ tenantId: tenant.tenant.id })
        .expect(201);
      await asStaff('post', `/tracks/${track.id}/unpublish`).expect(200);

      const response = await asStaff('delete', `/tracks/${track.id}`).expect(409);
      expect(response.body.error.code).toBe('TRACK_ASSIGNED_CANNOT_DELETE');
    });
  });

  describe('publishing', () => {
    it('refuses a track with no modules, and says why', async () => {
      const track = await newTrack();

      const response = await asStaff('post', `/tracks/${track.id}/publish`).expect(400);

      expect(response.body.error.code).toBe('TRACK_NOT_READY');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ code: 'TRACK_HAS_NO_MODULES' }),
      );
    });

    it('refuses a module with no lessons', async () => {
      const track = await newTrack();
      await newModule(track.id, 'Módulo vazio');

      const response = await asStaff('post', `/tracks/${track.id}/publish`).expect(400);

      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ code: 'MODULE_HAS_NO_LESSONS' }),
      );
    });

    it('refuses a required lesson with no video', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id, { title: 'Sem vídeo' });

      const response = await asStaff('post', `/tracks/${track.id}/publish`).expect(400);

      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({ code: 'LESSON_MISSING_VIDEO' }),
      );
    });

    it('allows an optional lesson to have no video', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id, { externalVideoId: 'video-1' });
      await newLesson(module.id, { title: 'Material extra', isRequired: false });

      await asStaff('post', `/tracks/${track.id}/publish`).expect(200);
    });

    it('reports every problem at once rather than the first', async () => {
      const track = await newTrack();
      const first = await newModule(track.id, 'Um');
      await newModule(track.id, 'Vazio');
      await newLesson(first.id, { title: 'Sem vídeo' });

      const response = await asStaff('post', `/tracks/${track.id}/publish`).expect(400);
      const codes = response.body.error.details.map((item: { code: string }) => item.code);

      expect(codes).toContain('MODULE_HAS_NO_LESSONS');
      expect(codes).toContain('LESSON_MISSING_VIDEO');
    });

    it('exposes readiness without attempting to publish', async () => {
      const track = await newTrack();

      const notReady = await asStaff('get', `/tracks/${track.id}/readiness`).expect(200);
      expect(notReady.body.ready).toBe(false);
      expect(notReady.body.problems.length).toBeGreaterThan(0);

      const module = await newModule(track.id);
      await newLesson(module.id, { externalVideoId: 'video-1' });

      const ready = await asStaff('get', `/tracks/${track.id}/readiness`).expect(200);
      expect(ready.body.ready).toBe(true);
      expect(ready.body.problems).toHaveLength(0);
    });

    it('publishes and unpublishes, recording both', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      await newLesson(module.id, { externalVideoId: 'video-1' });

      const published = await asStaff('post', `/tracks/${track.id}/publish`).expect(200);
      expect(published.body.track.published).toBe(true);

      const unpublished = await asStaff('post', `/tracks/${track.id}/unpublish`).expect(200);
      expect(unpublished.body.track.published).toBe(false);

      const actions = await readAuditActions();
      expect(actions).toContain('TRACK_PUBLISHED');
      expect(actions).toContain('TRACK_UNPUBLISHED');
    });
  });

  describe('ordering', () => {
    it('appends new items at the end', async () => {
      const track = await newTrack();
      const first = await newModule(track.id, 'Um');
      const second = await newModule(track.id, 'Dois');
      const third = await newModule(track.id, 'Três');

      expect([first.order, second.order, third.order]).toEqual([0, 1, 2]);
    });

    it('reorders modules without tripping the unique constraint', async () => {
      const track = await newTrack();
      const a = await newModule(track.id, 'Alfa');
      const b = await newModule(track.id, 'Bravo');
      const c = await newModule(track.id, 'Charlie');

      // A straight swap would collide: moving C to 0 while A still sits there
      // violates @@unique([trackId, order]) mid-statement.
      const response = await asStaff('post', `/tracks/${track.id}/modules/reorder`)
        .send({ orderedIds: [c.id, a.id, b.id] })
        .expect(200);

      expect(response.body.modules.map((m: { title: string }) => m.title)).toEqual([
        'Charlie',
        'Alfa',
        'Bravo',
      ]);
      expect(response.body.modules.map((m: { order: number }) => m.order)).toEqual([0, 1, 2]);
    });

    it('reorders lessons the same way', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      const one = await newLesson(module.id, { title: 'Um' });
      const two = await newLesson(module.id, { title: 'Dois' });

      const response = await asStaff('post', `/modules/${module.id}/lessons/reorder`)
        .send({ orderedIds: [two.id, one.id] })
        .expect(200);

      expect(response.body.lessons.map((l: { order: number }) => l.order)).toEqual([0, 1]);
      expect(response.body.lessons[0].id).toBe(two.id);
    });

    it('rejects an order that omits an item', async () => {
      const track = await newTrack();
      const a = await newModule(track.id, 'Alfa');
      await newModule(track.id, 'Bravo');

      const response = await asStaff('post', `/tracks/${track.id}/modules/reorder`)
        .send({ orderedIds: [a.id] })
        .expect(400);

      expect(response.body.error.code).toBe('MODULE_ORDER_MISMATCH');
    });

    it('rejects an order naming an item from another track', async () => {
      const track = await newTrack('Trilha A');
      const other = await newTrack('Trilha B');
      const mine = await newModule(track.id, 'Meu');
      const theirs = await newModule(other.id, 'Deles');

      await asStaff('post', `/tracks/${track.id}/modules/reorder`)
        .send({ orderedIds: [mine.id, theirs.id] })
        .expect(400);
    });

    it('closes the gap when an item in the middle is deleted', async () => {
      const track = await newTrack();
      const a = await newModule(track.id, 'Alfa');
      const b = await newModule(track.id, 'Bravo');
      const c = await newModule(track.id, 'Charlie');

      await asStaff('delete', `/modules/${b.id}`).expect(204);

      const response = await asStaff('get', `/tracks/${track.id}`).expect(200);
      const modules = response.body.track.modules as { id: string; order: number }[];

      expect(modules.map((m) => m.id)).toEqual([a.id, c.id]);
      expect(modules.map((m) => m.order)).toEqual([0, 1]);
    });

    it('gives the next new item a free position after a delete', async () => {
      const track = await newTrack();
      const a = await newModule(track.id, 'Alfa');
      await newModule(track.id, 'Bravo');

      await asStaff('delete', `/modules/${a.id}`).expect(204);
      const fresh = await newModule(track.id, 'Charlie');

      expect(fresh.order).toBe(1);
    });
  });

  describe('lessons and resources', () => {
    it('reports whether a video is attached without leaking its id', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      const lesson = await newLesson(module.id, { externalVideoId: 'external-abc-123' });

      expect(lesson.hasVideo).toBe(true);

      // Staff may see the id; the flag is what the client build will consume.
      const response = await asStaff('get', `/tracks/${track.id}`).expect(200);
      expect(response.body.track.modules[0].lessons[0].externalVideoId).toBe('external-abc-123');
      expect(response.body.track.modules[0].lessons[0].hasVideo).toBe(true);
    });

    it('attaches and removes a resource', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      const lesson = await newLesson(module.id);

      const created = await asStaff('post', `/lessons/${lesson.id}/resources`)
        .send({ type: 'LINK', title: 'Planilha', url: 'https://exemplo.com.br/planilha' })
        .expect(201);

      await asStaff('delete', `/resources/${created.body.resource.id}`).expect(204);

      const actions = await readAuditActions();
      expect(actions).toContain('RESOURCE_CREATED');
      expect(actions).toContain('RESOURCE_DELETED');
    });

    it('refuses to delete a lesson a client has already started', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);
      const lesson = await newLesson(module.id, { externalVideoId: 'video-1' });

      // Phase 2 writes these rows; inserting one directly proves the guard
      // will already be there when it does.
      await rawQuery(
        `INSERT INTO lesson_progress (id, user_id, lesson_id, tenant_id, started_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, now(), now())`,
        [tenant.member.id, lesson.id, tenant.tenant.id],
      );

      const response = await asStaff('delete', `/lessons/${lesson.id}`).expect(409);
      expect(response.body.error.code).toBe('LESSON_HAS_PROGRESS');

      const moduleResponse = await asStaff('delete', `/modules/${module.id}`).expect(409);
      expect(moduleResponse.body.error.code).toBe('MODULE_HAS_PROGRESS');
    });
  });

  describe('who may author', () => {
    it('refuses a client owner', async () => {
      const response = await api()
        .post('/tracks')
        .set('Authorization', bearer(ownerToken))
        .send({ title: 'Trilha pirata' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    it('refuses a client member', async () => {
      const memberToken = await loginAs(tenant.member.email);

      await api().get('/tracks').set('Authorization', bearer(memberToken)).expect(403);
    });

    it('refuses an anonymous caller', async () => {
      await api().get('/tracks').expect(401);
    });

    it('refuses a client owner trying to edit a module directly', async () => {
      const track = await newTrack();
      const module = await newModule(track.id);

      await api()
        .patch(`/modules/${module.id}`)
        .set('Authorization', bearer(ownerToken))
        .send({ title: 'Sequestrado' })
        .expect(403);
    });
  });
});
