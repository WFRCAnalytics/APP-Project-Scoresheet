// T034: "Download all forms" batch action (FR-019) — loops `generateWorkbookForReviewer`
// once per reviewer (the exact same function GenerateFormButton.tsx calls for a single
// reviewer), so this can never produce a workbook that differs from what the
// single-download path would have produced for the same reviewer.
//
// Sequential downloads, not a zip archive: spec Assumptions explicitly leave the batch
// packaging mechanism as an implementation detail ("one action produces all files" is the
// only user-facing requirement), and this avoids adding a zip-library dependency beyond
// what plan.md/tasks.md scoped for this feature. A short delay between each download
// keeps the browser from treating a rapid burst of blob downloads as something to block.

import { useState } from "react";
import { downloadBlob } from "../../lib/downloadBlob";
import { checkCanGenerateWorkbooks, generateWorkbookForReviewer } from "../../lib/excel/generateWorkbook";
import { useLoadedProject } from "../../state/ProjectContext";

const DOWNLOAD_STAGGER_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GenerateAllFormsButton() {
  const { project } = useLoadedProject();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleClick() {
    setError(null);

    // Same guard generateWorkbookForReviewer itself enforces — checked once up front so
    // a project with no reviewers at all, or one that fails the pre-condition, gets one
    // clear message instead of N silently-empty attempts.
    const guardError = checkCanGenerateWorkbooks(project);
    if (guardError) {
      setError(guardError);
      return;
    }
    if (project.reviewers.length === 0) {
      setError("Add at least one reviewer before generating forms.");
      return;
    }

    setGenerating(true);
    try {
      for (let i = 0; i < project.reviewers.length; i++) {
        const reviewer = project.reviewers[i];
        const result = await generateWorkbookForReviewer(project, reviewer);
        if (!result.ok) {
          setError(`Stopped at "${reviewer.name || "unnamed reviewer"}": ${result.error}`);
          return;
        }
        downloadBlob(result.blob, result.filename);
        if (i < project.reviewers.length - 1) {
          await delay(DOWNLOAD_STAGGER_MS);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <button type="button" className="button button-primary" onClick={handleClick} disabled={generating}>
        {generating ? "Generating all forms…" : "Download all forms"}
      </button>
      {error && (
        <p className="field-hint" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
