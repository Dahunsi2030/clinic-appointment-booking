import '@testing-library/jest-dom/vitest'

// Mock window.matchMedia (not implemented in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Clean up after each test
afterEach(() => {
  document.body.innerHTML = ''
})

// Using AbortController and AbortSignal in tests
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'AbortController', {
    writable: true,
    value: globalThis.AbortController,
  })

  Object.defineProperty(window, 'AbortSignal', {
    writable: true,
    value: globalThis.AbortSignal,
  })
}