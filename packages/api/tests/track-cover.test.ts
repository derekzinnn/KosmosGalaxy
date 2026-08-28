import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NoopStorageProvider } from '../src/services/storage/noop-storage-provider.js';
import { setStorageProvider } from '../src/services/storage/index.js';
import type { StorageProvider } from '../src/services/storage/storage-provider.js';
import { api, bearer, loginAs, useCapturingEmails } from './helpers/api.js';
import {
  createPublishedTrack,
  createSuperadmin,
  createTenantWithUsers,
} from './helpers/factories.js';

/** Records what it was asked to store, and hands back a predictable public URL. */
class FakeStorage implements StorageProvider {
  readonly name = 'fake';
  readonly configured = true;
  readonly uploads: { path: string; size: number; contentType: string }[] = [];
  readonly removed: string[] = [];

  upload(path: string, body: Buffer, contentType: string): Promise<void> {
    this.uploads.push({ path, size: body.length, contentType });
    return Promise.resolve();
  }
  remove(path: string): Promise<void> {
    this.removed.push(path);
    return Promise.resolve();
  }
  publicUrl(path: string): string {
    return `https://cdn.test/${path}`;
  }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe('track banner', () => {
  let storage: FakeStorage;
  let superadminToken: string;
  let trackId: string;

  beforeEach(async () => {
    useCapturingEmails();
    storage = new FakeStorage();
    setStorageProvider(storage);

    superadminToken = await loginAs((await createSuperadmin()).email);
    trackId = (await createPublishedTrack()).track.id;
  });

  afterAll(() => {
    // Leave the shared singleton where later files expect it.
    setStorageProvider(new NoopStorageProvider());
  });

  it('is refused to a client owner', async () => {
    const { owner } = await createTenantWithUsers('Empresa A');
    const ownerToken = await loginAs(owner.email);

    const response = await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(ownerToken))
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
    expect(storage.uploads).toHaveLength(0);
  });

  it('uploads a banner and returns its public URL', async () => {
    const response = await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(200);

    expect(storage.uploads).toHaveLength(1);
    expect(storage.uploads[0]?.contentType).toBe('image/png');
    expect(storage.uploads[0]?.path).toMatch(new RegExp(`^tracks/${trackId}/cover-.*\\.png$`));

    expect(response.body.track.coverImageUrl).toBe(`https://cdn.test/${storage.uploads[0]?.path}`);
  });

  it('rejects a non-image body', async () => {
    const response = await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'text/plain')
      .send('not an image')
      .expect(400);

    expect(response.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    expect(storage.uploads).toHaveLength(0);
  });

  it('replacing a banner deletes the previous object', async () => {
    await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(200);
    const firstPath = storage.uploads[0]?.path as string;

    await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'image/webp')
      .send(PNG)
      .expect(200);

    expect(storage.uploads).toHaveLength(2);
    expect(storage.removed).toContain(firstPath);
  });

  it('removes a banner and falls back to no cover', async () => {
    await api()
      .post(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(200);
    const path = storage.uploads[0]?.path as string;

    const response = await api()
      .delete(`/tracks/${trackId}/cover`)
      .set('Authorization', bearer(superadminToken))
      .expect(200);

    expect(response.body.track.coverImageUrl).toBeNull();
    expect(storage.removed).toContain(path);
  });

  it('answers 404 for a track that does not exist', async () => {
    await api()
      .post(`/tracks/01a00000-0000-7000-8000-000000000000/cover`)
      .set('Authorization', bearer(superadminToken))
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(404);
  });
});
