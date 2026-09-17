// Regression coverage for how the PDF export gets light-mode chart colors without ever
// flashing the visible dashboard: DashboardScreen.tsx wraps the on-screen, theme-following
// chart (OverallApplicantBarChart) in `.no-print`, and mounts a second, always-light,
// always-off-screen copy (OverallApplicantBarChartPrintCopy, tokens.css's
// `.chart-print-safe-scope .print-chart-copy`) right alongside it — `@media print` shows
// exactly one of the two depending on context. This replaces an earlier approach that
// briefly forced the whole app's `data-theme` to "light" right before printing, which
// visibly flashed the entire on-screen dashboard (a real photosensitivity concern).
//
// This only checks DOM structure (which wrapper classes exist, that there are two chart
// containers), not rendered bar colors — Recharts' ResponsiveContainer always measures 0x0
// in jsdom (see chartTooltip.test.tsx's own comment on this), so no bar/axis content from a
// real render is reliably queryable here. usePrintSafeChartColors.test.ts covers the actual
// color-source logic directly.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

async function goToDashboard() {
  render(<App />);
  openGetStartedModal();
  const scoredProject = {
    schemaVersion: "1.0",
    project: {
      projectName: "Print Copy Test",
      localGovContact: "",
      procurementAgent: "",
      committeeMeetingDate: "",
      notes: "",
    },
    scoringScale: [
      { value: 1, label: "No" },
      { value: 5, label: "Yes" },
    ],
    scoringScaleMode: "discrete",
    criteria: [{ id: "crit-1", name: "Approach", weight: 1, description: "" }],
    firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
    ],
  };
  const file = new File([JSON.stringify(scoredProject)], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Dashboard — PDF export's light-mode chart copy", () => {
  it("mounts a .chart-print-safe-scope.print-chart-copy sibling next to the on-screen chart, hidden from the accessibility tree", async () => {
    await goToDashboard();

    const printCopy = document.querySelector(".chart-print-safe-scope.print-chart-copy");
    expect(printCopy).not.toBeNull();
    expect(printCopy).toHaveAttribute("aria-hidden", "true");
  });

  it("wraps the on-screen chart in .no-print so only the print copy appears in the exported PDF", async () => {
    await goToDashboard();

    const heading = screen.getByRole("heading", { name: "Overall vs. TLC Applicant vs. WFRC Weighted Totals" });
    const card = heading.closest(".card");
    expect(card).not.toBeNull();

    const noPrintChartWrapper = card!.querySelector(":scope > .no-print");
    const printCopy = card!.querySelector(".chart-print-safe-scope.print-chart-copy");
    expect(noPrintChartWrapper).not.toBeNull();
    expect(printCopy).not.toBeNull();
    // The print copy must live outside the .no-print wrapper, or `@media print`'s
    // `.no-print { display: none !important }` would hide it too.
    expect(noPrintChartWrapper!.contains(printCopy)).toBe(false);
  });
});
