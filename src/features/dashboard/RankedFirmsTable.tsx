// The Dashboard's central comparison view (003 redesign): a sortable table of every
// submitted firm, each row expandable in place to reveal why it scored where it did (the
// per-criterion radar chart, scoped to that firm) and its reviewer comments — replacing the
// old static table + a separate single-firm-dropdown chart card + a separate bottom-of-page
// comments accordion, all three of which required re-finding the same firm three times.
//
// Sorting and row-expansion are pure on-screen viewing conveniences (FR-035's PDF export is
// the actual procurement record). usePrintMode() forces both back to their canonical form
// during print — row order to ascending overall rank, every row fully expanded — regardless
// of whatever a viewer happened to leave active on screen; see that hook's own comment.

import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, Users } from "lucide-react";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { round2 } from "../../lib/calculations";
import type { Project } from "../../types/project";
import { buildRankedRows, type RankedRow } from "./rankedRows";
import { usePrintMode } from "./usePrintMode";
import { CriterionBreakdownChart } from "./CriterionBreakdownChart";
import { FirmCommentsTable } from "./FirmCommentsTable";
import { ReviewerScoreSpreadChart } from "./ReviewerScoreSpreadChart";

type SortKey = "rank" | "firm" | "overall" | "applicant" | "wfrc" | "completion";
type SortDirection = "asc" | "desc";

// Clicking a not-yet-active column header starts from the direction that's most useful for
// that column — totals/completion are more interesting highest-first, rank/name are more
// natural lowest/A-first.
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  rank: "asc",
  firm: "asc",
  overall: "desc",
  applicant: "desc",
  wfrc: "desc",
  completion: "desc",
};

function completionFraction(row: RankedRow): number {
  return row.comp.expected > 0 ? row.comp.scored / row.comp.expected : 0;
}

function compareRows(a: RankedRow, b: RankedRow, key: SortKey): number {
  switch (key) {
    case "rank":
      return a.overallRank - b.overallRank;
    case "firm":
      return a.firm.name.localeCompare(b.firm.name);
    case "overall":
      return a.overallTotal - b.overallTotal;
    case "applicant":
      return a.applicantTotal - b.applicantTotal;
    case "wfrc":
      return a.wfrcTotal - b.wfrcTotal;
    case "completion":
      return completionFraction(a) - completionFraction(b);
  }
}

function formatCompletion(c: { scored: number; expected: number }): string {
  return `${c.scored}/${c.expected} scored`;
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sortable-header" onClick={() => onSort(sortKey)}>
        {label}
        <Icon size={14} strokeWidth={2} aria-hidden="true" className="sort-icon no-print" />
      </button>
    </th>
  );
}

export function RankedFirmsTable({ project }: { project: Project }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const isPrinting = usePrintMode();

  const rows = buildRankedRows(project); // already canonical (ascending overall rank) order

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message="No submitted firms yet."
        hint="Ranked results appear here once at least one firm has been marked submitted and has reviewer scores recorded."
      />
    );
  }

  const topOverallRank = Math.min(...rows.map((r) => r.overallRank));

  // The PDF export is a fixed procurement record: its row order must always be the
  // canonical overall rank, never whatever sort a viewer left active on screen. `rows` is
  // already in that order — on-screen sorting only ever reorders a COPY of it, so printing
  // simply skips applying that copy.
  const displayRows = isPrinting
    ? rows
    : [...rows].sort((a, b) => (direction === "asc" ? 1 : -1) * compareRows(a, b, sortKey));

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(DEFAULT_DIRECTION[key]);
    }
  }

  function toggleExpanded(firmId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(firmId)) next.delete(firmId);
      else next.add(firmId);
      return next;
    });
  }

  return (
    <div className="table-wrap">
      <table className="data-table ranked-firms-table" aria-label="Ranked firms">
        <thead>
          <tr>
            <th scope="col" className="row-expand-header" aria-hidden="true" />
            <SortableHeader
              label="Rank"
              sortKey="rank"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
            <SortableHeader
              label="Firm"
              sortKey="firm"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
            <SortableHeader
              label="Overall Weighted Total"
              sortKey="overall"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
            <SortableHeader
              label="TLC Applicant Weighted Total"
              sortKey="applicant"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
            <SortableHeader
              label="WFRC Weighted Total"
              sortKey="wfrc"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
            <SortableHeader
              label="Completion"
              sortKey="completion"
              activeKey={sortKey}
              direction={direction}
              onSort={toggleSort}
            />
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => {
            const isExpanded = isPrinting || expandedIds.has(row.firm.id);
            const detailId = `firm-detail-${row.firm.id}`;
            return (
              <Fragment key={row.firm.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="row-expand-toggle no-print"
                      aria-expanded={isExpanded}
                      aria-controls={detailId}
                      onClick={() => toggleExpanded(row.firm.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} aria-hidden="true" />
                      )}
                      <span className="visually-hidden">
                        {isExpanded ? `Collapse ${row.firm.name}` : `Expand ${row.firm.name}`}
                      </span>
                    </button>
                  </td>
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
                {isExpanded && (
                  <tr id={detailId} className="firm-detail-row">
                    <td colSpan={7}>
                      <div className="firm-detail">
                        <CriterionBreakdownChart project={project} firmId={row.firm.id} />
                        <ReviewerScoreSpreadChart project={project} firmId={row.firm.id} />
                        <FirmCommentsTable project={project} firmId={row.firm.id} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
