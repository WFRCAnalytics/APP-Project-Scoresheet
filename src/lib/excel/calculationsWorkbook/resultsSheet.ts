// The "Results" tab — the headline deliverable: every submitted firm's Rank and Overall/
// TLC Applicant/WFRC Weighted Total, in canonical ascending-overall-rank order (the same
// order the Dashboard's PDF export uses — see rankedRows.ts's own comment on why that order
// is canonical regardless of whatever on-screen sort a viewer had active).
//
// Every number here is a REAL formula, cross-referenced to other tabs rather than a value
// copied in or a fixed cell/row address baked in at generation time:
//  - Firm name is a direct cell reference to that firm's own row on the Firms config tab
//    (`=Firms!A5`), not a hardcoded string — same reasoning as Firm/Criterion/Weight on the
//    Calculations tab (see that file's header comment for why a direct reference, not
//    XLOOKUP/VLOOKUP/INDEX-MATCH, is enough here: this sheet and Firms are built from the
//    same `project.firms` array in the same generation pass, so each firm's row is already
//    known, not something that needs to be searched for).
//  - Each Weighted Total cell is SUMIF() — "sum the Calculations sheet's Overall/TLC
//    Applicant/WFRC Wtd column, for every row whose Firm matches THIS row's Firm" — matched
//    by VALUE (the firm's name), not a fixed row range computed at generation time. This is
//    what actually makes it a cross-tab LOOKUP rather than just a formula: the match
//    condition is evaluated by Excel itself when the file is opened, so it stays correct
//    even if a handler manually reorders or edits rows on the Calculations tab.
//  - Completion is the SUMPRODUCT/COUNTIF equivalent of the same idea: for each reviewer
//    column, count how many of THIS firm's cells (matched by name, same as the Wtd columns)
//    are numeric (i.e., actually scored), then sum across every reviewer column. The
//    denominator (expected scores) is that same per-firm row count times the Reviewers tab's
//    own row count (`COUNTA(Reviewers!...)`) — not the reviewerCount literal.
//
// SUMIF/COUNTIF/SUMPRODUCT here (not SUMIFS with a 3-D-ish "match column A, sum column D
// where..." combo, and not XLOOKUP) because they're the classic, universally-compatible
// Excel functions for "match by value, aggregate the corresponding cells" — no _xlfn prefix
// needed (see below), and no dependency on newer array-broadcasting behavior.
//
// Rank is Excel's own RANK() over this sheet's Overall Weighted Total column — standard
// competition ranking (ties share a rank, the next distinct value skips accordingly), the
// exact same rule calculations.ts's rankFirms() implements in JS. (Plain RANK(), not the
// newer RANK.EQ() — the latter needs an internal `_xlfn.` prefix to be recognized when a
// formula is written directly into the .xlsx XML by a non-Excel tool like ExcelJS; without
// it, Excel shows #NAME? instead of evaluating the formula. RANK() is the pre-2010 function
// name, needs no such prefix, and computes identically for this call shape. XLOOKUP is even
// newer than RANK.EQ and has the same prefix problem PLUS no fallback name at all in
// pre-2019 Excel — SUMIF/COUNTIF/SUMPRODUCT sidestep that entirely by being decades-old
// functions every spreadsheet application already recognizes natively.)
//
// The cached `result` for every formula cell here comes from calling that same
// calculations.ts (getRank/overallWeightedTotal/etc.) directly, rather than reimplementing
// tie-breaking or summation a second time — one source of truth for the VALUE, a real
// formula for how a handler can verify it inside Excel itself. A handler can click any cell
// here and trace it, through the Calculations tab, all the way back to a raw reviewer score
// — nothing on this sheet is a disconnected snapshot (constitution Principle VI).

import ExcelJS from "exceljs";
import {
  applicantWeightedTotal,
  completion,
  getRank,
  overallWeightedTotal,
  wfrcWeightedTotal,
} from "../../calculations";
import type { Project } from "../../../types/project";
import type { CalculationsSheetResult } from "./calculationsSheet";
import {
  BRAND_YELLOW,
  BRAND_YELLOW_TINT,
  DECIMAL_FORMAT,
  addTitleBanner,
  columnLetter,
  styleHeaderRow,
  thinBorder,
  zebraRow,
} from "./shared";

const CALC_SHEET = "Calculations";
const FIRMS_SHEET = "Firms";
const REVIEWERS_SHEET = "Reviewers";
// Every config tab's data starts at row 5 (title/subtitle banner, no instruction line ->
// header at row 4) — see calculationsSheet.ts's identical constant/comment.
const CONFIG_SHEET_FIRST_DATA_ROW = 5;

const RANK_COL = 1;
const FIRM_COL = 2;
const OVERALL_WTD_COL = 3;
const APPLICANT_WTD_COL = 4;
const WFRC_WTD_COL = 5;
const COMPLETION_COL = 6;

/**
 * Populates an ALREADY-CREATED worksheet (rather than creating one itself, the way the
 * other sheet builders in this folder do) — the orchestrator has to add this sheet to the
 * workbook first, before Calculations exists, so tab order comes out with Results leftmost
 * (ExcelJS has no supported way to reorder sheets after the fact — insertion order IS tab
 * order); but this sheet's actual CONTENT depends on Calculations already existing (it
 * cross-references cells on it), so creation and population happen in two separate steps.
 * See generateCalculationsWorkbook.ts's orchestration comment for the full sequencing.
 */
export function buildResultsSheet(
  sheet: ExcelJS.Worksheet,
  project: Project,
  calc: CalculationsSheetResult,
): void {
  sheet.properties.tabColor = { argb: BRAND_YELLOW };

  const headerLabels = [
    "Rank",
    "Firm",
    "Overall Weighted Total",
    "TLC Applicant Weighted Total",
    "WFRC Weighted Total",
    "Completion",
  ];
  sheet.columns = headerLabels.map((_, i) => ({
    key: `col${i}`,
    width: i === RANK_COL - 1 ? 8 : i === FIRM_COL - 1 ? 28 : 22,
  }));

  const projectName = project.project.projectName || "Untitled Project";
  const headerRowNum = addTitleBanner(sheet, {
    title: `Proposal Evaluation Scoresheet — ${projectName}`,
    subtitle: "Results — Final Ranked Weighted Totals",
    lastCol: headerLabels.length,
  });
  styleHeaderRow(sheet, headerRowNum, headerLabels);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  // Canonical order: ascending overall rank (highest-ranked firm first) — same ordering
  // rankedRows.ts's buildRankedRows() produces for the Dashboard/PDF.
  const order = project.firms
    .filter((f) => f.submitted)
    .map((firm) => ({ firm, overallRank: getRank(project, firm.id, "overall") ?? 0 }))
    .sort((a, b) => a.overallRank - b.overallRank);

  if (order.length === 0) {
    return;
  }

  // Whether Calculations actually has any rows to match against — false when there are no
  // criteria configured at all (buildCalculationsSheet wrote nothing). Guards every SUMIF/
  // SUMPRODUCT formula below from matching against an empty/inverted range.
  const hasCalcData = calc.lastDataRow >= calc.firstDataRow;
  const calcDataRange = (colLetter: string) =>
    `'${CALC_SHEET}'!${colLetter}$${calc.firstDataRow}:${colLetter}$${calc.lastDataRow}`;
  const calcFirmRange = calcDataRange(columnLetter(1)); // Calculations' Firm column (A)

  const firstDataRow = headerRowNum + 1;
  const lastDataRow = firstDataRow + order.length - 1;
  const overallWtdColLetter = columnLetter(OVERALL_WTD_COL);
  const rankRange = `$${overallWtdColLetter}$${firstDataRow}:$${overallWtdColLetter}$${lastDataRow}`;

  order.forEach(({ firm, overallRank }, i) => {
    const r = firstDataRow + i;
    const row = sheet.getRow(r);
    const firmCellRef = `B${r}`; // this row's own Firm cell — the SUMIF/COUNTIF match key

    const rankCell = row.getCell(RANK_COL);
    rankCell.value = {
      formula: `RANK(${overallWtdColLetter}${r},${rankRange},0)`,
      result: overallRank,
    };
    rankCell.alignment = { horizontal: "center", vertical: "top" };

    const firmsSheetRow =
      CONFIG_SHEET_FIRST_DATA_ROW + project.firms.findIndex((f) => f.id === firm.id);
    const firmCell = row.getCell(FIRM_COL);
    firmCell.value = { formula: `${FIRMS_SHEET}!A${firmsSheetRow}`, result: firm.name };
    firmCell.font = { bold: true };

    const setWeightedTotalCell = (col: number, calcColNum: number, jsResult: number) => {
      const cell = row.getCell(col);
      cell.value = hasCalcData
        ? {
            formula: `SUMIF(${calcFirmRange},${firmCellRef},${calcDataRange(columnLetter(calcColNum))})`,
            result: jsResult,
          }
        : jsResult; // no Calculations rows at all — nothing to sum, use the (0) result directly
      cell.numFmt = DECIMAL_FORMAT;
      return cell;
    };

    setWeightedTotalCell(
      OVERALL_WTD_COL,
      calc.overallWtdCol,
      overallWeightedTotal(project, firm.id),
    ).font = { bold: true };
    setWeightedTotalCell(APPLICANT_WTD_COL, calc.applicantWtdCol, applicantWeightedTotal(project, firm.id));
    setWeightedTotalCell(WFRC_WTD_COL, calc.wfrcWtdCol, wfrcWeightedTotal(project, firm.id));

    const completionCell = row.getCell(COMPLETION_COL);
    const comp = completion(project, firm.id);
    if (hasCalcData && calc.reviewerCount > 0) {
      // One SUMPRODUCT term per reviewer column — each multiplies the (this-firm-matches)
      // array by an (is-this-cell-numeric) array, both the same single-column shape, which
      // is what keeps this compatible with every Excel version (a single SUMPRODUCT trying
      // to broadcast a 1-column match array against a multi-column value range directly is
      // NOT reliably supported outside the newest dynamic-array Excel engine).
      const scoredTerms: string[] = [];
      for (let col = calc.reviewerFirstCol; col <= calc.reviewerLastCol; col++) {
        scoredTerms.push(
          `SUMPRODUCT((${calcFirmRange}=${firmCellRef})*ISNUMBER(${calcDataRange(columnLetter(col))}))`,
        );
      }
      const scoredFormula = scoredTerms.join("+");
      const expectedFormula = `COUNTIF(${calcFirmRange},${firmCellRef})*COUNTA(${REVIEWERS_SHEET}!$A$${CONFIG_SHEET_FIRST_DATA_ROW}:$A$${CONFIG_SHEET_FIRST_DATA_ROW + calc.reviewerCount - 1})`;
      completionCell.value = {
        formula: `(${scoredFormula})&"/"&(${expectedFormula})`,
        result: `${comp.scored}/${comp.expected}`,
      };
    } else {
      completionCell.value = `${comp.scored}/${comp.expected}`;
    }

    // Leading firm(s) (rank 1) get a subtle highlight instead of the usual zebra stripe —
    // the same "worth noticing first" signal the Dashboard's Badge variant="info" gives the
    // top row.
    if (overallRank === 1) {
      for (let c = 1; c <= headerLabels.length; c++) {
        row.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND_YELLOW_TINT },
        };
      }
    } else {
      zebraRow(sheet, r, headerLabels.length, i);
    }
    for (let c = 1; c <= headerLabels.length; c++) {
      row.getCell(c).border = thinBorder();
    }
  });
}
