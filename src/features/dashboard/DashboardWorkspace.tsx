// The Dashboard's on-screen body, laid out as an app that fits the window instead of a long
// page. Left column: two summary tiles, the leading firm, the ranked firms (a list you pick
// from — it scrolls inside its own card when there are many) and the Overall / TLC Applicant /
// WFRC comparison chart. Right: the selected firm — its totals, then three tabs: Criterion
// breakdown (radar + how each criterion scored), Comments (editable, per criterion) and
// Reviewer scores (a heatmap of every reviewer against every criterion).
//
// This replaces the old sortable table whose rows expanded in place; picking a firm in the list
// shows exactly one firm's detail at a time, so nothing has to be scrolled past. The printed/
// PDF report does not use any of this — PrintableDashboard (DashboardScreen.tsx) carries its own
// print-only copies of the table and charts.

import { useRef, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { ScrollableTabs } from "../../components/ScrollableTabs";
import { scrollableTabId } from "../../components/scrollableTabId";
import { applicantAvg, overallAvg, round2, wfrcAvg } from "../../lib/calculations";
import { useChartColors } from "../../theme/chartColors";
import type { Project } from "../../types/project";
import { ChartExportButtons } from "./ChartExportButtons";
import { CriterionBreakdownChart } from "./CriterionBreakdownChart";
import { EditScoreDialog, type ScoreTarget } from "./EditScoreDialog";
import { FirmCommentsTabs } from "./FirmCommentsTabs";
import { OverallApplicantBarChart } from "./OverallApplicantBarChart";
import { ReviewerScoreHeatmap } from "./ReviewerScoreHeatmap";
import { buildRankedRows, type RankedRow } from "./rankedRows";

/** Past this many firms the ranked rows tighten to one line each. */
const COMPACT_ROWS_MIN_FIRMS = 6;

function SummaryTiles({ rows }: { rows: RankedRow[] }) {
  const divergentCount = rows.filter(
    (r) => r.overallRank !== r.applicantRank || r.overallRank !== r.wfrcRank,
  ).length;
  return (
    <div className="dash-tiles">
      <div className="dash-tile">
        <span className="dash-tile-value">{rows.length}</span>
        <span className="dash-tile-label">Firms Submitted</span>
      </div>
      <div className="dash-tile">
        <span className="dash-tile-value">{divergentCount}</span>
        <span className="dash-tile-label">
          {divergentCount === 1 ? "Firm Ranks Differently" : "Firms Rank Differently"}
        </span>
      </div>
    </div>
  );
}

function LeadingFirm({ rows }: { rows: RankedRow[] }) {
  const topRank = rows[0].overallRank;
  const leaders = rows.filter((r) => r.overallRank === topRank);
  const runnerUp = rows.find((r) => r.overallRank !== topRank);
  const gap = runnerUp ? round2(leaders[0].overallTotal - runnerUp.overallTotal) : null;
  return (
    <div className="dash-leading">
      <div className="dash-leading-text">
        <span className="dash-tile-label">{leaders.length > 1 ? "Leading (tied)" : "Leading Firm"}</span>
        <span className="dash-leading-name" title={leaders.map((r) => r.firm.name).join(", ")}>
          {leaders.map((r) => r.firm.name).join(", ")}
        </span>
        {runnerUp && gap !== null && leaders.length === 1 && (
          <span className="dash-leading-gap">
            {gap} ahead of {runnerUp.firm.name}
          </span>
        )}
      </div>
      <div className="dash-leading-score">
        <span className="dash-leading-total">{round2(leaders[0].overallTotal)}</span>
        <span className="dash-tile-label">Overall</span>
      </div>
    </div>
  );
}

function RankedFirmsList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: RankedRow[];
  selectedId: string;
  onSelect: (firmId: string) => void;
}) {
  const compact = rows.length >= COMPACT_ROWS_MIN_FIRMS;
  const topRank = rows[0].overallRank;
  return (
    <section className="card dash-ranked" aria-label="Ranked firms section">
      <div className="dash-card-head">
        <h2>Ranked Firms</h2>
        <span className="dash-card-hint">Select a firm to see its detail</span>
      </div>
      <div className="dash-ranked-cols" aria-hidden="true">
        <span />
        <span>Firm</span>
        <span>Overall</span>
        <span title="TLC Applicant weighted total">TLC</span>
        <span title="WFRC weighted total">WFRC</span>
      </div>
      <div
        className={`dash-ranked-rows${compact ? " is-compact" : ""}`}
        role="listbox"
        aria-label="Ranked firms"
      >
        {rows.map((row) => {
          const incomplete = row.comp.scored < row.comp.expected;
          const pct = row.comp.expected > 0 ? Math.round((row.comp.scored / row.comp.expected) * 100) : 0;
          const label = `${row.comp.scored}/${row.comp.expected} scored`;
          return (
            <button
              key={row.firm.id}
              type="button"
              role="option"
              aria-selected={row.firm.id === selectedId}
              className="dash-ranked-row"
              onClick={() => onSelect(row.firm.id)}
            >
              <Badge variant={row.overallRank === topRank ? "info" : "neutral"}>{row.overallRank}</Badge>
              <span className="dash-ranked-name">
                <span className="dash-ranked-firm">{row.firm.name}</span>
                {compact ? (
                  incomplete && <span className="dash-ranked-partial">{label}</span>
                ) : (
                  <span className={`dash-ranked-progress${incomplete ? " is-partial" : ""}`}>
                    <span className="dash-ranked-progress-track" aria-hidden="true">
                      <span className="dash-ranked-progress-fill" style={{ width: `${pct}%` }} />
                    </span>
                    {label}
                  </span>
                )}
              </span>
              <span className="dash-ranked-num is-main">{round2(row.overallTotal)}</span>
              <span className="dash-ranked-num">{round2(row.applicantTotal)}</span>
              <span className="dash-ranked-num">{round2(row.wfrcTotal)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type PanelTab = "breakdown" | "comments" | "reviewers";

function FirmBreakdown({ project, row }: { project: Project; row: RankedRow }) {
  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = Math.min(...scaleValues);
  const scaleMax = Math.max(...scaleValues);
  const span = scaleMax - scaleMin;

  const criteria = project.criteria.map((criterion) => ({
    criterion,
    overall: overallAvg(project, row.firm.id, criterion.id),
    applicant: applicantAvg(project, row.firm.id, criterion.id),
    wfrc: wfrcAvg(project, row.firm.id, criterion.id),
  }));
  const barWidth = (v: number) => (span > 0 ? Math.max(0, Math.min(100, ((v - scaleMin) / span) * 100)) : 0);
  const show = (v: number | null) => (v === null ? "—" : round2(v));

  const scored = criteria.filter((c) => c.overall !== null) as ((typeof criteria)[number] & {
    overall: number;
  })[];
  const strongest = scored.length > 0 ? scored.reduce((a, b) => (b.overall > a.overall ? b : a)) : null;
  const weakest = scored.length > 0 ? scored.reduce((a, b) => (b.overall < a.overall ? b : a)) : null;
  const gaps = criteria.flatMap((c) =>
    c.applicant !== null && c.wfrc !== null ? [{ ...c, gap: c.applicant - c.wfrc }] : [],
  );
  const biggestGap = gaps.length > 0 ? gaps.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a)) : null;

  return (
    <div className="dash-breakdown">
      <div className="dash-breakdown-top">
        <div className="dash-radar">
          <CriterionBreakdownChart project={project} firmId={row.firm.id} fill />
        </div>
        <div className="table-wrap">
          <table className="data-table dash-breakdown-table">
            <thead>
              <tr>
                <th scope="col">Criterion</th>
                <th scope="col">Overall score</th>
                <th scope="col" className="dash-num">Applicants</th>
                <th scope="col" className="dash-num">WFRC</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map(({ criterion, overall, applicant, wfrc }) => (
                <tr key={criterion.id}>
                  <td>
                    <span className="dash-criterion-name">{criterion.name}</span>
                    <span className="dash-criterion-weight">{round2(criterion.weight * 100)}% of total</span>
                  </td>
                  <td>
                    <span className="dash-scorebar">
                      <span className="dash-scorebar-track" aria-hidden="true">
                        <span
                          className="dash-scorebar-fill"
                          style={{ width: `${overall === null ? 0 : barWidth(overall)}%` }}
                        />
                      </span>
                      <strong>{show(overall)}</strong>
                    </span>
                  </td>
                  <td className="dash-num">{show(applicant)}</td>
                  <td className="dash-num">{show(wfrc)}</td>
                </tr>
              ))}
              <tr className="dash-total-row">
                <td>
                  <strong>Weighted total</strong>
                </td>
                <td>
                  <span className="dash-scorebar">
                    <span className="dash-scorebar-track" aria-hidden="true">
                      <span className="dash-scorebar-fill" style={{ width: `${barWidth(row.overallTotal)}%` }} />
                    </span>
                    <strong>{round2(row.overallTotal)}</strong>
                  </span>
                </td>
                <td className="dash-num">
                  <strong>{round2(row.applicantTotal)}</strong>
                </td>
                <td className="dash-num">
                  <strong>{round2(row.wfrcTotal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {strongest && weakest && (
        <div className="dash-insights">
          <div className="dash-insight">
            <span className="dash-tile-label">Strongest criterion</span>
            <strong>{strongest.criterion.name}</strong>
            <span>{round2(strongest.overall)} overall</span>
          </div>
          <div className="dash-insight">
            <span className="dash-tile-label">Weakest criterion</span>
            <strong>{weakest.criterion.name}</strong>
            <span>{round2(weakest.overall)} overall</span>
          </div>
          {biggestGap && (
            <div className="dash-insight">
              <span className="dash-tile-label">Biggest applicant and WFRC gap</span>
              <strong>{biggestGap.criterion.name}</strong>
              <span>
                {biggestGap.gap > 0 ? "Applicants" : "WFRC"} scored it {round2(Math.abs(biggestGap.gap))}{" "}
                higher
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FirmDetailPanel({
  project,
  row,
  onEdit,
  tab,
  setTab,
  criterionId,
  setCriterionId,
}: {
  project: Project;
  row: RankedRow;
  onEdit: (target: ScoreTarget) => void;
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;
  criterionId: string | null;
  setCriterionId: (id: string | null) => void;
}) {
  const idPrefix = `firm-${row.firm.id}-detail`;
  const panelId = `${idPrefix}-panel`;

  const commentCount = project.scores.filter(
    (s) => s.firmId === row.firm.id && s.comment.trim() !== "",
  ).length;

  return (
    <section className="card dash-detail" aria-label={`${row.firm.name} detail`}>
      <div className="dash-detail-head">
        <div className="dash-detail-title">
          <Badge variant={row.overallRank === 1 ? "info" : "neutral"}>{row.overallRank}</Badge>
          <h2>{row.firm.name}</h2>
          <span className="dash-detail-progress">
            {row.comp.scored} of {row.comp.expected} scores in
          </span>
        </div>
        <div className="dash-detail-totals">
          <div className="dash-total is-overall">
            <strong>{round2(row.overallTotal)}</strong>
            <span>Overall</span>
          </div>
          <div className="dash-total is-applicant">
            <strong>{round2(row.applicantTotal)}</strong>
            <span>TLC Applicant</span>
          </div>
          <div className="dash-total is-wfrc">
            <strong>{round2(row.wfrcTotal)}</strong>
            <span>WFRC</span>
          </div>
        </div>
      </div>

      <ScrollableTabs
        tabs={[
          { id: "breakdown", label: "Criterion breakdown" },
          { id: "comments", label: "Comments", badge: commentCount },
          { id: "reviewers", label: "Reviewer scores" },
        ]}
        activeId={tab}
        onSelect={(id) => setTab(id as PanelTab)}
        ariaLabel="Firm detail"
        idPrefix={idPrefix}
        panelId={panelId}
      />

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={scrollableTabId(idPrefix, tab)}
        className="dash-detail-body"
      >
        {tab === "breakdown" && <FirmBreakdown project={project} row={row} />}
        {tab === "comments" && (
          <FirmCommentsTabs
            project={project}
            firmId={row.firm.id}
            onEdit={onEdit}
            criterionId={criterionId}
            onCriterionChange={(id) => setCriterionId(id)}
            hideHeading
          />
        )}
        {tab === "reviewers" && (
          <ReviewerScoreHeatmap
            project={project}
            firmId={row.firm.id}
            onSelectCriterion={(id) => {
              setCriterionId(id);
              setTab("comments");
            }}
          />
        )}
      </div>
    </section>
  );
}

export function DashboardWorkspace({ project }: { project: Project }) {
  const rows = buildRankedRows(project); // canonical ascending overall-rank order
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ScoreTarget | null>(null);
  // Kept here (not inside the panel) so the open tab and criterion carry over when another firm
  // is picked — comparing firms usually means looking at the same view of each.
  const [tab, setTab] = useState<PanelTab>("breakdown");
  const [criterionId, setCriterionId] = useState<string | null>(null);
  const barChartContainerRef = useRef<HTMLDivElement>(null);
  const { backgroundColor, foregroundColor, overallColor, applicantColor, wfrcColor } = useChartColors();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message="No submitted firms yet."
        hint="Ranked results appear here once at least one firm has been marked submitted and has reviewer scores recorded."
      />
    );
  }

  // Falls back to the top-ranked firm if the selected one was since un-submitted or removed.
  const selected = rows.find((r) => r.firm.id === selectedId) ?? rows[0];

  return (
    <div className="dash-workspace no-print">
      <div className="dash-side">
        <SummaryTiles rows={rows} />
        <LeadingFirm rows={rows} />
        <RankedFirmsList rows={rows} selectedId={selected.firm.id} onSelect={setSelectedId} />
        <section className="card dash-chart-card" aria-label="Weighted totals chart section">
          <div className="dash-card-head">
            <h2>Overall vs. TLC Applicant vs. WFRC</h2>
            <ChartExportButtons
              getSvg={() => barChartContainerRef.current?.querySelector("svg") ?? null}
              projectName={project.project.projectName}
              chartLabel="Overall vs TLC Applicant vs WFRC Weighted Totals"
              backgroundColor={backgroundColor}
              foregroundColor={foregroundColor}
              legendItems={[
                { label: "Overall", color: overallColor },
                { label: "TLC Applicant", color: applicantColor },
                { label: "WFRC", color: wfrcColor },
              ]}
            />
          </div>
          <div className="dash-chart-box">
            <OverallApplicantBarChart
              project={project}
              containerRef={barChartContainerRef}
              compact
              selectedFirmId={selected.firm.id}
              onSelectFirm={setSelectedId}
            />
          </div>
        </section>
      </div>

      <FirmDetailPanel
        project={project}
        row={selected}
        onEdit={setEditTarget}
        tab={tab}
        setTab={setTab}
        criterionId={criterionId}
        setCriterionId={setCriterionId}
      />

      {editTarget && <EditScoreDialog target={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
