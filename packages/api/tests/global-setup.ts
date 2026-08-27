import 'dotenv/config';
import { execSync } from 'node:child_process';

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

  /*
   * `execSync` with one literal string, rather than execFileSync with an
   * argument array. Two Windows facts force this:
   *
   *   - `npx` is `npx.cmd`, and execFileSync matches a literal filename
   *     instead of searching PATHEXT — a bare 'npx' throws ENOENT.
   *   - Naming `npx.cmd` outright then throws EINVAL: since the fix for
   *     CVE-2024-27980, Node refuses to spawn .cmd and .bat without a shell.
   *
   * So a shell is required. Passing an argument array alongside `shell: true`
   * is deprecated (DEP0190) because the arguments are concatenated rather
   * than escaped — which is exactly why this passes one fixed string with
   * nothing interpolated into it.
   */
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
