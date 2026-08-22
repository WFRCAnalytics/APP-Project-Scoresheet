// 004 post-launch improvements, item 2: component-level coverage for what actually renders
// in jsdom for ReviewerScoreSpreadChart — its title (proves it mounts under the right firm)
// and its three guard-clause empty states, all of which run in plain React logic before
// Recharts' <ResponsiveContainer> (which measures 0x0 in jsdom and renders no scatter dots
// at all — see tests/unit/reviewerScoreSpreadChart.test.ts for the actual per-dot math
// coverage that limitation pushed there instead).
//
// "No criteria configured yet."/"No scoring scale configured yet." are pre-existing, shared
// hint strings — OverallCityBarChart and CriterionBreakdownChart already show the identical
// text under the identical conditions (an established app-wide convention, not something
// this component introduces), so the same guard state legitimately renders that text more
// than once on screen at once. Queried with getAllByText + a length check rather than the
// usual getByText/findByText (which require exactly one match) for that reason.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createEmptyProject, type Project } from "../../src/types/project";
import { openGetStartedModal } from "../helpers/appNav";

function baseProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Spread Chart Test";
  project.firms = [{ id: "f1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "r1", name: "Alice", type: "city", email: "" }];
  return project;
}

async function loadAndExpand(project: Project) {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(project)], "p.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
  fireEvent.click(screen.getByRole("button", { name: /Expand Alpha Co/ }));
}

describe("ReviewerScoreSpreadChart", () => {
  it("renders its title naming the expanded firm", async () => {
    const project = baseProject();
    project.scoringScale = [
      { value: 1, label: "No" },
      { value: 5, label: "Yes" },
    ];
    project.criteria = [{ id: "c1", name: "Approach", weight: 1, description: "" }];
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    await loadAndExpand(project);

    expect(
      await screen.findByText("How Alpha Co’s reviewers scored, by criterion"),
    ).toBeInTheDocument();
  });

  it("shows a hint when no criteria are configured", async () => {
    const project = baseProject();
    project.scoringScale = [
      { value: 1, label: "No" },
      { value: 5, label: "Yes" },
    ];
    project.criteria = [];
    // Routing to the Dashboard needs scores.length > 0 (FR-002) — with zero live criteria,
    // any score entry is necessarily orphaned already, consistent with the scenario itself.
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    await loadAndExpand(project);

    expect((await screen.findAllByText("No criteria configured yet.")).length).toBeGreaterThan(0);
  });

  it("shows a hint when no scoring scale is configured", async () => {
    const project = baseProject();
    project.scoringScale = [];
    project.criteria = [{ id: "c1", name: "Approach", weight: 1, description: "" }];
    project.scores = [
      { reviewerId: "r1", firmId: "f1", criterionId: "c1", value: 5, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    await loadAndExpand(project);

    expect(
      (await screen.findAllByText("No scoring scale configured yet.")).length,
    ).toBeGreaterThan(0);
  });

  it("shows a hint when criteria/scale exist but this firm has no reviewer scores yet", async () => {
    const project = baseProject();
    project.scoringScale = [
      { value: 1, label: "No" },
      { value: 5, label: "Yes" },
    ];
    project.criteria = [{ id: "c1", name: "Approach", weight: 1, description: "" }];
    // A SECOND firm carries the project's only score, purely so the upload routes straight
    // to the Dashboard (FR-002: routing needs scores.length > 0 project-wide) — Alpha Co
    // itself (the one we expand and inspect) genuinely has zero scores, which is the actual
    // case under test.
    project.firms.push({ id: "f2", name: "Beta Co", invited: true, submitted: true, notes: "" });
    project.scores = [
      { reviewerId: "r1", firmId: "f2", criterionId: "c1", value: 3, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    await loadAndExpand(project);

    expect(
      await screen.findByText("No reviewer scores recorded for this firm yet."),
    ).toBeInTheDocument();
  });
});
