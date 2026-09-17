// Regression guard for a real bug: `.print-chart-copy` (tokens.css) originally hardcoded
// `height: 320px` to match OverallApplicantBarChart's own chart height. That fit the bar
// chart, but CriterionBreakdownChart's/ReviewerScoreSpreadChart's print copies each also
// render their own title row ABOVE their chart, so their real content is taller than 320px.
// Off-screen, the mismatch was invisible (just clipped by `overflow: hidden`) — but once
// printed (`overflow: visible`), the box's own layout height stayed locked at 320px while
// its content visually spilled out past it, overlapping whatever printed content came next
// (the next chart's print copy, or the firm's comments table). Fixed by letting the box's
// height stay auto (sized to its actual content) in both states, which this test locks in
// by asserting the rule declares no fixed `height` at all, in either its base (off-screen)
// declaration or its `@media print` override.
//
// A plain string/regex check on the raw CSS text (not tests/helpers/tokensCss.ts's :root
// custom-property parser, which is scoped to `--name: value` declarations only) — this is a
// specific selector's regular `property: value` declarations instead.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "../helpers/tokensCss";

const TOKENS_PATH = resolve(process.cwd(), "src/theme/tokens.css");

/** Finds the Nth (1-indexed via `fromIndex`) occurrence of `selector {` at or after
 * `fromIndex` and returns its rule body plus the index just past its closing brace —
 * assumes no nested braces inside (true for every rule this test looks at). */
function extractRuleBody(css: string, selector: string, fromIndex = 0): { body: string; endIndex: number } {
  const selectorIndex = css.indexOf(`${selector} {`, fromIndex);
  if (selectorIndex === -1) throw new Error(`selector not found at/after ${fromIndex}: ${selector}`);
  const openBrace = css.indexOf("{", selectorIndex);
  const closeBrace = css.indexOf("}", openBrace);
  return { body: css.slice(openBrace + 1, closeBrace), endIndex: closeBrace + 1 };
}

describe(".print-chart-copy — no fixed height (content must size the box, in both states)", () => {
  const css = stripCssComments(readFileSync(TOKENS_PATH, "utf-8"));

  it("declares no height in its base (off-screen) rule", () => {
    const { body } = extractRuleBody(css, ".print-chart-copy");
    expect(body).not.toMatch(/(?<![\w-])height\s*:/);
  });

  it("declares no height in its @media print override either", () => {
    // The FIRST `.print-chart-copy {` is the base rule (above); the override lives in the
    // next occurrence of the same selector further down the file, inside its own
    // `@media print` block.
    const { endIndex: afterBaseRule } = extractRuleBody(css, ".print-chart-copy");
    const { body } = extractRuleBody(css, ".print-chart-copy", afterBaseRule);
    expect(body).not.toMatch(/(?<![\w-])height\s*:/);
  });
});
