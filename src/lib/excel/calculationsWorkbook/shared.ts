// Shared visual language for every sheet in the Calculations .xlsx export (generateCalculationsWorkbook.ts
// and its sibling sheet builders in this folder) — one consistent "look" across all seven
// tabs (title/subtitle banner, header-row styling, brand colors) instead of each sheet
// inventing its own layout. Colors are the same raw WFRC brand hexes generateWorkbook.ts
// (the reviewer workbook) already uses — sourced from theme/tokens.css, never invented
// (constitution Principle VII).

import ExcelJS from "exceljs";

export const BRAND_BLUE = "FF023C5B"; // --color-wfrc-blue
export const BRAND_SECONDARY_BLUE = "FF52B6D5"; // --color-wfrc-secondary-blue — Calculations tab color
export const BRAND_YELLOW = "FFF8B93E"; // --color-wfrc-yellow — Results tab color (the headline deliverable)
export const BRAND_YELLOW_TINT = "FFFEF7E8"; // --color-wfrc-yellow at ~12% over white
export const BRAND_GRAY = "FF76716E"; // --color-wfrc-gray — config/reference tab color
export const LOCKED_FILL = "FFF2F0EE"; // zebra shade 1 (pale neutral gray)
export const LOCKED_FILL_ALT = "FFFFFFFF"; // zebra shade 2 (white)
export const WHITE_TEXT = "FFFFFFFF";
export const DARK_TEXT = "FF151515"; // --color-foreground
export const BORDER_GRAY = "FFD8D5D2"; // --color-border
export const DECIMAL_FORMAT = "0.00";

// Metric color-coding for the Calculations sheet's raw score + computed Avg/Wtd columns —
// same metric->color convention theme/chartColors.ts's useChartColors() hook establishes
// for every Dashboard chart (WFRC = blue, Overall = orange, TLC Applicant = green), just
// applied to cell fills instead of SVG strokes/fills. Each tint is that same chart token
// (--chart-1/2/3, light-mode value) blended to ~12% over white — the same blend ratio
// BRAND_YELLOW_TINT above already uses, so every "light tint over white" cell fill in this
// workbook reads consistently regardless of which brand hue it's tinting.
export const OVERALL_TINT = "FFF8F1E7"; // --chart-3 (rtp-mustard, light orange) at ~12% over white
export const APPLICANT_TINT = "FFEFF3E9"; // --chart-2 (rtp-green) at ~12% over white
export const WFRC_TINT = "FFE8EEF1"; // --chart-1 (rtp-blue) at ~12% over white

/** 1-indexed column number -> Excel column letter (1 -> "A", 26 -> "Z", 27 -> "AA", ...). */
export function columnLetter(n: number): string {
  let result = "";
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Rows 1-2 (title + subtitle, both brand-blue banners) on every sheet in this workbook,
 * matching generateWorkbook.ts's reviewer-workbook banner convention so the app's whole
 * Excel output family has one consistent "look." An optional row-3 instruction line
 * (yellow-tinted, matching the reviewer workbook's own instruction row) is available for
 * a sheet that needs to explain something before its table starts; row 3 is left blank
 * everywhere else, purely for breathing room before the header row.
 *
 * Returns the row number the caller's own header row should occupy — callers must not
 * hardcode this, since it shifts by one when `instruction` is supplied.
 */
export function addTitleBanner(
  sheet: ExcelJS.Worksheet,
  opts: { title: string; subtitle: string; instruction?: string; lastCol: number },
): number {
  const lastColLetter = columnLetter(opts.lastCol);

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: WHITE_TEXT } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(`A2:${lastColLetter}2`);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = opts.subtitle;
  subtitleCell.font = { bold: true, size: 11, color: { argb: WHITE_TEXT } };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
  subtitleCell.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 18;

  if (opts.instruction) {
    sheet.mergeCells(`A3:${lastColLetter}3`);
    const instructionCell = sheet.getCell("A3");
    instructionCell.value = opts.instruction;
    instructionCell.font = { italic: true, size: 10, color: { argb: DARK_TEXT } };
    instructionCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_YELLOW_TINT },
    };
    instructionCell.border = { bottom: { style: "thin", color: { argb: BRAND_YELLOW } } };
    instructionCell.alignment = { vertical: "middle" };
    sheet.getRow(3).height = 16;
    return 5; // row 4 left blank, header at row 5
  }
  return 4; // row 3 left blank, header at row 4
}

/** Styles one row as a header: bold white text on a brand-blue fill, one cell per entry in
 * `labels`, starting at `startCol` (1-indexed). */
export function styleHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  labels: string[],
  startCol = 1,
): void {
  const row = sheet.getRow(rowNum);
  row.height = 20;
  labels.forEach((label, i) => {
    const cell = row.getCell(startCol + i);
    cell.value = label;
    cell.font = { bold: true, color: { argb: WHITE_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.alignment = { vertical: "middle" };
  });
}

/** Thin light-gray border on all four sides — the standard "this is a real data table, not
 * loose text" cue used across the config/reference sheets' data rows. */
export function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BORDER_GRAY } };
  return { top: side, bottom: side, left: side, right: side };
}

/** Applies a zebra-striped fill + thin border to every cell in row `rowNum`, columns 1
 * through `lastCol` — the same alternating-row convention generateWorkbook.ts's locked
 * reference columns already use, extended here to a whole row at a time since these
 * config-sheet tables have no locked/editable split to preserve. */
export function zebraRow(sheet: ExcelJS.Worksheet, rowNum: number, lastCol: number, index: number): void {
  const fill = index % 2 === 1 ? LOCKED_FILL : LOCKED_FILL_ALT;
  const row = sheet.getRow(rowNum);
  for (let c = 1; c <= lastCol; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.border = thinBorder();
    cell.alignment = { ...cell.alignment, vertical: "top", wrapText: true };
  }
}
