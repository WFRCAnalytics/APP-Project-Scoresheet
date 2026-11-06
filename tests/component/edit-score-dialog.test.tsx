// The pencil on a Dashboard comments-table row opens a focused editor for that one score:
// change the score and/or comment, "Update" saves and closes. A changed numeric score asks
// for a confirmation first (it moves the rankings); a comment-only change doesn't.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal } from "../helpers/appNav";

function project(mode: "discrete" | "continuous") {
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Edit Score Test",
      localGovContact: "",
      procurementAgent: "",
      committeeMeetingDate: "",
      notes: "",
    },
    scoringScale: [
      { value: 1, label: "Poor" },
      { value: 3, label: "OK" },
      { value: 5, label: "Great" },
    ],
    scoringScaleMode: mode,
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
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 3, comment: "Solid plan", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "Excellent", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-2", value: 1, comment: "Pricey", updatedAt: "2026-01-01T00:00:00.000Z" },
      { reviewerId: "rev-2", firmId: "firm-1", criterionId: "crit-2", value: 3, comment: "", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  };
}

async function openFirmComments(mode: "discrete" | "continuous" = "discrete") {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(project(mode))], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
  fireEvent.click(screen.getByRole("tab", { name: /^Comments/ }));
}

const pencil = (reviewer: string, criterion: string) =>
  screen.getByRole("button", { name: `Edit score and comment: ${reviewer}, ${criterion}` });

// Comment text in the on-screen tab's table (the active criterion's rows only). The same
// comments also sit in the dialog's own textarea, so a bare getByText would match several.
// Rows with no comment show "No comment" and are skipped.
const shownComments = () =>
  Array.from(document.querySelectorAll(".comments-comment-cell"))
    .filter((cell) => !cell.querySelector(".comments-empty"))
    .map((cell) => cell.textContent?.trim());

const dialog = () => screen.getByRole("dialog", { name: "Edit score and comment" });

describe("Edit score dialog — opening", () => {
  it("offers a pencil on rows that have a comment, and Add comment on rows that don't", async () => {
    await openFirmComments();
    expect(pencil("Alice", "Approach")).toBeInTheDocument();
    expect(pencil("Bob", "Approach")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Cost/ }));
    expect(pencil("Alice", "Cost")).toBeInTheDocument();
    // Bob's Cost score has no comment: no pencil, but a visible way to add one.
    expect(
      screen.queryByRole("button", { name: "Edit score and comment: Bob, Cost" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add comment: Bob, Cost" })).toBeInTheDocument();
  });

  it("lists the on-screen comments (guards the shownComments helper used below)", async () => {
    await openFirmComments();
    // The first criterion's tab is showing; the other criterion's comments are on its own tab.
    expect(shownComments()).toEqual(["Solid plan", "Excellent"]);
  });

  it("shows which score it is and its current score and comment", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));

    const d = within(dialog());
    expect(d.getByText("Alpha Co")).toBeInTheDocument();
    expect(d.getByText("Approach")).toBeInTheDocument();
    expect(d.getByText("Alice")).toBeInTheDocument();
    expect(d.getByLabelText("Score for Alpha Co / Approach")).toHaveValue("3");
    expect(d.getByLabelText("Comment for Alpha Co / Approach")).toHaveValue("Solid plan");
  });
});

describe("Edit score dialog — saving", () => {
  it("saves a comment-only change straight away, with no confirmation, and closes", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Comment for Alpha Co / Approach"), {
      target: { value: "Solid plan, thin on risk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit score and comment" })).not.toBeInTheDocument();
    expect(shownComments()).toContain("Solid plan, thin on risk");
    expect(shownComments()).not.toContain("Solid plan");
  });

  it("asks before changing the numeric score, then saves it on confirm", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    const confirm = screen.getByRole("alertdialog", { name: "Change this score?" });
    expect(confirm).toHaveTextContent("from 3 to 5");
    fireEvent.click(within(confirm).getByRole("button", { name: "Change score" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit score and comment" })).not.toBeInTheDocument();

    fireEvent.click(pencil("Alice", "Approach"));
    expect(screen.getByLabelText("Score for Alpha Co / Approach")).toHaveValue("5");
  });

  it("returns to the form, edits intact, when the confirmation is cancelled", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Comment for Alpha Co / Approach"), {
      target: { value: "Reconsidered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); // the confirm's Cancel

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Score for Alpha Co / Approach")).toHaveValue("1");
    expect(screen.getByLabelText("Comment for Alpha Co / Approach")).toHaveValue("Reconsidered");
    // Nothing was saved yet.
    expect(shownComments()).not.toContain("Reconsidered");
  });

  it("Cancel discards the edit", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Comment for Alpha Co / Approach"), {
      target: { value: "Should not be saved" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Edit score and comment" })).not.toBeInTheDocument();
    expect(shownComments()).toContain("Solid plan");
    expect(shownComments()).not.toContain("Should not be saved");
  });

  it("Update with nothing changed just closes", async () => {
    await openFirmComments();
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit score and comment" })).not.toBeInTheDocument();
    expect(shownComments()).toContain("Solid plan");
  });
});

describe("Edit score dialog — continuous scale", () => {
  it("rejects an out-of-range value without saving or confirming", async () => {
    await openFirmComments("continuous");
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value from 1 to 5.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it("rounds to one decimal place, then confirms the (rounded) change", async () => {
    await openFirmComments("continuous");
    fireEvent.click(pencil("Alice", "Approach"));
    fireEvent.change(screen.getByLabelText("Score for Alpha Co / Approach"), {
      target: { value: "4.26" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("from 3 to 4.3");
  });
});
