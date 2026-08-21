// T008: Core data model types, per specs/001-consultant-selection-scoring/data-model.md.
// This is the single in-memory data structure the whole app reads from and writes to
// (constitution Principles II/III), and — verbatim, as JSON — the shape of an exported
// project.json (see contracts/project-file.md).

/** Current schema version this app writes and fully understands (FR-038). */
export const CURRENT_SCHEMA_VERSION = "1.0";

export interface ScoringScalePoint {
  /** e.g. 1, 3, 5 — the only values Score.value may take (FR-017, FR-021). Must be
   * unique within a project's scoringScale array. */
  value: number;
  /** e.g. "Completely unqualified" */
  label: string;
}

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

export type ReviewerType = "city" | "wfrc";

export interface Reviewer {
  id: string;
  name: string;
  /** Explicit field (not inferred) — FR-008; determines City-average eligibility
   * (FR-027). */
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
  /** MUST be one of scoringScale[].value (FR-017, FR-021). */
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
  /** >= 2 entries required (FR-011). */
  scoringScale: ScoringScalePoint[];
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
