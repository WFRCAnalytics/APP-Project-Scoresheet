// 004 post-launch improvements, item 2: a strip plot showing each reviewer's individual raw
// score, per criterion, for one firm — pure presentation of project.scores values already
// computed nowhere new. Sits ALONGSIDE CriterionBreakdownChart's radar (not replacing it) in
// the expanded row: the radar shows averages ("what shape is this firm's performance"), this
// shows the raw votes behind those averages ("did reviewers actually agree, or is that
// average hiding a 1-and-a-5") — a real gap flagged in the post-launch review, since nothing
// on the Dashboard previously surfaced reviewer disagreement at all.
//
// Data-shaping (which live scores exist, and the jitter layout) lives in
// reviewerScoreSpread.ts, not here and not calculations.ts — same split rankedRows.ts
// already uses. No calculations.ts changes and no statistical summary (mean/stddev/
// variance) anywhere — explicit non-goals for this item.
//
// Color convention: reuses the exact same two hex values (wfrcColor/applicantColor) the
// radar and bar charts already use for "WFRC"/"TLC Applicant", rather than picking two new
// colors from the RTP/Wasatch palette (constitution Principle VII) — a dot here is one
// specific reviewer's score, and that reviewer is one specific type, so coloring it by the
// same token that type's own averaged series uses elsewhere is a direct, literal match, not
// just a thematically-similar reuse. The legend text says "TLC Applicant reviewers" / "WFRC
// reviewers" specifically (not "Overall"/"TLC Applicant") so it never reads as if it means
// the same thing as the radar's legend one component up.
//
// Readability pass (found by manual review of a real screenshot, not a data bug): the
// original version had no Y-axis label, and CartesianGrid's default vertical lines land at
// each criterion's CENTER (the tick position, x = 0, 1, 2, ...) — exactly where the jittered
// dots cluster — rather than at the BOUNDARY between one criterion's group and the next
// (x = 0.5, 1.5, ...). That drew a distracting line straight through the middle of each
// cluster while providing no actual fence around it. Fixed by removing the vertical grid
// lines entirely and shading alternating criterion lanes instead (ReferenceArea bands, same
// "zebra" convention app.css's own table striping already uses) — a filled region reads
// unambiguously as "these points belong together" regardless of how wide the jitter is,
// which a thin line at the wrong position never did.
//
// Tooltip pass (two bugs found from a real screenshot, confirmed by inspecting the actual
// rendered DOM rather than guessing at Recharts internals):
//  1. Dark-mode illegible text: Recharts' <Tooltip> bakes `color: #000` as an INLINE style
//     on every .recharts-tooltip-item by default when no `itemStyle` prop is given — an
//     inline style beats CSS inheritance, so the item text stayed black even though the
//     tooltip's own background (contentStyle.background) was already correctly theme-aware.
//     Same root-cause family as the earlier chart-color bugs (a Recharts default that has no
//     idea this app has a dark mode), just surfacing on a different prop (itemStyle, not
//     stroke/fill). Fixed by passing itemStyle/labelStyle explicitly, same as contentStyle
//     already was.
//  2. Duplicate row: NOT caused by the two-series-per-reviewer-type setup (confirmed by
//     collapsing to a single <Scatter> — the duplicate persisted) and NOT caused by <ZAxis>
//     (confirmed by removing it entirely — still persisted). The real cause: this chart's
//     point has no dedicated "value" dataKey of its own — <XAxis dataKey="x"> and
//     <YAxis dataKey="y"> are each an axis-bound dataKey on the SAME Scatter point, and
//     Recharts' default tooltip renders one item per axis dataKey it finds (normally that's
//     the intended behavior — "x : 5" / "y : 3" as two genuinely different lines). This
//     formatter ignores which axis triggered it and recomputes the same full string from
//     entry.payload both times, so both invocations rendered bit-identical text — confirmed
//     by reading the tooltip's actual DOM (two .recharts-tooltip-item nodes, same content).
//     Fixed by replacing formatter/labelFormatter/itemSorter with a fully custom `content`
//     renderer that reads payload[0] directly and renders exactly one line, bypassing
//     Recharts' per-axis-dataKey item iteration entirely rather than trying to out-clever it.

import { useRef } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { ChartExportButtons } from "./ChartExportButtons";
import { buildSpreadPoints, type SpreadPoint } from "./reviewerScoreSpread";

export function ReviewerScoreSpreadChart({ project, firmId }: { project: Project; firmId: string }) {
  const { applicantColor, wfrcColor, foregroundColor, borderColor, backgroundColor } =
    useChartColors();
  const containerRef = useRef<HTMLDivElement>(null);
  const firm = project.firms.find((f) => f.id === firmId);

  if (!firm) return null; // orphaned reference — nothing sensible to render
  if (project.criteria.length === 0) {
    return <p className="field-hint">No criteria configured yet.</p>;
  }
  if (project.scoringScale.length === 0) {
    return <p className="field-hint">No scoring scale configured yet.</p>;
  }

  // Same anchoring rule as CriterionBreakdownChart/the Calculations heatmap: the axis spans
  // the project's CONFIGURED scale, not whatever range of scores happens to be present, so
  // one firm's spread is visually comparable to another's rather than each auto-zooming to
  // its own observed min/max.
  const sortedScaleValues = [...project.scoringScale].map((p) => p.value).sort((a, b) => a - b);
  const scaleMin = sortedScaleValues[0] ?? 0;
  const scaleMax = sortedScaleValues[sortedScaleValues.length - 1] ?? 0;

  const points = buildSpreadPoints(project, firmId);
  const criterionNames = project.criteria.map((c) => c.name);

  // Explicit legend content — with only one <Scatter> series now (see this file's header
  // comment for why), Recharts' auto-legend would show one generic entry instead of the two
  // color-coded ones a viewer actually needs.
  const legendPayload = [
    { value: "TLC Applicant reviewers", type: "circle" as const, color: applicantColor },
    { value: "WFRC reviewers", type: "circle" as const, color: wfrcColor },
  ];

  // Custom content, not formatter/labelFormatter — see this file's header comment on bug #2.
  // Reads payload[0] directly (the single hovered point) instead of letting Recharts iterate
  // one item per axis dataKey (x, y), which is what produced the duplicate row.
  const renderTooltipContent = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload as SpreadPoint | undefined;
    if (!point) return null;
    const typeLabel = point.reviewerType === "wfrc" ? "WFRC" : "TLC Applicant";
    return (
      <div
        style={{
          background: backgroundColor,
          border: `1px solid ${borderColor}`,
          color: foregroundColor,
          padding: "6px 10px",
          fontSize: 13,
        }}
      >
        {point.reviewerName} ({typeLabel}) — {point.criterionName} : {point.y}
      </div>
    );
  };

  return (
    <div>
      <div className="chart-controls-row">
        <h3 className="breakdown-chart-title">How {firm.name}&rsquo;s reviewers scored, by criterion</h3>
        <ChartExportButtons
          getSvg={() => containerRef.current?.querySelector("svg") ?? null}
          projectName={project.project.projectName}
          chartLabel={`Reviewer Score Spread - ${firm.name}`}
          backgroundColor={backgroundColor}
        />
      </div>
      {points.length === 0 ? (
        <p className="field-hint">No reviewer scores recorded for this firm yet.</p>
      ) : (
        <div ref={containerRef} style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              {/* Alternating lane shading — the actual group-boundary fix. Every OTHER
                  criterion (odd index) gets a subtle tint spanning the full value range, so
                  the boundary between groups is a filled edge, not a line a viewer has to
                  interpolate. Reuses --color-foreground at a low fillOpacity (same idea as
                  app.css's table zebra striping) rather than color-mix() with var() — this
                  chart is also exportable as a standalone PNG/SVG (ChartExportButtons
                  above), and a raw CSS variable reference would break outside this page's
                  own stylesheet scope, the same reason theme/chartColors.ts resolves every
                  other color here to a literal value instead of a var() string. */}
              {criterionNames.map((_, i) =>
                i % 2 === 1 ? (
                  <ReferenceArea
                    key={i}
                    x1={i - 0.5}
                    x2={i + 0.5}
                    y1={scaleMin}
                    y2={scaleMax}
                    fill={foregroundColor}
                    fillOpacity={0.05}
                    stroke="none"
                    ifOverflow="visible"
                  />
                ) : null,
              )}
              {/* Horizontal-only: vertical lines are handled by the lane shading above
                  instead (see this file's header comment for why the default vertical grid
                  was actively misleading here, not just redundant). */}
              <CartesianGrid horizontal vertical={false} stroke={borderColor} />
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, criterionNames.length - 0.5]}
                ticks={criterionNames.map((_, i) => i)}
                tickFormatter={(i: number) => criterionNames[i] ?? ""}
                tick={{ fill: foregroundColor, fontSize: 12 }}
                interval={0}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[scaleMin, scaleMax]}
                tick={{ fill: foregroundColor, fontSize: 12 }}
                label={{
                  value: "Score",
                  angle: -90,
                  position: "insideLeft",
                  fill: foregroundColor,
                  style: { textAnchor: "middle" },
                }}
              />
              <ZAxis type="number" range={[80, 80]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={renderTooltipContent} />
              {/* Explicit height/icon size so the legend can't end up squeezed illegibly
                  small — this is the ONLY place on screen naming what each dot color means
                  (TLC Applicant vs. WFRC), so it has to actually register, not just
                  technically render. payload is explicit (see const above) since there's now
                  only one underlying <Scatter> series for Recharts to auto-derive a legend
                  from. */}
              <Legend
                verticalAlign="bottom"
                height={32}
                iconSize={12}
                wrapperStyle={{ fontSize: 13 }}
                payload={legendPayload}
              />
              {/* ONE series, not two — this is what makes the tooltip show exactly one row
                  per hover instead of one per series (see header comment). Cell gives each
                  point its own color by reviewer type without needing a second series. */}
              <Scatter data={points}>
                {points.map((p, i) => (
                  <Cell key={i} fill={p.reviewerType === "wfrc" ? wfrcColor : applicantColor} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
