// Reviewer comments for one firm, grouped by criterion (extracted out of the old bottom-of-
// page "Per-Firm Detail & Comments" accordion during the 003 Dashboard redesign — it now
// renders inside that firm's own expanded row in RankedFirmsTable instead of a separate,
// disconnected section a viewer had to scroll down and re-find the firm in).

import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { MessageSquare, Pencil } from "lucide-react";
import type { Project } from "../../types/project";
import type { ScoreTarget } from "./EditScoreDialog";

/** `onEdit` adds a pencil on every row that opens the score/comment editor for exactly that
 * reviewer + criterion; it floats into the comment cell's top-right corner and only shows on
 * row hover / keyboard focus (app.css), so it takes no column of its own. It is passed only by the on-screen
 * table — the print copy omits it, so the edit controls never appear on the exported PDF. */
export function FirmCommentsTable({
  project,
  firmId,
  onEdit,
}: {
  project: Project;
  firmId: string;
  onEdit?: (target: ScoreTarget) => void;
}) {
  // criteria is the outer loop, so consecutive entries already share a criterion — no
  // separate sort/group-by step needed — letting the table below render each criterion
  // name once, spanning its reviewer rows, instead of repeating "Criterion (Reviewer):
  // Comment" as prose on every line.
  const groups = project.criteria
    .map((criterion) => ({
      criterion: criterion.name,
      criterionId: criterion.id,
      items: project.scores
        .filter(
          (s) => s.firmId === firmId && s.criterionId === criterion.id && s.comment.trim() !== "",
        )
        .map((s) => ({
          reviewerId: s.reviewerId,
          reviewer: project.reviewers.find((r) => r.id === s.reviewerId)?.name ?? "Unknown reviewer",
          comment: s.comment,
        })),
    }))
    .filter((group) => group.items.length > 0);
  const commentCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (groups.length === 0) {
    return (
      <EmptyState icon={MessageSquare} message="No comments recorded for this firm yet." />
    );
  }

  return (
    <div className="firm-comments">
      <h4 className="firm-comments-heading">
        Comments <Badge variant="neutral">{commentCount}</Badge>
      </h4>
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
                <tr key={`${gi}-${ii}`} className={ii === 0 ? "comments-group-start" : undefined}>
                  {ii === 0 && (
                    <td rowSpan={group.items.length} className="comments-criterion-cell">
                      {group.criterion}
                    </td>
                  )}
                  <td>{item.reviewer}</td>
                  <td className="comments-comment-cell">
                    {/* First, so it floats into the cell's top-right corner and the comment
                        text wraps around it. */}
                    {onEdit && (
                      <button
                        type="button"
                        className="button-link icon-button comments-edit-button no-print"
                        aria-label={`Edit score and comment: ${item.reviewer}, ${group.criterion}`}
                        title="Edit score and comment"
                        onClick={() =>
                          onEdit({ reviewerId: item.reviewerId, firmId, criterionId: group.criterionId })
                        }
                      >
                        <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                    {item.comment}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
