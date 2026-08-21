// T033: Single-reviewer "download form" action (FR-019). Calls
// generateWorkbookForReviewer directly — the same function GenerateAllFormsButton.tsx
// loops over — so the single and batch paths can never drift out of sync.

import { useState } from "react";
import { generateWorkbookForReviewer } from "../../lib/excel/generateWorkbook";
import { downloadBlob } from "../../lib/downloadBlob";
import { useLoadedProject } from "../../state/ProjectContext";
import type { Reviewer } from "../../types/project";

export function GenerateFormButton({ reviewer }: { reviewer: Reviewer }) {
  const { project } = useLoadedProject();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleClick() {
    setError(null);
    setGenerating(true);
    try {
      const result = await generateWorkbookForReviewer(project, reviewer);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      downloadBlob(result.blob, result.filename);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="button button-secondary"
        onClick={handleClick}
        disabled={generating}
        aria-label={`${generating ? "Generating" : "Download"} form for ${reviewer.name || "this reviewer"}`}
      >
        {generating ? "Generating…" : "Download"}
      </button>
      {error && (
        <p className="field-hint" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
