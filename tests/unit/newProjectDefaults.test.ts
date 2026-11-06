// "Start a new project" prefills the 1/3/5 scale; loading a saved file never does.

import { describe, expect, it } from "vitest";
import { validateAndMigrateProject } from "../../src/lib/project-schema";
import {
  DEFAULT_SCORING_SCALE,
  createEmptyProject,
  createNewProject,
} from "../../src/types/project";

describe("createNewProject", () => {
  it("prefills the 1/3/5 scale with its labels", () => {
    const project = createNewProject();
    expect(project.scoringScale).toEqual([
      { value: 1, label: "Completely unqualified" },
      { value: 3, label: "Adequate, acceptable experience" },
      { value: 5, label: "More than qualified; will produce an excellent product" },
    ]);
    expect(project.scoringScaleMode).toBe("continuous");
  });

  it("hands each project its own copy, so editing one never mutates the defaults", () => {
    const a = createNewProject();
    a.scoringScale[0].label = "changed";
    expect(createNewProject().scoringScale[0].label).toBe("Completely unqualified");
    expect(DEFAULT_SCORING_SCALE[0].label).toBe("Completely unqualified");
  });
});

describe("loading a saved project", () => {
  it("does not fill the defaults into an old file's own scale", () => {
    const raw = JSON.parse(JSON.stringify(createEmptyProject()));
    raw.scoringScale = [
      { value: 1, label: "No" },
      { value: 2, label: "Yes" },
    ];
    const result = validateAndMigrateProject(raw);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.project.scoringScale).toEqual(raw.scoringScale);
  });
});
