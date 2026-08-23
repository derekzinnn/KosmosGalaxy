import type { Request } from 'express';
import { MemoryStore, ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { TooManyRequestsError } from '../lib/errors.js';
import { normalizeEmail } from '../lib/normalize.js';

/**
 * Rate limiting on the endpoints that accept credentials.
 *
 * Three buckets, on purpose:
 *
 *  - Per IP, strict. Stops one machine grinding through passwords.
 *  - Per IP + email, strict. Stops one machine grinding through one account
 *    even if it rotates through many accounts to stay under the IP limit.
 *  - Per email, generous. Catches a distributed attempt on one account.
 *
 * The third one deserves a warning. A per-email limit is also a weapon: it
 * lets anyone who knows a client's address lock that client out by burning
 * their quota. We keep it deliberately loose, and set skipSuccessfulRequests
 * so a client typing the right password never spends any of it. The residual
 * risk — a determined distributed flood locking one account out temporarily —
 * is accepted, and the audit log makes it visible.
 *
 * The store is in memory, which means limits are per process. The moment the
 * API runs more than one instance these become per-instance and effectively
 * multiply. See "Infra requirements" in CLAUDE.md.
 */

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const stores: MemoryStore[] = [];

interface LimiterOptions {
  readonly windowMs: number;
  readonly limit: number;
  readonly key: (req: Request) => string;
  readonly skipSuccessfulRequests?: boolean;
}

function createLimiter(options: LimiterOptions): RateLimitRequestHandler {
  const store = new MemoryStore();
  stores.push(store);

  return rateLimit({
    store,
    windowMs: options.windowMs,
    limit: options.limit,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: options.key,
    handler: (_req, _res, next) => {
      next(new TooManyRequestsError('Too many attempts. Please try again later.'));
    },
  });
}

/** IPv6 addresses must be bucketed by subnet, not by exact address. */
function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

function emailFromBody(req: Request): string {
  const body: unknown = req.body;
  if (typeof body === 'object' && body !== null && 'email' in body) {
    const { email } = body as { email?: unknown };
    if (typeof email === 'string') return normalizeEmail(email);
  }
  return 'anonymous';
}

export const loginRateLimiters = [
  createLimiter({ windowMs: FIFTEEN_MINUTES, limit: 30, key: ipKey }),
  createLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 8,
    key: (req) => `${ipKey(req)}:${emailFromBody(req)}`,
  }),
  createLimiter({
    windowMs: ONE_HOUR,
    limit: 40,
    key: emailFromBody,
    skipSuccessfulRequests: true,
  }),
];

export const passwordResetRateLimiters = [
  createLimiter({ windowMs: ONE_HOUR, limit: 20, key: ipKey }),
  createLimiter({ windowMs: ONE_HOUR, limit: 5, key: emailFromBody }),
];

/**
 * Reset every bucket. Used between integration tests so one test's failed
 * logins cannot exhaust the budget of the next.
 */
export async function resetRateLimiters(): Promise<void> {
  await Promise.all(stores.map((store) => store.resetAll()));
}
