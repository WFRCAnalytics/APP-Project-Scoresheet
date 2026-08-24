// Regression test for a manual-testing bug found after the 003 Dashboard redesign: chart
// text (axis labels, legend, gridlines — everything useChartColors resolves besides the
// two data-series fills) stayed whatever color it resolved to at initial render when the
// theme toggle was switched, never updating live. Root cause: the hook's only re-resolution
// triggers were the `prefers-color-scheme` matchMedia "change" event and print — a manual
// toggle (ThemeToggle -> useTheme.ts) sets the `data-theme` attribute directly and never
// fires a matchMedia event at all, so that path was never re-read. Fixed by watching the
// `data-theme` attribute itself via MutationObserver, which fires for both trigger cases
// useTheme.ts can produce (manual toggle AND a live, unset-override OS preference change,
// since useTheme.ts's own effect is the one place that ever writes that attribute).
//
// getComputedStyle is stubbed rather than relying on jsdom's real CSS engine to evaluate
// tokens.css's `@media (prefers-color-scheme)`/`[data-theme]` blocks (jsdom's CSS support
// doesn't resolve those the way a real browser does) — this test is about whether the HOOK
// re-reads after a `data-theme` mutation, not about re-verifying tokens.css's own values
// (that's contrast.test.ts's job).

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChartColors } from "../../src/theme/chartColors";

const LIGHT_TOKENS: Record<string, string> = {
  "--chart-1": "#3f748e",
  "--chart-2": "#789d4b",
  "--color-foreground": "#151515",
  "--color-border": "#d8d5d2",
  "--color-background": "#ffffff",
};

const DARK_TOKENS: Record<string, string> = {
  "--chart-1": "#5c899f",
  "--chart-2": "#789d4b",
  "--color-foreground": "#ffffff",
  "--color-border": "#23394a",
  "--color-background": "#081b26",
};

function stubComputedStyle(tokens: Record<string, string>) {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    getPropertyValue: (prop: string) => tokens[prop] ?? "",
  } as CSSStyleDeclaration);
}

describe("useChartColors re-resolves when the effective theme changes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("re-reads resolved colors after a data-theme mutation (e.g. ThemeToggle's manual override)", async () => {
    stubComputedStyle(LIGHT_TOKENS);
    const { result } = renderHook(() => useChartColors());

    expect(result.current.wfrcColor).toBe(LIGHT_TOKENS["--chart-1"]);
    expect(result.current.foregroundColor).toBe(LIGHT_TOKENS["--color-foreground"]);

    // Simulates exactly what useTheme.ts's toggleTheme() does on a manual toggle: flip the
    // `data-theme` attribute directly. No matchMedia event fires for this path — that's
    // the bug. Swap the stub first so the observer's re-read actually sees new values.
    stubComputedStyle(DARK_TOKENS);
    act(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });

    // MutationObserver callbacks run as a microtask, not synchronously with the mutation —
    // waitFor lets that settle instead of asserting immediately.
    await waitFor(() => {
      expect(result.current.wfrcColor).toBe(DARK_TOKENS["--chart-1"]);
    });
    expect(result.current.foregroundColor).toBe(DARK_TOKENS["--color-foreground"]);
    expect(result.current.borderColor).toBe(DARK_TOKENS["--color-border"]);
    expect(result.current.backgroundColor).toBe(DARK_TOKENS["--color-background"]);
  });

  it("still re-reads on beforeprint/afterprint (the pre-existing PDF color carve-out)", async () => {
    stubComputedStyle(DARK_TOKENS);
    const { result } = renderHook(() => useChartColors());
    expect(result.current.wfrcColor).toBe(DARK_TOKENS["--chart-1"]);

    // Printing doesn't touch data-theme — tokens.css's own `@media print` block forces
    // light-mode values regardless of the on-screen theme (constitution Principle VII's
    // PDF legibility carve-out); simulated here via a fresh stub, same as production's
    // real print-forced CSS would produce.
    stubComputedStyle(LIGHT_TOKENS);
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    await waitFor(() => {
      expect(result.current.wfrcColor).toBe(LIGHT_TOKENS["--chart-1"]);
    });

    stubComputedStyle(DARK_TOKENS);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    await waitFor(() => {
      expect(result.current.wfrcColor).toBe(DARK_TOKENS["--chart-1"]);
    });
  });
});
