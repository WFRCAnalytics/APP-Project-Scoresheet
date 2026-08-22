// T041: Per-firm breakdown chart — a radar chart showing Overall Avg vs. City Avg per
// criterion for one firm (FR-034), so a viewer can see WHY a firm ranked where it did, not
// just the final number. Uses the same two metric colors as OverallCityBarChart (Overall =
// chart-1, City = chart-2) for a consistent legend meaning across the whole Dashboard.
//
// Takes a fixed `firmId` rather than owning its own firm picker — since the 003 Dashboard
// redesign, this only ever renders inside a RankedFirmsTable row's expanded detail, where
// the firm is already determined by which row is open. There is no longer a standalone
// "pick a firm from a dropdown" card on the Dashboard.

import { useRef } from "react";
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
import { cityAvg, overallAvg, round2 } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { ChartExportButtons } from "./ChartExportButtons";

export function CriterionBreakdownChart({ project, firmId }: { project: Project; firmId: string }) {
  const { overallColor, cityColor, foregroundColor, borderColor, backgroundColor } =
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
    const city = cityAvg(project, firm.id, criterion.id);
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
      City: city !== null ? round2(city) : scaleMin,
      OverallScored: overall !== null,
      CityScored: city !== null,
    };
  });

  return (
    <div>
      <div className="chart-controls-row">
        <h3 className="breakdown-chart-title">Why {firm.name} scored where it did</h3>
        <ChartExportButtons
          getSvg={() => containerRef.current?.querySelector("svg") ?? null}
          projectName={project.project.projectName}
          chartLabel={`Criterion Breakdown - ${firm.name}`}
          backgroundColor={backgroundColor}
        />
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke={borderColor} />
            <PolarAngleAxis dataKey="criterion" tick={{ fill: foregroundColor, fontSize: 12 }} />
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
              name="City"
              dataKey="City"
              stroke={cityColor}
              fill={cityColor}
              fillOpacity={0.25}
            />
            <Legend />
            {/* itemStyle/labelStyle explicitly set, not just contentStyle: Recharts
                defaults itemStyle to an inline `color: #000`, which overrides inherited
                theme color entirely regardless of what contentStyle's own background/border
                resolve to — found and fixed on ReviewerScoreSpreadChart's identical tooltip
                setup first; same omission here, same fix. */}
            <Tooltip
              contentStyle={{
                background: backgroundColor,
                border: `1px solid ${borderColor}`,
              }}
              itemStyle={{ color: foregroundColor }}
              labelStyle={{ color: foregroundColor }}
              formatter={(value, name, entry) => {
                const scoredKey = name === "Overall" ? "OverallScored" : "CityScored";
                const scored = (entry.payload as { [key: string]: unknown })[scoredKey];
                return scored ? value : "Not yet scored";
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
