// Coverage for the Dashboard toolbar's hierarchy redesign: Edit project / Show calculations
// render icon-only (no visible text, accessible name via aria-label alone), the two export
// actions keep an icon + visible label, and "Show calculations" reflects its open/closed
// state via aria-expanded and the .is-active styling hook.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

async function goToDashboard() {
  render(<App />);
  openGetStartedModal();

  const scoredProject = {
    schemaVersion: "1.0",
    project: {
      projectName: "Toolbar Test",
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
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
    ],
  };
  const file = new File([JSON.stringify(scoredProject)], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("Dashboard toolbar hierarchy", () => {
  it("Edit project and Show calculations render icon-only — accessible name via aria-label, no visible text", async () => {
    await goToDashboard();

    const editButton = screen.getByRole("button", { name: "Edit project" });
    const calcButton = screen.getByRole("button", { name: "Show calculations" });
    expect(editButton.textContent).toBe("");
    expect(calcButton.textContent).toBe("");
  });

  it("the two export actions keep a visible label alongside their icon", async () => {
    await goToDashboard();

    expect(screen.getByRole("button", { name: "Export JSON" }).textContent).toContain(
      "Export JSON",
    );
    expect(screen.getByRole("button", { name: "Export PDF report" }).textContent).toContain(
      "PDF Report",
    );
  });

  it("PDF report is the only primary-styled action in the toolbar itself (Export JSON's confirm panel has its own primary button once opened)", async () => {
    await goToDashboard();

    expect(screen.getByRole("button", { name: "Export PDF report" }).className).toContain(
      "button-primary",
    );
    expect(screen.getByRole("button", { name: "Export JSON" }).className).not.toContain(
      "button-primary",
    );
  });

  it("Show calculations reflects open/closed state via aria-expanded and .is-active", async () => {
    await goToDashboard();
    const calcButton = screen.getByRole("button", { name: "Show calculations" });

    expect(calcButton).toHaveAttribute("aria-expanded", "false");
    expect(calcButton.className).not.toContain("is-active");

    fireEvent.click(calcButton);
    const hideButton = screen.getByRole("button", { name: "Hide calculations" });
    expect(hideButton).toHaveAttribute("aria-expanded", "true");
    expect(hideButton.className).toContain("is-active");
  });
});
