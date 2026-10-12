import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/api/client'
import { createAuthAdapter } from '../adapter'

describe('GI-003: sign out on a shared machine', () => {
  beforeEach(() => {
    clearTokens()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ detail: 'Successfully logged out.' }),
      }),
    )
  })

  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clears both tokens and notifies listeners immediately', async () => {
    const adapter = createAuthAdapter()
    setTokens('access-token', 'refresh-token')

    const listener = vi.fn()
    adapter.onAuthStateChanged(listener)
    listener.mockClear()

    await adapter.signOut()

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
  })

  it('sends the logout request with the captured access token', async () => {
    const adapter = createAuthAdapter()
    setTokens('access-token', 'refresh-token')

    await adapter.signOut()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout/'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
        body: JSON.stringify({ refresh: 'refresh-token' }),
      }),
    )
  })

  it('still clears the local session if the server request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const adapter = createAuthAdapter()
    setTokens('access-token', 'refresh-token')

    await expect(adapter.signOut()).resolves.toBeUndefined()

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(adapter.getCurrentUser()).toBeNull()
  })
})