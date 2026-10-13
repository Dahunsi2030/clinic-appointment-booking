import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoutes } from "react-router-dom";
import { renderWithProviders } from "@/__tests__/test-utils";
import { clearTokens, setTokens } from "@/api/client";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { routes } from "@/router/routes";

function AppRoutes() {
  return useRoutes(routes);
}

function renderApp(initialEntry = "/") {
  return renderWithProviders(
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>,
    { routerEntries: [initialEntry] },
  );
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

describe("GI-003: protected navigation after sign-out", () => {
  beforeEach(() => {
    clearTokens();
    localStorage.clear();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = requestUrl(input);

      if (url.endsWith("/api/auth/me/")) {
        return new Response(
          JSON.stringify({
            id: 1,
            email: "patient@example.com",
            first_name: "Test",
            last_name: "Patient",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.endsWith("/api/auth/logout/")) {
        return new Response(
          JSON.stringify({ detail: "Successfully logged out." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });
  });

  afterEach(() => {
    clearTokens();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects an unauthenticated visitor away from the dashboard", async () => {
    renderApp("/dashboard");

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("signs out and removes the private dashboard content", async () => {
    const user = userEvent.setup();

    setTokens("test-access-token");
    renderApp("/dashboard");

    expect(
      await screen.findByText(/welcome back,\s*test patient/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /test patient/i }));
    await user.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    expect(
      await screen.findByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText(/welcome,?\s+test patient/i),
      ).not.toBeInTheDocument();
    });
  });
});