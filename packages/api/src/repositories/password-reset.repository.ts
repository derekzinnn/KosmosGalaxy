import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from '../db/prisma.js';

export interface CreatePasswordResetInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export function createPasswordResetToken(
  client: DbClient,
  input: CreatePasswordResetInput,
): Promise<Prisma.PasswordResetTokenModel> {
  return client.passwordResetToken.create({ data: { ...input } });
}

export function findPasswordResetByHash(
  client: DbClient,
  tokenHash: string,
): Promise<Prisma.PasswordResetTokenModel | null> {
  return client.passwordResetToken.findUnique({ where: { tokenHash } });
}

export async function markPasswordResetUsed(client: DbClient, id: string): Promise<void> {
  await client.passwordResetToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/**
 * Requesting a new reset link invalidates any earlier one. Otherwise every
 * link a user ever requested stays live for its full hour, and the oldest
 * email in their inbox is as dangerous as the newest.
 */
export async function invalidateResetTokensForUser(
  client: DbClient,
  userId: string,
): Promise<void> {
  await client.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
