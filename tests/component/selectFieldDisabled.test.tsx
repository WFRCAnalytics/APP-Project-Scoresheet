// Regression test for a manual-sweep finding: SelectField's dropdown-arrow icon (a lucide
// ChevronDown, absolutely positioned) is a SIBLING of the <select> it decorates, not a
// descendant — see SelectField.tsx. `.field select:disabled { opacity: 0.6 }` (app.css)
// therefore never dimmed the arrow, since CSS opacity doesn't cascade to siblings; a
// disabled select would render as a faded box with a still-full-brightness arrow on top of
// it. Fixed via a general-sibling-combinator rule targeting the arrow specifically when the
// select immediately before it (in DOM order) is disabled.
//
// Being direct about what's mechanically testable here versus what isn't, same standard as
// the print-preview and chart-color checks: Vitest's jsdom environment does not apply real
// CSS cascade from imported stylesheets (no `test.css: true` in vite.config.ts), so a live
// getComputedStyle(...).opacity read on a rendered <SelectField disabled /> would not
// reflect app.css's actual rule here — it would just show the browser's default, regardless
// of whether the fix is correct. What IS mechanically testable, and is tested below: (1)
// the CSS rule itself exists in app.css's source with the right selector shape and opacity
// value, so it can't be silently deleted or detuned, and (2) SelectField's rendered DOM
// actually satisfies the sibling-combinator's precondition — the arrow is genuinely the
// next sibling after the <select>, not nested some other way that would silently stop the
// CSS selector from ever matching. The real rendered-opacity effect was confirmed by hand
// in a live browser (see the PR/commit description), not here.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField } from "../../src/components/SelectField";

const APP_CSS_PATH = resolve(process.cwd(), "src/styles/app.css");

describe("SelectField disabled-state dimming reaches the dropdown arrow", () => {
  it("app.css defines a sibling-combinator rule dimming .select-field-arrow when its <select> is disabled", () => {
    const css = readFileSync(APP_CSS_PATH, "utf-8");
    // Same shape as the rule this test guards — a disabled <select> (scoped to both
    // contexts it's used in, .field and .data-table td) targeting its sibling arrow.
    const rulePattern =
      /\.field select:disabled ~ \.select-field-arrow,\s*\.data-table td select:disabled ~ \.select-field-arrow\s*\{\s*opacity:\s*0\.6;\s*\}/;
    expect(css).toMatch(rulePattern);
  });

  it("renders the arrow as the <select>'s next sibling, so the CSS combinator actually has something to match", () => {
    const { container } = render(<SelectField disabled aria-label="Test select" />);
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select).toBeDisabled();
    const nextSibling = select!.nextElementSibling;
    expect(nextSibling).not.toBeNull();
    expect(nextSibling!.classList.contains("select-field-arrow")).toBe(true);
  });
});
