// T040: Recharts bar chart comparing submitted firms on Overall vs. City weighted
// totals (FR-034), colored from the theme's categorical chart tokens (T017/research.md
// §10) — never invented colors, per constitution Principle VII.

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { round2 } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { getRank, cityWeightedTotal, overallWeightedTotal } from "../../lib/calculations";

export function OverallCityBarChart({ project }: { project: Project }) {
  const { overallColor, cityColor } = useChartColors();

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

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)" }}
          />
          <Legend />
          <Bar dataKey="Overall" fill={overallColor} />
          <Bar dataKey="City" fill={cityColor} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
