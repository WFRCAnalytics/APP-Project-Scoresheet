// T054 (part 2) / quickstart.md Scenario 5 — the UI half of the SC-006/FR-012
// flexibility claim. tests/unit/calculations.test.ts's new fixture already proves the
// calculation engine has no hardcoded count/scale assumption; this proves the UI itself
// doesn't either, by driving the real running app (same technique as the other
// user-story-N-flow tests) through a 15-firm/1-criterion/7-point-scale project —
// deliberately nothing like the small fixtures every other flow test uses.

import { fireEvent, render, screen, within } from "@testing-library/react";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { generateWorkbookForReviewer } from "../../src/lib/excel/generateWorkbook";
import { readFileArrayBuffer } from "../../src/lib/excel/parseWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildLargeProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Scenario 5 Flexibility Test";
  project.criteria = [{ id: "crit-1", name: "Only Criterion", weight: 1.0, description: "" }];
  project.scoringScale = Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: `Point ${i + 1}` }));
  project.firms = Array.from({ length: 15 }, (_, i) => ({
    id: `firm-${i}`,
    name: `Firm ${i}`,
    invited: true,
    submitted: i < 13,
    notes: "",
  }));
  project.reviewers = [{ id: "rev-1", name: "Sole Reviewer", type: "city", email: "" }];
  return project;
}

describe("Scenario 5 — Flexibility check: a materially different-shaped project", () => {
  it("renders Configuration correctly at 15 firms / 1 criterion / 7-point scale (step 2)", async () => {
    render(<App />);
    const project = buildLargeProject();
    const file = new File([JSON.stringify(project)], "large.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
    await screen.findByRole("heading", { name: "Configuration" });

    // All 15 firm name inputs render, in order, no truncation.
    const firmInputs = screen.getAllByLabelText("Firm name") as HTMLInputElement[];
    expect(firmInputs).toHaveLength(15);
    expect(firmInputs.map((i) => i.value)).toEqual(project.firms.map((f) => f.name));

    // The single criterion's weight (1.0) doesn't trip the weight-sum warning.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // All 7 scale point rows render.
    expect(screen.getAllByLabelText("Scale point value")).toHaveLength(7);
  });

  it("generates a 15-row workbook offering all 7 scale values (step 3)", async () => {
    const project = buildLargeProject();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // jsdom's Blob doesn't implement .arrayBuffer() — use the app's own jsdom-safe reader.
    const generatedFile = new File([result.blob], result.filename);
    const arrayBuffer = await readFileArrayBuffer(generatedFile);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.getWorksheet("Scoring")!;
    // 13 submitted firms * 1 criterion = 13 rows (not 15 — the 2 unsubmitted firms are
    // correctly excluded even at this scale).
    expect(sheet.rowCount).toBe(14); // header + 13 data rows

    const dropdown = sheet.getCell("D2").dataValidation;
    const formula = String(dropdown?.formulae?.[0]);
    for (let v = 1; v <= 7; v++) {
      expect(formula).toContain(String(v));
    }
  });

  it("imports and renders correctly: 13 ranked firm cards, 7-point raw values traceable (step 4)", async () => {
    render(<App />);
    const project = buildLargeProject();
    const file = new File([JSON.stringify(project)], "large.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
    await screen.findByRole("heading", { name: "Configuration" });

    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
    await screen.findByRole("heading", { name: "Reviewer Forms" });

    // Build and fill a real workbook: score cycles through all 7 scale values.
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);
    const generatedFile = new File([generated.blob], generated.filename);
    const arrayBuffer = await readFileArrayBuffer(generatedFile);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.getWorksheet("Scoring")!;
    for (let r = 2; r <= sheet.rowCount; r++) {
      const rowIndex = r - 2; // 0-based row order among the 13 submitted firms
      sheet.getCell(`D${r}`).value = (rowIndex % 7) + 1;
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const importFile = new File([buffer as unknown as BlobPart], generated.filename, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(screen.getByLabelText("Select one or more completed .xlsx files"), {
      target: { files: [importFile] },
    });
    await screen.findByText(/Review before importing/);
    fireEvent.click(screen.getByRole("button", { name: /Confirm import \(13 scores\)/ }));
    await screen.findByText(/Import complete/);

    fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
    await screen.findByRole("heading", { name: "Dashboard" });

    const rankedTable = screen.getAllByRole("table")[0];
    // Header row + 13 data rows -> exactly 13 ranked firm cards, not 15.
    expect(within(rankedTable).getAllByRole("row")).toHaveLength(14);

    // firm-6 (row index 6 -> score 7, the highest) must be ranked 1st.
    const firm6Row = within(rankedTable).getByText("Firm 6").closest("tr")!;
    expect(within(firm6Row).getAllByRole("cell")[0].textContent).toBe("1");

    // "show calculations" surfaces the raw 7-point values without truncation.
    fireEvent.click(screen.getByRole("button", { name: "Show calculations" }));
    const calcView = screen.getByLabelText("Calculations");
    expect(within(calcView).getByRole("heading", { name: "Firm 6" })).toBeInTheDocument();
    const calcTables = within(calcView).getAllByRole("table");
    // 13 submitted firms -> 13 per-firm calculation tables (+ the manual entry grid's
    // own table), confirming every submitted firm rendered its own audit section.
    expect(calcTables.length).toBeGreaterThanOrEqual(13);
  });
});
