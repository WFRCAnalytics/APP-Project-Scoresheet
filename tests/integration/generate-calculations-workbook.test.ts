// Real ExcelJS round-trip for the Calculations modal's "Export as .xlsx" button — now a
// multi-tab workbook (Results, Calculations, Project Info, Firms, Reviewers, Criteria,
// Scoring Scale), not a single sheet.
//
// Every derived cell (Overall/TLC Applicant/WFRC Avg/Wtd, Completion, and every cell on
// Results) is a real formula, not a hardcoded snapshot number — and every LABEL cell that
// duplicates data already present on a config tab (Firm, Criterion, Weight, each reviewer's
// column header) is a real cross-sheet formula too, not a hardcoded copy — see
// generateCalculationsWorkbook.ts and its calculationsWorkbook/*.ts sheet builders for the
// full design. These tests assert both the FORMULA TEXT (so a handler opening the file in
// real Excel can audit/recalculate it) and the cached RESULT (what shows before Excel's own
// recalculation).
// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateCalculationsWorkbook } from "../../src/lib/excel/generateCalculationsWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

// The Calculations sheet's title/subtitle/instruction banner occupies rows 1-3, row 4 is
// blank, and the real header row is row 5 — see calculationsWorkbook/shared.ts's
// addTitleBanner (an instruction line is what pushes the header down to row 5 instead of
// row 4; only the Calculations tab uses one). Every row number below is relative to this.
const CALC_HEADER_ROW = 5;
const CALC_FIRST_DATA_ROW = CALC_HEADER_ROW + 1; // 6

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

describe("generateCalculationsWorkbook — workbook structure", () => {
  it("has all seven tabs, in order, with Results first and active", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);

    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      "Results",
      "Calculations",
      "Project Info",
      "Firms",
      "Reviewers",
      "Criteria",
      "Scoring Scale",
    ]);
  });
});

describe("generateCalculationsWorkbook — Calculations tab", () => {
  it("has a header row (row 5, after the title banner) matching Firm/Criterion/Weight/[reviewers]/Overall Avg/TLC Applicant Avg/WFRC Avg/Overall Wtd/TLC Applicant Wtd/WFRC Wtd/Completion", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    const headerRow = sheet.getRow(CALC_HEADER_ROW);
    // Firm/Criterion/Weight/Overall.../Completion are plain header labels; the reviewer
    // columns (D, E) are live formulas concatenating that reviewer's Name + Type cells from
    // the Reviewers tab — checked via `.result` (the resolved text), not `.value` (which
    // would be the formula object, not a string).
    expect(headerRow.getCell(1).value).toBe("Firm");
    expect(headerRow.getCell(2).value).toBe("Criterion");
    expect(headerRow.getCell(3).value).toBe("Weight");
    expect(headerRow.getCell(4).formula).toBe('Reviewers!A5&" ("&Reviewers!B5&")"');
    expect(headerRow.getCell(4).result).toBe("Alice (TLC Applicant)");
    expect(headerRow.getCell(5).formula).toBe('Reviewers!A6&" ("&Reviewers!B6&")"');
    expect(headerRow.getCell(5).result).toBe("Bob (WFRC)");
    expect(headerRow.getCell(6).value).toBe("Overall Avg");
    expect(headerRow.getCell(7).value).toBe("TLC Applicant Avg");
    expect(headerRow.getCell(8).value).toBe("WFRC Avg");
    expect(headerRow.getCell(9).value).toBe("Overall Wtd");
    expect(headerRow.getCell(10).value).toBe("TLC Applicant Wtd");
    expect(headerRow.getCell(11).value).toBe("WFRC Wtd");
    expect(headerRow.getCell(12).value).toBe("Completion");
  });

  it("cross-references Firm/Criterion/Weight to the Firms/Criteria config tabs instead of hardcoding them", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Row 6 = Alpha Co / Approach. Alpha is project.firms[0] -> Firms sheet row 5; Approach
    // is project.criteria[0] -> Criteria sheet row 5.
    const firmCell = sheet.getCell("A6");
    expect(firmCell.formula).toBe("Firms!A5");
    expect(firmCell.result).toBe("Alpha Co");
    const criterionCell = sheet.getCell("B6");
    expect(criterionCell.formula).toBe("Criteria!A5");
    expect(criterionCell.result).toBe("Approach");
    const weightCell = sheet.getCell("C6");
    expect(weightCell.formula).toBe("Criteria!B5");
    expect(weightCell.result).toBe(0.6);

    // Row 8 = Beta Co (project.firms[1] -> Firms sheet row 6) / Approach again (Criteria
    // cycles back to row 5 for every firm's block).
    expect(sheet.getCell("A8").formula).toBe("Firms!A6");
    expect(sheet.getCell("A8").result).toBe("Beta Co");
    expect(sheet.getCell("B8").formula).toBe("Criteria!A5");
    expect(sheet.getCell("C8").formula).toBe("Criteria!B5");
  });

  it("computes Overall/TLC Applicant/WFRC Avg and Wtd via real formulas, not hardcoded numbers", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Row 6 = Alpha Co / Approach: Alice (D, applicant) = 5, Bob (E, wfrc) = 1, weight = 0.6.
    const r = CALC_FIRST_DATA_ROW;
    const overallAvgCell = sheet.getCell(`F${r}`);
    expect(overallAvgCell.formula).toBe(`IFERROR(AVERAGE(D${r}:E${r}),"")`);
    expect(overallAvgCell.result).toBe(3); // (5+1)/2

    const applicantAvgCell = sheet.getCell(`G${r}`);
    // Applicant-only average references Alice's cell directly, not a range including Bob.
    expect(applicantAvgCell.formula).toBe(`IFERROR(AVERAGE(D${r}),"")`);
    expect(applicantAvgCell.result).toBe(5);

    const wfrcAvgCell = sheet.getCell(`H${r}`);
    // WFRC-only average references Bob's cell directly, not a range including Alice.
    expect(wfrcAvgCell.formula).toBe(`IFERROR(AVERAGE(E${r}),"")`);
    expect(wfrcAvgCell.result).toBe(1);

    const overallWtdCell = sheet.getCell(`I${r}`);
    expect(overallWtdCell.formula).toBe(`IFERROR(F${r}*C${r},"")`); // Avg cell x Weight cell
    expect(overallWtdCell.result).toBeCloseTo(1.8, 10); // 3 * 0.6

    const applicantWtdCell = sheet.getCell(`J${r}`);
    expect(applicantWtdCell.formula).toBe(`IFERROR(G${r}*C${r},"")`);
    expect(applicantWtdCell.result).toBeCloseTo(3, 10); // 5 * 0.6

    const wfrcWtdCell = sheet.getCell(`K${r}`);
    expect(wfrcWtdCell.formula).toBe(`IFERROR(H${r}*C${r},"")`);
    expect(wfrcWtdCell.result).toBeCloseTo(0.6, 10); // 1 * 0.6

    const completionCell = sheet.getCell(`L${r}`);
    // Denominator is COLUMNS(D6:E6), not a hardcoded "2" — stays correct on its own even if
    // the reviewer range it's paired with ever did.
    expect(completionCell.formula).toBe(`COUNT(D${r}:E${r})&"/"&COLUMNS(D${r}:E${r})`);
    expect(completionCell.result).toBe("2/2");
  });

  it("leaves not-yet-scored cells blank (IFERROR-caught), not a #DIV/0! or #VALUE! error", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Beta Co / Approach (row 8 = header(5) + Alpha's 2 criteria rows + 1; there's no
    // totals row between firms anymore): nobody has scored it yet. An empty-string cached
    // result round-trips through the .xlsx XML as `undefined` (ExcelJS/OOXML don't
    // serialize an empty <v> for a formula cell) rather than literally "" — functionally
    // identical once opened for real (Excel recalculates IFERROR(...,"") to blank either
    // way), so both are accepted here rather than over-asserting a serialization quirk.
    const r = 8;
    expect(sheet.getCell(`F${r}`).result ?? "").toBe(""); // Overall Avg
    expect(sheet.getCell(`G${r}`).result ?? "").toBe(""); // TLC Applicant Avg
    expect(sheet.getCell(`H${r}`).result ?? "").toBe(""); // WFRC Avg
    expect(sheet.getCell(`I${r}`).result ?? "").toBe(""); // Overall Wtd
    expect(sheet.getCell(`J${r}`).result ?? "").toBe(""); // TLC Applicant Wtd
    expect(sheet.getCell(`K${r}`).result ?? "").toBe(""); // WFRC Wtd
    expect(sheet.getCell(`L${r}`).result).toBe("0/2"); // Completion — COUNT still resolves to 0
  });

  it("has no per-firm totals row anymore — Weighted Totals are computed on the Results tab instead", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Alpha Co: 2 criteria rows only (6-7); Beta Co starts immediately after on row 8, with
    // no intervening "— Weighted Totals" row for either firm. Firm cells are formulas now
    // (see the cross-reference test above), so compare `.result`, not `.value`.
    for (let r = CALC_FIRST_DATA_ROW; r <= 9; r++) {
      expect(String(sheet.getRow(r).getCell(1).result)).not.toContain("Weighted Totals");
    }
    expect(sheet.getRow(6).getCell(1).result).toBe("Alpha Co");
    expect(sheet.getRow(8).getCell(1).result).toBe("Beta Co");
  });

  it("puts a thick rule under every firm's LAST criteria row, spanning every column — the boundary between one firm's block and the next", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;

    // Alpha Co's last criteria row (7) and Beta Co's (9) — 12 columns total: Firm,
    // Criterion, Weight, Alice, Bob, Overall Avg, TLC Applicant Avg, WFRC Avg, Overall Wtd,
    // TLC Applicant Wtd, WFRC Wtd, Completion.
    for (const rowNum of [7, 9]) {
      const boundaryRow = sheet.getRow(rowNum);
      for (let c = 1; c <= 12; c++) {
        expect(boundaryRow.getCell(c).border?.bottom?.style).toBe("thick");
      }
    }

    // Alpha's FIRST criteria row (not its last) must NOT have this rule — it's specific to
    // the boundary at the end of a firm's block, not every row in it.
    expect(sheet.getRow(CALC_FIRST_DATA_ROW).getCell(1).border?.bottom?.style).not.toBe("thick");
  });

  it("color-codes raw score + computed columns by metric — WFRC light blue, Overall light orange, TLC Applicant light green", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Calculations")!;
    const r = CALC_FIRST_DATA_ROW;

    function fillArgb(cellRef: string): string | undefined {
      const fill = sheet.getCell(cellRef).fill as ExcelJS.FillPattern;
      return (fill?.fgColor as { argb?: string } | undefined)?.argb;
    }

    // D = Alice (applicant/TLC Applicant), E = Bob (wfrc) — raw score columns.
    const applicantTint = fillArgb(`D${r}`);
    const wfrcTint = fillArgb(`E${r}`);
    expect(applicantTint).toBeDefined();
    expect(wfrcTint).toBeDefined();
    expect(applicantTint).not.toBe(wfrcTint);

    // Computed columns share their raw column's tint: F/I = Overall Avg/Wtd, G/J = TLC
    // Applicant Avg/Wtd, H/K = WFRC Avg/Wtd.
    expect(fillArgb(`G${r}`)).toBe(applicantTint); // TLC Applicant Avg matches Alice's tint
    expect(fillArgb(`J${r}`)).toBe(applicantTint); // TLC Applicant Wtd
    expect(fillArgb(`H${r}`)).toBe(wfrcTint); // WFRC Avg matches Bob's tint
    expect(fillArgb(`K${r}`)).toBe(wfrcTint); // WFRC Wtd
    // Overall isn't any one reviewer's own tint — it's its own third color.
    const overallTint = fillArgb(`F${r}`);
    expect(overallTint).toBeDefined();
    expect(overallTint).not.toBe(applicantTint);
    expect(overallTint).not.toBe(wfrcTint);
    expect(fillArgb(`I${r}`)).toBe(overallTint); // Overall Wtd matches Overall Avg's tint

    // Firm/Criterion/Weight (raw inputs that aren't a "reviewer type" column) and
    // Completion stay untinted.
    expect(fillArgb(`A${r}`)).toBeUndefined();
    expect(fillArgb(`C${r}`)).toBeUndefined();
    expect(fillArgb(`L${r}`)).toBeUndefined();
  });
});

describe("generateCalculationsWorkbook — Results tab", () => {
  it("has a header row matching Rank/Firm/Overall/TLC Applicant/WFRC Weighted Total/Completion", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Results")!;

    const headerValues = sheet.getRow(4).values as unknown[]; // no instruction row on Results
    expect(headerValues.slice(1).map(String)).toEqual([
      "Rank",
      "Firm",
      "Overall Weighted Total",
      "TLC Applicant Weighted Total",
      "WFRC Weighted Total",
      "Completion",
    ]);
  });

  it("cross-references Firm name to the Firms tab and sums Weighted Totals via SUMIF matched by firm name", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Results")!;

    // Alpha Co scored (Overall Wtd 3.8) beats Beta Co unscored (Overall Wtd 0), so Alpha is
    // row 5 (rank 1) and Beta is row 6 (rank 2). Firm name is a direct cross-sheet
    // reference to the Firms tab, not a hardcoded string.
    const alphaFirmCell = sheet.getCell("B5");
    expect(alphaFirmCell.formula).toBe("Firms!A5");
    expect(alphaFirmCell.result).toBe("Alpha Co");
    const betaFirmCell = sheet.getCell("B6");
    expect(betaFirmCell.formula).toBe("Firms!A6");
    expect(betaFirmCell.result).toBe("Beta Co");

    // Calculations' own data range is rows 6-9 (2 firms x 2 criteria, no totals row). Each
    // Weighted Total is SUMIF("Calculations' Firm column = this row's own Firm cell",
    // sum the matching Overall/TLC Applicant/WFRC Wtd cells) — matched by VALUE, not a
    // fixed row range computed at generation time.
    const alphaOverallCell = sheet.getCell("C5");
    expect(alphaOverallCell.formula).toBe(
      "SUMIF('Calculations'!A$6:A$9,B5,'Calculations'!I$6:I$9)",
    );
    expect(alphaOverallCell.result).toBeCloseTo(3.8, 10);

    const alphaApplicantCell = sheet.getCell("D5");
    expect(alphaApplicantCell.formula).toBe(
      "SUMIF('Calculations'!A$6:A$9,B5,'Calculations'!J$6:J$9)",
    );
    expect(alphaApplicantCell.result).toBe(5);

    const alphaWfrcCell = sheet.getCell("E5");
    expect(alphaWfrcCell.formula).toBe("SUMIF('Calculations'!A$6:A$9,B5,'Calculations'!K$6:K$9)");
    expect(alphaWfrcCell.result).toBeCloseTo(2.6, 10);

    // Beta is unscored — SUMIF() against all-blank Wtd cells is a real 0, not an error.
    const betaOverallCell = sheet.getCell("C6");
    expect(betaOverallCell.formula).toBe("SUMIF('Calculations'!A$6:A$9,B6,'Calculations'!I$6:I$9)");
    expect(betaOverallCell.result).toBe(0);

    // Rank is Excel's own RANK() over this sheet's own Overall Weighted Total column — not
    // a value copied in from calculations.ts's getRank(), even though the cached result
    // matches it exactly. Plain RANK(), not RANK.EQ() — see this file's own header comment
    // on why RANK.EQ() written directly into the .xlsx XML (rather than typed into Excel's
    // UI) shows #NAME? without an `_xlfn.` prefix ExcelJS doesn't add.
    const alphaRankCell = sheet.getCell("A5");
    expect(alphaRankCell.formula).toBe("RANK(C5,$C$5:$C$6,0)");
    expect(alphaRankCell.result).toBe(1);
    const betaRankCell = sheet.getCell("A6");
    expect(betaRankCell.result).toBe(2);
  });

  it("computes Completion via SUMPRODUCT/COUNTIF matched by firm name, cross-referencing the Reviewers tab for the expected count", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Results")!;

    // Alpha: fully scored (2 criteria x 2 reviewers = 4/4). Beta: unscored (0/4). Expected
    // count comes from COUNTA(Reviewers!...), not a hardcoded reviewerCount literal.
    const alphaCompletionCell = sheet.getCell("F5");
    expect(alphaCompletionCell.formula).toBe(
      "(SUMPRODUCT(('Calculations'!A$6:A$9=B5)*ISNUMBER('Calculations'!D$6:D$9))+" +
        "SUMPRODUCT(('Calculations'!A$6:A$9=B5)*ISNUMBER('Calculations'!E$6:E$9)))" +
        '&"/"&(COUNTIF(\'Calculations\'!A$6:A$9,B5)*COUNTA(Reviewers!$A$5:$A$6))',
    );
    expect(alphaCompletionCell.result).toBe("4/4");

    const betaCompletionCell = sheet.getCell("F6");
    expect(betaCompletionCell.result).toBe("0/4");
  });
});

describe("generateCalculationsWorkbook — config/reference tabs", () => {
  it("Project Info lists every project-level field", async () => {
    const project = buildFixture();
    project.project.localGovContact = "Jane Handler";
    project.project.procurementAgent = "WFRC PM";
    project.project.committeeMeetingDate = "2026-08-20";
    project.project.notes = "Some notes.";
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Project Info")!;

    const fieldValues: Record<string, unknown> = {};
    for (let r = 5; r <= 9; r++) {
      const row = sheet.getRow(r);
      fieldValues[String(row.getCell(1).value)] = row.getCell(2).value;
    }
    expect(fieldValues["Project Name"]).toBe("Calc Export Fixture");
    expect(fieldValues["Local Government Contact"]).toBe("Jane Handler");
    expect(fieldValues["Procurement Agent (WFRC PM)"]).toBe("WFRC PM");
    expect(fieldValues["Notes"]).toBe("Some notes.");
  });

  it("Firms lists every firm's invited/submitted status as Yes/No", async () => {
    const project = buildFixture();
    project.firms.push({ id: "firm-3", name: "Gamma Co", invited: true, submitted: false, notes: "" });
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Firms")!;

    expect(sheet.getRow(5).getCell(1).value).toBe("Alpha Co");
    expect(sheet.getRow(5).getCell(2).value).toBe("Yes"); // invited
    expect(sheet.getRow(5).getCell(3).value).toBe("Yes"); // submitted
    expect(sheet.getRow(7).getCell(1).value).toBe("Gamma Co");
    expect(sheet.getRow(7).getCell(3).value).toBe("No"); // not submitted
  });

  it("Reviewers shows display labels ('TLC Applicant'/'WFRC'), never the raw internal type value", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Reviewers")!;

    expect(sheet.getRow(5).getCell(1).value).toBe("Alice");
    expect(sheet.getRow(5).getCell(2).value).toBe("TLC Applicant");
    expect(sheet.getRow(6).getCell(1).value).toBe("Bob");
    expect(sheet.getRow(6).getCell(2).value).toBe("WFRC");
  });

  it("Criteria shows each weight as both a decimal and a live percent formula, plus a summed total row", async () => {
    const project = buildFixture();
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Criteria")!;

    expect(sheet.getRow(5).getCell(1).value).toBe("Approach");
    expect(sheet.getRow(5).getCell(2).value).toBe(0.6);
    const pctCell = sheet.getRow(5).getCell(3);
    expect(pctCell.formula).toBe("B5"); // live reference, not a second hand-typed number
    expect(pctCell.result).toBe(0.6);

    // Total Weight row, right after the 2 criteria rows (5, 6) -> row 7.
    const totalRow = sheet.getRow(7);
    expect(totalRow.getCell(1).value).toBe("Total Weight");
    expect(totalRow.getCell(2).formula).toBe("SUM(B5:B6)");
    expect(totalRow.getCell(2).result).toBeCloseTo(1, 10); // 0.6 + 0.4
  });

  it("Scoring Scale lists every point and states the configured mode", async () => {
    const project = buildFixture();
    project.scoringScaleMode = "continuous";
    const { blob } = await generateCalculationsWorkbook(project);
    const workbook = await reloadWorkbook(blob);
    const sheet = workbook.getWorksheet("Scoring Scale")!;

    expect(sheet.getRow(5).getCell(1).value).toBe(1);
    expect(sheet.getRow(5).getCell(2).value).toBe("No");
    expect(sheet.getRow(6).getCell(1).value).toBe(5);
    expect(sheet.getRow(6).getCell(2).value).toBe("Yes");

    // Mode note, right after the 2 scale-point rows (5, 6) -> row 8 (row 7 left blank).
    const modeCell = sheet.getCell("A8");
    expect(String(modeCell.value)).toContain("Continuous");
  });
});
