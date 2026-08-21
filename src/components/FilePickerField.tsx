// Replaces the raw `<input type="file">` control's native OS chrome (the dated-looking
// "Choose File" button every browser renders differently) with a styled trigger button from
// this app's own button system, plus a filename readout. The real <input type="file"> stays
// in the DOM and fully functional — it's visually hidden (NOT display:none, which breaks
// programmatic .click() in some browsers) and pulled out of tab order, since the button is
// now the actual interactive element a keyboard/mouse user reaches. Accessible name (id+label
// or aria-label) stays on the real input exactly as before, so nothing about how a test or a
// screen reader finds this control changes — only its visual/OS-chrome presentation does.

import { Upload } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent } from "react";
import "./FilePickerField.css";

export interface FilePickerFieldHandle {
  /** Clears the underlying input's value (so re-choosing the same filename still fires a
   * change event) and the displayed filename(s) — the same "reset after handling" step
   * every call site already needed, now centralized instead of reaching into the DOM. */
  reset: () => void;
}

export interface FilePickerFieldProps {
  id?: string;
  /** Only needed when no external <label htmlFor> already names this field (GetStartedModal's
   * case) — when omitted, the caller is expected to provide a visible <label>. */
  ariaLabel?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  onFilesSelected: (files: FileList) => void;
}

export const FilePickerField = forwardRef<FilePickerFieldHandle, FilePickerFieldProps>(
  function FilePickerField(
    { id, ariaLabel, accept, multiple, disabled, buttonLabel, onFilesSelected },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [fileNames, setFileNames] = useState<string[]>([]);

    useImperativeHandle(ref, () => ({
      reset() {
        if (inputRef.current) inputRef.current.value = "";
        setFileNames([]);
      },
    }));

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const files = e.target.files;
      if (files && files.length > 0) {
        setFileNames(Array.from(files).map((f) => f.name));
      }
      if (files) onFilesSelected(files);
    }

    return (
      <div className="file-picker-field">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-label={ariaLabel}
          tabIndex={-1}
          className="file-picker-input"
          onChange={handleChange}
        />
        <div className="file-picker-row">
          <button
            type="button"
            className="button button-secondary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
            {buttonLabel ?? (multiple ? "Choose files" : "Choose file")}
          </button>
          <span className="file-picker-filenames">
            {fileNames.length === 0
              ? "No file chosen"
              : fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} files selected`}
          </span>
        </div>
      </div>
    );
  },
);
