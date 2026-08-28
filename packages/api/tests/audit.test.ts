import { beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import { createSuperadmin, createTenantWithUsers } from './helpers/factories.js';

/**
 * The audit viewer — the read side of the ledger every other phase writes to.
 *
 * These tests drive real endpoints (a login, a tenant creation) so the rows
 * under test are produced the same way production produces them, then read
 * them back through `GET /audit-logs`.
 */
describe('audit log viewer', () => {
  let superadminEmail: string;
  let superadminToken: string;

  beforeEach(async () => {
    useCapturingEmails();
    superadminEmail = (await createSuperadmin()).email;
    // Logging in is itself an audited action, so this seeds a known row.
    superadminToken = await loginAs(superadminEmail);
  });

  describe('access', () => {
    it('is refused to a client owner', async () => {
      const { owner } = await createTenantWithUsers('Empresa A');
      const ownerToken = await loginAs(owner.email);

      const response = await api()
        .get('/audit-logs')
        .set('Authorization', bearer(ownerToken))
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
    });

    it('is refused without a session', async () => {
      await api().get('/audit-logs').expect(401);
    });
  });

  describe('reading', () => {
    it('returns the ledger newest-first, with the actor snapshot', async () => {
      const response = await api()
        .get('/audit-logs')
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const { entries } = response.body as {
        entries: { action: string; actorEmail: string; createdAt: string }[];
      };

      expect(entries.length).toBeGreaterThan(0);

      const login = entries.find((e) => e.action === 'USER_LOGIN_SUCCEEDED');
      expect(login?.actorEmail).toBe(superadminEmail);

      // Newest first: every row is at or before the one before it.
      const times = entries.map((e) => new Date(e.createdAt).getTime());
      for (let i = 1; i < times.length; i += 1) {
        expect(times[i]).toBeLessThanOrEqual(times[i - 1] as number);
      }
    });

    it('resolves the tenant name for a scoped row', async () => {
      await api()
        .post('/tenants')
        .set('Authorization', bearer(superadminToken))
        .send({ name: 'Padaria do Zé', slug: 'padaria-do-ze' })
        .expect(201);

      const response = await api()
        .get('/audit-logs?action=TENANT_CREATED')
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const { entries } = response.body as {
        entries: { action: string; tenantName: string | null }[];
      };

      expect(entries).toHaveLength(1);
      expect(entries[0]?.action).toBe('TENANT_CREATED');
      expect(entries[0]?.tenantName).toBe('Padaria do Zé');
    });

    it('filters by action', async () => {
      await api()
        .post('/tenants')
        .set('Authorization', bearer(superadminToken))
        .send({ name: 'Empresa Nova', slug: 'empresa-nova' })
        .expect(201);

      const response = await api()
        .get('/audit-logs?action=TENANT_CREATED')
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const { entries } = response.body as { entries: { action: string }[] };
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e) => e.action === 'TENANT_CREATED')).toBe(true);
    });

    it('filters by tenant', async () => {
      const first = await api()
        .post('/tenants')
        .set('Authorization', bearer(superadminToken))
        .send({ name: 'Alfa', slug: 'alfa' })
        .expect(201);
      await api()
        .post('/tenants')
        .set('Authorization', bearer(superadminToken))
        .send({ name: 'Beta', slug: 'beta' })
        .expect(201);

      const alfaId = (first.body as { tenant: { id: string } }).tenant.id;

      const response = await api()
        .get(`/audit-logs?tenantId=${alfaId}`)
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const { entries } = response.body as { entries: { tenantId: string }[] };
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e) => e.tenantId === alfaId)).toBe(true);
    });

    it('rejects an unknown action with a 422', async () => {
      const response = await api()
        .get('/audit-logs?action=NOT_A_REAL_ACTION')
        .set('Authorization', bearer(superadminToken))
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('pagination', () => {
    it('walks pages by cursor without repeating or skipping a row', async () => {
      // Seed enough rows to span more than one small page.
      for (let i = 0; i < 5; i += 1) {
        await api()
          .post('/tenants')
          .set('Authorization', bearer(superadminToken))
          .send({ name: `Empresa ${String(i)}`, slug: `empresa-${String(i)}` })
          .expect(201);
      }

      const firstPage = await api()
        .get('/audit-logs?limit=3')
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const first = firstPage.body as { entries: { id: string }[]; nextCursor: string | null };
      expect(first.entries).toHaveLength(3);
      expect(first.nextCursor).toBe(first.entries[2]?.id);

      const secondPage = await api()
        .get(`/audit-logs?limit=3&cursor=${first.nextCursor as string}`)
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const second = secondPage.body as { entries: { id: string }[] };

      const firstIds = new Set(first.entries.map((e) => e.id));
      for (const entry of second.entries) {
        expect(firstIds.has(entry.id)).toBe(false);
      }
    });

    it('reports a null cursor when the last page is short', async () => {
      const response = await api()
        .get('/audit-logs?limit=100')
        .set('Authorization', bearer(superadminToken))
        .expect(200);

      const body = response.body as { entries: unknown[]; nextCursor: string | null };
      expect(body.entries.length).toBeLessThan(100);
      expect(body.nextCursor).toBeNull();
    });
  });
});
