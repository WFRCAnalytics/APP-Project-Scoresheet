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
