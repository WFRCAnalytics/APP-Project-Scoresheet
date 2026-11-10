// A project manager who has just set up a project and generated the reviewer forms can save
// the project JSON from the Reviewer Forms page itself — without going back to Configuration
// just to find the export button.

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import * as downloadBlobModule from "../../src/lib/downloadBlob";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

beforeEach(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => {};
  }
});

// jsdom's Blob has no .text(), so read it the way a browser page would.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function goToReviewerForms() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
  fireEvent.change(screen.getByLabelText("Project Name:"), { target: { value: "Forms Page Test" } });
  goToConfigStep("Export / Review");
  fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
  expect(screen.getByRole("heading", { name: "Reviewer Forms" })).toBeInTheDocument();
}

describe("Reviewer Forms — Export JSON", () => {
  it("opens the same filename confirm as the Dashboard, without leaving the page", () => {
    goToReviewerForms();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Save JSON" }));

    expect(screen.getByRole("dialog", { name: "Export project JSON" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filename")).toHaveValue("Forms_Page_Test.json");
    expect(downloadSpy).not.toHaveBeenCalled(); // opening the panel alone must not export
    expect(screen.getByRole("heading", { name: "Reviewer Forms" })).toBeInTheDocument();
  });

  it("exports the loaded project, including edits made in Configuration", async () => {
    goToReviewerForms();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Save JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][1]).toBe("Forms_Page_Test.json");
    const exported = JSON.parse(await readBlobText(downloadSpy.mock.calls[0][0] as Blob));
    expect(exported.project.projectName).toBe("Forms Page Test");
  });
});
