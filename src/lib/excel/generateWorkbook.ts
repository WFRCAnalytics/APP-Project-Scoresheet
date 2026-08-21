// T031: Generates one reviewer's .xlsx scoring workbook, per
// contracts/reviewer-workbook.md exactly — Instructions + Scoring sheets, a
// dropdown-validated Score column, locked reference/ID columns, and hidden protected
// reviewerId/firmId/criterionId columns (FR-015–FR-018).
//
// This is the ONE place both the single-reviewer ("download form") and batch ("download
// all forms") actions call into (FR-019) — T033/T034 just invoke this once per reviewer,
// so the two paths cannot drift out of sync with each other.
//
// This is also where the pre-condition guard lives (per /speckit-analyze finding I1,
// resolved during Phase 4 planning): a typed "cannot generate" result rather than a
// caller-side check duplicated in two button components.

import ExcelJS from "exceljs";
import { reviewerWorkbookFilename } from "../filenames";
import type { Criterion, Firm, Project, Reviewer } from "../../types/project";

export type GenerateWorkbookResult =
  | { ok: true; blob: Blob; filename: string }
  | { ok: false; error: string };

/**
 * The pre-condition guard (spec Edge Cases, data-model.md): an empty Scoring sheet is
 * refused outright, not produced. An unresolved criterion-weight-sum warning does NOT
 * block generation (FR-010) — the workbook never displays weights at all, so it has no
 * effect on what the reviewer sees.
 */
export function checkCanGenerateWorkbooks(project: Project): string | null {
  if (project.criteria.length === 0) {
    return "Add at least one criterion before generating reviewer forms — an empty Scoring sheet would have nothing to score.";
  }
  if (!project.firms.some((f) => f.submitted)) {
    return "Mark at least one firm as submitted before generating reviewer forms — an empty Scoring sheet would have nothing to score.";
  }
  return null;
}

function buildInstructionsSheet(workbook: ExcelJS.Workbook, project: Project, reviewer: Reviewer) {
  const sheet = workbook.addWorksheet("Instructions");
  sheet.getColumn(1).width = 90;

  const projectName = project.project.projectName || "Untitled Project";
  let row = 1;

  const titleCell = sheet.getCell(`A${row}`);
  titleCell.value = `Project: ${projectName}`;
  titleCell.font = { bold: true, size: 14 };
  row += 1;

  const reviewerCell = sheet.getCell(`A${row}`);
  reviewerCell.value = `Reviewer: ${reviewer.name}`;
  reviewerCell.font = { bold: true };
  row += 2;

  const legendHeaderCell = sheet.getCell(`A${row}`);
  legendHeaderCell.value = "Scoring scale:";
  legendHeaderCell.font = { bold: true };
  row += 1;

  const sortedScale = [...project.scoringScale].sort((a, b) => a.value - b.value);
  for (const point of sortedScale) {
    sheet.getCell(`A${row}`).value = `${point.value} — ${point.label}`;
    row += 1;
  }
  row += 1;

  sheet.getCell(`A${row}`).value =
    "Only the Score and Comments columns on the Scoring sheet should be edited.";
  sheet.getCell(`A${row}`).font = { italic: true };
}

interface ScoringRowPlan {
  firm: Firm;
  criterion: Criterion;
}

function buildScoringSheet(
  workbook: ExcelJS.Workbook,
  project: Project,
  reviewer: Reviewer,
  submittedFirms: Firm[],
) {
  const sheet = workbook.addWorksheet("Scoring");

  sheet.columns = [
    { header: "Firm", key: "firm", width: 28 },
    { header: "Criterion", key: "criterion", width: 24 },
    { header: "Criterion Description", key: "description", width: 45 },
    { header: "Score", key: "score", width: 10 },
    { header: "Comments", key: "comments", width: 45 },
    { header: "reviewerId", key: "reviewerId", width: 20 },
    { header: "firmId", key: "firmId", width: 20 },
    { header: "criterionId", key: "criterionId", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  // Row order: firms in project order, criteria in project order within each firm
  // (contracts/reviewer-workbook.md — deterministic, matters for diffing/debugging).
  const plan: ScoringRowPlan[] = [];
  for (const firm of submittedFirms) {
    for (const criterion of project.criteria) {
      plan.push({ firm, criterion });
    }
  }

  for (const { firm, criterion } of plan) {
    sheet.addRow({
      firm: firm.name,
      criterion: criterion.name,
      description: criterion.description,
      score: null,
      comments: "",
      reviewerId: reviewer.id,
      firmId: firm.id,
      criterionId: criterion.id,
    });
  }

  // Hidden ID columns (F, G, H) — never re-derived from visible text on import.
  sheet.getColumn("reviewerId").hidden = true;
  sheet.getColumn("firmId").hidden = true;
  sheet.getColumn("criterionId").hidden = true;

  const lastRow = sheet.rowCount;
  const scaleValues = project.scoringScale.map((p) => p.value);
  const dropdownFormula = `"${scaleValues.join(",")}"`;

  const LOCKED_COLUMNS = ["A", "B", "C", "F", "G", "H"] as const;
  const UNLOCKED_COLUMNS = ["D", "E"] as const;

  for (let r = 2; r <= lastRow; r++) {
    for (const col of LOCKED_COLUMNS) {
      sheet.getCell(`${col}${r}`).protection = { locked: true };
    }
    for (const col of UNLOCKED_COLUMNS) {
      sheet.getCell(`${col}${r}`).protection = { locked: false };
    }

    // Score dropdown restricted to the project's configured scale values (FR-017).
    sheet.getCell(`D${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [dropdownFormula],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Invalid score",
      error: "Please choose one of the listed scale values.",
    };
  }

  return sheet;
}

/**
 * Generates one .xlsx workbook for one reviewer. Returns `ok: false` with a
 * human-readable message if the pre-condition guard fails — callers (T033/T034) surface
 * that message rather than re-checking it themselves.
 */
export async function generateWorkbookForReviewer(
  project: Project,
  reviewer: Reviewer,
): Promise<GenerateWorkbookResult> {
  const guardError = checkCanGenerateWorkbooks(project);
  if (guardError) {
    return { ok: false, error: guardError };
  }

  const submittedFirms = project.firms.filter((f) => f.submitted);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Consultant Selection Scoring";
  workbook.created = new Date();

  buildInstructionsSheet(workbook, project, reviewer);
  const scoringSheet = buildScoringSheet(workbook, project, reviewer, submittedFirms);

  // No password (research.md §7 / spec Assumptions): protection prevents accidental
  // edits, not a deliberate bypass attempt, so an empty password is the correct choice
  // here — not a placeholder for one to be added later.
  await scoringSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = reviewerWorkbookFilename(project.project.projectName, reviewer.name);

  return { ok: true, blob, filename };
}
