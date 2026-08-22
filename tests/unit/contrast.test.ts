// T020: Automated WCAG 2.1 AA contrast check over src/theme/tokens.css (spec SC-010),
// in both light and dark mode. This parses the actual CSS file rather than a duplicated
// token list, so there is exactly one source of truth for the values — a color changed
// in tokens.css without a matching contrast fix will fail this test immediately instead
// of silently drifting.

import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio, hexToRgb } from "../../src/lib/contrast";
import { isHexColor, loadTokens } from "../helpers/tokensCss";

/** Mimics `color-mix(in srgb, a a%, b)`: a straight per-channel linear interpolation of the
 * two colors' already gamma-encoded (non-linear) sRGB byte values — that's what `in srgb`
 * means, as opposed to `in srgb-linear` — rounded to the nearest byte, same as browsers do.
 * Used to reproduce app.css's `.banner-success` background (a color-mix expression, not a
 * standalone token) here in the test, since it can't come from tokens.css's flat
 * `--name: value` custom-property list the rest of this file parses. */
function mixHexInSrgb(hexA: string, hexB: string, aPercent: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  const t = aPercent / 100;
  const mix = (a: number, b: number) => Math.round(a * t + b * (1 - t));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(ar, br))}${toHex(mix(ag, bg))}${toHex(mix(ab, bb))}`;
}

describe("theme/tokens.css meets WCAG 2.1 AA (SC-010)", () => {
  const { light, dark } = loadTokens();

  it("parsed both a light and a dark token set with real hex colors", () => {
    expect(isHexColor(light["color-foreground"])).toBe(true);
    expect(isHexColor(dark["color-foreground"])).toBe(true);
    // Confirms the dark override actually took effect and isn't just the light value.
    expect(dark["color-background"]).not.toBe(light["color-background"]);
  });

  const textPairs: Array<[string, string, string]> = [
    ["body text on page background", "color-foreground", "color-background"],
    ["heading color on page background", "color-heading", "color-background"],
    ["link color on page background", "color-link", "color-background"],
    ["primary-foreground on primary (button text)", "color-primary-foreground", "color-primary"],
    [
      "accent-foreground on accent-background (badge text)",
      "color-accent-foreground",
      "color-accent-background",
    ],
    ["code text on code background", "color-code-text", "color-code-background"],
    [
      "success-foreground on success background (badge text)",
      "color-success-foreground",
      "color-success",
    ],
    [
      "danger-foreground on danger background (badge text)",
      "color-danger-foreground",
      "color-danger",
    ],
    ["foreground on border (neutral badge text)", "color-foreground", "color-border"],
  ];

  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s mode", (_modeName, tokens) => {
    it.each(textPairs)("%s meets AA normal-text contrast (>= 4.5:1)", (_label, fgKey, bgKey) => {
      const fg = tokens[fgKey];
      const bg = tokens[bgKey];
      expect(isHexColor(fg), `${fgKey} should resolve to a hex color, got "${fg}"`).toBe(true);
      expect(isHexColor(bg), `${bgKey} should resolve to a hex color, got "${bg}"`).toBe(true);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });

  const CHART_NON_TEXT_THRESHOLD = 3.0; // WCAG 1.4.11 non-text/graphical-object contrast

  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s mode chart palette", (_modeName, tokens) => {
    const chartKeys = Object.keys(tokens).filter((k) => /^chart-\d+$/.test(k));

    it("has the full 18-color combined RTP + Wasatch Choice categorical palette", () => {
      expect(chartKeys.length).toBe(18);
    });

    it.each(chartKeys.sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1])))(
      "%s meets the non-text 3:1 threshold against the page background",
      (chartKey) => {
        const fg = tokens[chartKey];
        const bg = tokens["color-background"];
        expect(isHexColor(fg)).toBe(true);
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(CHART_NON_TEXT_THRESHOLD);
      },
    );
  });

  // 003 Dashboard redesign: the completion-status banner's new "results are final" state
  // (app.css .banner-success) — text color is plain --color-foreground, but the background
  // is a color-mix() composed at the component-CSS level, not a tokens.css custom property,
  // so it can't join the flat `textPairs` loop above. Reproduced here instead of assumed to
  // pass, per constitution Principle VII.
  describe.each([
    ["light", light],
    ["dark", dark],
  ] as const)("%s mode .banner-success (new in 003 Dashboard redesign)", (_modeName, tokens) => {
    it("foreground on success-tinted banner background meets AA normal-text contrast (>= 4.5:1)", () => {
      const fg = tokens["color-foreground"];
      const success = tokens["color-success"];
      const background = tokens["color-background"];
      expect(isHexColor(fg)).toBe(true);
      expect(isHexColor(success)).toBe(true);
      expect(isHexColor(background)).toBe(true);
      const mixedBackground = mixHexInSrgb(success, background, 20);
      expect(contrastRatio(fg, mixedBackground)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});
