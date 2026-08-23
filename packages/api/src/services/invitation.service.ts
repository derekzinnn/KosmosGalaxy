import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { createScopedDb, runInGlobalScope } from '../db/scoped-db.js';
import type { ScopedDb } from '../db/scoped-db.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Role } from '../generated/prisma/enums.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { normalizeEmail } from '../lib/normalize.js';
import { hashPassword } from '../lib/password.js';
import { generateOpaqueToken, hashToken } from '../lib/tokens.js';
import {
  createInvitation as insertInvitation,
  findInvitationByTokenHash,
  findPendingInvitationForEmail,
  listInvitations as selectInvitations,
  markInvitationAccepted,
  revokeInvitation,
} from '../repositories/invitation.repository.js';
import { findTenantById } from '../repositories/tenant.repository.js';
import { createUser, findUserByEmail } from '../repositories/user.repository.js';
import type { RequestContext, RequestMetadata } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { audit } from './audit.service.js';
import type { AuthSession } from './auth.service.js';
import { login } from './auth.service.js';
import { emailProvider } from './email/index.js';
import { invitationEmail } from './email/templates.js';
import { runAsContext, runAsSuperadminOnTenant } from './scope.service.js';

export interface PublicInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly tenantId: string | null;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

function toPublicInvitation(invitation: Prisma.InvitationModel): PublicInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    tenantId: invitation.tenantId,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

/**
 * Who may invite whom.
 *
 * A CLIENT_OWNER can add teammates to their own company and nothing else.
 * Deliberately, they cannot mint another CLIENT_OWNER: promoting someone to
 * account owner is a decision about the commercial relationship, so it stays
 * with Kosmos. Flipping that is a one-line change here if you disagree.
 */
const INVITABLE_ROLES: Readonly<Record<Role, readonly Role[]>> = {
  SUPERADMIN: ['SUPERADMIN', 'CLIENT_OWNER', 'CLIENT_MEMBER'],
  CLIENT_OWNER: ['CLIENT_MEMBER'],
  CLIENT_MEMBER: [],
};

export interface CreateInvitationCommand {
  readonly email: string;
  readonly role: Role;
  /** Required for SUPERADMIN; ignored for CLIENT_OWNER, who is pinned to their own. */
  readonly tenantId?: string | null;
}

export async function createInvitation(
  context: RequestContext,
  command: CreateInvitationCommand,
): Promise<PublicInvitation> {
  const email = normalizeEmail(command.email);

  const allowedRoles = INVITABLE_ROLES[context.role];
  if (!allowedRoles.includes(command.role)) {
    throw new ForbiddenError(
      `A ${context.role} cannot issue a ${command.role} invitation`,
      'ROLE_NOT_INVITABLE',
    );
  }

  const targetTenantId = resolveTargetTenant(context, command);

  const run = <T>(fn: (db: ScopedDb) => Promise<T>): Promise<T> => {
    // Kosmos staff inviting into a specific client is an override, and gets
    // an audit row saying so. Inviting another staff member is not.
    if (context.role === 'SUPERADMIN' && targetTenantId) {
      return runAsSuperadminOnTenant(context, targetTenantId, 'invitation:create', fn);
    }
    return runAsContext(context, fn);
  };

  return run(async (db) => {
    if (targetTenantId) {
      const tenant = await findTenantById(db, targetTenantId);
      if (!tenant) throw new NotFoundError('Tenant not found', 'TENANT_NOT_FOUND');
    }

    // An email that already has an account cannot be invited again — global
    // uniqueness means the invitation could never be accepted.
    const existingUser = await runInGlobalScope('invitation:token-lookup', async (globalDb) =>
      findUserByEmail(globalDb, email),
    );
    if (existingUser) {
      throw new ConflictError('This email already has an account', 'USER_ALREADY_EXISTS');
    }

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + env.INVITATION_TTL_SECONDS * 1000);

    const invitation = await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);

      // Re-inviting supersedes the previous link rather than leaving two live
      // keys in the same inbox.
      const pending = await findPendingInvitationForEmail(scopedTx, email);
      if (pending) await revokeInvitation(scopedTx, pending.id);

      const created = await insertInvitation(scopedTx, {
        tenantId: targetTenantId,
        email,
        role: command.role,
        tokenHash: hashToken(rawToken),
        expiresAt,
        invitedByUserId: context.userId,
      });

      await audit(tx, {
        action: AuditAction.INVITATION_SENT,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: targetTenantId,
        entityType: AuditEntity.INVITATION,
        entityId: created.id,
        after: { email, role: command.role, expiresAt: expiresAt.toISOString() },
        request: { ip: context.ip, userAgent: context.userAgent },
      });

      return created;
    });

    const tenantName = targetTenantId
      ? ((await findTenantById(db, targetTenantId))?.name ?? 'Kosmos')
      : 'Kosmos';

    // Sent after the transaction commits. Sending inside it risks an email
    // whose invitation was then rolled away — a link that never works.
    await emailProvider().send(
      invitationEmail({
        to: email,
        tenantName,
        inviterName: context.email,
        acceptUrl: `${env.WEB_APP_URL}/invite/${rawToken}`,
        expiresInDays: Math.round(env.INVITATION_TTL_SECONDS / 86_400),
      }),
    );

    return toPublicInvitation(invitation);
  });
}

function resolveTargetTenant(
  context: RequestContext,
  command: CreateInvitationCommand,
): string | null {
  if (context.role === 'SUPERADMIN') {
    // Kosmos staff have no tenant, so inviting another SUPERADMIN is tenantless.
    return command.role === 'SUPERADMIN' ? null : (command.tenantId ?? null);
  }

  // A client owner is pinned to their own tenant whatever the request body
  // claims. This is the line that stops "tenantId": "<someone else's>".
  return context.tenantId;
}

export function listInvitations(context: RequestContext): Promise<PublicInvitation[]> {
  return runAsContext(context, async (db) => {
    const invitations = await selectInvitations(db);
    return invitations.map(toPublicInvitation);
  });
}

// ── Public, unauthenticated endpoints ─────────────────────────────────────

export interface InvitationPreview {
  readonly email: string;
  readonly role: Role;
  readonly tenantName: string;
  readonly expiresAt: string;
}

/**
 * What the accept page is allowed to know before anyone has proved anything.
 *
 * Deliberately narrow: the email being invited, the company name, and when it
 * expires. Not the tenant id, not who invited them, not who else is in the
 * company. Someone with a stolen link learns nothing they could use elsewhere.
 */
export async function previewInvitation(rawToken: string): Promise<InvitationPreview> {
  return runInGlobalScope('invitation:token-lookup', async (db) => {
    const invitation = await findValidInvitation(db, rawToken);

    const tenantName = invitation.tenantId
      ? ((await findTenantById(db, invitation.tenantId))?.name ?? 'Kosmos')
      : 'Kosmos';

    return {
      email: invitation.email,
      role: invitation.role,
      tenantName,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  });
}

export interface AcceptInvitationCommand {
  readonly name: string;
  readonly password: string;
}

export async function acceptInvitation(
  rawToken: string,
  command: AcceptInvitationCommand,
  request: RequestMetadata,
): Promise<AuthSession> {
  const email = await runInGlobalScope('invitation:token-lookup', async (db) => {
    const invitation = await findValidInvitation(db, rawToken);

    const existingUser = await findUserByEmail(db, invitation.email);
    if (existingUser) {
      throw new ConflictError('This email already has an account', 'USER_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(command.password);

    await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);

      const user = await createUser(scopedTx, {
        tenantId: invitation.tenantId,
        email: invitation.email,
        passwordHash,
        name: command.name,
        role: invitation.role,
      });

      // Conditional update: if two tabs submit the same link at once, exactly
      // one gets count === 1 and the other rolls back with its user creation.
      const claimed = await markInvitationAccepted(scopedTx, invitation.id, user.id);
      if (!claimed) {
        throw new ConflictError('This invitation has already been used', 'INVITATION_USED');
      }

      await audit(tx, {
        action: AuditAction.USER_CREATED,
        actor: { id: user.id, email: user.email, role: user.role },
        tenantId: user.tenantId,
        entityType: AuditEntity.USER,
        entityId: user.id,
        after: { email: user.email, role: user.role, via: 'invitation' },
        request,
      });

      await audit(tx, {
        action: AuditAction.INVITATION_ACCEPTED,
        actor: { id: user.id, email: user.email, role: user.role },
        tenantId: invitation.tenantId,
        entityType: AuditEntity.INVITATION,
        entityId: invitation.id,
        after: { acceptedByUserId: user.id },
        request,
      });
    });

    return invitation.email;
  });

  // Log the new client straight in, so accepting the invitation lands them in
  // the product rather than on a login form they have never seen.
  return login(email, command.password, request);
}

async function findValidInvitation(
  db: ScopedDb,
  rawToken: string,
): Promise<Prisma.InvitationModel> {
  const invitation = await findInvitationByTokenHash(db, hashToken(rawToken));

  // One message for every failure mode. "Expired" versus "already used"
  // versus "never existed" tells a stranger holding a link more than they
  // should learn from a page that requires no authentication.
  const invalid = new NotFoundError(
    'Invitation link is invalid or has expired',
    'INVITATION_INVALID',
  );

  if (!invitation) throw invalid;
  if (invitation.acceptedAt) throw invalid;
  if (invitation.revokedAt) throw invalid;
  if (invitation.expiresAt.getTime() <= Date.now()) throw invalid;

  return invitation;
}
