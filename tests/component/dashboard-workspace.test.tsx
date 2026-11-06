// The Dashboard's on-screen layout: a ranked-firms list you pick from, and one firm's detail
// beside it (Criterion breakdown / Comments / Reviewer scores tabs). Covers picking a firm,
// the tab that stays open as you move between firms, the reviewer-score heatmap and its jump to a
// criterion's comments, the header's status pills, and the tighter rows used with many firms.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { openGetStartedModal, rankedFirm, rankedFirmNames } from "../helpers/appNav";

function project(firmCount = 2, opts: { unsigned?: boolean; partial?: boolean } = {}) {
  const firms = Array.from({ length: firmCount }, (_, i) => ({
    id: `firm-${i + 1}`,
    name: `Firm ${String.fromCharCode(65 + i)}`,
    invited: true,
    submitted: true,
    notes: "",
  }));
  const scores = firms.flatMap((f, fi) => [
    // Higher-numbered firms score lower, so rank follows the order given.
    { reviewerId: "rev-1", firmId: f.id, criterionId: "crit-1", value: 5 - fi * 0.25, comment: fi === 0 ? "Solid plan" : "", updatedAt: "" },
    { reviewerId: "rev-2", firmId: f.id, criterionId: "crit-1", value: 4 - fi * 0.25, comment: "", updatedAt: "" },
    { reviewerId: "rev-1", firmId: f.id, criterionId: "crit-2", value: 3, comment: "Pricey", updatedAt: "" },
    ...(opts.partial && fi === 0
      ? []
      : [{ reviewerId: "rev-2", firmId: f.id, criterionId: "crit-2", value: 4, comment: "", updatedAt: "" }]),
  ]);
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "Workspace Test",
      localGovContact: "Pat Contact",
      procurementAgent: "Sam Agent",
      committeeMeetingDate: "2026-10-30",
      notes: "",
    },
    scoringScale: [
      { value: 1, label: "Poor" },
      { value: 5, label: "Great" },
    ],
    scoringScaleMode: "continuous",
    criteria: [
      { id: "crit-1", name: "Approach", weight: 0.5, description: "" },
      { id: "crit-2", name: "Cost", weight: 0.5, description: "" },
    ],
    firms,
    reviewers: [
      { id: "rev-1", name: "Alice", type: "applicant", email: "", confidentialitySigned: !opts.unsigned },
      { id: "rev-2", name: "Bob", type: "wfrc", email: "", confidentialitySigned: true },
    ],
    scores,
  };
}

async function load(p: ReturnType<typeof project>) {
  render(<App />);
  openGetStartedModal();
  const file = new File([JSON.stringify(p)], "scored.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Upload a project file"), { target: { files: [file] } });
  await screen.findByRole("heading", { name: "Dashboard" });
}

const panelTabs = () => within(screen.getByRole("tablist", { name: "Firm detail" })).getAllByRole("tab");
const panelTab = (name: RegExp) =>
  within(screen.getByRole("tablist", { name: "Firm detail" })).getByRole("tab", { name });

describe("Dashboard — ranked firms list", () => {
  it("lists the firms in rank order with the top-ranked one selected", async () => {
    await load(project(3));
    expect(rankedFirmNames()).toEqual(["Firm A", "Firm B", "Firm C"]);
    expect(rankedFirm("Firm A").option).toHaveAttribute("aria-selected", "true");
    expect(rankedFirm("Firm B").option).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("region", { name: "Firm A detail" })).toBeInTheDocument();
  });

  it("shows the selected firm's detail when another firm is picked", async () => {
    await load(project(3));
    fireEvent.click(rankedFirm("Firm B").option);
    expect(rankedFirm("Firm B").option).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Firm B detail" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Firm A detail" })).not.toBeInTheDocument();
  });

  it("keeps the open tab when another firm is picked", async () => {
    await load(project(3));
    fireEvent.click(panelTab(/^Reviewer scores/));
    fireEvent.click(rankedFirm("Firm C").option);
    expect(panelTab(/^Reviewer scores/)).toHaveAttribute("aria-selected", "true");
  });

  it("uses one-line rows once there are many firms", async () => {
    await load(project(6));
    expect(screen.getByRole("listbox", { name: "Ranked firms" })).toHaveClass("is-compact");
  });

  it("keeps the roomier two-line rows for a handful of firms", async () => {
    await load(project(3));
    expect(screen.getByRole("listbox", { name: "Ranked firms" })).not.toHaveClass("is-compact");
  });

  it("flags a firm that is not fully scored, even in the one-line rows", async () => {
    await load(project(6, { partial: true }));
    expect(within(rankedFirm("Firm A").option).getByText(/scored/)).toBeInTheDocument();
  });
});

describe("Dashboard — firm detail tabs", () => {
  it("has Criterion breakdown, Comments (with a count) and Reviewer scores, opening on the breakdown", async () => {
    await load(project(2));
    expect(panelTabs().map((t) => t.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "Criterion breakdown",
      "Comments 2",
      "Reviewer scores",
    ]);
    expect(panelTab(/^Criterion breakdown/)).toHaveAttribute("aria-selected", "true");
  });

  it("shows how each criterion scored, with the weighted total", async () => {
    await load(project(2));
    const panel = screen.getByRole("region", { name: "Firm A detail" });
    const table = within(panel).getByRole("table");
    expect(within(table).getByText("Approach")).toBeInTheDocument();
    expect(within(table).getByText("Cost")).toBeInTheDocument();
    expect(within(table).getByText("Weighted total")).toBeInTheDocument();
  });
});

describe("Dashboard — reviewer scores heatmap", () => {
  it("shows each reviewer's score per criterion, grouped by reviewer type", async () => {
    await load(project(2));
    fireEvent.click(panelTab(/^Reviewer scores/));
    expect(screen.getByRole("button", { name: /^Alice, Approach: 5\./ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Bob, Approach: 4\./ })).toBeInTheDocument();
    expect(screen.getByText(/TLC Applicant reviewers/)).toBeInTheDocument();
    expect(screen.getByText(/WFRC reviewers/)).toBeInTheDocument();
  });

  it("colors cells on the same red-to-green scale as the Calculations heatmap", async () => {
    await load(project(2));
    fireEvent.click(panelTab(/^Reviewer scores/));
    const high = screen.getByRole("button", { name: /^Alice, Approach: 5\./ });
    const low = screen.getByRole("button", { name: /^Alice, Cost: 3\./ });
    // The top of the configured scale is the green end, the midpoint is yellow (heatmapColor.ts).
    expect(high.style.backgroundColor).toBe("rgb(120, 157, 75)");
    expect(low.style.backgroundColor).toBe("rgb(248, 185, 62)");
  });

  it("opens that criterion's comments when a cell is clicked", async () => {
    await load(project(2));
    fireEvent.click(panelTab(/^Reviewer scores/));
    fireEvent.click(screen.getByRole("button", { name: /^Alice, Cost: 3\./ }));
    expect(panelTab(/^Comments/)).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^Cost/ })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Dashboard — header", () => {
  it("names the project and shows its contacts", async () => {
    await load(project(2));
    expect(screen.getByRole("heading", { name: "Workspace Test" })).toBeInTheDocument();
    // The printed report repeats these in its own off-screen header, so look in the page header.
    const header = document.querySelector(".dash-header") as HTMLElement;
    expect(within(header).getByText("Pat Contact")).toBeInTheDocument();
    expect(within(header).getByText("Sam Agent")).toBeInTheDocument();
  });

  it("says when every reviewer has responded", async () => {
    await load(project(2));
    expect(screen.getByText("All reviewers responded")).toBeInTheDocument();
  });

  it("warns that results are partial, with the count, when scores are missing", async () => {
    await load(project(2, { partial: true }));
    expect(screen.getByRole("status")).toHaveTextContent(/Partial results: 7\/8 scores/);
  });

  it("names a reviewer who has not signed the confidentiality form", async () => {
    await load(project(2, { unsigned: true }));
    expect(screen.getByText(/Not signed: Alice/)).toBeInTheDocument();
  });

  it("keeps the toolbar's existing controls", async () => {
    await load(project(2));
    expect(screen.getByRole("button", { name: "Configure project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Excel workbook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export project JSON|Export JSON/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF report" })).toBeInTheDocument();
  });
});
