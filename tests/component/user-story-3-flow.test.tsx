// End-to-end component test for User Story 3 (not a numbered tasks.md item — same
// rationale as tests/component/app-flow.test.tsx in Phase 3: cheap given the checkpoint's
// own claim that quickstart Scenario 3 passes end-to-end). Drives the real UI: upload an
// unscored project -> Reviewer Forms -> import a genuinely modified .xlsx (built via the
// real generateWorkbook + ExcelJS, not a mock) -> Dashboard shows correct ranked results
// and the Calculations view agrees.

import { fireEvent, render, screen, within } from "@testing-library/react";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { generateWorkbookForReviewer } from "../../src/lib/excel/generateWorkbook";
import { readFileArrayBuffer } from "../../src/lib/excel/parseWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildUnscoredProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "US3 Flow Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [
    { id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    { id: "firm-2", name: "Beta Co", invited: true, submitted: true, notes: "" },
  ];
  project.reviewers = [
    { id: "rev-1", name: "Alice", type: "city", email: "" },
    { id: "rev-2", name: "Bob", type: "wfrc", email: "" },
  ];
  return project;
}

/** Generates a real workbook for the reviewer, fills in Score cells exactly like a
 * reviewer would (via ExcelJS, the same round-trip mechanism tests/integration's
 * excel-roundtrip.test.ts already validates), and returns it as a browser File. */
async function buildCompletedWorkbookFile(
  project: Project,
  reviewerId: string,
  scoresByFirmId: Record<string, number>,
): Promise<File> {
  const reviewer = project.reviewers.find((r) => r.id === reviewerId)!;
  const generated = await generateWorkbookForReviewer(project, reviewer);
  if (!generated.ok) throw new Error(generated.error);

  // jsdom's Blob doesn't implement .arrayBuffer() — reuse the app's own jsdom-safe
  // FileReader-based reader (parseWorkbook.ts) rather than a second workaround.
  const generatedFile = new File([generated.blob], generated.filename);
  const arrayBuffer = await readFileArrayBuffer(generatedFile);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.getWorksheet("Scoring")!;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const firmId = sheet.getCell(`G${r}`).value as string;
    if (firmId in scoresByFirmId) {
      sheet.getCell(`D${r}`).value = scoresByFirmId[firmId];
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer as unknown as BlobPart], generated.filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("User Story 3 — Import Returned Scores and View Ranked Results", () => {
  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL — not exercised by this test (we feed
    // files into the *import* input, never click a *download* button), but downloadBlob
    // calls it unconditionally in modules this test's import graph touches indirectly;
    // stub it so any accidental call fails loudly instead of crashing the whole test.
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => "blob:mock";
      URL.revokeObjectURL = () => {};
    }
  });

  it("imports two reviewers' real workbooks and renders correct ranked totals + calculations", async () => {
    render(<App />);
    openGetStartedModal();

    const project = buildUnscoredProject();
    const file = new File([JSON.stringify(project)], "us3-flow.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
    await screen.findByRole("heading", { name: "Configuration" });

    goToConfigStep("Export / Review");
    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
    await screen.findByRole("heading", { name: "Reviewer Forms" });

    // Alice (city): Alpha=5, Beta=1. Bob (wfrc): Alpha=1, Beta=5.
    const aliceFile = await buildCompletedWorkbookFile(project, "rev-1", {
      "firm-1": 5,
      "firm-2": 1,
    });
    const bobFile = await buildCompletedWorkbookFile(project, "rev-2", {
      "firm-1": 1,
      "firm-2": 5,
    });

    const importInput = screen.getByLabelText("Select one or more completed .xlsx files");
    fireEvent.change(importInput, { target: { files: [aliceFile, bobFile] } });

    await screen.findByText(/Review before importing/);
    // 2 firms * 1 criterion = 2 scores added per reviewer -> 4 total.
    fireEvent.click(screen.getByRole("button", { name: /Confirm import \(4 scores\)/ }));
    await screen.findByText(/Import complete/);

    fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
    await screen.findByRole("heading", { name: "Dashboard" });

    // Overall Avg: Alpha = (5+1)/2 = 3, Beta = (1+5)/2 = 3 -> TIE, both rank 1.
    // City Avg (Alice only): Alpha = 5, Beta = 1 -> Alpha ranks 1, Beta ranks 2.
    // Queried by accessible name (aria-label="Ranked firms") rather than DOM
    // position/order — robust to other <table> elements an expanded row's comments table
    // may add to the tree.
    const rankedTable = screen.getByRole("table", { name: "Ranked firms" });
    const rows = within(rankedTable).getAllByRole("row").slice(1); // skip header
    // Cell 0 is the row-expand toggle, 1 is Rank, 2 is Firm, 3 is Overall Weighted Total,
    // 4 is City Weighted Total, 5 is Completion.
    const cellsByFirm = Object.fromEntries(
      rows.map((row) => {
        const cells = within(row).getAllByRole("cell");
        return [cells[2].textContent, cells];
      }),
    );

    // Alpha: overall rank 1, city rank 1 — the two lenses AGREE, so the rank cell shows
    // just the overall rank with no "diverges" note.
    expect(within(cellsByFirm["Alpha Co"][1]).getByText("1")).toBeInTheDocument();
    expect(within(cellsByFirm["Alpha Co"][1]).queryByText(/City #/)).not.toBeInTheDocument();
    expect(cellsByFirm["Alpha Co"][3].textContent).toBe("3"); // Overall Weighted Total
    expect(cellsByFirm["Alpha Co"][4].textContent).toBe("5"); // City Weighted Total

    // Beta: tied overall rank 1, but city rank 2 — the lenses DISAGREE, so the rank cell
    // must also surface the city rank.
    expect(within(cellsByFirm["Beta Co"][1]).getByText("1")).toBeInTheDocument();
    expect(within(cellsByFirm["Beta Co"][1]).getByText(/City #2/)).toBeInTheDocument();
    expect(cellsByFirm["Beta Co"][3].textContent).toBe("3");
    expect(cellsByFirm["Beta Co"][4].textContent).toBe("1");

    // Completion: both firms fully scored by both reviewers (1 criterion * 2 reviewers).
    expect(cellsByFirm["Alpha Co"][5].textContent).toContain("2/2");

    // Toggle "show calculations" and confirm the raw per-reviewer scores are traceable.
    // (Since Phase 7, the Calculations view also hosts the manual entry grid, which
    // repeats each firm's name in its own table — so this must target the per-firm
    // heading specifically, not just any text match.)
    fireEvent.click(screen.getByRole("button", { name: "Show calculations" }));
    fireEvent.click(screen.getByRole("tab", { name: "Full Table" }));
    const calcView = screen.getByRole("tabpanel");
    expect(within(calcView).getByRole("heading", { name: "Alpha Co" })).toBeInTheDocument();
    // Raw scores: Alice=5, Bob=1 for Alpha's single criterion row.
    const calcTable = within(calcView).getAllByRole("table")[0];
    const dataRow = within(calcTable).getAllByRole("row")[1];
    const dataCells = within(dataRow).getAllByRole("cell");
    // Columns: Criterion, Weight, Alice(city), Bob(wfrc), Overall Avg, City Avg, ...
    expect(dataCells[2].textContent).toBe("5"); // Alice's raw score
    expect(dataCells[3].textContent).toBe("1"); // Bob's raw score
    expect(dataCells[4].textContent).toBe("3"); // Overall Avg
    expect(dataCells[5].textContent).toBe("5"); // City Avg
  });
});
