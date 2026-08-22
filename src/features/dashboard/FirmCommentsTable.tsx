// Reviewer comments for one firm, grouped by criterion (extracted out of the old bottom-of-
// page "Per-Firm Detail & Comments" accordion during the 003 Dashboard redesign — it now
// renders inside that firm's own expanded row in RankedFirmsTable instead of a separate,
// disconnected section a viewer had to scroll down and re-find the firm in).

import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { MessageSquare } from "lucide-react";
import type { Project } from "../../types/project";

export function FirmCommentsTable({ project, firmId }: { project: Project; firmId: string }) {
  // criteria is the outer loop, so consecutive entries already share a criterion — no
  // separate sort/group-by step needed — letting the table below render each criterion
  // name once, spanning its reviewer rows, instead of repeating "Criterion (Reviewer):
  // Comment" as prose on every line.
  const groups = project.criteria
    .map((criterion) => ({
      criterion: criterion.name,
      items: project.scores
        .filter(
          (s) => s.firmId === firmId && s.criterionId === criterion.id && s.comment.trim() !== "",
        )
        .map((s) => ({
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
                <tr key={`${gi}-${ii}`}>
                  {ii === 0 && (
                    <td rowSpan={group.items.length} className="comments-criterion-cell">
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
    </div>
  );
}
