import { beforeEach, describe, expect, it } from 'vitest';
import { FakeVideoProvider } from '../src/services/video/fake-video-provider.js';
import { setVideoProvider } from '../src/services/video/index.js';
import { api, bearer, loginAs } from './helpers/api.js';
import {
  createSuperadmin,
  createTenantWithUsers,
  createTrackWithLessons,
  updateLessonVideo,
} from './helpers/factories.js';

/**
 * The authoring video library.
 *
 * Runs against the FakeVideoProvider's fixed list — the point under test is
 * the route's access control and shape, not Panda's uptime. That the real
 * provider returns the right ids was verified by hand against the live API.
 */

beforeEach(() => {
  setVideoProvider(new FakeVideoProvider());
});

describe('GET /videos', () => {
  it('lists the library for Kosmos staff', async () => {
    const staff = await createSuperadmin();
    const token = await loginAs(staff.email);

    const response = await api().get('/videos').set('Authorization', bearer(token)).expect(200);

    const body = response.body as { videos: { id: string; ready: boolean }[] };
    expect(body.videos.length).toBeGreaterThan(0);
    expect(body.videos[0]).toHaveProperty('id');
    expect(body.videos[0]).toHaveProperty('durationSeconds');
    expect(body.videos[0]).toHaveProperty('ready');
  });

  it('does not cache — a just-uploaded video must not be hidden', async () => {
    const staff = await createSuperadmin();
    const token = await loginAs(staff.email);

    const response = await api().get('/videos').set('Authorization', bearer(token)).expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('is closed to a client — the library is staff-only', async () => {
    const { owner } = await createTenantWithUsers();
    const token = await loginAs(owner.email);

    await api().get('/videos').set('Authorization', bearer(token)).expect(403);
  });

  it('is closed to anyone unauthenticated', async () => {
    await api().get('/videos').expect(401);
  });

  it('marks a video as in use once a lesson points at it', async () => {
    const staff = await createSuperadmin();
    const token = await loginAs(staff.email);

    // The fake provider's library includes 'fake-video-1'. Attach it to a lesson.
    const { lessons } = await createTrackWithLessons(1);
    await updateLessonVideo(lessons[0]!.id, 'fake-video-1');

    const response = await api().get('/videos').set('Authorization', bearer(token)).expect(200);

    const body = response.body as { videos: { id: string; inUse?: boolean }[] };
    const used = body.videos.find((v) => v.id === 'fake-video-1');
    const unused = body.videos.find((v) => v.id === 'fake-video-2');
    expect(used?.inUse).toBe(true);
    expect(unused?.inUse).toBe(false);
  });
});
