// T027: Criteria & weights editor — add/edit/remove (name, weight, description), a
// running weight-total display with a non-blocking warning when it isn't 1.0 ± 0.001
// (FR-009, FR-010, clarified non-blocking), and a confirmation prompt before removing a
// criterion with existing scores (FR-039).
//
// Weight input accepts a decimal fraction (0.25) or a percent (25 / 25%) in the same field
// — see lib/weightInput.ts for the parsing rule and the research behind it. The stored
// Criterion.weight is unaffected either way — still a plain 0..1 fraction — this only
// widens what the handler is allowed to type before it gets parsed into that number.

import { type Dispatch, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { generateId } from "../../lib/id";
import { formatWeightPercent, parseWeightInput } from "../../lib/weightInput";
import { useLoadedProject } from "../../state/ProjectContext";
import { criterionHasScores } from "../../state/projectReducer";
import type { ProjectAction } from "../../state/projectReducer";
import type { Criterion } from "../../types/project";

const WEIGHT_TOLERANCE = 0.001;

/** One criterion's weight cell. Needs its own draft state — not just `criterion.weight`
 * reflected straight into the input — so a handler can type transitional text ("0.", "25%")
 * without every keystroke re-formatting the field out from under them. The draft commits
 * (parses + dispatches) or reverts (unparseable text discarded) on blur, the same point a
 * spreadsheet settles a percent-formatted cell's typed text into its stored value. */
function WeightCell({
  criterion,
  dispatch,
}: {
  criterion: Criterion;
  dispatch: Dispatch<ProjectAction>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(criterion.weight);
  // Live percent preview reflects the DRAFT while typing (falling back to the last-committed
  // weight if the draft doesn't parse yet, e.g. mid-keystroke on "0.") so the "= X%" readout
  // updates as the handler types, not just after they tab away.
  const previewWeight = draft === null ? criterion.weight : (parseWeightInput(draft) ?? criterion.weight);

  function commit() {
    if (draft === null) return;
    const parsed = parseWeightInput(draft);
    if (parsed !== null) {
      dispatch({ type: "UPDATE_CRITERION", criterionId: criterion.id, patch: { weight: parsed } });
    }
    setDraft(null); // snap back to canonical display either way — the just-parsed value on
    // success, the unchanged prior value (invalid text silently discarded) on failure
  }

  return (
    <div className="weight-cell">
      <input
        type="text"
        inputMode="decimal"
        aria-label="Criterion weight — decimal fraction of 1.0, or a percent (e.g. 0.25 or 25%)"
        value={displayValue}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      <span className="field-hint weight-cell-hint">= {formatWeightPercent(previewWeight)}</span>
    </div>
  );
}

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
        Running total: <strong>{weightTotal.toFixed(3)}</strong> (
        {formatWeightPercent(weightTotal)})
        {weightsInvalid && (
          <>
            {" "}
            — weights must sum to 1.0 (100%) (this does not block saving or generating forms).
          </>
        )}
      </div>

      <p className="field-hint">
        Enter weight as a decimal fraction of 1.0 (e.g. 0.25) or a percent (e.g. 25 or 25%) —
        both are accepted.
      </p>

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
                  <WeightCell criterion={criterion} dispatch={dispatch} />
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
