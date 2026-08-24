// T045: Switches from the Dashboard (view mode) into Configuration without losing any
// loaded data (spec Story 4, Acceptance Scenario 3). This is a pure area-navigation
// action — it never touches project state, so "no data loss" holds trivially: the
// in-memory Project object is untouched, only which screen renders it changes.
//
// Icon-only (Dashboard toolbar redesign): grouped with "Show calculations" as a
// low-stakes, reversible action — navigating away or opening a view has no real
// consequence, unlike the two export actions next to them, which is exactly why those
// two stay icon+label (DashboardScreen.tsx's own header comment has the full rationale).
// Accessible name is carried by aria-label alone (no visible text), same convention
// AppHeader's own icon buttons already use.
//
// Gear, not a pencil: this navigates to the Configuration area (firms/reviewers/criteria/
// scale — the project's whole setup), so a settings glyph reads as "go configure this"
// without a second's thought.

import { Settings } from "lucide-react";

export function EditProjectButton({ onEditProject }: { onEditProject: () => void }) {
  return (
    <button
      type="button"
      className="button-link icon-button no-print"
      onClick={onEditProject}
      aria-label="Edit project"
      title="Edit project"
    >
      <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
