// T041: Per-firm breakdown chart — a radar chart showing Overall Avg vs. City Avg per
// criterion for one selected firm (FR-034), so a viewer can see WHY a firm ranked where
// it did, not just the final number. Uses the same two metric colors as
// OverallCityBarChart (Overall = chart-1, City = chart-2) for a consistent legend
// meaning across the whole Dashboard.

import { useState } from "react";
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

export function CriterionBreakdownChart({ project }: { project: Project }) {
  const { overallColor, cityColor } = useChartColors();
  const submittedFirms = project.firms.filter((f) => f.submitted);
  const [selectedFirmId, setSelectedFirmId] = useState(submittedFirms[0]?.id ?? "");

  if (submittedFirms.length === 0) {
    return <p className="field-hint">No submitted firms to chart yet.</p>;
  }
  if (project.criteria.length === 0) {
    return <p className="field-hint">No criteria configured yet.</p>;
  }

  const selectedFirm = submittedFirms.find((f) => f.id === selectedFirmId) ?? submittedFirms[0];

  const data = project.criteria.map((criterion) => {
    const overall = overallAvg(project, selectedFirm.id, criterion.id);
    const city = cityAvg(project, selectedFirm.id, criterion.id);
    return {
      criterion: criterion.name,
      Overall: overall !== null ? round2(overall) : 0,
      City: city !== null ? round2(city) : 0,
    };
  });

  return (
    <div>
      <div className="field" style={{ maxWidth: "20rem" }}>
        <label htmlFor="breakdown-firm-select">Firm</label>
        <select
          id="breakdown-firm-select"
          value={selectedFirm.id}
          onChange={(e) => setSelectedFirmId(e.target.value)}
        >
          {submittedFirms.map((firm) => (
            <option key={firm.id} value={firm.id}>
              {firm.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="criterion" tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: "var(--color-foreground)", fontSize: 10 }} />
            <Radar name="Overall" dataKey="Overall" stroke={overallColor} fill={overallColor} fillOpacity={0.35} />
            <Radar name="City" dataKey="City" stroke={cityColor} fill={cityColor} fillOpacity={0.25} />
            <Legend />
            <Tooltip
              contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
