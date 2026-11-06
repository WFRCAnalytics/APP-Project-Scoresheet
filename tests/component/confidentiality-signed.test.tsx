// The per-reviewer "Confidentiality form signed" toggle: a checkbox in the Reviewers editor
// (new reviewers start unchecked), a non-blocking warning on Reviewer Forms and the
// Dashboard, and a missing value in an old project.json loading as signed.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function scoredProject(signed: Array<boolean | undefined>) {
  const reviewers = [
    { id: "rev-1", name: "Alice", type: "applicant", email: "" },
    { id: "rev-2", name: "Bob", type: "wfrc", email: "" },
  ].map((r, i) => (signed[i] === undefined ? r : { ...r, confidentialitySigned: signed[i] }));
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Confidentiality Test",
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
    reviewers,
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 1, comment: "", updatedAt: "" },
    ],
  };
}

async function loadToDashboard(signed: Array<boolean | undefined>) {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(scoredProject(signed))], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Reviewers editor — confidentiality checkbox", () => {
  it("starts a new reviewer unchecked, and toggles on click", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Reviewers");
    fireEvent.click(screen.getByRole("button", { name: "Add reviewer" }));

    const checkbox = screen.getByRole("checkbox", { name: /Confidentiality form signed/ });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(screen.getByRole("checkbox", { name: /Confidentiality form signed/ })).toBeChecked();
  });
});

describe("old project files without the field", () => {
  it("load as signed — no warning on the Dashboard, boxes checked in the editor", async () => {
    await loadToDashboard([undefined, undefined]);
    expect(screen.queryByText(/Confidentiality form not signed/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    goToConfigStep("Reviewers");
    for (const box of screen.getAllByRole("checkbox", { name: /Confidentiality form signed/ })) {
      expect(box).toBeChecked();
    }
  });
});

describe("unsigned reviewers", () => {
  it("are named in a warning banner on the Dashboard", async () => {
    await loadToDashboard([true, false]);
    const banner = screen.getByText(/Confidentiality form not signed:/);
    expect(banner).toHaveTextContent("Bob");
    expect(banner).not.toHaveTextContent("Alice");
  });

  it("get a warning and a badge on Reviewer Forms, but can still download their workbook", async () => {
    await loadToDashboard([true, false]);
    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    goToConfigStep("Export / Review");
    fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));

    expect(screen.getByRole("status")).toHaveTextContent("Confidentiality form not signed: Bob");
    const bobRow = screen.getByRole("row", { name: /Bob/ });
    expect(within(bobRow).getByText("Confidentiality form not signed")).toBeInTheDocument();
    expect(within(bobRow).getByRole("button", { name: /Download form for Bob/ })).toBeEnabled();

    const aliceRow = screen.getByRole("row", { name: /Alice/ });
    expect(within(aliceRow).queryByText("Confidentiality form not signed")).not.toBeInTheDocument();
  });
});
