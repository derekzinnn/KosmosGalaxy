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

/** Which schema a Postgres URL points at. Postgres defaults to `public`. */
function schemaOf(url: string): string {
  try {
    return new URL(url).searchParams.get('schema') ?? 'public';
  } catch {
    return 'public';
  }
}

/** Host, database and schema — what actually decides "is this the same place?". */
function targetOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}#${schemaOf(url)}`;
  } catch {
    return url;
  }
}

/**
 * Refuse to truncate the database somebody is developing against.
 *
 * This suite empties every table before every test. Pointed at the wrong URL
 * it does not fail — it succeeds, quietly, and the work is gone. The only
 * defence worth having is one that makes the mistake impossible rather than
 * unlikely, so the check is on identity of the target and not on a naming
 * convention somebody has to remember.
 *
 * A dedicated throwaway database is still perfectly valid, and so is a
 * separate schema in a shared one. What is refused is the two being the same.
 */
function assertSafeToTruncate(): void {
  const testUrl = env.databaseUrl;
  const devUrl = process.env.DATABASE_URL;

  if (devUrl && targetOf(devUrl) === targetOf(testUrl)) {
    throw new Error(
      'Refusing to run: DATABASE_URL_TEST points at the same host, database ' +
        'and schema as DATABASE_URL. This suite truncates every table before ' +
        'every test, so that would erase the development data. Give the tests ' +
        'their own database, or their own schema via `?schema=...`.',
    );
  }
}

assertSafeToTruncate();

const schema = schemaOf(env.databaseUrl);

const pool = new Pool({
  connectionString: env.databaseUrl,
  // Prisma reads `?schema=` from the URL; node-postgres does not. Without
  // this, the raw queries in the tests would silently read and write `public`
  // while Prisma worked in the test schema — the two halves of the same test
  // looking at different tables.
  options: `-c search_path=${schema}`,
});

let cachedTables: string[] | undefined;

async function tableNames(): Promise<string[]> {
  if (cachedTables) return cachedTables;

  const result = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = $1 AND tablename <> '_prisma_migrations'`,
    [schema],
  );

  // Schema-qualified on purpose. An unqualified name resolves through
  // search_path, and a search_path that is not what this file assumed is
  // exactly the failure this whole guard exists to prevent.
  cachedTables = result.rows.map((row) => `"${schema}"."${row.tablename}"`);
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
    `SELECT action FROM "${schema}".audit_logs ORDER BY created_at ASC, id ASC`,
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
