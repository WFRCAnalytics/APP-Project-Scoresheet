// Diverging red -> yellow -> green scale for the Calculations heatmap. Endpoints are raw
// hex values already used elsewhere in tokens.css — --chart-6 (red), --color-wfrc-yellow,
// --chart-2 (green) — sourced, not invented (constitution Principle VII). Anchored to the
// project's CONFIGURED scoring scale range (min/max of scoringScale[].value), not the
// observed min/max of scores collected so far: if the scale re-normalized itself as scores
// trickled in, the same raw score could be colored differently on day 1 vs. day 5 of
// collection, which risks a partial result being misread as more final than it is — the
// same "never mistake partial for final" concern FR-030 already governs elsewhere.

import { contrastRatio } from "../lib/contrast";

const RED = { r: 0xc2, g: 0x3c, b: 0x33 }; // --chart-6 (rtp-red)
const YELLOW = { r: 0xf8, g: 0xb9, b: 0x3e }; // --color-wfrc-yellow
const GREEN = { r: 0x78, g: 0x9d, b: 0x4b }; // --chart-2 (rtp-green)

export const HEATMAP_RED_HEX = "#c23c33";
export const HEATMAP_YELLOW_HEX = "#f8b93e";
export const HEATMAP_GREEN_HEX = "#789d4b";

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(c: { r: number; g: number; b: number }): string {
  return `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** t in [0, 1]: 0 = red, 0.5 = yellow, 1 = green. */
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    const localT = clamped / 0.5;
    return toHex({
      r: lerp(RED.r, YELLOW.r, localT),
      g: lerp(RED.g, YELLOW.g, localT),
      b: lerp(RED.b, YELLOW.b, localT),
    });
  }
  const localT = (clamped - 0.5) / 0.5;
  return toHex({
    r: lerp(YELLOW.r, GREEN.r, localT),
    g: lerp(YELLOW.g, GREEN.g, localT),
    b: lerp(YELLOW.b, GREEN.b, localT),
  });
}

/** Maps a raw score value to a background hex on the diverging scale, anchored to
 * [scaleMin, scaleMax] (the project's configured scoring scale, not observed data). A
 * degenerate 1-point scale (min === max) resolves to the neutral middle color rather than
 * dividing by zero. */
export function heatmapBackgroundFor(value: number, scaleMin: number, scaleMax: number): string {
  if (scaleMax === scaleMin) return heatColor(0.5);
  const t = (value - scaleMin) / (scaleMax - scaleMin);
  return heatColor(t);
}

/** Picks whichever of black/white gives higher contrast against the given background —
 * reuses the same contrast math tokens.css's own AA verification uses (lib/contrast.ts)
 * rather than a second, ad hoc luminance check, since the heatmap's background changes
 * continuously and a single fixed text color can't stay readable across the whole scale. */
export function heatmapTextColorFor(backgroundHex: string): string {
  const blackContrast = contrastRatio("#000000", backgroundHex);
  const whiteContrast = contrastRatio("#ffffff", backgroundHex);
  return whiteContrast > blackContrast ? "#ffffff" : "#000000";
}
