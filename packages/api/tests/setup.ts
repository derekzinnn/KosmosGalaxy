import { afterAll, beforeEach } from 'vitest';
import { disconnectDatabase } from '../src/db/prisma.js';
import { resetRateLimiters } from '../src/middleware/rate-limit.js';
import { closeTestPool, truncateAllTables } from './helpers/database.js';

beforeEach(async () => {
  await truncateAllTables();
  // Otherwise one test's deliberate failed logins exhaust the next test's budget.
  await resetRateLimiters();
});

afterAll(async () => {
  await disconnectDatabase();
  await closeTestPool();
});
