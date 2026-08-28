import { beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import {
  assignTrackToTenant,
  completeLesson,
  createSuperadmin,
  createTenantWithUsers,
  createTrackWithLessons,
} from './helpers/factories.js';

/**
 * The onboarding funnel — every client's furthest stage, and the cumulative
 * counts across all of them. Fixtures build each stage directly so one test
 * can assert the whole ladder at once.
 */
describe('onboarding funnel', () => {
  let superadminToken: string;

  beforeEach(async () => {
    useCapturingEmails();
    superadminToken = await loginAs((await createSuperadmin()).email);
  });

  it('is refused to a client owner', async () => {
    const { owner } = await createTenantWithUsers('Empresa A');
    const ownerToken = await loginAs(owner.email);

    const response = await api()
      .get('/funnel')
      .set('Authorization', bearer(ownerToken))
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('places each client at its furthest stage and totals them cumulatively', async () => {
    // A track with two required lessons, shared across the clients below.
    const { track, lessons } = await createTrackWithLessons(2);

    // Done: both required lessons completed.
    const done = await createTenantWithUsers('Concluíram');
    await assignTrackToTenant(track.id, done.tenant.id);
    await completeLesson(done.owner.id, lessons[0]!.id, done.tenant.id);
    await completeLesson(done.owner.id, lessons[1]!.id, done.tenant.id);

    // Started: one of two done.
    const started = await createTenantWithUsers('Em andamento');
    await assignTrackToTenant(track.id, started.tenant.id);
    await completeLesson(started.owner.id, lessons[0]!.id, started.tenant.id);

    // Joined: someone logged in, but nothing watched.
    const joined = await createTenantWithUsers('Entraram');
    await loginAs(joined.owner.email);

    // Invited: created, nobody has logged in.
    const invited = await createTenantWithUsers('Convidados');

    const response = await api()
      .get('/funnel')
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    const body = response.body as {
      totals: { tenants: number; joined: number; started: number; completed: number };
      clients: {
        tenantId: string;
        stage: string;
        lessonsCompleted: number;
        lessonsTotal: number;
        percent: number;
      }[];
    };

    const byId = new Map(body.clients.map((c) => [c.tenantId, c]));

    expect(byId.get(done.tenant.id)?.stage).toBe('completed');
    expect(byId.get(done.tenant.id)?.percent).toBe(100);

    expect(byId.get(started.tenant.id)?.stage).toBe('started');
    expect(byId.get(started.tenant.id)?.lessonsCompleted).toBe(1);
    expect(byId.get(started.tenant.id)?.lessonsTotal).toBe(2);
    expect(byId.get(started.tenant.id)?.percent).toBe(50);

    expect(byId.get(joined.tenant.id)?.stage).toBe('joined');
    expect(byId.get(invited.tenant.id)?.stage).toBe('invited');

    // Cumulative: each stage contains the ones beyond it.
    expect(body.totals.tenants).toBe(4);
    expect(body.totals.joined).toBe(3); // done + started + joined
    expect(body.totals.started).toBe(2); // done + started
    expect(body.totals.completed).toBe(1); // done
  });

  it('sorts the least-advanced clients first', async () => {
    const { track, lessons } = await createTrackWithLessons(1);

    const done = await createTenantWithUsers('Zebra Concluiu');
    await assignTrackToTenant(track.id, done.tenant.id);
    await completeLesson(done.owner.id, lessons[0]!.id, done.tenant.id);

    await createTenantWithUsers('Alfa Convidada'); // invited, no activity

    const response = await api()
      .get('/funnel')
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    const { clients } = response.body as { clients: { stage: string }[] };
    // The invited client comes before the completed one, regardless of name.
    expect(clients[0]?.stage).toBe('invited');
    expect(clients[clients.length - 1]?.stage).toBe('completed');
  });

  it('counts a client with no assignment as invited, not completed', async () => {
    // No assignment means no required lessons — a zero denominator must never
    // read as "finished everything".
    const lonely = await createTenantWithUsers('Sem trilha');

    const response = await api()
      .get('/funnel')
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    const { clients } = response.body as { clients: { tenantId: string; stage: string }[] };
    expect(clients.find((c) => c.tenantId === lonely.tenant.id)?.stage).toBe('invited');
  });
});
