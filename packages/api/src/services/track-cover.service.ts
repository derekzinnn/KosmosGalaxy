import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import * as content from '../repositories/content.repository.js';
import type { RequestContext } from '../types/request-context.js';
import { metadataOf } from '../types/request-context.js';
import { AuditAction, AuditEntity } from './audit.actions.js';
import { audit } from './audit.service.js';
import type { PublicTrack } from './content.mapper.js';
import { toPublicTrack } from './content.mapper.js';
import { runAsContext } from './scope.service.js';
import { storageProvider } from './storage/index.js';

/** The image types a banner may be, and the extension each is stored under. */
const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Belt to the route's braces: the route caps the body, this rejects an empty one. */
const MAX_BYTES = 5 * 1024 * 1024;

function trackNotFound(): NotFoundError {
  return new NotFoundError('Track not found', 'TRACK_NOT_FOUND');
}

/**
 * Set (or replace) a track's banner image.
 *
 * The bytes are uploaded to storage first, then the path is written in a
 * transaction alongside its audit line — so a failed upload never leaves a
 * track pointing at an object that was never stored. The previous banner, if
 * any, is deleted only after the new path is committed, and best-effort: a
 * leftover object is cheap, a lost update is not.
 */
export function setTrackCover(
  context: RequestContext,
  trackId: string,
  body: Buffer,
  contentType: string,
): Promise<PublicTrack> {
  const extension = EXTENSION_BY_TYPE[contentType];
  if (!extension) {
    throw new BadRequestError('Banner must be a JPEG, PNG or WebP image', 'UNSUPPORTED_IMAGE_TYPE');
  }
  if (body.length === 0) {
    throw new BadRequestError('The image is empty', 'EMPTY_IMAGE');
  }
  if (body.length > MAX_BYTES) {
    throw new BadRequestError('The image is larger than 5 MB', 'IMAGE_TOO_LARGE');
  }

  return runAsContext(context, async (db) => {
    const existing = await content.findTrackById(db.raw, trackId);
    if (!existing) throw trackNotFound();

    const path = `tracks/${trackId}/cover-${randomUUID()}.${extension}`;
    await storageProvider().upload(path, body, contentType);

    const track = await prisma.$transaction(async (tx) => {
      const updated = await content.updateTrack(tx, trackId, { coverImagePath: path });

      await audit(tx, {
        action: AuditAction.TRACK_UPDATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: null,
        entityType: AuditEntity.TRACK,
        entityId: trackId,
        before: { coverImagePath: existing.coverImagePath },
        after: { coverImagePath: path },
        request: metadataOf(context),
      });

      return updated;
    });

    if (existing.coverImagePath && existing.coverImagePath !== path) {
      await storageProvider().remove(existing.coverImagePath);
    }

    return toPublicTrack(track, { forAdmin: true });
  });
}

/** Remove a track's banner, falling back to the generated cover. */
export function removeTrackCover(context: RequestContext, trackId: string): Promise<PublicTrack> {
  return runAsContext(context, async (db) => {
    const existing = await content.findTrackById(db.raw, trackId);
    if (!existing) throw trackNotFound();

    const track = await prisma.$transaction(async (tx) => {
      const updated = await content.updateTrack(tx, trackId, { coverImagePath: null });

      await audit(tx, {
        action: AuditAction.TRACK_UPDATED,
        actor: { id: context.userId, email: context.email, role: context.role },
        tenantId: null,
        entityType: AuditEntity.TRACK,
        entityId: trackId,
        before: { coverImagePath: existing.coverImagePath },
        after: { coverImagePath: null },
        request: metadataOf(context),
      });

      return updated;
    });

    if (existing.coverImagePath) await storageProvider().remove(existing.coverImagePath);

    return toPublicTrack(track, { forAdmin: true });
  });
}
