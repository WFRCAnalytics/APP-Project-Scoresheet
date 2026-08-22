// 004 post-launch improvements, item 4: "Download all forms" now packages every reviewer's
// workbook into a single .zip (via lib/zipFiles.ts, JSZip) instead of N staggered sequential
// blob downloads. Drives the real UI (ReviewerFormsScreen, via App) and verifies both the
// download-count change (exactly one downloadBlob call, not one per reviewer) and that the
// resulting archive actually contains one correctly named workbook per reviewer.

import { fireEvent, render, screen } from "@testing-library/react";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import * as downloadBlobModule from "../../src/lib/downloadBlob";
import { createEmptyProject, type Project } from "../../src/types/project";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function buildProject(reviewerNames: string[]): Project {
  const project = createEmptyProject();
  project.project.projectName = "Zip Download Test";
  project.scoringScale = [
    { value: 1, label: "No" },
    { value: 5, label: "Yes" },
  ];
  project.criteria = [{ id: "crit-1", name: "Approach", weight: 1, description: "" }];
  project.firms = [{ id: "firm-1", name: "Alpha Co", invited: true, submitted: true, notes: "" }];
  project.reviewers = reviewerNames.map((name, i) => ({
    id: `rev-${i}`,
    name,
    type: "city",
    email: "",
  }));
  return project;
}

async function navigateToReviewerForms(project: Project) {
  openGetStartedModal();
  const file = new File([JSON.stringify(project)], "project.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Configuration" });
  goToConfigStep("Export / Review");
  fireEvent.click(screen.getByRole("button", { name: "Generate reviewer forms" }));
  await screen.findByRole("heading", { name: "Reviewer Forms" });
}

describe("Download all forms — zip archive", () => {
  beforeEach(() => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => "blob:mock";
      URL.revokeObjectURL = () => {};
    }
  });

  it("triggers exactly one download, not one per reviewer", async () => {
    const project = buildProject(["Alice", "Bob", "Carol"]);
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});
    render(<App />);
    await navigateToReviewerForms(project);

    fireEvent.click(screen.getByRole("button", { name: "Download all forms" }));
    await screen.findByRole("button", { name: "Download all forms" });

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [blob, filename] = downloadSpy.mock.calls[0];
    expect(filename).toBe("Zip_Download_Test_Reviewer_Forms.zip");
    expect(blob.type).toMatch(/zip/);
    downloadSpy.mockRestore();
  });

  it("the archive contains exactly one correctly named workbook per reviewer", async () => {
    const project = buildProject(["Alice", "Bob"]);
    let capturedBlob: Blob | null = null;
    const downloadSpy = vi
      .spyOn(downloadBlobModule, "downloadBlob")
      .mockImplementation((blob) => {
        capturedBlob = blob;
      });
    render(<App />);
    await navigateToReviewerForms(project);

    fireEvent.click(screen.getByRole("button", { name: "Download all forms" }));
    await screen.findByRole("button", { name: "Download all forms" });

    expect(capturedBlob).not.toBeNull();
    const zip = await JSZip.loadAsync(capturedBlob!);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(["Alice_Zip_Download_Test.xlsx", "Bob_Zip_Download_Test.xlsx"]);
    downloadSpy.mockRestore();
  });

  it("still refuses up front, with no download, when no reviewers exist", async () => {
    const project = buildProject([]);
    const downloadSpy = vi.spyOn(downloadBlobModule, "downloadBlob").mockImplementation(() => {});
    render(<App />);
    await navigateToReviewerForms(project);

    fireEvent.click(screen.getByRole("button", { name: "Download all forms" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add at least one reviewer before generating forms.",
    );
    expect(downloadSpy).not.toHaveBeenCalled();
    downloadSpy.mockRestore();
  });
});
