import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTokens,
  getAccessToken,
  setTokens,
} from '@/api/client'
import { createAuthAdapter } from '../adapter'

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input)
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GI-003: sign out on a shared machine', () => {
  beforeEach(() => {
    clearTokens()
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Successfully logged out.' })),
    )
  })

  afterEach(() => {
    clearTokens()
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clears the access token and notifies listeners immediately', async () => {
    setTokens('access-token')
    const adapter = createAuthAdapter()

    const listener = vi.fn()
    adapter.onAuthStateChanged(listener)
    listener.mockClear()

    await adapter.signOut()

    expect(getAccessToken()).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
    expect(adapter.getCurrentUser()).toBeNull()
  })

  it('sends logout with credentials and no refresh token in the request body', async () => {
    setTokens('access-token')
    const adapter = createAuthAdapter()

    await adapter.signOut()

    const logoutCall = vi.mocked(fetch).mock.calls.find(
      ([input]) => requestUrl(input).endsWith('/api/auth/logout/'),
    )

    expect(logoutCall).toBeDefined()
    if (!logoutCall) {
      throw new Error('The logout request was not sent.')
    }
    expect(logoutCall[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(logoutCall[1]).not.toHaveProperty('body')
  })

  it('still clears the local session if the server request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    setTokens('access-token')
    const adapter = createAuthAdapter()

    await expect(adapter.signOut()).resolves.toBeUndefined()

    expect(getAccessToken()).toBeNull()
    expect(adapter.getCurrentUser()).toBeNull()
  })

  it('restores a session from the HttpOnly refresh cookie after a reload', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, _init) => {
      const url = requestUrl(input)

      if (url.endsWith('/api/auth/refresh/')) {
        return jsonResponse({ access: 'restored-access-token' })
      }

      if (url.endsWith('/api/auth/me/')) {
        return jsonResponse({
          id: 7,
          email: 'patient@example.com',
          first_name: 'Test',
          last_name: 'Patient',
        })
      }

      throw new Error(`Unexpected fetch request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = createAuthAdapter()
    const listener = vi.fn()
    adapter.onAuthStateChanged(listener)

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'patient@example.com' }),
      )
    })

    const refreshCall = fetchMock.mock.calls.find(
      ([input]) => requestUrl(input).endsWith('/api/auth/refresh/'),
    )

    expect(refreshCall).toBeDefined()
    if (!refreshCall) {
      throw new Error('The refresh request was not sent.')
    }
    expect(refreshCall[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(getAccessToken()).toBe('restored-access-token')
  })
})
