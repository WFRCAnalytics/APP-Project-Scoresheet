// T040: Recharts bar chart comparing submitted firms on Overall vs. City weighted
// totals (FR-034), colored from the theme's categorical chart tokens (T017/research.md
// §10) — never invented colors, per constitution Principle VII.

import type { RefObject } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { round2 } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { getRank, cityWeightedTotal, overallWeightedTotal } from "../../lib/calculations";

export interface OverallCityBarChartProps {
  project: Project;
  /** Exposes the chart's wrapping <div> to the caller (DashboardScreen), which locates the
   * actual rendered <svg> inside it for the "Download PNG/SVG" buttons living in this
   * chart's card header — this component has no per-selection state of its own (unlike
   * CriterionBreakdownChart's firm picker), so there's no reason for it to own its export
   * buttons directly. */
  containerRef?: RefObject<HTMLDivElement>;
}

export function OverallCityBarChart({ project, containerRef }: OverallCityBarChartProps) {
  const { overallColor, cityColor, foregroundColor, borderColor, backgroundColor } =
    useChartColors();

  const data = project.firms
    .filter((f) => f.submitted)
    .map((firm) => ({
      name: firm.name,
      Overall: round2(overallWeightedTotal(project, firm.id)),
      City: round2(cityWeightedTotal(project, firm.id)),
      overallRank: getRank(project, firm.id, "overall"),
    }))
    .sort((a, b) => (a.overallRank ?? 0) - (b.overallRank ?? 0));

  if (data.length === 0) {
    return <p className="field-hint">No submitted firms to chart yet.</p>;
  }
  if (project.criteria.length === 0) {
    return <p className="field-hint">No criteria configured yet.</p>;
  }

  // Anchored to the max/min POSSIBLE weighted total, not the highest one actually reached
  // by a submitted firm — same reasoning as CriterionBreakdownChart's radial-axis fix.
  // Recharts' default Y-axis domain is auto-computed from the bars' own values, so a set
  // of firms that all happened to score similarly would fill the whole chart height,
  // reading as "everyone did great" even when a much higher total was achievable. A
  // weighted total's real ceiling/floor isn't the scale's raw min/max — it's the scale's
  // min/max multiplied by the sum of criteria weights (the total each criterion could
  // contribute if every reviewer gave the best/worst possible score on it).
  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = scaleValues.length > 0 ? Math.min(...scaleValues) : 0;
  const scaleMax = scaleValues.length > 0 ? Math.max(...scaleValues) : 0;
  const totalWeight = project.criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div ref={containerRef} style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
          <XAxis dataKey="name" tick={{ fill: foregroundColor, fontSize: 12 }} />
          <YAxis
            domain={[scaleMin * totalWeight, scaleMax * totalWeight]}
            tick={{ fill: foregroundColor, fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: backgroundColor, border: `1px solid ${borderColor}` }}
          />
          <Legend />
          <Bar dataKey="Overall" fill={overallColor} />
          <Bar dataKey="City" fill={cityColor} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
