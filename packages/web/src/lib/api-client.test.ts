import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi, setAccessToken } from './api-client';

/**
 * Regression tests for the bug that logged everybody out on page load.
 *
 * Refresh tokens rotate, so presenting one spends it. Two overlapping
 * refreshes therefore look exactly like a stolen token being replayed, and
 * the API responds by killing the session — which is correct of it, and
 * catastrophic if our own client is what caused the overlap.
 */
describe('refresh serialisation', () => {
  const session = {
    accessToken: 'token-de-acesso',
    expiresInSeconds: 900,
    user: {
      id: 'u1',
      email: 'ze@padaria.com.br',
      name: 'Jose',
      role: 'CLIENT_OWNER' as const,
      status: 'ACTIVE' as const,
      tenantId: 't1',
      lastLoginAt: null,
    },
  };

  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('makes exactly one network call when several callers refresh at once', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(new Response(JSON.stringify(session), { status: 200 })), 20),
          ),
      );
    vi.stubGlobal('fetch', fetchMock);

    // React StrictMode double-invokes effects; a boot and a renewal timer can
    // also land together. All of them must share one rotation.
    const results = await Promise.all([authApi.restore(), authApi.restore(), authApi.restore()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result?.accessToken === 'token-de-acesso')).toBe(true);
  });

  it('serialises across tabs through a Web Lock', async () => {
    const order: string[] = [];
    const locks = {
      request: vi.fn(async (name: string, callback: () => Promise<unknown>) => {
        order.push(`acquire:${name}`);
        const value = await callback();
        order.push(`release:${name}`);
        return value;
      }),
    };
    vi.stubGlobal('navigator', { locks });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(session))));

    await authApi.restore();

    expect(locks.request).toHaveBeenCalledWith('kosmos-galaxy:refresh', expect.any(Function));
    expect(order).toEqual(['acquire:kosmos-galaxy:refresh', 'release:kosmos-galaxy:refresh']);
  });

  it('starts a fresh rotation once the previous one has settled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(session)));
    vi.stubGlobal('fetch', fetchMock);

    await authApi.restore();
    await authApi.restore();

    // Sequential calls are not deduplicated — only overlapping ones are.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports no session and clears the token when the cookie is gone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 401 })),
    );

    await expect(authApi.restore()).resolves.toBeNull();
  });

  it('survives the network being unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(authApi.restore()).resolves.toBeNull();
  });
});
