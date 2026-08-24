// Calculations modal's "Export as .xlsx" — a real spreadsheet of the same audit data the
// Full Table view shows (every raw score, every computed average/weighted total), for the
// handler's own offline reference. This is NOT the reviewer workbook (generateWorkbook.ts)
// — no protection, no dropdown, no hidden ID columns — just a clean formatted export of
// numbers that already exist, generated the same way (ExcelJS, brand-sourced header color)
// as everything else in this app's Excel pipeline.
//
// Every DERIVED column (Overall Avg, TLC Applicant Avg, Overall Wtd, TLC Applicant Wtd,
// Completion, and each firm's totals row) is a real Excel formula, not a hardcoded snapshot
// number — constitution Principle VI (Transparency) requires every number to be traceable
// back to raw inputs, and a static value pasted into a cell can't be interrogated or
// recalculated inside Excel itself the way a formula can. RAW inputs (Firm, Criterion,
// Weight, each reviewer's own Score column) stay literal values — they're the inputs, not
// something derived from other cells, so there's nothing for a formula to trace them to.
// ExcelJS "cannot process the formula to generate a result, it must be supplied" (its own
// docs), so every formula cell also carries a `result` cache computed the same way via
// lib/calculations.ts — Excel recalculates and overwrites that cache the moment the file is
// opened for real, but it keeps the file showing correct numbers in tools that don't (a
// quick preview pane, etc.).
//
// Formula design:
//  - Overall Avg = AVERAGE() across the (contiguous) full reviewer-score range for that row.
//    AVERAGE() ignores blank cells on its own, which is exactly liveScoresFor's "mean of
//    reviewers who actually scored this cell" — an unscored row naturally averages nothing.
//  - TLC Applicant Avg = AVERAGE() of just the applicant-type reviewers' score cells
//    (usually non-contiguous, so listed individually rather than as one range).
//  - Both wrapped in IFERROR(...,"") — AVERAGE() of an all-blank set is #DIV/0!, not blank,
//    which IFERROR converts back to the same "nothing to show yet" blank the app's own
//    overallAvg/applicantAvg return as `null`.
//  - Wtd columns = that row's Avg cell × its Weight cell, IFERROR-wrapped the same way (an
//    Avg cell holding "" propagates a #VALUE! from the multiplication, caught the same way).
//  - Each firm's totals row = SUM() over that firm's own Wtd column range. SUM() treats
//    blank/text cells as 0 automatically, which is exactly overallWeightedTotal's own
//    "an unscored criterion contributes 0 to the total" rule (calculations.ts) — no special
//    casing needed here, the same spreadsheet function that ignores blanks in AVERAGE also
//    zeroes them out in SUM.
//  - Completion = COUNT() across the reviewer-score range, concatenated with COLUMNS() of
//    that SAME range as the denominator — COUNT() only counts numeric cells, so it's
//    naturally "how many reviewers have a live score here," and deriving the denominator
//    from the range itself (rather than baking in the reviewerCount literal computed at
//    generation time) means it can't go stale independently of the range it's paired with.
// Avg/Wtd columns get a 2-decimal number format for clean on-screen display without
// truncating the underlying formula's full precision — round2() (display-only rounding,
// per its own doc comment in calculations.ts) is deliberately NOT baked into any formula
// here, matching the same "never round inside a calculation" rule Dashboard/Calculations
// view already follow.

import ExcelJS from "exceljs";
import { calculationsWorkbookFilename } from "../filenames";
import { applicantAvg, applicantWeightedTotal, completion, overallAvg, overallWeightedTotal } from "../calculations";
import type { Project } from "../../types/project";

const BRAND_BLUE = "FF023C5B"; // --color-wfrc-blue
const WHITE_TEXT = "FFFFFFFF";
const DECIMAL_FORMAT = "0.00";

/** 1-indexed column number -> Excel column letter (1 -> "A", 26 -> "Z", 27 -> "AA", ...). */
function columnLetter(n: number): string {
  let result = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

export async function generateCalculationsWorkbook(
  project: Project,
): Promise<{ blob: Blob; filename: string }> {
  const submittedFirms = project.firms.filter((f) => f.submitted);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Proposal Evaluation Scoresheet";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Calculations");

  const headerLabels = [
    "Firm",
    "Criterion",
    "Weight",
    ...project.reviewers.map((r) => `${r.name} (${r.type === "wfrc" ? "WFRC" : "TLC Applicant"})`),
    "Overall Avg",
    "TLC Applicant Avg",
    "Overall Wtd",
    "TLC Applicant Wtd",
    "Completion",
  ];

  sheet.columns = headerLabels.map((_, i) => ({
    key: `col${i}`,
    width: i === 0 || i === 1 ? 24 : i === 2 ? 9 : 16,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: WHITE_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Column layout — fixed for the whole sheet: Firm, Criterion, Weight, [reviewers...],
  // Overall Avg, TLC Applicant Avg, Overall Wtd, TLC Applicant Wtd, Completion.
  const reviewerCount = project.reviewers.length;
  const weightCol = 3;
  const firstReviewerCol = 4;
  const lastReviewerCol = 3 + reviewerCount;
  const overallAvgCol = 4 + reviewerCount;
  const applicantAvgCol = 5 + reviewerCount;
  const overallWtdCol = 6 + reviewerCount;
  const applicantWtdCol = 7 + reviewerCount;
  const completionCol = 8 + reviewerCount;

  const weightColLetter = columnLetter(weightCol);
  const overallAvgColLetter = columnLetter(overallAvgCol);
  const applicantAvgColLetter = columnLetter(applicantAvgCol);
  // Every applicant-type reviewer's column letter — usually non-contiguous, so AVERAGE()
  // lists them individually rather than assuming a range.
  const applicantReviewerColLetters = project.reviewers
    .map((reviewer, i) => ({ reviewer, colLetter: columnLetter(firstReviewerCol + i) }))
    .filter(({ reviewer }) => reviewer.type === "applicant")
    .map(({ colLetter }) => colLetter);

  let r = 2;
  for (const firm of submittedFirms) {
    const firmFirstRow = r;
    for (const criterion of project.criteria) {
      const oAvg = overallAvg(project, firm.id, criterion.id);
      const cAvg = applicantAvg(project, firm.id, criterion.id);
      const row = sheet.getRow(r);
      let c = 1;
      row.getCell(c++).value = firm.name;
      row.getCell(c++).value = criterion.name;
      row.getCell(c++).value = criterion.weight;
      for (const reviewer of project.reviewers) {
        const score = project.scores.find(
          (s) =>
            s.reviewerId === reviewer.id && s.firmId === firm.id && s.criterionId === criterion.id,
        );
        row.getCell(c++).value = score ? score.value : null;
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

      const applicantAvgCell = row.getCell(applicantAvgCol);
      if (applicantReviewerColLetters.length > 0) {
        const cellRefs = applicantReviewerColLetters.map((col) => `${col}${r}`).join(",");
        applicantAvgCell.value = { formula: `IFERROR(AVERAGE(${cellRefs}),"")`, result: cAvg ?? "" };
      } else {
        applicantAvgCell.value = null;
      }
      applicantAvgCell.numFmt = DECIMAL_FORMAT;

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
    }
    const firmLastRow = r - 1;

    // One bold totals row per firm, right under its criteria rows — SUM() over this firm's
    // own Overall Wtd / TLC Applicant Wtd rows, which naturally treats any still-blank
    // (not-yet-scored) criterion as a 0 contribution, same as overallWeightedTotal /
    // applicantWeightedTotal do in JS.
    const totalsRow = sheet.getRow(r);
    totalsRow.getCell(1).value = `${firm.name} — Weighted Totals`;
    totalsRow.getCell(1).font = { bold: true };

    const overallWtdColLetter = columnLetter(overallWtdCol);
    const applicantWtdColLetter = columnLetter(applicantWtdCol);
    const overallTotalCell = totalsRow.getCell(overallWtdCol);
    overallTotalCell.value = {
      formula: `SUM(${overallWtdColLetter}${firmFirstRow}:${overallWtdColLetter}${firmLastRow})`,
      result: overallWeightedTotal(project, firm.id),
    };
    overallTotalCell.numFmt = DECIMAL_FORMAT;
    overallTotalCell.font = { bold: true };

    const applicantTotalCell = totalsRow.getCell(applicantWtdCol);
    applicantTotalCell.value = {
      formula: `SUM(${applicantWtdColLetter}${firmFirstRow}:${applicantWtdColLetter}${firmLastRow})`,
      result: applicantWeightedTotal(project, firm.id),
    };
    applicantTotalCell.numFmt = DECIMAL_FORMAT;
    applicantTotalCell.font = { bold: true };

    // Thick rule under the totals row, spanning every column — caps off this firm's block
    // before the next firm's criteria rows start, the same visual break the reviewer
    // workbook (generateWorkbook.ts) puts between firms via a top border instead (this file
    // already ends each firm on its own bold totals row, so a bottom border here reads more
    // naturally than a top border on the next firm's first row would).
    for (let c = 1; c <= completionCol; c++) {
      const cell = totalsRow.getCell(c);
      cell.border = { ...cell.border, bottom: { style: "thick", color: { argb: BRAND_BLUE } } };
    }

    r++;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, filename: calculationsWorkbookFilename(project.project.projectName) };
}
