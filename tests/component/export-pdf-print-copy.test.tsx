// Regression coverage for how the PDF export gets light-mode chart colors without ever
// flashing the visible dashboard: every printable chart's visible, theme-following instance
// is wrapped in `.no-print`, and a second, always-light, always-off-screen copy
// (`*PrintCopy`, tokens.css's `.chart-print-safe-scope .print-chart-copy`) is mounted right
// alongside it — `@media print` shows exactly one of the two depending on context. This
// replaces an earlier approach that briefly forced the whole app's `data-theme` to "light"
// right before printing, which visibly flashed the entire on-screen dashboard (a real
// photosensitivity concern).
//
// The radar/scatter block below covers a follow-up report that the bar-chart-only version of
// this fix left those two charts still dark-mode-colored in print. Fixing that surfaced a
// second, more serious bug in the same family: RankedFirmsTable's per-firm detail (which
// hosts those two charts plus reviewer comments) only ever existed in the DOM for a row the
// viewer had expanded ON SCREEN, and the PDF's row order silently followed whatever sort was
// active on screen — both driven by a `usePrintMode()` hook that (like the color bug) relied
// on `beforeprint`/`afterprint` events that never fire for react-to-print's iframe-based
// export. Fixed by RankedFirmsTablePrintCopy (RankedFirmsTable.tsx) — a second, always-every-
// firm, always-canonical-order, always-"expanded" table, off-screen via `.print-only-block`
// the same way the individual chart copies are — so the exported PDF no longer depends on
// what a viewer happened to leave expanded/sorted on screen.
//
// This only checks DOM structure (which wrapper classes exist, row counts/order), not
// rendered bar colors — Recharts' ResponsiveContainer always measures 0x0 in jsdom (see
// chartTooltip.test.tsx's own comment on this), so no bar/axis content from a real render is
// reliably queryable here. usePrintSafeChartColors.test.ts covers the actual color-source
// logic directly.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal, rankedFirmNames } from "../helpers/appNav";

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
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true }],
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

// Names chosen so alphabetical order (Alpha, Zeta) DIFFERS from canonical rank order (Zeta
// ranks 1st by scoring higher) — lets a test prove the print-only table ignores an on-screen
// sort by firm name and still shows canonical rank order.
async function goToDashboardWithTwoFirms() {
  render(<App />);
  openGetStartedModal();
  const scoredProject = {
    schemaVersion: "1.0",
    project: {
      projectName: "Print Copy Test — Two Firms",
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
    firms: [
      { id: "firm-1", name: "Zeta Co", invited: true, submitted: true, notes: "" },
      { id: "firm-2", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    ],
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true }],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
      { reviewerId: "rev-1", firmId: "firm-2", criterionId: "crit-1", value: 1, comment: "", updatedAt: "" },
    ],
  };
  const file = new File([JSON.stringify(scoredProject)], "scored-two.json", {
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

  it("keeps the print copy inside the print-only region and the on-screen chart outside it", async () => {
    await goToDashboard();

    // The PDF prints only the print-only region (PrintableDashboard), so the on-screen chart —
    // which lives in the workspace, outside it — can never end up in the exported file.
    const printCopy = document.querySelector(".chart-print-safe-scope.print-chart-copy");
    expect(printCopy!.closest(".print-only-block")).not.toBeNull();

    const onScreenChartCard = screen.getByRole("region", { name: "Weighted totals chart section" });
    expect(onScreenChartCard.closest(".print-only-block")).toBeNull();
    expect(onScreenChartCard.querySelector(".chart-print-safe-scope")).toBeNull();
  });

  it("mounts print-safe copies of the bar, radar and scatter charts with no interaction at all", async () => {
    await goToDashboard();

    const printCopies = document.querySelectorAll(".chart-print-safe-scope.print-chart-copy");
    // One for the dashboard-level bar chart, plus radar+scatter for this project's one firm —
    // always present via RankedFirmsTablePrintCopy, whatever a viewer has selected on screen.
    expect(printCopies.length).toBe(3);
    printCopies.forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"));
  });

  it("every submitted firm gets radar/scatter print copies even when its row is never expanded on screen", async () => {
    await goToDashboardWithTwoFirms();
    // Deliberately never click either row's expand toggle.

    // 1 bar chart + (radar + scatter) x 2 firms.
    const printCopies = document.querySelectorAll(".chart-print-safe-scope.print-chart-copy");
    expect(printCopies.length).toBe(5);

    const printOnlyTable = document.querySelector(".print-only-block table");
    expect(printOnlyTable).not.toBeNull();
    expect(printOnlyTable!.textContent).toContain("Zeta Co");
    expect(printOnlyTable!.textContent).toContain("Alpha Co");
  });

  it("the print-only table has no empty row-expand-header column (nothing to toggle in a fixed print record, and every column counts against a tight print width)", async () => {
    await goToDashboardWithTwoFirms();

    const printOnlyTable = document.querySelector(".print-only-block table")!;
    const headerCells = printOnlyTable.querySelectorAll("thead th");
    expect(headerCells).toHaveLength(6);
    expect(headerCells[0]!.textContent).toBe("Rank");

    const firstBodyRow = printOnlyTable.querySelector("tbody > tr:not(.firm-detail-row)")!;
    expect(firstBodyRow.children).toHaveLength(6);
  });

  it("the print-only table's row order stays canonical rank order whichever firm is selected on screen", async () => {
    await goToDashboardWithTwoFirms();

    // The on-screen list is in rank order too (Zeta ranks 1st — see goToDashboardWithTwoFirms's
    // note on why the names diverge from alphabetical). Select the lower-ranked firm.
    expect(rankedFirmNames()).toEqual(["Zeta Co", "Alpha Co"]);
    fireEvent.click(screen.getByRole("option", { name: /Alpha Co/ }));

    // Index 1, not 2: the print-only table has no row-expand-header column (nothing to
    // toggle in a fixed print record) — see RankedFirmsTable.tsx's RankedFirmsTablePrintCopy.
    const printOnlyTable = document.querySelector(".print-only-block table")!;
    const printOnlyNames = Array.from(printOnlyTable.querySelectorAll("tbody > tr:not(.firm-detail-row)")).map(
      (tr) => tr.children[1]!.textContent,
    );
    expect(printOnlyNames).toEqual(["Zeta Co", "Alpha Co"]);
  });
});
