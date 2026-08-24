// Criterion weight input parsing — lets the Criteria & Weights editor's weight field accept
// either a decimal fraction (0.25) or a percent (25 or 25%) in the same free-text box, rather
// than forcing the handler to think in only one convention. Criterion.weight itself is
// UNCHANGED: still a plain fractional number, 0..1, summing to ~1.0 across criteria (FR-010,
// data-model.md) — this module only widens what typed text CriteriaEditor's input will accept
// before committing to that number, and formats it back as a percent for the inline "= 60%"
// confirmation readout next to the field.
//
// Research behind the disambiguation rule below (see conversation/commit history for the full
// writeup): neither Excel nor Google Sheets actually infer percent-vs-decimal from a number's
// size — a percent-formatted cell always divides whatever raw number you type by 100, and the
// one fully unambiguous override in either tool is an explicit "%" sign. RFP-scoring templates
// in the wild (Responsive, GateKeeper, nvelop) also lean toward weights expressed as whole
// percents summing to 100% as the more natural convention for this exact domain, not raw
// decimals — which is why a bare number here defaults toward "percent typed without the sign"
// once it's too big to be a literal fraction, rather than the reverse.
//
// Disambiguation rule, in priority order:
//   1. An explicit trailing "%" always means percent, regardless of magnitude — "0.5%" is
//      0.005, not 0.5, exactly like typing "0.5%" into a percent-formatted spreadsheet cell.
//      This is the one fully unambiguous signal available in free text, so it always wins.
//   2. Without "%", a bare number > 1 cannot be a legitimate single-criterion decimal weight
//      (weights sum to 1.0 across ALL criteria — FR-010 — so no individual one can literally
//      exceed 1) — it's almost always someone typing "60" meaning 60%, so it's divided by 100.
//   3. A bare number <= 1 is taken at face value as the literal decimal fraction. This is both
//      the existing on-disk convention (every already-saved project.json — FR-010) and the
//      more common real case (typing "0.25", or "1" for a single criterion at 100%). A
//      deliberately small explicit rule, not an "integers are always percent" heuristic: a
//      bare "1" legitimately means a sole criterion weighted at 100%, so treating every
//      integer as a percent would silently break that common, valid case. A handler who really
//      means a sub-1% weight (e.g. "0.5%") has to say so with the "%" sign — there's no
//      reliable way to infer that intent from "0.5" alone, and guessing "small numbers are
//      percent" would instead break the far more common literal-decimal case.

/** Parses free-text weight input into a decimal fraction, or `null` if the text isn't a
 * usable non-negative number. Never clamps to a max — a criterion can transiently read above
 * 1.0 while a handler is still redistributing other criteria's weights (the running-total
 * banner flags that, non-blockingly, same as it always has for FR-010). */
export function parseWeightInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const isPercent = trimmed.endsWith("%");
  const numericPart = (isPercent ? trimmed.slice(0, -1) : trimmed).trim();
  if (numericPart === "") return null;

  const value = Number(numericPart);
  if (!Number.isFinite(value) || value < 0) return null;

  if (isPercent) return value / 100;
  return value > 1 ? value / 100 : value;
}

/** Live "= 60%" readout next to the weight input — confirms how a typed value was (or would
 * be) interpreted, the same instant-feedback role a spreadsheet's own percent formatting
 * plays the moment you type into a percent-formatted cell. Rounded to 2 decimal places of
 * percent (0.01%) — finer than WEIGHT_TOLERANCE's 3-decimal-place fraction tolerance (0.001 =
 * 0.1%), so this never rounds away a difference that tolerance would still flag — and enough
 * to absorb ordinary floating-point noise (e.g. 0.1 + 0.2) without a stray digit appearing. */
export function formatWeightPercent(weight: number): string {
  const pct = Math.round(weight * 100 * 100) / 100;
  return `${pct}%`;
}
