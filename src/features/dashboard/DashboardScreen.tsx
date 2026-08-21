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
import { Badge } from "../../components/Badge";
import {
  cityWeightedTotal,
  completion,
  getRank,
  overallWeightedTotal,
  round2,
} from "../../lib/calculations";
import { useLoadedProject } from "../../state/ProjectContext";
import { useChartColors } from "../../theme/chartColors";
import { CalculationsModal } from "../calculations-view/CalculationsModal";
import { ChartExportButtons } from "./ChartExportButtons";
import { CriterionBreakdownChart } from "./CriterionBreakdownChart";
import { EditProjectButton } from "./EditProjectButton";
import { ExportPdfButton } from "./ExportPdfButton";
import { ExportProjectButton } from "./ExportProjectButton";
import { OverallCityBarChart } from "./OverallCityBarChart";
import type { Firm, Project } from "../../types/project";

function formatCompletion(c: { scored: number; expected: number }): string {
  return `${c.scored}/${c.expected} scored`;
}

/** "2026-08-20" -> "August 20, 2026". Parses the Y/M/D components manually and builds the
 * Date from local-time components rather than `new Date(isoDate)` — the latter parses a
 * bare date string as UTC midnight, which `toLocaleDateString()` can then render as the
 * PREVIOUS day in any timezone west of UTC (a classic off-by-one-day bug). Falls back to
 * the raw string if it isn't the expected shape rather than showing "Invalid Date". */
function formatMeetingDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

/** Renders a completion count as a text label (unchanged format — "N/M scored" — so
 * anything matching that text keeps matching) plus a small visual bar. The bar's own
 * track/fill are decorative (aria-hidden); the label carries the real accessible content. */
function CompletionBar({ scored, expected }: { scored: number; expected: number }) {
  const pct = expected > 0 ? Math.round((scored / expected) * 100) : 0;
  return (
    <div className="completion-bar">
      <div className="completion-bar-track" aria-hidden="true">
        <div className="completion-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="completion-bar-label">{formatCompletion({ scored, expected })}</span>
    </div>
  );
}

/** Top-of-page orientation strip: how many firms are in the running, how much scoring is
 * done overall, and who's leading — before the full ranked table. Included in the printable
 * region too, since it's a useful at-a-glance summary for the procurement record, not just
 * an on-screen convenience. */
function DashboardSummary({
  project,
  rankedOverall,
}: {
  project: Project;
  rankedOverall: { firm: Firm; rank: number | null }[];
}) {
  const submittedCount = rankedOverall.length;
  const totals = rankedOverall.reduce(
    (acc, { firm }) => {
      const c = completion(project, firm.id);
      return { scored: acc.scored + c.scored, expected: acc.expected + c.expected };
    },
    { scored: 0, expected: 0 },
  );
  const completionPct =
    totals.expected > 0 ? Math.round((totals.scored / totals.expected) * 100) : 0;
  const topRank = rankedOverall[0]?.rank ?? null;
  const leaders =
    topRank !== null ? rankedOverall.filter((r) => r.rank === topRank).map((r) => r.firm.name) : [];

  return (
    <div className="summary-strip">
      <div className="summary-stat">
        <span className="summary-stat-value">{submittedCount}</span>
        <span className="summary-stat-label">Firms Submitted</span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-value">{completionPct}%</span>
        <span className="summary-stat-label">Scoring Complete</span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-value">{leaders.length > 0 ? leaders.join(", ") : "—"}</span>
        <span className="summary-stat-label">
          {leaders.length > 1 ? "Leading (tied)" : "Leading Firm"}
        </span>
      </div>
    </div>
  );
}

/** The printable region — everything FR-035's PDF export must capture. Forwards its ref
 * so ExportPdfButton (react-to-print) can target this exact DOM node. */
export const PrintableDashboard = forwardRef<HTMLDivElement, { project: Project }>(
  function PrintableDashboard({ project }, ref) {
    const { backgroundColor } = useChartColors();
    const barChartContainerRef = useRef<HTMLDivElement>(null);
    const rankedOverall = project.firms
      .filter((f) => f.submitted)
      .map((firm) => ({ firm, rank: getRank(project, firm.id, "overall") }))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    return (
      <div ref={ref}>
        <div className="card">
          <h2>{project.project.projectName || "Untitled Project"}</h2>
          <dl className="project-info-grid">
            {project.project.localGovContact && (
              <div className="project-info-item">
                <dt>Local Government Contact</dt>
                <dd>{project.project.localGovContact}</dd>
              </div>
            )}
            {project.project.procurementAgent && (
              <div className="project-info-item">
                <dt>Procurement Agent (WFRC PM)</dt>
                <dd>{project.project.procurementAgent}</dd>
              </div>
            )}
            {project.project.committeeMeetingDate && (
              <div className="project-info-item">
                <dt>Selection Committee Meeting</dt>
                <dd>{formatMeetingDate(project.project.committeeMeetingDate)}</dd>
              </div>
            )}
          </dl>
          {project.project.notes && (
            <p className="project-info-notes">
              <strong>Notes:</strong> {project.project.notes}
            </p>
          )}
        </div>

        {rankedOverall.length > 0 && (
          <DashboardSummary project={project} rankedOverall={rankedOverall} />
        )}

        <div className="card">
          <h2>Ranked Firms</h2>
          {rankedOverall.length === 0 && <p className="field-hint">No submitted firms yet.</p>}
          {rankedOverall.length > 0 && (
            <div className="table-wrap">
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
                      <td>
                        <Badge variant={rank === rankedOverall[0].rank ? "info" : "neutral"}>
                          {rank}
                        </Badge>
                      </td>
                      <td>{firm.name}</td>
                      <td>{round2(overallWeightedTotal(project, firm.id))}</td>
                      <td>{round2(cityWeightedTotal(project, firm.id))}</td>
                      <td>
                        <CompletionBar {...completion(project, firm.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="chart-controls-row">
            <h2>Overall vs. City Weighted Totals</h2>
            <ChartExportButtons
              getSvg={() => barChartContainerRef.current?.querySelector("svg") ?? null}
              projectName={project.project.projectName}
              chartLabel="Overall vs City Weighted Totals"
              backgroundColor={backgroundColor}
            />
          </div>
          <OverallCityBarChart project={project} containerRef={barChartContainerRef} />
        </div>

        <div className="card">
          <h2>Per-Firm Criterion Breakdown</h2>
          <CriterionBreakdownChart project={project} />
        </div>

        <div className="card">
          <h2>Per-Firm Detail &amp; Comments</h2>
          {rankedOverall.map(({ firm }) => {
            // Grouped by criterion (criteria is the outer loop, so consecutive entries
            // already share a criterion — no separate sort/group-by step needed) so the
            // table below can render each criterion name once, spanning its reviewer rows,
            // instead of repeating "Criterion (Reviewer): Comment" as prose on every line.
            const groups = project.criteria
              .map((criterion) => ({
                criterion: criterion.name,
                items: project.scores
                  .filter(
                    (s) =>
                      s.firmId === firm.id &&
                      s.criterionId === criterion.id &&
                      s.comment.trim() !== "",
                  )
                  .map((s) => ({
                    reviewer:
                      project.reviewers.find((r) => r.id === s.reviewerId)?.name ??
                      "Unknown reviewer",
                    comment: s.comment,
                  })),
              }))
              .filter((group) => group.items.length > 0);
            const commentCount = groups.reduce((sum, g) => sum + g.items.length, 0);

            return (
              <details key={firm.id} className="comments-accordion">
                <summary>
                  {firm.name}
                  {commentCount > 0 && <Badge variant="neutral">{commentCount}</Badge>}
                </summary>
                {groups.length === 0 ? (
                  <p className="field-hint">No comments recorded.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table comments-table">
                      <thead>
                        <tr>
                          <th>Criterion</th>
                          <th>Reviewer</th>
                          <th>Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.flatMap((group, gi) =>
                          group.items.map((item, ii) => (
                            <tr key={`${gi}-${ii}`}>
                              {ii === 0 && (
                                <td
                                  rowSpan={group.items.length}
                                  className="comments-criterion-cell"
                                >
                                  {group.criterion}
                                </td>
                              )}
                              <td>{item.reviewer}</td>
                              <td>{item.comment}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </div>
    );
  },
);

export interface DashboardScreenProps {
  onEditProject: () => void;
}

export function DashboardScreen({ onEditProject }: DashboardScreenProps) {
  const { project } = useLoadedProject();
  const [calculationsOpen, setCalculationsOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  return (
    <section aria-label="Dashboard">
      <div className="dashboard-page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">{project.project.projectName || "Untitled Project"}</p>
        </div>
        <div className="actions-row dashboard-page-header-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setCalculationsOpen((s) => !s)}
          >
            {calculationsOpen ? "Hide calculations" : "Show calculations"}
          </button>
          <ExportPdfButton printRef={printRef} />
          <ExportProjectButton />
          <EditProjectButton onEditProject={onEditProject} />
        </div>
      </div>

      <PrintableDashboard ref={printRef} project={project} />

      <CalculationsModal
        open={calculationsOpen}
        onClose={() => setCalculationsOpen(false)}
        project={project}
      />
    </section>
  );
}
