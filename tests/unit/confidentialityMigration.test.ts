// Reviewer.confidentialitySigned was added after projects were already being saved, so an old
// project.json has no value for it. A missing value loads as signed (every reviewer in such a
// file was already taking part); an explicit value — either way — is kept as-is.

import { describe, expect, it } from "vitest";
import { validateAndMigrateProject } from "../../src/lib/project-schema";
import { createEmptyProject } from "../../src/types/project";

function rawProject(reviewers: Record<string, unknown>[]) {
  const project = createEmptyProject();
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  return { ...JSON.parse(JSON.stringify(project)), reviewers };
}

describe("confidentialitySigned migration", () => {
  it("loads a reviewer with no value as signed", () => {
    const result = validateAndMigrateProject(
      rawProject([{ id: "rev-1", name: "Alice", type: "applicant", email: "" }]),
    );
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.project.reviewers[0].confidentialitySigned).toBe(true);
  });

  it("keeps an explicit false (and true) untouched", () => {
    const result = validateAndMigrateProject(
      rawProject([
        { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: false },
        { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
      ]),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.project.reviewers.map((r) => r.confidentialitySigned)).toEqual([false, true]);
    }
  });

  it("migrates a missing value even alongside the older city -> applicant rename", () => {
    const result = validateAndMigrateProject(
      rawProject([{ id: "rev-1", name: "Alice", type: "city", email: "" }]),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.project.reviewers[0].type).toBe("applicant");
      expect(result.project.reviewers[0].confidentialitySigned).toBe(true);
    }
  });

  it("rejects a value that is not a boolean, rather than silently replacing it", () => {
    const result = validateAndMigrateProject(
      rawProject([
        { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: "yes" },
      ]),
    );
    expect(result.valid).toBe(false);
  });
});
