// Unit tests for lib/scoreScale.ts — the shared discrete/continuous score validation both
// parseWorkbook.ts (Excel import) and ManualEntryGrid.tsx (manual entry) go through, so the
// two entry paths can't drift on what counts as a valid score.

import { describe, expect, it } from "vitest";
import { normalizeScoreValue, scaleRange, weightedTotalRange } from "../../src/lib/scoreScale";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildProject(mode: "discrete" | "continuous"): Project {
  const project = createEmptyProject();
  project.scoringScaleMode = mode;
  project.scoringScale = [
    { value: 1, label: "Poor" },
    { value: 3, label: "Average" },
    { value: 5, label: "Excellent" },
  ];
  return project;
}

function withWeights(project: Project, weights: number[]): Project {
  project.criteria = weights.map((weight, i) => ({
    id: `crit-${i}`,
    name: `Criterion ${i}`,
    weight,
    description: "",
  }));
  return project;
}

describe("weightedTotalRange", () => {
  it("is the scale min/max times the weight sum", () => {
    const project = withWeights(buildProject("continuous"), [0.5, 0.5]);
    expect(weightedTotalRange(project)).toEqual({ min: 1, max: 5 });
  });

  it("drops floating-point noise from the weight sum (a real project: 0.3 + 0.4 + 0.2 + 0.1)", () => {
    // These weights sum to 0.9999999999999999 in floating point, which used to put
    // "0.9999999999999999" and "4.999999999999999" on the bar chart's Y-axis.
    expect(0.3 + 0.4 + 0.2 + 0.1).not.toBe(1);
    const project = withWeights(buildProject("continuous"), [0.3, 0.4, 0.2, 0.1]);
    expect(weightedTotalRange(project)).toEqual({ min: 1, max: 5 });
  });

  it("keeps a genuinely different weight sum (weights not yet summing to 1)", () => {
    const project = withWeights(buildProject("continuous"), [0.45, 0.45]);
    expect(weightedTotalRange(project)).toEqual({ min: 0.9, max: 4.5 });
  });

  it("is 0 to 0 with no criteria or no scale, rather than NaN", () => {
    expect(weightedTotalRange(buildProject("continuous"))).toEqual({ min: 0, max: 0 });
    const noScale = withWeights(createEmptyProject(), [1]);
    expect(weightedTotalRange(noScale)).toEqual({ min: 0, max: 0 });
  });
});

describe("scaleRange", () => {
  it("returns the min/max of the configured points, regardless of insertion order", () => {
    const project = buildProject("continuous");
    project.scoringScale = [
      { value: 3, label: "Average" },
      { value: 1, label: "Poor" },
      { value: 5, label: "Excellent" },
    ];
    expect(scaleRange(project)).toEqual({ min: 1, max: 5 });
  });

  it("degenerates to {0, 0} for an empty scale rather than throwing", () => {
    const project = buildProject("continuous");
    project.scoringScale = [];
    expect(scaleRange(project)).toEqual({ min: 0, max: 0 });
  });
});

describe("normalizeScoreValue — discrete mode", () => {
  const project = buildProject("discrete");

  it("accepts an exact configured value", () => {
    expect(normalizeScoreValue(project, 3)).toBe(3);
  });

  it("rejects a value that isn't one of the configured points, even if in range", () => {
    expect(normalizeScoreValue(project, 2)).toBeNull(); // between 1 and 5, but not listed
    expect(normalizeScoreValue(project, 4)).toBeNull();
  });

  it("rejects an out-of-range value", () => {
    expect(normalizeScoreValue(project, 0)).toBeNull();
    expect(normalizeScoreValue(project, 99)).toBeNull();
  });

  it("never rounds — discrete has no notion of a decimal step", () => {
    expect(normalizeScoreValue(project, 3.0)).toBe(3); // 3.0 === 3, still an exact match
    expect(normalizeScoreValue(project, 3.1)).toBeNull(); // not an exact configured value
  });
});

describe("normalizeScoreValue — continuous mode", () => {
  const project = buildProject("continuous"); // range [1, 5] from the same 1/3/5 points

  it("accepts any value within [min, max], not just the configured points", () => {
    expect(normalizeScoreValue(project, 1)).toBe(1);
    expect(normalizeScoreValue(project, 5)).toBe(5);
    expect(normalizeScoreValue(project, 2)).toBe(2); // between points — invalid in discrete,
    // valid here since the configured points are just labeled anchors
    expect(normalizeScoreValue(project, 3.7)).toBe(3.7);
  });

  it("rounds to one decimal place instead of rejecting extra precision", () => {
    expect(normalizeScoreValue(project, 3.14)).toBe(3.1);
    expect(normalizeScoreValue(project, 3.16)).toBe(3.2);
    expect(normalizeScoreValue(project, 1.05)).toBeCloseTo(1.1, 10);
  });

  it("rejects values outside [min, max] — rounding never rescues an out-of-range value", () => {
    expect(normalizeScoreValue(project, 0.9)).toBeNull();
    expect(normalizeScoreValue(project, 5.1)).toBeNull();
  });

  it("accepts the exact boundary values", () => {
    expect(normalizeScoreValue(project, 1.0)).toBe(1);
    expect(normalizeScoreValue(project, 5.0)).toBe(5);
  });
});

describe("normalizeScoreValue — non-finite input", () => {
  it("rejects NaN/Infinity in either mode", () => {
    const discrete = buildProject("discrete");
    const continuous = buildProject("continuous");
    expect(normalizeScoreValue(discrete, NaN)).toBeNull();
    expect(normalizeScoreValue(continuous, NaN)).toBeNull();
    expect(normalizeScoreValue(continuous, Infinity)).toBeNull();
  });
});
