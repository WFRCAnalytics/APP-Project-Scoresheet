---

description: "Task list template for feature implementation"
---

# Tasks: Consultant Selection Scoring

**Input**: Design documents from `/specs/001-consultant-selection-scoring/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
(all present)

**Tests**: Not requested as a TDD approach for UI work; test tasks are included only where
`contracts/reviewer-workbook.md` and constitution Principle VI explicitly require them
(the calculation engine and the Excel round-trip).

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5, matching spec.md)
- File paths reference the structure defined in `plan.md`

---

## Phase 1: Setup

**Purpose**: Project initialization and tooling — nothing story-specific yet.

- [ ] T001 Initialize the Vite + React + TypeScript project at the repo root (`package.json`,
      `tsconfig.json`, `index.html`, `src/main.tsx`) per `plan.md` Project Structure
- [ ] T002 Configure `vite.config.ts`: `base: '/APP-Project-Scoresheet/'`,
      `build.outDir: 'docs'` (per `research.md` §9 — GitHub Pages "Deploy from a branch")
- [ ] T003 Install core dependencies: `react`, `react-dom`, `recharts`, `exceljs`,
      `react-to-print`; dev dependencies: `typescript`, `vitest`,
      `@testing-library/react`, `eslint`, `prettier`, `vite-plugin-node-polyfills`
- [ ] T004 [P] Configure ESLint + Prettier for TypeScript/React in the repo root config files
- [ ] T005 [P] Configure Vitest + React Testing Library test setup (`vitest.config.ts` or
      `vite.config.ts` test block, `tests/setup.ts`)
- [ ] T006 Resolve the ExcelJS Node/`Buffer` polyfill gotcha in `vite.config.ts`: add
      `vite-plugin-node-polyfills` scoped to `buffer` only, plus
      `define: { global: 'globalThis' }`, and import ExcelJS's browser entry point (per
      `research.md` §2) — confirm `npm run build` produces a bundle with no unresolved
      Node-core imports
- [ ] T007 Add an `npm run deploy` script wired to `package.json` `scripts.deploy` that runs
      `vite build` and then a short Node script (`scripts/deploy-reminder.mjs`) printing a
      reminder to review the `/docs` diff (`git diff --stat docs/`) and commit + push to
      `main` — turns the manual deploy sequence in `research.md` §9 / `quickstart.md` into
      one command instead of a remembered sequence

**Checkpoint**: `npm run dev`, `npm run test`, and `npm run build` all run cleanly on an
empty app shell before any feature work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story depends on — data types, the
calculation engine, app-wide state, and the WFRC brand/theme layer.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T008 Define TypeScript types for `Project`, `Firm`, `Reviewer`, `Criterion`,
      `ScoringScalePoint`, `Score` in `src/types/project.ts` per `data-model.md`
- [ ] T009 [P] Implement `src/lib/calculations.ts`: pure functions for `overallAvg`,
      `cityAvg`, `overallWeightedTotal`, `cityWeightedTotal`, `rank`, `completion` per
      `data-model.md`'s Derived Values table (FR-025–FR-031) — framework-free, no React
      import, so it stays independently auditable per constitution Principle VI
- [ ] T010 [P] Unit tests for `src/lib/calculations.ts` in `tests/unit/calculations.test.ts`
      using hand-computed fixtures (small firm/reviewer/criterion sets with known expected
      averages, weighted totals, and tied ranks)
- [ ] T011 [P] Implement `src/lib/project-schema.ts`: structural validation, `schemaVersion`
      recognition + forward migration, and rejection of unrecognized/newer versions, per
      `contracts/project-file.md` (FR-004, FR-038)
- [ ] T012 [P] Unit tests for `src/lib/project-schema.ts` in
      `tests/unit/project-schema.test.ts`: malformed JSON rejected, missing/old
      `schemaVersion` migrated, unrecognized/future `schemaVersion` rejected with a clear
      error (quickstart Scenario 4, steps 1–3)
- [ ] T013 [P] Implement `src/lib/filenames.ts`: sanitized default export filename logic
      (`Very_Good_Project.json` / `untitled-project.json`) per FR-014
- [ ] T014 Implement `src/state/ProjectContext.tsx`: React Context + `useReducer` over the
      in-memory `Project`, with actions covering every CRUD operation from FR-005–FR-011,
      FR-023, FR-039 (no Redux/Zustand, per `research.md` §5)
- [ ] T015 Implement `src/state/sessionRecovery.ts`: opt-in, clearly-labeled `sessionStorage`
      "recover unsaved work" convenience — never a substitute for export, never presented as
      a project list, and independent of the upload/import flow (constitution Principle II,
      `contracts/project-file.md`'s compatibility note)
- [ ] T016 Create `src/theme/tokens.css`: WFRC brand values as CSS custom properties for
      light and dark mode — `wfrc-blue`, `wfrc-secondary-blue`, `wfrc-yellow`, `wfrc-gray`,
      light/dark foreground+background, light/dark headings color — using the exact fetched
      values in `research.md` §10 (Principle VII: sourced, not invented)
- [ ] T017 Add the RTP + Wasatch Choice categorical palette to `src/theme/tokens.css` as the
      fixed-order chart color set (`research.md` §10), **and** hand-pick/compute AA-safe
      dark-mode variants for each palette color against the `#081b26` dark background —
      this is the concrete task resolving the dark-mode contrast flag `research.md` §10
      raised (brand.yml provides no dark-mode RTP/WC variants itself, so this app must)
- [ ] T018 [P] Copy the 6 WFRC logo files (horizontal/stacked/abbreviated × color/white,
      exact filenames confirmed in `research.md` §10) into `src/assets/logo/` — files
      copied into this project, never referenced from the wfrc-brand repo at runtime
      (constitution Principle VII)
- [ ] T019 [P] Implement `src/theme/fonts.ts`: load Poppins (300–700, normal+italic), Inter
      (300–700, normal+italic), Fira Code (400/500/700, normal+italic) from the Google Fonts
      CDN per `research.md` §10
- [ ] T020 Implement an automated WCAG 2.1 AA contrast check over every token pair in
      `src/theme/tokens.css` (light and dark), e.g. via `axe-core` or a small custom
      contrast-ratio script, in `tests/unit/contrast.test.ts` (spec SC-010) — include the
      dark-mode chart palette variants from T017
- [ ] T021 Implement `src/App.tsx`: top-level area-switch state machine (Load →
      Configuration → Reviewer Forms → Calculations view → Dashboard), no router library
      (`research.md` §6)

**Checkpoint**: Foundation ready — calculation engine, schema validation, app state, and
theme are all in place and unit-tested; user story implementation can begin.

---

## Phase 3: User Story 1 - Configure a New Scoring Project (Priority: P1) 🎯 MVP

**Goal**: A handler can start a project from scratch, fill in every configuration field, and
export a valid `project.json` with an empty `scores` array.

**Independent Test**: Per spec.md — walk through every configuration field from the Load
screen, see live weight-sum validation, and download a `project.json` matching everything
entered, without any other part of the app existing yet.

- [ ] T022 [US1] Implement `src/features/load/LoadScreen.tsx`: exactly two entry actions,
      "Start a new project" and "Upload a project file" (FR-001)
- [ ] T023 [US1] Implement `src/features/load/uploadProject.ts`: parse an uploaded file via
      `project-schema.ts`, then route to Configuration (`scores.length === 0`) or Dashboard
      (`scores.length > 0`) per `contracts/project-file.md` (FR-002, FR-003, FR-004)
- [ ] T024 [P] [US1] Implement `src/features/configuration/ProjectInfoForm.tsx` (name,
      handler/contact, committee meeting date, notes) (FR-005)
- [ ] T025 [P] [US1] Implement `src/features/configuration/FirmsEditor.tsx`: add/edit/remove,
      invited/submitted flags, notes, and a confirmation prompt before removing a firm with
      existing scores (FR-006, FR-007)
- [ ] T026 [P] [US1] Implement `src/features/configuration/ReviewersEditor.tsx`: add/edit/
      remove, name + explicit `type: "city" | "wfrc"` + optional email (FR-008)
- [ ] T027 [P] [US1] Implement `src/features/configuration/CriteriaEditor.tsx`: add/edit/
      remove criteria (name, weight, description), a running weight-total display with a
      non-blocking warning when it isn't 1.0 ± 0.001, and a confirmation prompt before
      removing a criterion with existing scores (FR-009, FR-010, FR-039)
- [ ] T028 [P] [US1] Implement `src/features/configuration/ScoringScaleEditor.tsx`: add/
      edit/remove scale points (value + label), enforcing a minimum of 2 points (FR-011)
- [ ] T029 [US1] Implement `src/features/configuration/ExportProjectButton.tsx`: filename
      prompt pre-filled via `filenames.ts`, editable, available at all times in
      Configuration (FR-013, FR-014)
- [ ] T030 [US1] Implement `src/features/configuration/ConfigurationScreen.tsx`: assembles
      T024–T029 plus an "Upload a different project JSON" action, wired to
      `ProjectContext` (FR-013)

**Checkpoint**: User Story 1 fully functional and independently testable — quickstart.md
Scenario 1 passes end-to-end.

---

## Phase 4: User Story 2 - Generate and Distribute Reviewer Scoring Forms (Priority: P2)

**Goal**: The handler generates a real `.xlsx` workbook per reviewer, individually or in
batch, matching `contracts/reviewer-workbook.md` exactly.

**Independent Test**: Given any fully configured project (from US1), generating a form for
one reviewer produces a workbook that opens correctly in Excel with the right
Instructions/Scoring sheet structure — independent of whether any scores exist yet.

- [ ] T031 [US2] Implement `src/lib/excel/generateWorkbook.ts`: Instructions sheet +
      Scoring sheet (Firm/Criterion/Description/Score/Comments), Score-column dropdown
      validation restricted to the project's scale values, locked reference columns, and
      hidden protected reviewerId/firmId/criterionId columns, per
      `contracts/reviewer-workbook.md` (FR-015–FR-018)
- [ ] T032 [US2] Add the pre-condition guard to `generateWorkbook.ts`'s caller: block
      generation with a clear message when `criteria.length === 0` or there are zero
      `submitted === true` firms (spec Edge Cases; an unresolved weight-sum warning does
      **not** block generation, per FR-010)
- [ ] T033 [P] [US2] Implement `src/features/reviewer-forms/GenerateFormButton.tsx`:
      single-reviewer "download form" action (FR-019)
- [ ] T034 [P] [US2] Implement `src/features/reviewer-forms/GenerateAllFormsButton.tsx`:
      "download all forms" batch action, looping `generateWorkbook.ts` once per reviewer so
      the single and batch paths can never drift out of sync (FR-019)
- [ ] T035 [US2] Write the round-trip contract test in
      `tests/integration/excel-roundtrip.test.ts`: generate → parse recovers every row
      correctly; an out-of-scale Score value and a corrupted hidden-ID cell each produce a
      `failed` row, not a thrown exception (per `contracts/reviewer-workbook.md`'s mandated
      test — depends on T031 and T037's `parseWorkbook.ts`)
- [ ] T036 [US2] Perform and record the manual real-Excel verification step (quickstart
      Scenario 2) in `specs/001-consultant-selection-scoring/qa-signoff.md`: open a
      generated workbook in real Excel and confirm the Score dropdown, locked columns, and
      hidden ID columns all behave as intended — an automated test alone cannot satisfy this
      (`research.md` §2)

**Checkpoint**: User Stories 1 AND 2 both work independently — quickstart.md Scenario 2
passes end-to-end (including the manual Excel check).

---

## Phase 5: User Story 3 - Import Returned Scores and View Ranked Results (Priority: P1)

**Goal**: Completed workbooks (single or multi-file) import into `project.scores` with
per-file validation and a pre-commit summary; the Dashboard renders ranked, auditable
results.

**Independent Test**: Given a configured project and one or more completed `.xlsx`
workbooks, importing them updates scores correctly and the Dashboard immediately reflects
new rankings and completion status, independent of whether every reviewer has responded.

- [ ] T037 [US3] Implement `src/lib/excel/parseWorkbook.ts`: read hidden ID columns (never
      visible text) to match rows, validate each row's Score against the *current*
      project's scale and its IDs against the *current* project's entities, and produce a
      per-row `added`/`failed` result plus a per-file summary, per
      `contracts/reviewer-workbook.md` (FR-020, FR-021, FR-022)
- [ ] T038 [P] [US3] Implement `src/features/reviewer-forms/ImportScoresPanel.tsx`:
      single/multi-file picker, per-file before/after summary display, and a commit step
      that upserts `added` rows into `project.scores` (overwriting existing entries for the
      same reviewer/firm/criterion) only after handler confirmation (FR-020, FR-022, FR-023)
- [ ] T039 [P] [US3] Implement `src/features/dashboard/DashboardScreen.tsx`: project header,
      ranked firm cards (rank, Overall Weighted Total, City Weighted Total, per-firm
      completion indicator) (FR-032, FR-033, FR-030)
- [ ] T040 [P] [US3] Implement `src/features/dashboard/OverallCityBarChart.tsx`: Recharts
      bar chart comparing firms on Overall vs. City weighted totals, using the categorical
      chart tokens from T017 (FR-034)
- [ ] T041 [P] [US3] Implement `src/features/dashboard/CriterionBreakdownChart.tsx`:
      per-firm radar/grouped-bar chart showing scores by criterion (FR-034)
- [ ] T042 [US3] Implement `src/features/calculations-view/CalculationsView.tsx`: the
      "show calculations" toggle view rendering every reviewer's raw score per firm per
      criterion alongside computed averages, weights, weighted sub-totals, and totals —
      sourced from the same `calculations.ts` functions the Dashboard uses (FR-031)
- [ ] T043 [US3] Implement `src/lib/pdf/printLayout.ts` + `src/features/dashboard/
      ExportPdfButton.tsx`: react-to-print-driven print layout with a `@media print`
      stylesheet enforcing high-contrast colors (constitution Principle VII's print
      carve-out), containing project header, ranking summary, charts, and per-firm detail
      with comments (FR-035)
- [ ] T044 [US3] Implement `src/features/dashboard/ExportProjectButton.tsx`: reuses
      `filenames.ts`, available on the Dashboard, includes all scores collected so far
      (FR-036, FR-037)

**Checkpoint**: User Stories 1–3 form a complete usable round trip — quickstart.md Scenario
3 passes end-to-end (configure → generate → score → import → view → export PDF/JSON).

---

## Phase 6: User Story 4 - Reopen a Project File (Priority: P2)

**Goal**: Anyone with a `project.json` — scored or not — can reopen it and land in the right
place with no data loss.

**Independent Test**: Two sample files (config-only, and config+scores) uploaded from the
Load screen route to Configuration and Dashboard respectively.

- [ ] T045 [US4] Implement `src/features/dashboard/EditProjectButton.tsx` and the
      corresponding `App.tsx` state transition: switch from Dashboard (view mode) into
      Configuration without losing any loaded data (spec Story 4, Acceptance Scenario 3)
- [ ] T046 [US4] Verify and, if needed, adjust `ConfigurationScreen.tsx`'s "Upload a
      different project JSON" action (T030) to correctly re-run the same routing decision
      as the Load screen (T023) rather than always staying on Configuration (spec Story 4,
      Acceptance Scenarios 1–2 — this task is primarily a cross-check that T023's routing
      logic is reused, not reimplemented, in both entry points)

**Checkpoint**: Reopening any previously exported file (from US1 or US3) behaves correctly
in both directions — quickstart.md Scenario 3 step 7 and Scenario 4 pass.

---

## Phase 7: User Story 5 - Manually Enter Reviewer Scores (Priority: P3)

**Goal**: A fallback path for scores reported informally, without the Excel round trip.

**Independent Test**: Given a configured project and no imported workbook, a handler enters
scores directly into a grid and sees them reflected on the Dashboard exactly as an import
would produce.

- [ ] T047 [US5] Implement `src/features/reviewer-forms/ManualEntryGrid.tsx`: firms ×
      criteria grid for a selected reviewer, score + optional comment per cell, applying the
      same scale-value validation as `parseWorkbook.ts` (T037) (FR-024)
- [ ] T048 [US5] Wire the manual entry grid's commit path through the same upsert logic
      `ImportScoresPanel.tsx` (T038) uses for `project.scores`, so a later workbook import
      for the same reviewer/firm/criterion cells correctly overwrites manually entered
      values (spec Story 5, Acceptance Scenario 2) — host the grid per `plan.md`'s
      structure note (alongside the Calculations view)

**Checkpoint**: All five user stories are independently functional — quickstart.md's full
scenario set passes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that spans multiple stories.

- [ ] T049 [P] Run the complete `quickstart.md` validation guide (all 4 scenarios) end-to-end
      and record results in `specs/001-consultant-selection-scoring/qa-signoff.md`
- [ ] T050 [P] Re-run the automated WCAG 2.1 AA contrast check (T020) against the final,
      fully-populated `tokens.css` (including any UI-driven token additions from Phases
      3–7) to confirm nothing introduced during feature work regressed contrast (spec
      SC-010)
- [ ] T051 Manually verify, via browser dev-tools Network tab, that zero requests carry
      project data at any point during Scenario 3's full workflow; record the result in
      `qa-signoff.md` (spec SC-007)
- [ ] T052 [P] Write `README.md`: project overview, and `npm run dev` / `test` / `build` /
      `deploy` usage (the last one exercising T007's new script)
- [ ] T053 Perform one real `npm run deploy` dry run: build, review the `/docs` diff, commit,
      and push to `main`; confirm GitHub Pages (Settings → Pages → Source: `main` / `/docs`)
      serves the result correctly under the project-page subpath

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–7)**: All depend on Foundational completion. Unlike a typical
  spec-kit feature where stories are mutually independent, this feature's stories form a
  real build chain (each one produces the data the next one needs), so phases are ordered
  by that chain rather than by raw priority number (P1, P1, P2, P2, P3 would otherwise place
  US3 before US2, which cannot work — US3 needs completed workbooks or manual-entry scores
  to import/display):
  - **US1** (P1): no dependency on other stories.
  - **US2** (P2): depends on **US1** (needs a configured project to generate forms from).
  - **US3** (P1): depends on **US2** (needs real generated/completed workbooks to import) —
    or, as a lighter-weight alternative data source, on **US5**'s manual entry. Also reuses
    US1's `ProjectContext` and Foundational's `calculations.ts` directly.
  - **US4** (P2): depends on **US1** (project files must exist to reopen) and exercises
    **US3**'s output more fully (a scored file), but its own logic mostly reuses T023's
    routing rather than adding new logic.
  - **US5** (P3): depends on **US1** only (a configured project); independent of US2.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- Setup: T004, T005 in parallel once T001–T003 land.
- Foundational: T009–T013 and T016–T019 are each independently parallelizable file sets
  (calculations/schema/filenames vs. theme/logo/fonts) once T008 (types) exists.
- US1: T024–T028 (the five editors) are all independent files, parallelizable once T023
  exists.
- US2: T033, T034 in parallel once T031 exists.
- US3: T038–T041 (import panel + three dashboard views) are independent files,
  parallelizable once T037 exists.
- Polish: T049, T050, T052 in parallel; T051 and T053 are sequential manual verification
  steps best run last.

---

## Parallel Example: Foundational Phase

```bash
# Once T008 (types) is done, these can run in parallel — different files, no
# cross-dependencies:
Task: "Implement src/lib/calculations.ts pure functions per data-model.md"
Task: "Implement src/lib/project-schema.ts validation + migration"
Task: "Implement src/lib/filenames.ts sanitized filename logic"
Task: "Create src/theme/tokens.css with WFRC brand values (light + dark)"
Task: "Copy WFRC logo files into src/assets/logo/"
Task: "Implement src/theme/fonts.ts Google Fonts loading"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1): a handler can configure and export a `project.json`.
3. **STOP and VALIDATE**: quickstart.md Scenario 1.
4. This alone is a real, deployable improvement over the spreadsheet template (structured,
   validated project setup), even though the full scoring round trip isn't live yet.

### Incremental Delivery (the practically meaningful path for this feature)

1. Setup + Foundational → Foundation ready.
2. US1 → validate independently → MVP (configuration only).
3. US2 → validate independently → forms can go out to reviewers.
4. US3 → validate independently → **the first point at which the app replaces the
   spreadsheet end-to-end** (configure → distribute → collect → view results).
5. US4 → validate independently → reopening/resuming works both ways.
6. US5 → validate independently → the non-Excel fallback path is covered.
7. Polish → final cross-cutting verification and the first real deploy.

### Notes

- [P] tasks touch different files with no unmet dependencies.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- The calculation engine (T009) and the Excel contract (T031/T037) are this feature's
  highest-risk-of-bugs modules — per the original requirements brief, these are worth a
  second look (e.g. a fresh pair of eyes, or `/code-review`) before considering Phases 3–5
  done, even though they already carry dedicated unit/integration tests.
