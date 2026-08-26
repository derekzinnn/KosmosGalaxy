import { prisma } from '../src/db/prisma.js';
import { runInGlobalScope } from '../src/db/scoped-db.js';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/lib/normalize.js';
import { passwordSchema } from '../src/schemas/common.js';

/**
 * Bootstraps the first Kosmos staff account.
 *
 * Somebody has to exist before anybody can be invited, and that first account
 * cannot come from an invitation — there would be nobody to send it. This is
 * the only place in the codebase that creates a user without one.
 *
 * Idempotent: running it twice does not create a second admin or reset the
 * password of an existing one.
 */

/**
 * An environment variable that is present but blank is not a value.
 *
 * `.env.example` ships these keys with nothing after the `=`, which is the
 * normal way to show that a setting exists. Copied to `.env` and left alone,
 * `process.env.SEED_ADMIN_PASSWORD` is then `''` — and `??` does not fall back
 * on an empty string, only on undefined. That difference silently hashed an
 * empty password into the first staff account of a fresh install.
 */
function envOr(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

async function main(): Promise<void> {
  const email = normalizeEmail(envOr('SEED_ADMIN_EMAIL', 'admin@kosmos.com.br'));
  const password = envOr('SEED_ADMIN_PASSWORD', 'kosmos-galaxy-dev-password');
  const name = envOr('SEED_ADMIN_NAME', 'Kosmos Admin');
  const explicitPassword = Boolean(process.env.SEED_ADMIN_PASSWORD?.trim());

  if (process.env.NODE_ENV === 'production' && !explicitPassword) {
    throw new Error('SEED_ADMIN_PASSWORD must be set explicitly when seeding production');
  }

  /**
   * The same policy the API enforces, not a second one written here.
   *
   * Every other path into a password goes through Zod; this one wrote straight
   * to `hashPassword`, so it was the one place a password nobody would accept
   * over HTTP could still reach the database.
   */
  const checked = passwordSchema.safeParse(password);
  if (!checked.success) {
    throw new Error(
      `SEED_ADMIN_PASSWORD does not satisfy the password policy: ` +
        checked.error.issues.map((issue) => issue.message).join('; '),
    );
  }

  await runInGlobalScope('system:seed', async (db) => {
    const existing = await db.user.findFirst({ where: { email } });

    if (existing) {
      process.stdout.write(`Superadmin ${email} already exists — nothing to do.\n`);
      return;
    }

    const user = await db.user.create({
      tenantId: null,
      email,
      passwordHash: await hashPassword(password),
      name,
      role: 'SUPERADMIN',
    });

    process.stdout.write(
      [
        '',
        'Created the first Kosmos staff account:',
        `  email:    ${user.email}`,
        `  password: ${explicitPassword ? '(from SEED_ADMIN_PASSWORD)' : password}`,
        '',
        'Change this password before anything reaches production.',
        '',
      ].join('\n'),
    );
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
