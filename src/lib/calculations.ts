// T009: The calculation engine — pure, framework-free functions computing Overall/TLC
// Applicant averages, weighted totals, competition-style ranks, and completion counts.
//
// This module has NO React import and NO hidden state: every function is a pure function
// of the `Project` object passed in. That is deliberate — constitution Principle VI
// (Transparency) requires every number on the Dashboard to be traceable back to raw
// inputs via the "show calculations" view, and the only way to guarantee the Dashboard and
// the calculations view can never silently disagree is for both to call these same
// functions rather than maintaining any separately-cached summary (see data-model.md's
// "Derived values" section).
//
// Orphan handling: a Score whose firmId/criterionId/reviewerId no longer resolves to a
// live entity (e.g. the firm/criterion/reviewer was deleted after scoring — FR-007,
// FR-039, FR-041) is filtered out of every calculation here, even though it remains in
// `project.scores` in memory. Filtering happens in exactly one place (`liveScoresFor`) so
// every downstream function inherits the same rule automatically.

import type { Project } from "../types/project";
import type { CompletionCount, RankedFirm, WeightBasis } from "./calculations.types";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Reviewers to consider for a given weight basis (FR-026, FR-027). */
function reviewersFor(project: Project, by: WeightBasis) {
  return by === "applicant"
    ? project.reviewers.filter((r) => r.type === "applicant")
    : project.reviewers;
}

/**
 * Live (non-orphaned) scores for one firm/criterion cell, optionally restricted to a
 * reviewer subset. A score is "live" only if its firmId, criterionId, and reviewerId all
 * still resolve to entities currently in the project — this is the single place orphan
 * filtering happens (see module docs above).
 */
function liveScoresFor(
  project: Project,
  firmId: string,
  criterionId: string,
  by: WeightBasis = "overall",
) {
  if (!project.firms.some((f) => f.id === firmId)) return [];
  if (!project.criteria.some((c) => c.id === criterionId)) return [];
  const eligibleReviewerIds = new Set(reviewersFor(project, by).map((r) => r.id));
  return project.scores.filter(
    (s) =>
      s.firmId === firmId && s.criterionId === criterionId && eligibleReviewerIds.has(s.reviewerId),
  );
}

/** Overall Avg for a firm/criterion: mean of all live reviewers' scores (FR-026). Returns
 * `null` when nobody has scored this cell yet — never coerced to 0. */
export function overallAvg(project: Project, firmId: string, criterionId: string): number | null {
  return mean(liveScoresFor(project, firmId, criterionId, "overall").map((s) => s.value));
}

/** TLC Applicant Avg for a firm/criterion: mean of live `type: "applicant"` reviewers'
 * scores only (FR-027). wfrc-type reviewers never contribute here. */
export function applicantAvg(project: Project, firmId: string, criterionId: string): number | null {
  return mean(liveScoresFor(project, firmId, criterionId, "applicant").map((s) => s.value));
}

/** Overall Weighted Total for a firm: sum across criteria of overallAvg × weight
 * (FR-028). Criteria with no scores yet contribute 0 to the running sum — the total is
 * therefore a legitimate partial value, not an error state; pair it with `completion()`
 * so the UI never presents it as final on its own (FR-030). */
export function overallWeightedTotal(project: Project, firmId: string): number {
  return project.criteria.reduce((total, c) => {
    const avg = overallAvg(project, firmId, c.id);
    return total + (avg ?? 0) * c.weight;
  }, 0);
}

/** TLC Applicant Weighted Total for a firm: sum across criteria of applicantAvg × weight
 * (FR-028). */
export function applicantWeightedTotal(project: Project, firmId: string): number {
  return project.criteria.reduce((total, c) => {
    const avg = applicantAvg(project, firmId, c.id);
    return total + (avg ?? 0) * c.weight;
  }, 0);
}

/**
 * Two totals are "tied" if they differ by less than this epsilon. Weighted totals are
 * sums of quotients (means) multiplied by weights arriving via different arithmetic
 * paths per firm — two totals that are conceptually identical (e.g. 13/3*0.6 + 2*0.4 vs
 * 3*0.6 + 4*0.4, both "really" 3.4) will not always be bit-identical in floating point.
 * Strict `!==` tie detection would treat that noise as a real difference and rank firms
 * that should tie as merely "very close," which is wrong per FR-029. 1e-9 is far tighter
 * than the 2-decimal-place precision totals are ever displayed at (spec Assumptions), so
 * this cannot falsely merge two totals a handler would actually see as different.
 */
const TIE_EPSILON = 1e-9;

/**
 * Ranks every `submitted === true` firm (FR-025) by the chosen weighted total, using
 * standard competition ranking: tied totals share a rank, and the next distinct rank
 * skips accordingly (1, 1, 3 — not 1, 1, 2) (FR-029).
 */
export function rankFirms(project: Project, by: WeightBasis): RankedFirm[] {
  const totals = project.firms
    .filter((f) => f.submitted)
    .map((f) => ({
      firmId: f.id,
      total:
        by === "applicant"
          ? applicantWeightedTotal(project, f.id)
          : overallWeightedTotal(project, f.id),
    }));

  totals.sort((a, b) => b.total - a.total);

  const ranked: RankedFirm[] = [];
  let currentRank = 0;
  let previousTotal: number | null = null;
  totals.forEach((t, index) => {
    const position = index + 1; // 1-indexed
    if (previousTotal === null || Math.abs(t.total - previousTotal) > TIE_EPSILON) {
      currentRank = position;
      previousTotal = t.total;
    }
    ranked.push({ firmId: t.firmId, total: t.total, rank: currentRank });
  });
  return ranked;
}

/** Convenience lookup for a single firm's rank within `rankFirms`'s result — `null` if the
 * firm isn't `submitted` (and therefore unranked). */
export function getRank(project: Project, firmId: string, by: WeightBasis): number | null {
  return rankFirms(project, by).find((r) => r.firmId === firmId)?.rank ?? null;
}

/**
 * Completion count for FR-030's "N/M reviewers scored" labeling. Pass `criterionId` for a
 * single cell's completion, or omit it for the firm-level aggregate across every
 * criterion (used on Dashboard firm cards).
 */
export function completion(
  project: Project,
  firmId: string,
  options: { criterionId?: string; by?: WeightBasis } = {},
): CompletionCount {
  const by = options.by ?? "overall";
  const expectedReviewers = reviewersFor(project, by).length;

  if (options.criterionId) {
    return {
      scored: liveScoresFor(project, firmId, options.criterionId, by).length,
      expected: expectedReviewers,
    };
  }

  const scored = project.criteria.reduce(
    (sum, c) => sum + liveScoresFor(project, firmId, c.id, by).length,
    0,
  );
  return { scored, expected: expectedReviewers * project.criteria.length };
}

/** Display-only rounding to 2 decimal places (spec Assumptions). Never applied inside the
 * calculation functions above — the calculations view needs full precision to let a
 * handler verify the rounding is correct (SC-005). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
