// The Load screen's actual two entry actions (FR-001) — moved here from LoadScreen.tsx
// directly so the Load screen itself can present a single hero CTA ("Get Started") instead
// of two large cards on first paint. Behavior/wiring (routeUploadedFile, createEmptyProject)
// is unchanged from the original LoadScreen — only the container changed.

import { FilePlus2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { FilePickerField, type FilePickerFieldHandle } from "../../components/FilePickerField";
import { Modal } from "../../components/Modal";
import { createEmptyProject, type Project } from "../../types/project";
import { routeUploadedFile, type UploadArea } from "./uploadProject";

export interface GetStartedModalProps {
  open: boolean;
  onClose: () => void;
  onStartNew: (project: Project) => void;
  onProjectLoaded: (project: Project, area: UploadArea) => void;
}

export function GetStartedModal({ open, onClose, onStartNew, onProjectLoaded }: GetStartedModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const filePickerRef = useRef<FilePickerFieldHandle>(null);

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
      filePickerRef.current?.reset();
    }
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="get-started-modal-title" size="lg">
      <h2 id="get-started-modal-title">Get Started</h2>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      <div className="entry-choice">
        <div className="card card--elevated card--interactive">
          <FilePlus2 className="card-icon" size={28} strokeWidth={1.75} aria-hidden="true" />
          <h3>Start a new project</h3>
          <p>Configure a brand-new procurement from scratch.</p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => onStartNew(createEmptyProject())}
          >
            Start a new project
          </button>
        </div>

        <div className="card card--elevated card--interactive">
          <Upload className="card-icon" size={28} strokeWidth={1.75} aria-hidden="true" />
          <h3>Upload a project file</h3>
          <p>
            Open a previously exported <code>project.json</code>. A file with scores lands
            on the Dashboard; an in-progress file resumes in Configuration.
          </p>
          <FilePickerField
            ref={filePickerRef}
            accept="application/json,.json"
            ariaLabel="Upload a project file"
            disabled={uploading}
            buttonLabel="Choose Project JSON"
            onFilesSelected={(files) => {
              const file = files[0];
              if (file) void handleFileChosen(file);
            }}
          />
          {uploading && (
            <p className="field-hint">
              <span className="spinner" aria-hidden="true" /> Reading file…
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
