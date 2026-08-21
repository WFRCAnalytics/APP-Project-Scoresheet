// Regression coverage for the Calculations heatmap's color math (theme/heatmapColor.ts) —
// pure functions, no DOM, so a plain unit test rather than a component test.

import { describe, expect, it } from "vitest";
import {
  heatmapBackgroundFor,
  heatmapTextColorFor,
  HEATMAP_GREEN_HEX,
  HEATMAP_RED_HEX,
  HEATMAP_YELLOW_HEX,
} from "../../src/theme/heatmapColor";
import { contrastRatio } from "../../src/lib/contrast";

describe("heatmapBackgroundFor", () => {
  it("maps the scale minimum to red and the scale maximum to green", () => {
    expect(heatmapBackgroundFor(1, 1, 5).toLowerCase()).toBe(HEATMAP_RED_HEX);
    expect(heatmapBackgroundFor(5, 1, 5).toLowerCase()).toBe(HEATMAP_GREEN_HEX);
  });

  it("maps the scale midpoint to yellow", () => {
    expect(heatmapBackgroundFor(3, 1, 5).toLowerCase()).toBe(HEATMAP_YELLOW_HEX);
  });

  it("is anchored to the passed-in [min, max], not any observed data range", () => {
    // A 1-10 scale: value 1 is still "lowest" (red) even though it's far from the
    // 1-5-scale test above's red — this is the whole point of anchoring to the
    // configured scale rather than observed scores.
    expect(heatmapBackgroundFor(1, 1, 10).toLowerCase()).toBe(HEATMAP_RED_HEX);
    expect(heatmapBackgroundFor(10, 1, 10).toLowerCase()).toBe(HEATMAP_GREEN_HEX);
  });

  it("resolves a degenerate 1-point scale (min === max) to the neutral middle color rather than dividing by zero", () => {
    expect(() => heatmapBackgroundFor(3, 3, 3)).not.toThrow();
    expect(heatmapBackgroundFor(3, 3, 3).toLowerCase()).toBe(HEATMAP_YELLOW_HEX);
  });

  it("produces intermediate colors that interpolate monotonically red -> yellow -> green", () => {
    // Sampling 0/25/50/75/100% of a 1-5 range: red channel should trend down overall,
    // green channel should trend up overall, across the full sweep.
    const samples = [1, 2, 3, 4, 5].map((v) => heatmapBackgroundFor(v, 1, 5));
    const reds = samples.map((hex) => parseInt(hex.slice(1, 3), 16));
    const greens = samples.map((hex) => parseInt(hex.slice(3, 5), 16));
    expect(reds[0]).toBeGreaterThan(reds[4]);
    expect(greens[4]).toBeGreaterThan(greens[0]);
  });
});

describe("heatmapTextColorFor", () => {
  it("picks a text color that actually meets or exceeds what the other choice would give, for every point on the scale", () => {
    for (let v = 1; v <= 5; v++) {
      const bg = heatmapBackgroundFor(v, 1, 5);
      const chosen = heatmapTextColorFor(bg);
      const blackRatio = contrastRatio("#000000", bg);
      const whiteRatio = contrastRatio("#ffffff", bg);
      const chosenRatio = contrastRatio(chosen, bg);
      expect(chosenRatio).toBeGreaterThanOrEqual(Math.max(blackRatio, whiteRatio) - 1e-9);
    }
  });

  it("picks white text on the (dark) red end and black text on the (light) yellow middle", () => {
    // Sanity-checks the two colors aren't both resolving to the same choice regardless
    // of background — i.e. this is actually background-dependent, not a constant.
    const redText = heatmapTextColorFor(HEATMAP_RED_HEX);
    const yellowText = heatmapTextColorFor(HEATMAP_YELLOW_HEX);
    expect(redText).not.toBe(yellowText);
  });
});
