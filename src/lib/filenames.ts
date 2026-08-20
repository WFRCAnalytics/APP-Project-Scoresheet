// T013: Default export filename logic (FR-014). Used at every JSON export point
// (Configuration and Dashboard) — always a *default*, never forced/locked: the handler
// can override it in the save-file prompt.

/**
 * Sanitizes a project name into a filesystem-safe stem: whitespace becomes `_`, and any
 * character outside `[A-Za-z0-9_-]` is stripped. Leading/trailing underscores from
 * stripped punctuation are trimmed for readability.
 */
export function sanitizeProjectName(projectName: string): string {
  return projectName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/^_+|_+$/g, "");
}

/**
 * Default export filename for a project.json download: a sanitized version of the
 * project name (e.g. "Very_Good_Project.json"), or "untitled-project.json" if no project
 * name is set yet (FR-014) — including when the name is set but sanitizes down to nothing
 * (e.g. a name made entirely of punctuation).
 */
export function defaultProjectFilename(projectName: string): string {
  const sanitized = sanitizeProjectName(projectName);
  return sanitized ? `${sanitized}.json` : "untitled-project.json";
}
