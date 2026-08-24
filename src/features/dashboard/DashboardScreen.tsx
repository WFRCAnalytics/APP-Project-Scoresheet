// T039 (003 redesign): Dashboard — project header, a persistent completion-status banner
// (FR-030 promoted from a stat tile to an unmissable signal, so partial results are never
// mistaken for final), an orientation strip (FR-032/FR-033), and RankedFirmsTable — a
// sortable, per-row-expandable comparison table that now hosts the ranking, the per-
// criterion "why" breakdown, and reviewer comments in one place (previously three separate,
// disconnected sections). Also hosts the printable region T043's PDF export captures
// (header, banner, ranking + full per-firm detail — FR-035), the "show calculations" toggle
// (FR-031, reachable in one click), the Dashboard's own Export PDF / Export JSON actions
// (T043/T044), and T045's "Edit project" transition back into Configuration.
//
// Must work purely as a viewer (FR-037): rendering this requires no configuration step —
// everything here reads from the already-loaded project.

import { forwardRef, useRef, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useLoadedProject } from "../../state/ProjectContext";
import { useChartColors } from "../../theme/chartColors";
import { CalculationsModal } from "../calculations-view/CalculationsModal";
import { ChartExportButtons } from "./ChartExportButtons";
import { EditProjectButton } from "./EditProjectButton";
import { ExportPdfButton } from "./ExportPdfButton";
import { ExportProjectButton } from "./ExportProjectButton";
import { OverallApplicantBarChart } from "./OverallApplicantBarChart";
import { RankedFirmsTable } from "./RankedFirmsTable";
import { buildRankedRows } from "./rankedRows";
import type { Project } from "../../types/project";

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

/** Persistent, can't-miss signal of whether the results below are final or still coming in
 * — promoted out of the old summary strip's "Scoring Complete %" stat tile (easy to skim
 * past) into its own banner, always the first thing under the project header. Reuses the
 * existing .banner component family (warning variant already existed; success is new — see
 * contrast.test.ts for the new pairing this introduces). */
function CompletionStatusBanner({ scored, expected }: { scored: number; expected: number }) {
  const complete = expected > 0 && scored === expected;
  const pct = expected > 0 ? Math.round((scored / expected) * 100) : 0;
  const Icon = complete ? CircleCheck : TriangleAlert;
  return (
    <div
      className={`banner completion-status-banner ${complete ? "banner-success" : "banner-warning"}`}
      role={complete ? undefined : "status"}
    >
      <Icon size={18} aria-hidden="true" />
      <span>
        {complete
          ? "All reviewers have responded — these results are final."
          : `Partial results — ${scored}/${expected} reviewer scores recorded (${pct}%). Rankings may still change as more reviewers respond.`}
      </span>
    </div>
  );
}

/** Top-of-page orientation strip: how many firms are in the running, who's leading, and
 * whether the two rank lenses (Overall vs. TLC Applicant) ever disagree — before the full
 * ranked table. Included in the printable region too, since it's a useful at-a-glance
 * summary for the procurement record, not just an on-screen convenience. */
function DashboardSummary({ project }: { project: Project }) {
  const rows = buildRankedRows(project);
  const topRank = rows[0]?.overallRank ?? null;
  const leaders = topRank !== null ? rows.filter((r) => r.overallRank === topRank) : [];
  const divergentCount = rows.filter((r) => r.overallRank !== r.applicantRank).length;

  return (
    <div className="summary-strip">
      <div className="summary-stat">
        <span className="summary-stat-value">{rows.length}</span>
        <span className="summary-stat-label">Firms Submitted</span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-value">
          {leaders.length > 0 ? leaders.map((r) => r.firm.name).join(", ") : "—"}
        </span>
        <span className="summary-stat-label">
          {leaders.length > 1 ? "Leading (tied)" : "Leading Firm"}
        </span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-value">{divergentCount}</span>
        <span className="summary-stat-label">
          {divergentCount === 1 ? "Firm Ranks Differently" : "Firms Rank Differently"}
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
    const rows = buildRankedRows(project);
    const totals = rows.reduce(
      (acc, r) => ({ scored: acc.scored + r.comp.scored, expected: acc.expected + r.comp.expected }),
      { scored: 0, expected: 0 },
    );

    return (
      <div ref={ref}>
        <div className="card card--subtle">
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

        {rows.length > 0 && <CompletionStatusBanner {...totals} />}
        {rows.length > 0 && <DashboardSummary project={project} />}

        <div className="card">
          <h2>Ranked Firms</h2>
          <p className="field-hint ranked-firms-hint">
            Sort any column to compare firms; expand a row to see its per-criterion breakdown
            and reviewer comments.
          </p>
          <RankedFirmsTable project={project} />
        </div>

        <div className="card">
          <div className="chart-controls-row">
            <h2>Overall vs. TLC Applicant Weighted Totals</h2>
            <ChartExportButtons
              getSvg={() => barChartContainerRef.current?.querySelector("svg") ?? null}
              projectName={project.project.projectName}
              chartLabel="Overall vs TLC Applicant Weighted Totals"
              backgroundColor={backgroundColor}
            />
          </div>
          <OverallApplicantBarChart project={project} containerRef={barChartContainerRef} />
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
