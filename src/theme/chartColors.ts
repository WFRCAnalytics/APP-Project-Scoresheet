// Reads the categorical chart palette from theme/tokens.css at runtime via
// getComputedStyle, rather than duplicating hex values in JS. This is what makes chart
// colors correctly follow the light/dark `prefers-color-scheme` switch live (the CSS
// custom properties already do; this just reads whatever they currently resolve to) —
// constitution Principle VII: never invent arbitrary chart colors when the RTP/Wasatch
// Choice palette exists for the purpose.

import { useEffect, useState } from "react";

const CHART_TOKEN_COUNT = 18;

function readChartPalette(): string[] {
  if (typeof window === "undefined") return [];
  const styles = getComputedStyle(document.documentElement);
  return Array.from({ length: CHART_TOKEN_COUNT }, (_, i) =>
    styles.getPropertyValue(`--chart-${i + 1}`).trim(),
  );
}

function readColorToken(name: string): string {
  if (typeof window === "undefined") return "#000000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The full categorical palette plus the two semantic "metric" colors this dashboard's
 * Overall-vs-City charts use consistently (Overall = chart-1, City = chart-2) — both
 * charts compare the same two metrics rather than many firms at once, so a fixed
 * metric->color mapping reads more clearly than reassigning colors per firm while still
 * drawing exclusively from the mandated palette.
 *
 * Re-reads on two triggers:
 *  - the system color-scheme changing, so charts stay correct if a handler's OS theme
 *    switches mid-session;
 *  - `beforeprint`/`afterprint`, because Recharts bakes these values into SVG `fill`
 *    attributes at render time — a `@media print` CSS override alone (tokens.css) can't
 *    retroactively change an attribute React already wrote. Re-reading right before
 *    print picks up tokens.css's print-forced light-mode values instead of whatever the
 *    on-screen theme happened to be (constitution Principle VII's PDF legibility
 *    carve-out). */
export function useChartColors() {
  const [palette, setPalette] = useState<string[]>(() => readChartPalette());
  const [overallColor, setOverallColor] = useState(() => readColorToken("--chart-1"));
  const [cityColor, setCityColor] = useState(() => readColorToken("--chart-2"));

  useEffect(() => {
    const refresh = () => {
      setPalette(readChartPalette());
      setOverallColor(readColorToken("--chart-1"));
      setCityColor(readColorToken("--chart-2"));
    };

    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    colorSchemeQuery.addEventListener("change", refresh);
    window.addEventListener("beforeprint", refresh);
    window.addEventListener("afterprint", refresh); // restore on-screen colors after printing

    return () => {
      colorSchemeQuery.removeEventListener("change", refresh);
      window.removeEventListener("beforeprint", refresh);
      window.removeEventListener("afterprint", refresh);
    };
  }, []);

  return { palette, overallColor, cityColor };
}
