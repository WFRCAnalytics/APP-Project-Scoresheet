// T047/T048: Manual entry grid — a spreadsheet-like fallback for when a reviewer reports
// scores back informally rather than returning the generated workbook (FR-024). Same
// flat (firm, criterion) row shape as the Excel Scoring sheet
// (contracts/reviewer-workbook.md), for a selected reviewer, covering every submitted
// firm × criterion cell.
//
// Score-value validation (FR-024's "applying the same score-value validation" as
// parseWorkbook.ts, via the shared lib/scoreScale.ts both now go through): discrete mode's
// Score input is a native <select> constrained to exactly the project's configured scale
// values — structurally impossible to enter an out-of-scale value through this UI, a
// stronger guarantee than parseWorkbook.ts's runtime check needs to be (that one defends
// against a workbook edited outside its own dropdown's constraint; this grid has no such
// external-edit surface). Continuous mode's Score input is a free-text field instead (a
// dropdown can't offer "any value," only a fixed list) — normalizeScoreValue() enforces the
// same range-and-round-to-one-decimal rule on commit that parseWorkbook.ts applies on
// import, so the two entry paths can't drift on what a valid continuous score is.
//
// Commit path (T048): every change dispatches the exact same `UPSERT_SCORES` reducer
// action `ImportScoresPanel.tsx` uses to commit imported rows — not a separate update
// mechanism — so a later workbook import for the same reviewer/firm/criterion cell
// overwrites a manually entered value through the identical code path, per FR-023's
// overwrite rule and spec Story 5 Acceptance Scenario 2. There is no separate "save"
// step here (unlike import's review-then-confirm flow, FR-022) — direct entry commits
// immediately, matching the Configuration editors' own direct-dispatch pattern.
//
// Two layouts share all of that: "table" (every firm's rows in one table, with its own reviewer
// picker — the Calculations dialog's Manual Entry tab) and "tabs" (the Reviewer Forms work area:
// the reviewer comes from the roster, one firm at a time, a score and a roomy comment box per
// criterion).

import { useState } from "react";
import { ScrollableTabs } from "../../components/ScrollableTabs";
import { scrollableTabId } from "../../components/scrollableTabId";
import { SelectField } from "../../components/SelectField";
import { normalizeScoreValue, scaleRange } from "../../lib/scoreScale";
import { useLoadedProject } from "../../state/ProjectContext";
import type { Project, Score } from "../../types/project";

interface CellDraft {
  value: number | "";
  comment: string;
}

function cellKey(firmId: string, criterionId: string): string {
  return `${firmId}:${criterionId}`;
}

/** Continuous mode's Score cell — a free-text field with its own local draft buffer, not
 * `value`/`onCommit` reflected straight through on every keystroke, so a handler can type
 * transitional text ("3.") without each character re-formatting the field out from under
 * them. Commits (normalizes + calls `onCommit`) on blur; unparseable or out-of-range text
 * reverts to the last-committed value instead of being stored, same pattern
 * CriteriaEditor's WeightCell uses for its own free-text-but-numeric field. */
function ContinuousScoreCell({
  project,
  value,
  ariaLabel,
  onCommit,
}: {
  project: Project;
  value: number | "";
  ariaLabel: string;
  onCommit: (value: number | "") => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? (value === "" ? "" : String(value));

  function commit() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit("");
    } else {
      const parsed = Number(trimmed);
      const normalized = Number.isFinite(parsed) ? normalizeScoreValue(project, parsed) : null;
      if (normalized !== null) onCommit(normalized);
      // else: invalid/out-of-range text is discarded, snapping back to the last-committed
      // value below rather than storing it.
    }
    setDraft(null);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={displayValue}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

export interface ManualEntryGridProps {
  /** The reviewer whose scores this grid edits — the Reviewer Forms roster picks them. Remount
   * with a new `key` to load another reviewer's scores into it. */
  reviewerId: string;
}

/** One Score control for a (reviewer, firm, criterion): a dropdown of the scale in discrete
 * mode, a free-text field in continuous mode. */
function ScoreControl({
  project,
  value,
  ariaLabel,
  onChange,
}: {
  project: Project;
  value: number | "";
  ariaLabel: string;
  onChange: (value: number | "") => void;
}) {
  const scaleOptions = [...project.scoringScale].sort((a, b) => a.value - b.value);
  if (project.scoringScaleMode === "discrete") {
    return (
      <SelectField
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      >
        <option value="">—</option>
        {scaleOptions.map((point) => (
          <option key={point.value} value={point.value}>
            {point.value} — {point.label}
          </option>
        ))}
      </SelectField>
    );
  }
  return (
    <ContinuousScoreCell
      project={project}
      value={value}
      ariaLabel={ariaLabel}
      onCommit={onChange}
    />
  );
}

export function ManualEntryGrid({ reviewerId }: ManualEntryGridProps) {
  const { project, dispatch } = useLoadedProject();
  const submittedFirms = project.firms.filter((f) => f.submitted);
  const [activeFirmId, setActiveFirmId] = useState<string | null>(null);

  /** Seeds cell drafts from a given reviewer's existing scores. */
  function buildDraftsFor(forReviewerId: string): Record<string, CellDraft> {
    const drafts: Record<string, CellDraft> = {};
    for (const firm of submittedFirms) {
      for (const criterion of project.criteria) {
        const existing = project.scores.find(
          (s) =>
            s.reviewerId === forReviewerId &&
            s.firmId === firm.id &&
            s.criterionId === criterion.id,
        );
        drafts[cellKey(firm.id, criterion.id)] = {
          value: existing?.value ?? "",
          comment: existing?.comment ?? "",
        };
      }
    }
    return drafts;
  }

  // Local draft state, keyed by "firmId:criterionId", initialized from whatever this
  // reviewer has already scored (a new reviewer remounts the grid — see ManualEntryGridProps).
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>(() => buildDraftsFor(reviewerId));

  function commitCell(firmId: string, criterionId: string, draft: CellDraft) {
    if (draft.value === "") return; // nothing to commit until a score is chosen
    const score: Score = {
      reviewerId,
      firmId,
      criterionId,
      value: draft.value,
      comment: draft.comment,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "UPSERT_SCORES", scores: [score] });
  }

  function updateDraft(firmId: string, criterionId: string, patch: Partial<CellDraft>) {
    const key = cellKey(firmId, criterionId);
    setDrafts((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      commitCell(firmId, criterionId, next[key]);
      return next;
    });
  }

  const { min: scaleMin, max: scaleMax } = scaleRange(project);

  if (project.reviewers.length === 0) {
    return <p className="field-hint">No reviewers configured yet.</p>;
  }
  if (submittedFirms.length === 0 || project.criteria.length === 0) {
    return (
      <p className="field-hint">
        Add submitted firms and criteria before entering scores manually.
      </p>
    );
  }

  const scaleHint =
    project.scoringScaleMode === "continuous" ? (
      <p className="field-hint">
        Continuous scale — enter any value from {scaleMin} to {scaleMax}, rounded to one decimal
        place.
      </p>
    ) : null;

  // Falls back to the first firm if the active one was since un-submitted or removed.
  const firm = submittedFirms.find((f) => f.id === activeFirmId) ?? submittedFirms[0];
  const filledFor = (firmId: string) =>
    project.criteria.filter(
      (c) =>
        drafts[cellKey(firmId, c.id)]?.value !== "" && drafts[cellKey(firmId, c.id)] !== undefined,
    ).length;
  const idPrefix = "manual-entry-firm";
  const panelId = `${idPrefix}-panel`;
  return (
    <div className="manual-entry manual-entry--tabs" aria-label="Manual Score Entry">
      {scaleHint}
      <ScrollableTabs
        tabs={submittedFirms.map((f) => ({ id: f.id, label: f.name, badge: filledFor(f.id) }))}
        activeId={firm.id}
        onSelect={setActiveFirmId}
        ariaLabel="Firms"
        idPrefix={idPrefix}
        panelId={panelId}
      />
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={scrollableTabId(idPrefix, firm.id)}
        className="entry-rows"
      >
        <div className="entry-row entry-row--head" aria-hidden="true">
          <span>Criterion</span>
          <span>Score</span>
          <span>Comment</span>
        </div>
        {project.criteria.map((criterion) => {
          const key = cellKey(firm.id, criterion.id);
          const draft = drafts[key] ?? { value: "", comment: "" };
          return (
            <div className="entry-row" key={key}>
              <div className="entry-criterion">
                <span className="entry-criterion-name">{criterion.name}</span>
                <span className="entry-criterion-weight">
                  {Math.round(criterion.weight * 10000) / 100}% of total
                </span>
              </div>
              <div className="entry-score">
                <ScoreControl
                  project={project}
                  value={draft.value}
                  ariaLabel={`Score for ${firm.name} / ${criterion.name}`}
                  onChange={(value) => updateDraft(firm.id, criterion.id, { value })}
                />
              </div>
              <textarea
                className="entry-comment"
                placeholder="Comment (optional)"
                aria-label={`Comments for ${firm.name} / ${criterion.name}`}
                value={draft.comment}
                onChange={(e) => updateDraft(firm.id, criterion.id, { comment: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
