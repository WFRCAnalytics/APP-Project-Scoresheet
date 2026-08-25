// 004 post-launch improvements, item 3: component coverage for the duplicate-name warning
// banner in FirmsEditor/ReviewersEditor, plus ScoringScaleEditor's later reuse of the same
// warning for duplicate scale-point VALUES (added alongside the scoring-scale reducer
// identity fix — see that component's own header comment). Mounts the whole app and drives
// it the same way app-flow.test.tsx does — there's no existing isolated-provider harness for
// these editors, and this app's own convention for Configuration-step tests is to go through
// the real Load -> Configuration flow rather than mount an editor standalone.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function startNewProject() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
}

function addFirm(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add firm" }));
  const inputs = screen.getAllByLabelText("Firm name");
  fireEvent.change(inputs[inputs.length - 1], { target: { value: name } });
}

function addReviewer(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add reviewer" }));
  const inputs = screen.getAllByLabelText("Reviewer name");
  fireEvent.change(inputs[inputs.length - 1], { target: { value: name } });
}

describe("Duplicate-name warning — Firms", () => {
  it("shows no warning when firm names are distinct", () => {
    startNewProject();
    goToConfigStep("Firms");
    addFirm("Acme Co");
    addFirm("Beta Corp");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when two firms share the exact same name", () => {
    startNewProject();
    goToConfigStep("Firms");
    addFirm("Acme Co");
    addFirm("Acme Co");
    expect(screen.getByRole("alert")).toHaveTextContent('"Acme Co" is used by 2 firms');
  });

  it("warns when firm names differ only by case or whitespace", () => {
    startNewProject();
    goToConfigStep("Firms");
    addFirm("Acme Co");
    addFirm("  acme co  ");
    expect(screen.getByRole("alert")).toHaveTextContent("is used by 2 firms");
  });

  it("does not warn about two still-blank new firm rows", () => {
    startNewProject();
    goToConfigStep("Firms");
    fireEvent.click(screen.getByRole("button", { name: "Add firm" }));
    fireEvent.click(screen.getByRole("button", { name: "Add firm" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the warning once a duplicate is renamed to be unique, without blocking editing", () => {
    startNewProject();
    goToConfigStep("Firms");
    addFirm("Acme Co");
    addFirm("Acme Co");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const inputs = screen.getAllByLabelText("Firm name");
    fireEvent.change(inputs[1], { target: { value: "Beta Corp" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(inputs[1]).toHaveValue("Beta Corp");
  });
});

describe("Duplicate-name warning — Reviewers", () => {
  it("shows no warning when reviewer names are distinct", () => {
    startNewProject();
    goToConfigStep("Reviewers");
    addReviewer("Alice");
    addReviewer("Bob");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when two reviewers share the exact same name", () => {
    startNewProject();
    goToConfigStep("Reviewers");
    addReviewer("Alice");
    addReviewer("Alice");
    expect(screen.getByRole("alert")).toHaveTextContent('"Alice" is used by 2 reviewers');
  });

  it("reports multiple duplicate groups independently", () => {
    startNewProject();
    goToConfigStep("Reviewers");
    addReviewer("Alice");
    addReviewer("Alice");
    addReviewer("Bob");
    addReviewer("Bob");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent('"Alice" is used by 2 reviewers');
    expect(alert).toHaveTextContent('"Bob" is used by 2 reviewers');
  });
});

function addThreeScalePoints() {
  // A fresh project starts with an EMPTY scoringScale (createEmptyProject) — each click
  // appends nextDefaultValue() (running max + 1), producing 1, 2, 3 in that order.
  const addButton = screen.getByRole("button", { name: "Add scale point" });
  fireEvent.click(addButton);
  fireEvent.click(addButton);
  fireEvent.click(addButton);
}

describe("Duplicate-value warning — Scoring Scale", () => {
  it("shows no warning for distinct values (1, 2, 3)", () => {
    startNewProject();
    goToConfigStep("Scale");
    addThreeScalePoints();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when two scale points are edited to share the same value", () => {
    startNewProject();
    goToConfigStep("Scale");
    addThreeScalePoints(); // 1, 2, 3

    const valueInputs = screen.getAllByLabelText("Scale point value");
    // Value cells commit on blur (draft-state — see ScoringScaleEditor's header comment on
    // value precision), so a real edit needs both events.
    fireEvent.change(valueInputs[2], { target: { value: "2" } }); // 3 -> 2, collides with row 2
    fireEvent.blur(valueInputs[2]);

    expect(screen.getByRole("alert")).toHaveTextContent('"2" is used by 2 points');
    // Non-blocking — this does not stop saving or generating forms (same convention as
    // Firms/Reviewers), so the value in the field must have actually applied. Displayed as
    // "2.0" — a new project defaults to Continuous mode, which always shows one decimal
    // place (see ScoringScaleEditor's header comment); the warning text itself still keys
    // off the raw numeric value ("2"), not the display string.
    expect((valueInputs[2] as HTMLInputElement).value).toBe("2.0");
  });

  it("clears the warning once a duplicate value is changed to be unique again", () => {
    startNewProject();
    goToConfigStep("Scale");
    addThreeScalePoints(); // 1, 2, 3
    let valueInputs = screen.getAllByLabelText("Scale point value");
    fireEvent.change(valueInputs[2], { target: { value: "2" } });
    fireEvent.blur(valueInputs[2]);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    valueInputs = screen.getAllByLabelText("Scale point value");
    fireEvent.change(valueInputs[2], { target: { value: "5" } });
    fireEvent.blur(valueInputs[2]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
