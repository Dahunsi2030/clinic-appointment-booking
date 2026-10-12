import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTokens,
  client,
  getAccessToken,
  setTokens,
  setAuthSessionExpiredHandler,
} from '../client';

describe('API client token refresh', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearTokens();
  });

  afterEach(() => {
    clearTokens();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('refreshes the access token and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: 'new-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    globalThis.fetch = fetchMock;
    setTokens('expired-access-token');

    const response = await client.get({
      url: 'http://localhost:8000/api/example/',
    } as any);

    expect(response.data).toEqual({ result: 'success' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('new-access-token');

    const retriedRequest = fetchMock.mock.calls[2]?.[0] as Request | undefined;
    expect(retriedRequest?.headers.get('Authorization')).toBe(
      'Bearer new-access-token',
    );
  });

  it('clears the token and notifies the auth handler when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Refresh failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const expiredHandler = vi.fn();

    globalThis.fetch = fetchMock;
    setTokens('expired-access-token');
    setAuthSessionExpiredHandler(expiredHandler);

    try {
      await client.get({
        url: 'http://localhost:8000/api/example/',
      } as any);

      expect(getAccessToken()).toBeNull();
      expect(expiredHandler).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      setAuthSessionExpiredHandler(null);
    }
  });
});
