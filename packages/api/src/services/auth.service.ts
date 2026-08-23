import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { createScopedDb, runInGlobalScope } from '../db/scoped-db.js';
import type { ScopedDb } from '../db/scoped-db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { UnauthorizedError } from '../lib/errors.js';
import { signAccessToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { normalizeEmail } from '../lib/normalize.js';
import { hashPassword, verifyPassword, wasteTimeLikeARealVerification } from '../lib/password.js';
import { generateOpaqueToken, generateTokenFamilyId, hashToken } from '../lib/tokens.js';
import {
  createPasswordResetToken,
  findPasswordResetByHash,
  invalidateResetTokensForUser,
  markPasswordResetUsed,
} from '../repositories/password-reset.repository.js';
import {
  createRefreshToken,
  findRefreshTokenByHash,
  revokeAllTokensForUser,
  revokeRefreshToken,
  revokeTokenFamily,
} from '../repositories/refresh-token.repository.js';
import { findUserByEmail, findUserById, recordLogin } from '../repositories/user.repository.js';
import type { RequestContext, RequestMetadata } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { audit, auditDetached } from './audit.service.js';
import { emailProvider } from './email/index.js';
import { passwordResetEmail } from './email/templates.js';
import type { PublicUser } from './user.mapper.js';
import { toPublicUser } from './user.mapper.js';

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly user: PublicUser;
}

/**
 * Every failed login answers with exactly this, whatever actually went wrong.
 *
 * Distinguishing "no such account" from "wrong password" from "suspended"
 * would tell an attacker which of Kosmos's clients have accounts here, which
 * is a list worth having before a phishing campaign.
 */
function invalidCredentials(): UnauthorizedError {
  return new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
}

// ── Login ─────────────────────────────────────────────────────────────────

export async function login(
  emailInput: string,
  password: string,
  request: RequestMetadata,
): Promise<AuthSession> {
  const email = normalizeEmail(emailInput);

  return runInGlobalScope('auth:login-lookup', async (db) => {
    const user = await findUserByEmail(db, email);

    if (!user) {
      // Verify against a throwaway hash so a missing account takes as long to
      // reject as a real one. Without this, response time alone reveals which
      // emails exist.
      await wasteTimeLikeARealVerification();
      await recordFailedLogin(email, null, request, 'no_such_user');
      throw invalidCredentials();
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);

    if (!passwordMatches) {
      await recordFailedLogin(email, user, request, 'wrong_password');
      throw invalidCredentials();
    }

    if (user.status === 'SUSPENDED') {
      await recordFailedLogin(email, user, request, 'suspended');
      throw invalidCredentials();
    }

    return issueSession(db, user, request, { isFreshLogin: true });
  });
}

async function recordFailedLogin(
  email: string,
  user: Prisma.UserModel | null,
  request: RequestMetadata,
  reason: string,
): Promise<void> {
  // Detached on purpose: the caller throws immediately after this returns, and
  // a rollback must not be able to erase the record of a failed attempt.
  await auditDetached({
    action: AuditAction.USER_LOGIN_FAILED,
    actor: { id: user?.id ?? null, email, role: user?.role ?? null },
    tenantId: user?.tenantId ?? null,
    entityType: AuditEntity.USER,
    entityId: user?.id,
    after: { reason },
    request,
  });
}

// ── Session issuing and refresh ───────────────────────────────────────────

interface IssueOptions {
  readonly isFreshLogin: boolean;
  /** Continues an existing chain on refresh; a new login starts its own. */
  readonly familyId?: string;
  /** The token being rotated out, revoked in the same transaction. */
  readonly rotatedFromTokenId?: string;
}

async function issueSession(
  db: ScopedDb,
  user: Prisma.UserModel,
  request: RequestMetadata,
  options: IssueOptions,
): Promise<AuthSession> {
  const refreshToken = generateOpaqueToken();
  const familyId = options.familyId ?? generateTokenFamilyId();

  const updatedUser = await prisma.$transaction(async (tx) => {
    const scopedTx = createScopedDb(tx, db.scope);

    const created = await createRefreshToken(tx, {
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000),
      ip: request.ip,
      userAgent: request.userAgent,
    });

    if (options.rotatedFromTokenId) {
      await revokeRefreshToken(tx, options.rotatedFromTokenId, created.id);
    }

    if (!options.isFreshLogin) return user;

    const withLoginRecorded = await recordLogin(scopedTx, user.id);

    // Inside the transaction: if anything above fails, this line disappears
    // with it, and we never claim a login that did not happen.
    await audit(tx, {
      action: AuditAction.USER_LOGIN_SUCCEEDED,
      actor: { id: user.id, email: user.email, role: user.role },
      tenantId: user.tenantId,
      entityType: AuditEntity.USER,
      entityId: user.id,
      request,
    });

    return withLoginRecorded;
  });

  const accessToken = await signAccessToken({
    userId: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
    tenantId: updatedUser.tenantId,
  });

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    user: toPublicUser(updatedUser),
  };
}

export async function refresh(rawToken: string, request: RequestMetadata): Promise<AuthSession> {
  const tokenHash = hashToken(rawToken);

  return runInGlobalScope('auth:refresh-rotation', async (db) => {
    const stored = await findRefreshTokenByHash(db.raw, tokenHash);

    if (!stored) {
      throw new UnauthorizedError('Refresh token is not recognised', 'REFRESH_TOKEN_INVALID');
    }

    if (stored.revokedAt) {
      await handleTokenReuse(db, stored, request);
      throw new UnauthorizedError('Refresh token has been revoked', 'REFRESH_TOKEN_REUSED');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await findUserById(db, stored.userId);

    if (!user || user.status === 'SUSPENDED') {
      await revokeTokenFamily(db.raw, stored.familyId);
      throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
    }

    return issueSession(db, user, request, {
      isFreshLogin: false,
      familyId: stored.familyId,
      rotatedFromTokenId: stored.id,
    });
  });
}

/**
 * A token that was already spent has come back.
 *
 * Either an attacker stole it and is replaying it, or the legitimate client
 * is replaying it after the attacker already used it. We cannot tell which,
 * and guessing wrong leaves a thief with a live session — so the whole chain
 * from that login dies. Other devices, which have their own families, are
 * untouched.
 */
async function handleTokenReuse(
  db: ScopedDb,
  stored: Prisma.RefreshTokenModel,
  request: RequestMetadata,
): Promise<void> {
  const revokedCount = await revokeTokenFamily(db.raw, stored.familyId);
  const user = await findUserById(db, stored.userId);

  logger.warn(
    { userId: stored.userId, familyId: stored.familyId, revokedCount, ip: request.ip },
    'Refresh token reuse detected — token family revoked',
  );

  await auditDetached({
    action: AuditAction.REFRESH_TOKEN_REUSE_DETECTED,
    actor: { id: stored.userId, email: user?.email ?? null, role: user?.role ?? null },
    tenantId: user?.tenantId ?? null,
    entityType: AuditEntity.SESSION,
    entityId: stored.id,
    after: { familyId: stored.familyId, revokedCount },
    request,
  });
}

// ── Logout ────────────────────────────────────────────────────────────────

export async function logout(
  rawToken: string | undefined,
  context: RequestContext | null,
  request: RequestMetadata,
): Promise<void> {
  if (!rawToken) return;

  await runInGlobalScope('auth:refresh-rotation', async (db) => {
    const stored = await findRefreshTokenByHash(db.raw, hashToken(rawToken));
    if (!stored) return;

    await prisma.$transaction(async (tx) => {
      // The whole family, not just this token: logging out should end the
      // session on this device, and the family is exactly that device's chain.
      await revokeTokenFamily(tx, stored.familyId);

      await audit(tx, {
        action: AuditAction.USER_LOGGED_OUT,
        actor: {
          id: stored.userId,
          email: context?.email ?? null,
          role: context?.role ?? null,
        },
        tenantId: context?.tenantId ?? null,
        entityType: AuditEntity.SESSION,
        entityId: stored.id,
        request,
      });
    });
  });
}

// ── Password reset ────────────────────────────────────────────────────────

/**
 * Always resolves successfully, whether or not the email belongs to anyone.
 * The endpoint that calls it must answer identically in both cases — a
 * "we couldn't find that email" response is a free account-enumeration oracle.
 */
export async function requestPasswordReset(
  emailInput: string,
  request: RequestMetadata,
): Promise<void> {
  const email = normalizeEmail(emailInput);

  await runInGlobalScope('auth:password-reset', async (db) => {
    const user = await findUserByEmail(db, email);
    const eligible = user !== null && user.status === 'ACTIVE';

    // Recorded either way. A burst of requests for addresses that do not exist
    // is exactly the pattern worth being able to see later.
    await auditDetached({
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      actor: { id: user?.id ?? null, email, role: user?.role ?? null },
      tenantId: user?.tenantId ?? null,
      entityType: AuditEntity.USER,
      entityId: user?.id,
      after: { delivered: eligible },
      request,
    });

    if (!eligible) return;

    const rawToken = generateOpaqueToken();

    await prisma.$transaction(async (tx) => {
      // Asking for a new link retires the previous one, so the oldest email in
      // an inbox stops being a live key.
      await invalidateResetTokensForUser(tx, user.id);
      await createPasswordResetToken(tx, {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_SECONDS * 1000),
        ip: request.ip,
        userAgent: request.userAgent,
      });
    });

    const resetUrl = `${env.WEB_APP_URL}/reset-password/${rawToken}`;

    await emailProvider().send(
      passwordResetEmail({
        to: user.email,
        resetUrl,
        expiresInMinutes: Math.round(env.PASSWORD_RESET_TTL_SECONDS / 60),
      }),
    );
  });
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
  request: RequestMetadata,
): Promise<void> {
  const tokenHash = hashToken(rawToken);

  await runInGlobalScope('auth:password-reset', async (db) => {
    const stored = await findPasswordResetByHash(db.raw, tokenHash);

    if (!stored || stored.usedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError(
        'Password reset link is invalid or has expired',
        'RESET_TOKEN_INVALID',
      );
    }

    const user = await findUserById(db, stored.userId);

    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);

      await scopedTx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await markPasswordResetUsed(tx, stored.id);

      // Changing a password ends every session everywhere. This is the one
      // place where revoking beyond a single family is right: the user is
      // acting precisely because they believe their credentials are known.
      await revokeAllTokensForUser(tx, user.id);

      await audit(tx, {
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        actor: { id: user.id, email: user.email, role: user.role },
        tenantId: user.tenantId,
        entityType: AuditEntity.USER,
        entityId: user.id,
        request,
      });
    });
  });
}

// ── Current user ──────────────────────────────────────────────────────────

export async function currentUser(context: RequestContext): Promise<PublicUser> {
  return runInGlobalScope('auth:login-lookup', async (db) => {
    const user = await findUserById(db, context.userId);
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Account is not active', 'ACCOUNT_INACTIVE');
    }
    return toPublicUser(user);
  });
}
