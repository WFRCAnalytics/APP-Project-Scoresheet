// The Dashboard's per-firm comments, tabbed by criterion: one criterion's reviewers at a time
// (instead of one long table), a row for EVERY reviewer who scored it so a comment can be added
// later, and the printed report still listing every comment in one table.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

function project() {
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Comments Tabs Test",
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
      { id: "crit-1", name: "Approach", weight: 0.4, description: "" },
      { id: "crit-2", name: "Cost", weight: 0.4, description: "" },
      { id: "crit-3", name: "Schedule", weight: 0.2, description: "" },
    ],
    firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
    reviewers: [
      { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: true },
      { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
      // Carol never scored anything for Alpha Co.
      { id: "rev-3", name: "Carol", type: "wfrc", email: "", confidentialitySigned: true },
    ],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "Solid plan", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 1, comment: "Weak", updatedAt: "" },
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-2", value: 1, comment: "Pricey", updatedAt: "" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-2", value: 5, comment: "", updatedAt: "" },
      // Schedule (crit-3): nobody has scored it.
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

const tab = (name: RegExp) => screen.getByRole("tab", { name });
// The comments panel inside the firm's Comments tab (there is an outer firm-detail panel too).
const panel = () => document.getElementById("firm-firm-1-comments-panel") as HTMLElement;

describe("Firm comments — tabbed by criterion", () => {
  it("has a tab per criterion, with the first selected and a comment count on each that has any", async () => {
    await openFirm();
    const tablist = screen.getByRole("tablist", { name: "Comments by criterion" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Approach 2", "Cost 1", "Schedule"]);
    expect(tab(/^Approach/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Cost/)).toHaveAttribute("aria-selected", "false");
  });

  it("shows only the selected criterion's reviewers, with their scores and comments", async () => {
    await openFirm();
    const rows = within(panel()).getAllByRole("row").slice(1); // skip the header row
    expect(rows.map((r) => r.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringContaining("Alice5"),
      expect.stringContaining("Bob1"),
    ]);
    expect(within(panel()).getByText("Solid plan")).toBeInTheDocument();
    expect(within(panel()).queryByText("Pricey")).not.toBeInTheDocument();
  });

  it("switches to another criterion's rows when its tab is clicked", async () => {
    await openFirm();
    fireEvent.click(tab(/^Cost/));
    expect(tab(/^Cost/)).toHaveAttribute("aria-selected", "true");
    expect(within(panel()).getByText("Pricey")).toBeInTheDocument();
    expect(within(panel()).queryByText("Solid plan")).not.toBeInTheDocument();
  });

  it("does not list a reviewer who has not scored that criterion", async () => {
    await openFirm();
    expect(within(panel()).queryByText("Carol")).not.toBeInTheDocument();
  });

  it("says so on a criterion nobody has scored yet", async () => {
    await openFirm();
    fireEvent.click(tab(/^Schedule/));
    expect(within(panel()).getByText("No scores recorded for this criterion yet.")).toBeInTheDocument();
  });
});

describe("Firm comments — adding a comment where there was none", () => {
  it("shows 'No comment' with an Add comment button for a scored row without one", async () => {
    await openFirm();
    fireEvent.click(tab(/^Cost/));
    const bobRow = within(panel()).getByRole("row", { name: /Bob/ });
    expect(within(bobRow).getByText("No comment")).toBeInTheDocument();
    expect(within(bobRow).getByRole("button", { name: "Add comment: Bob, Cost" })).toBeInTheDocument();
  });

  it("opens the editor, saves the new comment without a confirmation, and updates the tab", async () => {
    await openFirm();
    fireEvent.click(tab(/^Cost/));
    expect(tab(/^Cost/)).toHaveTextContent("Cost 1");

    fireEvent.click(screen.getByRole("button", { name: "Add comment: Bob, Cost" }));
    const dialog = screen.getByRole("dialog", { name: "Edit score and comment" });
    expect(within(dialog).getByLabelText("Comment for Alpha Co / Cost")).toHaveValue("");
    fireEvent.change(within(dialog).getByLabelText("Comment for Alpha Co / Cost"), {
      target: { value: "Best value of the group" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(); // score unchanged
    expect(screen.queryByRole("dialog", { name: "Edit score and comment" })).not.toBeInTheDocument();
    // Now an ordinary commented row (pencil, no Add button), and the count went up.
    expect(within(panel()).getByText("Best value of the group")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add comment: Bob, Cost" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit score and comment: Bob, Cost" })).toBeInTheDocument();
    expect(tab(/^Cost/)).toHaveTextContent("Cost 2");
  });
});

describe("Firm comments — printed report", () => {
  it("still lists every criterion's comments in one table (tabs can't print)", async () => {
    await openFirm();
    const printed = document.querySelector(".print-only-block .comments-table");
    expect(printed).not.toBeNull();
    const text = printed!.textContent ?? "";
    expect(text).toContain("Solid plan"); // Approach
    expect(text).toContain("Pricey"); // Cost
    expect(document.querySelector(".print-only-block [role='tablist']")).toBeNull();
  });
});
