// T038: Import completed reviewer workbook(s) — single or multi-file picker, a per-file
// before/after summary shown before anything commits, and a commit step that upserts
// added rows into project.scores, overwriting any prior entry for the same
// reviewer/firm/criterion (FR-020, FR-022, FR-023).
//
// Overwrite confirmation (004 post-launch improvements): FR-023's "last input wins" used
// to happen silently — the review table's "Added" count didn't distinguish a brand-new
// score from one replacing an already-recorded value (e.g. from a stale/resent workbook).
// Now every added row that would replace an existing score is flagged with its own
// "Overwrites existing score" count and an old-value -> new-value list, AND — the actual
// gate, not just a visible line — if any row in the batch overwrites anything, clicking
// "Confirm import" no longer commits directly. It opens the same ConfirmDialog every
// destructive action in this app already uses (FirmsEditor/ReviewersEditor/CriteriaEditor's
// delete gates), requiring a distinct, explicit second click before anything is written.
// An import with zero overwrites is completely unaffected — one click, same as before.

import { useRef, useState } from "react";
import { Badge } from "../../components/Badge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FilePickerField, type FilePickerFieldHandle } from "../../components/FilePickerField";
import {
  collectScoresToCommit,
  parseWorkbookFiles,
  type ParsedFileResult,
} from "../../lib/excel/parseWorkbook";
import { useLoadedProject } from "../../state/ProjectContext";

export function ImportScoresPanel() {
  const { project, dispatch } = useLoadedProject();
  const [pendingResults, setPendingResults] = useState<ParsedFileResult[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const filePickerRef = useRef<FilePickerFieldHandle>(null);

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

  function commitScores() {
    if (!pendingResults) return;
    const scores = collectScoresToCommit(pendingResults);
    dispatch({ type: "UPSERT_SCORES", scores });
    setCommitted(true);
    setOverwriteConfirmOpen(false);
  }

  function handleConfirmImportClick() {
    if (totalOverwrites > 0) {
      setOverwriteConfirmOpen(true);
      return;
    }
    commitScores();
  }

  function handleDiscard() {
    setPendingResults(null);
    setCommitted(false);
    setOverwriteConfirmOpen(false);
    filePickerRef.current?.reset();
  }

  const totalAdded = pendingResults?.reduce((sum, r) => sum + r.addedCount, 0) ?? 0;
  const totalOverwrites = pendingResults?.reduce((sum, r) => sum + r.overwriteCount, 0) ?? 0;

  return (
    <div className="card">
      <h2>Import Completed Reviewer Workbook(s)</h2>
      <div className="field">
        <label htmlFor="import-workbooks">
          Select one or more completed <code>.xlsx</code> files
        </label>
        <FilePickerField
          ref={filePickerRef}
          id="import-workbooks"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          disabled={parsing}
          buttonLabel="Select Reviewer Scores"
          onFilesSelected={(files) => {
            if (files.length > 0) void handleFilesChosen(files);
          }}
        />
      </div>

      {parsing && <p className="field-hint">Reading file(s)…</p>}

      {pendingResults && !committed && (
        <div>
          <h3>Review before importing</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Added</th>
                  <th>Not yet scored</th>
                  <th>Failed validation</th>
                  <th>Overwrites existing score</th>
                </tr>
              </thead>
              <tbody>
                {pendingResults.map((result) => (
                  <tr key={result.filename}>
                    <td>{result.reviewerName ?? result.filename}</td>
                    <td>
                      <Badge variant="success">{result.addedCount}</Badge>
                    </td>
                    <td>
                      {result.skippedCount > 0 ? (
                        <Badge variant="neutral">{result.skippedCount}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {result.failedCount > 0 ? (
                        <>
                          <Badge variant="danger">{result.failedCount}</Badge>
                          <ul className="import-failed-rows">
                            {result.rows
                              .filter((r) => r.status === "failed")
                              .map((r, i) => (
                                <li key={i}>
                                  Row {r.row}: {r.reason}
                                </li>
                              ))}
                          </ul>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {result.overwriteCount > 0 ? (
                        <>
                          <Badge variant="warning">{result.overwriteCount}</Badge>
                          <ul className="import-overwrite-rows">
                            {result.rows
                              .filter((r) => r.status === "added" && r.overwrites)
                              .map((r, i) => (
                                <li key={i}>
                                  Row {r.row}: {r.overwrites!.firmName} / {r.overwrites!.criterionName}:{" "}
                                  {r.overwrites!.previousValue} → {r.score!.value}
                                </li>
                              ))}
                          </ul>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="button button-primary"
              onClick={handleConfirmImportClick}
              disabled={totalAdded === 0}
            >
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

      <ConfirmDialog
        open={overwriteConfirmOpen}
        title="Overwrite existing scores?"
        message={
          <>
            This import will overwrite {totalOverwrites} existing score
            {totalOverwrites === 1 ? "" : "s"} with new values from the imported file
            {pendingResults && pendingResults.length === 1 ? "" : "s"} — see the "Overwrites
            existing score" column above for exactly which ones. This cannot be undone within
            the app. Continue?
          </>
        }
        confirmLabel={`Yes, overwrite ${totalOverwrites} existing score${totalOverwrites === 1 ? "" : "s"}`}
        cancelLabel="Cancel"
        onCancel={() => setOverwriteConfirmOpen(false)}
        onConfirm={commitScores}
      />
    </div>
  );
}
