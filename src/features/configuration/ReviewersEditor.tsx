// T026: Reviewers editor — add/edit/remove, name + explicit type ("applicant"|"wfrc") +
// optional email, and a confirmation prompt before removing a reviewer with existing
// scores (FR-008, FR-041) — mirrors FirmsEditor's (FR-007) and CriteriaEditor's (FR-039)
// confirm-then-orphan pattern exactly, on purpose: all three follow the same rule.

import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { SelectField } from "../../components/SelectField";
import { findDuplicateNames } from "../../lib/duplicateNames";
import { generateId } from "../../lib/id";
import { useLoadedProject } from "../../state/ProjectContext";
import { reviewerHasScores } from "../../state/projectReducer";
import type { ReviewerType } from "../../types/project";

export function ReviewersEditor() {
  const { project, dispatch } = useLoadedProject();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  // Non-blocking, same convention as CriteriaEditor's weight-total banner and
  // FirmsEditor's identical duplicate check — see FirmsEditor for the full rationale.
  const duplicateReviewerNames = findDuplicateNames(project.reviewers.map((r) => r.name));

  function requestRemove(reviewerId: string) {
    if (reviewerHasScores(project, reviewerId)) {
      setPendingRemoval(reviewerId);
    } else {
      dispatch({ type: "REMOVE_REVIEWER", reviewerId });
    }
  }

  const pendingReviewer = project.reviewers.find((r) => r.id === pendingRemoval);

  return (
    <div className="card">
      <h2>Reviewers</h2>

      {duplicateReviewerNames.size > 0 && (
        <div className="banner banner-warning" role="alert">
          Duplicate name{duplicateReviewerNames.size > 1 ? "s" : ""}:{" "}
          {[...duplicateReviewerNames.entries()]
            .map(([name, count]) => `"${name}" is used by ${count} reviewers`)
            .join("; ")}{" "}
          — rename so results stay unambiguous on the Dashboard and in exports (this does not
          block saving or generating forms).
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Email</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.reviewers.map((reviewer) => (
              <tr key={reviewer.id}>
                <td>
                  <input
                    type="text"
                    aria-label="Reviewer name"
                    value={reviewer.name}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REVIEWER",
                        reviewerId: reviewer.id,
                        patch: { name: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <SelectField
                    aria-label="Reviewer type"
                    value={reviewer.type}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REVIEWER",
                        reviewerId: reviewer.id,
                        patch: { type: e.target.value as ReviewerType },
                      })
                    }
                  >
                    <option value="applicant">TLC Applicant</option>
                    <option value="wfrc">WFRC</option>
                  </SelectField>
                </td>
                <td>
                  <input
                    type="email"
                    aria-label="Reviewer email"
                    value={reviewer.email}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_REVIEWER",
                        reviewerId: reviewer.id,
                        patch: { email: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => requestRemove(reviewer.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {project.reviewers.length === 0 && (
              <tr>
                <td colSpan={4} className="field-hint">
                  No reviewers yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() =>
            dispatch({
              type: "ADD_REVIEWER",
              reviewer: { id: generateId("rev"), name: "", type: "applicant", email: "" },
            })
          }
        >
          Add reviewer
        </button>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove reviewer with recorded scores?"
        message={
          <>
            "{pendingReviewer?.name || "This reviewer"}" has scores recorded. Removing them will
            keep those score entries in the file, but they will no longer count toward any total or
            ranking.
          </>
        }
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) dispatch({ type: "REMOVE_REVIEWER", reviewerId: pendingRemoval });
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
