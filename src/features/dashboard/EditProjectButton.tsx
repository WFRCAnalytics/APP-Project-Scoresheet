// T045: Switches from the Dashboard (view mode) into Configuration without losing any
// loaded data (spec Story 4, Acceptance Scenario 3). This is a pure area-navigation
// action — it never touches project state, so "no data loss" holds trivially: the
// in-memory Project object is untouched, only which screen renders it changes.

export function EditProjectButton({ onEditProject }: { onEditProject: () => void }) {
  return (
    <button type="button" className="button button-secondary no-print" onClick={onEditProject}>
      Edit project
    </button>
  );
}
