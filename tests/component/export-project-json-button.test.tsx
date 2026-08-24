// Coverage for ExportProjectJsonButton's two variants (components/ExportProjectJsonButton.tsx):
// "inline" (Configuration's toolbar — the original always-visible label+input+button,
// deliberately UNCHANGED by the Dashboard toolbar redesign) and "compact" (Dashboard only —
// clicking "Export JSON" opens a confirm panel, "Save As"-style, instead of exporting
// directly). Both variants share the same underlying filename/export logic; only the
// markup differs.

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import App from "../../src/App";
import * as downloadBlobModule from "../../src/lib/downloadBlob";
import { openGetStartedModal } from "../helpers/appNav";

beforeEach(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => {};
  }
});

function goToConfiguration() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
}

async function goToDashboard() {
  render(<App />);
  openGetStartedModal();
  const scoredProject = {
    schemaVersion: "1.0",
    project: {
      projectName: "Export Variant Test",
      localGovContact: "",
      procurementAgent: "",
      committeeMeetingDate: "",
      notes: "",
    },
    scoringScale: [
      { value: 1, label: "No" },
      { value: 5, label: "Yes" },
    ],
    scoringScaleMode: "discrete",
    criteria: [{ id: "crit-1", name: "Approach", weight: 1, description: "" }],
    firms: [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }],
    reviewers: [{ id: "rev-1", name: "Alice", type: "applicant", email: "" }],
    scores: [
      { reviewerId: "rev-1", firmId: "firm-1", criterionId: "crit-1", value: 5, comment: "", updatedAt: "" },
    ],
  };
  const file = new File([JSON.stringify(scoredProject)], "scored.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

describe("ExportProjectJsonButton — inline variant (Configuration, unchanged)", () => {
  it("shows the filename field and export button always, with no confirm panel to open first", () => {
    goToConfiguration();

    expect(screen.getByLabelText("Export filename")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Export project JSON" })).not.toBeInTheDocument();
  });

  it("is button-primary, not the Dashboard compact variant's secondary trigger styling", () => {
    goToConfiguration();
    expect(screen.getByRole("button", { name: "Export project JSON" }).className).toContain(
      "button-primary",
    );
  });

  it("exports using the (editable, never forced) filename field's current value", () => {
    goToConfiguration();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.change(screen.getByLabelText("Export filename"), {
      target: { value: "inline_custom.json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export project JSON" }));

    expect(downloadSpy.mock.calls[0][1]).toBe("inline_custom.json");
  });
});

describe("ExportProjectJsonButton — compact variant (Dashboard toolbar only)", () => {
  it("clicking 'Export JSON' opens a confirm panel instead of exporting directly", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument(); // closed by default
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(screen.getByRole("dialog", { name: "Export project JSON" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filename")).toHaveValue("Export_Variant_Test.json");
    expect(downloadSpy).not.toHaveBeenCalled(); // opening the panel alone must not export
  });

  it("confirming in the panel exports with the shown (default) filename and closes the panel", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][1]).toBe("Export_Variant_Test.json");
    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument();
  });

  it("editing the filename in the panel and confirming exports under the new name", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    fireEvent.change(screen.getByLabelText("Filename"), {
      target: { value: "custom_export.json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(downloadSpy.mock.calls[0][1]).toBe("custom_export.json");
  });

  it("pressing Enter in the filename field confirms and exports, same as clicking the button", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    const filenameInput = screen.getByLabelText("Filename");
    fireEvent.change(filenameInput, { target: { value: "enter_confirms.json" } });
    fireEvent.keyDown(filenameInput, { key: "Enter" });

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][1]).toBe("enter_confirms.json");
    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument();
  });

  it("Cancel closes the panel without exporting", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(downloadSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument();
  });

  it("Escape closes the panel without exporting, but keeps the edited name for next time", async () => {
    await goToDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    fireEvent.change(screen.getByLabelText("Filename"), { target: { value: "still_here.json" } });
    fireEvent.keyDown(screen.getByLabelText("Filename"), { key: "Escape" });

    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument();

    // Reopening shows the name is still there, even though nothing was exported yet.
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(screen.getByLabelText("Filename")).toHaveValue("still_here.json");
  });

  it("clicking outside the panel closes it without exporting", async () => {
    await goToDashboard();
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(screen.getByLabelText("Filename")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText("Filename")).not.toBeInTheDocument();
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it("the trigger is button-secondary; the panel's confirm button is button-primary", async () => {
    await goToDashboard();
    expect(screen.getByRole("button", { name: "Export JSON" }).className).toContain(
      "button-secondary",
    );

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(screen.getByRole("button", { name: "Export" }).className).toContain("button-primary");
  });
});
