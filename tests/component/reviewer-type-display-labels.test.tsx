// Regression coverage: spots that used to interpolate the raw internal Reviewer.type value
// ("applicant"/"wfrc") straight into displayed text instead of the "TLC Applicant"/"WFRC"
// labels used everywhere else in the app — caught by inspection, not a test, the first time, so
// this locks in the fix. Now covers the Reviewer Forms roster and the Dashboard's Reviewer
// scores heatmap.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildScoredProject() {
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Display Label Test",
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
      { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
    ],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 1, comment: "", updatedAt: "" },
    ],
  };
}

async function goToDashboard() {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(buildScoredProject())], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Reviewer type display labels — never the raw internal value", () => {
  it("the Reviewer Forms roster shows 'TLC Applicant'/'WFRC' badges, not 'applicant'/'wfrc'", async () => {
    await goToDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Configure project" }));
    goToConfigStep("Export / Review");
    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
    await screen.findByRole("heading", { name: "Reviewer Forms" });

    expect(within(screen.getByRole("row", { name: /Alice/ })).getByText("TLC Applicant")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Bob/ })).getByText("WFRC")).toBeInTheDocument();
    expect(screen.queryByText(/^applicant$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^wfrc$/)).not.toBeInTheDocument();
  });

  it("the Dashboard's Reviewer scores heatmap groups reviewers as 'TLC Applicant'/'WFRC'", async () => {
    await goToDashboard();
    fireEvent.click(screen.getByRole("tab", { name: /^Reviewer scores/ }));

    expect(screen.getByText(/TLC Applicant reviewers/)).toBeInTheDocument();
    expect(screen.getByText(/WFRC reviewers/)).toBeInTheDocument();
    expect(screen.queryByText(/\bapplicant reviewers\b/)).not.toBeInTheDocument();
  });

  it("Reviewer Forms' type badge shows 'TLC Applicant'/'WFRC' too (existing coverage, still true)", async () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Reviewers");
    fireEvent.click(screen.getByRole("button", { name: "Add reviewer" }));
    goToConfigStep("Export / Review");
    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));

    expect(screen.getByText("TLC Applicant")).toBeInTheDocument();
  });
});
