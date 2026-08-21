// T025: Firms editor — add/edit/remove, invited/submitted flags, notes, and a
// confirmation prompt before removing a firm with existing scores (FR-006, FR-007).

import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { generateId } from "../../lib/id";
import { useLoadedProject } from "../../state/ProjectContext";
import { firmHasScores } from "../../state/projectReducer";

export function FirmsEditor() {
  const { project, dispatch } = useLoadedProject();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  function requestRemove(firmId: string) {
    if (firmHasScores(project, firmId)) {
      setPendingRemoval(firmId);
    } else {
      dispatch({ type: "REMOVE_FIRM", firmId });
    }
  }

  const pendingFirm = project.firms.find((f) => f.id === pendingRemoval);

  return (
    <div className="card">
      <h2>Firms</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Invited</th>
              <th>Submitted</th>
              <th>Notes</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.firms.map((firm) => (
              <tr key={firm.id}>
                <td>
                  <input
                    type="text"
                    aria-label="Firm name"
                    value={firm.name}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_FIRM",
                        firmId: firm.id,
                        patch: { name: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Invited"
                    checked={firm.invited}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_FIRM",
                        firmId: firm.id,
                        patch: { invited: e.target.checked },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Submitted"
                    checked={firm.submitted}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_FIRM",
                        firmId: firm.id,
                        patch: { submitted: e.target.checked },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    aria-label="Notes"
                    value={firm.notes}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_FIRM",
                        firmId: firm.id,
                        patch: { notes: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => requestRemove(firm.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {project.firms.length === 0 && (
              <tr>
                <td colSpan={5} className="field-hint">
                  No firms yet — add one below.
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
              type: "ADD_FIRM",
              firm: {
                id: generateId("firm"),
                name: "",
                invited: true,
                submitted: false,
                notes: "",
              },
            })
          }
        >
          Add firm
        </button>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove firm with recorded scores?"
        message={
          <>
            "{pendingFirm?.name || "This firm"}" has scores recorded against it. Removing it will
            keep those score entries in the file, but they will no longer count toward any total or
            ranking.
          </>
        }
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) dispatch({ type: "REMOVE_FIRM", firmId: pendingRemoval });
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
