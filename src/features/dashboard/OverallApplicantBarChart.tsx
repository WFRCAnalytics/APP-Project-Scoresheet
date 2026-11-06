// T040: Recharts bar chart comparing submitted firms on Overall vs. TLC Applicant vs. WFRC
// weighted totals (FR-034), colored from the theme's categorical chart tokens
// (T017/research.md §10) — never invented colors, per constitution Principle VII. TLC
// Applicant and WFRC are each "only" that reviewer type's scores (applicantWeightedTotal/
// wfrcWeightedTotal never count the other's) — Overall isn't the two of them combined, it's
// every live reviewer regardless of type.
//
// Renamed from OverallCityBarChart: "City" generalized to "TLC Applicant" so a county TLC
// applicant isn't mislabeled — see types/project.ts's ReviewerType comment for the full
// rationale. Component name kept as OverallApplicantBarChart even after the WFRC bar was
// added — still accurate (it does show Overall and TLC Applicant, among others), and a
// third rename would've meant editing this file's own imports everywhere else for a name
// that's already correctly not-wrong, just not maximally descriptive.
//
// Two exports render the same chart from two different color sources:
//  - OverallApplicantBarChart: the visible, on-screen, theme-following one (useChartColors)
//    — what the user actually looks at, dark or light per their preference.
//  - OverallApplicantBarChartPrintCopy: a second instance, permanently off-screen
//    (tokens.css's .print-chart-copy) and permanently light-colored
//    (usePrintSafeChartColors / .chart-print-safe-scope). DashboardScreen.tsx marks the
//    on-screen one `.no-print` and mounts this one alongside it specifically so the PDF
//    export (ExportPdfButton.tsx) never has to touch the visible chart's colors at all —
//    Recharts bakes colors into literal SVG attributes, so getting light colors into print
//    any other way means either mutating the live, visible chart right before capture
//    (which flashes the whole dashboard to light mode on screen, a real photosensitivity
//    concern) or racing a DOM clone against an async color update. Keeping a second,
//    never-changing instance sidesteps both.
// Both share the actual chart markup/logic (OverallApplicantBarChartView) and differ only
// in where their colors and outer wrapper come from.

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { EmptyState } from "../../components/EmptyState";
import { round2 } from "../../lib/calculations";
import { weightedTotalRange } from "../../lib/scoreScale";
import { useChartColors } from "../../theme/chartColors";
import { usePrintSafeChartColors } from "../../theme/usePrintSafeChartColors";
import type { Project } from "../../types/project";
import {
  getRank,
  applicantWeightedTotal,
  overallWeightedTotal,
  wfrcWeightedTotal,
} from "../../lib/calculations";
import { ChartTooltipContent } from "./ChartTooltip";
import { wrapAxisLabel } from "./wrapAxisLabel";

// Same x-axis label treatment as ReviewerScoreSpreadChart's scatter chart (wrapAxisLabel.ts)
// — a submitted firm's name can be just as long as a criterion's, and Recharts' own default
// (interval="preserveEnd") responds to that by silently HIDING labels it can't fit rather
// than wrapping them, which is worse: a bar with no name under it at all.
const CHART_MARGIN = { top: 8, right: 16, left: 8, bottom: 8 };
const Y_AXIS_WIDTH = 44;
const COMPACT_CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const COMPACT_Y_AXIS_WIDTH = 30;
const TICK_FONT_SIZE = 12;
const TICK_LINE_HEIGHT = 14;
const TICK_LABEL_WIDTH_SAFETY = 0.85;
// Compact mode (the Dashboard's side-column chart): past this many firms there's no room to
// print names under the bars, so the axis shows each firm's rank number instead — the same
// number as the rank badge in the ranked list right above the chart.
const COMPACT_NAME_LABEL_MAX_FIRMS = 4;

interface ChartColorProps {
  overallColor: string;
  applicantColor: string;
  wfrcColor: string;
  foregroundColor: string;
  borderColor: string;
  backgroundColor: string;
}

interface OverallApplicantBarChartViewProps extends ChartColorProps {
  project: Project;
  /** Exposes the chart's wrapping <div> to the caller, which locates the actual rendered
   * <svg> inside it for the "Download PNG/SVG" buttons living in this chart's card header
   * — this component has no per-selection state of its own (unlike CriterionBreakdownChart's
   * firm picker), so there's no reason for it to own its export buttons directly. Only the
   * on-screen instance's caller needs this; the print-only copy has no export buttons of
   * its own. */
  containerRef?: RefObject<HTMLDivElement>;
  /** Fills its parent's height (instead of the fixed 320px), drops the rotated y-axis title,
   * and switches the x-axis to rank numbers when there are many firms. */
  compact?: boolean;
  /** Emphasises one firm's bars (the rest dim) and makes bars clickable to select a firm. */
  selectedFirmId?: string | null;
  onSelectFirm?: (firmId: string) => void;
}

function OverallApplicantBarChartView({
  project,
  containerRef,
  overallColor,
  applicantColor,
  wfrcColor,
  foregroundColor,
  borderColor,
  backgroundColor,
  compact = false,
  selectedFirmId = null,
  onSelectFirm,
}: OverallApplicantBarChartViewProps) {
  // Separate from the caller-supplied containerRef (DashboardScreen reads that imperatively
  // for its own PNG/SVG export buttons) — this one exists purely to re-run the
  // ResizeObserver effect below once the chart's wrapper div actually mounts (it doesn't
  // exist yet on either EmptyState render path).
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

  const data = project.firms
    .filter((f) => f.submitted)
    .map((firm) => ({
      firmId: firm.id,
      name: firm.name,
      Overall: round2(overallWeightedTotal(project, firm.id)),
      "TLC Applicant": round2(applicantWeightedTotal(project, firm.id)),
      WFRC: round2(wfrcWeightedTotal(project, firm.id)),
      overallRank: getRank(project, firm.id, "overall"),
    }))
    .sort((a, b) => (a.overallRank ?? 0) - (b.overallRank ?? 0));

  if (data.length === 0) {
    return <EmptyState icon={BarChart3} message="No submitted firms to chart yet." />;
  }
  if (project.criteria.length === 0) {
    return <EmptyState icon={BarChart3} message="No criteria configured yet." />;
  }

  // Anchored to the max/min POSSIBLE weighted total, not the highest one actually reached
  // by a submitted firm — same reasoning as CriterionBreakdownChart's radial-axis fix.
  // Recharts' default Y-axis domain is auto-computed from the bars' own values, so a set
  // of firms that all happened to score similarly would fill the whole chart height,
  // reading as "everyone did great" even when a much higher total was achievable. A
  // weighted total's real ceiling/floor isn't the scale's raw min/max — it's the scale's
  // min/max multiplied by the sum of criteria weights (the total each criterion could
  // contribute if every reviewer gave the best/worst possible score on it).
  // (weightedTotalRange also rounds off floating-point noise in that weight sum — see there.)
  const { min: axisMin, max: axisMax } = weightedTotalRange(project);

  // The compact chart is short, and Recharts rounds its own tick choice to "nice" numbers outside
  // the domain (a 1-5 axis came out labelled 0, 2, 5). Evenly spaced ticks across the real range
  // keep the labels honest at any height.
  const compactTicks = compact
    ? Array.from({ length: 5 }, (_, i) => round2(axisMin + ((axisMax - axisMin) * i) / 4))
    : undefined;

  const plotWidth = containerWidth > 0
    ? Math.max(0, containerWidth - CHART_MARGIN.left - CHART_MARGIN.right - Y_AXIS_WIDTH)
    : 0;
  const bandWidth = plotWidth > 0 ? plotWidth / data.length : Infinity;
  const tickMaxWidth = bandWidth * TICK_LABEL_WIDTH_SAFETY;

  // Custom x-axis tick: wraps each firm name onto up to two lines (wrapAxisLabel, shared
  // with ReviewerScoreSpreadChart's x-axis and CriterionBreakdownChart's radar labels),
  // falling back to an ellipsis-truncated second line + a native SVG <title> hover tooltip
  // only when two lines still isn't enough room.
  const useRankLabels = compact && data.length > COMPACT_NAME_LABEL_MAX_FIRMS;
  const renderFirmTick = (props: { x: number; y: number; index?: number; payload: { value: string } }) => {
    const { x, y, payload } = props;
    const name = payload.value ?? "";
    if (useRankLabels) {
      const index = props.index ?? 0;
      const selected = data[index]?.firmId === selectedFirmId;
      return (
        <g transform={`translate(${x},${y})`}>
          <text
            textAnchor="middle"
            fontSize={TICK_FONT_SIZE}
            fontWeight={selected ? 700 : 400}
            fill={foregroundColor}
          >
            <title>{name}</title>
            <tspan x={0} dy={12}>
              {index + 1}
            </tspan>
          </text>
        </g>
      );
    }
    const { lines, truncated, fullText } = wrapAxisLabel(name, tickMaxWidth, TICK_FONT_SIZE);
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="middle" fontSize={TICK_FONT_SIZE} fill={foregroundColor}>
          {truncated ? <title>{fullText}</title> : null}
          {lines.map((line, i) => (
            <tspan key={i} x={0} dy={i === 0 ? 12 : TICK_LINE_HEIGHT}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div
      ref={(el) => {
        // containerRef is declared RefObject<HTMLDivElement> (a caller-owned, read-only-per-
        // its-type ref) rather than MutableRefObject — this assignment is the same thing
        // React itself does under the hood when a plain `ref={someRef}` is passed directly;
        // the cast only works around TS's stricter compile-time view of that same ref object.
        if (containerRef) (containerRef as MutableRefObject<HTMLDivElement | null>).current = el;
        setMeasureEl(el);
      }}
      style={{ width: "100%", height: compact ? "100%" : 320 }}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={compact ? COMPACT_CHART_MARGIN : CHART_MARGIN}>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
          <XAxis dataKey="name" tick={renderFirmTick} interval={0} height={compact && useRankLabels ? 26 : 44} />
          <YAxis
            domain={[axisMin, axisMax]}
            ticks={compactTicks}
            width={compact ? COMPACT_Y_AXIS_WIDTH : Y_AXIS_WIDTH}
            tick={{ fill: foregroundColor, fontSize: 12 }}
            label={
              compact
                ? undefined
                : {
                    value: "Weighted Total",
                    angle: -90,
                    position: "insideLeft",
                    fill: foregroundColor,
                    style: { textAnchor: "middle" },
                  }
            }
          />
          {/* Custom content (ChartTooltip.tsx), not contentStyle/itemStyle/labelStyle — gives
              each row a bold VALUE colored to match its own bar (Overall=orange, TLC
              Applicant=green, WFRC=blue), not just a plain-colored number next to a color
              swatch, which is all Recharts' own default tooltip layout offers even with
              itemStyle/labelStyle set (the fix an earlier pass here made, for reference —
              still correct, just superseded by owning the whole layout instead of patching
              Recharts' default one). */}
          <Tooltip
            content={(props: TooltipProps<number, string>) => (
              <ChartTooltipContent
                {...props}
                backgroundColor={backgroundColor}
                borderColor={borderColor}
                foregroundColor={foregroundColor}
              />
            )}
          />
          <Legend />
          {(
            [
              ["Overall", overallColor],
              ["TLC Applicant", applicantColor],
              ["WFRC", wfrcColor],
            ] as const
          ).map(([key, color]) => (
            <Bar
              key={key}
              dataKey={key}
              fill={color}
              cursor={onSelectFirm ? "pointer" : undefined}
              onClick={onSelectFirm ? (entry) => onSelectFirm((entry as { firmId: string }).firmId) : undefined}
            >
              {selectedFirmId
                ? data.map((d) => (
                    <Cell key={d.firmId} fillOpacity={d.firmId === selectedFirmId ? 1 : 0.5} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface OverallApplicantBarChartProps {
  project: Project;
  containerRef?: RefObject<HTMLDivElement>;
  compact?: boolean;
  selectedFirmId?: string | null;
  onSelectFirm?: (firmId: string) => void;
}

export function OverallApplicantBarChart({
  project,
  containerRef,
  compact,
  selectedFirmId,
  onSelectFirm,
}: OverallApplicantBarChartProps) {
  const colors = useChartColors();
  return (
    <OverallApplicantBarChartView
      project={project}
      containerRef={containerRef}
      compact={compact}
      selectedFirmId={selectedFirmId}
      onSelectFirm={onSelectFirm}
      {...colors}
    />
  );
}

/** The permanently off-screen, permanently light-colored copy the PDF export actually
 * captures — see this file's header comment. `.chart-print-safe-scope` (tokens.css) is what
 * makes usePrintSafeChartColors resolve to light values regardless of the on-screen theme;
 * `.print-chart-copy` (tokens.css) is what keeps it off-screen normally and swaps it into
 * normal, visible flow only inside an actual print render. `aria-hidden` because it's a
 * pure duplicate of content already reachable on screen — screen readers should never land
 * on it. */
export function OverallApplicantBarChartPrintCopy({ project }: { project: Project }) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const colors = usePrintSafeChartColors(scopeRef);
  return (
    <div ref={scopeRef} className="chart-print-safe-scope print-chart-copy" aria-hidden="true">
      <OverallApplicantBarChartView project={project} {...colors} />
    </div>
  );
}
