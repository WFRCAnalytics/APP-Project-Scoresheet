// Shared "Export project JSON" implementation — filename prompt pre-filled via
// filenames.ts, editable (never forced/locked to the default), used from both
// Configuration (T029, FR-013/FR-014, empty scores array) and the Dashboard (T044,
// FR-036/FR-037, all scores collected so far). Both call sites export the exact same
// live `project` from context, so there's nothing distinct about "the Dashboard's
// export" beyond where the button is placed — one implementation, not two independently
// maintained copies of the same filename/download logic (see also downloadBlob.ts).
//
// Two rendering variants, picked by the caller (`variant` prop), NOT two separate
// components — the filename/export logic below is identical either way, only the markup
// differs:
//   - "inline" (default, Configuration's toolbar): the original always-visible
//     label+input+button block, completely unchanged from before the Dashboard toolbar
//     redesign — explicitly kept as-is per feedback that redesign was Dashboard-only, not
//     an app-wide change to this component.
//   - "compact" (Dashboard toolbar only): clicking "Export JSON" doesn't export directly —
//     it opens a small confirm panel right underneath showing the filename (editable) and
//     a Cancel/Export button pair — just "Export," not "Export project JSON," since the
//     panel's own context (the filename field right above it, the dialog's own
//     aria-label) already makes what's being exported obvious. This is deliberately the
//     same shape as a native "Save As" dialog (you always see/can-edit the name before it
//     commits, never a
//     silent save-under-whatever-the-default-was), not a novel pattern — see this file's
//     git history for the split-button version this replaced and why: a separate
//     always-icon-only rename control next to the export button had no visual link to what
//     it renamed, no matter how tightly the two were welded together. One button that
//     always opens the same confirm step removes the ambiguity outright instead of trying
//     to clarify it.

import { FileJson } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../lib/downloadBlob";
import { defaultProjectFilename } from "../lib/filenames";
import { useLoadedProject } from "../state/ProjectContext";

export interface ExportProjectJsonButtonProps {
  variant?: "inline" | "compact";
}

export function ExportProjectJsonButton({ variant = "inline" }: ExportProjectJsonButtonProps) {
  const { project } = useLoadedProject();
  const [filename, setFilename] = useState(() =>
    defaultProjectFilename(project.project.projectName),
  );
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the filename in sync with the project name for as long as the handler hasn't
  // manually edited it — the moment they touch the field, their choice takes over
  // (FR-014: "not forced/locked to that default either").
  useEffect(() => {
    if (!touched) {
      setFilename(defaultProjectFilename(project.project.projectName));
    }
  }, [project.project.projectName, touched]);

  // "compact" only: focus + select-all the field the moment the confirm panel opens (so
  // either typing replaces the default outright, or a bare Enter confirms it unchanged —
  // the same affordance a native Save As dialog gives its own filename field), and close
  // it on Escape or a click anywhere outside without exporting.
  useEffect(() => {
    if (variant !== "compact" || !confirmOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    function handleOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setConfirmOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [variant, confirmOpen]);

  function handleExport() {
    const finalName = filename.trim() || defaultProjectFilename("");
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, finalName);
    setConfirmOpen(false);
  }

  if (variant === "inline") {
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

  return (
    <div className="export-json-control no-print" ref={wrapRef}>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => setConfirmOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={confirmOpen}
      >
        <FileJson size={16} strokeWidth={1.75} aria-hidden="true" />
        Export JSON
      </button>
      {confirmOpen && (
        <div className="export-json-popover" role="dialog" aria-label="Export project JSON">
          <div className="field">
            <label htmlFor="export-filename">Filename</label>
            <input
              ref={inputRef}
              id="export-filename"
              type="text"
              value={filename}
              onChange={(e) => {
                setTouched(true);
                setFilename(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleExport();
                }
              }}
            />
          </div>
          <div className="export-json-popover-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="button button-primary" onClick={handleExport}>
              Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
