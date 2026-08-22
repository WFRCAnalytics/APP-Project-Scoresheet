// Reads the categorical chart palette from theme/tokens.css at runtime via
// getComputedStyle, rather than duplicating hex values in JS. This is what makes chart
// colors correctly follow the light/dark theme switch live (the CSS custom properties
// already do; this just reads whatever they currently resolve to) — constitution
// Principle VII: never invent arbitrary chart colors when the RTP/Wasatch Choice palette
// exists for the purpose.

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
 * Also resolves foreground/border/background to literal hex, for the same reason
 * overall/cityColor are resolved rather than left as `var(--chart-1)`: Recharts bakes
 * whatever string it's given straight into an SVG `fill`/`stroke` attribute. A literal
 * `var(--color-foreground)` string works fine on-screen (the SVG is embedded in the app's
 * own page, where :root defines that variable), but breaks the moment that SVG is used
 * outside this document — e.g. exported to a standalone .svg file, or drawn into an
 * offscreen <canvas> via an <img>, neither of which has this page's CSS in scope. A
 * `stroke` in that state resolves to CSS's invalid-var fallback, which for `stroke`
 * (initial value "none") makes gridlines silently invisible rather than merely
 * mis-colored. Resolving to hex here means every consumer gets a genuinely portable SVG
 * "for free," not just an on-screen-only one.
 *
 * Re-reads on two triggers:
 *  - the effective theme changing — a `data-theme` attribute mutation on <html>, which
 *    useTheme.ts is the single place that ever writes (both when the user manually
 *    toggles via ThemeToggle, AND when the OS-level prefers-color-scheme changes live and
 *    no manual override is set — see that module's own comment). Watching the attribute
 *    itself, via MutationObserver, covers both cases with one mechanism instead of two:
 *    an earlier version of this hook only listened for the matchMedia "change" event,
 *    which fires for an OS-level change but NOT for a manual toggle (that path never
 *    touches matchMedia at all, it just calls `setAttribute` directly) — charts silently
 *    kept whatever colors they'd resolved at initial render until the next print or OS
 *    theme flip, a real bug fixed here;
 *  - `beforeprint`/`afterprint`, because Recharts bakes these values into SVG `fill`
 *    attributes at render time — a `@media print` CSS override alone (tokens.css) can't
 *    retroactively change an attribute React already wrote. Re-reading right before
 *    print picks up tokens.css's print-forced light-mode values instead of whatever the
 *    on-screen theme happened to be (constitution Principle VII's PDF legibility
 *    carve-out). Print doesn't change `data-theme` itself, so this needs its own
 *    listener regardless of the MutationObserver above. */
export function useChartColors() {
  const [palette, setPalette] = useState<string[]>(() => readChartPalette());
  const [overallColor, setOverallColor] = useState(() => readColorToken("--chart-1"));
  const [cityColor, setCityColor] = useState(() => readColorToken("--chart-2"));
  const [foregroundColor, setForegroundColor] = useState(() =>
    readColorToken("--color-foreground"),
  );
  const [borderColor, setBorderColor] = useState(() => readColorToken("--color-border"));
  const [backgroundColor, setBackgroundColor] = useState(() =>
    readColorToken("--color-background"),
  );

  useEffect(() => {
    const refresh = () => {
      setPalette(readChartPalette());
      setOverallColor(readColorToken("--chart-1"));
      setCityColor(readColorToken("--chart-2"));
      setForegroundColor(readColorToken("--color-foreground"));
      setBorderColor(readColorToken("--color-border"));
      setBackgroundColor(readColorToken("--color-background"));
    };

    const themeObserver = new MutationObserver(refresh);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("beforeprint", refresh);
    window.addEventListener("afterprint", refresh); // restore on-screen colors after printing

    return () => {
      themeObserver.disconnect();
      window.removeEventListener("beforeprint", refresh);
      window.removeEventListener("afterprint", refresh);
    };
  }, []);

  return { palette, overallColor, cityColor, foregroundColor, borderColor, backgroundColor };
}
