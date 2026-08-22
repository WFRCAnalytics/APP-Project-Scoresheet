// Regression test for a manual-testing bug found after the theme-color-refresh fix: in
// light mode, hover elevation (a box-shadow lift on interactive cards) and the modal
// backdrop dim were both clearly visible; in dark mode, neither was — both silently became
// no-ops. Root cause for both, at once: --shadow-color (tokens.css) was a single value
// (the RGB triplet "8 27 38") reused unchanged in both light and dark mode, and "8 27 38"
// is bit-identical to dark mode's own --color-background (#081b26 = rgb(8, 27, 38)) — a
// shadow "tinted" with the exact color of the surface it's supposed to darken has zero
// contrast against that surface, not just low contrast. --overlay-backdrop (the modal
// backdrop) is derived from the same --shadow-color, so it had the identical bug for the
// identical reason.
//
// What's mechanically testable here, and what isn't (being direct about the difference,
// same standard as the print-preview check): a CSS custom property's own resolved VALUE
// differing between light/dark data-theme is testable, exactly like contrast.test.ts does
// for colors. Whether a human eye actually perceives a given rgba()-composited pixel as
// "darker" or "dimmed enough" is not something this test suite can assert — that part was
// confirmed by hand, in the real running app (see the PR/commit description), not here.
// This test's job is narrower and mechanical: prove the specific bug (shadow color ==
// background color) can't silently come back, and that dark mode actually overrides the
// elevation tokens rather than inheriting the light-mode values unchanged.

import { describe, expect, it } from "vitest";
import { hexToRgb } from "../../src/lib/contrast";
import { loadTokens } from "../helpers/tokensCss";

/** "8 27 38" -> [8, 27, 38]. --shadow-color's own format (a bare, space-separated RGB
 * triplet meant for rgb(var(--shadow-color) / alpha)), distinct from the "#rrggbb" hex
 * format --color-background etc. use — the two need converting to a common shape to
 * compare against each other. */
function parseRgbTriplet(value: string): [number, number, number] {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`expected a "R G B" triplet, got "${value}"`);
  }
  return [parts[0], parts[1], parts[2]];
}

describe("theme/tokens.css elevation tokens are dark-mode-visible", () => {
  const { light, dark } = loadTokens();

  it("--shadow-color is defined in both modes and differs between them", () => {
    expect(light["shadow-color"]).toBeDefined();
    expect(dark["shadow-color"]).toBeDefined();
    expect(dark["shadow-color"]).not.toBe(light["shadow-color"]);
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)(
    "%s mode: --shadow-color is NOT the same color as --color-background (the exact bug found)",
    (_modeName, tokens) => {
      const shadowRgb = parseRgbTriplet(tokens["shadow-color"]);
      const backgroundRgb = hexToRgb(tokens["color-background"]);
      expect(shadowRgb).not.toEqual(backgroundRgb);
    },
  );

  it("dark mode's --shadow-color is darker than dark mode's --color-background (so a shadow actually reads as elevation, not just \"different\")", () => {
    const [sr, sg, sb] = parseRgbTriplet(dark["shadow-color"]);
    const [br, bg, bb] = hexToRgb(dark["color-background"]);
    const shadowLuma = sr + sg + sb;
    const backgroundLuma = br + bg + bb;
    expect(shadowLuma).toBeLessThan(backgroundLuma);
  });

  it("--shadow-ring is a no-op in light mode but a real, visible layer in dark mode", () => {
    // Light mode: explicitly documented as a no-op (zero spread, transparent) — shadows
    // alone already read against a light background, no extra ring layer needed there.
    expect(light["shadow-ring"]).toBe("0 0 0 0 transparent");
    // Dark mode overrides it to a real color-mix()-composed ring, not the light-mode
    // no-op (zero spread, fully transparent) carried over unchanged.
    expect(dark["shadow-ring"]).not.toBe(light["shadow-ring"]);
    expect(dark["shadow-ring"]).not.toBe("0 0 0 0 transparent");
    expect(dark["shadow-ring"]).toContain("color-mix");
  });

  it("--shadow-sm/md/lg all incorporate --shadow-ring as their first layer", () => {
    for (const key of ["shadow-sm", "shadow-md", "shadow-lg"]) {
      expect(light[key]).toContain("var(--shadow-ring)");
    }
  });

  it("--overlay-backdrop (the modal backdrop) is derived from --shadow-color, so it inherits the same dark-mode fix", () => {
    expect(light["overlay-backdrop"]).toContain("var(--shadow-color)");
  });

  // Follow-up manual-testing finding: the resting ring + lift + shadow deepening together
  // still read as too subtle a hover cue in dark mode. --shadow-ring-hover
  // (.card--interactive:hover only, app.css) is a stronger, hover-only ring layered on
  // top — same no-op-in-light-mode pattern as --shadow-ring, but genuinely stronger than
  // it in dark mode (not just "different"), so hovering is clearly distinguishable from
  // every card's shared resting-state ring.
  describe("--shadow-ring-hover (hover-only, stronger than the resting ring)", () => {
    /** "0 0 0 2px color-mix(in srgb, var(--color-foreground) 24%, transparent)" ->
     * { spreadPx: 2, opacityPct: 24 }. */
    function parseRing(value: string): { spreadPx: number; opacityPct: number } {
      const match = value.match(
        /^0 0 0 ([\d.]+)px color-mix\(in srgb, var\(--color-foreground\) ([\d.]+)%, transparent\)$/,
      );
      if (!match) throw new Error(`expected a ring color-mix() expression, got "${value}"`);
      return { spreadPx: Number(match[1]), opacityPct: Number(match[2]) };
    }

    it("is a no-op in light mode, same as the resting ring", () => {
      expect(light["shadow-ring-hover"]).toBe("0 0 0 0 transparent");
      expect(light["shadow-ring-hover"]).toBe(light["shadow-ring"]);
    });

    it("is strictly stronger (more opaque AND thicker) than the resting ring in dark mode", () => {
      const resting = parseRing(dark["shadow-ring"]);
      const hover = parseRing(dark["shadow-ring-hover"]);
      expect(hover.opacityPct).toBeGreaterThan(resting.opacityPct);
      expect(hover.spreadPx).toBeGreaterThan(resting.spreadPx);
    });
  });
});
