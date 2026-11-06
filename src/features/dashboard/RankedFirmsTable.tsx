// The printed/PDF report's ranked-firms table. The on-screen Dashboard no longer has a table:
// DashboardWorkspace (DashboardWorkspace.tsx) lists the firms as a list you pick from and shows
// one firm's detail beside it. What stays here is the print-only table, which always renders
// every firm, always in canonical overall-rank order, always with each firm's per-criterion
// breakdown, reviewer scores and comments laid out one after another — a fixed procurement
// record (FR-035) that must never depend on what a viewer happened to have selected, which tab
// was open, or how the list was scrolled on screen.
//
// It is a separate always-correct, always-off-screen copy (rather than the interactive view
// forced into print form) for the reason the chart copies exist: react-to-print prints through a
// hidden iframe whose own window never fires this document's `beforeprint`/`afterprint` events,
// so nothing can detect "now printing" and swap the layout in JS. Everything here is `@media
// print` CSS instead (tokens.css's `.print-only-block`) — see OverallApplicantBarChart.tsx's
// header comment for the full story.

import { Fragment } from "react";
import { Badge } from "../../components/Badge";
import { round2 } from "../../lib/calculations";
import type { Project } from "../../types/project";
import { buildRankedRows } from "./rankedRows";
import { CriterionBreakdownChartPrintCopy } from "./CriterionBreakdownChart";
import { FirmCommentsTable } from "./FirmCommentsTable";
import { ReviewerScoreSpreadChartPrintCopy } from "./ReviewerScoreSpreadChart";

function formatCompletion(c: { scored: number; expected: number }): string {
  return `${c.scored}/${c.expected} scored`;
}

/** Renders a completion count as a text label ("N/M scored") plus a small visual bar. The bar's
 * own track/fill are decorative (aria-hidden); the label carries the real accessible content. */
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

/** Print-only table — see this file's header comment for the full rationale. Always every
 * firm, always canonical overall-rank order, always fully "expanded" (per-criterion breakdown +
 * reviewer comments), always off-screen and light-colored via the same `*PrintCopy` chart
 * components OverallApplicantBarChart.tsx uses, swapped into normal, visible, in-flow layout
 * only inside an actual print render (tokens.css's `.print-only-block`). Nothing interactive
 * here — only a fixed record. `aria-hidden` because every value here duplicates something
 * already reachable in the interactive Dashboard; screen readers should never land on this
 * copy. */
export function RankedFirmsTablePrintCopy({ project }: { project: Project }) {
  const rows = buildRankedRows(project); // canonical ascending-overall-rank order

  if (rows.length === 0) return null;

  const topOverallRank = Math.min(...rows.map((r) => r.overallRank));

  return (
    <div className="print-only-block" aria-hidden="true">
      <div className="table-wrap">
        <table className="data-table ranked-firms-table" aria-label="Ranked firms">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Firm</th>
              <th scope="col">Overall Weighted Total</th>
              <th scope="col">TLC Applicant Weighted Total</th>
              <th scope="col">WFRC Weighted Total</th>
              <th scope="col">Completion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.firm.id}>
                <tr>
                  <td>
                    <Badge variant={row.overallRank === topOverallRank ? "info" : "neutral"}>
                      {row.overallRank}
                    </Badge>
                  </td>
                  <td>{row.firm.name}</td>
                  <td>{round2(row.overallTotal)}</td>
                  <td>{round2(row.applicantTotal)}</td>
                  <td>{round2(row.wfrcTotal)}</td>
                  <td>
                    <CompletionBar {...row.comp} />
                  </td>
                </tr>
                <tr className="firm-detail-row">
                  <td colSpan={6}>
                    <div className="firm-detail">
                      <CriterionBreakdownChartPrintCopy project={project} firmId={row.firm.id} />
                      <ReviewerScoreSpreadChartPrintCopy project={project} firmId={row.firm.id} />
                      <FirmCommentsTable project={project} firmId={row.firm.id} />
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
