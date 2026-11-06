// T039: Dashboard — the project header with a compact toolbar and status pills, and the
// on-screen workspace (DashboardWorkspace.tsx: ranked list + comparison chart on the left, one
// firm's detail on the right). Also hosts the printable region T043's PDF export captures
// (header, status banners, ranking + full per-firm detail — FR-035), the Dashboard's own export
// actions (Export JSON T044, Excel, PDF T043), and T045's "Configure project" transition back into
// Configuration.
//
// Toolbar: one bordered container (.dashboard-toolbar) grouping controls by what they do — where to
// go (Configure project) on the left, the files you can produce (Export JSON, Excel, PDF) on the
// right. Every control keeps an icon **and** a label: a bare icon can't say "which file am I about
// to get". PDF is the only `button-primary`: it's the actual procurement-record deliverable this
// tool exists to produce, so it's the one control that should visually outrank the rest. The
// Reviewer Forms and Configuration headers use this same toolbar so the three screens read alike.
//
// Compact-layout pass: the on-screen Dashboard is an app-style workspace that fits the window,
// not a long page. The page header carries the project's contact details and the status
// messages as compact pills. Everything the PDF needs lives in PrintableDashboard below, which
// is print-only (off-screen on screen, swapped into flow by tokens.css's `.print-only-block`
// when printing) and uses the existing always-canonical print copies of the table and charts.
//
// Must work purely as a viewer (FR-037): rendering this requires no configuration step —
// everything here reads from the already-loaded project.

import { forwardRef, useRef } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { formatIsoDate } from "../../lib/formatDate";
import { useLoadedProject } from "../../state/ProjectContext";
import { DashboardWorkspace } from "./DashboardWorkspace";
import { EditProjectButton } from "./EditProjectButton";
import { ExportExcelButton } from "./ExportExcelButton";
import { ExportPdfButton } from "./ExportPdfButton";
import { ExportProjectButton } from "./ExportProjectButton";
import { OverallApplicantBarChartPrintCopy } from "./OverallApplicantBarChart";
import { RankedFirmsTablePrintCopy } from "./RankedFirmsTable";
import { buildRankedRows } from "./rankedRows";
import type { Project } from "../../types/project";

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

/** Reminder of any reviewers whose confidentiality form isn't marked signed — the Dashboard
 * is what gets printed/exported for the procurement record, so it shouldn't read as clean
 * while a reviewer's scores are in it without one. Warning only; nothing is blocked. */
function UnsignedReviewersBanner({ project }: { project: Project }) {
  const unsigned = project.reviewers.filter((r) => r.confidentialitySigned === false);
  if (unsigned.length === 0) return null;
  return (
    <div className="banner banner-warning completion-status-banner" role="status">
      <TriangleAlert size={18} aria-hidden="true" />
      <span>
        Confidentiality form not signed:{" "}
        {unsigned.map((r) => r.name || "Unnamed reviewer").join(", ")}.
      </span>
    </div>
  );
}

/** Top-of-page orientation strip: how many firms are in the running, who's leading, and
 * whether either of the other two rank lenses (TLC Applicant, WFRC) ever disagrees with
 * Overall — before the full ranked table. Included in the printable region too, since it's a
 * useful at-a-glance summary for the procurement record, not just an on-screen convenience. */
function DashboardSummary({ project }: { project: Project }) {
  const rows = buildRankedRows(project);
  const topRank = rows[0]?.overallRank ?? null;
  const leaders = topRank !== null ? rows.filter((r) => r.overallRank === topRank) : [];
  const divergentCount = rows.filter(
    (r) => r.overallRank !== r.applicantRank || r.overallRank !== r.wfrcRank,
  ).length;

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
 * so ExportPdfButton (react-to-print) can target this exact DOM node. Print-only: on screen it
 * sits off-screen (`.print-only-block`), and the on-screen Dashboard is DashboardWorkspace. */
export const PrintableDashboard = forwardRef<HTMLDivElement, { project: Project }>(
  function PrintableDashboard({ project }, ref) {
    const rows = buildRankedRows(project);
    const totals = rows.reduce(
      (acc, r) => ({ scored: acc.scored + r.comp.scored, expected: acc.expected + r.comp.expected }),
      { scored: 0, expected: 0 },
    );

    return (
      <div ref={ref} className="print-only-block" aria-hidden="true">
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
                <dd>{formatIsoDate(project.project.committeeMeetingDate)}</dd>
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
        <UnsignedReviewersBanner project={project} />
        {rows.length > 0 && <DashboardSummary project={project} />}

        <div className="card">
          <h2>Ranked Firms</h2>
          <RankedFirmsTablePrintCopy project={project} />
        </div>

        <div className="card">
          <h2>Overall vs. TLC Applicant vs. WFRC Weighted Totals</h2>
          <OverallApplicantBarChartPrintCopy project={project} />
        </div>
      </div>
    );
  },
);

/** Compact status messages for the page header: whether the results are final or partial, and
 * which reviewers haven't signed the confidentiality form. The same facts the print report's
 * banners carry, shortened to fit a pill; the full sentence stays in the tooltip. */
function StatusPills({ project }: { project: Project }) {
  const rows = buildRankedRows(project);
  const unsigned = project.reviewers.filter((r) => r.confidentialitySigned === false);
  if (rows.length === 0 && unsigned.length === 0) return null;
  const totals = rows.reduce(
    (acc, r) => ({ scored: acc.scored + r.comp.scored, expected: acc.expected + r.comp.expected }),
    { scored: 0, expected: 0 },
  );
  const complete = totals.expected > 0 && totals.scored === totals.expected;
  const pct = totals.expected > 0 ? Math.round((totals.scored / totals.expected) * 100) : 0;
  const Icon = complete ? CircleCheck : TriangleAlert;
  const unsignedNames = unsigned.map((r) => r.name || "Unnamed reviewer").join(", ");
  // The pill names up to two reviewers and counts the rest, so a long list can't stretch the
  // header; the tooltip (and the printed report) carry every name. The text truncates with an
  // ellipsis as space runs out and, on a narrower header, is replaced by a generic message
  // (dash-pill--collapsible, app.css); the tooltip always shows the full list.
  const unsignedShort =
    unsigned.length <= 2
      ? unsignedNames
      : `${unsigned
          .slice(0, 2)
          .map((r) => r.name || "Unnamed reviewer")
          .join(", ")} and ${unsigned.length - 2} more`;

  return (
    <div className="dash-pills no-print">
      {rows.length > 0 && (
        <div
          className={`banner dash-pill ${complete ? "banner-success" : "banner-warning"}`}
          role={complete ? undefined : "status"}
          title={
            complete
              ? "All reviewers have responded — these results are final."
              : "Rankings may still change as more reviewers respond."
          }
        >
          <Icon size={16} aria-hidden="true" />
          <span>
            {complete
              ? "All reviewers responded"
              : `Partial results: ${totals.scored}/${totals.expected} scores (${pct}%)`}
          </span>
        </div>
      )}
      {unsigned.length > 0 && (
        <div
          className="banner banner-warning dash-pill dash-pill--collapsible"
          role="status"
          title={`Confidentiality form not signed: ${unsignedNames}.`}
        >
          <TriangleAlert size={16} aria-hidden="true" />
          <span className="dash-pill-text dash-pill-names">Not signed: {unsignedShort}</span>
          <span className="dash-pill-text dash-pill-generic">Not all reviewers have signed</span>
        </div>
      )}
    </div>
  );
}

export interface DashboardScreenProps {
  onEditProject: () => void;
}

export function DashboardScreen({ onEditProject }: DashboardScreenProps) {
  const { project } = useLoadedProject();
  const printRef = useRef<HTMLDivElement>(null);
  const info = project.project;

  return (
    <section aria-label="Dashboard" className="dash-screen">
      <div className="dash-header no-print">
        <div className="dash-header-main">
          <div className="dash-titlerow">
            <h1>Dashboard</h1>
            <h2 className="dash-project-name">{info.projectName || "Untitled Project"}</h2>
            <StatusPills project={project} />
          </div>
          <div className="dash-subline">
            {info.localGovContact && (
              <span className="dash-meta" title="Local government contact">
                Contact <b>{info.localGovContact}</b>
              </span>
            )}
            {info.procurementAgent && (
              <span className="dash-meta" title="Procurement agent (WFRC PM)">
                Procurement agent <b>{info.procurementAgent}</b>
              </span>
            )}
            {info.committeeMeetingDate && (
              <span className="dash-meta" title="Selection committee meeting">
                Meeting <b>{formatIsoDate(info.committeeMeetingDate)}</b>
              </span>
            )}
          </div>
        </div>
        <div className="dash-header-actions">
          <div className="dashboard-toolbar no-print">
            <div className="dashboard-toolbar-group">
              <EditProjectButton onEditProject={onEditProject} />
            </div>
            <div className="dashboard-toolbar-divider" aria-hidden="true" />
            <div className="dashboard-toolbar-group">
              <ExportProjectButton />
              <ExportExcelButton />
              <ExportPdfButton printRef={printRef} />
            </div>
          </div>
        </div>
      </div>

      <DashboardWorkspace project={project} />

      <PrintableDashboard ref={printRef} project={project} />

    </section>
  );
}
