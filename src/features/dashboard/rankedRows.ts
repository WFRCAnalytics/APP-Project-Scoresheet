// Single source of row data shared by DashboardScreen's status banner/summary strip and
// RankedFirmsTable's rendering, so the two can never disagree about a number — both are
// built from this one pass over calculations.ts's existing pure functions, nothing new is
// computed here beyond zipping already-derived values together per firm.

import {
  applicantWeightedTotal,
  completion,
  getRank,
  overallWeightedTotal,
  wfrcWeightedTotal,
} from "../../lib/calculations";
import type { CompletionCount } from "../../lib/calculations.types";
import type { Firm, Project } from "../../types/project";

export interface RankedRow {
  firm: Firm;
  overallRank: number;
  applicantRank: number;
  wfrcRank: number;
  overallTotal: number;
  applicantTotal: number;
  wfrcTotal: number;
  comp: CompletionCount;
}

/** One row per submitted firm (FR-025), each carrying all three rank lenses (FR-028/FR-029)
 * and its overall completion count (FR-030). Always returned in ascending-overall-rank order
 * — the canonical order the procurement record (PDF) must use regardless of whatever sort a
 * viewer has active on screen; callers that want a different on-screen order re-sort a copy
 * of this array themselves rather than mutating the canonical one. */
export function buildRankedRows(project: Project): RankedRow[] {
  const rows: RankedRow[] = project.firms
    .filter((firm) => firm.submitted)
    .map((firm) => ({
      firm,
      // Every submitted firm is always ranked (rankFirms ranks all of them, never `null`)
      // — the `?? 0` fallback only guards the type, it can't actually be hit here.
      overallRank: getRank(project, firm.id, "overall") ?? 0,
      applicantRank: getRank(project, firm.id, "applicant") ?? 0,
      wfrcRank: getRank(project, firm.id, "wfrc") ?? 0,
      overallTotal: overallWeightedTotal(project, firm.id),
      applicantTotal: applicantWeightedTotal(project, firm.id),
      wfrcTotal: wfrcWeightedTotal(project, firm.id),
      comp: completion(project, firm.id),
    }));
  rows.sort((a, b) => a.overallRank - b.overallRank);
  return rows;
}
