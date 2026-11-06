// T030: Configuration screen — assembles the five editors (T024–T028) behind a non-gating
// step flow (Project Info -> Firms -> Reviewers -> Criteria -> Scale -> Export/Review), plus
// "Export project JSON" and "Upload a different project JSON," pinned to a toolbar visible
// regardless of the current step (FR-013: both are available at all times here, not gated
// behind a single save step or any one step of this flow).
//
// The step rail (ConfigurationProgressBar) and Back/Next buttons are convenience navigation
// ONLY — every step's editor stays independently reachable via its rail button at any time, in
// any order. Back/Next just advances/retreats through the same always-open steps; neither one
// disables reaching a step out of order (constitution Principle V — Flexibility). Each step's
// status (done / needs attention / not started — see stepStatuses below) is read from the
// project's own data and is presentation-only, not a validation gate.
//
// Compact-layout pass: the screen fills the window — a header with the project file actions,
// then the step rail on the left and the open step's editor beside it, which scrolls inside its
// own panel with Back/Next pinned beneath it.
//
// "Upload a different project JSON" intentionally reuses uploadProject.ts's
// `routeUploadedFile` — the exact same routing decision the Load screen makes (FR-002/
// FR-003) — rather than a second, independently-maintained copy of that logic.
//
// Replace confirmation (004 post-launch improvements): a project is always loaded here
// (guarded below), so replacing it always risks losing unexported in-memory changes —
// unlike the Load screen's own upload path, which only ever runs with nothing loaded yet
// (there's no "back to Load" navigation once a project is active) and so never needs this
// gate. The new file is parsed/validated FIRST so both project names are known, then staged
// behind the same ConfirmDialog every destructive action in this app already uses, rather
// than routing immediately on a successful parse the way this used to work.

import { LayoutDashboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FilePickerField, type FilePickerFieldHandle } from "../../components/FilePickerField";
import { useProjectContext } from "../../state/ProjectContext";
import { routeUploadedFile, type UploadArea } from "../load/uploadProject";
import { hasResults, type Project } from "../../types/project";
import { ConfigurationProgressBar, type ConfigStep } from "./ConfigurationProgressBar";
import { WEIGHT_TOLERANCE } from "./weightTolerance";
import { CriteriaEditor } from "./CriteriaEditor";
import { ExportProjectButton } from "./ExportProjectButton";
import { FirmsEditor } from "./FirmsEditor";
import { ProjectInfoForm } from "./ProjectInfoForm";
import { ReviewersEditor } from "./ReviewersEditor";
import { ScoringScaleEditor } from "./ScoringScaleEditor";

export interface ConfigurationScreenProps {
  onProjectReplaced: (project: Project, area: UploadArea) => void;
  /** Advances to the Reviewer Forms area (User Story 2) — the natural next step once
   * configuration is far enough along to generate forms from (not gated on "complete,"
   * since the weight-sum warning is non-blocking, FR-010). */
  onGenerateForms: () => void;
  /** Straight back to the Dashboard, skipping the Generate Forms step — offered only once
   * the project has scores (there is nothing to show before that). Pure navigation: the
   * loaded project, including any edits made here, is untouched. */
  onGoToDashboard: () => void;
}

const STEPS = [
  { id: "info", label: "Project Info" },
  { id: "firms", label: "Firms" },
  { id: "reviewers", label: "Reviewers" },
  { id: "criteria", label: "Criteria" },
  { id: "scale", label: "Scale" },
  { id: "export", label: "Export / Review" },
] as const;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Where each step stands, from the project's own data. Presentation only — nothing here gates
 * navigation or any action. */
function stepStatuses(project: Project): ConfigStep[] {
  const submitted = project.firms.filter((f) => f.submitted).length;
  const unsigned = project.reviewers.filter((r) => r.confidentialitySigned === false).length;
  const weightTotal = project.criteria.reduce((sum, c) => sum + c.weight, 0);
  const weightsOk = Math.abs(weightTotal - 1) <= WEIGHT_TOLERANCE;
  const scaleValues = [...project.scoringScale.map((p) => p.value)].sort((a, b) => a - b);

  const byId: Record<(typeof STEPS)[number]["id"], Pick<ConfigStep, "summary" | "state">> = {
    info: {
      state: project.project.projectName.trim() ? "done" : "todo",
      summary: project.project.projectName.trim() || "Name, contacts, meeting date",
    },
    firms: {
      state: project.firms.length > 0 ? "done" : "todo",
      summary:
        project.firms.length > 0
          ? `${plural(project.firms.length, "firm", "firms")}, ${submitted} submitted`
          : "No firms yet",
    },
    reviewers: {
      state: project.reviewers.length === 0 ? "todo" : unsigned > 0 ? "attention" : "done",
      summary:
        project.reviewers.length === 0
          ? "No reviewers yet"
          : unsigned > 0
            ? `${unsigned} of ${project.reviewers.length} not signed`
            : plural(project.reviewers.length, "reviewer", "reviewers"),
    },
    criteria: {
      state: project.criteria.length === 0 ? "todo" : weightsOk ? "done" : "attention",
      summary:
        project.criteria.length === 0
          ? "No criteria yet"
          : `${plural(project.criteria.length, "criterion", "criteria")}, weights total ${Math.round(weightTotal * 1000) / 10}%`,
    },
    scale: {
      state: scaleValues.length >= 2 ? "done" : "todo",
      summary:
        scaleValues.length === 0
          ? "No scale yet"
          : `${project.scoringScaleMode === "discrete" ? "Fixed values" : "Range"}: ${scaleValues.join(", ")}`,
    },
    export: {
      state: hasResults(project) ? "done" : "todo",
      summary: hasResults(project) ? "Scores are in" : "Download forms next",
    },
  };
  return STEPS.map((step) => ({ id: step.id, label: step.label, ...byId[step.id] }));
}

export function ConfigurationScreen({
  onProjectReplaced,
  onGenerateForms,
  onGoToDashboard,
}: ConfigurationScreenProps) {
  const { project, dispatch } = useProjectContext();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    project: Project;
    area: UploadArea;
  } | null>(null);
  const filePickerRef = useRef<FilePickerFieldHandle>(null);
  const [currentStep, setCurrentStep] = useState<string>(STEPS[0].id);

  // Opening Configuration starts a new round of setup: reviewers an old file never recorded
  // a confidentiality answer for become unsigned, so the warnings start and the handler ticks
  // who has signed. A no-op (same state back, no re-render) when there is nothing unrecorded;
  // depends on `project` so a replacement JSON loaded from inside this screen is covered too.
  useEffect(() => {
    dispatch({ type: "MARK_UNRECORDED_CONFIDENTIALITY_UNSIGNED" });
  }, [dispatch, project]);

  if (!project) {
    // Guarded by the caller in practice (App.tsx only renders this area with a project
    // loaded), but keep the component safe to render defensively rather than crashing.
    return <p>No project loaded.</p>;
  }

  async function handleReplaceFile(file: File) {
    setUploadError(null);
    const result = await routeUploadedFile(file);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    // A project is always loaded here (the guard above returned already if not) — stage
    // the parsed result behind the confirm dialog rather than routing immediately.
    setPendingReplacement({ project: result.project, area: result.area });
  }

  function confirmReplacement() {
    if (!pendingReplacement) return;
    onProjectReplaced(pendingReplacement.project, pendingReplacement.area);
    setPendingReplacement(null);
    // Clears the underlying <input>'s value, not just the displayed filename — without
    // this, re-selecting the exact same file after a Cancel wouldn't re-fire the browser's
    // change event (identical file path), silently breaking "try again with the same file."
    filePickerRef.current?.reset();
  }

  function cancelReplacement() {
    setPendingReplacement(null);
    filePickerRef.current?.reset();
  }

  function goToStep(id: string) {
    setCurrentStep(id);
  }

  const steps = stepStatuses(project);
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <section aria-label="Configuration" className="config-screen">
      <div className="config-header">
        <div className="config-header-main">
          <h1>Configuration</h1>
          <p className="forms-intro">
            Set up the project, firms, reviewers and criteria, then generate the reviewer forms.
          </p>
        </div>
        {/* The same toolbar chrome as the Dashboard's: where to go on the left (once there is
            something to go back to), the project-file actions on the right. The upload control's
            label stays for assistive tech; the visible button just says "Upload JSON". */}
        <div className="dashboard-toolbar no-print">
          {hasResults(project) && (
            <>
              <div className="dashboard-toolbar-group">
                <button type="button" className="button button-secondary" onClick={onGoToDashboard}>
                  <LayoutDashboard size={16} strokeWidth={1.75} aria-hidden="true" />
                  Back to Dashboard
                </button>
              </div>
              <div className="dashboard-toolbar-divider" aria-hidden="true" />
            </>
          )}
          <div className="dashboard-toolbar-group">
            <label htmlFor="replace-project-file" className="visually-hidden">
              Upload a different project JSON
            </label>
            <FilePickerField
              ref={filePickerRef}
              id="replace-project-file"
              accept="application/json,.json"
              buttonLabel="Upload JSON"
              onFilesSelected={(files) => {
                const file = files[0];
                if (file) void handleReplaceFile(file);
              }}
            />
            <ExportProjectButton />
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="banner banner-error config-banner" role="alert">
          {uploadError}
        </div>
      )}

      <div className="config-workspace">
        <ConfigurationProgressBar steps={steps} currentStep={currentStep} onStepClick={goToStep} />

        <div className="config-panel">
          <div className="config-panel-body">
            {currentStep === "info" && <ProjectInfoForm />}
            {currentStep === "firms" && <FirmsEditor />}
            {currentStep === "reviewers" && <ReviewersEditor />}
            {currentStep === "criteria" && <CriteriaEditor />}
            {currentStep === "scale" && <ScoringScaleEditor />}
            {currentStep === "export" && (
              <div className="card">
                <h2>Export &amp; Next Step</h2>
                <p className="field-hint">
                  {project.firms.length} firm{project.firms.length === 1 ? "" : "s"} ·{" "}
                  {project.reviewers.length} reviewer{project.reviewers.length === 1 ? "" : "s"} ·{" "}
                  {project.criteria.length} criteri
                  {project.criteria.length === 1 ? "on" : "a"} · {project.scoringScale.length}
                  -point scale
                </p>
                <div className="config-export">
                  <div>
                    <ul className="config-checklist" aria-label="Setup checklist">
                      {steps
                        .filter((step) => step.id !== "export")
                        .map((step) => (
                          <li key={step.id}>
                            <span>{step.label}</span>
                            <span className={`config-checklist-state is-${step.state}`}>
                              {step.state === "done"
                                ? "Complete"
                                : step.state === "attention"
                                  ? "Needs attention"
                                  : "Not started"}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div className="config-export-next">
                    <h3>Next: reviewer forms</h3>
                    <p>
                      Once your firms, reviewers, criteria, and scale are set up, generate the
                      reviewer scoring forms.
                    </p>
                    {steps.some((step) => step.state === "attention") && (
                      <p className="config-export-note">
                        Needs attention:{" "}
                        {steps
                          .filter((step) => step.state === "attention")
                          .map((step) => step.label)
                          .join(", ")}
                        . You can generate the forms now; this is only a reminder.
                      </p>
                    )}
                    <button
                      type="button"
                      className="button button-primary config-export-button"
                      onClick={onGenerateForms}
                    >
                      Generate reviewer forms
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="actions-row config-step-nav">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => goToStep(STEPS[currentIndex - 1].id)}
              disabled={currentIndex === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => goToStep(STEPS[currentIndex + 1].id)}
              disabled={currentIndex === STEPS.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingReplacement !== null}
        title="Replace the current project?"
        message={
          <>
            This will replace the currently loaded project "
            {project.project.projectName || "Untitled Project"}" with "
            {pendingReplacement?.project.project.projectName || "Untitled Project"}". Any unexported
            changes to the current project will be lost. Continue?
          </>
        }
        confirmLabel="Replace project"
        cancelLabel="Cancel"
        onCancel={cancelReplacement}
        onConfirm={confirmReplacement}
      />
    </section>
  );
}
