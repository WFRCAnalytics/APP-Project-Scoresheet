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

/**
 * Default filename for a generated reviewer workbook (FR-015/FR-019): sanitized
 * reviewer name + sanitized project name, e.g. "Alice_Very_Good_Project.xlsx". Reuses
 * the same sanitization rule as project filenames — same reasoning, same fallback for an
 * empty/punctuation-only name.
 */
export function reviewerWorkbookFilename(projectName: string, reviewerName: string): string {
  const projectPart = sanitizeProjectName(projectName) || "untitled-project";
  const reviewerPart = sanitizeProjectName(reviewerName) || "reviewer";
  return `${reviewerPart}_${projectPart}.xlsx`;
}

/** Default filename for the Calculations modal's "Export as .xlsx" audit download —
 * same sanitization rule as the other two filename functions here. */
export function calculationsWorkbookFilename(projectName: string): string {
  const projectPart = sanitizeProjectName(projectName) || "untitled-project";
  return `${projectPart}_Calculations.xlsx`;
}

/** Default filename for a Dashboard chart's PNG/SVG download — sanitized project name +
 * sanitized chart label (e.g. "Very_Good_Project_Overall_vs_City.png"), reusing the same
 * sanitization rule as every other export point here. `chartLabel` reused through
 * sanitizeProjectName rather than a second copy of the same punctuation-stripping rule. */
export function chartExportFilename(
  projectName: string,
  chartLabel: string,
  extension: "png" | "svg",
): string {
  const projectPart = sanitizeProjectName(projectName) || "untitled-project";
  const labelPart = sanitizeProjectName(chartLabel) || "chart";
  return `${projectPart}_${labelPart}.${extension}`;
}
