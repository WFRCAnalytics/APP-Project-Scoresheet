// T041: Per-firm breakdown chart — a radar chart showing Overall/TLC Applicant/WFRC Avg per
// criterion for one firm (FR-034), so a viewer can see WHY a firm ranked where it did, not
// just the final number. Uses the same three metric colors as OverallApplicantBarChart
// (Overall = chart-3/rtp-mustard (orange), TLC Applicant = chart-2/rtp-green, WFRC =
// chart-1/rtp-blue — WFRC gets the blue slot since that's WFRC's own brand color) for a
// consistent legend meaning across the whole Dashboard. TLC Applicant and WFRC are each
// "only" that reviewer type (applicantAvg/wfrcAvg never count the other's scores); Overall
// is every live reviewer regardless of type, so it's not simply the other two averaged
// together.
//
// Takes a fixed `firmId` rather than owning its own firm picker — since the 003 Dashboard
// redesign, this only ever renders inside a RankedFirmsTable row's expanded detail, where
// the firm is already determined by which row is open. There is no longer a standalone
// "pick a firm from a dropdown" card on the Dashboard.

import { useEffect, useRef, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";
import { applicantAvg, overallAvg, wfrcAvg, round2 } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { ChartExportButtons } from "./ChartExportButtons";
import { ChartTooltipContent } from "./ChartTooltip";
import { wrapAxisLabel } from "./wrapAxisLabel";

// Layout constants the custom angle-axis tick (below) needs to reconstruct the label
// circle's real pixel radius, since Recharts doesn't hand a custom tick its own cx/cy/radius
// directly — these have to match the real <RadarChart>/<PolarAngleAxis> props they describe.
const RADAR_HEIGHT = 280; // matches the container div's fixed height below
const RADAR_MARGIN = 5; // RadarChart's own default margin on every side
const RADAR_OUTER_RADIUS_FRACTION = 0.7; // matches outerRadius="70%" on <RadarChart> below
const POLAR_TICK_SIZE = 8; // PolarAngleAxis's default tickSize — label distance past the polygon
const TICK_FONT_SIZE = 12;
const TICK_LINE_HEIGHT = 14;
// Same "leave a gap so wrapped lines never quite touch" margin the scatter chart's x-axis
// tick uses (wrapAxisLabel.ts's caller in ReviewerScoreSpreadChart.tsx).
const TICK_LABEL_WIDTH_SAFETY = 0.85;
// Classifies a label as sitting clearly above center, clearly below, or near the equator
// (left/right) — determines which way a wrapped 2-line label should stack around its anchor
// point so it never grows back into the polygon it's labeling.
const VERTICAL_SIN_THRESHOLD = 0.3;

/** Relative <tspan> dy offsets (first is relative to the tick's own anchor point, the rest
 * relative to the previous line) that stack a 1- or 2-line label around its anchor without
 * growing back toward the chart: upward for a label above center, downward for one below,
 * and centered on the anchor for one near the equator (left/right). */
function verticalDyOffsets(lineCount: number, position: "above" | "below" | "equator"): number[] {
  if (position === "above") return lineCount === 1 ? [0] : [-TICK_LINE_HEIGHT, TICK_LINE_HEIGHT];
  if (position === "below") return lineCount === 1 ? [12] : [12, TICK_LINE_HEIGHT];
  return lineCount === 1 ? [4] : [-3, TICK_LINE_HEIGHT];
}

export function CriterionBreakdownChart({ project, firmId }: { project: Project; firmId: string }) {
  const { overallColor, applicantColor, wfrcColor, foregroundColor, borderColor, backgroundColor } =
    useChartColors();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Separate from containerRef (which ChartExportButtons reads imperatively on click) — this
  // one exists purely to re-run the ResizeObserver effect below once the chart's wrapper div
  // actually mounts (it doesn't exist yet on the "no data" render path).
  const [measureEl, setMeasureEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!measureEl) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(measureEl);
    return () => observer.disconnect();
  }, [measureEl]);

  const firm = project.firms.find((f) => f.id === firmId);

  if (!firm) return null; // orphaned reference — nothing sensible to render
  if (project.criteria.length === 0) {
    return <p className="field-hint">No criteria configured yet.</p>;
  }
  if (project.scoringScale.length === 0) {
    return <p className="field-hint">No scoring scale configured yet.</p>;
  }

  // Anchored to the project's CONFIGURED scoring scale range, not the highest value
  // actually present in this firm's scores — Recharts' default radial-axis domain is
  // auto-computed from the data, which makes the chart's outer ring represent whatever the
  // best score happened to be rather than the true best-POSSIBLE score. That silently
  // exaggerates differences (a firm scoring 3s and 4s would fill the whole chart, reading
  // as "excellent across the board" when 5 was actually possible) and makes charts for
  // different firms/criteria not comparable to each other. Same anchoring rule the
  // Calculations heatmap uses (theme/heatmapColor.ts) for the same reason.
  const sortedScaleValues = [...project.scoringScale].map((p) => p.value).sort((a, b) => a - b);
  const scaleMin = sortedScaleValues[0] ?? 0;
  const scaleMax = sortedScaleValues[sortedScaleValues.length - 1] ?? 0;

  const data = project.criteria.map((criterion) => {
    const overall = overallAvg(project, firm.id, criterion.id);
    const applicant = applicantAvg(project, firm.id, criterion.id);
    const wfrc = wfrcAvg(project, firm.id, criterion.id);
    return {
      criterion: criterion.name,
      // A not-yet-scored criterion is plotted at the scale FLOOR, not 0 — with the domain
      // now anchored to [scaleMin, scaleMax], a literal 0 would fall outside that domain
      // whenever the configured scale doesn't start at 0 (e.g. a 1-5 scale), which Recharts
      // would otherwise clip or render incorrectly. This still can't visually distinguish
      // "not yet scored" from "scored at the worst possible value" on the chart itself — a
      // real limitation of radar charts having no native "gap" — so the tooltip formatter
      // below discloses the true state on hover rather than silently misrepresenting it as
      // an earned score (FR-026: absence means not yet scored, never zero).
      Overall: overall !== null ? round2(overall) : scaleMin,
      "TLC Applicant": applicant !== null ? round2(applicant) : scaleMin,
      WFRC: wfrc !== null ? round2(wfrc) : scaleMin,
      OverallScored: overall !== null,
      ApplicantScored: applicant !== null,
      WfrcScored: wfrc !== null,
    };
  });

  // labelRadius mirrors what Recharts computes internally for outerRadius="70%" + the
  // default tickSize=8 — there's no live measurement of a not-yet-rendered tick's position,
  // so this has to be reconstructed from the same inputs Recharts itself uses.
  const labelRadius = containerWidth > 0
    ? (Math.max(0, Math.min(containerWidth, RADAR_HEIGHT) / 2 - RADAR_MARGIN) * RADAR_OUTER_RADIUS_FRACTION) +
      POLAR_TICK_SIZE
    : 0;
  const angleStepRad = project.criteria.length > 0 ? (2 * Math.PI) / project.criteria.length : 0;
  // The straight-line distance between two adjacent labels' anchor points — used as EVERY
  // label's width budget, regardless of where it sits on the circle. Left/right labels sit
  // right next to a lot of unused space out to the chart's edge, but capping them to the same
  // budget top/bottom labels get keeps the whole ring reading as one consistent, evenly
  // wrapped set instead of a few disproportionately long lines next to a bunch of short ones.
  const neighborMaxWidth = labelRadius * 2 * Math.sin(angleStepRad / 2) * TICK_LABEL_WIDTH_SAFETY;

  // Custom angle-axis tick: wraps each criterion name onto up to two lines (wrapAxisLabel,
  // shared with ReviewerScoreSpreadChart's x-axis), truncating with an ellipsis + a native
  // SVG <title> hover tooltip only when two lines still isn't enough room.
  const renderCriterionTick = (props: {
    x: number;
    y: number;
    textAnchor: "start" | "end" | "middle";
    payload: { value: string; coordinate: number };
  }) => {
    const { x, y, textAnchor, payload } = props;
    const name = payload.value ?? "";
    if (containerWidth <= 0) {
      // Not measured yet — render unwrapped for this one frame rather than wrapping against
      // a bogus zero-width budget.
      return (
        <text x={x} y={y} textAnchor={textAnchor} fontSize={TICK_FONT_SIZE} fill={foregroundColor}>
          {name}
        </text>
      );
    }
    const angleRad = (payload.coordinate * Math.PI) / 180;
    const sinA = Math.sin(angleRad);
    const { lines, truncated, fullText } = wrapAxisLabel(name, neighborMaxWidth, TICK_FONT_SIZE);
    const position = sinA > VERTICAL_SIN_THRESHOLD ? "above" : sinA < -VERTICAL_SIN_THRESHOLD ? "below" : "equator";
    const dys = verticalDyOffsets(lines.length, position);
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor={textAnchor} fontSize={TICK_FONT_SIZE} fill={foregroundColor}>
          {truncated ? <title>{fullText}</title> : null}
          {lines.map((line, i) => (
            <tspan key={i} x={0} dy={dys[i]}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div>
      <div className="chart-controls-row">
        <h3 className="breakdown-chart-title">Why {firm.name} scored where it did</h3>
        <ChartExportButtons
          getSvg={() => containerRef.current?.querySelector("svg") ?? null}
          projectName={project.project.projectName}
          chartLabel={`Criterion Breakdown - ${firm.name}`}
          backgroundColor={backgroundColor}
          foregroundColor={foregroundColor}
          legendItems={[
            { label: "Overall", color: overallColor },
            { label: "TLC Applicant", color: applicantColor },
            { label: "WFRC", color: wfrcColor },
          ]}
        />
      </div>
      <div
        ref={(el) => {
          containerRef.current = el;
          setMeasureEl(el);
        }}
        style={{ width: "100%", height: RADAR_HEIGHT }}
      >
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke={borderColor} />
            <PolarAngleAxis dataKey="criterion" tick={renderCriterionTick} />
            <PolarRadiusAxis
              domain={[scaleMin, scaleMax]}
              tickCount={sortedScaleValues.length}
              tick={{ fill: foregroundColor, fontSize: 10 }}
            />
            <Radar
              name="Overall"
              dataKey="Overall"
              stroke={overallColor}
              fill={overallColor}
              fillOpacity={0.35}
            />
            <Radar
              name="TLC Applicant"
              dataKey="TLC Applicant"
              stroke={applicantColor}
              fill={applicantColor}
              fillOpacity={0.25}
            />
            <Radar
              name="WFRC"
              dataKey="WFRC"
              stroke={wfrcColor}
              fill={wfrcColor}
              fillOpacity={0.2}
            />
            <Legend />
            {/* Custom content (ChartTooltip.tsx), not contentStyle/itemStyle/labelStyle/
                formatter — gives each row a bold VALUE colored to match its own radar area
                (Overall=orange, TLC Applicant=green, WFRC=blue), and renders "Not yet
                scored" in italic rather than as plain text indistinguishable from a real
                number (the earlier `formatter` prop swapped the text but not the styling —
                still correct in substance, just superseded by owning the whole row's
                layout via `formatEntry` here instead of only its text). */}
            <Tooltip
              content={(props: TooltipProps<number, string>) => (
                <ChartTooltipContent
                  {...props}
                  backgroundColor={backgroundColor}
                  borderColor={borderColor}
                  foregroundColor={foregroundColor}
                  formatEntry={(entry) => {
                    const scoredKey =
                      entry.name === "Overall"
                        ? "OverallScored"
                        : entry.name === "TLC Applicant"
                          ? "ApplicantScored"
                          : "WfrcScored";
                    const scored = (entry.payload as { [key: string]: unknown })[scoredKey];
                    return scored ? { text: entry.value } : { text: "Not yet scored", italic: true };
                  }}
                />
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
