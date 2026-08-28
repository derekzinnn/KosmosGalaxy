import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { StorageProvider } from './storage-provider.js';

/**
 * Supabase Storage over its REST API.
 *
 * No SDK: the three calls we need are plain HTTP, and adding a dependency to
 * make three fetches would be its own liability. The service-role key signs
 * writes and never leaves the server. The bucket is public, so `publicUrl`
 * points straight at the object without a signature.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';
  readonly configured = true;

  private readonly base: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {
    this.base = supabaseUrl.replace(/\/+$/, '');
  }

  async upload(path: string, body: Buffer, contentType: string): Promise<void> {
    const response = await fetch(this.objectUrl(path), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.serviceRoleKey}`,
        'content-type': contentType,
        // Overwrite rather than 409 on a re-upload to the same path.
        'x-upsert': 'true',
        'cache-control': 'max-age=3600',
      },
      body: new Uint8Array(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error({ status: response.status, path, detail }, 'Supabase upload failed');
      throw new AppError({
        message: 'Could not store the image',
        status: 502,
        code: 'STORAGE_UPLOAD_FAILED',
      });
    }
  }

  async remove(path: string): Promise<void> {
    const response = await fetch(this.objectUrl(path), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.serviceRoleKey}` },
    });

    // A already-gone object is fine; anything else is worth a log but not a
    // thrown error — removing an old banner must never fail the request that
    // just uploaded a new one.
    if (!response.ok && response.status !== 404) {
      logger.warn({ status: response.status, path }, 'Supabase delete returned non-OK');
    }
  }

  publicUrl(path: string): string {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${encodePath(path)}`;
  }

  private objectUrl(path: string): string {
    return `${this.base}/storage/v1/object/${this.bucket}/${encodePath(path)}`;
  }
}

/** Encode each path segment but keep the slashes that separate them. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
