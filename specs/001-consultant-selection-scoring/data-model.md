# Phase 1 Data Model: Consultant Selection Scoring

This is the single in-memory data structure the whole app reads from and writes to
(constitution Principles II/III). It is also, verbatim (plus `schemaVersion`), the shape of
an exported `project.json` — see `contracts/project-file.md` for the file-level contract
(export/import behavior, filename rules, validation-on-load). This document defines the
entities, fields, and validation/lifecycle rules; FR references are to `spec.md`.

## Project (root)

```ts
interface Project {
  schemaVersion: string;          // e.g. "1.0" — FR-038
  project: {
    projectName: string;          // "" until set (FR-005); drives default export filename (FR-014)
    localGovContact: string;      // handler/contact name
    procurementAgent: string;     // WFRC PM, optional
    committeeMeetingDate: string; // ISO date, "" if unset
    notes: string;
  };
  scoringScale: ScoringScalePoint[];  // >= 2 entries required (FR-011)
  criteria: Criterion[];
  firms: Firm[];
  reviewers: Reviewer[];
  scores: Score[];                    // sparse — see Score below
}
```

**Validation rules**:
- `schemaVersion` MUST be present on every exported file (FR-038). On import, recognized
  older versions are migrated forward in memory before the rest of validation runs;
  unrecognized or newer-than-supported versions are rejected with a clear error (FR-038) —
  this check runs *before* structural schema validation (FR-004), since a version mismatch
  is a different failure mode than a malformed file.
- `scoringScale.length >= 2` (FR-011).
- `sum(criteria[].weight)` SHOULD equal `1.0` within ±0.001 tolerance; violating this is a
  **non-blocking** advisory state (FR-010, clarified) — it must never prevent editing,
  export, or reviewer-form generation, only be visibly flagged everywhere weights display.
- A `Project` with `criteria.length === 0` or zero firms where `submitted === true` MUST
  block reviewer-form generation specifically (Edge Cases: an empty Scoring sheet is
  meaningless) — this is a distinct, blocking gate from the weight-sum warning above.

**Lifecycle** (drives Load-screen routing, FR-002/FR-003):
- `scores.length === 0` → "incomplete" → routes to Configuration.
- `scores.length > 0` → "has results" → routes to Dashboard (view mode).

## ScoringScalePoint

```ts
interface ScoringScalePoint {
  value: number;   // e.g. 1, 3, 5 — the only values Score.value may take (FR-017, FR-021)
  label: string;   // e.g. "Completely unqualified"
}
```

No `id` needed — scale points are matched and validated by `value`, which must be unique
within a project's `scoringScale` array (two points cannot share a value; that would make
score validation and the Excel dropdown ambiguous).

## Criterion

```ts
interface Criterion {
  id: string;          // e.g. "crit-1" — stable identity used by Score.criterionId and the
                        // reviewer workbook's hidden ID column (FR-018)
  name: string;
  weight: number;       // fractional; see Project-level weight-sum validation above
  description: string;  // shown to reviewers on the Scoring sheet (FR-016) and Instructions sheet
}
```

**Deletion rule** (FR-039, clarified): removing a `Criterion` that has any `Score` entries
referencing its `id` requires handler confirmation first (same UX pattern as Firm deletion
below). If confirmed, the criterion is removed from `criteria`, and its orphaned `Score`
entries are **retained** in `scores` but excluded from every calculation in
`lib/calculations.ts` (a `Score` whose `criterionId` no longer resolves to a live
`Criterion` is filtered out before any average/weighted-total computation).

## Firm

```ts
interface Firm {
  id: string;          // e.g. "firm-1"
  name: string;
  invited: boolean;
  submitted: boolean;   // gates inclusion in scoring/ranking/averages (FR-025)
  notes: string;
}
```

**Deletion rule** (FR-007): removing a `Firm` that has any `Score` entries referencing its
`id` requires handler confirmation first. FR-007 itself doesn't spell out the
orphan-and-exclude behavior the way FR-039 (Criterion) and FR-041 (Reviewer) do, but the
same behavior applies here too — a deleted Firm's scores become orphaned in the same
structural sense (filtered out because `firmId` no longer resolves) — no separate rule is
needed since the calculation engine already only operates over live `firms`/`criteria`
joins (see Score below).

## Reviewer

```ts
interface Reviewer {
  id: string;              // e.g. "rev-1"
  name: string;
  type: "applicant" | "wfrc";   // explicit field (not inferred) — FR-008; determines TLC
                            // Applicant-average eligibility (FR-027). Was "city"; renamed
                            // ("TLC Applicant" in the UI) so a county TLC applicant isn't
                            // mislabeled — project-schema.ts migrates old "city" values on load.
  email: string;            // optional, "" if unset — handler's own reference only (never
                            // used by the app to send anything)
}
```

**Deletion rule** (FR-041): removing a `Reviewer` that has any `Score` entries referencing
its `id` requires handler confirmation first — the same pattern as Firm (FR-007) and
Criterion (FR-039) deletion. If confirmed, the reviewer is removed from `reviewers`, and
its orphaned `Score` entries are retained in `scores` but excluded from every calculation
in `lib/calculations.ts`.

## Score

```ts
interface Score {
  reviewerId: string;   // Reviewer.id
  firmId: string;       // Firm.id
  criterionId: string;  // Criterion.id
  value: number;         // MUST be one of scoringScale[].value (FR-017, FR-021)
  comment: string;       // "" if none; one comment per individual score (FR-016), not per firm
  updatedAt: string;     // ISO datetime — set on manual entry (FR-024) or import (FR-023)
}
```

**Sparsity**: `scores` is a flat array; the *absence* of an entry for a given
`(reviewerId, firmId, criterionId)` triple means "not yet scored" — never treated as zero
(spec FR-026, Key Entities). No placeholder/null `Score` rows are ever created.

**Uniqueness / overwrite rule** (FR-023): at most one `Score` exists per
`(reviewerId, firmId, criterionId)` triple at any time. Importing a workbook or manual entry
that targets an existing triple **replaces** that entry (including `comment` and
`updatedAt`) rather than appending a duplicate.

**Orphan handling**: a `Score` whose `firmId` no longer resolves to a `Firm`, or whose
`criterionId` no longer resolves to a `Criterion` (see deletion rules above), is retained in
the array but excluded by `lib/calculations.ts` from every average/total. A `Score` whose
`reviewerId` no longer resolves to a `Reviewer` (reviewer removed after scoring — not an
explicit spec scenario, but the same filter logic naturally covers it) is likewise excluded,
for consistency.

## Derived values (never stored — computed on demand by `lib/calculations.ts`)

These are documented here because they are as central to the data model as the stored
fields, even though `Project` never persists them — persisting a Score is the input; these
are 100%-reconstructable outputs, which is exactly what constitution Principle VI
(Transparency) requires.

| Derived value | Formula | FR |
|---|---|---|
| `overallAvg(firm, criterion)` | mean of `Score.value` across all reviewers with a live score for that firm/criterion cell (any type), ignoring firms/criteria removed per the orphan rules above | FR-026 |
| `applicantAvg(firm, criterion)` | same, but only reviewers with `type === "applicant"` | FR-027 |
| `overallWeightedTotal(firm)` | `Σ over live criteria of overallAvg(firm, criterion) × criterion.weight` | FR-028 |
| `applicantWeightedTotal(firm)` | `Σ over live criteria of applicantAvg(firm, criterion) × criterion.weight` | FR-028 |
| `rank(firm, by: overall \| applicant)` | standard competition ranking (ties share a rank, next rank skips) over `submitted === true` firms only, descending by the chosen total | FR-025, FR-029 |
| `completion(firm, criterion \| overall)` | count of reviewers (of the applicable type) who have a live score, vs. count expected | FR-030 |

All six are pure functions of `(Project)` — no hidden state, no memoized cache that could
drift from the raw `scores` array, satisfying the "show your work" requirement (FR-031):
the calculations view renders these same functions' intermediate values, not a separately
maintained summary.

## Entity relationship summary

```
Project 1───* Criterion
Project 1───* Firm
Project 1───* Reviewer
Project 1───* ScoringScalePoint
Project 1───* Score ──references──> Reviewer.id, Firm.id, Criterion.id (soft references;
                                     orphaning on delete is expected and handled, not
                                     prevented by foreign-key-style hard constraints)
```
