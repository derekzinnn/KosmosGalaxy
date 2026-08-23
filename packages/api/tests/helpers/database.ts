import { Pool } from 'pg';
import { env } from '../../src/config/env.js';

/**
 * A direct connection, separate from Prisma's, used only to reset state.
 *
 * TRUNCATE is deliberate rather than DELETE: row-level triggers do not fire
 * for it, which is the only reason the append-only audit table can be cleared
 * between tests at all. It also resets the WatchEvent sequence, so ids do not
 * drift across the run.
 */
const pool = new Pool({ connectionString: env.databaseUrl });

let cachedTables: string[] | undefined;

async function tableNames(): Promise<string[]> {
  if (cachedTables) return cachedTables;

  const result = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );

  cachedTables = result.rows.map((row) => `"${row.tablename}"`);
  return cachedTables;
}

export async function truncateAllTables(): Promise<void> {
  const tables = await tableNames();
  if (tables.length === 0) return;
  await pool.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}

/** Read audit rows directly, bypassing the application entirely. */
export async function readAuditActions(): Promise<string[]> {
  const result = await pool.query<{ action: string }>(
    'SELECT action FROM audit_logs ORDER BY created_at ASC, id ASC',
  );
  return result.rows.map((row) => row.action);
}

export async function rawQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}
