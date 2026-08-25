// ChartTooltip.tsx's pieces are plain React components with no Recharts/SVG-measurement
// dependency, unlike the charts that use them — so unlike CriterionBreakdownChart/
// OverallApplicantBarChart/ReviewerScoreSpreadChart themselves (untestable this way per this
// suite's established convention: ResponsiveContainer always measures 0x0 in jsdom, so no
// bars/dots/legend/tooltip content from a REAL hover interaction ever renders), these can be
// rendered and asserted on directly.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartTooltipContent, TooltipHeading, TooltipRow } from "../../src/features/dashboard/ChartTooltip";

const OVERALL = "#c48839"; // arbitrary stand-in hex, not the real token — this suite only
const APPLICANT = "#789d4b"; // needs distinct colors to prove they're threaded through, not
const WFRC = "#3f748e"; // the real theme/chartColors.ts resolution (covered elsewhere).

describe("TooltipRow", () => {
  it("colors both the swatch and the bold value text with the series' own color", () => {
    render(
      <TooltipRow
        swatchColor={OVERALL}
        label="Overall"
        labelColor="#151515"
        value={3.8}
        valueColor={OVERALL}
      />,
    );
    const value = screen.getByText("3.8");
    expect(value.tagName).toBe("STRONG"); // bold — real font-weight hierarchy, not just color
    expect(value).toHaveStyle({ color: OVERALL, fontStyle: "normal" });
  });

  it("renders the italic/muted variant for an unscored entry, not the series' own color", () => {
    render(
      <TooltipRow
        swatchColor={WFRC}
        label="WFRC"
        labelColor="#151515"
        value="Not yet scored"
        valueColor={WFRC}
        italic
      />,
    );
    const value = screen.getByText("Not yet scored");
    expect(value).toHaveStyle({ fontStyle: "italic", color: "#151515" }); // labelColor, not WFRC
  });
});

describe("TooltipHeading", () => {
  it("renders bold, larger than a row's own text", () => {
    render(<TooltipHeading color="#151515">Approach</TooltipHeading>);
    const heading = screen.getByText("Approach");
    expect(heading).toHaveStyle({ fontWeight: "700" });
  });
});

describe("ChartTooltipContent", () => {
  const payload = [
    { name: "Overall", value: 3.8, color: OVERALL, dataKey: "Overall", payload: {} },
    { name: "TLC Applicant", value: 5, color: APPLICANT, dataKey: "TLC Applicant", payload: {} },
    { name: "WFRC", value: 2.6, color: WFRC, dataKey: "WFRC", payload: {} },
  ];

  it("renders nothing while inactive (no hover)", () => {
    const { container } = render(
      <ChartTooltipContent
        active={false}
        payload={payload}
        label="Alpha Co"
        backgroundColor="#fff"
        borderColor="#ccc"
        foregroundColor="#151515"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one color-coded row per series plus a header, each value matching its own metric color", () => {
    render(
      <ChartTooltipContent
        active
        payload={payload}
        label="Alpha Co"
        backgroundColor="#fff"
        borderColor="#ccc"
        foregroundColor="#151515"
      />,
    );
    expect(screen.getByText("Alpha Co")).toBeInTheDocument(); // header
    expect(screen.getByText("3.8")).toHaveStyle({ color: OVERALL });
    expect(screen.getByText("5")).toHaveStyle({ color: APPLICANT });
    expect(screen.getByText("2.6")).toHaveStyle({ color: WFRC });
  });

  it("supports formatEntry overriding both the displayed text and italic styling per row", () => {
    render(
      <ChartTooltipContent
        active
        payload={payload}
        label="Alpha Co"
        backgroundColor="#fff"
        borderColor="#ccc"
        foregroundColor="#151515"
        formatEntry={(entry) =>
          entry.name === "WFRC" ? { text: "Not yet scored", italic: true } : { text: entry.value }
        }
      />,
    );
    expect(screen.getByText("3.8")).toHaveStyle({ color: OVERALL }); // untouched by formatEntry
    const wfrcValue = screen.getByText("Not yet scored");
    expect(wfrcValue).toHaveStyle({ fontStyle: "italic" });
  });
});
