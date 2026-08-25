// Scoring-scale mode support: "discrete" (today's original behavior — a reviewer must pick
// one of the exact configured scoringScale[] values) vs. "continuous" (a reviewer may enter
// any value between the lowest and highest configured scoringScale[] values, in steps of
// 0.1). Both modes reuse the exact same scoringScale: ScoringScalePoint[] shape and CRUD —
// in continuous mode the configured points are labeled reference anchors along the range
// (e.g. "1 = Poor", "3 = Average", "5 = Excellent"), not a restrictive membership list, so
// there's no new data structure and no migration needed for the points themselves. Only
// Project.scoringScaleMode is new.
//
// Single source of truth for both parseWorkbook.ts (Excel import) and ManualEntryGrid.tsx
// (in-app entry) so the two score-entry paths can't drift on what counts as a valid score —
// same rationale as calculations.ts being the one place Overall/Applicant math happens.

import type { Project } from "../types/project";

/** The configured range, from whatever scoringScale points currently exist — used as the
 * continuous-mode bounds AND as the chart/heatmap axis domain (already computed this way
 * elsewhere; this is just the shared, named version of that same min/max). A single-point
 * (or empty) scale degenerates to min === max, handled by callers same as today. */
export function scaleRange(project: Project): { min: number; max: number } {
  const values = project.scoringScale.map((p) => p.value);
  if (values.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Rounds to one decimal place — the continuous mode's fixed step, enforced by rounding
 * rather than rejecting (a reviewer typing 3.14 becomes 3.1, not a validation failure), per
 * the same "round it off" call made for weight input (lib/weightInput.ts uses the opposite
 * choice — reject there, round here — because a mistyped weight silently corrupts a sum a
 * handler configured, while a mistyped score decimal is the reviewer's own single data point
 * and forcing them to redo an entire returned workbook over a hundredth of a point is a much
 * worse failure mode than just rounding it). Exported: ScoringScaleEditor reuses this exact
 * same rounding for the scale's own POINT values (not just reviewers' scores) — one decimal
 * place is the shared precision ceiling for every number this scale ever produces or
 * accepts, whichever side of "configuring the scale" vs. "scoring against it" it's on. */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Validates and normalizes a raw score value against the project's current scoring-scale
 * mode. Returns the value to actually store (never the raw input verbatim in continuous
 * mode — always rounded to one decimal first), or `null` if the value is invalid for this
 * project's scale (out of range, or — discrete mode only — not one of the exact configured
 * values).
 */
export function normalizeScoreValue(project: Project, raw: number): number | null {
  if (!Number.isFinite(raw)) return null;

  if (project.scoringScaleMode === "discrete") {
    const validValues = new Set(project.scoringScale.map((p) => p.value));
    return validValues.has(raw) ? raw : null;
  }

  const { min, max } = scaleRange(project);
  if (raw < min || raw > max) return null;
  return roundToOneDecimal(raw);
}
