// Everything the formatted PDF report prints, worked out once from a Project — so the report
// document itself (ReportDocument.tsx) only lays things out and never calculates anything. Every
// number comes from the same lib/calculations.ts functions the Dashboard uses, so the report and
// the screen can never disagree. Pure and framework-free: no React, no DOM.
//
// The report supports a committee's discussion; it never names a "winner". Nothing in this model
// (or the wording built from it) treats the highest score as a selection decision.

import {
  applicantAvg,
  applicantWeightedTotal,
  completion,
  getRank,
  overallAvg,
  overallWeightedTotal,
  round2,
  wfrcAvg,
  wfrcWeightedTotal,
} from "../calculations";
import { formatIsoDate } from "../formatDate";
import type {
  Criterion,
  Firm,
  Project,
  ProjectInfo,
  Reviewer,
  ReviewerType,
  ScoringScaleMode,
  ScoringScalePoint,
} from "../../types/project";

export const REVIEWER_TYPE_LABEL: Record<ReviewerType, string> = {
  applicant: "TLC Applicant",
  wfrc: "WFRC",
};

export interface CriterionResult {
  criterion: Criterion;
  overall: number | null;
  applicant: number | null;
  wfrc: number | null;
}

export interface ReviewerScoreRow {
  reviewer: Reviewer;
  /** One entry per project criterion, in criterion order; null = not scored. */
  scores: (number | null)[];
  /** This reviewer's own weighted average across the criteria they scored. */
  total: number | null;
}

export interface ReviewerGroup {
  type: ReviewerType;
  label: string;
  rows: ReviewerScoreRow[];
  /** Per-criterion average of the group's scores (null when nobody in it scored). */
  averages: (number | null)[];
}

export interface CommentEntry {
  reviewerName: string;
  reviewerType: ReviewerType;
  value: number;
  text: string;
}

export interface CriterionComments {
  criterion: Criterion;
  entries: CommentEntry[];
}

export interface FirmReport {
  firm: Firm;
  rank: number;
  applicantRank: number;
  wfrcRank: number;
  overall: number;
  applicant: number;
  wfrc: number;
  /** False when no reviewer of that group has scored this firm: its total is then not a real
   * zero, and the report shows a dash instead. */
  hasApplicant: boolean;
  hasWfrc: boolean;
  /** Scores recorded / scores expected for this firm, across all criteria and reviewers. */
  scored: number;
  expected: number;
  criteria: CriterionResult[];
  strongest: CriterionResult | null;
  weakest: CriterionResult | null;
  /** The criterion where TLC Applicant and WFRC reviewers differ the most. */
  biggestGap: { result: CriterionResult; gap: number } | null;
  groups: ReviewerGroup[];
  /** Average of every scoring reviewer, per criterion (the footer row of the heatmap). */
  overallAverages: (number | null)[];
  comments: CriterionComments[];
  commentCount: number;
}

export interface ReportModel {
  projectName: string;
  info: ProjectInfo;
  meetingDate: string;
  generatedOn: string;
  scaleMode: ScoringScaleMode;
  scale: ScoringScalePoint[];
  scaleMin: number;
  scaleMax: number;
  criteria: Criterion[];
  weightTotal: number;
  reviewers: Reviewer[];
  /** Reviewers who haven't signed the confidentiality form (false only; "not recorded" is not a warning). */
  unsignedReviewers: Reviewer[];
  firms: FirmReport[];
  /** Invited firms that did not submit a proposal (so they are not scored). */
  notSubmitted: Firm[];
  /** Recorded scores / expected scores over every submitted firm. */
  scored: number;
  expected: number;
  isPartial: boolean;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildReportModel(project: Project, now: Date = new Date()): ReportModel {
  const scaleValues = project.scoringScale.map((p) => p.value);
  const scaleMin = scaleValues.length > 0 ? Math.min(...scaleValues) : 0;
  const scaleMax = scaleValues.length > 0 ? Math.max(...scaleValues) : 0;

  const submitted = project.firms.filter((f) => f.submitted);

  const firms: FirmReport[] = submitted
    .map((firm): FirmReport => {
      const scoreOf = (reviewerId: string, criterionId: string): number | null =>
        project.scores.find(
          (s) => s.firmId === firm.id && s.reviewerId === reviewerId && s.criterionId === criterionId,
        )?.value ?? null;

      const criteria: CriterionResult[] = project.criteria.map((criterion) => ({
        criterion,
        overall: overallAvg(project, firm.id, criterion.id),
        applicant: applicantAvg(project, firm.id, criterion.id),
        wfrc: wfrcAvg(project, firm.id, criterion.id),
      }));

      const scoredCriteria = criteria.filter((c) => c.overall !== null);
      const strongest = scoredCriteria.reduce<CriterionResult | null>(
        (best, c) => (best === null || (c.overall ?? 0) > (best.overall ?? 0) ? c : best),
        null,
      );
      const weakest = scoredCriteria.reduce<CriterionResult | null>(
        (worst, c) => (worst === null || (c.overall ?? 0) < (worst.overall ?? 0) ? c : worst),
        null,
      );
      const gaps = criteria.flatMap((c) =>
        c.applicant !== null && c.wfrc !== null ? [{ result: c, gap: c.applicant - c.wfrc }] : [],
      );
      const biggestGap = gaps.reduce<{ result: CriterionResult; gap: number } | null>(
        (best, g) => (best === null || Math.abs(g.gap) > Math.abs(best.gap) ? g : best),
        null,
      );

      const rowFor = (reviewer: Reviewer): ReviewerScoreRow => {
        const scores = project.criteria.map((c) => scoreOf(reviewer.id, c.id));
        let weighted = 0;
        let weights = 0;
        project.criteria.forEach((c, i) => {
          const v = scores[i];
          if (v !== null) {
            weighted += v * c.weight;
            weights += c.weight;
          }
        });
        return { reviewer, scores, total: weights > 0 ? weighted / weights : null };
      };

      // Only reviewers who scored this firm at all: an all-empty row says nothing about it.
      const scoredRows = project.reviewers
        .map(rowFor)
        .filter((row) => row.scores.some((v) => v !== null));

      const groups: ReviewerGroup[] = (["applicant", "wfrc"] as const)
        .map((type) => {
          const rows = scoredRows.filter((row) => row.reviewer.type === type);
          return {
            type,
            label: `${REVIEWER_TYPE_LABEL[type]} reviewers`,
            rows,
            averages: project.criteria.map((_, i) =>
              mean(rows.flatMap((row) => (row.scores[i] === null ? [] : [row.scores[i] as number]))),
            ),
          };
        })
        .filter((group) => group.rows.length > 0);

      const overallAverages = project.criteria.map((_, i) =>
        mean(scoredRows.flatMap((row) => (row.scores[i] === null ? [] : [row.scores[i] as number]))),
      );

      const comments: CriterionComments[] = project.criteria
        .map((criterion) => ({
          criterion,
          entries: project.reviewers.flatMap((reviewer): CommentEntry[] => {
            const score = project.scores.find(
              (s) =>
                s.firmId === firm.id && s.reviewerId === reviewer.id && s.criterionId === criterion.id,
            );
            const text = score?.comment.trim() ?? "";
            return score && text
              ? [{ reviewerName: reviewer.name, reviewerType: reviewer.type, value: score.value, text }]
              : [];
          }),
        }))
        .filter((c) => c.entries.length > 0);

      const comp = completion(project, firm.id);
      return {
        firm,
        rank: getRank(project, firm.id, "overall") ?? 0,
        applicantRank: getRank(project, firm.id, "applicant") ?? 0,
        wfrcRank: getRank(project, firm.id, "wfrc") ?? 0,
        overall: overallWeightedTotal(project, firm.id),
        applicant: applicantWeightedTotal(project, firm.id),
        wfrc: wfrcWeightedTotal(project, firm.id),
        hasApplicant: criteria.some((c) => c.applicant !== null),
        hasWfrc: criteria.some((c) => c.wfrc !== null),
        scored: comp.scored,
        expected: comp.expected,
        criteria,
        strongest,
        weakest,
        biggestGap,
        groups,
        overallAverages,
        comments,
        commentCount: comments.reduce((n, c) => n + c.entries.length, 0),
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const scored = firms.reduce((n, f) => n + f.scored, 0);
  const expected = firms.reduce((n, f) => n + f.expected, 0);

  return {
    projectName: project.project.projectName.trim() || "Untitled project",
    info: project.project,
    meetingDate: project.project.committeeMeetingDate
      ? formatIsoDate(project.project.committeeMeetingDate)
      : "",
    generatedOn: now.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
    scaleMode: project.scoringScaleMode,
    scale: [...project.scoringScale].sort((a, b) => a.value - b.value),
    scaleMin,
    scaleMax,
    criteria: project.criteria,
    weightTotal: round2(project.criteria.reduce((sum, c) => sum + c.weight, 0)),
    reviewers: project.reviewers,
    unsignedReviewers: project.reviewers.filter((r) => r.confidentialitySigned === false),
    firms,
    notSubmitted: project.firms.filter((f) => !f.submitted),
    scored,
    expected,
    isPartial: expected > 0 && scored < expected,
  };
}
