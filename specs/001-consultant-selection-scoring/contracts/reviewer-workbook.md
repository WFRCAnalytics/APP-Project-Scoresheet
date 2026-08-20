# Contract: Reviewer `.xlsx` Workbook

This is the app's only interface to reviewers, who have zero knowledge of this app
(constitution Principle IX). The app is both the sole producer and sole consumer of this
format — reviewers only ever open and edit it in ordinary spreadsheet software. Generation
and parsing MUST agree on every detail below, since they are each other's only contract test.

## Workbook structure

One workbook per reviewer. Two sheets, in this order:

### Sheet 1: "Instructions"

Plain, read-only content (no protection needed — nothing here is machine-parsed on import):
- Project name
- Reviewer name
- The scoring scale legend: every `ScoringScalePoint` as one `value — label` line
- One line: "Only the Score and Comments columns on the Scoring sheet should be edited."

### Sheet 2: "Scoring"

One row per `(firm, criterion)` pair, restricted to `firms[].submitted === true` firms
(spec FR-015). Row order: firms in project order, criteria in project order within each firm
(deterministic, so re-generating a form for the same project state produces the same row
order — this matters for diffing/debugging, not for correctness, since matching is by ID).

**Visible columns** (header row + one row per pair):

| Column | Source | Editable? |
|---|---|---|
| A: Firm | `Firm.name` | No — locked (FR-017) |
| B: Criterion | `Criterion.name` | No — locked |
| C: Criterion Description | `Criterion.description` | No — locked |
| D: Score | reviewer input | Yes — restricted to `scoringScale[].value` via a data-validation dropdown list (FR-017) |
| E: Comments | reviewer input | Yes — free text, one cell per row/score, not one box per firm (FR-016) |

**Hidden columns** (same header row, positioned after column E, `hidden: true` on the
column, cells locked):

| Column | Content |
|---|---|
| F: reviewerId | this workbook's `Reviewer.id` (same value every row) |
| G: firmId | that row's `Firm.id` |
| H: criterionId | that row's `Criterion.id` |

**Protection**: Sheet protection enabled with columns A–C and F–H locked, D–E unlocked, no
password (per `research.md` §7 / spec Assumptions — accidental-edit prevention only).

## Generation (`lib/excel/generateWorkbook.ts`)

Input: one `Reviewer` + the full `Project` (for firms/criteria/scale/project name).
Output: an `.xlsx` `Blob`/`ArrayBuffer` ready for download.

- Single-reviewer generation (FR-019) and "download all" batch generation (FR-019) both call
  this same function once per reviewer — batch generation is a loop, not a different code
  path, so the two can never drift out of sync with each other.
- Pre-condition (Edge Cases in `spec.md`, `data-model.md`): if `criteria.length === 0` or
  there are zero `submitted === true` firms, generation is blocked with a clear message
  before this function is even invoked — an empty Scoring sheet is refused, not produced.
  An unresolved criterion-weight-sum warning does **not** block generation (FR-010,
  clarified) — the workbook never displays weights at all, so an invalid weight sum has no
  effect on what the reviewer sees or does.

## Parsing (`lib/excel/parseWorkbook.ts`)

Input: one or more uploaded `.xlsx` files (FR-020, single or multi-select in one action).
Output, per file: a list of `{ row, status: "added" | "failed", reason?, score? }` plus a
per-file summary count, shown to the handler before anything commits (FR-022).

For each data row on the "Scoring" sheet:

1. Read the hidden `reviewerId`/`firmId`/`criterionId` triple — **never** re-derive identity
   from the visible Firm/Criterion name text, since that's exactly what a reviewer could
   accidentally edit (FR-018, spec Edge Cases).
2. Validate the triple resolves to a live `Reviewer`, `Firm`, and `Criterion` in the
   *current* project (not the project state at generation time — the current one, since
   configuration may have changed since the form went out). If any of the three no longer
   resolves → row status `failed`, reason e.g. "criterion no longer exists in this project."
3. Validate the Score cell value is one of the current project's `scoringScale[].value`
   (also re-checked against the *current* scale, same rationale as step 2) → otherwise
   `failed`, reason e.g. "3.5 is not a valid score for this project's scale."
4. Rows passing both checks become `Score` objects (`comment` from column E, `updatedAt` =
   import time) queued for commit.

**Commit step** (only after the handler confirms the shown summary, FR-022): for each
`added` row across all files in this import batch, upsert into `project.scores` — replacing
any existing entry for that exact `(reviewerId, firmId, criterionId)` triple (FR-023). Rows
marked `failed` are never written. A multi-file import produces one summary section per file
(spec Story 3 Acceptance Scenario 2) but a single combined commit action.

## Round-trip contract test

`tests/integration/excel-roundtrip.test.ts` MUST assert, for a small fixture `Project`:
1. `generateWorkbook` → `parseWorkbook` on the *unmodified* output recovers every row as
   `status: "added"` with `score` values equal to whatever was pre-filled (typically none —
   the real test is that structure/IDs survive the round trip, not that empty cells parse as
   scores).
2. Programmatically setting Score cell values (simulating a reviewer) before parsing
   produces exactly the expected `Score[]`.
3. An out-of-scale Score value and a corrupted/mismatched hidden-ID cell each independently
   produce a `failed` row, not a thrown exception and not a silently-accepted bad value.

This automated test cannot substitute for the manual real-Excel verification step in
`research.md` §2 / `quickstart.md` — it only proves ExcelJS agrees with itself.
