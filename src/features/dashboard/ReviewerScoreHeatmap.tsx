// The Dashboard's "Reviewer scores" view for one firm: reviewers down the side, criteria across
// the top, every score a cell colored on the same red -> yellow -> green scale as the
// Calculations heatmap (theme/heatmapColor.ts, anchored to the configured scoring scale — never
// to the scores seen so far). Replaces the old per-criterion dot chart, which could only show
// one criterion's spread at a time and got cramped with many reviewers.
//
// Reviewers are grouped by type (TLC Applicant, WFRC), each group headed by its own per-
// criterion average, and the table ends with the all-reviewer average and range. "Their total"
// is that reviewer's own weighted total for the firm. Clicking a cell opens the firm's Comments
// for that criterion — where the score and comment can be edited.
//
// On-screen only. The printed/PDF report keeps ReviewerScoreSpreadChartPrintCopy.

import { Fragment } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { overallAvg, round2 } from "../../lib/calculations";
import { heatmapBackgroundFor, heatmapTextColorFor, HEATMAP_GREEN_HEX, HEATMAP_RED_HEX, HEATMAP_YELLOW_HEX } from "../../theme/heatmapColor";
import type { Project, Reviewer } from "../../types/project";

const GROUPS: { type: Reviewer["type"]; label: string }[] = [
  { type: "applicant", label: "TLC Applicant reviewers" },
  { type: "wfrc", label: "WFRC reviewers" },
];

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function fmt(value: number | null): string {
  return value === null ? "—" : String(round2(value));
}

export function ReviewerScoreHeatmap({
  project,
  firmId,
  onSelectCriterion,
}: {
  project: Project;
  firmId: string;
  onSelectCriterion: (criterionId: string) => void;
}) {
  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = Math.min(...scaleValues);
  const scaleMax = Math.max(...scaleValues);

  const scoreOf = (reviewerId: string, criterionId: string): number | null =>
    project.scores.find(
      (s) => s.firmId === firmId && s.reviewerId === reviewerId && s.criterionId === criterionId,
    )?.value ?? null;

  // Only reviewers who scored this firm at all — a reviewer who hasn't started would be a row
  // of empty cells that says nothing about the firm.
  const reviewers = project.reviewers.filter((r) =>
    project.criteria.some((c) => scoreOf(r.id, c.id) !== null),
  );

  if (project.criteria.length === 0 || scaleValues.length === 0) {
    return <EmptyState icon={Users} message="No criteria or scoring scale configured yet." />;
  }
  if (reviewers.length === 0) {
    return <EmptyState icon={Users} message="No scores recorded for this firm yet." />;
  }

  /** One reviewer's own weighted total across the criteria they scored. */
  const totalFor = (reviewerId: string): number | null => {
    let weighted = 0;
    let weights = 0;
    for (const c of project.criteria) {
      const v = scoreOf(reviewerId, c.id);
      if (v !== null) {
        weighted += v * c.weight;
        weights += c.weight;
      }
    }
    return weights > 0 ? weighted / weights : null;
  };

  const groupAvg = (group: Reviewer[], criterionId: string) =>
    mean(group.flatMap((r) => { const v = scoreOf(r.id, criterionId); return v === null ? [] : [v]; }));

  return (
    <div className="reviewer-heatmap">
      <table className="data-table reviewer-heatmap-table">
        <thead>
          <tr>
            <th scope="col">Reviewer</th>
            {project.criteria.map((c) => (
              <th scope="col" key={c.id} className="reviewer-heatmap-col" title={c.name}>
                <span className="reviewer-heatmap-col-name">{c.name}</span>
                <span className="reviewer-heatmap-col-weight">{round2(c.weight * 100)}%</span>
              </th>
            ))}
            <th scope="col" className="reviewer-heatmap-col">
              <span className="reviewer-heatmap-col-name">Their total</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {GROUPS.map(({ type, label }) => {
            const group = reviewers.filter((r) => r.type === type);
            if (group.length === 0) return null;
            return (
              <Fragment key={type}>
                <tr className="reviewer-heatmap-group">
                  <th scope="row">
                    {label} <span className="reviewer-heatmap-count">{group.length}</span>
                  </th>
                  {project.criteria.map((c) => (
                    <td key={c.id}>{fmt(groupAvg(group, c.id))}</td>
                  ))}
                  <td>{fmt(mean(group.flatMap((r) => { const t = totalFor(r.id); return t === null ? [] : [t]; })))}</td>
                </tr>
                {group.map((reviewer) => (
                  <tr key={reviewer.id}>
                    <th scope="row" className="reviewer-heatmap-name">
                      {reviewer.name || "Unnamed reviewer"}
                    </th>
                    {project.criteria.map((criterion) => {
                      const value = scoreOf(reviewer.id, criterion.id);
                      if (value === null) {
                        return (
                          <td key={criterion.id} className="heatmap-td">
                            <div className="heatmap-cell heatmap-cell-empty" title="Not yet scored">
                              —
                            </div>
                          </td>
                        );
                      }
                      const background = heatmapBackgroundFor(value, scaleMin, scaleMax);
                      return (
                        <td key={criterion.id} className="heatmap-td">
                          <button
                            type="button"
                            className="heatmap-cell heatmap-cell-button"
                            style={{ backgroundColor: background, color: heatmapTextColorFor(background) }}
                            aria-label={`${reviewer.name || "Unnamed reviewer"}, ${criterion.name}: ${value}. Show comments`}
                            onClick={() => onSelectCriterion(criterion.id)}
                          >
                            {value}
                          </button>
                        </td>
                      );
                    })}
                    <td className="reviewer-heatmap-total">{fmt(totalFor(reviewer.id))}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="reviewer-heatmap-foot">
            <th scope="row">All reviewers</th>
            {project.criteria.map((c) => (
              <td key={c.id}>{fmt(overallAvg(project, firmId, c.id))}</td>
            ))}
            <td>{fmt(mean(reviewers.flatMap((r) => { const t = totalFor(r.id); return t === null ? [] : [t]; })))}</td>
          </tr>
          <tr className="reviewer-heatmap-range">
            <th scope="row">Range</th>
            {project.criteria.map((c) => {
              const values = reviewers.flatMap((r) => { const v = scoreOf(r.id, c.id); return v === null ? [] : [v]; });
              return (
                <td key={c.id}>
                  {values.length > 0 ? `${Math.min(...values)} to ${Math.max(...values)}` : "—"}
                </td>
              );
            })}
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="heatmap-legend reviewer-heatmap-legend">
        <span className="heatmap-legend-label">{scaleMin} (lowest)</span>
        <div
          className="heatmap-legend-gradient"
          style={{
            background: `linear-gradient(to right, ${HEATMAP_RED_HEX}, ${HEATMAP_YELLOW_HEX}, ${HEATMAP_GREEN_HEX})`,
          }}
        />
        <span className="heatmap-legend-label">{scaleMax} (highest)</span>
      </div>
    </div>
  );
}
