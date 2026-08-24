// Vitest + React Testing Library global setup (T005).
// jest-dom adds custom matchers (toBeInTheDocument, etc.) used across component tests.
import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement ResizeObserver, even though every real target browser does —
// Recharts' <ResponsiveContainer> (used by the Dashboard charts, Phase 5) requires it to
// exist. This is a test-environment polyfill, not a stand-in for real behavior: it makes
// no behavioral claim about sizing, it just satisfies the constructor so component tests
// can render past it.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= ResizeObserverMock;

// jsdom also doesn't implement window.matchMedia at all (not even a stub) — used by
// theme/chartColors.ts to track prefers-color-scheme/print. Real browsers all implement
// this; the mock below reports "no match" for every query, which is the correct default
// for a test environment with no real display/print context.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

// window.localStorage is also unavailable in this jsdom/vitest combination (confirmed empty
// rather than throwing) — used by theme/useTheme.ts for local-only persistence. A minimal
// in-memory Storage polyfill, not a claim about real persistence semantics (no cross-tab
// storage events, no quota) — same "satisfies the API so tests can render past it" spirit as
// the ResizeObserver/matchMedia polyfills above. Lives for the lifetime of one test file's
// jsdom window; tests that need isolation between individual `it()` blocks should call
// `window.localStorage.clear()` in their own `beforeEach`.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const localStoragePolyfill: Storage = {
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStoragePolyfill,
    configurable: true,
  });
}
