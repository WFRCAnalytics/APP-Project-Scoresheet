// Rows = criteria, columns = reviewers, one firm at a time — the default Calculations
// view. Color anchored to the project's CONFIGURED scoring scale range (see
// theme/heatmapColor.ts), not the observed min/max of scores so far, so color meaning
// stays stable throughout partial data collection (same "never mistake partial for final"
// concern FR-030 governs elsewhere on the Dashboard).
//
// This is a scannable summary, not the only view of the raw numbers — the "Full Table" tab
// (CalculationsFullTable.tsx) stays reachable in the same modal for full transparency
// (constitution Principle VI), and every cell's raw score is still the literal source of
// its color, nothing pre-aggregated.

import { useState } from "react";
import { SelectField } from "../../components/SelectField";
import {
  heatmapBackgroundFor,
  heatmapTextColorFor,
  HEATMAP_GREEN_HEX,
  HEATMAP_RED_HEX,
  HEATMAP_YELLOW_HEX,
} from "../../theme/heatmapColor";
import type { Project } from "../../types/project";

function HeatmapCell({ value, min, max }: { value: number | null; min: number; max: number }) {
  if (value === null) {
    return (
      <div className="heatmap-cell heatmap-cell-empty" title="Not yet scored">
        —
      </div>
    );
  }
  const background = heatmapBackgroundFor(value, min, max);
  const color = heatmapTextColorFor(background);
  return (
    <div className="heatmap-cell" style={{ backgroundColor: background, color }}>
      {value}
    </div>
  );
}

function HeatmapLegend({ min, max }: { min: number; max: number }) {
  return (
    <div className="heatmap-legend">
      <span className="heatmap-legend-label">{min} (lowest)</span>
      <div
        className="heatmap-legend-gradient"
        style={{
          background: `linear-gradient(to right, ${HEATMAP_RED_HEX}, ${HEATMAP_YELLOW_HEX}, ${HEATMAP_GREEN_HEX})`,
        }}
      />
      <span className="heatmap-legend-label">{max} (highest)</span>
    </div>
  );
}

export function CalculationsHeatmap({ project }: { project: Project }) {
  const submittedFirms = project.firms.filter((f) => f.submitted);
  const [firmId, setFirmId] = useState(submittedFirms[0]?.id ?? "");
  const firm = submittedFirms.find((f) => f.id === firmId) ?? submittedFirms[0];

  if (submittedFirms.length === 0) {
    return <p className="field-hint">No submitted firms yet.</p>;
  }
  if (project.criteria.length === 0) {
    return <p className="field-hint">No criteria configured yet.</p>;
  }

  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = Math.min(...scaleValues);
  const scaleMax = Math.max(...scaleValues);

  return (
    <div>
      <div className="field" style={{ maxWidth: "20rem" }}>
        <label htmlFor="heatmap-firm-select">Firm</label>
        <SelectField
          id="heatmap-firm-select"
          value={firm.id}
          onChange={(e) => setFirmId(e.target.value)}
        >
          {submittedFirms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="table-wrap">
        <table className="data-table heatmap-table">
          <thead>
            <tr>
              <th>Criterion</th>
              {project.reviewers.map((reviewer) => (
                <th key={reviewer.id}>
                  {reviewer.name} ({reviewer.type})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {project.criteria.map((criterion) => (
              <tr key={criterion.id}>
                <td>{criterion.name}</td>
                {project.reviewers.map((reviewer) => {
                  const score = project.scores.find(
                    (s) =>
                      s.reviewerId === reviewer.id &&
                      s.firmId === firm.id &&
                      s.criterionId === criterion.id,
                  );
                  return (
                    <td key={reviewer.id} className="heatmap-td">
                      <HeatmapCell value={score?.value ?? null} min={scaleMin} max={scaleMax} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HeatmapLegend min={scaleMin} max={scaleMax} />
    </div>
  );
}
