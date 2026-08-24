// T009: Shared result shapes for src/lib/calculations.ts. Kept in a separate file so the
// calculation engine's public surface is easy to scan and re-export from UI code without
// pulling function bodies along with it.

export interface CompletionCount {
  /** Number of applicable reviewers who have a live score for this cell/firm. */
  scored: number;
  /** Number of reviewers who could plausibly score it. */
  expected: number;
}

export interface RankedFirm {
  firmId: string;
  total: number;
  rank: number;
}

export type WeightBasis = "overall" | "applicant" | "wfrc";
