// Coverage for ScoringScaleEditor's value-precision rules (see that component's own header
// comment for the full rationale):
//  - Continuous mode always displays/commits scale point values at one decimal place, even
//    for a point nobody ever typed a fraction into.
//  - Discrete mode displays plain integers by default, but switches EVERY point to one-
//    decimal display the moment any one of them genuinely has a fractional value.
//  - Both modes cap precision at exactly one decimal place (never more) on commit,
//    regardless of how many digits were typed.
// All value edits commit on blur (draft-state — same pattern as CriteriaEditor's WeightCell
// and ManualEntryGrid's ContinuousScoreCell), so every edit here fires change then blur.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function startNewProject() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
}

function addScalePoints(count: number) {
  const addButton = screen.getByRole("button", { name: "Add scale point" });
  for (let i = 0; i < count; i++) fireEvent.click(addButton);
}

function editValue(index: number, text: string) {
  const inputs = screen.getAllByLabelText("Scale point value");
  fireEvent.change(inputs[index], { target: { value: text } });
  fireEvent.blur(inputs[index]);
}

function valueTexts(): string[] {
  return (screen.getAllByLabelText("Scale point value") as HTMLInputElement[]).map((i) => i.value);
}

describe("ScoringScaleEditor — value precision (Continuous mode)", () => {
  it("displays every point with one decimal place by default, without any decimal input", () => {
    startNewProject();
    goToConfigStep("Scale");
    // A new project defaults to Continuous mode already — no mode switch needed.
    addScalePoints(3);
    expect(valueTexts()).toEqual(["1.0", "2.0", "3.0"]);
  });

  it("caps a typed value to one decimal place, rounding rather than truncating", () => {
    startNewProject();
    goToConfigStep("Scale");
    addScalePoints(2);
    editValue(1, "2.567");
    expect(valueTexts()[1]).toBe("2.6");
  });

  it("still shows one decimal for a whole-number edit", () => {
    startNewProject();
    goToConfigStep("Scale");
    addScalePoints(2);
    editValue(1, "5");
    expect(valueTexts()[1]).toBe("5.0");
  });
});

describe("ScoringScaleEditor — value precision (Discrete mode)", () => {
  function switchToDiscrete() {
    fireEvent.click(screen.getByRole("radio", { name: /Discrete/ }));
  }

  it("displays plain integers by default, with no fractional point anywhere", () => {
    startNewProject();
    goToConfigStep("Scale");
    switchToDiscrete();
    addScalePoints(3);
    expect(valueTexts()).toEqual(["1", "2", "3"]);
  });

  it("switches every point to one-decimal display once one point is edited to a fractional value", () => {
    startNewProject();
    goToConfigStep("Scale");
    switchToDiscrete();
    addScalePoints(3); // 1, 2, 3

    editValue(1, "2.5"); // row 1 (was "2") becomes genuinely fractional

    // Every point — including the two that were never touched — now shows one decimal.
    expect(valueTexts()).toEqual(["1.0", "2.5", "3.0"]);
  });

  it("reverts to plain-integer display for every point once the one fractional value is edited back to a whole number", () => {
    startNewProject();
    goToConfigStep("Scale");
    switchToDiscrete();
    addScalePoints(3);
    editValue(1, "2.5");
    expect(valueTexts()).toEqual(["1.0", "2.5", "3.0"]);

    editValue(1, "2");
    expect(valueTexts()).toEqual(["1", "2", "3"]);
  });

  it("caps a typed decimal to one decimal place even in discrete mode", () => {
    startNewProject();
    goToConfigStep("Scale");
    switchToDiscrete();
    addScalePoints(2);
    editValue(1, "2.567");
    expect(valueTexts()[1]).toBe("2.6");
  });
});

describe("ScoringScaleEditor — value cell edit behavior", () => {
  it("discards an emptied field instead of coercing it to 0", () => {
    startNewProject();
    goToConfigStep("Scale");
    fireEvent.click(screen.getByRole("radio", { name: /Discrete/ }));
    addScalePoints(2); // 1, 2

    editValue(1, "");
    // Reverts to the last-committed value (2), not 0.
    expect(valueTexts()[1]).toBe("2");
  });

  it("discards non-numeric text instead of storing it", () => {
    startNewProject();
    goToConfigStep("Scale");
    fireEvent.click(screen.getByRole("radio", { name: /Discrete/ }));
    addScalePoints(2); // 1, 2

    editValue(1, "abc");
    expect(valueTexts()[1]).toBe("2");
  });
});
