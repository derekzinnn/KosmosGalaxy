import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { createScopedDb } from '../db/scoped-db.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import type { RequestContext } from '../types/request-context.js';
import { metadataOf } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { audit } from './audit.service.js';
import { runAsContext } from './scope.service.js';
import { storageProvider } from './storage/index.js';
import type { PublicUser } from './user.mapper.js';
import { toPublicUser } from './user.mapper.js';

/**
 * A user editing their own account — their display name and their photo.
 *
 * Everything here acts on `context.userId`, never an id from the request, so
 * there is no way to edit anyone else: the caller can only ever reach the row
 * the token already proves they are. Runs in the caller's own scope, which for
 * a client pins the write to their tenant and for staff runs global; either way
 * the id is their own.
 */

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Belt to the route's braces: the route caps the body, this rejects an empty one. */
const MAX_BYTES = 50 * 1024 * 1024;

function userNotFound(): NotFoundError {
  return new NotFoundError('User not found', 'USER_NOT_FOUND');
}

/** Change the caller's own display name. */
export function updateOwnProfile(
  context: RequestContext,
  command: { readonly name: string },
): Promise<PublicUser> {
  return runAsContext(context, async (db) => {
    const existing = await db.user.findFirst({ where: { id: context.userId } });
    if (!existing) throw userNotFound();

    const user = await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);
      const updated = await scopedTx.user.update({
        where: { id: context.userId },
        data: { name: command.name },
      });

      await audit(tx, {
        action: AuditAction.USER_UPDATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: existing.tenantId,
        entityType: AuditEntity.USER,
        entityId: context.userId,
        before: { name: existing.name },
        after: { name: updated.name },
        request: metadataOf(context),
      });

      return updated;
    });

    return toPublicUser(user);
  });
}

/**
 * Set (or replace) the caller's own avatar.
 *
 * Same order as a track banner: the bytes land in storage first, the path is
 * committed with its audit line in a transaction, and the previous object is
 * removed only afterward and best-effort. A 50 MB ceiling matches the route —
 * the browser crops and re-encodes to a small JPEG before this is ever reached,
 * so in practice the bytes are tiny; the cap only guards a direct API caller.
 */
export function setOwnAvatar(
  context: RequestContext,
  body: Buffer,
  contentType: string,
): Promise<PublicUser> {
  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) {
    throw new BadRequestError('Photo must be a JPEG, PNG or WebP image', 'UNSUPPORTED_IMAGE_TYPE');
  }
  if (body.length === 0) throw new BadRequestError('The image is empty', 'EMPTY_IMAGE');
  if (body.length > MAX_BYTES) {
    throw new BadRequestError('The image is larger than 50 MB', 'IMAGE_TOO_LARGE');
  }

  return runAsContext(context, async (db) => {
    const existing = await db.user.findFirst({ where: { id: context.userId } });
    if (!existing) throw userNotFound();

    const path = `avatars/${context.userId}-${randomUUID()}.${extension}`;
    await storageProvider().upload(path, body, contentType);

    const user = await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);
      const updated = await scopedTx.user.update({
        where: { id: context.userId },
        data: { avatarImagePath: path },
      });

      await audit(tx, {
        action: AuditAction.USER_UPDATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: existing.tenantId,
        entityType: AuditEntity.USER,
        entityId: context.userId,
        before: { avatarImagePath: existing.avatarImagePath },
        after: { avatarImagePath: path },
        request: metadataOf(context),
      });

      return updated;
    });

    if (existing.avatarImagePath && existing.avatarImagePath !== path) {
      await storageProvider().remove(existing.avatarImagePath);
    }

    return toPublicUser(user);
  });
}

/** Remove the caller's avatar, falling back to the initials chip. */
export function removeOwnAvatar(context: RequestContext): Promise<PublicUser> {
  return runAsContext(context, async (db) => {
    const existing = await db.user.findFirst({ where: { id: context.userId } });
    if (!existing) throw userNotFound();

    const user = await prisma.$transaction(async (tx) => {
      const scopedTx = createScopedDb(tx, db.scope);
      const updated = await scopedTx.user.update({
        where: { id: context.userId },
        data: { avatarImagePath: null },
      });

      await audit(tx, {
        action: AuditAction.USER_UPDATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: existing.tenantId,
        entityType: AuditEntity.USER,
        entityId: context.userId,
        before: { avatarImagePath: existing.avatarImagePath },
        after: { avatarImagePath: null },
        request: metadataOf(context),
      });

      return updated;
    });

    if (existing.avatarImagePath) await storageProvider().remove(existing.avatarImagePath);

    return toPublicUser(user);
  });
}
