// Shared "Export project JSON" implementation — filename prompt pre-filled via
// filenames.ts, editable (never forced/locked to the default), used from both
// Configuration (T029, FR-013/FR-014, empty scores array) and the Dashboard (T044,
// FR-036/FR-037, all scores collected so far). Both call sites export the exact same
// live `project` from context, so there's nothing distinct about "the Dashboard's
// export" beyond where the button is placed — one implementation, not two independently
// maintained copies of the same filename/download logic (see also downloadBlob.ts).

import { useEffect, useState } from "react";
import { downloadBlob } from "../lib/downloadBlob";
import { defaultProjectFilename } from "../lib/filenames";
import { useLoadedProject } from "../state/ProjectContext";

export function ExportProjectJsonButton() {
  const { project } = useLoadedProject();
  const [filename, setFilename] = useState(() =>
    defaultProjectFilename(project.project.projectName),
  );
  const [touched, setTouched] = useState(false);

  // Keep the filename in sync with the project name for as long as the handler hasn't
  // manually edited it — the moment they touch the field, their choice takes over
  // (FR-014: "not forced/locked to that default either").
  useEffect(() => {
    if (!touched) {
      setFilename(defaultProjectFilename(project.project.projectName));
    }
  }, [project.project.projectName, touched]);

  function handleExport() {
    const finalName = filename.trim() || defaultProjectFilename("");
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, finalName);
  }

  return (
    <div className="field export-filename-field no-print">
      <label htmlFor="export-filename">Export filename</label>
      <div className="export-filename-row">
        <input
          id="export-filename"
          type="text"
          value={filename}
          onChange={(e) => {
            setTouched(true);
            setFilename(e.target.value);
          }}
        />
        <button type="button" className="button button-primary" onClick={handleExport}>
          Export project JSON
        </button>
      </div>
    </div>
  );
}
