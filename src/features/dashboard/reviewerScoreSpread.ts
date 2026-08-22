// Pure data-shaping for ReviewerScoreSpreadChart, kept in its own file rather than inline in
// the component — same split rankedRows.ts already uses (feature-local derivation logic,
// not part of calculations.ts, but still worth separating from JSX for testability). No
// calculations.ts changes and no statistical summary (mean/stddev/variance) — this only
// reshapes already-computed project.scores values into plottable points and a rendering-only
// jitter offset, neither of which is a new statistic.

import type { Project, ReviewerType } from "../../types/project";

export interface SpreadPoint {
  x: number;
  y: number;
  reviewerName: string;
  reviewerType: ReviewerType;
  criterionName: string;
}

// How far (in criterion-index units) a reviewer's dot can shift from its criterion's center
// line. Kept well under 0.5 so adjacent criteria's dots never visually cross into each
// other's lane regardless of reviewer count.
const MAX_JITTER = 0.3;

/** A stable, deterministic (never random) horizontal offset for one reviewer, based on their
 * fixed position in the project's full reviewer list — not the subset who happen to have
 * scored any one criterion. This is what lets the same reviewer sit at the same relative
 * x position in every criterion's lane, so a viewer can visually track one reviewer's dots
 * across the whole chart, and it guarantees two different reviewers can never land on the
 * exact same point (each gets a unique offset), so jitter alone always separates them. */
export function jitterOffsetFor(reviewerIndex: number, reviewerCount: number): number {
  if (reviewerCount <= 1) return 0;
  const step = (2 * MAX_JITTER) / (reviewerCount - 1);
  return -MAX_JITTER + reviewerIndex * step;
}

/** Builds one plottable point per LIVE score (reviewerId/criterionId both still resolve to
 * current project entities — the same orphan-safety calculations.ts's liveScoresFor
 * establishes elsewhere; replicated here since this reads project.scores directly rather
 * than going through that module). */
export function buildSpreadPoints(project: Project, firmId: string): SpreadPoint[] {
  const points: SpreadPoint[] = [];
  project.criteria.forEach((criterion, criterionIndex) => {
    project.scores
      .filter((s) => s.firmId === firmId && s.criterionId === criterion.id)
      .forEach((score) => {
        const reviewerIndex = project.reviewers.findIndex((r) => r.id === score.reviewerId);
        if (reviewerIndex === -1) return; // orphaned reference — not a live reviewer
        const reviewer = project.reviewers[reviewerIndex];
        points.push({
          x: criterionIndex + jitterOffsetFor(reviewerIndex, project.reviewers.length),
          y: score.value,
          reviewerName: reviewer.name || "Unnamed reviewer",
          reviewerType: reviewer.type,
          criterionName: criterion.name,
        });
      });
  });
  return points;
}
