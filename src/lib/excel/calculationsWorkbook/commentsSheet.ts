// The Comments tab: every recorded score, one row each, with the reviewer's comment beside it
// (blank if they left none) — so the written feedback travels with the numbers in the export
// instead of living only on the Dashboard and in the project JSON.
//
// A flat table rather than extra columns on the Calculations tab: that tab is one wide
// firm x criterion grid with a column per reviewer and live formulas, and a comment column
// per reviewer would roughly double its width. Flat rows also filter and sort naturally in
// Excel (an auto-filter is set on the header), e.g. one firm's comments, or one reviewer's.
//
// Row order is firms (project order, submitted only — the same set the Calculations tab
// scores), then criteria, then reviewers, the same order the reviewer workbook uses. Scores
// whose firm/criterion/reviewer no longer exists are left out, the same way every other
// number in this workbook ignores them. Plain values, no formulas: unlike the Calculations
// and Results tabs there is nothing derived here, only the recorded inputs.

import ExcelJS from "exceljs";
import type { Project } from "../../../types/project";
import { BRAND_SECONDARY_BLUE, addTitleBanner, styleHeaderRow, zebraRow } from "./shared";

const HEADER_LABELS = ["Firm", "Criterion", "Reviewer", "Reviewer Type", "Score", "Comment"];
const COMMENT_COL = HEADER_LABELS.length;

export function buildCommentsSheet(workbook: ExcelJS.Workbook, project: Project): void {
  const sheet = workbook.addWorksheet("Comments");
  sheet.properties.tabColor = { argb: BRAND_SECONDARY_BLUE };
  sheet.columns = [
    { key: "firm", width: 24 },
    { key: "criterion", width: 24 },
    { key: "reviewer", width: 22 },
    { key: "type", width: 16 },
    { key: "score", width: 9 },
    { key: "comment", width: 70 },
  ];

  const projectName = project.project.projectName || "Untitled Project";
  const headerRowNum = addTitleBanner(sheet, {
    title: `Proposal Evaluation Scoresheet — ${projectName}`,
    subtitle: "Reviewer Scores & Comments",
    instruction:
      "Every score reviewers recorded, with their comment where they left one. Use the filter arrows on the header row to narrow by firm, criterion, or reviewer.",
    lastCol: HEADER_LABELS.length,
  });
  styleHeaderRow(sheet, headerRowNum, HEADER_LABELS);
  sheet.views = [{ state: "frozen", ySplit: headerRowNum }];

  let rowIndex = 0;
  for (const firm of project.firms.filter((f) => f.submitted)) {
    for (const criterion of project.criteria) {
      for (const reviewer of project.reviewers) {
        const score = project.scores.find(
          (s) =>
            s.firmId === firm.id && s.criterionId === criterion.id && s.reviewerId === reviewer.id,
        );
        if (!score) continue; // not scored yet — nothing to list

        const r = headerRowNum + 1 + rowIndex;
        const row = sheet.getRow(r);
        row.getCell(1).value = firm.name;
        row.getCell(2).value = criterion.name;
        row.getCell(3).value = reviewer.name;
        row.getCell(4).value = reviewer.type === "wfrc" ? "WFRC" : "TLC Applicant";
        row.getCell(5).value = score.value;
        row.getCell(COMMENT_COL).value = score.comment;
        zebraRow(sheet, r, HEADER_LABELS.length, rowIndex);
        row.getCell(5).alignment = { vertical: "top", horizontal: "center" };
        rowIndex++;
      }
    }
  }

  if (rowIndex > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: headerRowNum, column: HEADER_LABELS.length },
    };
  }
}
