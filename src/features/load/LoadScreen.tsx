// T022: The Load screen — exactly two entry actions, no project list, no account step
// (FR-001). This is the sole entry point every session (constitution Principle III: one
// project at a time).

import { useRef, useState } from "react";
import { createEmptyProject, type Project } from "../../types/project";
import { routeUploadedFile, type UploadArea } from "./uploadProject";

export interface LoadScreenProps {
  onStartNew: (project: Project) => void;
  onProjectLoaded: (project: Project, area: UploadArea) => void;
}

export function LoadScreen({ onStartNew, onProjectLoaded }: LoadScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(file: File) {
    setError(null);
    setUploading(true);
    try {
      const result = await routeUploadedFile(file);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onProjectLoaded(result.project, result.area);
    } finally {
      setUploading(false);
      // Reset so choosing the same filename again still fires a change event.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section aria-label="Load">
      <h1>Consultant Selection Scoring</h1>
      <p>Score and rank consulting firms that responded to an RFP.</p>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      <div className="entry-choice">
        <div className="card">
          <h2>Start a new project</h2>
          <p>Configure a brand-new procurement from scratch.</p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onStartNew(createEmptyProject())}
          >
            Start a new project
          </button>
        </div>

        <div className="card">
          <h2>Upload a project file</h2>
          <p>
            Open a previously exported <code>project.json</code>. A file with scores lands
            on the Dashboard; an in-progress file resumes in Configuration.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Upload a project file"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileChosen(file);
            }}
          />
          {uploading && <p className="field-hint">Reading file…</p>}
        </div>
      </div>
    </section>
  );
}
