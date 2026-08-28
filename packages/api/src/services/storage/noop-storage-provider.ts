import { AppError } from '../../lib/errors.js';
import type { StorageProvider } from './storage-provider.js';

/**
 * The provider used when no storage is configured.
 *
 * It lets the service boot without Supabase credentials — a dev clone, a CI
 * run — and turns an actual upload attempt into a clear 503 instead of a crash
 * at startup. Reads of a track with no banner never reach here, since a null
 * path skips URL resolution entirely.
 */
export class NoopStorageProvider implements StorageProvider {
  readonly name = 'none';
  readonly configured = false;

  upload(): Promise<void> {
    return Promise.reject(
      new AppError({
        message: 'Image storage is not configured on this server',
        status: 503,
        code: 'STORAGE_NOT_CONFIGURED',
      }),
    );
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }

  publicUrl(): string | null {
    return null;
  }
}
