// "Back to Dashboard" in the Configuration toolbar: once a project has scores, a handler who
// went into Configuration from the Dashboard (gear icon) can return directly, instead of
// stepping through Export / Review -> Generate reviewer forms -> View Dashboard. Pure
// navigation, so edits made in Configuration carry over.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

const scoredProject = {
  schemaVersion: "1.0",
  project: {
    projectName: "Original Name",
    localGovContact: "",
    procurementAgent: "",
    committeeMeetingDate: "",
    notes: "",
  },
  scoringScale: [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ],
  scoringScaleMode: "discrete",
  criteria: [{ id: "crit-1", name: "Approach", weight: 1, description: "" }],
  firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
  reviewers: [
    { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true },
  ],
  scores: [
    { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
  ],
};

async function loadScoredProject() {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(scoredProject)], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Configuration toolbar — Back to Dashboard", () => {
  it("returns straight to the Dashboard from Configuration", async () => {
    await loadScoredProject();
    fireEvent.click(screen.getByRole("button", { name: "Configure project" }));
    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("carries over edits made in Configuration", async () => {
    await loadScoredProject();
    fireEvent.click(screen.getByRole("button", { name: "Configure project" }));
    fireEvent.change(screen.getByLabelText("Project Name:"), { target: { value: "Renamed" } });

    fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(screen.getByRole("heading", { name: "Renamed" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Original Name" })).not.toBeInTheDocument();
  });

  it("is not offered for a brand-new project with no scores yet", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));

    expect(screen.getByRole("heading", { name: "Configuration" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Dashboard" })).not.toBeInTheDocument();
  });
});
