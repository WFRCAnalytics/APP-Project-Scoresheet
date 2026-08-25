// Post-launch improvements, item 3: surfaces firms/reviewers that share a name so they
// don't read as indistinguishable on the Dashboard or in exported reports. Trims and
// lowercases before comparing — "Acme Co" and "acme co " would look identical everywhere
// they're displayed, so an exact-match comparison would miss the case that actually matters.
// Empty/whitespace-only names are excluded: a freshly added, not-yet-named row shouldn't
// read as "duplicate" against another equally-blank row.
//
// Also reused by ScoringScaleEditor for duplicate scale-point VALUES (stringified first,
// e.g. `String(point.value)`) — the same "surface it, don't block on it" concern applies:
// data-model.md says scale point values must be unique, and two points sharing a value with
// different labels means a score of that number is genuinely ambiguous about which label it
// was meant to convey. Trim/lowercase are no-ops on a stringified number, so nothing about
// this function needed to change to serve both callers.

export function findDuplicateNames(names: string[]): Map<string, number> {
  const counts = new Map<string, { display: string; count: number }>();
  for (const raw of names) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { display: raw.trim(), count: 1 });
    }
  }
  const duplicates = new Map<string, number>();
  for (const { display, count } of counts.values()) {
    if (count > 1) duplicates.set(display, count);
  }
  return duplicates;
}
