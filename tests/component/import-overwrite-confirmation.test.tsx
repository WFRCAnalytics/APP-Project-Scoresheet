// 004 post-launch improvements, item 1a: reviewer-workbook import overwrite confirmation.
// FR-023's "last input wins" upsert used to happen silently on the same click as any other
// import. This drives the real UI (ImportScoresPanel, via App) to prove: (1) an import with
// zero overwrites is completely unaffected — one click still commits, no new dialog in the
// way; (2) an import with any overwrite shows the "Overwrites existing score" column with
// old -> new values, and requires a distinct, explicit second confirmation before anything
// is committed; (3) Cancelling that second confirmation commits nothing at all.

import { fireEvent, render, screen, within } from "@testing-library/react";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/App";
import { generateWorkbookForReviewer } from "../../src/lib/excel/generateWorkbook";
import { readFileArrayBuffer } from "../../src/lib/excel/parseWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Overwrite Confirmation Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }];
  return project;
}

async function buildCompletedWorkbookFile(
  project: Project,
  reviewerId: string,
  score: number,
): Promise<File> {
  const reviewer = project.reviewers.find((r) => r.id === reviewerId)!;
  const generated = await generateWorkbookForReviewer(project, reviewer);
  if (!generated.ok) throw new Error(generated.error);

  const generatedFile = new File([generated.blob], generated.filename);
  const arrayBuffer = await readFileArrayBuffer(generatedFile);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.getWorksheet("Scoring")!;
  sheet.getCell("D6").value = score; // single firm/criterion project -> exactly one data row
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer as unknown as BlobPart], generated.filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Loads the given project and lands on Reviewer Forms with a form already generated —
 * the shared setup every test here starts from. Handles both cases FR-002/FR-003 route
 * differently: a project with existing scores (some tests pre-populate one, to set up an
 * overwrite) lands on the Dashboard first and needs "Edit project" to reach Configuration;
 * an unscored project lands on Configuration directly. */
async function navigateToReviewerForms(project: Project) {
  openGetStartedModal();
  const file = new File([JSON.stringify(project)], "project.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });

  if (project.scores.length > 0) {
    await screen.findByRole("heading", { name: "Dashboard" });
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
  }
  await screen.findByRole("heading", { name: "Configuration" });
  goToConfigStep("Export / Review");
  fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
  await screen.findByRole("heading", { name: "Reviewer Forms" });
}

describe("Import overwrite confirmation", () => {
  beforeEach(() => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => "blob:mock";
      URL.revokeObjectURL = () => {};
    }
  });

  it("an import with ZERO overwrites is unaffected — one click still commits, no confirmation dialog appears", async () => {
    const project = buildProject(); // no prior scores
    render(<App />);
    await navigateToReviewerForms(project);

    const file = await buildCompletedWorkbookFile(project, "rev-1", 5);
    fireEvent.change(screen.getByLabelText("Select one or more completed .xlsx files"), {
      target: { files: [file] },
    });
    await screen.findByText(/Review before importing/);

    // No overwrite column content, no overwrite dialog on click.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm import \(1 score\)/ }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await screen.findByText(/Import complete/);
  });

  it("an import that WOULD overwrite an existing score opens a distinct confirmation, and commits nothing until it's confirmed", async () => {
    const project = buildProject();
    project.scores = [
      {
        reviewerId: "rev-1",
        firmId: "firm-1",
        criterionId: "crit-1",
        value: 1,
        comment: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    render(<App />);
    await navigateToReviewerForms(project);

    const file = await buildCompletedWorkbookFile(project, "rev-1", 5); // 1 -> 5
    fireEvent.change(screen.getByLabelText("Select one or more completed .xlsx files"), {
      target: { files: [file] },
    });
    await screen.findByText(/Review before importing/);

    // The overwrite is disclosed in the review table before any click happens.
    expect(screen.getByText(/Alpha Co \/ Approach: 1 → 5/)).toBeInTheDocument();

    // First click opens the gate, does NOT commit.
    fireEvent.click(screen.getByRole("button", { name: /Confirm import \(1 score\)/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Overwrite existing scores?" });
    expect(dialog).toHaveTextContent("overwrite 1 existing score");
    expect(screen.queryByText(/Import complete/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Yes, overwrite 1 existing score/ }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await screen.findByText(/Import complete/);
  });

  it("Cancelling the overwrite confirmation commits nothing — the review screen stays pending", async () => {
    const project = buildProject();
    project.scores = [
      {
        reviewerId: "rev-1",
        firmId: "firm-1",
        criterionId: "crit-1",
        value: 1,
        comment: "",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    render(<App />);
    await navigateToReviewerForms(project);

    const file = await buildCompletedWorkbookFile(project, "rev-1", 5);
    fireEvent.change(screen.getByLabelText("Select one or more completed .xlsx files"), {
      target: { files: [file] },
    });
    await screen.findByText(/Review before importing/);

    fireEvent.click(screen.getByRole("button", { name: /Confirm import \(1 score\)/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Overwrite existing scores?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Import complete/)).not.toBeInTheDocument();
    // Still on the pending review screen, not reset back to "no file chosen" either.
    expect(screen.getByText(/Review before importing/)).toBeInTheDocument();

    // Confirm the score genuinely wasn't committed: the Dashboard's Overall Weighted Total
    // must still reflect the original value (1), not the imported-but-uncommitted one (5).
    fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
    const rankedTable = await screen.findByRole("table", { name: "Ranked firms" });
    const dataRow = within(rankedTable).getAllByRole("row")[1];
    const cells = within(dataRow).getAllByRole("cell");
    expect(cells[3].textContent).toBe("1"); // Overall Weighted Total, unchanged
  });
});
