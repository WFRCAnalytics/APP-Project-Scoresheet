// Pure-logic coverage for wrapAxisLabel — the chart itself can't be measured in jsdom (see
// reviewer-score-spread-chart.test.tsx's header comment), so this is the only place the
// wrap/truncate behavior actually gets exercised.

import { describe, expect, it } from "vitest";
import { wrapAxisLabel } from "../../src/features/dashboard/wrapAxisLabel";

const FONT_SIZE = 12;

describe("wrapAxisLabel", () => {
  it("keeps short text on one line", () => {
    const result = wrapAxisLabel("Cost", 200, FONT_SIZE);
    expect(result).toEqual({ lines: ["Cost"], truncated: false, fullText: "Cost" });
  });

  it("wraps onto a second line when one line doesn't fit but two do", () => {
    // "Approach and Methodology" at 12px, factor 0.58/char: ~174px total — doesn't fit on
    // one line at 100px, but each half fits comfortably on its own line.
    const result = wrapAxisLabel("Approach and Methodology", 100, FONT_SIZE);
    expect(result.truncated).toBe(false);
    expect(result.lines.length).toBe(2);
    expect(result.lines.join(" ")).toBe("Approach and Methodology");
    expect(result.fullText).toBe("Approach and Methodology");
  });

  it("truncates the second line with an ellipsis when two lines still isn't enough room", () => {
    const long = "Demonstrated Experience With Similar Regional Transportation Planning Projects";
    const result = wrapAxisLabel(long, 90, FONT_SIZE);
    expect(result.truncated).toBe(true);
    expect(result.lines.length).toBe(2);
    expect(result.lines[1].endsWith("…")).toBe(true);
    expect(result.fullText).toBe(long);
    // The truncated line must still fit the budget it was truncated against.
    const widthOf = (s: string) => s.length * FONT_SIZE * 0.58;
    expect(widthOf(result.lines[1])).toBeLessThanOrEqual(90);
  });

  it("hard-truncates a single word too wide to fit even alone", () => {
    const result = wrapAxisLabel("Supercalifragilisticexpialidocious", 60, FONT_SIZE);
    expect(result.truncated).toBe(true);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].endsWith("…")).toBe(true);
    expect(result.fullText).toBe("Supercalifragilisticexpialidocious");
  });

  it("never truncates when maxWidthPx is effectively unlimited", () => {
    const result = wrapAxisLabel("Approach and Methodology", Infinity, FONT_SIZE);
    expect(result).toEqual({
      lines: ["Approach and Methodology"],
      truncated: false,
      fullText: "Approach and Methodology",
    });
  });
});
