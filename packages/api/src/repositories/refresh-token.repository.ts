import type { Prisma } from '../generated/prisma/client.js';
import type { DbClient } from '../db/prisma.js';

/**
 * Refresh tokens carry no tenant column: they hang off a user, and the flows
 * that read them (login, refresh, logout) run before or across tenant scope.
 * They are therefore not part of the tenant guard's model map, and every
 * lookup here is by token hash or user id, both of which are unguessable.
 */

export interface CreateRefreshTokenInput {
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export function createRefreshToken(
  client: DbClient,
  input: CreateRefreshTokenInput,
): Promise<Prisma.RefreshTokenModel> {
  return client.refreshToken.create({ data: { ...input } });
}

export function findRefreshTokenByHash(
  client: DbClient,
  tokenHash: string,
): Promise<Prisma.RefreshTokenModel | null> {
  return client.refreshToken.findUnique({ where: { tokenHash } });
}

export async function revokeRefreshToken(
  client: DbClient,
  id: string,
  replacedByTokenId?: string,
): Promise<void> {
  await client.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), replacedByTokenId: replacedByTokenId ?? null },
  });
}

/**
 * Kill every token descended from a single login.
 *
 * A "family" is the chain a login produces: token 1 is exchanged for token 2,
 * token 2 for token 3, and so on. If a token that was already spent turns up
 * again, someone copied it, and we cannot tell whether the caller is the
 * thief or the victim. Killing the whole chain logs both out of that one
 * device, while the client's other devices — different families — keep
 * working. That is the OAuth 2.0 Security BCP behaviour.
 */
export async function revokeTokenFamily(client: DbClient, familyId: string): Promise<number> {
  const result = await client.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function revokeAllTokensForUser(client: DbClient, userId: string): Promise<number> {
  const result = await client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
