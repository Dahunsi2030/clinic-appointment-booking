import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoutes } from 'react-router-dom';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { clearTokens, client, getAccessToken, setTokens } from '@/api/client';
import { AuthProvider } from '../components/auth-provider';
import { routes } from '@/router/routes';
import { Path } from '@/router/paths';
import { createAuthAdapter } from '../adapter';

function AppRoutes() {
  return useRoutes(routes);
}

function renderApp(initialEntry = '/') {
  return renderWithProviders(
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>,
    { routerEntries: [initialEntry] },
  );
}

const patient = {
  id: 42,
  email: 'patient@example.com',
  first_name: 'Ada',
  last_name: 'Patient',
};

beforeEach(() => {
  localStorage.clear();
  clearTokens();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/refresh/')) {
        return new Response(
          JSON.stringify({ access: 'restored-access-token' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url.includes('/api/auth/me/')) {
        return new Response(JSON.stringify(patient), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ detail: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  clearTokens();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GI-002: Session persistence', () => {
  it('restores the patient session when the application starts again', async () => {
    renderApp(Path.Dashboard);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/refresh/'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me/'),
        expect.any(Object),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('patient@example.com')).toBeInTheDocument();
    });

    // The app should finish restoring authentication instead of remaining
    // stuck on a loading state or redirecting to sign-in.
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  it('does not restore the previous session when logout is pending', async () => {
    localStorage.setItem('auth:logout-pending', 'true');

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/logout/')) {
        return new Response(null, { status: 204 });
      }

      if (url.includes('/api/auth/refresh/')) {
        return new Response(
          JSON.stringify({ access: 'restored-access-token' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url.includes('/api/auth/me/')) {
        return new Response(JSON.stringify(patient), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ detail: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    renderApp(Path.Dashboard);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout/'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh/'),
      expect.any(Object),
    );

    await waitFor(() => {
      expect(localStorage.getItem('auth:logout-pending')).toBeNull();
    });

    expect(screen.queryByText('patient@example.com')).not.toBeInTheDocument();
  });

  it('signs the patient out locally when the server logout fails', async () => {
    setTokens('existing-access-token');

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/auth/me/')) {
        return new Response(JSON.stringify(patient), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/auth/logout/')) {
        return new Response(JSON.stringify({ detail: 'Server unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ detail: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const adapter = createAuthAdapter();
    const authStates: Array<typeof patient | null> = [];

    const unsubscribe = adapter.onAuthStateChanged((user) => {
      authStates.push(user as typeof patient | null);
    });

    await waitFor(() => {
      expect(adapter.getCurrentUser()?.email).toBe('patient@example.com');
    });

    await expect(adapter.signOut()).rejects.toThrow();

    expect(adapter.getCurrentUser()).toBeNull();
    expect(authStates.at(-1)).toBeNull();
    expect(localStorage.getItem('auth:logout-pending')).toBe('true');

    unsubscribe();
  });

  it('does not restore the session if pending logout retry fails', async () => {
    localStorage.setItem('auth:logout-pending', 'true');

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/auth/logout/')) {
          return new Response(
            JSON.stringify({ detail: 'Server unavailable' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.includes('/api/auth/refresh/')) {
          return new Response(
            JSON.stringify({ access: 'restored-access-token' }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.includes('/api/auth/me/')) {
          return new Response(JSON.stringify(patient), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ detail: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    vi.stubGlobal('fetch', fetchMock);

    renderApp(Path.Dashboard);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout/'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh/'),
      expect.any(Object),
    );

    expect(localStorage.getItem('auth:logout-pending')).toBe('true');

    expect(screen.queryByText('patient@example.com')).not.toBeInTheDocument();
  });

  it('clears the current user when the API client reports refresh failure', async () => {
    setTokens('expired-access-token');

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);

        if (url.includes('/api/auth/me/')) {
          return new Response(JSON.stringify(patient), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/auth/refresh/')) {
          return new Response(JSON.stringify({ detail: 'Refresh failed' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/example/')) {
          return new Response(JSON.stringify({ detail: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ detail: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createAuthAdapter();

    await waitFor(() => {
      expect(adapter.getCurrentUser()?.email).toBe('patient@example.com');
    });

    await client.get({
      url: 'http://localhost:8000/api/example/',
    } as any);

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/auth/refresh/'),
      ),
    ).toBe(true);

    expect(getAccessToken()).toBeNull();
    expect(adapter.getCurrentUser()).toBeNull();
  });
});
