// The Calculations workbook's Comments tab: every recorded score as one flat row, with the
// reviewer's comment beside it (blank if none) — the written feedback in the export, not just
// the numbers.
// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateCalculationsWorkbook } from "../../src/lib/excel/generateCalculationsWorkbook";
import { createEmptyProject, type Project, type Score } from "../../src/types/project";

// addTitleBanner with an instruction line puts the header at row 5, data from row 6.
const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;

function score(
  reviewerId: string,
  firmId: string,
  criterionId: string,
  value: number,
  comment: string,
): Score {
  return { reviewerId, firmId, criterionId, value, comment, updatedAt: "" };
}

function buildFixture(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Comments Fixture";
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
    { id: "firm-3", name: "Gamma Co", invited: true, submitted: false, notes: "" },
  ];
  project.reviewers = [
    { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true },
    { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
  ];
  project.scores = [
    // Deliberately out of firm/criterion/reviewer order — the tab sorts them into project order.
    score("rev-2", "firm-2", "crit-1", 3, "Weak on staffing"),
    score("rev-1", "firm-1", "crit-2", 1, ""),
    score("rev-2", "firm-1", "crit-1", 5, "Excellent, clear plan"),
    score("rev-1", "firm-1", "crit-1", 4.5, "Solid; thin on risk, \"quoted\" and\nmulti-line"),
    // Not listed: an unsubmitted firm, and a reviewer who no longer exists.
    score("rev-1", "firm-3", "crit-1", 5, "Not submitted"),
    score("rev-gone", "firm-1", "crit-1", 5, "Reviewer was removed"),
  ];
  return project;
}

async function commentsSheet(project: Project): Promise<ExcelJS.Worksheet> {
  const { blob } = await generateCalculationsWorkbook(project);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await blob.arrayBuffer()) as unknown as ArrayBuffer);
  return workbook.getWorksheet("Comments")!;
}

function rowValues(sheet: ExcelJS.Worksheet, r: number) {
  return [1, 2, 3, 4, 5, 6].map((c) => sheet.getRow(r).getCell(c).value);
}

describe("Calculations workbook — Comments tab", () => {
  it("has a header row for Firm, Criterion, Reviewer, Reviewer Type, Score, Comment", async () => {
    const sheet = await commentsSheet(buildFixture());
    expect(rowValues(sheet, HEADER_ROW)).toEqual([
      "Firm",
      "Criterion",
      "Reviewer",
      "Reviewer Type",
      "Score",
      "Comment",
    ]);
  });

  it("lists every scored cell with its comment, blank where there is none", async () => {
    const sheet = await commentsSheet(buildFixture());

    expect(rowValues(sheet, FIRST_DATA_ROW)).toEqual([
      "Alpha Co",
      "Approach",
      "Alice",
      "TLC Applicant",
      4.5,
      'Solid; thin on risk, "quoted" and\nmulti-line',
    ]);
    expect(rowValues(sheet, FIRST_DATA_ROW + 1)).toEqual([
      "Alpha Co",
      "Approach",
      "Bob",
      "WFRC",
      5,
      "Excellent, clear plan",
    ]);
    // Alice's Cost score has no comment: the row is still there, the comment just blank.
    const blank = rowValues(sheet, FIRST_DATA_ROW + 2);
    expect(blank.slice(0, 5)).toEqual(["Alpha Co", "Cost", "Alice", "TLC Applicant", 1]);
    expect(blank[5] ?? "").toBe("");
  });

  it("orders rows by firm, then criterion, then reviewer (project order), not score order", async () => {
    const sheet = await commentsSheet(buildFixture());
    const order = [0, 1, 2, 3].map((i) => {
      const [firm, criterion, reviewer] = rowValues(sheet, FIRST_DATA_ROW + i);
      return `${firm}/${criterion}/${reviewer}`;
    });
    expect(order).toEqual([
      "Alpha Co/Approach/Alice",
      "Alpha Co/Approach/Bob",
      "Alpha Co/Cost/Alice",
      "Beta Co/Approach/Bob",
    ]);
  });

  it("leaves out unsubmitted firms and scores whose reviewer was removed, and has no other rows", async () => {
    const sheet = await commentsSheet(buildFixture());
    const text = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => rowValues(sheet, FIRST_DATA_ROW + i)),
    );
    expect(text).not.toContain("Gamma Co");
    expect(text).not.toContain("Not submitted");
    expect(text).not.toContain("Reviewer was removed");
    expect(sheet.getRow(FIRST_DATA_ROW + 4).getCell(1).value).toBeNull(); // exactly 4 data rows
  });

  it("freezes the header and adds a filter over the table", async () => {
    const sheet = await commentsSheet(buildFixture());
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: HEADER_ROW });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("still produces the tab (header only, no filter) when nothing has been scored", async () => {
    const project = buildFixture();
    project.scores = [];
    const sheet = await commentsSheet(project);
    expect(rowValues(sheet, HEADER_ROW)[0]).toBe("Firm");
    expect(sheet.getRow(FIRST_DATA_ROW).getCell(1).value).toBeNull();
    expect(sheet.autoFilter).toBeFalsy();
  });
});
