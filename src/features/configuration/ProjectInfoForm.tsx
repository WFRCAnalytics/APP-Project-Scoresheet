// T024: Project info form — project name, handler/contact name, committee meeting date,
// notes (FR-005). Project name drives the default export filename (FR-014) elsewhere.
//
// Compact-layout pass: the name gets a full-width field, the two contacts and the meeting date
// share a row, and a live preview underneath shows exactly where these values end up — the
// Dashboard's header and the top of every reviewer workbook — so a typo is visible before the
// forms go out.

import { formatIsoDate } from "../../lib/formatDate";
import { useLoadedProject } from "../../state/ProjectContext";

export function ProjectInfoForm() {
  const { project, dispatch } = useLoadedProject();
  const info = project.project;
  const sampleReviewer = project.reviewers[0]?.name.trim() || "Reviewer name";

  return (
    <div className="card">
      <h2>Project Info</h2>
      <p className="field-hint">Shown on the Dashboard and on every reviewer form.</p>

      <div className="pform">
        <div className="field">
          <label htmlFor="project-name">Project Name:</label>
          <input
            id="project-name"
            type="text"
            className="pform-name"
            value={info.projectName}
            onChange={(e) =>
              dispatch({ type: "UPDATE_PROJECT_INFO", info: { projectName: e.target.value } })
            }
            placeholder="Example Project"
          />
        </div>

        <div className="pform-row">
          <div className="field">
            <label htmlFor="local-gov-contact">Local Government Contact:</label>
            <input
              id="local-gov-contact"
              type="text"
              value={info.localGovContact}
              onChange={(e) =>
                dispatch({ type: "UPDATE_PROJECT_INFO", info: { localGovContact: e.target.value } })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="procurement-agent">Procurement Agent (WFRC PM):</label>
            <input
              id="procurement-agent"
              type="text"
              value={info.procurementAgent}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_PROJECT_INFO",
                  info: { procurementAgent: e.target.value },
                })
              }
            />
          </div>

          <div className="field">
            <label htmlFor="committee-meeting-date">Selection Committee Meeting Date:</label>
            <input
              id="committee-meeting-date"
              type="date"
              value={info.committeeMeetingDate}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_PROJECT_INFO",
                  info: { committeeMeetingDate: e.target.value },
                })
              }
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="project-notes">Notes</label>
          <textarea
            id="project-notes"
            rows={3}
            value={info.notes}
            onChange={(e) =>
              dispatch({ type: "UPDATE_PROJECT_INFO", info: { notes: e.target.value } })
            }
            placeholder="Project Description"
          />
        </div>
      </div>

      {/* Decorative: a live echo of the fields above, so it is hidden from assistive tech. */}
      <div className="pform-previews" aria-hidden="true">
        <div>
          <p className="field-hint">Dashboard header</p>
          <div className="pform-preview">
            <div className="pform-preview-title">
              {info.projectName.trim() || "Untitled Project"}
            </div>
            <div className="pform-preview-meta">
              <span>
                Contact <b>{info.localGovContact.trim() || "not set"}</b>
              </span>
              <span>
                Procurement agent <b>{info.procurementAgent.trim() || "not set"}</b>
              </span>
              <span>
                Meeting{" "}
                <b>
                  {info.committeeMeetingDate ? formatIsoDate(info.committeeMeetingDate) : "not set"}
                </b>
              </span>
            </div>
          </div>
        </div>
        <div>
          <p className="field-hint">Top of each reviewer workbook</p>
          <div className="pform-preview">
            <div className="pform-preview-row">
              <b>Proposal Evaluation Scoresheet</b> for {sampleReviewer}
            </div>
            <div className="pform-preview-row">
              Project: {info.projectName.trim() || "Untitled Project"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
