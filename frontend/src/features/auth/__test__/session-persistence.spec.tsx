
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoutes } from 'react-router-dom';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { clearTokens } from '@/api/client';
import { AuthProvider } from '../components/auth-provider';
import { routes } from '@/router/routes';
import { Path } from '@/router/paths';

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
        return new Response(JSON.stringify({ access: 'restored-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
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
});
