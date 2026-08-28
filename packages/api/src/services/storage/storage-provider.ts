/**
 * Where uploaded images live.
 *
 * The seam is deliberately thin, following `EmailProvider` and `VideoProvider`:
 * it covers the three things the API needs — put an object, remove one, and
 * turn a stored path into a URL a browser can load — and nothing else. Which
 * vendor sits behind it (Supabase today) is a choice that stops here.
 */
export interface StorageProvider {
  readonly name: string;

  /** Store `body` at `path`, overwriting any object already there. */
  upload(path: string, body: Buffer, contentType: string): Promise<void>;

  /** Remove the object at `path`. Best-effort: a missing object is not an error. */
  remove(path: string): Promise<void>;

  /** The public URL a browser loads the object from, or null if unknowable. */
  publicUrl(path: string): string | null;

  /** Whether this provider can actually store anything. False for the no-op. */
  readonly configured: boolean;
}
