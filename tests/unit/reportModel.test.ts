// The formatted PDF report's data model: ranked order, per-firm criterion results, the reviewer
// heatmap grouping, comments, and the "dash, not zero" rule for a group that hasn't scored a firm.

import { describe, expect, it } from "vitest";
import { buildReportModel } from "../../src/lib/report/reportModel";
import type { Project } from "../../src/types/project";

function project(): Project {
  const score = (reviewerId: string, firmId: string, criterionId: string, value: number, comment = "") => ({
    reviewerId,
    firmId,
    criterionId,
    value,
    comment,
    updatedAt: "",
  });
  return {
    schemaVersion: "1.0",
    project: {
      projectName: "  Report Test  ",
      localGovContact: "Pat",
      procurementAgent: "",
      committeeMeetingDate: "2026-10-30",
      notes: "",
    },
    scoringScale: [
      { value: 5, label: "Great" },
      { value: 1, label: "Poor" },
    ],
    scoringScaleMode: "continuous",
    criteria: [
      { id: "c1", name: "Team", weight: 0.6, description: "" },
      { id: "c2", name: "Approach", weight: 0.4, description: "" },
    ],
    firms: [
      { id: "f1", name: "Lower Firm", invited: true, submitted: true, notes: "" },
      { id: "f2", name: "Top Firm", invited: true, submitted: true, notes: "" },
      { id: "f3", name: "No Bid", invited: true, submitted: false, notes: "Declined" },
    ],
    reviewers: [
      { id: "r1", name: "Ann", type: "applicant", email: "", confidentialitySigned: true },
      { id: "r2", name: "Bo", type: "wfrc", email: "", confidentialitySigned: false },
      { id: "r3", name: "Cy", type: "wfrc", email: "", confidentialitySigned: null },
    ],
    scores: [
      score("r1", "f1", "c1", 3, "ok team"),
      score("r1", "f1", "c2", 3),
      score("r1", "f2", "c1", 5, "  great team  "),
      score("r1", "f2", "c2", 4),
      score("r2", "f2", "c1", 4),
    ],
  };
}

describe("buildReportModel", () => {
  const model = buildReportModel(project(), new Date(2026, 10, 6));

  it("trims the project name and formats the dates", () => {
    expect(model.projectName).toBe("Report Test");
    expect(model.meetingDate).toContain("2026");
    expect(model.generatedOn).toContain("2026");
  });

  it("lists only submitted firms, in rank order, and the rest as not submitted", () => {
    expect(model.firms.map((f) => f.firm.name)).toEqual(["Top Firm", "Lower Firm"]);
    expect(model.firms.map((f) => f.rank)).toEqual([1, 2]);
    expect(model.notSubmitted.map((f) => f.name)).toEqual(["No Bid"]);
  });

  it("flags only reviewers who are recorded as unsigned", () => {
    expect(model.unsignedReviewers.map((r) => r.name)).toEqual(["Bo"]);
  });

  it("counts recorded vs expected scores and reports partial results", () => {
    // 2 firms x 2 criteria x 3 reviewers = 12 expected; 5 recorded.
    expect(model.expected).toBe(12);
    expect(model.scored).toBe(5);
    expect(model.isPartial).toBe(true);
  });

  it("shows a dash-worthy flag when a group has not scored a firm", () => {
    const lower = model.firms.find((f) => f.firm.name === "Lower Firm")!;
    expect(lower.hasApplicant).toBe(true);
    expect(lower.hasWfrc).toBe(false);
    const top = model.firms[0];
    expect(top.hasWfrc).toBe(true);
  });

  it("groups reviewers who scored the firm and averages each group per criterion", () => {
    const top = model.firms[0];
    expect(top.groups.map((g) => g.type)).toEqual(["applicant", "wfrc"]);
    expect(top.groups[1].rows.map((r) => r.reviewer.name)).toEqual(["Bo"]);
    expect(top.groups[0].averages).toEqual([5, 4]);
    expect(top.groups[1].averages).toEqual([4, null]);
    expect(top.overallAverages).toEqual([4.5, 4]);
  });

  it("collects non-empty comments by criterion with the reviewer and score", () => {
    const top = model.firms[0];
    expect(top.commentCount).toBe(1);
    expect(top.comments[0].criterion.name).toBe("Team");
    expect(top.comments[0].entries[0]).toMatchObject({ reviewerName: "Ann", value: 5, text: "great team" });
  });

  it("finds the strongest, weakest and largest-gap criteria", () => {
    const top = model.firms[0];
    expect(top.strongest?.criterion.name).toBe("Team");
    expect(top.weakest?.criterion.name).toBe("Approach");
    expect(top.biggestGap?.result.criterion.name).toBe("Team");
    expect(top.biggestGap?.gap).toBe(1);
  });
});
