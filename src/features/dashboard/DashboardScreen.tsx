// T039: Dashboard — the project header with a compact toolbar and status pills, and the
// on-screen workspace (DashboardWorkspace.tsx: ranked list + comparison chart on the left, one
// firm's detail on the right). Also hosts the Dashboard's own export actions (Export JSON T044,
// Excel, PDF T043 — the formatted report in lib/report/), and T045's "Configure project"
// transition back into Configuration.
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
// messages as compact pills. The PDF is not printed from this screen: ExportPdfButton builds it
// from the project data (lib/report/).
//
// Must work purely as a viewer (FR-037): rendering this requires no configuration step —
// everything here reads from the already-loaded project.

import { CircleCheck, TriangleAlert } from "lucide-react";
import { formatIsoDate } from "../../lib/formatDate";
import { useLoadedProject } from "../../state/ProjectContext";
import { DashboardWorkspace } from "./DashboardWorkspace";
import { EditProjectButton } from "./EditProjectButton";
import { ExportExcelButton } from "./ExportExcelButton";
import { ExportPdfButton } from "./ExportPdfButton";
import { ExportProjectButton } from "./ExportProjectButton";
import { buildRankedRows } from "./rankedRows";
import type { Project } from "../../types/project";

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
              <ExportPdfButton />
            </div>
          </div>
        </div>
      </div>

      <DashboardWorkspace project={project} />

    </section>
  );
}
