// End-to-end component test for User Story 4 (not a numbered tasks.md item — same
// rationale as the Phase 3/5 flow tests). Covers what wasn't already exercised by Phase
// 3's app-flow.test.tsx (which already covers Acceptance Scenarios 1-2 via the Load
// screen): Acceptance Scenario 3 (Dashboard -> Edit -> Configuration, no data loss) and
// T046's cross-check that "Upload a different project JSON" *from Configuration* makes
// the same routing decision as the Load screen, in both directions.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildScoredProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "US4 Scored Project";
  project.project.localGovContact = "Jamie Handler";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "city", email: "" }];
  project.scores = [
    {
      reviewerId: "rev-1",
      firmId: "firm-1",
      criterionId: "crit-1",
      value: 5,
      comment: "Great",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  return project;
}

function buildUnscoredProject(name: string): Project {
  const project = createEmptyProject();
  project.project.projectName = name;
  project.firms = [{ id: "firm-9", name: "Delta Co", invited: true, submitted: false, notes: "" }];
  return project;
}

function jsonFile(project: Project, filename: string): File {
  return new File([JSON.stringify(project)], filename, { type: "application/json" });
}

describe("User Story 4 — Reopen a Project File", () => {
  it("Acceptance Scenario 3: Dashboard -> Edit project -> Configuration, with no data lost", async () => {
    render(<App />);
    openGetStartedModal();
    const scored = buildScoredProject();
    fireEvent.change(screen.getByLabelText("Upload a project file"), {
      target: { files: [jsonFile(scored, "scored.json")] },
    });
    await screen.findByRole("heading", { name: "Dashboard" });

    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));

    await screen.findByRole("heading", { name: "Configuration" });
    // Every field that was loaded must still be present — nothing reset to empty.
    expect(screen.getByLabelText("Project Name:")).toHaveValue("US4 Scored Project");
    expect(screen.getByLabelText("Local Government Contact:")).toHaveValue("Jamie Handler");

    goToConfigStep("Firms");
    expect(screen.getByLabelText("Firm name")).toHaveValue("Alpha Co");

    goToConfigStep("Reviewers");
    expect(screen.getByLabelText("Reviewer name")).toHaveValue("Alice");
  });

  it("T046: 'Upload a different project JSON' from Configuration routes a scored file to the Dashboard", async () => {
    render(<App />);
    openGetStartedModal();
    // Start from Configuration via an unscored upload (any path that lands there works).
    const unscored = buildUnscoredProject("Starting Point");
    fireEvent.change(screen.getByLabelText("Upload a project file"), {
      target: { files: [jsonFile(unscored, "start.json")] },
    });
    await screen.findByRole("heading", { name: "Configuration" });

    // "Upload a different project JSON" lives in the persistent Configuration toolbar —
    // available regardless of the current step (FR-013) — so no step navigation needed.
    const scored = buildScoredProject();
    fireEvent.change(screen.getByLabelText("Upload a different project JSON"), {
      target: { files: [jsonFile(scored, "scored.json")] },
    });

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(screen.getByRole("heading", { name: "US4 Scored Project" })).toBeInTheDocument();
  });

  it("T046: 'Upload a different project JSON' from Configuration routes an unscored file back to Configuration, pre-filled with the NEW file's data", async () => {
    render(<App />);
    openGetStartedModal();
    const first = buildUnscoredProject("First Project");
    fireEvent.change(screen.getByLabelText("Upload a project file"), {
      target: { files: [jsonFile(first, "first.json")] },
    });
    await screen.findByRole("heading", { name: "Configuration" });
    expect(screen.getByLabelText("Project Name:")).toHaveValue("First Project");

    const second = buildUnscoredProject("Second Project");
    fireEvent.change(screen.getByLabelText("Upload a different project JSON"), {
      target: { files: [jsonFile(second, "second.json")] },
    });

    // Still on Configuration, but now showing the SECOND project's data — proving the
    // project was actually replaced, not just re-rendered with stale state.
    await screen.findByDisplayValue("Second Project");
    expect(screen.queryByDisplayValue("First Project")).not.toBeInTheDocument();
  });
});
