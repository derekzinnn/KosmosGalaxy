import { defineConfig } from 'vitest/config';

/**
 * Pure unit tests — no database, no migrations, no truncation.
 *
 * The integration suite in `tests/` is the definition of done for tenant
 * isolation and it needs real PostgreSQL to mean anything. But the rules that
 * decide what a client may open and who counts as finished are pure
 * functions, and making those wait on a database to be checked would be a
 * reason not to check them often.
 *
 * The two configs never overlap: this one owns `src/**`, the integration one
 * owns `tests/**`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
