import type { Prisma } from '../generated/prisma/client.js';
import type { ScopedDb } from '../db/scoped-db.js';

export function findTenantById(db: ScopedDb, id: string): Promise<Prisma.TenantModel | null> {
  return db.tenant.findFirst({ where: { id } });
}

export function listTenants(db: ScopedDb): Promise<Prisma.TenantModel[]> {
  return db.tenant.findMany({ orderBy: [{ name: 'asc' }] });
}
