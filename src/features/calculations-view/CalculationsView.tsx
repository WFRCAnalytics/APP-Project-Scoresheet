// T042: "Show calculations" audit view — every reviewer's raw score per firm per
// criterion, alongside the computed averages, weights, weighted sub-totals, and final
// totals, with nothing omitted (FR-031). Includes per-criterion completion counts, not
// just the Dashboard's per-firm one, so FR-030's "everywhere a computed average is
// displayed" requirement is met here too. Sourced from the exact same calculations.ts
// functions the Dashboard uses — same numbers, same source (constitution Principle VI).
//
// Also hosts the manual score-entry grid (T047/T048), per plan.md's structure note —
// "a reasonable place to host the manual score-entry grid," since both are
// audit/data-entry concerns rather than the primary Dashboard viewing experience, and
// neither belongs in the printed PDF record (this view sits outside DashboardScreen's
// printable region).

import {
  cityAvg,
  cityWeightedTotal,
  completion,
  overallAvg,
  overallWeightedTotal,
  round2,
} from "../../lib/calculations";
import { ManualEntryGrid } from "../reviewer-forms/ManualEntryGrid";
import type { Project } from "../../types/project";

export function CalculationsView({ project }: { project: Project }) {
  const submittedFirms = project.firms.filter((f) => f.submitted);

  return (
    <div className="card" aria-label="Calculations">
      <h2>Show Calculations</h2>
      <p className="field-hint">
        Every number below is computed live from the raw scores — nothing here is a
        separately stored summary.
      </p>

      {submittedFirms.length === 0 && <p className="field-hint">No submitted firms yet.</p>}

      {submittedFirms.map((firm) => (
        <div key={firm.id} style={{ marginBottom: "2rem" }}>
          <h3>{firm.name}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Weight</th>
                {project.reviewers.map((reviewer) => (
                  <th key={reviewer.id}>
                    {reviewer.name} ({reviewer.type})
                  </th>
                ))}
                <th>Overall Avg</th>
                <th>City Avg</th>
                <th>Overall Wtd</th>
                <th>City Wtd</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {project.criteria.map((criterion) => {
                const oAvg = overallAvg(project, firm.id, criterion.id);
                const cAvg = cityAvg(project, firm.id, criterion.id);
                const cellCompletion = completion(project, firm.id, { criterionId: criterion.id });
                const cityCompletion = completion(project, firm.id, { criterionId: criterion.id, by: "city" });
                return (
                  <tr key={criterion.id}>
                    <td>{criterion.name}</td>
                    <td>{criterion.weight}</td>
                    {project.reviewers.map((reviewer) => {
                      const score = project.scores.find(
                        (s) =>
                          s.reviewerId === reviewer.id &&
                          s.firmId === firm.id &&
                          s.criterionId === criterion.id,
                      );
                      return <td key={reviewer.id}>{score ? score.value : "—"}</td>;
                    })}
                    <td>{oAvg !== null ? round2(oAvg) : "—"}</td>
                    <td>{cAvg !== null ? round2(cAvg) : "—"}</td>
                    <td>{oAvg !== null ? round2(oAvg * criterion.weight) : "—"}</td>
                    <td>{cAvg !== null ? round2(cAvg * criterion.weight) : "—"}</td>
                    <td>
                      {cellCompletion.scored}/{cellCompletion.expected} overall,{" "}
                      {cityCompletion.scored}/{cityCompletion.expected} city
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={project.reviewers.length + 2}>
                  <strong>Weighted Totals</strong>
                </td>
                <td colSpan={2}>
                  <strong>
                    Overall: {round2(overallWeightedTotal(project, firm.id))} / City:{" "}
                    {round2(cityWeightedTotal(project, firm.id))}
                  </strong>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      <ManualEntryGrid />
    </div>
  );
}
