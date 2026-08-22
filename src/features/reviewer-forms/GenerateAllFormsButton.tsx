// T034: "Download all forms" batch action (FR-019) — loops `generateWorkbookForReviewer`
// once per reviewer (the exact same function GenerateFormButton.tsx calls for a single
// reviewer), so this can never produce a workbook that differs from what the
// single-download path would have produced for the same reviewer.
//
// Post-launch improvements, item 4: packaged as a single .zip archive (via lib/zipFiles.ts),
// not N sequential blob downloads. The original implementation deliberately avoided a
// zip-library dependency and staggered N separate browser downloads instead — a real
// annoyance flagged in the post-launch review (N popup/save prompts for one user action,
// browsers sometimes blocking the burst regardless of the stagger). JSZip was added
// specifically for this (flagged and approved before implementing, not a silent scope
// change) — every reviewer's workbook is generated exactly as before, then packaged into
// one archive and downloaded once.

import { useState } from "react";
import { downloadBlob } from "../../lib/downloadBlob";
import { checkCanGenerateWorkbooks, generateWorkbookForReviewer } from "../../lib/excel/generateWorkbook";
import { reviewerFormsZipFilename } from "../../lib/filenames";
import { zipFiles } from "../../lib/zipFiles";
import { useLoadedProject } from "../../state/ProjectContext";

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
      const files: Array<{ filename: string; blob: Blob }> = [];
      for (const reviewer of project.reviewers) {
        const result = await generateWorkbookForReviewer(project, reviewer);
        if (!result.ok) {
          setError(`Stopped at "${reviewer.name || "unnamed reviewer"}": ${result.error}`);
          return;
        }
        files.push({ filename: result.filename, blob: result.blob });
      }
      const zipBlob = await zipFiles(files);
      downloadBlob(zipBlob, reviewerFormsZipFilename(project.project.projectName));
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
