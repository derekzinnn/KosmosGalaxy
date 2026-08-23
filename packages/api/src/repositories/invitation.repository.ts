import type { Prisma } from '../generated/prisma/client.js';
import type { Role } from '../generated/prisma/enums.js';
import type { ScopedDb } from '../db/scoped-db.js';
import { normalizeEmail } from '../lib/normalize.js';

export interface CreateInvitationInput {
  readonly tenantId: string | null;
  readonly email: string;
  readonly role: Role;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly invitedByUserId: string | null;
}

export function createInvitation(
  db: ScopedDb,
  input: CreateInvitationInput,
): Promise<Prisma.InvitationModel> {
  return db.invitation.create({
    tenantId: input.tenantId,
    email: normalizeEmail(input.email),
    role: input.role,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    invitedByUserId: input.invitedByUserId,
  });
}

export function findInvitationByTokenHash(
  db: ScopedDb,
  tokenHash: string,
): Promise<Prisma.InvitationModel | null> {
  return db.invitation.findFirst({ where: { tokenHash } });
}

export function findInvitationById(
  db: ScopedDb,
  id: string,
): Promise<Prisma.InvitationModel | null> {
  return db.invitation.findFirst({ where: { id } });
}

export function findPendingInvitationForEmail(
  db: ScopedDb,
  email: string,
): Promise<Prisma.InvitationModel | null> {
  return db.invitation.findFirst({
    where: {
      email: normalizeEmail(email),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

export function listInvitations(
  db: ScopedDb,
  tenantId?: string,
): Promise<Prisma.InvitationModel[]> {
  return db.invitation.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: [{ createdAt: 'desc' }],
  });
}

/**
 * Marking an invitation accepted is a conditional update, not a blind one.
 * `acceptedAt: null` in the where clause means two simultaneous requests
 * carrying the same link cannot both succeed — the database decides the
 * winner, and the loser sees a count of 0. That is what makes the invitation
 * genuinely single-use even under a race.
 */
export async function markInvitationAccepted(
  db: ScopedDb,
  id: string,
  acceptedByUserId: string,
): Promise<boolean> {
  const result = await db.invitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { acceptedAt: new Date(), acceptedByUserId },
  });
  return result.count === 1;
}

export async function revokeInvitation(db: ScopedDb, id: string): Promise<boolean> {
  const result = await db.invitation.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}
