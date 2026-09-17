// usePrintSafeChartColors reads chart colors from a SCOPED element (the one carrying
// tokens.css's `.chart-print-safe-scope` class), not from `document.documentElement` the
// way theme/chartColors.ts's useChartColors does — that's the whole point: this hook backs
// the PDF export's dedicated off-screen chart copy, which must stay light-colored
// regardless of whatever theme the rest of the app is currently in. getComputedStyle is
// stubbed per-element (rather than relying on jsdom's real CSS engine) for the same reason
// chartColors.test.ts stubs it: jsdom doesn't evaluate class-scoped custom-property
// cascades the way a real browser does — this test is about whether the hook reads from
// the right ELEMENT, not about re-verifying tokens.css's own values.

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrintSafeChartColors } from "../../src/theme/usePrintSafeChartColors";

const SCOPE_TOKENS: Record<string, string> = {
  "--chart-1": "#3f748e",
  "--chart-2": "#789d4b",
  "--chart-3": "#c48839",
  "--color-foreground": "#151515",
  "--color-border": "#d8d5d2",
  "--color-background": "#ffffff",
};

// Deliberately different from SCOPE_TOKENS — stands in for whatever `document.documentElement`
// currently resolves to (e.g. a dark-mode-toggled app) so the test can prove the hook never
// reads from it.
const DOCUMENT_ELEMENT_TOKENS: Record<string, string> = {
  "--chart-1": "#5c899f",
  "--chart-2": "#ff0000",
  "--chart-3": "#ff00ff",
  "--color-foreground": "#ffffff",
  "--color-border": "#23394a",
  "--color-background": "#081b26",
};

describe("usePrintSafeChartColors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads from the scoped element it's given, never from document.documentElement", async () => {
    const scopeEl = document.createElement("div");
    document.body.appendChild(scopeEl);

    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      const tokens = el === scopeEl ? SCOPE_TOKENS : DOCUMENT_ELEMENT_TOKENS;
      return { getPropertyValue: (prop: string) => tokens[prop] ?? "" } as CSSStyleDeclaration;
    });

    const scopeRef = { current: scopeEl };
    const { result } = renderHook(() => usePrintSafeChartColors(scopeRef));

    await waitFor(() => {
      expect(result.current.wfrcColor).toBe(SCOPE_TOKENS["--chart-1"]);
    });
    expect(result.current.applicantColor).toBe(SCOPE_TOKENS["--chart-2"]);
    expect(result.current.overallColor).toBe(SCOPE_TOKENS["--chart-3"]);
    expect(result.current.foregroundColor).toBe(SCOPE_TOKENS["--color-foreground"]);
    expect(result.current.borderColor).toBe(SCOPE_TOKENS["--color-border"]);
    expect(result.current.backgroundColor).toBe(SCOPE_TOKENS["--color-background"]);

    document.body.removeChild(scopeEl);
  });

  it("has a light-colored fallback before the scoped element mounts (never briefly dark)", () => {
    const scopeRef = { current: null };
    const { result } = renderHook(() => usePrintSafeChartColors(scopeRef));

    expect(result.current.backgroundColor).toBe("#ffffff");
    expect(result.current.foregroundColor).toBe("#151515");
  });
});
