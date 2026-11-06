// Hosts T033/T034 (single + batch reviewer form generation) and T038 (score import) —
// the User Story 2 + User Story 3 intake screen, per plan.md's structure note (generation
// and import UI live together under features/reviewer-forms/).
//
// Compact-layout pass: an app-style workspace that fits the window. Left: a small import card
// above the reviewer roster — one list that carries both "download this reviewer's workbook"
// and "how many of their scores are in", so it stays useful (and scrolls inside its card) with
// 10-20 reviewers. Right: the work area, where the selected reviewer's scores and comments are
// entered by hand (the same ManualEntryGrid the Calculations dialog hosts, here one firm at a
// time with room for comments). Picking a reviewer in the roster loads them into the work area.

import { LayoutDashboard, Settings } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/Badge";
import { ExportProjectJsonButton } from "../../components/ExportProjectJsonButton";
import { useLoadedProject } from "../../state/ProjectContext";
import type { Project, Reviewer } from "../../types/project";
import { GenerateAllFormsButton } from "./GenerateAllFormsButton";
import { GenerateFormButton } from "./GenerateFormButton";
import { ImportScoresPanel } from "./ImportScoresPanel";
import { ManualEntryGrid } from "./ManualEntryGrid";

export interface ReviewerFormsScreenProps {
  onBackToConfiguration: () => void;
  onGoToDashboard: () => void;
}

/** Roster search appears once the list is long enough to need it. */
const SEARCH_MIN_REVIEWERS = 8;

/** How many of a reviewer's scores are in, out of every submitted firm × criterion. */
function reviewerProgress(project: Project, reviewer: Reviewer) {
  const submittedIds = new Set(project.firms.filter((f) => f.submitted).map((f) => f.id));
  const criterionIds = new Set(project.criteria.map((c) => c.id));
  const scored = project.scores.filter(
    (s) =>
      s.reviewerId === reviewer.id && submittedIds.has(s.firmId) && criterionIds.has(s.criterionId),
  ).length;
  return { scored, expected: submittedIds.size * criterionIds.size };
}

export function ReviewerFormsScreen({
  onBackToConfiguration,
  onGoToDashboard,
}: ReviewerFormsScreenProps) {
  const { project } = useLoadedProject();
  const unsigned = project.reviewers.filter((r) => r.confidentialitySigned === false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Bumped when an import commits so the work area reloads the scores it was showing.
  const [importVersion, setImportVersion] = useState(0);

  // Falls back to the first reviewer if the selected one was since removed.
  const selected = project.reviewers.find((r) => r.id === selectedId) ?? project.reviewers[0];
  const selectedIndex = selected ? project.reviewers.indexOf(selected) : -1;
  const visibleReviewers = project.reviewers.filter((r) =>
    (r.name || "Unnamed reviewer").toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const completeCount = project.reviewers.filter((r) => {
    const p = reviewerProgress(project, r);
    return p.expected > 0 && p.scored === p.expected;
  }).length;

  return (
    <section aria-label="Reviewer Forms" className="forms-screen">
      <div className="forms-header">
        <div className="forms-header-main">
          <h1>Reviewer Forms</h1>
          <p className="forms-intro">
            Generate an Excel scoring workbook for each reviewer. Reviewers open, fill, and return
            these files using spreadsheet software they already have — no knowledge of this app
            required.
          </p>
        </div>
        {/* The same toolbar chrome as the Dashboard's: where to go on the left, the file action on
            the right. A project manager who has just set everything up and generated the forms
            can save the project file from here instead of going back to Configuration just to
            find the button. Short visible labels; the icon plus the full aria-label/title keep
            the "go back to / view" meaning. */}
        <div className="dashboard-toolbar no-print">
          <div className="dashboard-toolbar-group">
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
          <div className="dashboard-toolbar-divider" aria-hidden="true" />
          <div className="dashboard-toolbar-group">
            <ExportProjectJsonButton />
          </div>
        </div>
      </div>

      {unsigned.length > 0 && (
        <div className="banner banner-warning forms-banner" role="status">
          Confidentiality form not signed:{" "}
          {unsigned.map((r) => r.name || "Unnamed reviewer").join(", ")}. You can still generate
          their workbooks — this is a reminder only.
        </div>
      )}

      <div className="forms-workspace">
        <div className="forms-side">
          <ImportScoresPanel onImported={() => setImportVersion((v) => v + 1)} />

          <section className="card forms-roster" aria-label="Download individually">
            <div className="forms-card-head">
              <h2>Download individually</h2>
              <GenerateAllFormsButton />
            </div>
            {project.reviewers.length === 0 ? (
              <p className="field-hint forms-roster-empty">No reviewers configured yet.</p>
            ) : (
              <>
                <div className="forms-roster-tools">
                  {project.reviewers.length >= SEARCH_MIN_REVIEWERS && (
                    <input
                      type="search"
                      aria-label="Find a reviewer"
                      placeholder="Find a reviewer"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  )}
                  <span className="field-hint">
                    {completeCount} of {project.reviewers.length} complete
                  </span>
                </div>
                <div className="forms-roster-scroll">
                  <table className="data-table forms-roster-table">
                    <thead>
                      <tr>
                        <th>Reviewer</th>
                        <th>Scores in</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleReviewers.map((reviewer) => {
                        const { scored, expected } = reviewerProgress(project, reviewer);
                        const pct = expected > 0 ? Math.round((scored / expected) * 100) : 0;
                        const isSelected = reviewer.id === selected?.id;
                        return (
                          <tr key={reviewer.id} className={isSelected ? "is-selected" : undefined}>
                            <td>
                              <button
                                type="button"
                                className="forms-roster-name"
                                aria-pressed={isSelected}
                                title="Enter this reviewer's scores by hand"
                                onClick={() => setSelectedId(reviewer.id)}
                              >
                                {reviewer.name || "Unnamed reviewer"}
                              </button>
                              <div className="forms-roster-badges">
                                <Badge variant={reviewer.type === "wfrc" ? "info" : "neutral"}>
                                  {reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant"}
                                </Badge>
                                {reviewer.confidentialitySigned === false && (
                                  <Badge variant="warning">Confidentiality form not signed</Badge>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="forms-progress">
                                <span className="forms-progress-track" aria-hidden="true">
                                  <span
                                    className="forms-progress-fill"
                                    style={{ width: `${pct}%` }}
                                  />
                                </span>
                                {scored === 0 ? "None yet" : `${scored}/${expected}`}
                              </span>
                            </td>
                            <td>
                              <GenerateFormButton reviewer={reviewer} />
                            </td>
                          </tr>
                        );
                      })}
                      {visibleReviewers.length === 0 && (
                        <tr>
                          <td colSpan={3} className="field-hint">
                            No reviewer matches "{filter}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        <section className="card forms-work" aria-label="Enter scores by hand">
          {selected ? (
            <>
              <div className="forms-work-head">
                <div className="forms-work-title">
                  <h2>{selected.name || "Unnamed reviewer"}</h2>
                  <span className="field-hint">
                    {selected.type === "wfrc" ? "WFRC" : "TLC Applicant"}. Scores save as you enter
                    them.
                  </span>
                </div>
                {project.reviewers.length > 1 && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      setSelectedId(
                        project.reviewers[(selectedIndex + 1) % project.reviewers.length].id,
                      )
                    }
                  >
                    Next reviewer
                  </button>
                )}
              </div>
              <div className="forms-work-body">
                <ManualEntryGrid key={`${selected.id}:${importVersion}`} reviewerId={selected.id} />
              </div>
            </>
          ) : (
            <p className="field-hint">Add reviewers in Configuration to enter scores here.</p>
          )}
        </section>
      </div>
    </section>
  );
}
