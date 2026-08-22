// End-to-end component test for User Story 5 (not a numbered tasks.md item — same
// rationale as the other phase flow tests). Covers both spec Story 5 Acceptance
// Scenarios: (1) the Score input can't offer an out-of-scale value, and (2) a later
// workbook import for the same reviewer/firm/criterion cell overwrites a manually
// entered value (both paths funnel through the same UPSERT_SCORES action).

import { fireEvent, render, screen, within } from "@testing-library/react";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import {
  generateWorkbookForReviewer,
  SCORING_FIRST_DATA_ROW,
} from "../../src/lib/excel/generateWorkbook";
import { readFileArrayBuffer } from "../../src/lib/excel/parseWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "US5 Flow Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 3, label: "Maybe" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "city", email: "" }];
  return project;
}

/** Navigates a freshly rendered App from Load -> Configuration -> Reviewer Forms ->
 * Dashboard -> "Show calculations" (where the manual entry grid lives), landing with
 * zero imported scores — exactly the Independent Test's starting state. */
async function navigateToManualEntryGrid(project: Project) {
  openGetStartedModal();
  const file = new File([JSON.stringify(project)], "us5.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Configuration" });

  goToConfigStep("Export / Review");
  fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
  await screen.findByRole("heading", { name: "Reviewer Forms" });

  fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
  await screen.findByRole("heading", { name: "Dashboard" });

  fireEvent.click(screen.getByRole("button", { name: "Show calculations" }));
  fireEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
  await screen.findByLabelText("Manual Score Entry");
}

describe("User Story 5 — Manually Enter Reviewer Scores", () => {
  it("Acceptance Scenario 1: the Score input only ever offers the configured scale values (no out-of-scale entry possible)", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const scoreSelect = screen.getByLabelText("Score for Alpha Co / Approach") as HTMLSelectElement;
    const optionValues = Array.from(scoreSelect.options).map((o) => o.value);
    // "—" (blank/unscored) plus exactly the three configured scale values — nothing else.
    expect(optionValues.sort()).toEqual(["", "1", "3", "5"]);
  });

  it("entering a score and comment manually commits it and is reflected on the Dashboard", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Comments for Alpha Co / Approach"), {
      target: { value: "Entered by phone" },
    });

    // Hide/show calculations to force a re-render from the committed project state, then
    // check the Dashboard's ranked table reflects the manually entered score. Queried by
    // its accessible name (aria-label="Ranked firms") rather than DOM position/order.
    fireEvent.click(screen.getByRole("button", { name: "Hide calculations" }));
    const rankedTable = screen.getByRole("table", { name: "Ranked firms" });
    const dataRow = within(rankedTable).getAllByRole("row")[1];
    const cells = within(dataRow).getAllByRole("cell");
    // Cell 0 is the row-expand toggle, cell 1 is Rank, cell 2 is Firm, cell 3 is Overall
    // Weighted Total.
    expect(cells[3].textContent).toBe("5"); // Overall Weighted Total (1 criterion, weight 1)
  });

  it("Acceptance Scenario 2: a later workbook import for the same cell overwrites the manually entered value", async () => {
    render(<App />);
    const project = buildProject();
    await navigateToManualEntryGrid(project);

    // Manually enter a score of 1 first.
    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "1" },
    });

    // Now import a workbook for the SAME reviewer/firm/criterion with a different score.
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);
    const generatedFile = new File([generated.blob], generated.filename);
    const arrayBuffer = await readFileArrayBuffer(generatedFile);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.getWorksheet("Scoring")!;
    sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5; // overwrite: manual said 1, workbook says 5
    sheet.getCell(`E${SCORING_FIRST_DATA_ROW}`).value = "Returned via email";
    const buffer = await workbook.xlsx.writeBuffer();
    const importFile = new File([buffer as unknown as BlobPart], generated.filename, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Already on the Dashboard (that's where the manual entry grid lives) — navigate to
    // Reviewer Forms, where ImportScoresPanel lives, via Edit project -> Configuration.
    fireEvent.click(screen.getByRole("button", { name: "Hide calculations" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    await screen.findByRole("heading", { name: "Configuration" });
    goToConfigStep("Export / Review");
    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
    await screen.findByRole("heading", { name: "Reviewer Forms" });

    fireEvent.change(screen.getByLabelText("Select one or more completed .xlsx files"), {
      target: { files: [importFile] },
    });
    await screen.findByText(/Review before importing/);
    fireEvent.click(screen.getByRole("button", { name: /Confirm import/ }));
    await screen.findByText(/Import complete/);

    fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
    // Queried by accessible name (aria-label="Ranked firms") rather than DOM position —
    // robust regardless of how many other <table> elements (e.g. an expanded row's
    // comments table) happen to be in the tree at once.
    const rankedTable = await screen.findByRole("table", { name: "Ranked firms" });
    const dataRow = within(rankedTable).getAllByRole("row")[1];
    const cells = within(dataRow).getAllByRole("cell");
    // Cell 0 is the row-expand toggle, cell 1 is Rank, cell 2 is Firm, cell 3 is Overall
    // Weighted Total. The import's value (5) must have overwritten the manual entry's
    // value (1).
    expect(cells[3].textContent).toBe("5");

    fireEvent.click(screen.getByRole("button", { name: "Show calculations" }));
    fireEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
    expect(await screen.findByLabelText("Score for Alpha Co / Approach")).toHaveValue("5");
  });
});
