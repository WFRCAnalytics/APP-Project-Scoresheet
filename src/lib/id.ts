// Stable, unique entity IDs (firm-*, rev-*, crit-*) — used wherever the Configuration
// editors (T025–T028) create a new Firm/Reviewer/Criterion. Uses the browser's built-in
// `crypto.randomUUID()` rather than a sequential counter, so IDs stay unique even across
// add/remove/re-add cycles within a session (no risk of reusing an ID that still has
// orphaned scores referencing it — see data-model.md's orphan-handling rules).
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
