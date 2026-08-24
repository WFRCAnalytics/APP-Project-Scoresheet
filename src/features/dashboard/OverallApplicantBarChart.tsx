// T040: Recharts bar chart comparing submitted firms on Overall vs. TLC Applicant weighted
// totals (FR-034), colored from the theme's categorical chart tokens (T017/research.md
// §10) — never invented colors, per constitution Principle VII.
//
// Renamed from OverallCityBarChart: "City" generalized to "TLC Applicant" so a county TLC
// applicant isn't mislabeled — see types/project.ts's ReviewerType comment for the full
// rationale.

import type { RefObject } from "react";
import { BarChart3 } from "lucide-react";
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
import { EmptyState } from "../../components/EmptyState";
import { round2 } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { getRank, applicantWeightedTotal, overallWeightedTotal } from "../../lib/calculations";

export interface OverallApplicantBarChartProps {
  project: Project;
  /** Exposes the chart's wrapping <div> to the caller (DashboardScreen), which locates the
   * actual rendered <svg> inside it for the "Download PNG/SVG" buttons living in this
   * chart's card header — this component has no per-selection state of its own (unlike
   * CriterionBreakdownChart's firm picker), so there's no reason for it to own its export
   * buttons directly. */
  containerRef?: RefObject<HTMLDivElement>;
}

export function OverallApplicantBarChart({ project, containerRef }: OverallApplicantBarChartProps) {
  const { overallColor, applicantColor, foregroundColor, borderColor, backgroundColor } =
    useChartColors();

  const data = project.firms
    .filter((f) => f.submitted)
    .map((firm) => ({
      name: firm.name,
      Overall: round2(overallWeightedTotal(project, firm.id)),
      "TLC Applicant": round2(applicantWeightedTotal(project, firm.id)),
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
  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = scaleValues.length > 0 ? Math.min(...scaleValues) : 0;
  const scaleMax = scaleValues.length > 0 ? Math.max(...scaleValues) : 0;
  const totalWeight = project.criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div ref={containerRef} style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
          <XAxis dataKey="name" tick={{ fill: foregroundColor, fontSize: 12 }} />
          <YAxis
            domain={[scaleMin * totalWeight, scaleMax * totalWeight]}
            tick={{ fill: foregroundColor, fontSize: 12 }}
            label={{
              value: "Weighted Total",
              angle: -90,
              position: "insideLeft",
              fill: foregroundColor,
              style: { textAnchor: "middle" },
            }}
          />
          {/* itemStyle/labelStyle explicitly set, not just contentStyle: Recharts defaults
              itemStyle to an inline `color: #000`, which overrides inherited theme color
              entirely regardless of what contentStyle's own background/border resolve to —
              found and fixed on ReviewerScoreSpreadChart's identical tooltip setup first;
              same omission here, same fix. */}
          <Tooltip
            contentStyle={{ background: backgroundColor, border: `1px solid ${borderColor}` }}
            itemStyle={{ color: foregroundColor }}
            labelStyle={{ color: foregroundColor }}
          />
          <Legend />
          <Bar dataKey="Overall" fill={overallColor} />
          <Bar dataKey="TLC Applicant" fill={applicantColor} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
