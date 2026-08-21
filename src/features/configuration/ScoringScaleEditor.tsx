// T028: Scoring scale editor — add/edit/remove scale points (value + label), enforcing a
// minimum of 2 points (FR-011). Unlike the weight-sum warning (non-blocking, FR-010),
// the 2-point minimum is a hard floor — a 1-point scale can't meaningfully score
// anything — so removal is disabled rather than merely warned about once only 2 remain.

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

      <table className="data-table">
        <thead>
          <tr>
            <th>Value</th>
            <th>Label</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {[...project.scoringScale]
            .sort((a, b) => a.value - b.value)
            .map((point) => (
              <tr key={point.value}>
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
                    title={canRemove ? undefined : `At least ${MIN_SCALE_POINTS} points are required`}
                    onClick={() => dispatch({ type: "REMOVE_SCALE_POINT", value: point.value })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

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
