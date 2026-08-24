// T011: Project file validation — the runtime half of contracts/project-file.md.
//
// Two distinct failure modes, checked in this order (data-model.md's "Validation rules"):
//   1. schemaVersion recognition (FR-038) — missing/old versions are migrated forward;
//      unrecognized/future versions are rejected with a specific error before anything
//      else is inspected.
//   2. structural validation (FR-004) — once the version is known-good, every field is
//      checked against the Project shape; a mismatch is rejected with a clear,
//      human-readable error, and nothing is partially loaded.

import { CURRENT_SCHEMA_VERSION, type Project } from "../types/project";

export type ValidationResult =
  | { valid: true; project: Project }
  | { valid: false; error: string };

/**
 * Migrations, keyed by the schemaVersion they migrate FROM. Each function returns a new
 * object with schemaVersion advanced to the next step. Empty today because "1.0" is the
 * only version that has ever existed — this is where a future "1.0" -> "1.1" migration
 * would be added without touching the version-recognition logic below.
 */
const MIGRATIONS: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

/** Every schemaVersion this app can read, oldest first. A file with no schemaVersion field
 * at all is treated as the oldest recognized version (FR-038). */
const RECOGNIZED_VERSIONS = ["1.0"];

export function validateAndMigrateProject(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: "This file is not a valid project JSON object." };
  }
  const obj = raw as Record<string, unknown>;

  const declaredVersion = typeof obj.schemaVersion === "string" ? obj.schemaVersion : undefined;
  const version = declaredVersion ?? RECOGNIZED_VERSIONS[0];

  if (!RECOGNIZED_VERSIONS.includes(version)) {
    return {
      valid: false,
      error:
        `This project file's schema version ("${version}") is not one this app supports ` +
        `(supported: ${RECOGNIZED_VERSIONS.join(", ")}). It may have been created by a ` +
        "newer version of this app — try opening it there, or check for an app update.",
    };
  }

  let migrated: Record<string, unknown> = { ...obj, schemaVersion: version };

  // Reviewer.type value rename ("city" -> "applicant", labeled "TLC Applicant" in the UI —
  // generalizes the old city-only assumption so a county TLC applicant isn't mislabeled).
  // Not a schemaVersion bump — the shape is unchanged, only this one literal — so it's
  // applied unconditionally here rather than through the MIGRATIONS table, letting any
  // previously saved "1.0" file with the old value keep loading correctly.
  if (Array.isArray(migrated.reviewers)) {
    migrated.reviewers = migrated.reviewers.map((r) =>
      isPlainObject(r) && r.type === "city" ? { ...r, type: "applicant" } : r,
    );
  }

  // scoringScaleMode addition (discrete vs. continuous scales — types/project.ts). Not a
  // schemaVersion bump either: every file saved before this option existed was, in effect,
  // discrete (a reviewer could only pick one of the exact configured values), so a missing
  // field is migrated to "discrete" explicitly — preserving that file's actual prior
  // behavior — rather than defaulting to "continuous" (createEmptyProject's default for
  // brand-new projects only) and silently loosening validation for data nobody asked to
  // loosen.
  if (typeof migrated.scoringScaleMode !== "string") {
    migrated.scoringScaleMode = "discrete";
  }

  let cursor = version;
  let guard = 0;
  while (cursor !== CURRENT_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[cursor];
    if (!migrate) break; // no further migration registered; structural check below will
    // catch anything that's still wrong after this point.
    migrated = migrate(migrated);
    cursor = migrated.schemaVersion as string;
    guard += 1;
    if (guard > 20) break; // defensive: never loop forever on a misconfigured chain
  }
  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;

  const structuralError = describeStructuralError(migrated);
  if (structuralError) {
    return { valid: false, error: structuralError };
  }

  return { valid: true, project: migrated as unknown as Project };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringField(obj: Record<string, unknown>, field: string): boolean {
  return typeof obj[field] === "string";
}

/** Returns a human-readable error describing the first structural problem found, or
 * `null` if `obj` matches the Project shape (FR-004). Checks every field type, not just
 * top-level array presence, so a file with the right shape but wrong field types is
 * rejected rather than silently loaded with `undefined`s. */
function describeStructuralError(obj: Record<string, unknown>): string | null {
  if (!isPlainObject(obj.project)) {
    return 'Missing or invalid "project" info section.';
  }
  const info = obj.project;
  for (const field of [
    "projectName",
    "localGovContact",
    "procurementAgent",
    "committeeMeetingDate",
    "notes",
  ]) {
    if (!isStringField(info, field)) {
      return `Project info field "${field}" is missing or not text.`;
    }
  }

  if (!Array.isArray(obj.scoringScale)) return '"scoringScale" must be a list.';
  for (const point of obj.scoringScale) {
    if (!isPlainObject(point) || typeof point.value !== "number" || typeof point.label !== "string") {
      return "Every scoring scale entry needs a numeric value and a text label.";
    }
  }
  if (obj.scoringScaleMode !== "discrete" && obj.scoringScaleMode !== "continuous") {
    return 'Project field "scoringScaleMode" must be "discrete" or "continuous".';
  }

  if (!Array.isArray(obj.criteria)) return '"criteria" must be a list.';
  for (const c of obj.criteria) {
    if (
      !isPlainObject(c) ||
      !isStringField(c, "id") ||
      !isStringField(c, "name") ||
      typeof c.weight !== "number" ||
      !isStringField(c, "description")
    ) {
      return "Every criterion needs an id, name, numeric weight, and description.";
    }
  }

  if (!Array.isArray(obj.firms)) return '"firms" must be a list.';
  for (const f of obj.firms) {
    if (
      !isPlainObject(f) ||
      !isStringField(f, "id") ||
      !isStringField(f, "name") ||
      typeof f.invited !== "boolean" ||
      typeof f.submitted !== "boolean" ||
      !isStringField(f, "notes")
    ) {
      return "Every firm needs an id, name, invited flag, submitted flag, and notes.";
    }
  }

  if (!Array.isArray(obj.reviewers)) return '"reviewers" must be a list.';
  for (const r of obj.reviewers) {
    if (
      !isPlainObject(r) ||
      !isStringField(r, "id") ||
      !isStringField(r, "name") ||
      (r.type !== "applicant" && r.type !== "wfrc") ||
      !isStringField(r, "email")
    ) {
      return 'Every reviewer needs an id, name, type ("applicant" or "wfrc"), and email field.';
    }
  }

  if (!Array.isArray(obj.scores)) return '"scores" must be a list.';
  for (const s of obj.scores) {
    if (
      !isPlainObject(s) ||
      !isStringField(s, "reviewerId") ||
      !isStringField(s, "firmId") ||
      !isStringField(s, "criterionId") ||
      typeof s.value !== "number" ||
      !isStringField(s, "comment") ||
      !isStringField(s, "updatedAt")
    ) {
      return "Every score needs reviewerId, firmId, criterionId, a numeric value, comment, and updatedAt.";
    }
  }

  return null;
}
