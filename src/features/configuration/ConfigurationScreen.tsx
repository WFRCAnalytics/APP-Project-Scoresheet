// T030: Configuration screen — assembles the five editors (T024–T028) behind a non-gating
// step flow (Project Info -> Firms -> Reviewers -> Criteria -> Scale -> Export/Review), plus
// "Export project JSON" and "Upload a different project JSON," pinned to a toolbar visible
// regardless of the current step (FR-013: both are available at all times here, not gated
// behind a single save step or any one step of this flow).
//
// The step bar (ConfigurationProgressBar) and Back/Next buttons are convenience navigation
// ONLY — every step's editor stays independently reachable via its progress-bar button at
// any time, in any order. Back/Next just advances/retreats through the same always-open
// steps; neither one disables reaching a step out of order (constitution Principle V —
// Flexibility). "Visited" is presentation-only (has this step been viewed this session?),
// not a validation gate.
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

import { useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FilePickerField, type FilePickerFieldHandle } from "../../components/FilePickerField";
import { useProjectContext } from "../../state/ProjectContext";
import { routeUploadedFile, type UploadArea } from "../load/uploadProject";
import type { Project } from "../../types/project";
import { ConfigurationProgressBar, type ConfigStep } from "./ConfigurationProgressBar";
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
}

const STEPS: ConfigStep[] = [
  { id: "info", label: "Project Info" },
  { id: "firms", label: "Firms" },
  { id: "reviewers", label: "Reviewers" },
  { id: "criteria", label: "Criteria" },
  { id: "scale", label: "Scale" },
  { id: "export", label: "Export / Review" },
];

export function ConfigurationScreen({
  onProjectReplaced,
  onGenerateForms,
}: ConfigurationScreenProps) {
  const { project } = useProjectContext();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    project: Project;
    area: UploadArea;
  } | null>(null);
  const filePickerRef = useRef<FilePickerFieldHandle>(null);
  const [currentStep, setCurrentStep] = useState<string>(STEPS[0].id);
  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(new Set([STEPS[0].id]));

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
    setVisitedSteps((prev) => new Set(prev).add(id));
  }

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <section aria-label="Configuration">
      <h1>Configuration</h1>

      {uploadError && (
        <div className="banner banner-error" role="alert">
          {uploadError}
        </div>
      )}

      <div className="config-toolbar">
        <ExportProjectButton />
        <div className="field config-toolbar-upload">
          <label htmlFor="replace-project-file">Upload a different project JSON</label>
          <FilePickerField
            ref={filePickerRef}
            id="replace-project-file"
            accept="application/json,.json"
            buttonLabel="Choose Project JSON"
            onFilesSelected={(files) => {
              const file = files[0];
              if (file) void handleReplaceFile(file);
            }}
          />
        </div>
      </div>

      <ConfigurationProgressBar
        steps={STEPS}
        currentStep={currentStep}
        visitedSteps={visitedSteps}
        onStepClick={goToStep}
      />

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
            {project.criteria.length} criteri{project.criteria.length === 1 ? "on" : "a"} ·{" "}
            {project.scoringScale.length}-point scale
          </p>
          <p>
            Once your firms, reviewers, criteria, and scale are set up, generate the reviewer
            scoring forms.
          </p>
          <button type="button" className="button button-primary" onClick={onGenerateForms}>
            Generate reviewer forms
          </button>
        </div>
      )}

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

      <ConfirmDialog
        open={pendingReplacement !== null}
        title="Replace the current project?"
        message={
          <>
            This will replace the currently loaded project "
            {project.project.projectName || "Untitled Project"}" with "
            {pendingReplacement?.project.project.projectName || "Untitled Project"}". Any
            unexported changes to the current project will be lost. Continue?
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
