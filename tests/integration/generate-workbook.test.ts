// Structural self-check of generateWorkbook.ts (T031) — not the full round-trip contract
// test (that's T037, Phase 5, once parseWorkbook.ts exists per the /speckit-analyze I1
// fix), but a real write -> re-read cycle through ExcelJS itself, verifying the workbook
// this app produces actually matches contracts/reviewer-workbook.md's structure. This is
// exactly the kind of check tasks.md's own Notes flag as warranted for "this feature's
// highest-risk-of-bugs modules."
//
// This still cannot replace the manual real-Excel verification step (T035) — it only
// proves ExcelJS agrees with itself (research.md §2).
//
// Runs under Vitest's "node" environment rather than the project default ("jsdom"): this
// test exercises pure Excel-buffer logic with no DOM involved, and jsdom's Blob polyfill
// doesn't implement `.arrayBuffer()` (the same class of gap as File.text() elsewhere) —
// Node's real Blob does, so node is both the correct and the more complete environment
// for this file specifically.
// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { checkCanGenerateWorkbooks, generateWorkbookForReviewer } from "../../src/lib/excel/generateWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildFixture(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Quickstart Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 3, label: "Maybe" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [
    { id: "crit-1", name: "Approach", weight: 0.6, description: "How they'll do the work" },
    { id: "crit-2", name: "Cost", weight: 0.4, description: "Value for money" },
  ];
  project.firms = [
    { id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" },
    { id: "firm-2", name: "Beta Co", invited: true, submitted: true, notes: "" },
    { id: "firm-3", name: "Gamma Co (withdrew)", invited: true, submitted: false, notes: "" },
  ];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "city", email: "" }];
  return project;
}

async function reloadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as unknown as ArrayBuffer);
  return workbook;
}

describe("generateWorkbookForReviewer", () => {
  it("produces Instructions + Scoring sheets, in that order", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = await reloadWorkbook(result.blob);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Instructions", "Scoring"]);
  });

  it("includes the project name, reviewer name, and full scale legend on Instructions", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const instructions = workbook.getWorksheet("Instructions")!;
    const text = instructions
      .getSheetValues()
      .flat()
      .filter((v): v is string => typeof v === "string")
      .join("\n");

    expect(text).toContain("Quickstart Test");
    expect(text).toContain("Alice");
    expect(text).toContain("1 — No");
    expect(text).toContain("3 — Maybe");
    expect(text).toContain("5 — Yes");
  });

  it("has exactly one row per (submitted firm x criterion) pair — withdrawn firm excluded", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    // header row + (2 submitted firms * 2 criteria) = 5 rows total
    expect(scoring.rowCount).toBe(5);

    const firmNames = new Set<string>();
    for (let r = 2; r <= scoring.rowCount; r++) {
      firmNames.add(String(scoring.getCell(`A${r}`).value));
    }
    expect(firmNames.has("Gamma Co (withdrew)")).toBe(false);
    expect(firmNames).toEqual(new Set(["Alpha Co", "Beta Co"]));
  });

  it("carries the correct hidden reviewerId/firmId/criterionId per row, and hides those columns", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;

    expect(scoring.getColumn("F").hidden).toBe(true);
    expect(scoring.getColumn("G").hidden).toBe(true);
    expect(scoring.getColumn("H").hidden).toBe(true);

    for (let r = 2; r <= scoring.rowCount; r++) {
      const firmName = scoring.getCell(`A${r}`).value;
      const criterionName = scoring.getCell(`B${r}`).value;
      const firm = project.firms.find((f) => f.name === firmName)!;
      const criterion = project.criteria.find((c) => c.name === criterionName)!;

      expect(scoring.getCell(`F${r}`).value).toBe("rev-1");
      expect(scoring.getCell(`G${r}`).value).toBe(firm.id);
      expect(scoring.getCell(`H${r}`).value).toBe(criterion.id);
    }
  });

  it("restricts the Score column to the configured scale values via a dropdown, and locks A-C/F-H while leaving D-E unlocked", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;

    const validation = scoring.getCell("D2").dataValidation;
    expect(validation?.type).toBe("list");
    expect(validation?.formulae?.[0]).toContain("1");
    expect(validation?.formulae?.[0]).toContain("3");
    expect(validation?.formulae?.[0]).toContain("5");

    for (const col of ["A", "B", "C", "F", "G", "H"]) {
      expect(scoring.getCell(`${col}2`).protection?.locked).not.toBe(false);
    }
    for (const col of ["D", "E"]) {
      expect(scoring.getCell(`${col}2`).protection?.locked).toBe(false);
    }
  });

  it("blocks generation with a clear message when there are no criteria or no submitted firms", async () => {
    const noCriteria = buildFixture();
    noCriteria.criteria = [];
    const result1 = await generateWorkbookForReviewer(noCriteria, noCriteria.reviewers[0]);
    expect(result1.ok).toBe(false);

    const noSubmittedFirms = buildFixture();
    noSubmittedFirms.firms = noSubmittedFirms.firms.map((f) => ({ ...f, submitted: false }));
    const result2 = await generateWorkbookForReviewer(noSubmittedFirms, noSubmittedFirms.reviewers[0]);
    expect(result2.ok).toBe(false);

    // And confirm the guard function itself agrees (used directly by the batch button).
    expect(checkCanGenerateWorkbooks(noCriteria)).not.toBeNull();
    expect(checkCanGenerateWorkbooks(noSubmittedFirms)).not.toBeNull();
    expect(checkCanGenerateWorkbooks(buildFixture())).toBeNull();
  });

  it("does NOT block generation when criterion weights fail to sum to 1.0 (FR-010, non-blocking)", async () => {
    const project = buildFixture();
    project.criteria[0].weight = 0.9; // total now 1.3, not 1.0
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    expect(result.ok).toBe(true);
  });
});
