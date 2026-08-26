import { beforeEach, describe, expect, it } from 'vitest';
import { runInTenantScope } from '../src/db/scoped-db.js';
import { TenantScopeViolationError } from '../src/lib/errors.js';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import { rawQuery, readAuditActions } from './helpers/database.js';
import {
  assignTrackToTenant,
  createPublishedTrack,
  createSuperadmin,
  createTenantWithUsers,
} from './helpers/factories.js';

/**
 * Phase 1 introduces the first content a client can see, and with it the first
 * chance to show one client another client's assignments.
 *
 * The library itself is shared on purpose — one Track row, many companies — so
 * "can Tenant A read Tenant B's track?" is the wrong question. The right one
 * is "can Tenant A discover that Tenant B was given anything at all?".
 */
describe('content visibility between clients', () => {
  let alpha: Awaited<ReturnType<typeof createTenantWithUsers>>;
  let beta: Awaited<ReturnType<typeof createTenantWithUsers>>;
  let alphaToken: string;
  let staffToken: string;
  let shared: Awaited<ReturnType<typeof createPublishedTrack>>;
  let betaOnly: Awaited<ReturnType<typeof createPublishedTrack>>;

  beforeEach(async () => {
    useCapturingEmails();

    alpha = await createTenantWithUsers('Empresa Alfa');
    beta = await createTenantWithUsers('Empresa Beta');

    shared = await createPublishedTrack('Onboarding Comum');
    betaOnly = await createPublishedTrack('Onboarding da Beta');

    await assignTrackToTenant(shared.track.id, alpha.tenant.id);
    await assignTrackToTenant(shared.track.id, beta.tenant.id);
    await assignTrackToTenant(betaOnly.track.id, beta.tenant.id);

    alphaToken = await loginAs(alpha.owner.email);
    staffToken = await loginAs((await createSuperadmin()).email);
  });

  const asAlpha = (path: string) => api().get(path).set('Authorization', bearer(alphaToken));

  it('shows a client only the tracks assigned to their own company', async () => {
    const response = await asAlpha('/tracks/mine').expect(200);

    const titles = response.body.tracks.map((track: { title: string }) => track.title);
    expect(titles).toEqual(['Onboarding Comum']);
    expect(titles).not.toContain('Onboarding da Beta');
  });

  it('hides an unpublished track even when it is assigned', async () => {
    await api()
      .post(`/tracks/${shared.track.id}/unpublish`)
      .set('Authorization', bearer(staffToken))
      .expect(200);

    const response = await asAlpha('/tracks/mine').expect(200);
    expect(response.body.tracks).toHaveLength(0);
  });

  it('never leaks the Panda video id to a client', async () => {
    const response = await asAlpha('/tracks/mine').expect(200);

    // Phase 2 serves playback through a signed URL. The raw id reaching a
    // browser now would make that pointless later.
    expect(JSON.stringify(response.body)).not.toContain('panda-video-1');
    expect(response.body.tracks[0].modules[0].lessons[0].hasVideo).toBe(true);
  });

  it('refuses a client the authoring view of a track they can see', async () => {
    // Alpha is genuinely assigned this track, and still may not open the
    // Kosmos authoring endpoint for it.
    await asAlpha(`/tracks/${shared.track.id}`).expect(403);
  });

  it('refuses a client the authoring view of a track they cannot see', async () => {
    await asAlpha(`/tracks/${betaOnly.track.id}`).expect(403);
  });

  it('refuses a client the list of companies a track is assigned to', async () => {
    await asAlpha(`/tracks/${shared.track.id}/assignments`).expect(403);
  });

  it('refuses a client the ability to assign a track to themselves', async () => {
    await api()
      .post(`/tracks/${betaOnly.track.id}/assignments`)
      .set('Authorization', bearer(alphaToken))
      .send({ tenantId: alpha.tenant.id })
      .expect(403);
  });

  it('returns nothing for Kosmos staff, who have no company of their own', async () => {
    const response = await api()
      .get('/tracks/mine')
      .set('Authorization', bearer(staffToken))
      .expect(200);

    expect(response.body.tracks).toHaveLength(0);
  });

  describe('at the data-access layer', () => {
    it('throws when an assignment query names another tenant', async () => {
      await expect(
        runInTenantScope(alpha.tenant.id, (db) =>
          db.raw.trackAssignment.findMany({ where: { tenantId: beta.tenant.id } }),
        ),
      ).rejects.toThrow(TenantScopeViolationError);
    });

    it('throws when an assignment query carries no tenant filter', async () => {
      await expect(
        runInTenantScope(alpha.tenant.id, (db) => db.raw.trackAssignment.findMany({})),
      ).rejects.toThrow(TenantScopeViolationError);
    });

    it('overrides a forged tenantId rather than obeying it', async () => {
      const rows = await runInTenantScope(alpha.tenant.id, (db) =>
        db.trackAssignment.findMany({ where: { tenantId: beta.tenant.id } }),
      );

      expect(rows).toHaveLength(1);
      expect(rows.every((row) => row.tenantId === alpha.tenant.id)).toBe(true);
    });

    it('cannot plant an assignment into another tenant', async () => {
      await expect(
        runInTenantScope(alpha.tenant.id, (db) =>
          db.raw.trackAssignment.create({
            data: { trackId: betaOnly.track.id, tenantId: beta.tenant.id },
          }),
        ),
      ).rejects.toThrow(TenantScopeViolationError);
    });
  });

  describe('assignment by Kosmos staff', () => {
    const asStaff = (method: 'post' | 'delete' | 'get', path: string) =>
      api()[method](path).set('Authorization', bearer(staffToken));

    it('records a scope override naming the target company', async () => {
      const fresh = await createPublishedTrack('Trilha Nova');

      await asStaff('post', `/tracks/${fresh.track.id}/assignments`)
        .send({ tenantId: alpha.tenant.id })
        .expect(201);

      const overrides = await rawQuery<{ tenant_id: string; after: { reason: string } }>(
        `SELECT tenant_id, after FROM audit_logs WHERE action = 'TENANT_SCOPE_OVERRIDDEN'`,
      );

      expect(overrides).toHaveLength(1);
      expect(overrides[0]?.tenant_id).toBe(alpha.tenant.id);
      expect(overrides[0]?.after.reason).toBe('track:assign');

      expect(await readAuditActions()).toContain('TRACK_ASSIGNED');
    });

    it('refuses to assign the same track twice', async () => {
      const response = await asStaff('post', `/tracks/${shared.track.id}/assignments`)
        .send({ tenantId: alpha.tenant.id })
        .expect(409);

      expect(response.body.error.code).toBe('ALREADY_ASSIGNED');
    });

    it('unassigns, and the client stops seeing the track', async () => {
      await asStaff('delete', `/tracks/${shared.track.id}/assignments/${alpha.tenant.id}`).expect(
        204,
      );

      const response = await asAlpha('/tracks/mine').expect(200);
      expect(response.body.tracks).toHaveLength(0);

      // Beta still has it: unassigning is per company, not global.
      const betaToken = await loginAs(beta.owner.email);
      const betaResponse = await api()
        .get('/tracks/mine')
        .set('Authorization', bearer(betaToken))
        .expect(200);
      expect(betaResponse.body.tracks).toHaveLength(2);

      expect(await readAuditActions()).toContain('TRACK_UNASSIGNED');
    });

    it('lists the companies a track was given to', async () => {
      const response = await asStaff('get', `/tracks/${shared.track.id}/assignments`).expect(200);

      const names = response.body.tenants.map((tenant: { name: string }) => tenant.name).sort();
      expect(names).toEqual(['Empresa Alfa', 'Empresa Beta']);
    });

    it('refuses to assign a track to a company that does not exist', async () => {
      await asStaff('post', `/tracks/${shared.track.id}/assignments`)
        .send({ tenantId: '01a03034-8df7-7479-8e43-2a0eb76d217a' })
        .expect(404);
    });
  });
});
