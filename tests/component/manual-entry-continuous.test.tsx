// Component coverage for ManualEntryGrid's continuous-mode Score cell (free-text, not the
// discrete <select> — see user-story-5-flow.test.tsx for that mode's own coverage). A
// scoreScale.test.ts unit test already covers normalizeScoreValue() in isolation; this
// drives the real UI to confirm the draft/commit-on-blur wiring and the invalid-input
// revert actually work end-to-end.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildProject(): Project {
  const project = createEmptyProject();
  project.project.projectName = "Continuous Manual Entry Test";
  project.scoringScaleMode = "continuous";
  project.scoringScale = [
    { value: 1, label: "Poor" },
    { value: 5, label: "Excellent" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }];
  return project;
}

async function navigateToManualEntryGrid(project: Project) {
  openGetStartedModal();
  const file = new File([JSON.stringify(project)], "continuous.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Configuration" });

  goToConfigStep("Export / Review");
  fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
  await screen.findByRole("heading", { name: "Reviewer Forms" });

  fireEvent.click(screen.getByRole("button", { name: "View Dashboard" }));
  await screen.findByRole("heading", { name: "Dashboard" });

  fireEvent.click(screen.getByRole("button", { name: "Show calculations" }));
  fireEvent.click(screen.getByRole("tab", { name: "Manual Entry" }));
  await screen.findByLabelText("Manual Score Entry");
}

function scoreInput(): HTMLInputElement {
  return screen.getByLabelText("Score for Alpha Co / Approach") as HTMLInputElement;
}

describe("ManualEntryGrid — continuous scale free-text entry", () => {
  it("renders a free-text field, not a <select> restricted to the configured points", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const input = scoreInput();
    expect(input.tagName).toBe("INPUT");
  });

  it("commits a value between the configured points on blur, not just the points themselves", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const input = scoreInput();
    fireEvent.change(input, { target: { value: "3.7" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.7");
  });

  it("rounds a value with more than one decimal place on commit", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const input = scoreInput();
    fireEvent.change(input, { target: { value: "3.14" } });
    fireEvent.blur(input);
    expect(input.value).toBe("3.1");
  });

  it("reverts to the last-committed value when the typed text is out of the configured range", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const input = scoreInput();
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.blur(input);
    expect(input.value).toBe("4");

    fireEvent.change(input, { target: { value: "99" } }); // out of [1, 5]
    fireEvent.blur(input);
    expect(input.value).toBe("4"); // reverted, not stored
  });

  it("reverts to the last-committed value when the typed text isn't a number at all", async () => {
    render(<App />);
    await navigateToManualEntryGrid(buildProject());

    const input = scoreInput();
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.blur(input);
    expect(input.value).toBe("2.5");

    fireEvent.change(input, { target: { value: "not a number" } });
    fireEvent.blur(input);
    expect(input.value).toBe("2.5");
  });
});
