// T027: Criteria & weights editor — add/edit/remove (name, weight, description), a
// running weight-total display with a non-blocking warning when it isn't 1.0 ± 0.001
// (FR-009, FR-010, clarified non-blocking), and a confirmation prompt before removing a
// criterion with existing scores (FR-039).

import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { generateId } from "../../lib/id";
import { useLoadedProject } from "../../state/ProjectContext";
import { criterionHasScores } from "../../state/projectReducer";

const WEIGHT_TOLERANCE = 0.001;

export function CriteriaEditor() {
  const { project, dispatch } = useLoadedProject();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const weightTotal = project.criteria.reduce((sum, c) => sum + c.weight, 0);
  // Weights only need to sum to 1.0 once at least one criterion exists — an empty list
  // isn't a "0.0 doesn't sum to 1.0" warning state, it's just "nothing added yet."
  const weightsInvalid =
    project.criteria.length > 0 && Math.abs(weightTotal - 1) > WEIGHT_TOLERANCE;

  function requestRemove(criterionId: string) {
    if (criterionHasScores(project, criterionId)) {
      setPendingRemoval(criterionId);
    } else {
      dispatch({ type: "REMOVE_CRITERION", criterionId });
    }
  }

  const pendingCriterion = project.criteria.find((c) => c.id === pendingRemoval);

  return (
    <div className="card">
      <h2>Criteria &amp; Weights</h2>

      <div
        className={`banner ${weightsInvalid ? "banner-warning" : ""}`}
        role={weightsInvalid ? "alert" : undefined}
      >
        Running total: <strong>{weightTotal.toFixed(3)}</strong>
        {weightsInvalid && (
          <> — weights must sum to 1.0 (this does not block saving or generating forms).</>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Weight</th>
              <th>Description</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.criteria.map((criterion) => (
              <tr key={criterion.id}>
                <td>
                  <input
                    type="text"
                    aria-label="Criterion name"
                    value={criterion.name}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_CRITERION",
                        criterionId: criterion.id,
                        patch: { name: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    aria-label="Criterion weight (fraction of 1.0)"
                    step={0.01}
                    min={0}
                    max={1}
                    value={criterion.weight}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_CRITERION",
                        criterionId: criterion.id,
                        patch: { weight: Number(e.target.value) },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    aria-label="Criterion description"
                    value={criterion.description}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_CRITERION",
                        criterionId: criterion.id,
                        patch: { description: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => requestRemove(criterion.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {project.criteria.length === 0 && (
              <tr>
                <td colSpan={4} className="field-hint">
                  No criteria yet — add one below.
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
              type: "ADD_CRITERION",
              criterion: { id: generateId("crit"), name: "", weight: 0, description: "" },
            })
          }
        >
          Add criterion
        </button>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove criterion with recorded scores?"
        message={
          <>
            "{pendingCriterion?.name || "This criterion"}" has scores recorded against it. Removing
            it will keep those score entries in the file, but they will no longer count toward any
            total or ranking.
          </>
        }
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) dispatch({ type: "REMOVE_CRITERION", criterionId: pendingRemoval });
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
