import { prisma } from '../src/db/prisma.js';
import { runInGlobalScope } from '../src/db/scoped-db.js';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/lib/normalize.js';

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
async function main(): Promise<void> {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? 'admin@kosmos.com.br');
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'kosmos-galaxy-dev-password';
  const name = process.env.SEED_ADMIN_NAME ?? 'Kosmos Admin';

  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_PASSWORD must be set explicitly when seeding production');
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
        `  password: ${process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : password}`,
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
