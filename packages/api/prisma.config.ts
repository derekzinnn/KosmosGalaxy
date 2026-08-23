import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the datasource URL out of schema.prisma and stopped
 * auto-loading .env files. Both now live here.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Read lazily rather than through Prisma's `env()` helper: `prisma generate`
  // runs on every `npm install`, including on a fresh clone that has no .env
  // yet, and it does not need a reachable database to emit the client.
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
