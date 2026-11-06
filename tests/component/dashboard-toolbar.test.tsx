// Coverage for the Dashboard toolbar's hierarchy: every control has an icon and a visible label
// (Configure project, Export JSON, Excel, PDF Report), and PDF is the one primary action. The old
// "Show calculations" dialog is gone — its content lives in the Reviewer scores tab, Reviewer
// Forms and the Excel export.

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
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true }],
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
  it("Configure project has a visible label alongside its icon", async () => {
    await goToDashboard();

    const button = screen.getByRole("button", { name: "Configure project" });
    expect(button.textContent).toContain("Configure project");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("the three export actions keep a visible label alongside their icon", async () => {
    await goToDashboard();

    expect(screen.getByRole("button", { name: "Export JSON" }).textContent).toContain(
      "Export JSON",
    );
    expect(screen.getByRole("button", { name: "Export Excel workbook" }).textContent).toContain(
      "Excel",
    );
    expect(screen.getByRole("button", { name: "Export PDF report" }).textContent).toContain(
      "PDF Report",
    );
  });

  it("has no Calculations dialog any more", async () => {
    await goToDashboard();

    expect(screen.queryByRole("button", { name: /calculations/i })).not.toBeInTheDocument();
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
});
