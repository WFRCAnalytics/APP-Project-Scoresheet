// T025: Firms editor — add/edit/remove, invited/submitted flags, notes, and a
// confirmation prompt before removing a firm with existing scores (FR-006, FR-007).
//
// Name field is a searchable-and-creatable combobox (post-launch improvement,
// components/ComboBox.tsx) — suggestions come from lib/knownFirms.ts, a static bundled
// list. Typing a name that isn't on the list is fine (it's still a plain free-text field
// under the hood) and applies only to this project — there's no separate "firms directory"
// to save it to or manage; a custom name here is exactly as session-local as it already was
// before this field became searchable.

import { useState } from "react";
import { ComboBox } from "../../components/ComboBox";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { findDuplicateNames } from "../../lib/duplicateNames";
import { generateId } from "../../lib/id";
import { KNOWN_FIRMS } from "../../lib/knownFirms";
import { useLoadedProject } from "../../state/ProjectContext";
import { firmHasScores } from "../../state/projectReducer";

export function FirmsEditor() {
  const { project, dispatch } = useLoadedProject();
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  // Non-blocking, same convention as CriteriaEditor's weight-total banner — a duplicate
  // name doesn't stop saving or generating forms, it just makes two firms indistinguishable
  // on the Dashboard and in exports, which is worth flagging but not preventing.
  const duplicateFirmNames = findDuplicateNames(project.firms.map((f) => f.name));

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

      {duplicateFirmNames.size > 0 && (
        <div className="banner banner-warning" role="alert">
          Duplicate name{duplicateFirmNames.size > 1 ? "s" : ""}:{" "}
          {[...duplicateFirmNames.entries()]
            .map(([name, count]) => `"${name}" is used by ${count} firms`)
            .join("; ")}{" "}
          — rename so results stay unambiguous on the Dashboard and in exports (this does not block
          saving or generating forms).
        </div>
      )}

      {project.firms.length > 0 && (
        <div className="config-strip">
          <span className="config-tag">
            {project.firms.filter((f) => f.invited).length} invited
          </span>
          <span className="config-tag is-ok">
            {project.firms.filter((f) => f.submitted).length} submitted
          </span>
          <span className="config-tag">
            {project.firms.filter((f) => !f.submitted).length} not submitted
          </span>
          <span className="field-hint">Only submitted firms are scored and ranked.</span>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table firms-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="col-check">Invited</th>
              <th className="col-check">Submitted</th>
              <th>Notes</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.firms.map((firm) => (
              <tr key={firm.id}>
                <td>
                  <ComboBox
                    ariaLabel="Firm name"
                    options={KNOWN_FIRMS}
                    value={firm.name}
                    onChange={(name) =>
                      dispatch({
                        type: "UPDATE_FIRM",
                        firmId: firm.id,
                        patch: { name },
                      })
                    }
                  />
                </td>
                <td className="col-check">
                  <span className="check-cell">
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
                    <span className="check-cell-state" aria-hidden="true">
                      {firm.invited ? "Invited" : "Not invited"}
                    </span>
                  </span>
                </td>
                <td className="col-check">
                  <span className="check-cell">
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
                    <span className="check-cell-state" aria-hidden="true">
                      {firm.submitted ? "Submitted" : "Not submitted"}
                    </span>
                  </span>
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
