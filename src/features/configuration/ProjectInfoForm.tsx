// T024: Project info form — project name, handler/contact name, committee meeting date,
// notes (FR-005). Project name drives the default export filename (FR-014) elsewhere.

import { useLoadedProject } from "../../state/ProjectContext";

export function ProjectInfoForm() {
  const { project, dispatch } = useLoadedProject();
  const info = project.project;

  return (
    <div className="card">
      <h2>Project Info</h2>

      <div className="field">
        <label htmlFor="project-name">Project Name:</label>
        <input
          id="project-name"
          type="text"
          value={info.projectName}
          onChange={(e) =>
            dispatch({ type: "UPDATE_PROJECT_INFO", info: { projectName: e.target.value } })
          }
          placeholder="Example Project"
        />
      </div>

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
            dispatch({ type: "UPDATE_PROJECT_INFO", info: { procurementAgent: e.target.value } })
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
  );
}
