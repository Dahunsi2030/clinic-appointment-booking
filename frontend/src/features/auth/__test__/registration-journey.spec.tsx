import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoutes } from "react-router-dom";
import { renderWithProviders } from "@/__tests__/test-utils";
import { clearTokens } from "@/api/client";
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

describe("Registration journey", () => {
  beforeEach(() => {
    localStorage.clear();
    clearTokens();
  });

  afterEach(() => {
    clearTokens();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("registers a user from Home and lands them signed in", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.endsWith("/api/auth/register/")) {
          return new Response(
            JSON.stringify({
              access: "mockAccessToken",
              refresh: "mockRefreshToken",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (url.endsWith("/api/auth/me/")) {
          return new Response(
            JSON.stringify({
              id: 1,
              email: "test@example.com",
              first_name: "Test User",
              last_name: " ",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      });

    renderApp("/");

    const createAccountLink = screen.getByRole("link", {
      name: "Create Account",
    });

    expect(createAccountLink).toBeInTheDocument();

    await user.click(createAccountLink);

    expect(
      screen.getByRole("heading", { name: "Create Account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "TestPassword123!");

    await user.click(screen.getByRole("button", { name: /create account/i }));


    expect(
      await screen.findByRole("link", { name: "Dashboard" }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Create Account" }),
    ).not.toBeInTheDocument();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/auth/login/"),
      ),
    ).toBe(false);
  });

  it("shows an error when the email is already registered", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/auth/register/")) {
        return new Response(
          JSON.stringify({
            email: ["That email is already registered"],
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    renderApp("/");

    await user.click(screen.getByRole("link", { name: "Create Account" }));

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "existing@example.com");
    await user.type(screen.getByLabelText(/password/i), "TestPassword123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent("That email is already registered");
    expect(
      screen.getByRole("heading", { name: "Create Account" }),
    ).toBeInTheDocument();
  });

  it("shows an error when the password is too weak", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/auth/register/")) {
        return new Response(
          JSON.stringify({
            password: ["This password is too weak."],
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch request: ${url}`);
    });

    renderApp("/");

    await user.click(screen.getByRole("link", { name: "Create Account" }));

    await user.type(screen.getByLabelText(/name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/this password is too weak/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Create Account" }),
    ).toBeInTheDocument();
  });
});
