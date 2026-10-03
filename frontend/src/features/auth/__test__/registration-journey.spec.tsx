import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/components/auth-provider'
import { routes } from '@/router/routes'
import { MemoryRouter, useRoutes } from 'react-router-dom'

function AppRoutes() {
  return useRoutes(routes)
}

describe('Registration journey', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('navigates from Home to the registration page', async () => {
    const user = userEvent.setup()

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)

      if (url.endsWith('/api/auth/register/')) {
        return new Response(
          JSON.stringify({
            access: 'mockAccessToken',
            refresh: 'mockRefreshToken',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      // Mock the response for the current user endpoint

      if (url.endsWith('/api/auth/me/')) {
        return new Response(
          JSON.stringify({
            id: 1,
            email: 'test@example.com',
            first_name: 'Test User',
            last_name: ' ',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch request: ${url}`)
    })

    // Render the app with routing and providers
    render(
      <ChakraProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ChakraProvider>,
    )

    expect(
      screen.getByRole('link', { name: /sign up/i }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('link', { name: /sign up/i }),
    )

    expect(
      screen.getByRole('heading', { name: 'Create Account' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument()

    // Ensure that the login API is not called during the registration process
    await screen.findByRole('button', { name: /account/i })

    // Ensure that the login API is not called during the registration process
    expect(
      fetchMock.mock.calls.some(([input]) => 
        String(input).endsWith('/api/auth/login/'),
    ),
    ).toBe(false)

    // Fill out the registration form
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'TestPassword123!')

    // Submit the registration form
    await user.click(screen.getByRole('button', { name: /create account/i }))
  })
})