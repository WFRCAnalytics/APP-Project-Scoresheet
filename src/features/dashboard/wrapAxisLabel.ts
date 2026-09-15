// Wraps a criterion name onto at most two lines for ReviewerScoreSpreadChart's x-axis (and
// anywhere else a categorical axis label needs this same treatment): fits it on one line if
// it already fits, wraps onto a second line if it doesn't, and — only if it still doesn't
// fit in two — truncates the second line with an ellipsis. Pure and unit-tested on its own
// (tests/unit/wrapAxisLabel.test.ts) since the chart itself can't be measured in jsdom (see
// reviewer-score-spread-chart.test.tsx's header comment).

import { estimateTextWidth } from "../../lib/textMeasure";

export interface WrappedLabel {
  /** One or two lines to render as stacked <tspan>s. */
  lines: string[];
  /** True when the second line had to be shortened to fit — callers should surface
   * `fullText` on hover (e.g. a native SVG <title>) whenever this is true. */
  truncated: boolean;
  fullText: string;
}

const ELLIPSIS = "…";

function truncateToWidth(text: string, maxWidthPx: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidthPx) return text;
  let end = text.length;
  while (end > 0 && estimateTextWidth(text.slice(0, end) + ELLIPSIS, fontSize) > maxWidthPx) {
    end--;
  }
  return end > 0 ? `${text.slice(0, end).trimEnd()}${ELLIPSIS}` : ELLIPSIS;
}

export function wrapAxisLabel(text: string, maxWidthPx: number, fontSize: number): WrappedLabel {
  const fits = (s: string) => estimateTextWidth(s, fontSize) <= maxWidthPx;
  if (fits(text)) return { lines: [text], truncated: false, fullText: text };

  const words = text.split(" ");
  let line1 = "";
  let consumed = 0;
  for (; consumed < words.length; consumed++) {
    const candidate = line1 ? `${line1} ${words[consumed]}` : words[consumed];
    if (!fits(candidate)) break;
    line1 = candidate;
  }

  // Even the first word alone overflows the band — hard-truncate it as a single line
  // rather than emitting a blank first line above a truncated second one.
  if (consumed === 0) {
    return { lines: [truncateToWidth(words[0], maxWidthPx, fontSize)], truncated: true, fullText: text };
  }

  const remaining = words.slice(consumed).join(" ");
  if (fits(remaining)) return { lines: [line1, remaining], truncated: false, fullText: text };

  return { lines: [line1, truncateToWidth(remaining, maxWidthPx, fontSize)], truncated: true, fullText: text };
}
