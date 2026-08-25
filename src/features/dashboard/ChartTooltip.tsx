// Shared hover-tooltip presentation for every Recharts chart on the Dashboard (post-launch
// polish item). Recharts' own default tooltip is flat — every line the same size/weight,
// and while it does draw a small color swatch next to each series, the VALUE text itself
// stays plain foreground-colored regardless of which series it belongs to. Replacing it
// with a custom `content` renderer gets: a bold header line, a colored swatch AND a bold
// VALUE in that series' own color per row (so "3.8" reads as visibly the Overall/orange
// number, not just a number next to an orange dot), and an italic treatment for the
// "not yet scored" case that already existed as plain text.
//
// Colors are read directly off each payload entry's own `.color` (whatever that series'
// stroke/fill was set to — Recharts always includes it), not re-derived from the series
// name here — the metric->color mapping (WFRC=blue, Overall=orange, TLC Applicant=green)
// already lives in exactly one place, theme/chartColors.ts's useChartColors(), and every
// chart already passes that same color to the Radar/Bar/Cell element itself; reading it
// back off the payload keeps this component from needing its own second copy of that
// mapping, which could silently drift from the real one.

import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";
import { tooltipCardStyle } from "./chartTooltipStyle";

export function TooltipHeading({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 700,
        fontSize: 13,
        marginBottom: 4,
        paddingBottom: 4,
        borderBottom: `1px solid ${color}20`,
        color,
      }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({
  swatchColor,
  label,
  labelColor,
  value,
  valueColor,
  italic = false,
}: {
  swatchColor: string;
  label: ReactNode;
  labelColor: string;
  value: ReactNode;
  valueColor: string;
  italic?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        fontSize: 12,
        padding: "2px 0",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: labelColor }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: swatchColor,
            flex: "none",
          }}
        />
        {label}
      </span>
      <strong
        style={{
          color: italic ? labelColor : valueColor,
          fontWeight: italic ? 500 : 700,
          fontStyle: italic ? "italic" : "normal",
          opacity: italic ? 0.75 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

type Entry = NonNullable<TooltipProps<number, string>["payload"]>[number];

/** Generic multi-series tooltip content — one row per hovered series (Overall/TLC
 * Applicant/WFRC), each colored to match its own line/bar/radar area. Used by
 * CriterionBreakdownChart (radar) and OverallApplicantBarChart (bar); ReviewerScoreSpreadChart
 * has its own single-point content function instead (see that file — its payload shape,
 * one hovered dot rather than one row per series, doesn't fit this model), styled to match
 * via the shared tooltipCardStyle/TooltipHeading/TooltipRow pieces above. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  backgroundColor,
  borderColor,
  foregroundColor,
  formatEntry,
}: TooltipProps<number, string> & {
  backgroundColor: string;
  borderColor: string;
  foregroundColor: string;
  /** Overrides an entry's displayed value/style — used by CriterionBreakdownChart to swap
   * in an italic "Not yet scored" in place of the plotted scale-floor placeholder value. */
  formatEntry?: (entry: Entry) => { text: ReactNode; italic?: boolean };
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipCardStyle(backgroundColor, borderColor)}>
      {label !== undefined && <TooltipHeading color={foregroundColor}>{label}</TooltipHeading>}
      {payload.map((entry) => {
        const color = entry.color ?? foregroundColor;
        const { text, italic } = formatEntry?.(entry) ?? { text: entry.value, italic: false };
        return (
          <TooltipRow
            key={String(entry.dataKey ?? entry.name)}
            swatchColor={color}
            label={String(entry.name)}
            labelColor={foregroundColor}
            value={text}
            valueColor={color}
            italic={italic}
          />
        );
      })}
    </div>
  );
}
