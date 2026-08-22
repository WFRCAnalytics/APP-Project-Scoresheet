// Regression test for a manual-sweep finding: .banner-error's tinted fill (--banner-error-
// background, tokens.css) read measurably weaker against the page background in dark mode
// than in light mode — 1.15:1 vs 1.35:1, both already weak, but dark mode meaningfully
// worse — the same "numerically different, visually collapses" family as the chart/modal/
// shadow fixes, just showing up as a bigger gap between modes rather than a total collapse
// (the border, --color-danger at full strength in both modes, is what actually carries the
// "this is an error" signal either way; text stays enormously safe in both modes too — this
// is specifically about the fill reading as a distinct region, not a legibility failure).
//
// Fixed by giving dark mode a stronger color-mix() percentage (45% vs light's 20%) rather
// than changing --color-danger itself (deliberately identical, already vivid, in both
// modes) — mirrors how .banner-warning's dark mode already ends up stronger than its light
// mode, just achieved explicitly here instead of as an emergent property of mixing a bright
// color into differently-dark surfaces (danger's mid-dark red doesn't get that same boost
// for free, hence needing its own per-mode percentage).

import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/lib/contrast";
import { loadTokens, mixHexInSrgb } from "../helpers/tokensCss";

/** "color-mix(in srgb, var(--color-danger) 45%, var(--color-background))" -> 45.
 * --banner-error-background is a composite expression (not a bare var()), so loadTokens()
 * leaves it as this raw string — the percentage has to be pulled out of it directly rather
 * than relying on loadTokens()'s var()-only resolution. */
function extractMixPercent(value: string): number {
  const match = value.match(/color-mix\(in srgb, var\(--color-danger\) (\d+(?:\.\d+)?)%,/);
  if (!match) throw new Error(`expected a color-mix() expression, got "${value}"`);
  return Number(match[1]);
}

describe(".banner-error background reads at least as distinctly in dark mode as in light", () => {
  const { light, dark } = loadTokens();

  it("dark mode uses a stronger mix percentage than light mode (not the same value carried over)", () => {
    const lightPct = extractMixPercent(light["banner-error-background"]);
    const darkPct = extractMixPercent(dark["banner-error-background"]);
    expect(darkPct).toBeGreaterThan(lightPct);
  });

  it("the resulting dark-mode fill contrasts against the dark background at least as strongly as light's fill does against the light background (the exact regression found)", () => {
    const lightPct = extractMixPercent(light["banner-error-background"]);
    const darkPct = extractMixPercent(dark["banner-error-background"]);

    const lightFill = mixHexInSrgb(light["color-danger"], light["color-background"], lightPct);
    const darkFill = mixHexInSrgb(dark["color-danger"], dark["color-background"], darkPct);

    const lightContrast = contrastRatio(lightFill, light["color-background"]);
    const darkContrast = contrastRatio(darkFill, dark["color-background"]);

    expect(darkContrast).toBeGreaterThanOrEqual(lightContrast);
  });

  it("text on the dark-mode fill stays comfortably legible (no legibility trade-off from the stronger mix)", () => {
    const darkPct = extractMixPercent(dark["banner-error-background"]);
    const darkFill = mixHexInSrgb(dark["color-danger"], dark["color-background"], darkPct);
    expect(contrastRatio(dark["color-foreground"], darkFill)).toBeGreaterThanOrEqual(4.5);
  });
});
