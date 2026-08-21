// T028: Scoring scale editor — add/edit/remove scale points (value + label), enforcing a
// minimum of 2 points (FR-011). Unlike the weight-sum warning (non-blocking, FR-010),
// the 2-point minimum is a hard floor — a 1-point scale can't meaningfully score
// anything — so removal is disabled rather than merely warned about once only 2 remain.
//
// Bug fix: this used to render `[...project.scoringScale].sort((a, b) => a.value -
// b.value)` and key each row `key={point.value}`. `ScoringScalePoint` has no `id`
// (data-model.md: matched by `value` on purpose — that's also the project.json shape,
// contracts/project-file.md), so `value` looked like the only candidate key. But `value`
// is exactly the field the Score input edits — changing it both (a) changed the row's
// React key, making React unmount/remount the row instead of updating it in place, and
// (b) changed its position in the live-resorted list, so the "new" element appeared to
// jump elsewhere. Together this read as "editing adds a new row." It could also cross-wire
// click handlers via a transient duplicate-value collision mid-edit, which is what made
// Remove appear to silently fail on an unrelated row.
//
// Fix: don't resort on every render — render project.scoringScale in its stored
// (insertion) order, same as FirmsEditor/ReviewersEditor/CriteriaEditor render their
// lists. Key by array index against that stable order: UPDATE_SCALE_POINT uses `.map()`
// (preserves position for every entry except the one being edited, which keeps its
// index), so index is a valid stable identity here — the same role `id` plays in the
// other three editors, just without persisting one to the data model.

import { useLoadedProject } from "../../state/ProjectContext";

const MIN_SCALE_POINTS = 2;

export function ScoringScaleEditor() {
  const { project, dispatch } = useLoadedProject();
  const canRemove = project.scoringScale.length > MIN_SCALE_POINTS;

  function nextDefaultValue(): number {
    if (project.scoringScale.length === 0) return 1;
    return Math.max(...project.scoringScale.map((p) => p.value)) + 1;
  }

  return (
    <div className="card">
      <h2>Scoring Scale</h2>
      {project.scoringScale.length <= MIN_SCALE_POINTS && (
        <p className="field-hint">At least {MIN_SCALE_POINTS} points are required.</p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Label</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.scoringScale.map((point, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    aria-label="Scale point value"
                    value={point.value}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_SCALE_POINT",
                        value: point.value,
                        patch: { value: Number(e.target.value) },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    aria-label="Scale point label"
                    value={point.label}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_SCALE_POINT",
                        value: point.value,
                        patch: { label: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={!canRemove}
                    title={
                      canRemove ? undefined : `At least ${MIN_SCALE_POINTS} points are required`
                    }
                    onClick={() => dispatch({ type: "REMOVE_SCALE_POINT", value: point.value })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() =>
            dispatch({ type: "ADD_SCALE_POINT", point: { value: nextDefaultValue(), label: "" } })
          }
        >
          Add scale point
        </button>
      </div>
    </div>
  );
}
