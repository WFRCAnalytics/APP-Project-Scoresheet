// T015: The "recover unsaved work" convenience (FR-040, constitution Principle II).
//
// This is deliberately a single-slot store, not a list — there is no way to accumulate
// multiple snapshots here, which structurally enforces "MUST NOT be presented as a saved
// project or project list" rather than relying on UI code to remember not to. It is also
// entirely independent of project.json import/export (contracts/project-file.md): loading
// a file never reads this, and this is never written to as a side effect of export.
//
// sessionStorage (not localStorage) is used on purpose: it already clears itself when the
// tab closes, which is most of "temporary/local-only" for free. Every operation here is
// best-effort and silently no-ops on failure (private browsing, storage disabled, quota
// exceeded) — a recovery convenience must never be able to crash the app or block the
// real, explicit save/load flow.

import type { Project } from "../types/project";

const STORAGE_KEY = "consultant-selection-scoring:recovery-snapshot:v1";

export interface RecoverySnapshot {
  project: Project;
  /** ISO datetime the snapshot was taken — shown to the handler so "restore or discard"
   * is an informed choice, not a guess. */
  savedAt: string;
}

export function saveRecoverySnapshot(project: Project): void {
  try {
    const snapshot: RecoverySnapshot = { project, savedAt: new Date().toISOString() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort convenience — see module docs above.
  }
}

/** Returns the current snapshot, or `null` if there isn't one (or it's unreadable). */
export function loadRecoverySnapshot(): RecoverySnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoverySnapshot>;
    if (!parsed || typeof parsed !== "object" || !parsed.project || !parsed.savedAt) {
      return null;
    }
    return parsed as RecoverySnapshot;
  } catch {
    return null;
  }
}

/** Trivially clears the snapshot (FR-040's "MUST be trivially clearable") — called both
 * when the handler explicitly discards it and after a successful restore, so a stale
 * snapshot never lingers past the choice being made. */
export function clearRecoverySnapshot(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasRecoverySnapshot(): boolean {
  return loadRecoverySnapshot() !== null;
}
