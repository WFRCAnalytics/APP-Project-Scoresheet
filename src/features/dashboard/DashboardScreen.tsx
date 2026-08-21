// T039: Dashboard — project header, ranked firm cards (rank, Overall/City Weighted
// Total, per-firm completion indicator) (FR-032, FR-033, FR-030). Also hosts the
// printable region T043's PDF export captures (header, ranking, charts, per-firm detail
// with comments — FR-035), the "show calculations" toggle (FR-031, reachable in one
// click), the Dashboard's own Export PDF / Export JSON actions (T043/T044), and T045's
// "Edit project" transition back into Configuration.
//
// Must work purely as a viewer (FR-037): rendering this requires no configuration step —
// everything here reads from the already-loaded project.

import { forwardRef, useRef, useState } from "react";
import { cityWeightedTotal, completion, getRank, overallWeightedTotal, round2 } from "../../lib/calculations";
import { useLoadedProject } from "../../state/ProjectContext";
import { CalculationsView } from "../calculations-view/CalculationsView";
import { CriterionBreakdownChart } from "./CriterionBreakdownChart";
import { EditProjectButton } from "./EditProjectButton";
import { ExportPdfButton } from "./ExportPdfButton";
import { ExportProjectButton } from "./ExportProjectButton";
import { OverallCityBarChart } from "./OverallCityBarChart";
import type { Project } from "../../types/project";

function formatCompletion(c: { scored: number; expected: number }): string {
  return `${c.scored}/${c.expected} scored`;
}

/** The printable region — everything FR-035's PDF export must capture. Forwards its ref
 * so ExportPdfButton (react-to-print) can target this exact DOM node. */
export const PrintableDashboard = forwardRef<HTMLDivElement, { project: Project }>(function PrintableDashboard(
  { project },
  ref,
) {
  const rankedOverall = project.firms
    .filter((f) => f.submitted)
    .map((firm) => ({ firm, rank: getRank(project, firm.id, "overall") }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  return (
    <div ref={ref}>
      <div className="card">
        <h2>{project.project.projectName || "Untitled Project"}</h2>
        <p>
          {project.project.localGovContact && <>Contact: {project.project.localGovContact}. </>}
          {project.project.committeeMeetingDate && <>Committee meeting: {project.project.committeeMeetingDate}.</>}
        </p>
      </div>

      <div className="card">
        <h2>Ranked Firms</h2>
        {rankedOverall.length === 0 && <p className="field-hint">No submitted firms yet.</p>}
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Firm</th>
              <th>Overall Weighted Total</th>
              <th>City Weighted Total</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {rankedOverall.map(({ firm, rank }) => (
              <tr key={firm.id}>
                <td>{rank}</td>
                <td>{firm.name}</td>
                <td>{round2(overallWeightedTotal(project, firm.id))}</td>
                <td>{round2(cityWeightedTotal(project, firm.id))}</td>
                <td>{formatCompletion(completion(project, firm.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Overall vs. City Weighted Totals</h2>
        <OverallCityBarChart project={project} />
      </div>

      <div className="card">
        <h2>Per-Firm Criterion Breakdown</h2>
        <CriterionBreakdownChart project={project} />
      </div>

      <div className="card">
        <h2>Per-Firm Detail &amp; Comments</h2>
        {rankedOverall.map(({ firm }) => {
          const firmComments = project.criteria.flatMap((criterion) => {
            const scores = project.scores.filter(
              (s) => s.firmId === firm.id && s.criterionId === criterion.id && s.comment.trim() !== "",
            );
            return scores.map((s) => {
              const reviewer = project.reviewers.find((r) => r.id === s.reviewerId);
              return { criterion: criterion.name, reviewer: reviewer?.name ?? "Unknown reviewer", comment: s.comment };
            });
          });
          return (
            <div key={firm.id} style={{ marginBottom: "1rem" }}>
              <h3>{firm.name}</h3>
              {firmComments.length === 0 ? (
                <p className="field-hint">No comments recorded.</p>
              ) : (
                <ul>
                  {firmComments.map((c, i) => (
                    <li key={i}>
                      <strong>{c.criterion}</strong> ({c.reviewer}): {c.comment}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export interface DashboardScreenProps {
  onEditProject: () => void;
}

export function DashboardScreen({ onEditProject }: DashboardScreenProps) {
  const { project } = useLoadedProject();
  const [showCalculations, setShowCalculations] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  return (
    <section aria-label="Dashboard">
      <h1>Dashboard</h1>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setShowCalculations((s) => !s)}
        >
          {showCalculations ? "Hide calculations" : "Show calculations"}
        </button>
        <ExportPdfButton printRef={printRef} />
        <ExportProjectButton />
        <EditProjectButton onEditProject={onEditProject} />
      </div>

      <PrintableDashboard ref={printRef} project={project} />

      {showCalculations && <CalculationsView project={project} />}
    </section>
  );
}
