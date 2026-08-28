import { beforeEach, describe, expect, it } from 'vitest';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import { readAuditActions } from './helpers/database.js';
import { createSuperadmin, createTenantWithUsers } from './helpers/factories.js';

/** Renaming a client company — staff only, slug untouched, and audited. */
describe('tenant rename', () => {
  let superadminToken: string;

  beforeEach(async () => {
    useCapturingEmails();
    superadminToken = await loginAs((await createSuperadmin()).email);
  });

  it('renames the company and leaves the slug alone', async () => {
    const { tenant } = await createTenantWithUsers('Nome Antigo');

    const response = await api()
      .patch(`/tenants/${tenant.id}`)
      .set('Authorization', bearer(superadminToken))
      .send({ name: 'Nome Novo' })
      .expect(200);

    expect(response.body.tenant.name).toBe('Nome Novo');
    expect(response.body.tenant.slug).toBe(tenant.slug);
    expect(await readAuditActions()).toContain('TENANT_UPDATED');
  });

  it('is refused to a client owner, even for their own company', async () => {
    const { tenant, owner } = await createTenantWithUsers('Alfa');
    const ownerToken = await loginAs(owner.email);

    const response = await api()
      .patch(`/tenants/${tenant.id}`)
      .set('Authorization', bearer(ownerToken))
      .send({ name: 'Renomeada pelo cliente' })
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('rejects an empty name', async () => {
    const { tenant } = await createTenantWithUsers('Alfa');

    const response = await api()
      .patch(`/tenants/${tenant.id}`)
      .set('Authorization', bearer(superadminToken))
      .send({ name: 'a' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 404 for a tenant that does not exist', async () => {
    await api()
      .patch('/tenants/01a00000-0000-7000-8000-000000000000')
      .set('Authorization', bearer(superadminToken))
      .send({ name: 'Fantasma' })
      .expect(404);
  });
});
