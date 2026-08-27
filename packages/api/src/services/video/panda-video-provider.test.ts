import { jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { PandaVideoProvider } from './panda-video-provider.js';
import type { Viewer } from './video-provider.js';

const config = {
  apiKey: 'test-api-key',
  libraryId: 'vz-test-123',
  watermarkGroupId: 'group-abc',
  watermarkSecret: 'a-watermark-secret-at-least-32-bytes-long',
};

const secret = new TextEncoder().encode(config.watermarkSecret);

function viewer(over: Partial<Viewer> = {}): Viewer {
  return {
    userId: 'user-1',
    email: 'cliente@empresa.com.br',
    name: 'cliente@empresa.com.br',
    tenantId: 'tenant-1',
    ip: '203.0.113.7',
    ...over,
  };
}

describe('PandaVideoProvider.signPlaybackUrl', () => {
  const provider = new PandaVideoProvider(config);

  it('builds the embed URL on the configured library subdomain', async () => {
    const { url } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer(),
    });

    expect(url).toContain(`https://player-${config.libraryId}.tv.pandavideo.com.br/embed/`);
    expect(url).toContain('v=video-xyz');
    expect(url).toContain('watermark=');
  });

  it('never puts the api key or the secret in the URL', async () => {
    const { url } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer(),
    });

    expect(url).not.toContain(config.apiKey);
    expect(url).not.toContain(config.watermarkSecret);
  });

  it('signs a watermark JWT the group secret can verify', async () => {
    const { url } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer(),
    });

    const token = new URL(url).searchParams.get('watermark');
    expect(token).toBeTypeOf('string');

    const { payload } = await jwtVerify(token as string, secret);
    expect(payload.drm_group_id).toBe(config.watermarkGroupId);
  });

  it('burns the viewer identity into the watermark, so a leak is traceable', async () => {
    const { url } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer({ email: 'quem.vazou@empresa.com.br' }),
    });

    const token = new URL(url).searchParams.get('watermark') as string;
    const { payload } = await jwtVerify(token, secret);

    expect(JSON.stringify(payload)).toContain('quem.vazou@empresa.com.br');
  });

  it('gives two viewers two different tokens for the same video', async () => {
    const a = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer({ userId: 'user-a', email: 'a@empresa.com.br' }),
    });
    const b = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer({ userId: 'user-b', email: 'b@empresa.com.br' }),
    });

    const tokenA = new URL(a.url).searchParams.get('watermark');
    const tokenB = new URL(b.url).searchParams.get('watermark');
    expect(tokenA).not.toBe(tokenB);
  });

  it('expires the token at the moment it promises to', async () => {
    const before = Date.now();
    const { url, expiresAt } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer(),
    });

    // The reported expiry is inside the window we asked for.
    expect(expiresAt.getTime()).toBeGreaterThan(before);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(before + 600_000 + 1000);

    // And the token itself carries that same expiry, not a different one.
    const token = new URL(url).searchParams.get('watermark') as string;
    const { payload } = await jwtVerify(token, secret);
    expect(payload.exp).toBe(Math.floor(expiresAt.getTime() / 1000));
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { url } = await provider.signPlaybackUrl('video-xyz', {
      expiresInSeconds: 600,
      viewer: viewer(),
    });
    const token = new URL(url).searchParams.get('watermark') as string;

    const wrong = new TextEncoder().encode('not-the-group-secret-not-the-group-secret');
    await expect(jwtVerify(token, wrong)).rejects.toThrow();
  });
});
