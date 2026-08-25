// T028: Scoring scale editor — add/edit/remove scale points (value + label), enforcing a
// minimum of 2 points (FR-011). Unlike the weight-sum warning (non-blocking, FR-010),
// the 2-point minimum is a hard floor — a 1-point scale can't meaningfully score
// anything — so removal is disabled rather than merely warned about once only 2 remain.
//
// Bug fix #1 (render/reconciliation): this used to render `[...project.scoringScale].sort(
// (a, b) => a.value - b.value)` and key each row `key={point.value}`. `ScoringScalePoint`
// has no `id` (data-model.md: matched by `value` on purpose — that's also the project.json
// shape, contracts/project-file.md), so `value` looked like the only candidate key. But
// `value` is exactly the field the Score input edits — changing it both (a) changed the
// row's React key, making React unmount/remount the row instead of updating it in place,
// and (b) changed its position in the live-resorted list, so the "new" element appeared to
// jump elsewhere. Together this read as "editing adds a new row."
//
// Fix: don't resort on every render — render project.scoringScale in its stored
// (insertion) order, same as FirmsEditor/ReviewersEditor/CriteriaEditor render their lists,
// and key each row by its position in that stable order (`key={index}` below) instead of
// by `value` — the same role `id` plays in the other three editors, just without
// persisting one to the data model.
//
// Bug fix #2 (reducer, found later — a real report, not a hypothetical): fixing #1 was not
// enough, because UPDATE_SCALE_POINT/REMOVE_SCALE_POINT *themselves* still identified which
// point to act on by `value` (dispatching `{ value: point.value, patch }` and matching with
// `p.value === action.value` in projectReducer.ts). Two points holding the same `value` —
// even just transiently, mid-edit (e.g. typing "10" over an existing "4" passes through an
// intermediate "1", which can collide with another row that's already 1) — meant `.map()`/
// `.filter()` matched and mutated/removed BOTH of them at once, not just the row being
// edited: a genuine user report of "editing row 4 to 10 also changed an unrelated row that
// happened to be 1." Fixed the same way as #1: both actions now carry `index` instead of
// `value`, so identity can never collide regardless of what value a point transiently
// holds — see projectReducer.ts's own comment on those two cases.
//
// Duplicate-value warning: added alongside bug fix #2 above, once fixing the reducer made
// it obvious duplicate values were both possible and previously silently corrupting.
// Non-blocking, same convention as FirmsEditor/ReviewersEditor's duplicate-NAME warning —
// see the const below for why VALUES are the analogous concern here, not labels.
//
// Value precision: every point value is capped to one decimal place on commit
// (roundToOneDecimal — the same rounding lib/scoreScale.ts already applies to reviewers'
// own scores in continuous mode, reused here for the scale's own reference points). Above
// that shared cap, DISPLAY formatting is mode-aware:
//  - Continuous mode always shows one decimal place (e.g. "3.0"), even for a point nobody
//    has typed a fraction into — every value along a continuous range is equally precise,
//    so there's no "plain" state to fall back to.
//  - Discrete mode shows plain integers by default (nothing to round away), UNLESS any
//    point in the scale genuinely has a fractional value, in which case EVERY point
//    switches to showing one decimal place — a scale mixing "3" and "2.5" reads as if the
//    "3" is somehow less precise than the "2.5", when they're actually the same kind of
//    value; showing "3.0" instead makes that parity visible. This can only ever be
//    triggered by an actual fractional edit — nothing coerces a whole-number scale into
//    decimal display on its own.
// ScalePointValueCell below is a draft-state, commit-on-blur input (same pattern as
// CriteriaEditor's WeightCell and ManualEntryGrid's ContinuousScoreCell) rather than a
// directly-dispatching one — rounding/reformatting on every keystroke would corrupt an
// in-progress "2." before a handler can finish typing "2.5".
//
// Discrete vs. continuous (lib/scoreScale.ts): the points table below is otherwise
// IDENTICAL either way — add/remove/edit value+label, same 2-point floor — because in
// continuous mode those points are labeled reference anchors along the range rather than a
// restrictive list, not a different data shape. Only the mode toggle above the table, the
// value-precision display rule above, and how downstream consumers (generateWorkbook.ts,
// parseWorkbook.ts, ManualEntryGrid.tsx) validate a Score against it, differ.

import { useState } from "react";
import { findDuplicateNames } from "../../lib/duplicateNames";
import { roundToOneDecimal } from "../../lib/scoreScale";
import { useLoadedProject } from "../../state/ProjectContext";
import type { ScoringScaleMode } from "../../types/project";

const MIN_SCALE_POINTS = 2;

function ScalePointValueCell({
  value,
  forceOneDecimal,
  onCommit,
}: {
  value: number;
  forceOneDecimal: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? (forceOneDecimal ? value.toFixed(1) : String(value));

  function commit() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) onCommit(roundToOneDecimal(parsed));
      // else: non-numeric text discarded, snaps back to the last-committed display below.
    }
    // Empty text is also discarded rather than coerced to 0 — a scale point always needs a
    // real value, so clearing the field just reverts it instead of silently zeroing it.
    setDraft(null);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Scale point value"
      value={displayValue}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

export function ScoringScaleEditor() {
  const { project, dispatch } = useLoadedProject();
  const canRemove = project.scoringScale.length > MIN_SCALE_POINTS;
  const mode = project.scoringScaleMode;
  const sortedValues = [...project.scoringScale.map((p) => p.value)].sort((a, b) => a - b);
  const scaleMin = sortedValues[0];
  const scaleMax = sortedValues[sortedValues.length - 1];

  // Non-blocking, same convention as FirmsEditor/ReviewersEditor's identical duplicate-name
  // check (see FirmsEditor for the full rationale) — reused here for VALUES rather than
  // names, since two scale points sharing a value is the same kind of ambiguity: a score of
  // that number could mean either point's label. data-model.md documents values as required
  // to be unique, but nothing currently enforces it, so this is a real gap worth surfacing,
  // not just a hypothetical one — it's also exactly the condition the reducer bug fixed
  // above used to mishandle (see bug fix #2), so a handler who hits this warning is worth
  // steering away from the situation entirely, not just protecting once they're in it.
  const duplicateValues = findDuplicateNames(project.scoringScale.map((p) => String(p.value)));

  // See this file's header comment on value precision — continuous mode always shows one
  // decimal; discrete mode only switches to it once some point genuinely has one.
  const forceOneDecimal =
    mode === "continuous" || project.scoringScale.some((p) => !Number.isInteger(p.value));

  function nextDefaultValue(): number {
    if (project.scoringScale.length === 0) return 1;
    return Math.max(...project.scoringScale.map((p) => p.value)) + 1;
  }

  function setMode(next: ScoringScaleMode) {
    dispatch({ type: "SET_SCORING_SCALE_MODE", mode: next });
  }

  return (
    <div className="card">
      <h2>Scoring Scale</h2>

      {duplicateValues.size > 0 && (
        <div className="banner banner-warning" role="alert">
          Duplicate value{duplicateValues.size > 1 ? "s" : ""}:{" "}
          {[...duplicateValues.entries()]
            .map(([value, count]) => `"${value}" is used by ${count} points`)
            .join("; ")}{" "}
          — give each point a distinct value so a score of that number always means one
          specific label (this does not block saving).
        </div>
      )}

      <fieldset className="scale-mode-toggle">
        <legend>Scale type</legend>
        <div className="scale-mode-toggle-options">
          <label>
            <input
              type="radio"
              name="scoringScaleMode"
              value="discrete"
              checked={mode === "discrete"}
              onChange={() => setMode("discrete")}
            />
            Discrete — reviewers pick one of the listed values
          </label>
          <label>
            <input
              type="radio"
              name="scoringScaleMode"
              value="continuous"
              checked={mode === "continuous"}
              onChange={() => setMode("continuous")}
            />
            Continuous — reviewers may enter any value between the lowest and highest listed
            values, in steps of 0.1
          </label>
        </div>
      </fieldset>

      {mode === "continuous" && project.scoringScale.length >= MIN_SCALE_POINTS && (
        <p className="field-hint">
          The listed values below are labeled reference points, not the only choices —
          reviewers may enter anything from {scaleMin} to {scaleMax} (e.g. {scaleMin + 0.1}
          ), rounded to one decimal place.
        </p>
      )}

      {project.scoringScale.length <= MIN_SCALE_POINTS && (
        <p className="field-hint">At least {MIN_SCALE_POINTS} points are required.</p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Label</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {project.scoringScale.map((point, index) => (
              <tr key={index}>
                <td>
                  <ScalePointValueCell
                    value={point.value}
                    forceOneDecimal={forceOneDecimal}
                    onCommit={(value) =>
                      dispatch({ type: "UPDATE_SCALE_POINT", index, patch: { value } })
                    }
                  />
                </td>
                <td>
                  <input
                    type="text"
                    aria-label="Scale point label"
                    value={point.label}
                    onChange={(e) =>
                      dispatch({
                        type: "UPDATE_SCALE_POINT",
                        index,
                        patch: { label: e.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={!canRemove}
                    title={
                      canRemove ? undefined : `At least ${MIN_SCALE_POINTS} points are required`
                    }
                    onClick={() => dispatch({ type: "REMOVE_SCALE_POINT", index })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() =>
            dispatch({ type: "ADD_SCALE_POINT", point: { value: nextDefaultValue(), label: "" } })
          }
        >
          Add scale point
        </button>
      </div>
    </div>
  );
}
