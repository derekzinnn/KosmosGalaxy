import { prisma } from '../db/prisma.js';
import { runInGlobalScope } from '../db/scoped-db.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';
import { findTenantById, listTenants as selectTenants } from '../repositories/tenant.repository.js';
import type { RequestContext } from '../types/request-context.js';
import { metadataOf } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { audit } from './audit.service.js';
import { runAsContext } from './scope.service.js';
import type { PublicTenant } from './user.mapper.js';
import { toPublicTenant } from './user.mapper.js';

export interface CreateTenantCommand {
  readonly name: string;
  readonly slug: string;
  readonly contractSignedAt?: string | null;
}

/**
 * Creating a client company.
 *
 * This is the one entity that has to exist before anything else can: without
 * a tenant there is nobody to invite a CLIENT_OWNER into. Only Kosmos staff
 * can do it, which the route enforces before this is ever called.
 */
export async function createTenant(
  context: RequestContext,
  command: CreateTenantCommand,
): Promise<PublicTenant> {
  return runInGlobalScope('superadmin:tenant-create', async (db) => {
    const clash = await db.tenant.findFirst({ where: { slug: command.slug } });
    if (clash) {
      throw new ConflictError('A tenant with this slug already exists', 'TENANT_SLUG_TAKEN');
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: command.name,
          slug: command.slug,
          contractSignedAt: command.contractSignedAt ? new Date(command.contractSignedAt) : null,
        },
      });

      await audit(tx, {
        action: AuditAction.TENANT_CREATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: created.id,
        entityType: AuditEntity.TENANT,
        entityId: created.id,
        after: { name: created.name, slug: created.slug },
        request: metadataOf(context),
      });

      return created;
    });

    return toPublicTenant(tenant);
  });
}

export function listTenants(context: RequestContext): Promise<PublicTenant[]> {
  return runAsContext(context, async (db) => {
    const tenants = await selectTenants(db);
    return tenants.map(toPublicTenant);
  });
}

/**
 * A client user reading this can only ever get their own company back: the
 * scope pins `where.id` to their tenant, so a guessed id returns nothing
 * rather than someone else's record.
 */
export function getTenant(context: RequestContext, id: string): Promise<PublicTenant> {
  return runAsContext(context, async (db) => {
    const tenant = await findTenantById(db, id);
    if (!tenant) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');
    return toPublicTenant(tenant);
  });
}
