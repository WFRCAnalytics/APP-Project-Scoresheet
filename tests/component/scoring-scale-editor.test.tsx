// Regression tests for two separate ScoringScaleEditor bugs, both rooted in the same cause
// (ScoringScalePoint has no `id`, so something else had to identify a row):
//  1. React-key/live-resort bug: editing an existing scale point's value was causing React
//     to unmount/remount the row (and jump its position, since the list was re-sorted by
//     the very field being edited) instead of updating it in place — reading as "editing
//     adds a new row."
//  2. Reducer identity bug (found later from a real user report): fixing #1 wasn't enough,
//     because UPDATE_SCALE_POINT/REMOVE_SCALE_POINT themselves still identified the target
//     row by `value`, not position — so two rows sharing a value (even just transiently,
//     mid-edit) got matched and mutated/removed together. See
//     tests/unit/scoringScaleReducer.test.ts for the reducer-only version of this, and the
//     "editing the last of 4 points..." test below for the full through-the-UI version.
// Both are rendering-adjacent enough (bug #2 only reproduces via real sequential onChange
// events, not a single jump-to-final-value change) that they're tested here rather than
// purely at the reducer level.
//
// All three tests switch to Discrete mode before adding points: a new project defaults to
// Continuous (createEmptyProject), which forces every Value input to display with one
// decimal place regardless of what's typed (see ScoringScaleEditor's own header comment on
// value precision) — these tests are about row IDENTITY/reconciliation, not precision
// display, so Discrete mode (plain-integer display when nothing's fractional) keeps their
// assertions reading as the exact values typed, undistracted by an unrelated feature.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function switchToDiscrete() {
  fireEvent.click(screen.getByRole("radio", { name: /Discrete/ }));
}

describe("ScoringScaleEditor — edit and remove existing points", () => {
  it("editing the middle of 3 points updates it in place (array stays length 3, no append)", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");
    switchToDiscrete();

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
    // Value cells commit on blur (draft-state, see ScoringScaleEditor), so a real edit
    // needs both events, same as a handler tabbing to the next field would produce.
    const middleInput = valueInputs[1];
    fireEvent.change(middleInput, { target: { value: "20" } });
    fireEvent.blur(middleInput);

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

  it("editing the last of 4 points through an intermediate value another point already holds doesn't also change that other point (real user report)", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");
    switchToDiscrete();

    const addButton = screen.getByRole("button", { name: "Add scale point" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    let valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2", "3", "4"]);

    // Reproduces the exact reported steps: clear row 4's Value field, then type "1" then
    // "0", then blur (commit) — same as a real browser firing onChange per keystroke and
    // committing on blur. Draft state means only the FINAL value ("10") ever reaches the
    // reducer now (see ScoringScaleEditor's header comment on value precision) — a second,
    // independent layer of protection stacked on top of bug fix #2's index-based matching,
    // which is what tests/unit/scoringScaleReducer.test.ts exercises directly.
    const lastInput = valueInputs[3];
    fireEvent.change(lastInput, { target: { value: "" } });
    fireEvent.change(lastInput, { target: { value: "1" } }); // transiently equals row 1's value
    fireEvent.change(lastInput, { target: { value: "10" } });
    fireEvent.blur(lastInput);

    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    // Row 1 (still "1") must be untouched — the bug made it jump to "10" alongside row 4.
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2", "3", "10"]);
  });

  it("removing a point at 3 leaves exactly 2, and both become remove-blocked at the floor", () => {
    render(<App />);
    openGetStartedModal();
    fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
    goToConfigStep("Scale");
    switchToDiscrete();

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
