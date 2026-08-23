import 'dotenv/config';
import { execFileSync } from 'node:child_process';

/**
 * Brings the test database up to the current schema, once per run.
 *
 * `migrate deploy` applies the committed migrations exactly as production
 * will, including the hand-written triggers and CHECK constraints. Tests that
 * assert on those guarantees are therefore testing the real thing, not a
 * convenient approximation.
 */
export default function setup(): void {
  const databaseUrl = process.env.DATABASE_URL_TEST;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Point it at a throwaway database — the ' +
        'test suite truncates every table between tests.',
    );
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
