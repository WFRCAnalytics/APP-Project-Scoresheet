# Quickstart: Consultant Selection Scoring

A runnable validation guide proving the feature works end-to-end. Not an implementation
guide — see `plan.md` for structure, `data-model.md` for the schema, and `contracts/` for
the file/workbook formats each step below exercises.

## Prerequisites

- Node.js 20+, a package manager (npm/pnpm), and a real spreadsheet application (Excel,
  Google Sheets, or LibreOffice Calc) available for the manual Excel-verification step —
  automated tests alone cannot satisfy that step (see `research.md` §2).
- Repo checked out on branch `001-consultant-selection-scoring`, dependencies installed
  (`npm install` once `package.json` exists from `/speckit-tasks` + `/speckit-implement`).

## Setup

```bash
npm run dev        # starts the Vite dev server
npm run test        # Vitest: unit (calculations, schema) + integration (Excel round-trip)
npm run build        # production build → /docs (vite.config.ts build.outDir + base for
                      # the GitHub Pages "Deploy from a branch" subpath — see below)
```

**Deploying** (manual, no CI/CD — see `research.md` §9): after `npm run build` regenerates
`/docs`, review the diff (`git status`/`git diff --stat docs/`) to confirm it reflects the
current source, then commit `/docs` together with any source changes and push to `main`.
GitHub Pages (configured for source `main` / `/docs`) picks it up automatically — there is
no separate deploy command or workflow run to wait on.

## Scenario 1 — Configure a new project and export it (validates User Story 1, FR-001–014)

1. Open the app fresh (no `project.json` uploaded). Confirm the Load screen shows exactly
   two actions: "Start a new project" and "Upload a project file" — nothing else.
2. Choose "Start a new project." Fill in:
   - Project name: `Quickstart Test`
   - 2 criteria, weights `0.5` and `0.5` (sums to 1.0 — confirm the running-total indicator
     shows no warning)
   - A 2-point scoring scale (e.g. `1 = No`, `5 = Yes`)
   - 2 firms, both marked `submitted = true`
   - 2 reviewers, one `type: city`, one `type: wfrc`
3. Change one criterion's weight so the total is `0.7` — confirm the warning appears, and
   confirm you can *still* export and still generate reviewer forms (FR-010, clarified —
   non-blocking). Set the weight back to `0.5` before continuing.
4. Export the project. Confirm the filename prompt defaults to `Quickstart_Test.json`
   (sanitized project name, not a generic `project.json`), and that you can override it.
5. Inspect the downloaded file: `schemaVersion` present; `scores: []`; everything else
   matches what was entered — this is `contracts/project-file.md`'s export contract.

## Scenario 2 — Generate and verify a reviewer workbook (validates User Story 2, FR-015–019)

1. From the same project, generate a form for the `city`-type reviewer.
2. Open the downloaded `.xlsx` in **real Excel** (not just inspect the bytes) — this is the
   mandatory manual step from `research.md` §2:
   - "Instructions" sheet shows project name, reviewer name, and the 2-point scale legend.
   - "Scoring" sheet has exactly 4 rows (2 firms × 2 criteria).
   - Clicking a Score cell shows a dropdown limited to `1` and `5` — typing `3` is rejected.
   - Attempting to edit the Firm or Criterion column is blocked by sheet protection.
   - Confirm hidden columns exist (unhide them temporarily to check) carrying
     reviewerId/firmId/criterionId per row, then re-hide before saving.
3. Use "download all forms" and confirm you get one correctly-scoped file per reviewer (2
   files here), not more, not fewer.

## Scenario 3 — Fill and import scores, view results (validates User Story 3, FR-020–037)

1. In the workbook from Scenario 2, fill both Score cells (from the dropdown) and one
   Comments cell, save, keep the file in its original `.xlsx` format.
2. Back in the app, import that one workbook. Confirm a before-commit summary appears (e.g.
   "2 scores added") before anything is written to state.
3. Confirm the commit, then check the Dashboard: the scored firm's completion indicator
   reads `1/2 reviewers scored` for each criterion (only one of two reviewers has scored so
   far) — confirms FR-030's non-blocking partial-result labeling.
4. Repeat Scenario 2–3 for the second (`wfrc`-type) reviewer, scoring differently on purpose.
5. On the Dashboard, confirm: Overall Weighted Total reflects both reviewers' averages;
   City Weighted Total reflects only the `city`-type reviewer's scores (FR-027). Open the
   "show calculations" view and confirm every number traces to the two raw scores you
   entered (FR-031) — hand-compute the expected averages and totals and compare.
6. Export the PDF report; confirm it's legible printed in black-and-white (SC-008) and that
   text is real/selectable in the PDF viewer, not a rasterized image (validates the
   react-to-print decision in `research.md` §4).
7. Export the final `project.json`; confirm `scores` now contains both entries and the file
   re-imports cleanly (upload it fresh and confirm it routes straight to the Dashboard,
   validating FR-002 and User Story 4).

## Scenario 4 — Schema-version and validation edge cases (validates FR-004, FR-038, FR-039)

1. Edit an exported `project.json` by hand: remove the `schemaVersion` field entirely. Import
   it — confirm the app treats it as an older/unversioned file and migrates it rather than
   rejecting it (FR-038).
2. Edit another copy: set `schemaVersion` to an absurd future value (e.g. `"99.0"`). Import
   it — confirm the app rejects it with a clear, specific error naming the unsupported
   version, and does not partially load it.
3. Edit a third copy: corrupt it into unrelated JSON (e.g. `{"hello": "world"}`). Import it —
   confirm a clear rejection error, not a crash or a broken blank Configuration screen.
4. Back in a working project with scores recorded, delete a criterion that has scores
   against it. Confirm a confirmation prompt appears (FR-039) and, once confirmed, that the
   Dashboard's totals recompute as if that criterion never existed, while "show
   calculations" still shows the orphaned raw scores are no longer part of any total (or
   omits them entirely — implementation's choice, as long as they don't silently affect a
   live number).

## Definition of done for this feature

- All four scenarios above pass, including the real-Excel manual check in Scenario 2.
- `npm run test` passes (unit: calculations + schema; integration: Excel round-trip per
  `contracts/reviewer-workbook.md`'s round-trip contract test).
- `npm run build` succeeds and the built `/docs` serves correctly under the GitHub Pages
  project-page subpath (spot-check locally with a static file server using that base path);
  `/docs` is committed and pushed to `main` as the actual deploy step (no CI/CD — `research.md` §9).
- No network request in the browser's dev-tools Network tab ever carries project data
  (spec SC-007) — confirm during Scenario 3 while scores/comments are entered and exported.
- Automated contrast check passes against the WCAG 2.1 AA target for the token set in
  `research.md` §10 (spec SC-010), in both light and dark mode.
