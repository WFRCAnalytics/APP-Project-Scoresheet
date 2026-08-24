// Hosts T033/T034 (single + batch reviewer form generation) and T038 (score import) —
// the User Story 2 + User Story 3 intake screen, per plan.md's structure note (generation
// and import UI live together under features/reviewer-forms/).

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

  return (
    <section aria-label="Reviewer Forms">
      <h1>Reviewer Forms</h1>
      <p>
        Generate an Excel scoring workbook for each reviewer. Reviewers open, fill, and return these
        files using spreadsheet software they already have — no knowledge of this app required.
      </p>

      <div className="card card--elevated">
        <h2>Download all at once</h2>
        <GenerateAllFormsButton />
      </div>

      <div className="card">
        <h2>Download individually</h2>
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

      <div className="actions-row">
        <button type="button" className="button button-secondary" onClick={onBackToConfiguration}>
          Back to Configuration
        </button>
        <button type="button" className="button button-primary" onClick={onGoToDashboard}>
          View Dashboard
        </button>
      </div>
    </section>
  );
}
