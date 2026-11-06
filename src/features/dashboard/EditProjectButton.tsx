// T045: Switches from the Dashboard (view mode) into Configuration without losing any
// loaded data (spec Story 4, Acceptance Scenario 3). This is a pure area-navigation
// action — it never touches project state, so "no data loss" holds trivially: the
// in-memory Project object is untouched, only which screen renders it changes.
//
// Icon + label, like every other control in the Dashboard toolbar: a bare gear read as a
// mystery button next to labelled ones. The visible text is its accessible name.
//
// Gear, not a pencil: this navigates to the Configuration area (firms/reviewers/criteria/
// scale — the project's whole setup), so a settings glyph reads as "go configure this"
// without a second's thought.

import { Settings } from "lucide-react";

export function EditProjectButton({ onEditProject }: { onEditProject: () => void }) {
  return (
    <button
      type="button"
      className="button button-secondary no-print"
      onClick={onEditProject}
      title="Open Configuration to change the project's setup"
    >
      <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
      Configure project
    </button>
  );
}
