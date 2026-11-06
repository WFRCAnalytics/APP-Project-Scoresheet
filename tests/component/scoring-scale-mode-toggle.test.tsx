// Component coverage for ScoringScaleEditor's discrete/continuous mode toggle — a new
// project defaults to "continuous" (createEmptyProject), switching modes doesn't touch the
// points table itself (same add/remove/edit either way), and the continuous-mode hint only
// shows once there are enough points to have a real range.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal, setScaleValues } from "../helpers/appNav";

function goToScaleStep() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
  goToConfigStep("Scale");
}

describe("ScoringScaleEditor — discrete/continuous mode toggle", () => {
  it("defaults a brand-new project to Continuous", () => {
    goToScaleStep();
    expect(screen.getByLabelText(/^Continuous/)).toBeChecked();
    expect(screen.getByLabelText(/^Discrete/)).not.toBeChecked();
  });

  it("switching to Discrete unchecks Continuous, and vice versa", () => {
    goToScaleStep();
    fireEvent.click(screen.getByLabelText(/^Discrete/));
    expect(screen.getByLabelText(/^Discrete/)).toBeChecked();
    expect(screen.getByLabelText(/^Continuous/)).not.toBeChecked();

    fireEvent.click(screen.getByLabelText(/^Continuous/));
    expect(screen.getByLabelText(/^Continuous/)).toBeChecked();
    expect(screen.getByLabelText(/^Discrete/)).not.toBeChecked();
  });

  it("shows the continuous-range hint using the default scale's min/max", () => {
    goToScaleStep();
    // A fresh project starts with the 1/3/5 defaults, so the range is already described.
    expect(screen.getByText(/labeled reference points/)).toHaveTextContent(/from 1 to 5/);
  });

  it("switching modes never changes the points themselves — same add/remove/edit table either way", () => {
    goToScaleStep();
    setScaleValues([1, 2]);
    let valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);

    // "1.0"/"2.0" here in Continuous, plain "1"/"2" once switched to Discrete — this is
    // legitimate mode-DEPENDENT DISPLAY formatting (see ScoringScaleEditor's header comment
    // on value precision: Continuous always shows one decimal, Discrete only does once some
    // point is genuinely fractional), not the points themselves changing — the underlying
    // values stay exactly 1 and 2 the whole time; only how they're rendered differs.
    fireEvent.click(screen.getByLabelText(/^Discrete/));
    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2"]);

    fireEvent.click(screen.getByLabelText(/^Continuous/));
    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.map((i) => i.value)).toEqual(["1.0", "2.0"]);
  });
});
