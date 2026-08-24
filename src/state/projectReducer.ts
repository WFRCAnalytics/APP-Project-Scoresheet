// T014: The reducer half of ProjectContext, kept in its own module so it's testable
// without React. Actions cover every CRUD operation from FR-005–FR-011, plus the
// overwrite-on-import rule (FR-023) and the criterion/reviewer deletion-with-orphaned-
// scores behavior (FR-039, FR-041). Firm deletion (FR-007) follows the identical pattern.
//
// No Redux/Zustand — this is plain React `useReducer` state (research.md §5), scoped to
// exactly one in-memory `Project` at a time (constitution Principle III).

import type {
  Criterion,
  Firm,
  Project,
  ProjectInfo,
  Reviewer,
  Score,
  ScoringScaleMode,
  ScoringScalePoint,
} from "../types/project";

export type ProjectState = Project | null;

export type ProjectAction =
  | { type: "SET_PROJECT"; project: Project }
  | { type: "CLEAR_PROJECT" }
  | { type: "UPDATE_PROJECT_INFO"; info: Partial<ProjectInfo> }
  | { type: "ADD_FIRM"; firm: Firm }
  | { type: "UPDATE_FIRM"; firmId: string; patch: Partial<Omit<Firm, "id">> }
  | { type: "REMOVE_FIRM"; firmId: string }
  | { type: "ADD_REVIEWER"; reviewer: Reviewer }
  | { type: "UPDATE_REVIEWER"; reviewerId: string; patch: Partial<Omit<Reviewer, "id">> }
  | { type: "REMOVE_REVIEWER"; reviewerId: string }
  | { type: "ADD_CRITERION"; criterion: Criterion }
  | { type: "UPDATE_CRITERION"; criterionId: string; patch: Partial<Omit<Criterion, "id">> }
  | { type: "REMOVE_CRITERION"; criterionId: string }
  | { type: "ADD_SCALE_POINT"; point: ScoringScalePoint }
  | { type: "UPDATE_SCALE_POINT"; value: number; patch: Partial<ScoringScalePoint> }
  | { type: "REMOVE_SCALE_POINT"; value: number }
  | { type: "SET_SCORING_SCALE_MODE"; mode: ScoringScaleMode }
  /** Upserts one or more scores, matched and overwritten by (reviewerId, firmId,
   * criterionId) — the single code path both workbook import and manual entry funnel
   * through, so FR-023's overwrite rule can never drift between the two entry methods. */
  | { type: "UPSERT_SCORES"; scores: Score[] };

function upsertScores(existing: Score[], incoming: Score[]): Score[] {
  const next = [...existing];
  for (const score of incoming) {
    const index = next.findIndex(
      (s) =>
        s.reviewerId === score.reviewerId &&
        s.firmId === score.firmId &&
        s.criterionId === score.criterionId,
    );
    if (index === -1) {
      next.push(score);
    } else {
      next[index] = score;
    }
  }
  return next;
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  if (action.type === "SET_PROJECT") return action.project;
  if (action.type === "CLEAR_PROJECT") return null;

  // Every other action requires a loaded project; if none is loaded, ignore rather than
  // throw — a stray dispatch before load shouldn't crash the app.
  if (!state) return state;

  switch (action.type) {
    case "UPDATE_PROJECT_INFO":
      return { ...state, project: { ...state.project, ...action.info } };

    case "ADD_FIRM":
      return { ...state, firms: [...state.firms, action.firm] };
    case "UPDATE_FIRM":
      return {
        ...state,
        firms: state.firms.map((f) => (f.id === action.firmId ? { ...f, ...action.patch } : f)),
      };
    case "REMOVE_FIRM":
      // FR-007: confirmation happens in the UI layer before this is dispatched. Orphaned
      // scores are intentionally left in place — lib/calculations.ts filters them out.
      return { ...state, firms: state.firms.filter((f) => f.id !== action.firmId) };

    case "ADD_REVIEWER":
      return { ...state, reviewers: [...state.reviewers, action.reviewer] };
    case "UPDATE_REVIEWER":
      return {
        ...state,
        reviewers: state.reviewers.map((r) =>
          r.id === action.reviewerId ? { ...r, ...action.patch } : r,
        ),
      };
    case "REMOVE_REVIEWER":
      // FR-041: same confirm-then-orphan pattern as firms/criteria.
      return { ...state, reviewers: state.reviewers.filter((r) => r.id !== action.reviewerId) };

    case "ADD_CRITERION":
      return { ...state, criteria: [...state.criteria, action.criterion] };
    case "UPDATE_CRITERION":
      return {
        ...state,
        criteria: state.criteria.map((c) =>
          c.id === action.criterionId ? { ...c, ...action.patch } : c,
        ),
      };
    case "REMOVE_CRITERION":
      // FR-039: same confirm-then-orphan pattern.
      return { ...state, criteria: state.criteria.filter((c) => c.id !== action.criterionId) };

    case "ADD_SCALE_POINT":
      return { ...state, scoringScale: [...state.scoringScale, action.point] };
    case "UPDATE_SCALE_POINT":
      return {
        ...state,
        scoringScale: state.scoringScale.map((p) =>
          p.value === action.value ? { ...p, ...action.patch } : p,
        ),
      };
    case "REMOVE_SCALE_POINT":
      return {
        ...state,
        scoringScale: state.scoringScale.filter((p) => p.value !== action.value),
      };
    case "SET_SCORING_SCALE_MODE":
      // Switching modes never touches scoringScale or scores — a raw Score.value is just a
      // number either way (lib/scoreScale.ts), and the configured points remain meaningful
      // as either an exact-match list (discrete) or labeled anchors (continuous).
      return { ...state, scoringScaleMode: action.mode };

    case "UPSERT_SCORES":
      return { ...state, scores: upsertScores(state.scores, action.scores) };

    default:
      return state;
  }
}

/** Whether a firm has any score entries attached — gates the FR-007 confirmation prompt. */
export function firmHasScores(project: Project, firmId: string): boolean {
  return project.scores.some((s) => s.firmId === firmId);
}

/** Whether a reviewer has any score entries attached — gates the FR-041 confirmation prompt. */
export function reviewerHasScores(project: Project, reviewerId: string): boolean {
  return project.scores.some((s) => s.reviewerId === reviewerId);
}

/** Whether a criterion has any score entries attached — gates the FR-039 confirmation prompt. */
export function criterionHasScores(project: Project, criterionId: string): boolean {
  return project.scores.some((s) => s.criterionId === criterionId);
}
