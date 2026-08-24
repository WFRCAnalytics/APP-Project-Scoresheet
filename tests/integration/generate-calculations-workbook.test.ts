// Real ExcelJS round-trip for the Calculations modal's "Export as .xlsx" button. Written
// after catching a real column-offset bug while first wiring this up (the totals row's
// Overall Wtd/TLC Applicant Wtd values landed one column left of their own header) — this
// test specifically asserts the totals row lines up under the SAME header text it's meant
// to be under, not just that some value exists somewhere in the row.
//
// Every derived cell (Overall/TLC Applicant Avg, Overall/TLC Applicant Wtd, Completion, and
// each firm's totals row) is a real formula now, not a hardcoded snapshot number — see
// generateCalculationsWorkbook.ts's own header comment for the full design. These tests
// assert both the FORMULA TEXT (so a handler opening the file in real Excel can audit/
// recalculate it) and the cached RESULT (what shows before Excel's own recalculation).
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

  it("computes Overall/TLC Applicant Avg and Wtd via real formulas, not hardcoded numbers", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Row 2 = Alpha Co / Approach: Alice (D, applicant) = 5, Bob (E, wfrc) = 1, weight = 0.6.
    const overallAvgCell = sheet.getCell("F2");
    expect(overallAvgCell.formula).toBe('IFERROR(AVERAGE(D2:E2),"")');
    expect(overallAvgCell.result).toBe(3); // (5+1)/2

    const applicantAvgCell = sheet.getCell("G2");
    // Applicant-only average references Alice's cell directly, not a range including Bob.
    expect(applicantAvgCell.formula).toBe('IFERROR(AVERAGE(D2),"")');
    expect(applicantAvgCell.result).toBe(5);

    const overallWtdCell = sheet.getCell("H2");
    expect(overallWtdCell.formula).toBe('IFERROR(F2*C2,"")'); // Avg cell x Weight cell
    expect(overallWtdCell.result).toBeCloseTo(1.8, 10); // 3 * 0.6

    const applicantWtdCell = sheet.getCell("I2");
    expect(applicantWtdCell.formula).toBe('IFERROR(G2*C2,"")');
    expect(applicantWtdCell.result).toBeCloseTo(3, 10); // 5 * 0.6

    const completionCell = sheet.getCell("J2");
    // Denominator is COLUMNS(D2:E2), not a hardcoded "2" — stays correct on its own even if
    // the reviewer range it's paired with ever did.
    expect(completionCell.formula).toBe('COUNT(D2:E2)&"/"&COLUMNS(D2:E2)');
    expect(completionCell.result).toBe("2/2");
  });

  it("leaves not-yet-scored cells blank (IFERROR-caught), not a #DIV/0! or #VALUE! error", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Row 5 = Beta Co / Approach: nobody has scored it yet. An empty-string cached result
    // round-trips through the .xlsx XML as `undefined` (ExcelJS/OOXML don't serialize an
    // empty <v> for a formula cell) rather than literally "" — functionally identical once
    // opened for real (Excel recalculates IFERROR(...,"") to blank either way), so both are
    // accepted here rather than over-asserting a serialization quirk.
    expect(sheet.getCell("F5").result ?? "").toBe(""); // Overall Avg
    expect(sheet.getCell("G5").result ?? "").toBe(""); // TLC Applicant Avg
    expect(sheet.getCell("H5").result ?? "").toBe(""); // Overall Wtd
    expect(sheet.getCell("I5").result ?? "").toBe(""); // TLC Applicant Wtd
    expect(sheet.getCell("J5").result).toBe("0/2"); // Completion — COUNT still resolves to 0
  });

  it("puts each firm's totals row formulas directly under the Overall Wtd / TLC Applicant Wtd header columns, not offset", async () => {
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

    const overallTotalCell = totalsRow.getCell(overallWtdCol);
    const applicantTotalCell = totalsRow.getCell(applicantWtdCol);
    // SUM() over exactly this firm's own criteria rows (2-3), not the whole column.
    expect(overallTotalCell.formula).toBe("SUM(H2:H3)");
    expect(applicantTotalCell.formula).toBe("SUM(I2:I3)");

    // Overall Wtd = 3*0.6 + 5*0.4 = 3.8; TLC Applicant Wtd (Alice only) = 5*0.6 + 5*0.4 = 5.
    expect(overallTotalCell.result).toBeCloseTo(3.8, 10);
    expect(applicantTotalCell.result).toBe(5);
    // And the cell immediately left of Overall Wtd (TLC Applicant Avg) must NOT hold the
    // totals value — this is exactly the off-by-one this test was written to catch.
    expect(totalsRow.getCell(overallWtdCol - 1).value).not.toBe(3.8);
  });

  it("Beta Co's totals row sums to 0 via SUM(), not blank/error, when nothing is scored yet", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Beta Co: rows 5-6 (criteria), row 7 (totals) — nothing scored for Beta at all.
    const totalsRow = sheet.getRow(7);
    expect(totalsRow.getCell(1).value).toBe("Beta Co — Weighted Totals");
    expect(totalsRow.getCell(8).formula).toBe("SUM(H5:H6)"); // Overall Wtd column
    expect(totalsRow.getCell(8).result).toBe(0); // SUM() of all-blank cells is 0, not an error
    expect(totalsRow.getCell(9).result).toBe(0); // TLC Applicant Wtd column
  });

  it("puts a thick rule under every firm's totals row, spanning every column", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Alpha Co's totals row (4) and Beta Co's (7) — 10 columns total: Firm, Criterion,
    // Weight, Alice, Bob, Overall Avg, TLC Applicant Avg, Overall Wtd, TLC Applicant Wtd,
    // Completion.
    for (const rowNum of [4, 7]) {
      const totalsRow = sheet.getRow(rowNum);
      for (let c = 1; c <= 10; c++) {
        expect(totalsRow.getCell(c).border?.bottom?.style).toBe("thick");
      }
    }

    // A criteria row (not a totals row) must NOT have this rule — it's specific to the
    // boundary between one firm's block and the next.
    expect(sheet.getRow(2).getCell(1).border?.bottom?.style).not.toBe("thick");
  });
});
