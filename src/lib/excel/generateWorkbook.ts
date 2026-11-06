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
import { scaleRange } from "../scoreScale";
import type { Criterion, Firm, Project, Reviewer } from "../../types/project";

export type GenerateWorkbookResult =
  { ok: true; blob: Blob; filename: string } | { ok: false; error: string };

/**
 * The pre-condition guard (spec Edge Cases, data-model.md): an empty Scoring sheet is
 * refused outright, not produced. An unresolved criterion-weight-sum warning does NOT
 * block generation (FR-010) — the workbook never displays weights at all, so it has no
 * effect on what the reviewer sees.
 */

// Rough characters-per-line of each merged banner region at its font size — used to size
// the banner rows, since Excel won't auto-fit a merged cell's row height.
const TITLE_CHARS_PER_LINE = 72; // A:C at 14pt bold
const REVIEWER_CHARS_PER_LINE = 30; // D:E, name at 18pt bold
const LEGEND_CHARS_PER_LINE = 88; // A:C at 11pt bold
const RANGE_CHARS_PER_LINE = 38; // D:E at 13pt bold
/** Excel's hard limit on a data validation's input-message body. */
const EXCEL_PROMPT_MAX = 255;

/** The Score cell's input message: what's allowed (`head`) plus each scale point's meaning. Excel
 * truncates anything past 255 characters, so long labels are shortened (evenly) until it fits
 * rather than silently losing the last anchor — usually the "5". */
function buildScorePrompt(sortedScale: { value: number; label: string }[], head: string): string {
  const render = (maxLabel: number) =>
    [
      head,
      ...sortedScale.map((p) => {
        const label =
          p.label.length > maxLabel ? `${p.label.slice(0, Math.max(0, maxLabel - 1))}…` : p.label;
        return `${p.value} = ${label}`;
      }),
    ].join("\n");
  for (let maxLabel = 120; maxLabel >= 8; maxLabel -= 2) {
    const text = render(maxLabel);
    if (text.length <= EXCEL_PROMPT_MAX) return text;
  }
  return render(8).slice(0, EXCEL_PROMPT_MAX);
}

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
  const { min: scaleMin, max: scaleMax } = scaleRange(project);
  const isContinuous = project.scoringScaleMode === "continuous";
  // Continuous mode: the configured points are labeled reference anchors, not the only
  // choices (lib/scoreScale.ts), so the banner states the allowed range separately and
  // prominently — a reviewer seeing "1 = Poor   ·   5 = Excellent" with no other cue would
  // reasonably assume those are the only two entries the Score cell will accept.
  const scaleLegend = `Scale:   ${sortedScale.map((p) => `${p.value} = ${p.label}`).join("   ·   ")}`;
  // Same slot, same styling, either mode — what the Score cell will accept.
  const allowedRange = isContinuous
    ? `Any value between ${scaleMin} and ${scaleMax} is allowed`
    : `Only these values are allowed: ${sortedScale.map((p) => p.value).join(", ")}`;
  const bannerFill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } } as const;

  // Row 1: title on the left, reviewer name on the right (larger, so it's the first thing a
  // reviewer sees confirming this is their sheet). A:C / D:E split — the importer never reads
  // the banner rows, so this is presentation only.
  sheet.mergeCells(`A${SCORING_TITLE_ROW}:C${SCORING_TITLE_ROW}`);
  sheet.mergeCells(`D${SCORING_TITLE_ROW}:E${SCORING_TITLE_ROW}`);
  const titleCell = sheet.getCell(`A${SCORING_TITLE_ROW}`);
  titleCell.value = `Proposal Evaluation Scoresheet — ${projectName}`;
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE_TEXT } };
  titleCell.fill = bannerFill;
  titleCell.alignment = { vertical: "middle", wrapText: true };
  titleCell.protection = { locked: true };
  const reviewerCell = sheet.getCell(`D${SCORING_TITLE_ROW}`);
  reviewerCell.value = {
    richText: [
      { text: "Reviewer:  ", font: { size: 11, color: { argb: WHITE_TEXT } } },
      { text: reviewer.name, font: { bold: true, size: 18, color: { argb: WHITE_TEXT } } },
    ],
  };
  reviewerCell.fill = bannerFill;
  reviewerCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
  reviewerCell.protection = { locked: true };
  // Merged cells don't auto-fit their row height, so size it from the text instead.
  const titleLines = Math.ceil(titleCell.value.toString().length / TITLE_CHARS_PER_LINE);
  const reviewerLines = Math.ceil((reviewer.name.length + 11) / REVIEWER_CHARS_PER_LINE);
  sheet.getRow(SCORING_TITLE_ROW).height = Math.max(34, 22 * titleLines, 26 * reviewerLines);

  // Row 2: scale legend on the left, what's allowed on the right (bold, larger) — the same
  // layout for continuous and discrete scales.
  sheet.mergeCells(`A${SCORING_SUBTITLE_ROW}:C${SCORING_SUBTITLE_ROW}`);
  const subtitleCell = sheet.getCell(`A${SCORING_SUBTITLE_ROW}`);
  subtitleCell.value = scaleLegend;
  subtitleCell.font = { bold: true, size: 11, color: { argb: WHITE_TEXT } };
  subtitleCell.fill = bannerFill;
  subtitleCell.alignment = { vertical: "middle", wrapText: true };
  subtitleCell.protection = { locked: true };
  sheet.mergeCells(`D${SCORING_SUBTITLE_ROW}:E${SCORING_SUBTITLE_ROW}`);
  const rangeCell = sheet.getCell(`D${SCORING_SUBTITLE_ROW}`);
  rangeCell.value = allowedRange;
  rangeCell.font = { bold: true, size: 13, color: { argb: WHITE_TEXT } };
  rangeCell.fill = bannerFill;
  rangeCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
  rangeCell.protection = { locked: true };
  const subtitleLines = Math.max(
    Math.ceil(scaleLegend.length / LEGEND_CHARS_PER_LINE),
    Math.ceil(allowedRange.length / RANGE_CHARS_PER_LINE),
  );
  sheet.getRow(SCORING_SUBTITLE_ROW).height = Math.max(24, 6 + 16 * subtitleLines);

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
  // Continuous mode: Excel's own built-in "decimal between" range check, not a custom
  // formula (lib/scoreScale.ts's rounding-to-one-decimal happens app-side, on import/manual
  // entry — this only guards the min/max range, same call made for weightInput.ts's
  // percent-vs-decimal question: keep the Excel-side rule simple, do the precision handling
  // in one place in the app instead of duplicating it into a fragile custom Excel formula).
  const scoreValidation: ExcelJS.DataValidation =
    project.scoringScaleMode === "discrete"
      ? {
          type: "list",
          allowBlank: true,
          formulae: [dropdownFormula],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid score",
          error: "Please choose one of the listed scale values.",
          showInputMessage: true,
          promptTitle: "Score: choose a listed value",
          prompt: buildScorePrompt(sortedScale, `Choose one of: ${scaleValues.join(", ")}.`),
        }
      : {
          type: "decimal",
          operator: "between",
          allowBlank: true,
          formulae: [scaleMin, scaleMax],
          showErrorMessage: true,
          errorStyle: "error",
          errorTitle: "Invalid score",
          error: `Please enter a number between ${scaleMin} and ${scaleMax}.`,
          // The hint Excel shows when a Score cell is selected: any in-range value is fine,
          // and what the anchor values mean (a bare "1 to 5" range wouldn't say what a 1 or
          // a 5 is).
          showInputMessage: true,
          promptTitle: `Score: ${scaleMin} to ${scaleMax}`,
          prompt: buildScorePrompt(
            sortedScale,
            `Any value between ${scaleMin} and ${scaleMax} is allowed.`,
          ),
        };

  // Tracks the previous row's firm so a thick top border can mark the FIRST row of every
  // firm after the first — a visual break between one firm's block of criteria rows and
  // the next, on a sheet that otherwise has no other cue where one firm's rows end and
  // another's begin besides re-reading column A on every row.
  let previousFirmId: string | null = null;

  plan.forEach(({ firm, criterion }, index) => {
    const r = SCORING_FIRST_DATA_ROW + index;
    const row = sheet.getRow(r);
    row.height = 18;
    const isFirmBoundary = previousFirmId !== null && firm.id !== previousFirmId;
    previousFirmId = firm.id;

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
      if (isFirmBoundary) {
        cell.border = { top: { style: "thick", color: { argb: BRAND_BLUE } } };
      }
    }
    // Hidden ID columns stay locked, no visual treatment needed (never seen).
    for (const c of [6, 7, 8]) {
      row.getCell(c).protection = { locked: true };
    }

    // Editable columns: WFRC-yellow tint + border — the primary "type here" cue. The firm-
    // boundary top border overrides just that one side (thick blue instead of thin yellow)
    // rather than replacing the whole border, so the yellow "editable" cue survives intact
    // on the other three sides.
    for (const c of [4, 5]) {
      const cell = row.getCell(c);
      cell.protection = { locked: false };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_YELLOW_TINT } };
      cell.border = {
        top: isFirmBoundary
          ? { style: "thick", color: { argb: BRAND_BLUE } }
          : { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        bottom: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        left: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
        right: { style: "thin", color: { argb: BRAND_YELLOW_BORDER } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    }

    // Score input restricted to the project's configured scale (FR-017) — a dropdown of
    // exact values in discrete mode, a min/max decimal range in continuous mode.
    row.getCell(4).dataValidation = scoreValidation;
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
