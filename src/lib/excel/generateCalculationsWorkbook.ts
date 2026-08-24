// Calculations modal's "Export as .xlsx" — a complete, multi-tab spreadsheet mirroring the
// app end-to-end, not just a single audit table:
//
//   1. Results       — the headline deliverable: Rank + Overall/TLC Applicant/WFRC Weighted
//                       Total per firm.
//   2. Calculations  — the full per-reviewer audit trail (every raw score, every
//                       intermediate Avg/Wtd figure) the Results tab's formulas trace back
//                       to.
//   3-7. Project Info, Firms, Reviewers, Criteria, Scoring Scale — the project's own
//                       configuration, mirroring the Configuration screen's step order, so
//                       this workbook is a self-contained record of the whole project, not
//                       just its numbers.
//
// This is NOT the reviewer workbook (generateWorkbook.ts) — no protection, no dropdown, no
// hidden ID columns — just a clean, formatted export of data that already exists, generated
// the same way (ExcelJS, brand-sourced colors) as everything else in this app's Excel
// pipeline. Sheet-building logic for each tab lives in ./calculationsWorkbook/ (one file per
// tab, plus a shared.ts for the title-banner/header-row/zebra-striping conventions every tab
// uses) — this file is just the orchestrator.
//
// Sheet-creation order below is deliberately NOT the same as build/populate order: ExcelJS
// has no supported API to reorder sheets after adding them (tab order is fixed at
// insertion), but Results' own CONTENT needs Calculations' cells (firmRefs) to already
// exist before it can write cross-sheet formula references to them. So Results is CREATED
// first (claiming tab position 0) but POPULATED last, once Calculations has something to
// point at — see buildResultsSheet's own comment for why it takes an already-created sheet
// instead of creating one itself, unlike every other builder here.
//
// Every DERIVED number (Overall/TLC Applicant/WFRC Avg, Overall/TLC Applicant/WFRC Wtd,
// Completion, each firm's totals row on Calculations, and every cell on Results) is a real
// Excel formula, not a hardcoded snapshot — constitution Principle VI (Transparency)
// requires every number to be traceable back to raw inputs, and a static value pasted into
// a cell can't be interrogated or recalculated inside Excel itself the way a formula can.
// See calculationsSheet.ts and resultsSheet.ts's own header comments for the exact formula
// design (why AVERAGE/SUM/IFERROR/RANK.EQ, and why Results references Calculations by cell
// address rather than recomputing anything independently).

import ExcelJS from "exceljs";
import { calculationsWorkbookFilename } from "../filenames";
import { buildCalculationsSheet } from "./calculationsWorkbook/calculationsSheet";
import { buildConfigSheets } from "./calculationsWorkbook/configSheets";
import { buildResultsSheet } from "./calculationsWorkbook/resultsSheet";
import type { Project } from "../../types/project";

export async function generateCalculationsWorkbook(
  project: Project,
): Promise<{ blob: Blob; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Proposal Evaluation Scoresheet";
  workbook.created = new Date();

  const resultsSheet = workbook.addWorksheet("Results"); // claims tab position 0
  const calc = buildCalculationsSheet(workbook, project); // tab position 1; creates the
  // cell references Results needs
  buildResultsSheet(resultsSheet, project, calc); // now safe to populate
  buildConfigSheets(workbook, project); // tab positions 2-6

  // Results is the headline deliverable — make it the tab a handler sees on open.
  workbook.views = [
    { x: 0, y: 0, width: 25000, height: 15000, firstSheet: 0, activeTab: 0, visibility: "visible" },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return { blob, filename: calculationsWorkbookFilename(project.project.projectName) };
}
