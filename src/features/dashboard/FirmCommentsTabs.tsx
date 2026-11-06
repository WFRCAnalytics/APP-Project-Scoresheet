// On-screen reviewer comments for one firm, one tab per criterion — shown inside that firm's
// expanded row in RankedFirmsTable. The old single table listed every criterion's comments
// one after another, which got long with several criteria and reviewers; tabs show one
// criterion's reviewers at a time.
//
// Every reviewer who SCORED the criterion gets a row (score + comment), not just the ones who
// wrote a comment, so a comment can be added later: a row with a comment has a hover pencil,
// a row without one has a visible "Add comment" button. Both open EditScoreDialog for exactly
// that reviewer + criterion. Reviewers who haven't scored it aren't listed — entering a first
// score is Manual Entry's job (Show calculations -> Manual Entry), not this table's.
//
// This is the interactive twin of FirmCommentsTable, which stays the flat all-criteria table
// the printed/PDF report uses (tabs can't print, and the report should list every comment).

import { MessageSquare, MessageSquarePlus, Pencil } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import type { Project } from "../../types/project";
import type { ScoreTarget } from "./EditScoreDialog";

export function FirmCommentsTabs({
  project,
  firmId,
  onEdit,
}: {
  project: Project;
  firmId: string;
  onEdit: (target: ScoreTarget) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tabs = project.criteria.map((criterion) => {
    const rows = project.reviewers.flatMap((reviewer) => {
      const score = project.scores.find(
        (s) =>
          s.firmId === firmId && s.criterionId === criterion.id && s.reviewerId === reviewer.id,
      );
      return score ? [{ reviewer, score }] : [];
    });
    const commentCount = rows.filter((r) => r.score.comment.trim() !== "").length;
    return { criterion, rows, commentCount };
  });

  if (tabs.every((t) => t.rows.length === 0)) {
    return <EmptyState icon={MessageSquare} message="No scores recorded for this firm yet." />;
  }

  // Falls back to the first tab if the selected criterion was since removed.
  const active = tabs.find((t) => t.criterion.id === selectedId) ?? tabs[0];
  const totalComments = tabs.reduce((sum, t) => sum + t.commentCount, 0);
  const tabId = (criterionId: string) => `firm-${firmId}-comments-tab-${criterionId}`;
  const panelId = `firm-${firmId}-comments-panel`;

  return (
    <div className="firm-comments">
      <h4 className="firm-comments-heading">
        Comments <Badge variant="neutral">{totalComments}</Badge>
      </h4>

      <div role="tablist" aria-label="Comments by criterion" className="calc-tabs comments-tabs">
        {tabs.map(({ criterion, commentCount }) => (
          <button
            key={criterion.id}
            id={tabId(criterion.id)}
            type="button"
            role="tab"
            aria-selected={active.criterion.id === criterion.id}
            aria-controls={panelId}
            className={`calc-tab${active.criterion.id === criterion.id ? " is-active" : ""}`}
            onClick={() => setSelectedId(criterion.id)}
          >
            {criterion.name}
            {commentCount > 0 && (
              <>
                {" "}
                <Badge variant="neutral">{commentCount}</Badge>
              </>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(active.criterion.id)}>
        {active.rows.length === 0 ? (
          <EmptyState icon={MessageSquare} message="No scores recorded for this criterion yet." />
        ) : (
          <div className="table-wrap">
            <table className="data-table comments-tab-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Score</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {active.rows.map(({ reviewer, score }) => {
                  const reviewerName = reviewer.name || "Unnamed reviewer";
                  const target = {
                    reviewerId: reviewer.id,
                    firmId,
                    criterionId: active.criterion.id,
                  };
                  const hasComment = score.comment.trim() !== "";
                  return (
                    <tr key={reviewer.id}>
                      <td>{reviewerName}</td>
                      <td>{score.value}</td>
                      <td className="comments-comment-cell">
                        {hasComment ? (
                          <>
                            {/* First, so it floats into the cell's top-right corner and the
                                comment text wraps around it (see .comments-edit-button). */}
                            <button
                              type="button"
                              className="button-link icon-button comments-edit-button no-print"
                              aria-label={`Edit score and comment: ${reviewerName}, ${active.criterion.name}`}
                              title="Edit score and comment"
                              onClick={() => onEdit(target)}
                            >
                              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                            {score.comment}
                          </>
                        ) : (
                          <span className="comments-empty">
                            No comment
                            <button
                              type="button"
                              className="button-link comments-add-button no-print"
                              aria-label={`Add comment: ${reviewerName}, ${active.criterion.name}`}
                              onClick={() => onEdit(target)}
                            >
                              <MessageSquarePlus size={14} strokeWidth={1.75} aria-hidden="true" />
                              Add comment
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
