// A plain style-object helper, split out of ChartTooltip.tsx into its own module purely so
// that file can stay 100% React components (ESLint's react-refresh/only-export-components
// otherwise warns whenever a non-component export shares a file with component exports —
// same reasoning already applied elsewhere in this codebase).

import type { CSSProperties } from "react";

/** The tooltip "card" chrome — background/border/shadow/radius — shared by every Dashboard
 * chart's tooltip: ChartTooltipContent's generic multi-series layout (CriterionBreakdownChart,
 * OverallApplicantBarChart) and ReviewerScoreSpreadChart's own bespoke single-point content
 * (its data shape doesn't fit the generic payload-array model, but it should still look like
 * the same tooltip family). */
export function tooltipCardStyle(backgroundColor: string, borderColor: string): CSSProperties {
  return {
    background: backgroundColor,
    border: `1px solid ${borderColor}`,
    borderRadius: 8,
    padding: "8px 12px",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
    minWidth: 150,
  };
}
