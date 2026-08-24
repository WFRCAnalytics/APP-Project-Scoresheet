// T008: Core data model types, per specs/001-consultant-selection-scoring/data-model.md.
// This is the single in-memory data structure the whole app reads from and writes to
// (constitution Principles II/III), and — verbatim, as JSON — the shape of an exported
// project.json (see contracts/project-file.md).

/** Current schema version this app writes and fully understands (FR-038). */
export const CURRENT_SCHEMA_VERSION = "1.0";

export interface ScoringScalePoint {
  /** e.g. 1, 3, 5. In "discrete" mode (scoringScaleMode) these are the only values
   * Score.value may take (FR-017, FR-021). In "continuous" mode they're labeled reference
   * anchors along the range instead — any value between the lowest and highest configured
   * point is valid, not just the points themselves (lib/scoreScale.ts). Must be unique
   * within a project's scoringScale array either way. */
  value: number;
  /** e.g. "Completely unqualified" */
  label: string;
}

/** "discrete": a reviewer must pick one of the exact scoringScale[] values (the original,
 * still-default-for-old-files behavior). "continuous": a reviewer may enter any value
 * between the lowest and highest configured scoringScale[] points, in steps of 0.1 — those
 * points become labeled reference anchors rather than a restrictive list. See
 * lib/scoreScale.ts for the shared validation both entry paths (Excel import, manual entry)
 * use. New projects default to "continuous" (createEmptyProject below); a saved project.json
 * with no scoringScaleMode field is migrated to "discrete" (project-schema.ts) — preserving
 * exactly what an old exact-match scale already meant, rather than silently loosening
 * validation for data that predates this option. */
export type ScoringScaleMode = "discrete" | "continuous";

export interface Criterion {
  /** Stable identity used by Score.criterionId and the reviewer workbook's hidden ID
   * column (FR-018). */
  id: string;
  name: string;
  /** Fractional weight; see Project-level weight-sum validation (FR-010). */
  weight: number;
  /** Shown to reviewers on the Scoring sheet (FR-016). */
  description: string;
}

export interface Firm {
  id: string;
  name: string;
  invited: boolean;
  /** Gates inclusion in scoring/ranking/averages (FR-025). */
  submitted: boolean;
  notes: string;
}

export type ReviewerType = "applicant" | "wfrc";

export interface Reviewer {
  id: string;
  name: string;
  /** Explicit field (not inferred) — FR-008; determines TLC Applicant-average
   * eligibility (FR-027). Stored as "applicant" (labeled "TLC Applicant" in the UI —
   * generalized from the original "city" value/label so a county TLC applicant isn't
   * mislabeled; project-schema.ts migrates any file still carrying the old "city"
   * literal on load). */
  type: ReviewerType;
  /** Optional; "" if unset. Handler's own reference only — the app never sends email. */
  email: string;
}

export interface Score {
  /** Reviewer.id */
  reviewerId: string;
  /** Firm.id */
  firmId: string;
  /** Criterion.id */
  criterionId: string;
  /** Discrete mode: MUST be one of scoringScale[].value (FR-017, FR-021). Continuous mode:
   * any value between the lowest and highest configured scoringScale[] points, rounded to
   * one decimal place (lib/scoreScale.ts). */
  value: number;
  /** "" if none; one comment per individual score (FR-016), not per firm. */
  comment: string;
  /** ISO datetime — set on manual entry (FR-024) or import (FR-023). */
  updatedAt: string;
}

export interface ProjectInfo {
  /** "" until set (FR-005); drives default export filename (FR-014). */
  projectName: string;
  /** Handler/contact name. */
  localGovContact: string;
  /** WFRC PM, optional. */
  procurementAgent: string;
  /** ISO date, "" if unset. */
  committeeMeetingDate: string;
  notes: string;
}

export interface Project {
  /** e.g. "1.0" — FR-038. Present on every exported file. */
  schemaVersion: string;
  project: ProjectInfo;
  /** >= 2 entries required (FR-011) in either mode. */
  scoringScale: ScoringScalePoint[];
  /** See ScoringScaleMode above. */
  scoringScaleMode: ScoringScaleMode;
  criteria: Criterion[];
  firms: Firm[];
  reviewers: Reviewer[];
  /** Sparse — absence of an entry means "not yet scored," never zero. */
  scores: Score[];
}

/** A brand-new, empty project — the "Start a new project" starting point (FR-001). */
export function createEmptyProject(): Project {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      projectName: "",
      localGovContact: "",
      procurementAgent: "",
      committeeMeetingDate: "",
      notes: "",
    },
    scoringScale: [],
    scoringScaleMode: "continuous",
    criteria: [],
    firms: [],
    reviewers: [],
    scores: [],
  };
}

/** Lifecycle check driving Load-screen routing (FR-002/FR-003). */
export function hasResults(project: Project): boolean {
  return project.scores.length > 0;
}
