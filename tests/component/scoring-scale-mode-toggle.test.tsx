// Component coverage for ScoringScaleEditor's discrete/continuous mode toggle — a new
// project defaults to "continuous" (createEmptyProject), switching modes doesn't touch the
// points table itself (same add/remove/edit either way), and the continuous-mode hint only
// shows once there are enough points to have a real range.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

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

  it("shows the continuous-range hint only once at least 2 points exist, using their min/max", () => {
    goToScaleStep();
    // A fresh project starts with zero scale points — no range to describe yet.
    expect(screen.queryByText(/labeled reference points/)).not.toBeInTheDocument();

    const addButton = screen.getByRole("button", { name: "Add scale point" });
    fireEvent.click(addButton);
    expect(screen.queryByText(/labeled reference points/)).not.toBeInTheDocument(); // still just 1

    fireEvent.click(addButton);
    expect(screen.getByText(/labeled reference points/)).toBeInTheDocument();
  });

  it("switching modes never changes the points themselves — same add/remove/edit table either way", () => {
    goToScaleStep();
    const addButton = screen.getByRole("button", { name: "Add scale point" });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    let valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);

    fireEvent.click(screen.getByLabelText(/^Discrete/));
    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2"]);

    fireEvent.click(screen.getByLabelText(/^Continuous/));
    valueInputs = screen.getAllByLabelText("Scale point value") as HTMLInputElement[];
    expect(valueInputs).toHaveLength(2);
    expect(valueInputs.map((i) => i.value)).toEqual(["1", "2"]);
  });
});
