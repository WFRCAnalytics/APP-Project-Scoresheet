// Unit tests for lib/weightInput.ts's decimal-or-percent parsing rule (see that module's own
// header comment for the full rationale). Each case here is hand-checkable against the three
// priority rules: explicit "%" always wins, a bare number > 1 is divided by 100, a bare
// number <= 1 is taken literally.

import { describe, expect, it } from "vitest";
import { formatWeightPercent, parseWeightInput } from "../../src/lib/weightInput";

describe("parseWeightInput — bare decimal (<= 1, taken literally)", () => {
  it("parses a plain fraction as-is", () => {
    expect(parseWeightInput("0.25")).toBe(0.25);
    expect(parseWeightInput("0.6")).toBe(0.6);
    expect(parseWeightInput("0")).toBe(0);
  });

  it("treats a bare '1' as 1.0 (100%), not 1% — the single-criterion case", () => {
    expect(parseWeightInput("1")).toBe(1);
    expect(parseWeightInput("1.0")).toBe(1);
  });
});

describe("parseWeightInput — bare number > 1 (divided by 100, no sign needed)", () => {
  it("treats a bare number above 1 as a percent typed without the sign", () => {
    expect(parseWeightInput("25")).toBe(0.25);
    expect(parseWeightInput("60")).toBeCloseTo(0.6, 10);
    expect(parseWeightInput("100")).toBe(1);
    expect(parseWeightInput("1.5")).toBeCloseTo(0.015, 10);
  });
});

describe("parseWeightInput — explicit '%' sign (always wins, any magnitude)", () => {
  it("divides by 100 regardless of whether the number is above or below 1", () => {
    expect(parseWeightInput("25%")).toBe(0.25);
    expect(parseWeightInput("100%")).toBe(1);
    expect(parseWeightInput("0.5%")).toBeCloseTo(0.005, 10); // the genuinely ambiguous case —
    // "%" is the only way to mean a sub-1% weight, since a bare "0.5" means 0.5 (50%) instead
  });

  it("tolerates whitespace around the number and before the sign", () => {
    expect(parseWeightInput(" 25 % ")).toBe(0.25);
    expect(parseWeightInput("25%")).toBe(parseWeightInput(" 25% "));
  });
});

describe("parseWeightInput — invalid input returns null", () => {
  it("rejects empty/whitespace-only text", () => {
    expect(parseWeightInput("")).toBeNull();
    expect(parseWeightInput("   ")).toBeNull();
    expect(parseWeightInput("%")).toBeNull();
  });

  it("rejects non-numeric garbage", () => {
    expect(parseWeightInput("abc")).toBeNull();
    expect(parseWeightInput("1abc")).toBeNull();
  });

  it("rejects negative numbers", () => {
    expect(parseWeightInput("-5")).toBeNull();
    expect(parseWeightInput("-5%")).toBeNull();
  });
});

describe("formatWeightPercent", () => {
  it("formats a clean fraction as a whole percent", () => {
    expect(formatWeightPercent(0.25)).toBe("25%");
    expect(formatWeightPercent(1)).toBe("100%");
    expect(formatWeightPercent(0)).toBe("0%");
  });

  it("absorbs ordinary floating-point noise (0.1 + 0.2 style sums)", () => {
    expect(formatWeightPercent(0.1 + 0.2)).toBe("30%"); // 0.30000000000000004 in raw JS
  });

  it("keeps up to 2 decimal places of percent precision when the fraction needs it", () => {
    expect(formatWeightPercent(0.3333)).toBe("33.33%");
  });
});
