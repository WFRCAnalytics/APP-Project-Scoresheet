// T030: Configuration screen — assembles the five editors (T024–T028) plus "Export
// project JSON" (T029) and "Upload a different project JSON," all wired to
// ProjectContext (FR-013: both export and re-upload are available at all times here, not
// gated behind a single save step).
//
// "Upload a different project JSON" intentionally reuses uploadProject.ts's
// `routeUploadedFile` — the exact same routing decision the Load screen makes (FR-002/
// FR-003) — rather than a second, independently-maintained copy of that logic.

import { useRef, useState } from "react";
import { useProjectContext } from "../../state/ProjectContext";
import { routeUploadedFile, type UploadArea } from "../load/uploadProject";
import type { Project } from "../../types/project";
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

export function ConfigurationScreen({ onProjectReplaced, onGenerateForms }: ConfigurationScreenProps) {
  const { project } = useProjectContext();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onProjectReplaced(result.project, result.area);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <section aria-label="Configuration">
      <h1>Configuration</h1>

      {uploadError && (
        <div className="banner banner-error" role="alert">
          {uploadError}
        </div>
      )}

      <ProjectInfoForm />
      <FirmsEditor />
      <ReviewersEditor />
      <CriteriaEditor />
      <ScoringScaleEditor />

      <div className="card">
        <h2>Next Step</h2>
        <p>Once your firms, reviewers, criteria, and scale are set up, generate the reviewer scoring forms.</p>
        <button type="button" className="button button-primary" onClick={onGenerateForms}>
          Generate reviewer forms
        </button>
      </div>

      <div className="card">
        <h2>Save / Resume</h2>
        <ExportProjectButton />
        <div className="field" style={{ marginTop: "1rem" }}>
          <label htmlFor="replace-project-file">Upload a different project JSON</label>
          <input
            ref={fileInputRef}
            id="replace-project-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleReplaceFile(file);
            }}
          />
        </div>
      </div>
    </section>
  );
}
