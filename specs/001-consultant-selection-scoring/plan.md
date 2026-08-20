# Implementation Plan: Consultant Selection Scoring

**Branch**: `001-consultant-selection-scoring` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-consultant-selection-scoring/spec.md`

## Summary

A client-only React SPA that replaces a spreadsheet-based consultant-selection scoring
workflow for a transportation planning agency. A handler configures a project (firms,
reviewers, weighted criteria, a configurable scoring scale) entirely in memory; the app
generates one `.xlsx` scoring workbook per reviewer (ExcelJS, with dropdown validation,
locked columns, and hidden ID columns for reliable row-matching) and later imports
completed workbooks back into scores. A pure, framework-free calculation module computes
Overall/City averages, weighted totals, and competition-style ranks, fully auditable via a
"show calculations" view. Results render on a Dashboard (Recharts bar/radar charts) and
export as a print-quality PDF (react-to-print) and as a re-openable `project.json` — the
single source of truth, chosen/named by the handler at every export point. No backend, no
accounts, no multi-project storage, and no data ever leaves the browser. Visual identity is
built from real values fetched from the WFRC brand repository (Section: WFRC Brand Tokens
below), not invented.

## Technical Context

**Language/Version**: TypeScript 5.x on React 18, built with Vite 5.x. Node.js 20+ is a
build-time-only dependency (GitHub Actions runner); nothing Node-specific ships to the
browser except where explicitly polyfilled (see ExcelJS note below).

**Primary Dependencies**: React + React DOM; Recharts (charts); ExcelJS (generate and parse
`.xlsx` reviewer workbooks — one library for both directions); react-to-print (PDF export
via the browser's native print pipeline, not rasterization); no state-management library
beyond React's built-in `useReducer` + Context (per constitution Principle VIII and explicit
user direction — the in-memory `Project` object is small and single-owner).

**Storage**: N/A (no database, no backend — constitution Principle I). The single source of
truth is the user-downloaded/re-uploaded `project.json`. In-memory React state holds the
live `Project` object during a session; an opt-in, clearly-labeled `sessionStorage` "recover
unsaved work" convenience is allowed per constitution Principle II but is never a substitute
for export and never presented as a project list.

**Testing**: Vitest (Vite-native test runner) + React Testing Library for components;
the calculation engine (`lib/calculations.ts`) is written as pure, framework-free TypeScript
functions and unit-tested directly with hand-verifiable fixtures (mirrors the transparency
goal in constitution Principle VI and spec SC-003/SC-005). ExcelJS round-trip correctness
(structure, protection, validation, hidden ID columns) is covered by integration tests that
generate a workbook and re-parse it with ExcelJS itself, **plus** a manual verification step
documented in `quickstart.md` to open a generated workbook in real Excel — an automated test
can confirm ExcelJS wrote what it intended, but only opening the file in real Excel confirms
Excel agrees (see Research: ExcelJS/Vite polyfills).

**Target Platform**: Modern evergreen desktop browsers (Chrome, Edge, Firefox, Safari —
last 2 versions), served as static files from GitHub Pages. No server runtime of any kind.

**Project Type**: Single-page web frontend, no backend component (the template's "web
application" option assumes a frontend+backend split, which does not apply here — see
Project Structure below for the adapted single-project layout).

**Performance Goals**: Dashboard recalculation and re-render on data change stays
imperceptible (<100ms) at realistic scale (spec SC-006: up to ~6 firms × 8 reviewers × 6
criteria); a batch import of 3+ reviewer workbooks completes, with dashboard fully updated,
in under one minute of in-app time excluding file-selection (spec SC-009).

**Constraints**: Fully client-side and static-deployable (constitution Principle I); zero
runtime network calls carrying project data (constitution Principle IV, spec SC-007); works
after initial page load without a network connection for all in-app functionality (no
external API dependency exists to lose); GitHub Pages sub-path base (`vite.config.ts`
`base: '/APP-Project-Scoresheet/'`, `build.outDir: 'docs'`); deployment is manual — build
locally, commit the regenerated `/docs` folder alongside source changes, push to `main`; no
CI/CD pipeline (GitHub Pages "Deploy from a branch," source `main` / `/docs`); ExcelJS
requires a Node `Buffer` polyfill to bundle for the browser under Vite (flagged and
resolved — see Research).

**Scale/Scope**: Small, human-scale datasets by nature of the domain (a single RFP
procurement round) — realistically single-digit-to-low-tens of firms, reviewers, and
criteria — but the app must impose no hardcoded ceiling (spec FR-012).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. No Backend/DB/Accounts | Vite+React static SPA; GitHub Pages hosting; no server, DB, or auth anywhere in the stack. | PASS |
| II. Stateless Between Sessions | `Project` lives in React state; `project.json` export/import is the only durable save; any `sessionStorage` use is opt-in, labeled, and clearable (design obligation carried into Phase 1 data-model/quickstart). | PASS |
| III. One Project at a Time | No project list/dashboard screen in the structure below; Load screen only ever holds zero or one project. | PASS |
| IV. Privacy/Confidentiality | All chosen libraries (React, Recharts, ExcelJS, react-to-print) run entirely client-side; no analytics/telemetry dependency is introduced. | PASS |
| V. Flexibility Over Hard-Coding | Data model (Phase 1) parameterizes firm/reviewer/criteria counts and the scoring scale; no fixed-size assumptions in the design. | PASS |
| VI. Transparency | Calculation engine is a separate, pure, independently-testable module feeding both the Dashboard and the "show calculations" view — same numbers, same source. | PASS |
| VII. WFRC Brand Identity | Actual values fetched from `https://github.com/WFRCAnalytics/wfrc-brand` (not invented) during Phase 0 research — see Research: WFRC Brand Tokens. Logo files to be copied into `src/assets/logo/` as a concrete Phase 1/implementation task. | PASS (values sourced; copying tracked as a task) |
| VIII. Technology Stack | Vite + React + TypeScript; Recharts; react-to-print; ExcelJS — exactly the constitution's named options. | PASS |
| IX. Two File Formats, Two Jobs | `project.json` (config + results, versioned) vs. `.xlsx` (reviewer exchange) kept fully separate in both data-model and contracts (Phase 1). | PASS |

No violations identified. **Complexity Tracking is not needed for this plan.**

**Post-Phase-1 re-check**: `data-model.md` and both `contracts/*` files were reviewed
against this table after Phase 1 design. No new violations: the schema-versioning contract
(Principle IX/data durability) and the sessionStorage-recovery contract (Principle II) both
turned out to need explicit, written rules rather than being self-evident, and those rules
are now captured in `contracts/project-file.md` and `data-model.md` respectively — a
documentation gap closed, not a constitutional gap. Gate remains **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-consultant-selection-scoring/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── project-file.md
│   └── reviewer-workbook.md
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Single-project static web frontend (no backend component exists)
src/
├── main.tsx                    # Vite entry point
├── App.tsx                     # top-level area switch (Load/Configuration/ReviewerForms/Dashboard)
├── state/
│   ├── ProjectContext.tsx      # React Context + useReducer over the in-memory Project object
│   └── sessionRecovery.ts      # opt-in, labeled sessionStorage "recover unsaved work" convenience
├── lib/
│   ├── calculations.ts         # pure functions: Overall/City avg, weighted totals, ranks (FR-025..031)
│   ├── calculations.types.ts
│   ├── project-schema.ts       # Project/schemaVersion validation + migration (FR-038)
│   ├── filenames.ts            # sanitized default filename logic (FR-014)
│   ├── excel/
│   │   ├── generateWorkbook.ts # ExcelJS writer: Instructions + Scoring sheets, validation, protection, hidden ID cols
│   │   └── parseWorkbook.ts    # ExcelJS reader: hidden-ID matching, per-row validation, diff summary
│   └── pdf/
│       └── printLayout.ts      # react-to-print target component wiring
├── features/
│   ├── load/                   # Start new / Upload project.json, routing decision (FR-001..004, FR-038)
│   ├── configuration/          # project info, firms, reviewers, criteria/weights, scoring scale editors
│   ├── reviewer-forms/         # per-reviewer / batch generation UI, import UI (single+multi file), manual entry grid
│   ├── calculations-view/      # "show calculations" audit view (FR-031)
│   └── dashboard/              # ranked cards, charts, PDF export, JSON export
├── components/                 # shared/presentational UI (buttons, tables, form fields)
├── theme/
│   ├── tokens.css              # WFRC brand values as CSS custom properties (light + dark)
│   └── fonts.ts                # Google Fonts loading (Poppins/Inter/Fira Code)
├── assets/
│   └── logo/                   # WFRC logo files copied from wfrc-brand (not referenced at runtime)
└── types/
    └── project.ts              # Project, Firm, Reviewer, Criterion, ScoringScalePoint, Score

tests/
├── unit/
│   ├── calculations.test.ts    # the highest-risk-of-bugs module — hand-verifiable fixtures
│   └── project-schema.test.ts
├── integration/
│   └── excel-roundtrip.test.ts # generate → parse with ExcelJS, assert structure/protection/validation
└── component/
    └── ...                     # React Testing Library specs per feature

docs/                            # BUILD OUTPUT — vite.config.ts build.outDir; committed to
                                  # git (this is the deployed site: GitHub Pages "Deploy from
                                  # a branch" reads main:/docs); regenerated by `npm run build`
                                  # and committed manually, no CI/CD workflow produces it
.gitignore                       # ignores node_modules/ and other build scratch space; does
                                  # NOT ignore /docs
```

**Structure Decision**: Single Vite/React project (no `backend/` or `frontend/` split — there
is no backend). Business logic that must be independently auditable and unit-testable
(calculations, schema validation, Excel generation/parsing) lives in framework-free
`src/lib/` modules; UI-only concerns live under `src/features/*` grouped by the spec's five
app areas, with `src/state/ProjectContext.tsx` as the single in-memory source of truth they
all read from and write to.

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
