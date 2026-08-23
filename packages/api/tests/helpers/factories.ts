import { runInGlobalScope } from '../../src/db/scoped-db.js';
import type { Prisma } from '../../src/generated/prisma/client.js';
import type { Role } from '../../src/generated/prisma/enums.js';
import { hashPassword } from '../../src/lib/password.js';

export const TEST_PASSWORD = 'uma-senha-de-teste-longa';

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now().toString(36)}`;
}

/**
 * Fixtures run in an explicitly named global scope. Building data across
 * several tenants is exactly what the tenant guard is designed to stop, so
 * the tests have to say out loud that they are doing it on purpose.
 */
export function createTenant(overrides: { name?: string; slug?: string } = {}) {
  return runInGlobalScope('system:test-fixture', (db) =>
    db.raw.tenant.create({
      data: {
        name: overrides.name ?? 'Empresa de Teste',
        slug: overrides.slug ?? unique('empresa'),
      },
    }),
  );
}

interface CreateUserOptions {
  readonly tenantId: string | null;
  readonly role: Role;
  readonly email?: string;
  readonly name?: string;
  readonly password?: string;
  readonly status?: 'ACTIVE' | 'SUSPENDED';
}

export function createUser(options: CreateUserOptions): Promise<Prisma.UserModel> {
  return runInGlobalScope('system:test-fixture', async (db) =>
    db.raw.user.create({
      data: {
        tenantId: options.tenantId,
        email: options.email ?? `${unique('user')}@teste.com.br`,
        passwordHash: await hashPassword(options.password ?? TEST_PASSWORD),
        name: options.name ?? 'Usuario de Teste',
        role: options.role,
        status: options.status ?? 'ACTIVE',
      },
    }),
  );
}

/** A tenant with an owner and a member, which most tests need. */
export async function createTenantWithUsers(name = 'Empresa') {
  const tenant = await createTenant({ name });

  const [owner, member] = await Promise.all([
    createUser({ tenantId: tenant.id, role: 'CLIENT_OWNER' }),
    createUser({ tenantId: tenant.id, role: 'CLIENT_MEMBER' }),
  ]);

  return { tenant, owner, member };
}

export function createSuperadmin(): Promise<Prisma.UserModel> {
  return createUser({ tenantId: null, role: 'SUPERADMIN' });
}
