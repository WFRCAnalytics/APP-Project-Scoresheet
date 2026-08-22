// 004 post-launch improvements, item 3: component coverage for the duplicate-name warning
// banner in FirmsEditor/ReviewersEditor. Mounts the whole app and drives it the same way
// app-flow.test.tsx does — there's no existing isolated-provider harness for these editors,
// and this app's own convention for Configuration-step tests is to go through the real
// Load -> Configuration flow rather than mount an editor standalone.

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
