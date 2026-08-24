// Real ExcelJS round-trip for the Calculations modal's "Export as .xlsx" button. Written
// after catching a real column-offset bug while first wiring this up (the totals row's
// Overall Wtd/TLC Applicant Wtd values landed one column left of their own header) — this
// test specifically asserts the totals row lines up under the SAME header text it's meant
// to be under, not just that some value exists somewhere in the row.
// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateCalculationsWorkbook } from "../../src/lib/excel/generateCalculationsWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildFixture(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Calc Export Fixture";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [
    { id: "crit-1", name: "Approach", weight: 0.6, description: "" },
    { id: "crit-2", name: "Cost", weight: 0.4, description: "" },
  ];
  project.firms = [
    { id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    { id: "firm-2", name: "Beta Co", invited: true, submitted: true, notes: "" },
  ];
  project.reviewers = [
    { id: "rev-1", name: "Alice", type: "applicant", email: "" },
    { id: "rev-2", name: "Bob", type: "wfrc", email: "" },
  ];
  project.scores = [
    {
      reviewerId: "rev-1",
      firmId: "firm-1",
      criterionId: "crit-1",
      value: 5,
      comment: "",
      updatedAt: "",
    },
    {
      reviewerId: "rev-2",
      firmId: "firm-1",
      criterionId: "crit-1",
      value: 1,
      comment: "",
      updatedAt: "",
    },
    {
      reviewerId: "rev-1",
      firmId: "firm-1",
      criterionId: "crit-2",
      value: 5,
      comment: "",
      updatedAt: "",
    },
    {
      reviewerId: "rev-2",
      firmId: "firm-1",
      criterionId: "crit-2",
      value: 5,
      comment: "",
      updatedAt: "",
    },
  ];
  return project;
}

async function reloadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as unknown as ArrayBuffer);
  return workbook;
}

describe("generateCalculationsWorkbook", () => {
  it("has a header row matching Firm/Criterion/Weight/[reviewers]/Overall Avg/TLC Applicant Avg/Overall Wtd/TLC Applicant Wtd/Completion", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    const headerValues = sheet.getRow(1).values as unknown[];
    // ExcelJS row.values is 1-indexed with a leading empty slot at index 0.
    const headers = headerValues.slice(1).map(String);
    expect(headers).toEqual([
      "Firm",
      "Criterion",
      "Weight",
      "Alice (TLC Applicant)",
      "Bob (WFRC)",
      "Overall Avg",
      "TLC Applicant Avg",
      "Overall Wtd",
      "TLC Applicant Wtd",
      "Completion",
    ]);
  });

  it("puts each firm's totals row values directly under the Overall Wtd / TLC Applicant Wtd header columns, not offset", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Locate the header row's Overall Wtd / TLC Applicant Wtd columns dynamically, rather
    // than hardcoding a column letter a second time in this test.
    const headerRow = sheet.getRow(1);
    let overallWtdCol = -1;
    let applicantWtdCol = -1;
    for (let c = 1; c <= headerRow.cellCount; c++) {
      const value = headerRow.getCell(c).value;
      if (value === "Overall Wtd") overallWtdCol = c;
      if (value === "TLC Applicant Wtd") applicantWtdCol = c;
    }
    expect(overallWtdCol).toBeGreaterThan(0);
    expect(applicantWtdCol).toBeGreaterThan(0);

    // Alpha Co: 2 criteria rows (rows 2-3) then its totals row (row 4).
    const totalsRow = sheet.getRow(4);
    expect(totalsRow.getCell(1).value).toBe("Alpha Co — Weighted Totals");

    // Overall Wtd = 3*0.6 + 5*0.4 = 3.8; TLC Applicant Wtd (Alice only) = 5*0.6 + 5*0.4 = 5.
    expect(totalsRow.getCell(overallWtdCol).value).toBe(3.8);
    expect(totalsRow.getCell(applicantWtdCol).value).toBe(5);
    // And the cell immediately left of Overall Wtd (TLC Applicant Avg) must NOT hold the
    // totals value — this is exactly the off-by-one this test was written to catch.
    expect(totalsRow.getCell(overallWtdCol - 1).value).not.toBe(3.8);
  });
});
