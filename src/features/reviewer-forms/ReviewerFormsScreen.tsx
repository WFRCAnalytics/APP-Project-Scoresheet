// Hosts T033/T034 (single + batch reviewer form generation) and T038 (score import) —
// the User Story 2 + User Story 3 intake screen, per plan.md's structure note (generation
// and import UI live together under features/reviewer-forms/).

import { LayoutDashboard, Settings } from "lucide-react";
import { Badge } from "../../components/Badge";
import { ExportProjectJsonButton } from "../../components/ExportProjectJsonButton";
import { useLoadedProject } from "../../state/ProjectContext";
import { GenerateAllFormsButton } from "./GenerateAllFormsButton";
import { GenerateFormButton } from "./GenerateFormButton";
import { ImportScoresPanel } from "./ImportScoresPanel";

export interface ReviewerFormsScreenProps {
  onBackToConfiguration: () => void;
  onGoToDashboard: () => void;
}

export function ReviewerFormsScreen({
  onBackToConfiguration,
  onGoToDashboard,
}: ReviewerFormsScreenProps) {
  const { project } = useLoadedProject();
  const unsigned = project.reviewers.filter((r) => r.confidentialitySigned === false);

  return (
    <section aria-label="Reviewer Forms">
      <div className="dashboard-page-header config-page-header">
        <h1>Reviewer Forms</h1>
        <div className="page-header-actions">
          {/* The same shared export Configuration and the Dashboard use. A project manager who
              has just set everything up and generated the forms can save the project file
              from here instead of going back to Configuration just to find the button. */}
          <ExportProjectJsonButton variant="compact" />
          {/* Short visible labels so the three buttons fit on the title's row; the icon plus
              the full aria-label/title keep the "go back to / view" meaning. */}
          <button
            type="button"
            className="button button-secondary"
            onClick={onBackToConfiguration}
            aria-label="Back to Configuration"
            title="Back to Configuration"
          >
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            Configuration
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={onGoToDashboard}
            aria-label="View Dashboard"
            title="View Dashboard"
          >
            <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
            Dashboard
          </button>
        </div>
      </div>
      <p>
        Generate an Excel scoring workbook for each reviewer. Reviewers open, fill, and return these
        files using spreadsheet software they already have — no knowledge of this app required.
      </p>

      {unsigned.length > 0 && (
        <div className="banner banner-warning" role="status">
          Confidentiality form not signed:{" "}
          {unsigned.map((r) => r.name || "Unnamed reviewer").join(", ")}. You can still generate
          their workbooks — this is a reminder only.
        </div>
      )}

      <div className="card">
        <div className="card-header-row">
          <h2>Download individually</h2>
          <GenerateAllFormsButton />
        </div>
        {project.reviewers.length === 0 && (
          <p className="field-hint">No reviewers configured yet.</p>
        )}
        {project.reviewers.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Type</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {project.reviewers.map((reviewer) => (
                  <tr key={reviewer.id}>
                    <td>{reviewer.name || "Unnamed reviewer"}</td>
                    <td>
                      <Badge variant={reviewer.type === "wfrc" ? "info" : "neutral"}>
                        {reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant"}
                      </Badge>
                      {reviewer.confidentialitySigned === false && (
                        <>
                          {" "}
                          <Badge variant="warning">Confidentiality form not signed</Badge>
                        </>
                      )}
                    </td>
                    <td>
                      <GenerateFormButton reviewer={reviewer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImportScoresPanel />
    </section>
  );
}
