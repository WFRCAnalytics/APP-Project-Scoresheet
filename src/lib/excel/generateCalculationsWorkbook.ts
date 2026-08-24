// Calculations modal's "Export as .xlsx" — a real spreadsheet of the same audit data the
// Full Table view shows (every raw score, every computed average/weighted total), for the
// handler's own offline reference. This is NOT the reviewer workbook (generateWorkbook.ts)
// — no protection, no dropdown, no hidden ID columns — just a clean formatted export of
// numbers that already exist, generated the same way (ExcelJS, brand-sourced header color)
// as everything else in this app's Excel pipeline.

import ExcelJS from "exceljs";
import { calculationsWorkbookFilename } from "../filenames";
import {
  applicantAvg,
  applicantWeightedTotal,
  completion,
  overallAvg,
  overallWeightedTotal,
  round2,
} from "../calculations";
import type { Project } from "../../types/project";

const BRAND_BLUE = "FF023C5B"; // --color-wfrc-blue
const WHITE_TEXT = "FFFFFFFF";

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

  let r = 2;
  const reviewerCount = project.reviewers.length;
  for (const firm of submittedFirms) {
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
      row.getCell(c++).value = oAvg !== null ? round2(oAvg) : null;
      row.getCell(c++).value = cAvg !== null ? round2(cAvg) : null;
      row.getCell(c++).value = oAvg !== null ? round2(oAvg * criterion.weight) : null;
      row.getCell(c++).value = cAvg !== null ? round2(cAvg * criterion.weight) : null;
      const cellCompletion = completion(project, firm.id, { criterionId: criterion.id });
      row.getCell(c++).value = `${cellCompletion.scored}/${cellCompletion.expected}`;
      r++;
    }

    // One bold totals row per firm, right under its criteria rows.
    // Column layout: Firm, Criterion, Weight, [reviewers...], Overall Avg, TLC Applicant Avg,
    // Overall Wtd, TLC Applicant Wtd, Completion — so Overall Wtd sits at column
    // (6 + reviewerCount).
    const totalsRow = sheet.getRow(r);
    totalsRow.getCell(1).value = `${firm.name} — Weighted Totals`;
    totalsRow.getCell(1).font = { bold: true };
    const overallWtdCol = 6 + reviewerCount;
    const applicantWtdCol = overallWtdCol + 1;
    totalsRow.getCell(overallWtdCol).value = round2(overallWeightedTotal(project, firm.id));
    totalsRow.getCell(overallWtdCol).font = { bold: true };
    totalsRow.getCell(applicantWtdCol).value = round2(applicantWeightedTotal(project, firm.id));
    totalsRow.getCell(applicantWtdCol).font = { bold: true };
    r++;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, filename: calculationsWorkbookFilename(project.project.projectName) };
}
