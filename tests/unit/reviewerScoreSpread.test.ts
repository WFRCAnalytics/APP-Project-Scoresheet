// 004 post-launch improvements, item 2: unit coverage for ReviewerScoreSpreadChart's pure
// data-shaping helpers. The original plan called for component-level-only tests (matching
// rankedRows.ts's precedent), but writing those first surfaced a real environmental limit
// worth being direct about: jsdom's ResponsiveContainer always measures 0x0, so Recharts
// renders zero scatter dots/legend items for ANY chart in this whole test suite (verified
// empirically against the existing OverallCityBarChart/CriterionBreakdownChart too, not
// specific to this component) — there is no rendered SVG a component test could inspect to
// prove the per-dot math is correct. `buildSpreadPoints`/`jitterOffsetFor` were exported
// specifically so this math has real, direct coverage instead of being unverifiable.

import { describe, expect, it } from "vitest";
import { buildSpreadPoints, jitterOffsetFor } from "../../src/features/dashboard/reviewerScoreSpread";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildProject(): Project {
  const project = createEmptyProject();
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [
    { id: "c1", name: "Approach", weight: 0.6, description: "" },
    { id: "c2", name: "Cost", weight: 0.4, description: "" },
  ];
  project.firms = [
    { id: "f1", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    { id: "f2", name: "Beta Co", invited: true, submitted: true, notes: "" },
  ];
  project.reviewers = [
    { id: "r1", name: "Alice", type: "city", email: "" },
    { id: "r2", name: "Bob", type: "wfrc", email: "" },
    { id: "r3", name: "Carol", type: "city", email: "" },
  ];
  return project;
}

describe("jitterOffsetFor", () => {
  it("returns 0 for a single reviewer (nothing to spread apart)", () => {
    expect(jitterOffsetFor(0, 1)).toBe(0);
  });

  it("is symmetric around 0 for two reviewers — one slightly left, one slightly right", () => {
    const left = jitterOffsetFor(0, 2);
    const right = jitterOffsetFor(1, 2);
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(0);
    expect(left).toBeCloseTo(-right, 10);
  });

  it("gives every reviewer index a distinct offset, so no two reviewers ever collide in x", () => {
    const count = 6;
    const offsets = Array.from({ length: count }, (_, i) => jitterOffsetFor(i, count));
    expect(new Set(offsets).size).toBe(count);
  });

  it("never exceeds the documented max spread regardless of reviewer count", () => {
    for (const count of [2, 3, 5, 10]) {
      for (let i = 0; i < count; i++) {
        expect(Math.abs(jitterOffsetFor(i, count))).toBeLessThanOrEqual(0.3 + 1e-9);
      }
    }
  });
});

describe("buildSpreadPoints", () => {
  it("plots one point per live score, with the right criterion index, score value, reviewer name/type, and criterion name", () => {
    const project = buildProject();
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "r2", firmId: "f1", criterionId: "c2", value: 1, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    const points = buildSpreadPoints(project, "f1");
    expect(points).toHaveLength(2);

    const alicePoint = points.find((p) => p.reviewerName === "Alice")!;
    expect(alicePoint.y).toBe(5);
    expect(alicePoint.reviewerType).toBe("city");
    expect(alicePoint.criterionName).toBe("Approach");
    // Criterion index 0 (Approach) plus a small jitter (< 0.5 in magnitude, never crossing
    // into an adjacent criterion's lane) — checked as a range rather than a rounded exact
    // value, since a small negative jitter can legitimately round to -0.
    expect(alicePoint.x).toBeGreaterThan(-0.5);
    expect(alicePoint.x).toBeLessThan(0.5);

    const bobPoint = points.find((p) => p.reviewerName === "Bob")!;
    expect(bobPoint.y).toBe(1);
    expect(bobPoint.reviewerType).toBe("wfrc");
    expect(bobPoint.criterionName).toBe("Cost");
    expect(bobPoint.x).toBeGreaterThan(0.5); // criterion index 1 (Cost) plus a small jitter
    expect(bobPoint.x).toBeLessThan(1.5);
  });

  it("only includes scores for the requested firm, not other firms", () => {
    const project = buildProject();
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "r1", firmId: "f2", criterionId: "c1", value: 2, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    const points = buildSpreadPoints(project, "f1");
    expect(points).toHaveLength(1);
    expect(points[0].y).toBe(5);
  });

  it("excludes a score whose reviewerId no longer resolves to a live reviewer (orphaned reference)", () => {
    const project = buildProject();
    project.scores = [
      {
        reviewerId: "rev-does-not-exist",
        firmId: "f1",
        criterionId: "c1",
        value: 3,
        comment: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    const points = buildSpreadPoints(project, "f1");
    expect(points).toHaveLength(1);
    expect(points[0].reviewerName).toBe("Alice");
  });

  it("excludes a score whose criterionId no longer resolves to a live criterion (implicit, via iterating only live criteria)", () => {
    const project = buildProject();
    project.scores = [
      {
        reviewerId: "r1",
        firmId: "f1",
        criterionId: "crit-does-not-exist",
        value: 3,
        comment: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    expect(buildSpreadPoints(project, "f1")).toHaveLength(0);
  });

  it("gives the SAME reviewer the SAME relative jitter offset across different criteria (so their dots line up horizontally)", () => {
    const project = buildProject();
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "r1", firmId: "f1", criterionId: "c2", value: 4, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];

    const points = buildSpreadPoints(project, "f1");
    const [approachPoint, costPoint] = points;
    // Both are Alice's points, one criterion index apart — their fractional jitter offset
    // (the part after the integer criterion index) must be identical.
    expect(approachPoint.x - Math.round(approachPoint.x)).toBeCloseTo(
      costPoint.x - Math.round(costPoint.x),
      10,
    );
  });

  it("returns an empty array when this firm has no live scores at all", () => {
    const project = buildProject();
    project.scores = [];
    expect(buildSpreadPoints(project, "f1")).toEqual([]);
  });
});
