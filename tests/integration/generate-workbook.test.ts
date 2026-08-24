// Structural self-check of generateWorkbook.ts (T031) — not the full round-trip contract
// test (that's T037, Phase 5, once parseWorkbook.ts exists per the /speckit-analyze I1
// fix), but a real write -> re-read cycle through ExcelJS itself, verifying the workbook
// this app produces actually matches contracts/reviewer-workbook.md's structure. This is
// exactly the kind of check tasks.md's own Notes flag as warranted for "this feature's
// highest-risk-of-bugs modules."
//
// Updated for the single-sheet redesign (contracts/reviewer-workbook.md's "Revised" note):
// row numbers are read from generateWorkbook.ts's own exported SCORING_* constants rather
// than hardcoded a second time here — the two can't drift silently out of sync.
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
import {
  checkCanGenerateWorkbooks,
  generateWorkbookForReviewer,
  SCORING_FIRST_DATA_ROW,
  SCORING_HEADER_ROW,
  SCORING_SUBTITLE_ROW,
  SCORING_TITLE_ROW,
} from "../../src/lib/excel/generateWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildFixture(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Quickstart Test";
  // Explicit: this file specifically tests the discrete dropdown/exact-match behavior, so
  // it doesn't rely on createEmptyProject()'s "continuous" default for new projects.
  project.scoringScaleMode = "discrete";
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
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }];
  return project;
}

async function reloadWorkbook(blob: Blob): Promise<ExcelJS.Workbook> {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as unknown as ArrayBuffer);
  return workbook;
}

describe("generateWorkbookForReviewer", () => {
  it("produces exactly one sheet, named Scoring (single-sheet redesign)", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workbook = await reloadWorkbook(result.blob);
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Scoring"]);
  });

  it("includes the project name, reviewer name, and full scale legend in the title banner", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    const titleText = String(scoring.getCell(`A${SCORING_TITLE_ROW}`).value);
    const subtitleText = String(scoring.getCell(`A${SCORING_SUBTITLE_ROW}`).value);

    expect(titleText).toContain("Quickstart Test");
    expect(subtitleText).toContain("Alice");
    expect(subtitleText).toContain("1 = No");
    expect(subtitleText).toContain("3 = Maybe");
    expect(subtitleText).toContain("5 = Yes");
  });

  it("has exactly one row per (submitted firm x criterion) pair — withdrawn firm excluded", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    // banner (4 rows, incl. blank spacer) + header row + (2 submitted firms * 2 criteria)
    // = SCORING_FIRST_DATA_ROW - 1 + 4 data rows.
    expect(scoring.rowCount).toBe(SCORING_FIRST_DATA_ROW - 1 + 4);

    const firmNames = new Set<string>();
    for (let r = SCORING_FIRST_DATA_ROW; r <= scoring.rowCount; r++) {
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

    for (let r = SCORING_FIRST_DATA_ROW; r <= scoring.rowCount; r++) {
      const firmName = scoring.getCell(`A${r}`).value;
      const criterionName = scoring.getCell(`B${r}`).value;
      const firm = project.firms.find((f) => f.name === firmName)!;
      const criterion = project.criteria.find((c) => c.name === criterionName)!;

      expect(scoring.getCell(`F${r}`).value).toBe("rev-1");
      expect(scoring.getCell(`G${r}`).value).toBe(firm.id);
      expect(scoring.getCell(`H${r}`).value).toBe(criterion.id);
    }
  });

  it("has the real header row at SCORING_HEADER_ROW, with the expected labels", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;

    expect(scoring.getCell(`A${SCORING_HEADER_ROW}`).value).toBe("Firm");
    expect(scoring.getCell(`B${SCORING_HEADER_ROW}`).value).toBe("Criterion");
    expect(scoring.getCell(`C${SCORING_HEADER_ROW}`).value).toBe("Criterion Description");
    expect(scoring.getCell(`D${SCORING_HEADER_ROW}`).value).toBe("Score");
    expect(scoring.getCell(`E${SCORING_HEADER_ROW}`).value).toBe("Comments");
  });

  it("restricts the Score column to the configured scale values via a dropdown, and locks A-C/F-H while leaving D-E unlocked", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    const r = SCORING_FIRST_DATA_ROW;

    const validation = scoring.getCell(`D${r}`).dataValidation;
    expect(validation?.type).toBe("list");
    expect(validation?.formulae?.[0]).toContain("1");
    expect(validation?.formulae?.[0]).toContain("3");
    expect(validation?.formulae?.[0]).toContain("5");

    for (const col of ["A", "B", "C", "F", "G", "H"]) {
      expect(scoring.getCell(`${col}${r}`).protection?.locked).not.toBe(false);
    }
    for (const col of ["D", "E"]) {
      expect(scoring.getCell(`${col}${r}`).protection?.locked).toBe(false);
    }
  });

  it("visually distinguishes locked vs. editable columns with fills sourced from WFRC brand hex", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    const r = SCORING_FIRST_DATA_ROW;

    const lockedFill = scoring.getCell(`A${r}`).fill;
    const editableFill = scoring.getCell(`D${r}`).fill;
    // Same fill type on both, but a genuinely different color — this is the actual visual
    // cue, not just "some fill exists somewhere."
    expect(lockedFill).toBeTruthy();
    expect(editableFill).toBeTruthy();
    expect(JSON.stringify(lockedFill)).not.toBe(JSON.stringify(editableFill));
    // Editable cells also get a border — the locked ones don't need one, the fill alone
    // plus zebra striping is enough there.
    expect(scoring.getCell(`D${r}`).border).toBeTruthy();
  });

  it("marks the first row of each new firm with a thick top border, but not within a firm's own rows", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    // Row order: firm-1/crit-1, firm-1/crit-2, firm-2/crit-1, firm-2/crit-2 (buildFixture).
    const firstAlphaRow = SCORING_FIRST_DATA_ROW;
    const secondAlphaRow = SCORING_FIRST_DATA_ROW + 1;
    const firstBetaRow = SCORING_FIRST_DATA_ROW + 2; // the actual firm boundary

    // No divider above the very first data row (nothing to separate it from) or between
    // two rows belonging to the SAME firm.
    expect(scoring.getCell(`A${firstAlphaRow}`).border?.top?.style).not.toBe("thick");
    expect(scoring.getCell(`A${secondAlphaRow}`).border?.top?.style).not.toBe("thick");

    // The boundary row gets a thick top border on both a locked column (A) and an
    // editable one (D) — the editable column's usual thin yellow border on the other
    // three sides must survive untouched.
    const lockedBorder = scoring.getCell(`A${firstBetaRow}`).border;
    expect(lockedBorder?.top?.style).toBe("thick");

    const editableBorder = scoring.getCell(`D${firstBetaRow}`).border;
    expect(editableBorder?.top?.style).toBe("thick");
    expect(editableBorder?.bottom?.style).toBe("thin");
    expect(editableBorder?.left?.style).toBe("thin");
    expect(editableBorder?.right?.style).toBe("thin");
  });

  it("freezes the header row so it stays visible while scrolling", async () => {
    const project = buildFixture();
    const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!result.ok) throw new Error("expected ok");

    const workbook = await reloadWorkbook(result.blob);
    const scoring = workbook.getWorksheet("Scoring")!;
    const view = scoring.views?.[0];
    expect(view?.state).toBe("frozen");
    if (view?.state === "frozen") {
      expect(view.ySplit).toBe(SCORING_HEADER_ROW);
    }
  });

  it("blocks generation with a clear message when there are no criteria or no submitted firms", async () => {
    const noCriteria = buildFixture();
    noCriteria.criteria = [];
    const result1 = await generateWorkbookForReviewer(noCriteria, noCriteria.reviewers[0]);
    expect(result1.ok).toBe(false);

    const noSubmittedFirms = buildFixture();
    noSubmittedFirms.firms = noSubmittedFirms.firms.map((f) => ({ ...f, submitted: false }));
    const result2 = await generateWorkbookForReviewer(
      noSubmittedFirms,
      noSubmittedFirms.reviewers[0],
    );
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

  describe("continuous scoring scale mode", () => {
    it("uses Excel's built-in decimal-between validation instead of a dropdown list", async () => {
      const project = buildFixture();
      project.scoringScaleMode = "continuous"; // range [1, 5] from the same 1/3/5 points
      const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!result.ok) throw new Error("expected ok");

      const workbook = await reloadWorkbook(result.blob);
      const scoring = workbook.getWorksheet("Scoring")!;
      const validation = scoring.getCell(`D${SCORING_FIRST_DATA_ROW}`).dataValidation;

      expect(validation?.type).toBe("decimal");
      expect(validation?.operator).toBe("between");
      expect(validation?.formulae).toEqual([1, 5]);
    });

    it("notes in the legend that any value in range is accepted, not just the listed points", async () => {
      const project = buildFixture();
      project.scoringScaleMode = "continuous";
      const result = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!result.ok) throw new Error("expected ok");

      const workbook = await reloadWorkbook(result.blob);
      const scoring = workbook.getWorksheet("Scoring")!;
      const subtitleText = String(scoring.getCell(`A${SCORING_SUBTITLE_ROW}`).value);

      // Still lists the configured points as reference anchors...
      expect(subtitleText).toContain("1 = No");
      expect(subtitleText).toContain("5 = Yes");
      // ...but also says the range itself is what's actually accepted.
      expect(subtitleText).toContain("1 to 5");
    });
  });
});
