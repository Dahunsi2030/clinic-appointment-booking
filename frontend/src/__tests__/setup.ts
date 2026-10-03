import "@testing-library/jest-dom/vitest";

const createMatchMediaMock = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

// Mock window.matchMedia (not implemented in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => createMatchMediaMock(query)),
});

Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  value: window.matchMedia,
});

// Clean up after each test
afterEach(() => {
  document.body.innerHTML = "";
});

// Using AbortController and AbortSignal in tests
if (typeof window !== "undefined") {
  Object.defineProperty(window, "AbortController", {
    writable: true,
    value: globalThis.AbortController,
  });

  Object.defineProperty(window, "AbortSignal", {
    writable: true,
    value: globalThis.AbortSignal,
  });
}
