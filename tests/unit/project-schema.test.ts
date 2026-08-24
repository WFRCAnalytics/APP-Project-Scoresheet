// T012: Unit tests for src/lib/project-schema.ts — schema-version handling (FR-038) and
// structural validation (FR-004), covering exactly the scenarios quickstart.md Scenario 4
// walks through manually.

import { describe, expect, it } from "vitest";
import { validateAndMigrateProject } from "../../src/lib/project-schema";
import { CURRENT_SCHEMA_VERSION, createEmptyProject } from "../../src/types/project";

function validMinimalProjectJson() {
  const project = createEmptyProject();
  project.project.projectName = "Quickstart Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }];
  return JSON.parse(JSON.stringify(project));
}

describe("validateAndMigrateProject — happy path", () => {
  it("accepts a well-formed current-version project", () => {
    const result = validateAndMigrateProject(validMinimalProjectJson());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.project.project.projectName).toBe("Quickstart Test");
    }
  });
});

describe("validateAndMigrateProject — schema version handling (FR-038)", () => {
  it("treats a missing schemaVersion as the oldest recognized version and migrates it", () => {
    const raw = validMinimalProjectJson();
    delete raw.schemaVersion;
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });

  it("rejects an unrecognized/future schemaVersion with a specific error, without loading it", () => {
    const raw = validMinimalProjectJson();
    raw.schemaVersion = "99.0";
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("99.0");
    }
  });
});

describe("validateAndMigrateProject — structural validation (FR-004)", () => {
  it("rejects a file that isn't a JSON object at all", () => {
    expect(validateAndMigrateProject(null).valid).toBe(false);
    expect(validateAndMigrateProject("just a string").valid).toBe(false);
    expect(validateAndMigrateProject(["array", "not", "object"]).valid).toBe(false);
    expect(validateAndMigrateProject({ hello: "world" }).valid).toBe(false);
  });

  it("rejects a file missing the project info section", () => {
    const raw = validMinimalProjectJson();
    delete raw.project;
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/project.*info/i);
  });

  it("rejects a reviewer with an invalid type value", () => {
    const raw = validMinimalProjectJson();
    raw.reviewers[0].type = "county"; // not "applicant" | "wfrc"
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/reviewer/i);
  });

  it("migrates a reviewer's old 'city' type value to 'applicant' (pre-rename saved files)", () => {
    const raw = validMinimalProjectJson();
    raw.reviewers[0].type = "city";
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.project.reviewers[0].type).toBe("applicant");
  });

  it("rejects a criterion with a non-numeric weight", () => {
    const raw = validMinimalProjectJson();
    raw.criteria[0].weight = "a lot";
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/criterion/i);
  });

  it("rejects scores that aren't an array", () => {
    const raw = validMinimalProjectJson();
    raw.scores = "not an array";
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/scores/i);
  });
});
