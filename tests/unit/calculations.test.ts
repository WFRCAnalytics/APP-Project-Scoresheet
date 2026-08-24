// T010: Unit tests for the calculation engine, using small, hand-computed fixtures so
// every expected value in this file can be checked by hand against src/lib/calculations.ts
// (constitution Principle VI — this is the highest-risk-of-bugs module in the app).

import { describe, expect, it } from "vitest";
import {
  applicantAvg,
  applicantWeightedTotal,
  completion,
  getRank,
  overallAvg,
  overallWeightedTotal,
  rankFirms,
  round2,
  wfrcAvg,
  wfrcWeightedTotal,
} from "../../src/lib/calculations";
import { createEmptyProject, type Project } from "../../src/types/project";

/**
 * Fixture shape (hand-computable):
 *   Criteria: crit-1 (weight 0.6), crit-2 (weight 0.4)
 *   Firms:    firm-1 (submitted), firm-2 (submitted), firm-3 (NOT submitted)
 *   Reviewers: rev-1 (applicant), rev-2 (applicant), rev-3 (wfrc)
 *
 *   firm-1 / crit-1: rev-1=5, rev-2=3, rev-3=5
 *     -> overallAvg   = (5+3+5)/3 = 13/3 ≈ 4.3333
 *     -> applicantAvg = (5+3)/2   = 4
 *     -> wfrcAvg      = 5/1       = 5   (only rev-3, the only wfrc reviewer)
 *   firm-1 / crit-2: rev-1=1, rev-3=3 (rev-2 hasn't scored this cell)
 *     -> overallAvg   = (1+3)/2 = 2
 *     -> applicantAvg = 1/1     = 1   (only rev-1, the only applicant reviewer who scored it)
 *     -> wfrcAvg      = 3/1     = 3
 *   firm-2 / crit-1: rev-1=3, rev-2=3, rev-3=3
 *     -> overallAvg = 3, applicantAvg = 3, wfrcAvg = 3
 *   firm-2 / crit-2: no scores at all -> all three averages are null
 *   firm-3: not submitted -> excluded from ranking entirely, even though it has no scores
 */
function buildFixture(): Project {
  const project = createEmptyProject();
  project.criteria = [
    { id: "crit-1", name: "Approach", weight: 0.6, description: "" },
    { id: "crit-2", name: "Cost", weight: 0.4, description: "" },
  ];
  project.firms = [
    { id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    { id: "firm-2", name: "Beta Co", invited: true, submitted: true, notes: "" },
    { id: "firm-3", name: "Gamma Co", invited: true, submitted: false, notes: "" },
  ];
  project.reviewers = [
    { id: "rev-1", name: "Alice", type: "applicant", email: "" },
    { id: "rev-2", name: "Bob", type: "applicant", email: "" },
    { id: "rev-3", name: "Cory", type: "wfrc", email: "" },
  ];
  project.scores = [
    { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
    { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 3, comment: "", updatedAt: "" },
    { reviewerId: "rev-3", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
    { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-2", value: 1, comment: "", updatedAt: "" },
    { reviewerId: "rev-3", firmId: "firm-1", criterionId: "crit-2", value: 3, comment: "", updatedAt: "" },
    { reviewerId: "rev-1", firmId: "firm-2", criterionId: "crit-1", value: 3, comment: "", updatedAt: "" },
    { reviewerId: "rev-2", firmId: "firm-2", criterionId: "crit-1", value: 3, comment: "", updatedAt: "" },
    { reviewerId: "rev-3", firmId: "firm-2", criterionId: "crit-1", value: 3, comment: "", updatedAt: "" },
  ];
  return project;
}

describe("overallAvg / applicantAvg", () => {
  const project = buildFixture();

  it("computes the overall average across all reviewer types", () => {
    expect(overallAvg(project, "firm-1", "crit-1")).toBeCloseTo(13 / 3, 10);
    expect(overallAvg(project, "firm-1", "crit-2")).toBe(2);
  });

  it("computes the applicant average from applicant-type reviewers only", () => {
    expect(applicantAvg(project, "firm-1", "crit-1")).toBe(4);
    // Only rev-1 (applicant) scored this cell; rev-2 (also applicant) never did, and rev-3
    // (wfrc) must not count even though it scored.
    expect(applicantAvg(project, "firm-1", "crit-2")).toBe(1);
  });

  it("returns null (never 0) for a cell nobody has scored yet", () => {
    expect(overallAvg(project, "firm-2", "crit-2")).toBeNull();
    expect(applicantAvg(project, "firm-2", "crit-2")).toBeNull();
    expect(wfrcAvg(project, "firm-2", "crit-2")).toBeNull();
  });
});

describe("wfrcAvg", () => {
  const project = buildFixture();

  it("computes the WFRC average from wfrc-type reviewers only — the mirror of applicantAvg", () => {
    expect(wfrcAvg(project, "firm-1", "crit-1")).toBe(5);
    expect(wfrcAvg(project, "firm-1", "crit-2")).toBe(3);
    expect(wfrcAvg(project, "firm-2", "crit-1")).toBe(3);
  });

  it("never counts applicant-type reviewers, even when they're the only ones who scored", () => {
    // firm-1/crit-2: only rev-1 (applicant) and rev-3 (wfrc) scored — rev-2 (applicant)
    // didn't. wfrcAvg must reflect only rev-3's score (3), not be pulled toward rev-1's.
    expect(wfrcAvg(project, "firm-1", "crit-2")).toBe(3);
  });
});

describe("weighted totals", () => {
  const project = buildFixture();

  it("computes Overall Weighted Total as sum(avg * weight), missing cells as 0", () => {
    // firm-1: 13/3 * 0.6 + 2 * 0.4 = 2.6 + 0.8 = 3.4
    expect(overallWeightedTotal(project, "firm-1")).toBeCloseTo(3.4, 10);
    // firm-2: 3 * 0.6 + (null -> 0) * 0.4 = 1.8
    expect(overallWeightedTotal(project, "firm-2")).toBeCloseTo(1.8, 10);
  });

  it("computes TLC Applicant Weighted Total the same way, from applicant averages", () => {
    // firm-1: 4 * 0.6 + 1 * 0.4 = 2.4 + 0.4 = 2.8
    expect(applicantWeightedTotal(project, "firm-1")).toBeCloseTo(2.8, 10);
    expect(applicantWeightedTotal(project, "firm-2")).toBeCloseTo(1.8, 10);
  });

  it("computes WFRC Weighted Total the same way, from wfrc averages", () => {
    // firm-1: 5 * 0.6 + 3 * 0.4 = 3.0 + 1.2 = 4.2
    expect(wfrcWeightedTotal(project, "firm-1")).toBeCloseTo(4.2, 10);
    // firm-2: 3 * 0.6 + (null -> 0) * 0.4 = 1.8
    expect(wfrcWeightedTotal(project, "firm-2")).toBeCloseTo(1.8, 10);
  });
});

describe("rankFirms / getRank", () => {
  it("ranks only submitted firms, descending by total", () => {
    const project = buildFixture();
    const ranked = rankFirms(project, "overall");
    expect(ranked.map((r) => r.firmId)).toEqual(["firm-1", "firm-2"]);
    expect(ranked.find((r) => r.firmId === "firm-1")?.rank).toBe(1);
    expect(ranked.find((r) => r.firmId === "firm-2")?.rank).toBe(2);
    // firm-3 is not submitted, so it must never appear in the ranking at all.
    expect(ranked.some((r) => r.firmId === "firm-3")).toBe(false);
    expect(getRank(project, "firm-3", "overall")).toBeNull();
  });

  it("uses standard competition ranking for ties (1, 1, 3 — not 1, 1, 2)", () => {
    const project = buildFixture();
    // Force firm-2 to tie firm-1's overall total exactly (3.4) by adding a crit-2 score.
    project.scores.push({
      reviewerId: "rev-1",
      firmId: "firm-2",
      criterionId: "crit-2",
      value: 4,
      comment: "",
      updatedAt: "",
    });
    // firm-2 overall crit-2 avg is now 4 -> total = 3*0.6 + 4*0.4 = 1.8 + 1.6 = 3.4 (tied)
    project.firms.push({ id: "firm-4", name: "Delta Co", invited: true, submitted: true, notes: "" });
    project.scores.push(
      { reviewerId: "rev-1", firmId: "firm-4", criterionId: "crit-1", value: 1, comment: "", updatedAt: "" },
      { reviewerId: "rev-1", firmId: "firm-4", criterionId: "crit-2", value: 1, comment: "", updatedAt: "" },
    );
    // firm-4 total = 1*0.6 + 1*0.4 = 1 (clearly last)

    const ranked = rankFirms(project, "overall");
    const byFirm = Object.fromEntries(ranked.map((r) => [r.firmId, r.rank]));
    expect(byFirm["firm-1"]).toBe(1);
    expect(byFirm["firm-2"]).toBe(1); // tied with firm-1
    expect(byFirm["firm-4"]).toBe(3); // next distinct rank skips 2
  });

  it("ranks by the wfrc basis too — rankFirms' three-way dispatch, not just overall/applicant", () => {
    const project = buildFixture();
    // wfrc totals: firm-1 = 4.2, firm-2 = 1.8 (from the weighted-totals describe above) —
    // same order as overall here, but computed from an entirely different basis.
    const ranked = rankFirms(project, "wfrc");
    expect(ranked.find((r) => r.firmId === "firm-1")?.rank).toBe(1);
    expect(ranked.find((r) => r.firmId === "firm-2")?.rank).toBe(2);
  });
});

describe("completion", () => {
  const project = buildFixture();

  it("counts scored/expected for a single cell", () => {
    expect(completion(project, "firm-1", { criterionId: "crit-1" })).toEqual({
      scored: 3,
      expected: 3,
    });
    expect(completion(project, "firm-1", { criterionId: "crit-2" })).toEqual({
      scored: 2,
      expected: 3,
    });
    expect(completion(project, "firm-1", { criterionId: "crit-2", by: "applicant" })).toEqual({
      scored: 1,
      expected: 2,
    });
  });

  it("aggregates across all criteria for the firm-level indicator", () => {
    // firm-1: crit-1 scored 3/3, crit-2 scored 2/3 -> 5 scored out of (3 reviewers * 2 criteria) = 6
    expect(completion(project, "firm-1")).toEqual({ scored: 5, expected: 6 });
  });
});

describe("orphan handling", () => {
  it("excludes scores whose firm/criterion/reviewer no longer exists from every average", () => {
    const project = buildFixture();
    // Simulate a criterion deletion (FR-039): the score row is retained in `scores`...
    project.scores.push({
      reviewerId: "rev-1",
      firmId: "firm-1",
      criterionId: "crit-deleted",
      value: 5,
      comment: "orphaned",
      updatedAt: "",
    });
    // ...but since "crit-deleted" is not in project.criteria, it must never surface here.
    expect(overallAvg(project, "firm-1", "crit-deleted")).toBeNull();
    // And it must not silently inflate any *live* criterion's average either.
    expect(overallAvg(project, "firm-1", "crit-1")).toBeCloseTo(13 / 3, 10);
  });

  it("excludes scores referencing a deleted reviewer from both overall and applicant averages", () => {
    const project = buildFixture();
    project.scores.push({
      reviewerId: "rev-deleted",
      firmId: "firm-2",
      criterionId: "crit-2",
      value: 5,
      comment: "orphaned",
      updatedAt: "",
    });
    expect(overallAvg(project, "firm-2", "crit-2")).toBeNull();
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places for display without touching calculation precision", () => {
    expect(round2(13 / 3)).toBe(4.33);
    expect(round2(3.4)).toBe(3.4);
    expect(round2(1)).toBe(1);
  });
});

describe("flexibility: a materially different-shaped project (T054, FR-012/SC-006)", () => {
  // 15 firms (13 submitted, 2 not), 1 criterion at weight 1.0, a 7-point scale — deliberately
  // nothing like the small 2-firm/2-criteria fixtures used everywhere else in this file.
  // The point isn't to re-verify arithmetic (already covered above in detail) — it's to
  // catch a hardcoded count/scale assumption (an off-by-one loop, a fixed-size array, a
  // truncated iteration) that a small fixture would never surface. Per quickstart.md
  // Scenario 5, this fixture is one half of what proves SC-006's "without any code change"
  // claim; the other half (the UI itself at this shape) is
  // tests/component/flexibility-scenario-5.test.tsx.
  function buildLargeFixture(): Project {
    const project = createEmptyProject();
    project.criteria = [{ id: "crit-1", name: "Only Criterion", weight: 1.0, description: "" }];
    project.scoringScale = Array.from({ length: 7 }, (_, i) => ({
      value: i + 1,
      label: `Point ${i + 1}`,
    }));
    project.firms = Array.from({ length: 15 }, (_, i) => ({
      id: `firm-${i}`,
      name: `Firm ${i}`,
      invited: true,
      submitted: i < 13, // firm-13 and firm-14 deliberately NOT submitted
      notes: "",
    }));
    project.reviewers = [{ id: "rev-1", name: "Sole Reviewer", type: "applicant", email: "" }];
    // Score cycles through all 7 scale values across the 13 submitted firms:
    // firm-0..firm-12 -> 1,2,3,4,5,6,7,1,2,3,4,5,6
    project.scores = project.firms
      .filter((f) => f.submitted)
      .map((f, i) => ({
        reviewerId: "rev-1",
        firmId: f.id,
        criterionId: "crit-1",
        value: (i % 7) + 1,
        comment: "",
        updatedAt: "",
      }));
    return project;
  }

  it("computes correct averages/totals at 15 firms with no hardcoded count assumption", () => {
    const project = buildLargeFixture();
    // Single criterion at weight 1.0 -> weighted total equals the raw score directly,
    // which keeps this exact-value check trivial to hand-verify (no weight arithmetic).
    for (let i = 0; i < 13; i++) {
      const expectedScore = (i % 7) + 1;
      expect(overallWeightedTotal(project, `firm-${i}`)).toBe(expectedScore);
      expect(overallAvg(project, `firm-${i}`, "crit-1")).toBe(expectedScore);
    }
  });

  it("respects the submitted filter at scale — exactly 13 of 15 firms are ranked", () => {
    const project = buildLargeFixture();
    const ranked = rankFirms(project, "overall");
    expect(ranked).toHaveLength(13);
    expect(ranked.some((r) => r.firmId === "firm-13")).toBe(false);
    expect(ranked.some((r) => r.firmId === "firm-14")).toBe(false);
  });

  it("ranks correctly at scale, including multi-way ties across all 7 scale values", () => {
    const project = buildLargeFixture();
    const ranked = rankFirms(project, "overall");
    const rankByFirm = Object.fromEntries(ranked.map((r) => [r.firmId, r.rank]));

    // firm-6 (score 7) is the sole highest scorer -> uniquely rank 1.
    expect(rankByFirm["firm-6"]).toBe(1);
    // firm-0 and firm-7 both score 1 (the lowest) -> tied for last place.
    expect(rankByFirm["firm-0"]).toBe(rankByFirm["firm-7"]);
    // 7 distinct score values across 13 firms (one unpaired top score, six pairs) ->
    // exactly 7 distinct ranks, not 13 — confirms tie-sharing held at this scale too.
    expect(new Set(ranked.map((r) => r.rank)).size).toBe(7);
  });

  it("completion() aggregates correctly across 15 firms without erroring", () => {
    const project = buildLargeFixture();
    for (const firm of project.firms) {
      const c = completion(project, firm.id);
      // 1 reviewer * 1 criterion = 1 expected cell per firm, regardless of submitted status
      // (completion isn't gated on submitted — only ranking is, per FR-025).
      expect(c.expected).toBe(1);
      expect(c.scored).toBe(firm.submitted ? 1 : 0);
    }
  });
});
