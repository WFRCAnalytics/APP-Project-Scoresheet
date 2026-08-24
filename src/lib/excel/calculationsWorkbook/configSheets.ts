// The five reference/config tabs — Project Info, Firms, Reviewers, Criteria, Scoring Scale
// — mirroring the Configuration screen's own step order (info -> firms -> reviewers ->
// criteria -> scale) so a handler reading this workbook top-to-bottom sees the same setup
// the app itself walked through. Pure reference data: every value here is copied straight
// from `project` (there is nothing to derive), so unlike the Results/Calculations tabs
// there's no formula to write — these are the raw INPUTS those two tabs' formulas trace
// back to.

import ExcelJS from "exceljs";
import { formatIsoDate } from "../../formatDate";
import type { Project } from "../../../types/project";
import {
  BORDER_GRAY,
  BRAND_GRAY,
  DECIMAL_FORMAT,
  addTitleBanner,
  styleHeaderRow,
  zebraRow,
} from "./shared";

/** Adds the sheet, the standard title banner, and returns the row the caller's own header
 * row should occupy — every config sheet starts this same way. */
function newConfigSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  project: Project,
): { sheet: ExcelJS.Worksheet; headerRowNum: number } {
  const sheet = workbook.addWorksheet(name);
  sheet.properties.tabColor = { argb: BRAND_GRAY };
  const projectName = project.project.projectName || "Untitled Project";
  const headerRowNum = addTitleBanner(sheet, {
    title: `Proposal Evaluation Scoresheet — ${projectName}`,
    subtitle: name,
    lastCol: 4,
  });
  return { sheet, headerRowNum };
}

function buildProjectInfoSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const { sheet, headerRowNum } = newConfigSheet(workbook, "Project Info", project);
  sheet.columns = [
    { key: "field", width: 30 },
    { key: "value", width: 60 },
  ];
  styleHeaderRow(sheet, headerRowNum, ["Field", "Value"]);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  const rows: [string, string][] = [
    ["Project Name", project.project.projectName || "—"],
    ["Local Government Contact", project.project.localGovContact || "—"],
    ["Procurement Agent (WFRC PM)", project.project.procurementAgent || "—"],
    [
      "Selection Committee Meeting Date",
      project.project.committeeMeetingDate ? formatIsoDate(project.project.committeeMeetingDate) : "—",
    ],
    ["Notes", project.project.notes || "—"],
  ];
  rows.forEach(([field, value], i) => {
    const r = headerRowNum + 1 + i;
    sheet.getRow(r).getCell(1).value = field;
    sheet.getRow(r).getCell(1).font = { bold: true };
    sheet.getRow(r).getCell(2).value = value;
    zebraRow(sheet, r, 2, i);
  });
}

function buildFirmsSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const { sheet, headerRowNum } = newConfigSheet(workbook, "Firms", project);
  sheet.columns = [
    { key: "name", width: 30 },
    { key: "invited", width: 12 },
    { key: "submitted", width: 12 },
    { key: "notes", width: 50 },
  ];
  const headerLabels = ["Firm Name", "Invited", "Submitted", "Notes"];
  styleHeaderRow(sheet, headerRowNum, headerLabels);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  project.firms.forEach((firm, i) => {
    const r = headerRowNum + 1 + i;
    const row = sheet.getRow(r);
    row.getCell(1).value = firm.name;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = firm.invited ? "Yes" : "No";
    row.getCell(3).value = firm.submitted ? "Yes" : "No";
    row.getCell(4).value = firm.notes || "";
    zebraRow(sheet, r, headerLabels.length, i);
  });
}

function buildReviewersSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const { sheet, headerRowNum } = newConfigSheet(workbook, "Reviewers", project);
  sheet.columns = [
    { key: "name", width: 30 },
    { key: "type", width: 18 },
    { key: "email", width: 35 },
  ];
  const headerLabels = ["Reviewer Name", "Type", "Email"];
  styleHeaderRow(sheet, headerRowNum, headerLabels);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  project.reviewers.forEach((reviewer, i) => {
    const r = headerRowNum + 1 + i;
    const row = sheet.getRow(r);
    row.getCell(1).value = reviewer.name;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant";
    row.getCell(3).value = reviewer.email || "";
    zebraRow(sheet, r, headerLabels.length, i);
  });
}

function buildCriteriaSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const { sheet, headerRowNum } = newConfigSheet(workbook, "Criteria", project);
  sheet.columns = [
    { key: "name", width: 26 },
    { key: "weight", width: 14 },
    { key: "weightPct", width: 12 },
    { key: "description", width: 55 },
  ];
  const headerLabels = ["Criterion", "Weight (decimal)", "Weight (%)", "Description"];
  styleHeaderRow(sheet, headerRowNum, headerLabels);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  project.criteria.forEach((criterion, i) => {
    const r = headerRowNum + 1 + i;
    const row = sheet.getRow(r);
    row.getCell(1).value = criterion.name;
    row.getCell(1).font = { bold: true };
    const weightCell = row.getCell(2);
    weightCell.value = criterion.weight;
    weightCell.numFmt = DECIMAL_FORMAT;
    // Weight (%) — a live reference to the decimal cell, not a second independently-typed
    // value, so the two columns can never silently disagree; Excel's own "0%" number format
    // does the x100 + "%" display on the same underlying number.
    const pctCell = row.getCell(3);
    pctCell.value = { formula: `B${r}`, result: criterion.weight };
    pctCell.numFmt = "0%";
    row.getCell(4).value = criterion.description || "";
    row.getCell(4).alignment = { wrapText: true, vertical: "top" };
    zebraRow(sheet, r, headerLabels.length, i);
  });

  if (project.criteria.length > 0) {
    const totalRow = headerRowNum + 1 + project.criteria.length;
    const firstDataRow = headerRowNum + 1;
    const lastDataRow = totalRow - 1;
    sheet.getRow(totalRow).getCell(1).value = "Total Weight";
    sheet.getRow(totalRow).getCell(1).font = { bold: true };
    const totalCell = sheet.getRow(totalRow).getCell(2);
    totalCell.value = {
      formula: `SUM(B${firstDataRow}:B${lastDataRow})`,
      result: project.criteria.reduce((sum, c) => sum + c.weight, 0),
    };
    totalCell.numFmt = DECIMAL_FORMAT;
    totalCell.font = { bold: true };
    for (let c = 1; c <= headerLabels.length; c++) {
      sheet.getRow(totalRow).getCell(c).border = { top: { style: "thin", color: { argb: BORDER_GRAY } } };
    }
  }
}

function buildScoringScaleSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const { sheet, headerRowNum } = newConfigSheet(workbook, "Scoring Scale", project);
  sheet.columns = [
    { key: "value", width: 12 },
    { key: "label", width: 40 },
  ];
  const headerLabels = ["Value", "Label"];
  styleHeaderRow(sheet, headerRowNum, headerLabels);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  const sortedScale = [...project.scoringScale].sort((a, b) => a.value - b.value);
  sortedScale.forEach((point, i) => {
    const r = headerRowNum + 1 + i;
    const row = sheet.getRow(r);
    row.getCell(1).value = point.value;
    row.getCell(1).numFmt = DECIMAL_FORMAT;
    row.getCell(2).value = point.label;
    zebraRow(sheet, r, headerLabels.length, i);
  });

  const modeRow = headerRowNum + 1 + sortedScale.length + 1;
  const mode = project.scoringScaleMode === "continuous" ? "Continuous" : "Discrete";
  const modeDescription =
    project.scoringScaleMode === "continuous"
      ? "Continuous — a reviewer may enter any value between the lowest and highest points above, in steps of 0.1. The points above are labeled reference anchors, not the only choices."
      : "Discrete — a reviewer must choose exactly one of the values listed above.";
  sheet.mergeCells(`A${modeRow}:B${modeRow}`);
  const modeCell = sheet.getCell(`A${modeRow}`);
  modeCell.value = `Mode: ${mode} — ${modeDescription}`;
  modeCell.font = { italic: true, size: 10 };
  modeCell.alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(modeRow).height = 30;
}

/** Builds all five config/reference tabs, in the same order Configuration's own step flow
 * uses (info -> firms -> reviewers -> criteria -> scale). */
export function buildConfigSheets(workbook: ExcelJS.Workbook, project: Project): void {
  buildProjectInfoSheet(workbook, project);
  buildFirmsSheet(workbook, project);
  buildReviewersSheet(workbook, project);
  buildCriteriaSheet(workbook, project);
  buildScoringScaleSheet(workbook, project);
}
