// Focused editor for ONE existing score — opened from the pencil on a row of the Dashboard's
// comments table, so a handler reading "Alice, Approach: …" can fix that score or its comment
// right there instead of going Show calculations -> Manual Entry -> pick reviewer -> find the
// row. Shows which (firm, criterion, reviewer) it is, read-only, plus the two editable fields.
//
// Saves through the same UPSERT_SCORES action Manual Entry and workbook import use, and
// validates the score with the same lib/scoreScale.ts rules, so the three entry paths can't
// drift on what a valid score is. Nothing is written until "Update"; Cancel / Esc / clicking
// outside discard the edit. Because a changed score moves the rankings, changing the numeric
// value asks for one confirmation first ("from 3 to 5?"); a comment-only change saves
// directly, and an Update that changed nothing just closes without touching updatedAt.

import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Modal } from "../../components/Modal";
import { SelectField } from "../../components/SelectField";
import { normalizeScoreValue, scaleRange } from "../../lib/scoreScale";
import { useLoadedProject } from "../../state/ProjectContext";

export interface ScoreTarget {
  reviewerId: string;
  firmId: string;
  criterionId: string;
}

export interface EditScoreDialogProps {
  target: ScoreTarget;
  onClose: () => void;
}

export function EditScoreDialog({ target, onClose }: EditScoreDialogProps) {
  const { project, dispatch } = useLoadedProject();
  const existing = project.scores.find(
    (s) =>
      s.reviewerId === target.reviewerId &&
      s.firmId === target.firmId &&
      s.criterionId === target.criterionId,
  );
  const reviewer = project.reviewers.find((r) => r.id === target.reviewerId);
  const firm = project.firms.find((f) => f.id === target.firmId);
  const criterion = project.criteria.find((c) => c.id === target.criterionId);

  const originalValue = existing?.value ?? null;
  const originalComment = existing?.comment ?? "";
  const [scoreText, setScoreText] = useState(originalValue === null ? "" : String(originalValue));
  const [comment, setComment] = useState(originalComment);
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState<number | null>(null);

  // The row being edited was removed (e.g. its reviewer was deleted) between opening and now.
  if (!reviewer || !firm || !criterion) return null;

  const discrete = project.scoringScaleMode === "discrete";
  const { min, max } = scaleRange(project);
  const options = [...project.scoringScale].sort((a, b) => a.value - b.value);
  // A saved score that is no longer on the configured scale (scale edited afterwards) stays
  // selectable, so a comment-only edit doesn't force the score to change.
  const offScale = originalValue !== null && !options.some((o) => o.value === originalValue);

  /** The score to store, or null (with `error` set) if the field isn't valid. */
  function resolveScore(): number | null {
    const text = scoreText.trim();
    if (text === "") {
      setError("Enter a score.");
      return null;
    }
    const parsed = Number(text);
    // Unchanged from what is already saved is always acceptable, even if it predates the
    // current scale.
    if (Number.isFinite(parsed) && parsed === originalValue) return parsed;
    const normalized = Number.isFinite(parsed) ? normalizeScoreValue(project, parsed) : null;
    if (normalized === null) {
      setError(
        discrete ? "Choose one of the scale values." : `Enter a value from ${min} to ${max}.`,
      );
      return null;
    }
    return normalized;
  }

  function save(value: number) {
    dispatch({
      type: "UPSERT_SCORES",
      scores: [
        {
          reviewerId: target.reviewerId,
          firmId: target.firmId,
          criterionId: target.criterionId,
          value,
          comment,
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = resolveScore();
    if (value === null) return;

    if (value === originalValue && comment === originalComment) {
      onClose(); // nothing changed — don't rewrite the score or its updatedAt
      return;
    }
    if (originalValue !== null && value !== originalValue) {
      setPendingValue(value); // the numeric score changed — confirm before it moves rankings
      return;
    }
    save(value);
  }

  const scoreLabel = `Score for ${firm.name} / ${criterion.name}`;

  return (
    <>
      {/* The edit dialog steps aside (not stacked under) while the confirm is up, so Escape
          only ever closes the one dialog on top. Its field state is kept, so cancelling the
          confirm returns to the form exactly as it was. */}
      <Modal
        open={pendingValue === null}
        onClose={onClose}
        ariaLabelledBy="edit-score-title"
        size="md"
      >
        <h2 id="edit-score-title">Edit score and comment</h2>
        <dl className="edit-score-summary">
          <dt>Firm</dt>
          <dd>{firm.name}</dd>
          <dt>Criterion</dt>
          <dd>{criterion.name}</dd>
          <dt>Reviewer</dt>
          <dd>{reviewer.name || "Unnamed reviewer"}</dd>
        </dl>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="edit-score-value">Score</label>
            {discrete ? (
              <SelectField
                id="edit-score-value"
                aria-label={scoreLabel}
                value={scoreText}
                onChange={(e) => setScoreText(e.target.value)}
              >
                {offScale && (
                  <option value={String(originalValue)}>
                    {originalValue} — not on the current scale
                  </option>
                )}
                {options.map((point) => (
                  <option key={point.value} value={String(point.value)}>
                    {point.value} — {point.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <>
                <input
                  id="edit-score-value"
                  type="text"
                  inputMode="decimal"
                  aria-label={scoreLabel}
                  value={scoreText}
                  autoFocus
                  onChange={(e) => setScoreText(e.target.value)}
                />
                <p className="field-hint">
                  Any value from {min} to {max}, rounded to one decimal place.
                </p>
              </>
            )}
          </div>

          <div className="field">
            <label htmlFor="edit-score-comment">Comment</label>
            <textarea
              id="edit-score-comment"
              rows={4}
              aria-label={`Comment for ${firm.name} / ${criterion.name}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {error && (
            <p className="banner banner-error" role="alert">
              {error}
            </p>
          )}

          <div className="edit-score-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              Update
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingValue !== null}
        title="Change this score?"
        message={
          <>
            Change {reviewer.name || "this reviewer"}&apos;s score for {criterion.name} ({firm.name}
            ) from {originalValue} to {pendingValue}? This changes the firm&apos;s totals and
            ranking.
          </>
        }
        confirmLabel="Change score"
        confirmVariant="primary"
        onCancel={() => setPendingValue(null)}
        onConfirm={() => {
          if (pendingValue !== null) save(pendingValue);
        }}
      />
    </>
  );
}
