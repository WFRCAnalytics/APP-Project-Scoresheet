// T020: Automated WCAG 2.1 AA contrast check over src/theme/tokens.css (spec SC-010),
// in both light and dark mode. This parses the actual CSS file rather than a duplicated
// token list, so there is exactly one source of truth for the values — a color changed
// in tokens.css without a matching contrast fix will fail this test immediately instead
// of silently drifting.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio } from "../../src/lib/contrast";

// Resolved from the project root (where `npm run test` / `vitest run` always execute
// from) rather than import.meta.url — Vitest's module transform doesn't guarantee
// import.meta.url resolves to a real file:// URL for every environment/OS combination.
const TOKENS_PATH = resolve(process.cwd(), "src/theme/tokens.css");

type TokenMap = Record<string, string>;

/** Extracts `--name: value;` custom-property declarations from a CSS block body. */
function parseDeclarations(blockBody: string): TokenMap {
  const tokens: TokenMap = {};
  const re = /--([\w-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(blockBody))) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** Finds the first `:root { ... }` block starting at `fromIndex` and returns its body
 * plus the index just past its closing brace. Assumes no nested braces inside (true for
 * this file — it's a flat custom-property list, no rulesets nested inside :root). */
function extractRootBlock(css: string, fromIndex: number): { body: string; endIndex: number } {
  const start = css.indexOf(":root", fromIndex);
  if (start === -1) throw new Error("No :root block found");
  const openBrace = css.indexOf("{", start);
  const closeBrace = css.indexOf("}", openBrace);
  return { body: css.slice(openBrace + 1, closeBrace), endIndex: closeBrace + 1 };
}

/** Resolves `var(--foo)` references against an already-parsed token map, a few passes
 * deep (enough for this file's short reference chains). Leaves the value alone if it
 * isn't a `var()` reference (a literal color, font stack, etc.). */
function resolveTokens(raw: TokenMap): TokenMap {
  const resolved: TokenMap = { ...raw };
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const [name, value] of Object.entries(resolved)) {
      const varMatch = value.match(/^var\(--([\w-]+)\)$/);
      if (varMatch && resolved[varMatch[1]] && resolved[varMatch[1]] !== value) {
        resolved[name] = resolved[varMatch[1]];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return resolved;
}

function loadTokens(): { light: TokenMap; dark: TokenMap } {
  const css = readFileSync(TOKENS_PATH, "utf-8");

  const rootBlock = extractRootBlock(css, 0);
  const lightRaw = parseDeclarations(rootBlock.body);

  const darkMediaIndex = css.indexOf("prefers-color-scheme: dark", rootBlock.endIndex);
  expect(darkMediaIndex, "expected a @media (prefers-color-scheme: dark) block").toBeGreaterThan(
    -1,
  );
  const darkRootBlock = extractRootBlock(css, darkMediaIndex);
  const darkOverridesRaw = parseDeclarations(darkRootBlock.body);

  // Dark mode = light-mode tokens with dark-mode overrides layered on top, mirroring how
  // the CSS cascade actually resolves them at runtime (same :root selector, later rule
  // wins for anything it redefines; anything it doesn't redefine falls through unchanged).
  const light = resolveTokens(lightRaw);
  const dark = resolveTokens({ ...lightRaw, ...darkOverridesRaw });

  return { light, dark };
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value);
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
});
