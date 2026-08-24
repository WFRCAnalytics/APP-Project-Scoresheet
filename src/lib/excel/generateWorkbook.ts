// T031 (redesigned): Generates one reviewer's .xlsx scoring workbook as a SINGLE
// well-formatted sheet — not the original two-sheet (Instructions + Scoring) layout. This
// is a deliberate, disclosed contract change (contracts/reviewer-workbook.md updated to
// match): a banner (title/reviewer/scale legend/instructions) occupies rows 1-3 of the
// "Scoring" sheet itself, the real header row follows at SCORING_HEADER_ROW, and data
// starts at SCORING_FIRST_DATA_ROW. parseWorkbook.ts locates the header row dynamically
// (scans for the literal "Firm" header text) rather than assuming row 1, so this isn't a
// hardcoded-row-number contract between the two files.
//
// Visual cues replace "click a cell and see if Excel complains": locked reference columns
// (Firm/Criterion/Description) get a pale gray fill; editable columns (Score/Comments) get
// a WFRC-yellow tint + border. Every color traces to a real WFRC brand hex from
// theme/tokens.css (constitution Principle VII — sourced, not invented), not a new palette
// invented for this file.
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
  { ok: true; blob: Blob; filename: string } | { ok: false; error: string };

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

// ---- Brand colors (raw hex from theme/tokens.css — sourced, not invented) ----
const BRAND_BLUE = "FF023C5B"; // --color-wfrc-blue
const BRAND_YELLOW_BORDER = "FFF8B93E"; // --color-wfrc-yellow, full strength, used as a border
const BRAND_YELLOW_TINT = "FFFEF7E8"; // --color-wfrc-yellow at ~12% over white — editable-cell fill
const LOCKED_FILL = "FFF2F0EE"; // pale neutral gray — locked/reference-cell fill (zebra shade 1)
const LOCKED_FILL_ALT = "FFFFFFFF"; // white — locked/reference-cell fill (zebra shade 2)
const WHITE_TEXT = "FFFFFFFF";
const DARK_TEXT = "FF151515"; // --color-foreground

// ---- Row layout constants — the single source of truth for where things live on the
// sheet. parseWorkbook.ts does NOT import these; it locates the header row dynamically
// (see findHeaderRow there) so the two files aren't coupled to a hardcoded row number.
// Exported for tests only, so test assertions read row numbers from here rather than
// hardcoding them a second time. ----
export const SCORING_TITLE_ROW = 1;
export const SCORING_SUBTITLE_ROW = 2;
export const SCORING_INSTRUCTION_ROW = 3;
export const SCORING_HEADER_ROW = 5;
export const SCORING_FIRST_DATA_ROW = 6;

const HEADER_LABELS = [
  "Firm",
  "Criterion",
  "Criterion Description",
  "Score",
  "Comments",
  "reviewerId",
  "firmId",
  "criterionId",
];

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

  // Width/key only — no `header` property, so this does NOT write anything to row 1 the
  // way the old { header, key, width } shorthand did. Header text is placed explicitly at
  // SCORING_HEADER_ROW below, since row 1 is now the title banner.
  sheet.columns = [
    { key: "firm", width: 28 },
    { key: "criterion", width: 24 },
    { key: "description", width: 45 },
    { key: "score", width: 12 },
    { key: "comments", width: 45 },
    { key: "reviewerId", width: 20 },
    { key: "firmId", width: 20 },
    { key: "criterionId", width: 20 },
  ];

  const projectName = project.project.projectName || "Untitled Project";
  const sortedScale = [...project.scoringScale].sort((a, b) => a.value - b.value);
  const scaleLegend = sortedScale.map((p) => `${p.value} = ${p.label}`).join("   ·   ");

  // Row 1: title banner.
  sheet.mergeCells(`A${SCORING_TITLE_ROW}:E${SCORING_TITLE_ROW}`);
  const titleCell = sheet.getCell(`A${SCORING_TITLE_ROW}`);
  titleCell.value = `Proposal Evaluation Scoresheet — ${projectName}`;
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE_TEXT } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  titleCell.alignment = { vertical: "middle" };
  titleCell.protection = { locked: true };
  sheet.getRow(SCORING_TITLE_ROW).height = 24;

  // Row 2: reviewer name + inline scale legend.
  sheet.mergeCells(`A${SCORING_SUBTITLE_ROW}:E${SCORING_SUBTITLE_ROW}`);
  const subtitleCell = sheet.getCell(`A${SCORING_SUBTITLE_ROW}`);
  subtitleCell.value = `Reviewer: ${reviewer.name}      Scale: ${scaleLegend}`;
  subtitleCell.font = { bold: true, size: 11, color: { argb: WHITE_TEXT } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  subtitleCell.alignment = { vertical: "middle" };
  subtitleCell.protection = { locked: true };
  sheet.getRow(SCORING_SUBTITLE_ROW).height = 18;

  // Row 3: instruction line, styled in the same tint as the editable columns below it —
  // the color itself explains what "editable" looks like before you even reach the table.
  sheet.mergeCells(`A${SCORING_INSTRUCTION_ROW}:E${SCORING_INSTRUCTION_ROW}`);
  const instructionCell = sheet.getCell(`A${SCORING_INSTRUCTION_ROW}`);
  instructionCell.value =
    "Only the highlighted Score and Comments cells are editable — everything else is locked.";
  instructionCell.font = { italic: true, size: 10, color: { argb: DARK_TEXT } };
  instructionCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_YELLOW_TINT },
  };
  instructionCell.border = { bottom: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } } };
  instructionCell.alignment = { vertical: "middle" };
  instructionCell.protection = { locked: true };
  sheet.getRow(SCORING_INSTRUCTION_ROW).height = 16;

  // Row 4 is left blank on purpose (breathing room before the table).

  // Row 5: the real header row.
  const headerRow = sheet.getRow(SCORING_HEADER_ROW);
  headerRow.height = 20;
  HEADER_LABELS.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: WHITE_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.alignment = { vertical: "middle" };
    cell.protection = { locked: true };
  });

  // Row order: firms in project order, criteria in project order within each firm
  // (contracts/reviewer-workbook.md — deterministic, matters for diffing/debugging).
  const plan: ScoringRowPlan[] = [];
  for (const firm of submittedFirms) {
    for (const criterion of project.criteria) {
      plan.push({ firm, criterion });
    }
  }

  const scaleValues = project.scoringScale.map((p) => p.value);
  const dropdownFormula = `"${scaleValues.join(",")}"`;

  plan.forEach(({ firm, criterion }, index) => {
    const r = SCORING_FIRST_DATA_ROW + index;
    const row = sheet.getRow(r);
    row.height = 18;
    row.getCell(1).value = firm.name;
    row.getCell(2).value = criterion.name;
    row.getCell(3).value = criterion.description;
    row.getCell(4).value = null;
    row.getCell(5).value = "";
    row.getCell(6).value = reviewer.id;
    row.getCell(7).value = firm.id;
    row.getCell(8).value = criterion.id;

    // Locked reference columns: pale gray fill, zebra-striped for readability on a long
    // list. Zebra is applied ONLY to these columns — the editable columns keep one
    // consistent tint throughout so they stay easy to track down a long column.
    const lockedFill = index % 2 === 1 ? LOCKED_FILL : LOCKED_FILL_ALT;
    for (const c of [1, 2, 3]) {
      const cell = row.getCell(c);
      cell.protection = { locked: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lockedFill } };
      cell.alignment = { vertical: "top", wrapText: true };
    }
    // Hidden ID columns stay locked, no visual treatment needed (never seen).
    for (const c of [6, 7, 8]) {
      row.getCell(c).protection = { locked: true };
    }

    // Editable columns: WFRC-yellow tint + border — the primary "type here" cue.
    for (const c of [4, 5]) {
      const cell = row.getCell(c);
      cell.protection = { locked: false };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_YELLOW_TINT } };
      cell.border = {
        top: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        bottom: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        left: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        right: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    }

    // Score dropdown restricted to the project's configured scale values (FR-017).
    row.getCell(4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [dropdownFormula],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Invalid score",
      error: "Please choose one of the listed scale values.",
    };
  });

  // Hidden ID columns (F, G, H) — never re-derived from visible text on import.
  sheet.getColumn(6).hidden = true;
  sheet.getColumn(7).hidden = true;
  sheet.getColumn(8).hidden = true;

  // Freeze everything through the header row, so it stays visible while scrolling a long
  // list of firm x criterion rows.
  sheet.views = [{ state: "frozen", ySplit: SCORING_HEADER_ROW }];

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
  workbook.creator = "Proposal Evaluation Scoresheet";
  workbook.created = new Date();

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
