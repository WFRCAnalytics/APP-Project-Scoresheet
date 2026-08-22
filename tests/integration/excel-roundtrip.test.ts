// T037: The Excel round-trip contract test mandated by
// contracts/reviewer-workbook.md — generate (T031, Phase 4) -> parse (T036, this phase)
// must agree on every detail, since they are each other's only contract test. Lives here
// in Phase 5, not Phase 4, because it needs both directions to exist first (see Phase
// 4's checkpoint note in tasks.md, resolving /speckit-analyze finding I1).
//
// Updated for the single-sheet redesign: row numbers come from generateWorkbook.ts's
// exported SCORING_FIRST_DATA_ROW rather than a hardcoded "row 2" — the whole point of
// parseWorkbook.ts locating the header row dynamically is that these two files (and this
// test) don't need to hardcode the same row number in three places.
//
// This cannot substitute for the manual real-Excel verification in qa-signoff.md (T035)
// — it only proves ExcelJS agrees with itself (research.md §2).
// @vitest-environment node

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  generateWorkbookForReviewer,
  SCORING_FIRST_DATA_ROW,
} from "../../src/lib/excel/generateWorkbook";
import { parseScoringWorkbook } from "../../src/lib/excel/parseWorkbook";
import { createEmptyProject, type Project } from "../../src/types/project";

function buildFixture(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Round Trip Fixture";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 3, label: "Maybe" },
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
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "city", email: "" }];
  return project;
}

async function loadWorkbookFromBlob(blob: Blob): Promise<ExcelJS.Workbook> {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer as unknown as ArrayBuffer);
  return workbook;
}

describe("Excel round trip: generateWorkbook -> parseWorkbook", () => {
  it("1. recovers every row as 'skipped' (not 'failed') on the unmodified, freshly generated workbook", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);
    const result = parseScoringWorkbook(project, workbook, generated.filename);

    // 2 firms * 2 criteria = 4 rows, all blank -> all skipped, none added, none failed.
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((r) => r.status === "skipped")).toBe(true);
    expect(result.addedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(4);
    expect(result.reviewerName).toBe("Alice");
  });

  it("2. programmatically filling Score cells produces exactly the expected Score[]", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);
    const sheet = workbook.getWorksheet("Scoring")!;

    // Simulate a reviewer filling in every row, in the row order generateWorkbook used:
    // firm-1/crit-1, firm-1/crit-2, firm-2/crit-1, firm-2/crit-2.
    const filledValues = [5, 3, 1, 5];
    const filledComments = ["Great approach", "", "Too expensive", "Solid value"];
    for (let i = 0; i < 4; i++) {
      const r = SCORING_FIRST_DATA_ROW + i;
      sheet.getCell(`D${r}`).value = filledValues[i];
      sheet.getCell(`E${r}`).value = filledComments[i];
    }

    const result = parseScoringWorkbook(project, workbook, generated.filename);

    expect(result.addedCount).toBe(4);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);

    const scores = result.rows.map((r) => r.score);
    expect(scores).toEqual([
      {
        reviewerId: "rev-1",
        firmId: "firm-1",
        criterionId: "crit-1",
        value: 5,
        comment: "Great approach",
        updatedAt: expect.any(String),
      },
      {
        reviewerId: "rev-1",
        firmId: "firm-1",
        criterionId: "crit-2",
        value: 3,
        comment: "",
        updatedAt: expect.any(String),
      },
      {
        reviewerId: "rev-1",
        firmId: "firm-2",
        criterionId: "crit-1",
        value: 1,
        comment: "Too expensive",
        updatedAt: expect.any(String),
      },
      {
        reviewerId: "rev-1",
        firmId: "firm-2",
        criterionId: "crit-2",
        value: 5,
        comment: "Solid value",
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("3a. an out-of-scale Score value produces a failed row, not a thrown exception", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);
    const sheet = workbook.getWorksheet("Scoring")!;
    sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 99; // not one of 1/3/5

    const result = parseScoringWorkbook(project, workbook, generated.filename);

    expect(result.rows[0].status).toBe("failed");
    expect(result.rows[0].reason).toMatch(/not one of this project's configured scale values/);
    expect(result.rows[0].score).toBeUndefined();
    // The other, still-blank rows are unaffected.
    expect(result.rows.slice(1).every((r) => r.status === "skipped")).toBe(true);
  });

  it("3b. a corrupted/mismatched hidden-ID cell produces a failed row, not a thrown exception", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);
    const sheet = workbook.getWorksheet("Scoring")!;
    // Mismatched: points at a criterion ID that doesn't exist in the current project.
    sheet.getCell(`H${SCORING_FIRST_DATA_ROW}`).value = "crit-does-not-exist";
    sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5; // otherwise a perfectly valid score

    expect(() => parseScoringWorkbook(project, workbook, generated.filename)).not.toThrow();
    const result = parseScoringWorkbook(project, workbook, generated.filename);

    expect(result.rows[0].status).toBe("failed");
    expect(result.rows[0].reason).toMatch(/criterion.*no longer exists/i);
  });

  it("re-validates against the CURRENT project, not the project state at generation time", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);
    const sheet = workbook.getWorksheet("Scoring")!;
    sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5;

    // Configuration changed after the form went out: criterion crit-1 was removed.
    const changedProject: Project = {
      ...project,
      criteria: project.criteria.filter((c) => c.id !== "crit-1"),
    };

    const result = parseScoringWorkbook(changedProject, workbook, generated.filename);
    const row2 = result.rows[0]; // firm-1/crit-1
    expect(row2.status).toBe("failed");
    expect(row2.reason).toMatch(/criterion.*no longer exists/i);
  });

  it("resolves reviewerName from a valid reviewerId alone, even when every row's firmId is stale", async () => {
    const project = buildFixture();
    const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
    if (!generated.ok) throw new Error(generated.error);

    const workbook = await loadWorkbookFromBlob(generated.blob);

    // Configuration changed after the form went out: both firms were removed, so every
    // row's firmId is now stale — but the reviewer themselves is still a live reviewer.
    const changedProject: Project = { ...project, firms: [] };

    const result = parseScoringWorkbook(changedProject, workbook, generated.filename);

    // Every row fails (no live firm to attach the score to)...
    expect(result.rows.every((r) => r.status === "failed")).toBe(true);
    expect(result.failedCount).toBe(result.rows.length);
    // ...but reviewerName must still resolve, since it depends only on reviewerId
    // validity, not on firmId/criterionId (data-model.md: reviewerName is "resolved
    // from the first row whose reviewerId matches a live reviewer").
    expect(result.reviewerName).toBe("Alice");
  });

  it("4. a file with no header row (unrelated .xlsx) is reported as one failed row, not a crash", async () => {
    const project = buildFixture();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Scoring");
    sheet.getCell("A1").value = "This is not a reviewer workbook";

    const result = parseScoringWorkbook(project, workbook, "unrelated.xlsx");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("failed");
    expect(result.rows[0].reason).toMatch(/header row/i);
    expect(result.addedCount).toBe(0);
  });

  // 004 post-launch improvements: overwrite detection (FR-023's "last input wins" upsert
  // used to happen silently; the handler now sees which added rows would replace an
  // already-recorded score, with the old value, before ever committing).
  describe("overwrite detection", () => {
    it("5a. a row scoring an already-scored cell is flagged 'added' WITH overwrites, carrying the previous value/comment/names", async () => {
      const project = buildFixture();
      project.scores = [
        {
          reviewerId: "rev-1",
          firmId: "firm-1",
          criterionId: "crit-1",
          value: 1,
          comment: "Original comment",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!generated.ok) throw new Error(generated.error);
      const workbook = await loadWorkbookFromBlob(generated.blob);
      const sheet = workbook.getWorksheet("Scoring")!;
      sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5; // firm-1/crit-1 — already scored above

      const result = parseScoringWorkbook(project, workbook, generated.filename);

      const row = result.rows[0];
      expect(row.status).toBe("added");
      expect(row.score?.value).toBe(5); // the NEW value is still what gets committed
      expect(row.overwrites).toEqual({
        previousValue: 1,
        previousComment: "Original comment",
        firmName: "Alpha Co",
        criterionName: "Approach",
      });
      expect(result.overwriteCount).toBe(1);
      // Overwriting doesn't remove it from "added" — it's a subset, not a fourth bucket.
      expect(result.addedCount).toBe(1);
    });

    it("5b. a row scoring a cell with no prior score has no overwrites, and doesn't count toward overwriteCount", async () => {
      const project = buildFixture(); // no scores at all yet
      const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!generated.ok) throw new Error(generated.error);
      const workbook = await loadWorkbookFromBlob(generated.blob);
      const sheet = workbook.getWorksheet("Scoring")!;
      sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5;

      const result = parseScoringWorkbook(project, workbook, generated.filename);

      expect(result.rows[0].status).toBe("added");
      expect(result.rows[0].overwrites).toBeUndefined();
      expect(result.overwriteCount).toBe(0);
      expect(result.addedCount).toBe(1);
    });

    it("5c. a mixed batch (some overwriting, some brand new, some blank) tallies overwriteCount correctly", async () => {
      const project = buildFixture();
      // Existing score for firm-1/crit-1 only.
      project.scores = [
        {
          reviewerId: "rev-1",
          firmId: "firm-1",
          criterionId: "crit-1",
          value: 3,
          comment: "",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!generated.ok) throw new Error(generated.error);
      const workbook = await loadWorkbookFromBlob(generated.blob);
      const sheet = workbook.getWorksheet("Scoring")!;
      // Row order: firm-1/crit-1, firm-1/crit-2, firm-2/crit-1, firm-2/crit-2.
      sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5; // overwrites the existing score
      sheet.getCell(`D${SCORING_FIRST_DATA_ROW + 1}`).value = 1; // brand new, no prior score
      // Row 3 (firm-2/crit-1) left blank -> "skipped", not counted either way.

      const result = parseScoringWorkbook(project, workbook, generated.filename);

      expect(result.addedCount).toBe(2);
      expect(result.skippedCount).toBe(2); // firm-2/crit-1 blank, firm-2/crit-2 blank
      expect(result.overwriteCount).toBe(1);
      expect(result.rows[0].overwrites?.previousValue).toBe(3);
      expect(result.rows[1].overwrites).toBeUndefined();
    });

    it("5d. an orphaned score (references a firm/criterion no longer in the project) is never matched as 'existing' for overwrite purposes", async () => {
      const project = buildFixture();
      // A score exists for the SAME reviewer/criterion but a DIFFERENT firm than the one
      // being imported — must not be mistaken for the same cell.
      project.scores = [
        {
          reviewerId: "rev-1",
          firmId: "firm-2",
          criterionId: "crit-1",
          value: 1,
          comment: "",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      const generated = await generateWorkbookForReviewer(project, project.reviewers[0]);
      if (!generated.ok) throw new Error(generated.error);
      const workbook = await loadWorkbookFromBlob(generated.blob);
      const sheet = workbook.getWorksheet("Scoring")!;
      sheet.getCell(`D${SCORING_FIRST_DATA_ROW}`).value = 5; // firm-1/crit-1 — a DIFFERENT cell

      const result = parseScoringWorkbook(project, workbook, generated.filename);

      expect(result.rows[0].overwrites).toBeUndefined();
      expect(result.overwriteCount).toBe(0);
    });
  });
});
