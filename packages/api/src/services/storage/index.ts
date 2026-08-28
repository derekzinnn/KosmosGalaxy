import { env } from '../../config/env.js';
import { NoopStorageProvider } from './noop-storage-provider.js';
import type { StorageProvider } from './storage-provider.js';
import { SupabaseStorageProvider } from './supabase-storage-provider.js';

let provider: StorageProvider | undefined;

/**
 * One implementation is chosen at startup from `STORAGE_PROVIDER`. `none` keeps
 * the service bootable with no credentials — the upload path then answers 503
 * — while `supabase` is wired once its env is present, following the
 * `emailProvider` / `videoProvider` precedent.
 */
export function storageProvider(): StorageProvider {
  provider ??= (() => {
    switch (env.STORAGE_PROVIDER) {
      case 'supabase':
        return new SupabaseStorageProvider(
          // The env schema guarantees these are present when the provider is
          // supabase; the assertions are for the type checker, not a real branch.
          env.SUPABASE_URL as string,
          env.SUPABASE_SERVICE_ROLE_KEY as string,
          env.SUPABASE_STORAGE_BUCKET,
        );
      case 'none':
        return new NoopStorageProvider();
    }
  })();
  return provider;
}

/** Test seam: lets tests supply a capturing or failing storage provider. */
export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}

export type { StorageProvider } from './storage-provider.js';
