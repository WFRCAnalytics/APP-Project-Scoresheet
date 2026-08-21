// Regression test for the ScoringScaleEditor React-key/live-resort bug: editing an
// existing scale point's value was causing React to unmount/remount the row (and jump
// its position, since the list was re-sorted by the very field being edited) instead of
// updating it in place — reading as "editing adds a new row." This is specifically a
// rendering/reconciliation bug, not a reducer bug, so it can only be caught by actually
// rendering the component and interacting with it (a projectReducer unit test in
// isolation would not have caught this — the reducer's own value-matching logic was
// already correct).

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

describe("ScoringScaleEditor — edit and remove existing points", () => {
  it("editing the middle of 3 points updates it in place (array stays length 3, no append)", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");

    // Add 3 scale points. nextDefaultValue() starts at 1 and increments the running max,
    // so this produces values 1, 2, 3 in that insertion order.
    const addButton = screen.getByRole("button", { name: "Add scale point" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    let valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(3);
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2", "3"]);

    // Edit the MIDDLE point (value 2) — this is exactly the reported reproduction step.
    const middleInput = valueInputs[1];
    fireEvent.change(middleInput, { target: { value: "20" } });

    // Must still be exactly 3 rows — the classic symptom of the bug was a 4th row
    // appearing (an append) instead of row 2 updating in place.
    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(3);
    // The edit must have landed on the SAME row (position 2), not been appended at the end.
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "20", "3"]);

    // Editing the label of that same (now-edited) row must also update in place, not
    // duplicate — confirms the row's identity survived the value edit.
    const labelInputs = screen.getAllByLabelText("Scale point label") as HTMLInputElement[];
    fireEvent.change(labelInputs[1], { target: { value: "Twenty" } });
    expect(screen.getAllByLabelText("Scale point label")).toHaveLength(3);
    expect((screen.getAllByLabelText("Scale point label")[1] as HTMLInputElement).value).toBe("Twenty");
  });

  it("removing a point at 3 leaves exactly 2, and both become remove-blocked at the floor", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");

    const addButton = screen.getByRole("button", { name: "Add scale point" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    let removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(3);
    // Well above the 2-point floor — all three must be enabled.
    for (const button of removeButtons) {
      expect(button).toBeEnabled();
    }

    // Remove the last point (value 3).
    fireEvent.click(removeButtons[2]);

    const valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2"]);

    // Exactly at the 2-point floor now — both remaining Remove buttons must be disabled.
    removeButtons = screen.getAllByRole("button", { name: "Remove" });
    expect(removeButtons).toHaveLength(2);
    for (const button of removeButtons) {
      expect(button).toBeDisabled();
    }
  });
});
