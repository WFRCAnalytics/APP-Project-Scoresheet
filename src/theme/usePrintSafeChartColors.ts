// Colors for the PDF export's dedicated, always-off-screen chart copy (see
// OverallApplicantBarChart.tsx's PrintCopy export and tokens.css's `.chart-print-safe-scope`
// for the full story — short version: Recharts bakes colors into literal SVG attributes, so
// there's no way for the SAME, visible, theme-following chart to also be captured in
// light-mode colors for print without either flashing the screen or racing a DOM clone).
//
// Reads from a scoped element carrying `.chart-print-safe-scope` (tokens.css) instead of
// `document.documentElement` — that class redeclares the categorical palette plus
// foreground/border/background to their light-mode values unconditionally, so this hook
// only ever needs to read them once, after the scoped element mounts. Unlike
// theme/chartColors.ts's useChartColors, there's nothing here to watch for changes: this
// scope's values never change, by design.

import { useEffect, useState } from "react";
import type { RefObject } from "react";

const CHART_TOKEN_COUNT = 18;

const FALLBACK = {
  palette: [] as string[],
  overallColor: "#c48839",
  applicantColor: "#789d4b",
  wfrcColor: "#3f748e",
  foregroundColor: "#151515",
  borderColor: "#d8d5d2",
  backgroundColor: "#ffffff",
};

export type PrintSafeChartColors = typeof FALLBACK;

function readAll(scope: Element): PrintSafeChartColors {
  const styles = getComputedStyle(scope);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    palette: Array.from({ length: CHART_TOKEN_COUNT }, (_, i) => read(`--chart-${i + 1}`)),
    overallColor: read("--chart-3"),
    applicantColor: read("--chart-2"),
    wfrcColor: read("--chart-1"),
    foregroundColor: read("--color-foreground"),
    borderColor: read("--color-border"),
    backgroundColor: read("--color-background"),
  };
}

export function usePrintSafeChartColors(
  scopeRef: RefObject<Element | null>,
): PrintSafeChartColors {
  const [colors, setColors] = useState<PrintSafeChartColors>(FALLBACK);

  useEffect(() => {
    if (!scopeRef.current) return;
    setColors(readAll(scopeRef.current));
  }, [scopeRef]);

  return colors;
}
