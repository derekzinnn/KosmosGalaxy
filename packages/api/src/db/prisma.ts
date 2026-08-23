import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { assertQueryIsTenantScoped } from './tenant-guard.js';

/**
 * Prisma 7 dropped its own query engine. It now compiles queries and hands
 * them to a real Node driver, so a driver adapter is mandatory — think of
 * Prisma as writing the letter and `pg` as the postman who delivers it.
 */
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

const basePrisma = new PrismaClient({
  adapter,
  log: env.isProduction ? ['error'] : ['warn', 'error'],
});

/**
 * The only database handle the application is allowed to use.
 *
 * Every query passes through the tenant guard first. Extensions apply to
 * transaction clients too, so a query smuggled inside `$transaction` is
 * checked exactly like any other.
 */
export const prisma = basePrisma.$extends({
  name: 'tenant-guard',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        assertQueryIsTenantScoped(model, operation, args);
        return query(args);
      },
    },
  },
});

export type Database = typeof prisma;

/**
 * Anything that can run a query: the client itself, or a transaction handle.
 * Repositories accept this so the same function works inside and outside a
 * transaction — which is what lets an audit row share the caller's transaction.
 */
export type DbClient = Omit<
  Database,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export async function disconnectDatabase(): Promise<void> {
  try {
    await basePrisma.$disconnect();
  } catch (error) {
    logger.error({ error }, 'Failed to disconnect from the database cleanly');
  }
}
