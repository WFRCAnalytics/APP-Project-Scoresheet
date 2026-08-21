// T038: Import completed reviewer workbook(s) — single or multi-file picker, a per-file
// before/after summary shown before anything commits, and a commit step that upserts
// added rows into project.scores, overwriting any prior entry for the same
// reviewer/firm/criterion (FR-020, FR-022, FR-023).

import { useRef, useState } from "react";
import { collectScoresToCommit, parseWorkbookFiles, type ParsedFileResult } from "../../lib/excel/parseWorkbook";
import { useLoadedProject } from "../../state/ProjectContext";

export function ImportScoresPanel() {
  const { project, dispatch } = useLoadedProject();
  const [pendingResults, setPendingResults] = useState<ParsedFileResult[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committed, setCommitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesChosen(files: FileList) {
    setParsing(true);
    setCommitted(false);
    try {
      const results = await parseWorkbookFiles(project, Array.from(files));
      setPendingResults(results);
    } finally {
      setParsing(false);
    }
  }

  function handleCommit() {
    if (!pendingResults) return;
    const scores = collectScoresToCommit(pendingResults);
    dispatch({ type: "UPSERT_SCORES", scores });
    setCommitted(true);
  }

  function handleDiscard() {
    setPendingResults(null);
    setCommitted(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const totalAdded = pendingResults?.reduce((sum, r) => sum + r.addedCount, 0) ?? 0;

  return (
    <div className="card">
      <h2>Import Completed Reviewer Workbook(s)</h2>
      <div className="field">
        <label htmlFor="import-workbooks">
          Select one or more completed <code>.xlsx</code> files
        </label>
        <input
          ref={fileInputRef}
          id="import-workbooks"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          disabled={parsing}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void handleFilesChosen(e.target.files);
          }}
        />
      </div>

      {parsing && <p className="field-hint">Reading file(s)…</p>}

      {pendingResults && !committed && (
        <div>
          <h3>Review before importing</h3>
          {pendingResults.map((result) => (
            <div key={result.filename} className="banner" style={{ borderLeft: "3px solid var(--color-border)" }}>
              <strong>{result.reviewerName ?? result.filename}</strong>: {result.addedCount} scores added
              {result.skippedCount > 0 && `, ${result.skippedCount} not yet scored`}
              {result.failedCount > 0 && `, ${result.failedCount} rows failed validation`}
              {result.failedCount > 0 && (
                <ul>
                  {result.rows
                    .filter((r) => r.status === "failed")
                    .map((r, i) => (
                      <li key={i}>
                        Row {r.row}: {r.reason}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
          <div className="actions-row">
            <button type="button" className="button button-primary" onClick={handleCommit} disabled={totalAdded === 0}>
              Confirm import ({totalAdded} score{totalAdded === 1 ? "" : "s"})
            </button>
            <button type="button" className="button button-secondary" onClick={handleDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}

      {committed && (
        <div className="banner" role="status">
          Import complete — {totalAdded} score{totalAdded === 1 ? "" : "s"} committed.
          <div className="actions-row">
            <button type="button" className="button button-secondary" onClick={handleDiscard}>
              Import more files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
