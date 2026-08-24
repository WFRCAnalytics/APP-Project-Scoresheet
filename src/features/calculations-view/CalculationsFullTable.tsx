// The full per-reviewer audit table (formerly the entirety of CalculationsView.tsx) — every
// raw score, every computed average/weight/weighted-total, with nothing omitted (FR-031).
// Now one tab within CalculationsModal rather than the default/only view, with a sticky
// header + scrollable container (instead of spilling past the page edge) and monospace
// numerals (--font-mono, a real WFRC brand typeface that had no use elsewhere) for the
// dense numeric columns. Sourced from the exact same calculations.ts functions the
// Dashboard uses — same numbers, same source (constitution Principle VI).

import {
  applicantAvg,
  applicantWeightedTotal,
  completion,
  overallAvg,
  overallWeightedTotal,
  round2,
  wfrcAvg,
  wfrcWeightedTotal,
} from "../../lib/calculations";
import type { Project } from "../../types/project";

export function CalculationsFullTable({ project }: { project: Project }) {
  const submittedFirms = project.firms.filter((f) => f.submitted);

  if (submittedFirms.length === 0) {
    return <p className="field-hint">No submitted firms yet.</p>;
  }

  return (
    <div>
      {submittedFirms.map((firm) => (
        <div key={firm.id} className="calc-firm-block">
          <h3>{firm.name}</h3>
          <div className="table-wrap table-wrap--scroll">
            <table className="data-table calc-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th className="calc-numeric-header">Weight</th>
                  {project.reviewers.map((reviewer) => (
                    <th key={reviewer.id} className="calc-numeric-header">
                      {reviewer.name} ({reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant"})
                    </th>
                  ))}
                  <th className="calc-numeric-header">Overall Avg</th>
                  <th className="calc-numeric-header">TLC Applicant Avg</th>
                  <th className="calc-numeric-header">WFRC Avg</th>
                  <th className="calc-numeric-header">Overall Wtd</th>
                  <th className="calc-numeric-header">TLC Applicant Wtd</th>
                  <th className="calc-numeric-header">WFRC Wtd</th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                {project.criteria.map((criterion) => {
                  const oAvg = overallAvg(project, firm.id, criterion.id);
                  const cAvg = applicantAvg(project, firm.id, criterion.id);
                  const wAvg = wfrcAvg(project, firm.id, criterion.id);
                  const cellCompletion = completion(project, firm.id, {
                    criterionId: criterion.id,
                  });
                  const applicantCompletion = completion(project, firm.id, {
                    criterionId: criterion.id,
                    by: "applicant",
                  });
                  return (
                    <tr key={criterion.id}>
                      <td>{criterion.name}</td>
                      <td className="calc-numeric">{criterion.weight}</td>
                      {project.reviewers.map((reviewer) => {
                        const score = project.scores.find(
                          (s) =>
                            s.reviewerId === reviewer.id &&
                            s.firmId === firm.id &&
                            s.criterionId === criterion.id,
                        );
                        return (
                          <td key={reviewer.id} className="calc-numeric">
                            {score ? score.value : "—"}
                          </td>
                        );
                      })}
                      <td className="calc-numeric">{oAvg !== null ? round2(oAvg) : "—"}</td>
                      <td className="calc-numeric">{cAvg !== null ? round2(cAvg) : "—"}</td>
                      <td className="calc-numeric">{wAvg !== null ? round2(wAvg) : "—"}</td>
                      <td className="calc-numeric">
                        {oAvg !== null ? round2(oAvg * criterion.weight) : "—"}
                      </td>
                      <td className="calc-numeric">
                        {cAvg !== null ? round2(cAvg * criterion.weight) : "—"}
                      </td>
                      <td className="calc-numeric">
                        {wAvg !== null ? round2(wAvg * criterion.weight) : "—"}
                      </td>
                      <td>
                        {cellCompletion.scored}/{cellCompletion.expected} overall,{" "}
                        {applicantCompletion.scored}/{applicantCompletion.expected} applicant
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  {/* Columns: Criterion, Weight, [reviewers] = reviewers.length + 2. */}
                  <td colSpan={project.reviewers.length + 2}>
                    <strong>Weighted Totals</strong>
                  </td>
                  {/* Columns: Overall Avg, TLC Applicant Avg, WFRC Avg, Overall Wtd, TLC
                      Applicant Wtd, WFRC Wtd = 6. Was colSpan={2} — left the row short of the
                      header, which is what made the footer visibly not line up with the
                      table above it once this table got a real border/scroll container. */}
                  <td colSpan={6} className="calc-numeric">
                    <strong>
                      Overall: {round2(overallWeightedTotal(project, firm.id))} / TLC Applicant:{" "}
                      {round2(applicantWeightedTotal(project, firm.id))} / WFRC:{" "}
                      {round2(wfrcWeightedTotal(project, firm.id))}
                    </strong>
                  </td>
                  {/* Completion column — intentionally blank in the totals row. */}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
