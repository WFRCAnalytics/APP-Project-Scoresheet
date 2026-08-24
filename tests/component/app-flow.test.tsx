// Component-level smoke test for User Story 1's actual flow (not in tasks.md as a
// numbered task — tasks.md deliberately left UI tests optional for this phase — but
// cheap enough, and valuable enough given Phase 3's checkpoint explicitly claims
// "quickstart.md Scenario 1 passes end-to-end," to verify mechanically rather than by
// inspection alone before marking the phase done.
//
// Updated for the app-shell/Load/Configuration restructure: the Load screen's two entry
// actions now live inside the "Get Started" modal (openGetStartedModal), and Configuration
// shows one step at a time behind a non-gating progress bar (goToConfigStep) instead of all
// five editors stacked on one page.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

describe("User Story 1 — Configure a New Scoring Project (Load -> Configuration)", () => {
  it("shows exactly the two Load entry actions on first render (FR-001)", () => {
    render(<App />);
    openGetStartedModal();
    expect(screen.getByRole("button", { name: "Start a new project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Upload a project file")).toBeInTheDocument();
  });

  it("navigates to an empty Configuration screen after choosing Start a new project", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));

    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project Name:")).toHaveValue("");

    goToConfigStep("Firms");
    expect(screen.getByText("No firms yet — add one below.")).toBeInTheDocument();

    goToConfigStep("Reviewers");
    expect(screen.getByText("No reviewers yet — add one below.")).toBeInTheDocument();
  });

  it("lets the handler fill in project info and add a firm/reviewer/criterion/scale point", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));

    fireEvent.change(screen.getByLabelText("Project Name:"), {
      target: { value: "Quickstart Test" },
    });
    expect(screen.getByLabelText("Project Name:")).toHaveValue("Quickstart Test");

    goToConfigStep("Firms");
    fireEvent.click(screen.getByRole("button", { name: "Add firm" }));
    fireEvent.change(screen.getByLabelText("Firm name"), { target: { value: "Alpha Co" } });
    expect(screen.getByLabelText("Firm name")).toHaveValue("Alpha Co");

    goToConfigStep("Reviewers");
    fireEvent.click(screen.getByRole("button", { name: "Add reviewer" }));
    fireEvent.change(screen.getByLabelText("Reviewer name"), { target: { value: "Alice" } });
    expect(screen.getByLabelText("Reviewer name")).toHaveValue("Alice");

    goToConfigStep("Criteria");
    fireEvent.click(screen.getByRole("button", { name: "Add criterion" }));
    fireEvent.change(screen.getByLabelText("Criterion weight (fraction of 1.0)"), {
      target: { value: "0.7" },
    });
    // 0.7 alone should not sum to 1.0 -> non-blocking warning banner appears (FR-010).
    expect(screen.getByRole("alert")).toHaveTextContent(/must sum to 1\.0/);
    // And nothing about that warning disables the export button (non-blocking). Export
    // lives in the persistent Configuration toolbar, visible regardless of step.
    expect(screen.getByRole("button", { name: "Export project JSON" })).toBeEnabled();
  });

  it("enforces a minimum of 2 scoring scale points (FR-011) by disabling removal at the floor", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");

    // The default empty project starts with zero scale points; add exactly 2.
    fireEvent.click(screen.getByRole("button", { name: "Add scale point" }));
    fireEvent.click(screen.getByRole("button", { name: "Add scale point" }));

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    // All visible "Remove" buttons at this point belong to the 2 scale point rows — the
    // Scale step is the only editor rendered right now, so no other editor's Remove
    // buttons can be present regardless.
    for (const button of removeButtons) {
      expect(button).toBeDisabled();
    }
  });

  it("routes an uploaded scored project.json straight to the Dashboard placeholder (FR-002)", async () => {
    render(<App />);
    openGetStartedModal();

    const scoredProject = {
      schemaVersion: "1.0",
      project: { projectName: "Already Scored", localGovContact: "", procurementAgent: "", committeeMeetingDate: "", notes: "" },
      scoringScale: [
        { value: 1, label: "No" },
        { value: 5, label: "Yes" },
      ],
      criteria: [{ id: "crit-1", name: "Approach", weight: 1, description: "" }],
      firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
      reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }],
      scores: [
        { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
      ],
    };
    const file = new File([JSON.stringify(scoredProject)], "scored.json", {
      type: "application/json",
    });

    const uploadInput = screen.getByLabelText("Upload a project file");
    fireEvent.change(uploadInput, { target: { files: [file] } });

    const dashboardHeading = await screen.findByRole("heading", { name: "Dashboard" });
    expect(dashboardHeading).toBeInTheDocument();
  });

  it("routes an uploaded unscored project.json to Configuration, pre-filled (FR-003)", async () => {
    render(<App />);
    openGetStartedModal();

    const unscoredProject = {
      schemaVersion: "1.0",
      project: { projectName: "In Progress", localGovContact: "", procurementAgent: "", committeeMeetingDate: "", notes: "" },
      scoringScale: [
        { value: 1, label: "No" },
        { value: 5, label: "Yes" },
      ],
      criteria: [],
      firms: [{ id: "firm-1", name: "Beta Co", invited: true, submitted: false, notes: "" }],
      reviewers: [],
      scores: [],
    };
    const file = new File([JSON.stringify(unscoredProject)], "in-progress.json", {
      type: "application/json",
    });

    fireEvent.change(screen.getByLabelText("Upload a project file"), {
      target: { files: [file] },
    });

    await screen.findByRole("heading", { name: "Configuration" });
    expect(screen.getByLabelText("Project Name:")).toHaveValue("In Progress");

    goToConfigStep("Firms");
    expect(screen.getByLabelText("Firm name")).toHaveValue("Beta Co");
  });

  it("rejects an unrelated JSON file with a clear error, staying on the Load screen (FR-004)", async () => {
    render(<App />);
    openGetStartedModal();
    const file = new File([JSON.stringify({ hello: "world" })], "not-a-project.json", {
      type: "application/json",
    });

    fireEvent.change(screen.getByLabelText("Upload a project file"), {
      target: { files: [file] },
    });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/project.*info/i)).toBeInTheDocument();
    // Still on Load, modal still open — the two entry actions are still there, nothing
    // partially loaded.
    expect(screen.getByRole("button", { name: "Start a new project" })).toBeInTheDocument();
  });
});
