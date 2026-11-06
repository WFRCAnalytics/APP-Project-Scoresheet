// A firm's expanded row on the Dashboard: the radar and dot charts are tabs (one at a time,
// instead of a tall stack), and the comments stay their own section below them.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

function project() {
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Chart Tabs Test",
      localGovContact: "",
      procurementAgent: "",
      committeeMeetingDate: "",
      notes: "",
    },
    scoringScale: [
      { value: 1, label: "Poor" },
      { value: 5, label: "Great" },
    ],
    scoringScaleMode: "discrete",
    criteria: [
      { id: "crit-1", name: "Approach", weight: 0.5, description: "" },
      { id: "crit-2", name: "Cost", weight: 0.5, description: "" },
    ],
    firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
    reviewers: [
      { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true },
      { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
    ],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "Solid plan", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 1, comment: "", updatedAt: "" },
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-2", value: 3, comment: "Pricey", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-2", value: 5, comment: "", updatedAt: "" },
    ],
  };
}

async function openFirm() {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(project())], "scored.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
  fireEvent.click(screen.getByRole("button", { name: "Expand Alpha Co" }));
}

const chartTabs = () => screen.getByRole("tablist", { name: "Firm charts" });
const radarTitle = () => screen.queryByRole("heading", { name: "Why Alpha Co scored where it did" });
const dotTitle = () =>
  screen.queryByRole("heading", { name: /How Alpha Co.s reviewers scored, by criterion/ });

describe("Firm row — chart tabs", () => {
  it("has a tab for each chart, opening on the criterion breakdown (radar)", async () => {
    await openFirm();
    const tabs = within(chartTabs()).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Criterion breakdown", "Reviewer scores"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(radarTitle()).toBeInTheDocument();
    expect(dotTitle()).not.toBeInTheDocument();
  });

  it("shows only the other chart when its tab is clicked", async () => {
    await openFirm();
    fireEvent.click(within(chartTabs()).getByRole("tab", { name: "Reviewer scores" }));
    expect(within(chartTabs()).getByRole("tab", { name: "Reviewer scores" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(dotTitle()).toBeInTheDocument();
    expect(radarTitle()).not.toBeInTheDocument();

    fireEvent.click(within(chartTabs()).getByRole("tab", { name: "Criterion breakdown" }));
    expect(radarTitle()).toBeInTheDocument();
    expect(dotTitle()).not.toBeInTheDocument();
  });

  it("keeps the comments as their own section, not a chart tab", async () => {
    await openFirm();
    expect(within(chartTabs()).queryByRole("tab", { name: /Comments/ })).not.toBeInTheDocument();
    // The Comments section (heading + its own per-criterion tabs) is there on either chart tab.
    expect(screen.getByRole("heading", { name: /^Comments/ })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Comments by criterion" })).toBeInTheDocument();

    fireEvent.click(within(chartTabs()).getByRole("tab", { name: "Reviewer scores" }));
    expect(screen.getByRole("heading", { name: /^Comments/ })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Comments by criterion" })).toBeInTheDocument();
  });

  it("switching chart tabs does not disturb the comments' selected criterion", async () => {
    await openFirm();
    fireEvent.click(screen.getByRole("tab", { name: /^Cost/ }));
    expect(screen.getByRole("tab", { name: /^Cost/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(chartTabs()).getByRole("tab", { name: "Reviewer scores" }));
    expect(screen.getByRole("tab", { name: /^Cost/ })).toHaveAttribute("aria-selected", "true");
  });

  it("leaves the printed report's layout alone: no tabs in the print copy", async () => {
    await openFirm();
    expect(document.querySelector(".print-only-block .comments-table")).not.toBeNull();
    expect(document.querySelector(".print-only-block [role='tablist']")).toBeNull();
  });
});
