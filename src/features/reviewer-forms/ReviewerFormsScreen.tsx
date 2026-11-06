// Hosts T033/T034 (single + batch reviewer form generation) and T038 (score import) —
// the User Story 2 + User Story 3 intake screen, per plan.md's structure note (generation
// and import UI live together under features/reviewer-forms/).

import { LayoutDashboard, Settings } from "lucide-react";
import { Badge } from "../../components/Badge";
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
          <button type="button" className="button button-secondary" onClick={onBackToConfiguration}>
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            Back to Configuration
          </button>
          <button type="button" className="button button-primary" onClick={onGoToDashboard}>
            <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
            View Dashboard
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
