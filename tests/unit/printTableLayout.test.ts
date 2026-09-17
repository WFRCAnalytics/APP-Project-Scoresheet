// Regression guard for a real bug: RankedFirmsTablePrintCopy's table (RankedFirmsTable.tsx)
// rendered wider than the printed page's usable content width (PRINT_PAGE_STYLE,
// lib/pdf/printLayout.ts: 8.5in letter - 2 * 0.75in margin ≈ 672px) — table-layout:auto (the
// .data-table default, app.css) lets a table grow past its declared 100% width whenever its
// columns' content can't otherwise fit on one line, which a 6-column table with headers like
// "TLC Applicant Weighted Total" reliably did. That pushed the rightmost (Completion) column
// past the page's right edge, where the print engine clips it — no horizontal scroll exists
// on paper. Fixed with a `.ranked-firms-table { table-layout: fixed !important }` print
// override (tokens.css) that forces the table to honor its declared width unconditionally.
// `!important` is required, not optional specificity paranoia: tokens.css loads BEFORE
// app.css (main.tsx), so without it app.css's base .data-table rule would win any tie.
//
// Same raw-CSS-text approach as printChartCopyLayout.test.ts — this checks a regular
// `property: value` declaration on a specific selector, which tests/helpers/tokensCss.ts's
// parser (scoped to :root custom properties only) doesn't cover.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "../helpers/tokensCss";

const TOKENS_PATH = resolve(process.cwd(), "src/theme/tokens.css");

describe(".ranked-firms-table — forced to a fixed layout under print", () => {
  const css = stripCssComments(readFileSync(TOKENS_PATH, "utf-8"));
  const mediaPrintIndex = css.indexOf("@media print");
  const printBlockBody = css.slice(mediaPrintIndex);

  it("declares table-layout: fixed with !important inside the @media print block", () => {
    expect(printBlockBody).toMatch(
      /\.ranked-firms-table\s*\{[^}]*table-layout:\s*fixed\s*!important/,
    );
  });

  it("relaxes .completion-bar's on-screen min-width so it can't force its own cell to overflow the now-narrower fixed column", () => {
    expect(printBlockBody).toMatch(
      /\.ranked-firms-table \.completion-bar\s*\{[^}]*min-width:\s*0\s*!important/,
    );
  });
});
