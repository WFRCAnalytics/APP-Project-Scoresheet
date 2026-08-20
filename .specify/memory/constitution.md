<!--
Sync Impact Report
Version change: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: N/A (first substantive adoption; prior file held only unfilled
  template placeholders, so nothing is being renamed or redefined)
Added sections:
  - Core Principles I–IX (No Backend/No Database/No Accounts; Stateless Between
    Sessions by Default; One Project at a Time; Privacy & Confidentiality;
    Flexibility Over Hard-Coding; Transparency; WFRC Brand Identity; Technology
    Stack; Two File Formats, Two Different Jobs)
  - Governance (amendment procedure, versioning policy, compliance review)
Removed sections: none
Templates requiring follow-up:
  - .specify/templates/plan-template.md — ✅ no changes required (reads constitution
    at runtime via generic "Constitution Check" gate; no stale principle references)
  - .specify/templates/spec-template.md — ✅ no changes required
  - .specify/templates/tasks-template.md — ✅ no changes required
  - .specify/workflows/speckit/* — ✅ no changes required (command bodies do not
    hardcode principle text)
Deferred items / TODOs: none — all placeholders resolved from user-supplied input.
-->

# Consultant Selection Scoring App Constitution

## Core Principles

### I. No Backend, No Database, No Accounts

The app MUST run entirely client-side and MUST be deployable as static files to
GitHub Pages. Every feature MUST be implementable without a server process, a
database, an authentication provider, or any hosted API that this project operates.
A feature that cannot function when served as plain static files is out of scope and
MUST be redesigned or rejected, not partially implemented behind a "requires backend
later" placeholder.

**Rationale**: The project's entire deployability and cost model depends on being
static-hostable. Silently introducing a server dependency (even "just for now")
breaks that guarantee for every future contributor and for GitHub Pages hosting.

### II. Stateless Between Sessions by Default

The app MUST NOT silently persist project data across browser sessions or reloads as
the source of truth. The single source of truth is a project JSON file the user
explicitly downloads (export) and later re-opens (import). In-memory state is
required for normal operation. `sessionStorage`/`localStorage` MAY be used only as an
opt-in "recover unsaved work" convenience — never as a substitute for explicit
export — and any such use MUST be clearly labeled as temporary/local-only, easy for
the user to clear, and MUST NOT be presented as a saved-project list.

**Rationale**: Scores feed an official procurement record. If the browser silently
became the source of truth, a cleared cache or a different device would mean lost or
divergent project data with no clear record of what happened.

### III. One Project at a Time

The app MUST NOT implement a multi-project dashboard or a project library/gallery. It
loads exactly one project JSON at a time and edits it in memory. Switching projects
MUST go through explicit "upload a different project file," not an in-app list of
previously opened projects.

**Rationale**: Keeps the mental model — and the storage model — simple and matches
how the source spreadsheet was used: one workbook per procurement.

### IV. Privacy & Confidentiality

Scores and comments are sensitive because they inform consultant selection. The app
MUST NOT call any external API with project data (scores, comments, firm names,
reviewer identities, or any other project content). The app MUST NOT include
analytics, telemetry, or error-reporting that transmits project content off the
user's device. Everything MUST happen in the browser.

**Rationale**: This is procurement-sensitive data; a leak (even an unintentional
analytics payload) could compromise a fair selection process or violate agency
confidentiality obligations.

### V. Flexibility Over Hard-Coding

The number of firms, the number of reviewers, the number of criteria, and the
scoring scale (number of points and their labels) MUST all be fully configurable per
project. None of these MAY be hard-coded to any specific example (including the
reference example of 4 firms, 6 reviewers, 4 criteria, and a 1/3/5 scale). Any code,
UI layout, or export template that assumes a fixed count or fixed scale values MUST
be treated as a defect.

**Rationale**: The app exists to generalize a spreadsheet that was rebuilt by hand
for every procurement. Hard-coding today's example numbers would reproduce the exact
fragility this project is meant to remove.

### VI. Transparency

Every computed number — averages, weighted totals, ranks — MUST be traceable back to
its raw inputs through an optional "show calculations" view. Calculations MUST NOT
be a black box: the view MUST reproduce the level of detail the original spreadsheet
showed through its visible formulas (raw score per reviewer per criterion, the
averages and weights that produced each total, and the total itself).

**Rationale**: This app is replacing a spreadsheet specifically trusted because its
formulas were visible and auditable. Losing that auditability during migration would
be a regression, not an improvement.

### VII. WFRC Brand Identity

The app's visual identity MUST follow the Wasatch Front Regional Council brand
defined in `https://github.com/WFRCAnalytics/wfrc-brand`. Before implementing or
changing styling, the actual brand values MUST be read from that repository (not
guessed or approximated) — specifically:
- `_extensions/wfrc-brand/brand.yml` (colors, typography, logo declarations)
- `_extensions/wfrc-brand/assets/theme/_wfrc-colors.scss` (exact hex values for
  wfrc-blue, wfrc-secondary-blue, wfrc-yellow, wfrc-gray, plus the RTP and Wasatch
  Choice palette colors)
- `_extensions/wfrc-brand/assets/theme/_wfrc-fonts.scss` (exact font stacks)
- `_extensions/wfrc-brand/assets/logo/` (logo assets — horizontal/stacked/
  abbreviated, color/white variants); the appropriate files MUST be copied into this
  project's own assets rather than referenced from the other repo at runtime

If that repository genuinely cannot be reached from the build/dev environment, work
MUST stop and flag the blocker rather than inventing brand values.

These values MUST be translated into CSS custom properties / Tailwind theme tokens
in this app. Quarto tooling itself MUST NOT be pulled in — only the brand values are
mirrored:
- Typography: Poppins for body text, Inter for headings/navigation/labels, Fira Code
  for any monospace/code-style display, all loaded from Google Fonts (self-hosted or
  via the Google Fonts CDN).
- Colors: wfrc-blue as the primary brand color; wfrc-secondary-blue and wfrc-yellow
  as accents; wfrc-gray as the neutral/text color; the RTP/Wasatch Choice palette as
  the categorical palette for charts (e.g., per-firm bar/radar colors on the
  dashboard). Arbitrary chart colors MUST NOT be invented when this palette exists
  for that purpose.
- Light/dark mode MUST be supported, matching system preference, consistent with how
  wfrc-brand themes both modes.

WCAG-reasonable contrast and print-friendly PDF export MUST be layered on top of
these brand colors. Because this is an official government procurement record,
legibility takes priority over strict brand-color literalism specifically in the PDF
report (e.g., pale brand-yellow text on a white page MUST NOT be used).

**Rationale**: The app represents WFRC in an official capacity; brand consistency
and legibility in a procurement record both matter, and guessing brand values risks
getting both wrong.

### VIII. Technology Stack

The app MUST be built with Vite + React + TypeScript. Charting MUST use a
client-side library (Recharts or Chart.js, implementer's choice). PDF export MUST
use a client-side library (e.g., react-to-print, or html2canvas + jsPDF) — server-
rendered PDF generation MUST NOT be introduced. Excel read/write for the
reviewer-form workflow MUST use a client-side library (e.g., ExcelJS).

**Rationale**: A fixed, client-only stack is what makes Principles I and IV
enforceable in practice, and keeps the toolchain small enough for a single static
deployment target.

### IX. Two File Formats, Two Different Jobs

The app MUST keep these two file formats separate and MUST NOT blur their roles:
- **Project configuration and all results** are saved/loaded ONLY as `project.json`
  (the full project data model). This is the single source of truth for the project.
- **The handler-to-reviewer exchange** (sending a scoring form out, getting scores
  back) happens ONLY as `.xlsx` Excel files — never JSON, never a hosted page —
  because reviewers MUST be able to open, fill, and return the form using software
  they already have (Excel or an Excel-compatible app), with zero knowledge of this
  app. The main app MUST both generate these `.xlsx` files and parse returned
  `.xlsx` files back into `project.scores`.

**Rationale**: Reviewers are external to this app and must not be required to learn
it; Excel is the lowest-common-denominator tool they already use. Handlers, in
contrast, need one authoritative, versionable record — `project.json` — and mixing
the two formats' responsibilities would compromise both goals.

## Governance

This constitution supersedes all other project practices, templates, and informal
conventions. Where a spec, plan, task list, or piece of code conflicts with a
principle above, the principle wins and the conflicting artifact MUST be corrected.

**Amendment procedure**: Amendments are made by editing this file via the
`/speckit-constitution` command (or an equivalent direct edit that follows the same
process). Every amendment MUST update the Sync Impact Report at the top of this file,
MUST bump the version per the policy below, and MUST set "Last Amended" to the date
of the change. Amendments that remove or redefine a non-negotiable principle MUST
call out, in the Sync Impact Report, which downstream artifacts (specs, plans, tasks)
were checked for consistency.

**Versioning policy**: This constitution follows semantic versioning:
- **MAJOR** — a principle is removed or redefined in a backward-incompatible way.
- **MINOR** — a new principle or materially expanded section is added.
- **PATCH** — clarifications, wording fixes, or other non-semantic refinements.

**Compliance review**: Every `/speckit-plan` and `/speckit-implement` pass MUST
verify its output against these principles before proceeding (in particular:
Principle V when any count or scale appears in code or UI; Principle IX before
treating any exchange with reviewers as JSON or a hosted page; Principle VII before
finalizing colors, fonts, or logo usage). Complexity that appears to conflict with a
principle MUST be justified in the plan's own tracking (e.g., a "Complexity
Tracking" section) or removed.

**Version**: 1.0.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20
