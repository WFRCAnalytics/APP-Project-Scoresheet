// The "Calculations" tab — full per-reviewer audit detail (every raw score, every
// intermediate Overall/TLC Applicant/WFRC Avg and Wtd figure), formerly the entire single-
// sheet export before this workbook grew Results and config/reference tabs alongside it.
// Same formula design as before this split — see this file's own comments below and
// generateCalculationsWorkbook.ts's header comment for the full rationale.
//
// Deliberately does NOT compute each firm's final Weighted Total here (it used to, via a
// bold "— Weighted Totals" row under each firm's criteria block) — that's the Results
// sheet's job now, computed directly there via SUMIF() over this sheet's own per-criterion
// Wtd columns (see resultsSheet.ts). This sheet stays scoped to raw scores + per-criterion
// intermediate figures; Results owns the one place a firm's bottom-line total is actually
// calculated.
//
// Cross-referenced, not hardcoded: the Firm, Criterion, Weight, and reviewer-column-header
// cells are real formulas pointing at the Firms/Criteria/Reviewers config tabs (the
// project's own canonical source tables for that data — see configSheets.ts), not literal
// strings/numbers copied in at generation time. The ONLY literal, hardcoded values on this
// entire sheet are the raw score cells themselves (project.scores' actual numbers — there is
// nothing to reference them FROM, they're the true inputs everything else derives from).
// This is a natural extension of this workbook's existing "every DERIVED number is a real
// formula" rule (constitution Principle VI) to LABELS too: a handler who edits a firm's name
// on the Firms tab sees that name update here as well, rather than this sheet silently
// holding a stale copy.
//
// The lookups below are direct cross-sheet CELL references (`=Firms!A5`), not
// XLOOKUP/VLOOKUP/INDEX-MATCH — there's no separate "find the right row" step needed
// because this sheet and every config tab it references are built from the exact same
// `project.firms`/`project.reviewers`/`project.criteria` arrays, in the same order, in the
// same generation pass, so each row's position on the config tab is already known
// (Firms/Criteria/Reviewers config sheets always start their data at row 5 — see
// configSheets.ts's own newConfigSheet — and Reviewers/Criteria are never filtered, so a
// reviewer/criterion's index in `project.reviewers`/`project.criteria` IS its row offset;
// Firms IS filtered down to `submitted` firms here, so a firm's row is computed from its
// index in the UNFILTERED `project.firms` array instead).
//
// Every raw score column AND its metric's computed Avg/Wtd columns share one light tint
// (WFRC = light blue, Overall = light orange, TLC Applicant = light green) — the exact
// same metric->color convention theme/chartColors.ts's useChartColors() hook establishes
// for every Dashboard chart, just applied here to make it obvious at a glance which raw
// column a computed column traces back to, without having to read every header.

import ExcelJS from "exceljs";
import { applicantAvg, completion, overallAvg, wfrcAvg } from "../../calculations";
import type { Project } from "../../../types/project";
import {
  APPLICANT_TINT,
  BRAND_BLUE,
  BRAND_SECONDARY_BLUE,
  DECIMAL_FORMAT,
  OVERALL_TINT,
  WFRC_TINT,
  addTitleBanner,
  columnLetter,
  styleHeaderRow,
} from "./shared";

function tintFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// Every config tab (Firms/Reviewers/Criteria) starts its data at row 5 — see
// configSheets.ts's newConfigSheet (title/subtitle banner, no instruction line -> header at
// row 4, data at row 5). Kept as a named constant here rather than re-deriving it, since
// this file and configSheets.ts have no runtime coupling to each other (see header comment).
const CONFIG_SHEET_FIRST_DATA_ROW = 5;

export interface CalculationsSheetResult {
  sheet: ExcelJS.Worksheet;
  headerRowNum: number;
  /** The full data range actually written (spans every firm, not just one) — what
   * resultsSheet.ts's SUMIF/SUMPRODUCT formulas match against. `lastDataRow < firstDataRow`
   * means nothing was written at all (no submitted firms, or no criteria configured). */
  firstDataRow: number;
  lastDataRow: number;
  reviewerFirstCol: number;
  reviewerLastCol: number;
  reviewerCount: number;
  overallWtdCol: number;
  applicantWtdCol: number;
  wfrcWtdCol: number;
}

export function buildCalculationsSheet(
  workbook: ExcelJS.Workbook,
  project: Project,
): CalculationsSheetResult {
  const submittedFirms = project.firms.filter((f) => f.submitted);
  const sheet = workbook.addWorksheet("Calculations");
  sheet.properties.tabColor = { argb: BRAND_SECONDARY_BLUE };

  const headerLabels = [
    "Firm",
    "Criterion",
    "Weight",
    ...project.reviewers.map((r) => `${r.name} (${r.type === "wfrc" ? "WFRC" : "TLC Applicant"})`),
    "Overall Avg",
    "TLC Applicant Avg",
    "WFRC Avg",
    "Overall Wtd",
    "TLC Applicant Wtd",
    "WFRC Wtd",
    "Completion",
  ];

  sheet.columns = headerLabels.map((_, i) => ({
    key: `col${i}`,
    width: i === 0 || i === 1 ? 24 : i === 2 ? 9 : 16,
  }));

  const projectName = project.project.projectName || "Untitled Project";
  const headerRowNum = addTitleBanner(sheet, {
    title: `Proposal Evaluation Scoresheet — ${projectName}`,
    subtitle: "Calculations — Full Audit Detail",
    instruction:
      "Every Avg/Wtd/Completion cell below is a live formula, not a hardcoded number — click any cell to see exactly how it's calculated.",
    lastCol: headerLabels.length,
  });
  styleHeaderRow(sheet, headerRowNum, headerLabels);

  // Reviewer header cells: overwrite the literal label styleHeaderRow just wrote with a
  // live formula concatenating that reviewer's own Name + Type cells on the Reviewers
  // config tab — "reviewer name list concatenated with their affiliation," computed, not
  // hardcoded. styleHeaderRow already applied the font/fill/alignment for every column
  // above; only `.value` changes here.
  project.reviewers.forEach((reviewer, i) => {
    const reviewersSheetRow = CONFIG_SHEET_FIRST_DATA_ROW + i;
    const cell = sheet.getRow(headerRowNum).getCell(4 + i);
    cell.value = {
      formula: `Reviewers!A${reviewersSheetRow}&" ("&Reviewers!B${reviewersSheetRow}&")"`,
      result: `${reviewer.name} (${reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant"})`,
    };
  });

  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  // Column layout — fixed for the whole sheet: Firm, Criterion, Weight, [reviewers...],
  // Overall Avg, TLC Applicant Avg, WFRC Avg, Overall Wtd, TLC Applicant Wtd, WFRC Wtd,
  // Completion.
  const reviewerCount = project.reviewers.length;
  const weightCol = 3;
  const firstReviewerCol = 4;
  const lastReviewerCol = 3 + reviewerCount;
  const overallAvgCol = 4 + reviewerCount;
  const applicantAvgCol = 5 + reviewerCount;
  const wfrcAvgCol = 6 + reviewerCount;
  const overallWtdCol = 7 + reviewerCount;
  const applicantWtdCol = 8 + reviewerCount;
  const wfrcWtdCol = 9 + reviewerCount;
  const completionCol = 10 + reviewerCount;

  const weightColLetter = columnLetter(weightCol);
  const overallAvgColLetter = columnLetter(overallAvgCol);
  const applicantAvgColLetter = columnLetter(applicantAvgCol);
  const wfrcAvgColLetter = columnLetter(wfrcAvgCol);
  // Every applicant-/wfrc-type reviewer's column letter — usually non-contiguous, so
  // AVERAGE() lists them individually rather than assuming a range.
  const applicantReviewerColLetters = project.reviewers
    .map((reviewer, i) => ({ reviewer, colLetter: columnLetter(firstReviewerCol + i) }))
    .filter(({ reviewer }) => reviewer.type === "applicant")
    .map(({ colLetter }) => colLetter);
  const wfrcReviewerColLetters = project.reviewers
    .map((reviewer, i) => ({ reviewer, colLetter: columnLetter(firstReviewerCol + i) }))
    .filter(({ reviewer }) => reviewer.type === "wfrc")
    .map(({ colLetter }) => colLetter);
  // Each reviewer's raw-score column gets that reviewer's own type's tint — same
  // metric->color mapping as the computed Avg/Wtd columns below, just extended one step
  // further back to the raw inputs those columns are computed from.
  const reviewerColTint: Record<number, string> = {};
  project.reviewers.forEach((reviewer, i) => {
    reviewerColTint[firstReviewerCol + i] = reviewer.type === "wfrc" ? WFRC_TINT : APPLICANT_TINT;
  });

  let r = headerRowNum + 1;
  const firstDataRow = r;
  for (const firm of submittedFirms) {
    const firmFirstRow = r;
    // This firm's row on the Firms config tab — its index in the UNFILTERED project.firms
    // array (Firms lists every firm, not just submitted ones; see header comment).
    const firmsSheetRow =
      CONFIG_SHEET_FIRST_DATA_ROW + project.firms.findIndex((f) => f.id === firm.id);

    project.criteria.forEach((criterion, critIdx) => {
      const oAvg = overallAvg(project, firm.id, criterion.id);
      const cAvg = applicantAvg(project, firm.id, criterion.id);
      const wAvg = wfrcAvg(project, firm.id, criterion.id);
      // This criterion's row on the Criteria config tab — Criteria is never filtered, so
      // its index in project.criteria IS its row offset there.
      const criteriaSheetRow = CONFIG_SHEET_FIRST_DATA_ROW + critIdx;
      const row = sheet.getRow(r);

      const firmCell = row.getCell(1);
      firmCell.value = { formula: `Firms!A${firmsSheetRow}`, result: firm.name };
      const criterionCell = row.getCell(2);
      criterionCell.value = { formula: `Criteria!A${criteriaSheetRow}`, result: criterion.name };
      const weightCell = row.getCell(3);
      weightCell.value = { formula: `Criteria!B${criteriaSheetRow}`, result: criterion.weight };

      let c = 4;
      for (const reviewer of project.reviewers) {
        const score = project.scores.find(
          (s) =>
            s.reviewerId === reviewer.id && s.firmId === firm.id && s.criterionId === criterion.id,
        );
        const reviewerCell = row.getCell(c);
        reviewerCell.value = score ? score.value : null;
        reviewerCell.fill = tintFill(reviewerColTint[c]);
        c++;
      }

      const overallAvgCell = row.getCell(overallAvgCol);
      if (reviewerCount > 0) {
        overallAvgCell.value = {
          formula: `IFERROR(AVERAGE(${columnLetter(firstReviewerCol)}${r}:${columnLetter(lastReviewerCol)}${r}),"")`,
          result: oAvg ?? "",
        };
      } else {
        overallAvgCell.value = null;
      }
      overallAvgCell.numFmt = DECIMAL_FORMAT;
      overallAvgCell.fill = tintFill(OVERALL_TINT);

      const applicantAvgCell = row.getCell(applicantAvgCol);
      if (applicantReviewerColLetters.length > 0) {
        const cellRefs = applicantReviewerColLetters.map((col) => `${col}${r}`).join(",");
        applicantAvgCell.value = { formula: `IFERROR(AVERAGE(${cellRefs}),"")`, result: cAvg ?? "" };
      } else {
        applicantAvgCell.value = null;
      }
      applicantAvgCell.numFmt = DECIMAL_FORMAT;
      applicantAvgCell.fill = tintFill(APPLICANT_TINT);

      const wfrcAvgCell = row.getCell(wfrcAvgCol);
      if (wfrcReviewerColLetters.length > 0) {
        const cellRefs = wfrcReviewerColLetters.map((col) => `${col}${r}`).join(",");
        wfrcAvgCell.value = { formula: `IFERROR(AVERAGE(${cellRefs}),"")`, result: wAvg ?? "" };
      } else {
        wfrcAvgCell.value = null;
      }
      wfrcAvgCell.numFmt = DECIMAL_FORMAT;
      wfrcAvgCell.fill = tintFill(WFRC_TINT);

      const overallWtdCell = row.getCell(overallWtdCol);
      if (reviewerCount > 0) {
        overallWtdCell.value = {
          formula: `IFERROR(${overallAvgColLetter}${r}*${weightColLetter}${r},"")`,
          result: oAvg !== null ? oAvg * criterion.weight : "",
        };
      } else {
        overallWtdCell.value = null;
      }
      overallWtdCell.numFmt = DECIMAL_FORMAT;
      overallWtdCell.fill = tintFill(OVERALL_TINT);

      const applicantWtdCell = row.getCell(applicantWtdCol);
      if (applicantReviewerColLetters.length > 0) {
        applicantWtdCell.value = {
          formula: `IFERROR(${applicantAvgColLetter}${r}*${weightColLetter}${r},"")`,
          result: cAvg !== null ? cAvg * criterion.weight : "",
        };
      } else {
        applicantWtdCell.value = null;
      }
      applicantWtdCell.numFmt = DECIMAL_FORMAT;
      applicantWtdCell.fill = tintFill(APPLICANT_TINT);

      const wfrcWtdCell = row.getCell(wfrcWtdCol);
      if (wfrcReviewerColLetters.length > 0) {
        wfrcWtdCell.value = {
          formula: `IFERROR(${wfrcAvgColLetter}${r}*${weightColLetter}${r},"")`,
          result: wAvg !== null ? wAvg * criterion.weight : "",
        };
      } else {
        wfrcWtdCell.value = null;
      }
      wfrcWtdCell.numFmt = DECIMAL_FORMAT;
      wfrcWtdCell.fill = tintFill(WFRC_TINT);

      const cellCompletion = completion(project, firm.id, { criterionId: criterion.id });
      const completionCell = row.getCell(completionCol);
      if (reviewerCount > 0) {
        // Denominator is COLUMNS() of the same range COUNT() reads, not the reviewerCount
        // literal baked in at generation time — the whole point of this being a formula
        // instead of a hardcoded string is that it stays correct on its own; a literal
        // number here would silently go stale the moment the range it's paired with did,
        // instead of failing loudly or just being derived from that same range directly.
        const reviewerRange = `${columnLetter(firstReviewerCol)}${r}:${columnLetter(lastReviewerCol)}${r}`;
        completionCell.value = {
          formula: `COUNT(${reviewerRange})&"/"&COLUMNS(${reviewerRange})`,
          result: `${cellCompletion.scored}/${cellCompletion.expected}`,
        };
      } else {
        completionCell.value = `${cellCompletion.scored}/${cellCompletion.expected}`;
      }

      r++;
    });
    const firmLastRow = r - 1;

    // Thick rule under this firm's LAST criteria row, spanning every column — caps off this
    // firm's block before the next firm's criteria rows start. Guarded: a firm with zero
    // criteria has no rows of its own at all (firmLastRow < firmFirstRow), and would
    // otherwise apply this border to whatever row precedes this firm's (empty) block —
    // possibly the header row itself.
    if (firmLastRow >= firmFirstRow) {
      const lastRow = sheet.getRow(firmLastRow);
      for (let c = 1; c <= completionCol; c++) {
        const cell = lastRow.getCell(c);
        cell.border = { ...cell.border, bottom: { style: "thick", color: { argb: BRAND_BLUE } } };
      }
    }
  }
  const lastDataRow = r - 1;

  return {
    sheet,
    headerRowNum,
    firstDataRow,
    lastDataRow,
    reviewerFirstCol: firstReviewerCol,
    reviewerLastCol: lastReviewerCol,
    reviewerCount,
    overallWtdCol,
    applicantWtdCol,
    wfrcWtdCol,
  };
}
