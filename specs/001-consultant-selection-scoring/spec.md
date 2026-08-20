# Feature Specification: Consultant Selection Scoring

**Feature Branch**: `001-consultant-selection-scoring`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Build \"Project Scoresheet\" — a tool used by a transportation planning agency to score and rank consulting firms that responded to an RFP. Single in-memory project.json data model (firms, reviewers with city/wfrc type, weighted criteria, configurable scoring scale, sparse scores). Overall Avg = mean of all reviewer scores per firm/criterion; City Avg = mean of city-type reviewers only; both get multiplied by criterion weight and summed into two weighted totals per firm, which are ranked separately with tie-sharing. Five-area app: Load/Start (new vs. upload, routes to dashboard if scores exist or configuration if incomplete), Configuration (project info, firms, reviewers, criteria/weights, scoring scale, export/re-upload at any time), Reviewer Form Generator + Score Intake (per-reviewer .xlsx workbook with Instructions + Scoring sheets, dropdown-validated Score column, locked reference columns, hidden ID columns for row matching, single or batch generation, single-or-multi-file import with per-file diff summary and validation, plus a manual entry grid fallback), Master/Calculations view (full audit trail of every raw score, average, weight, and total), and Dashboard (ranked firm cards, completion indicators, bar chart of overall vs. city totals, per-firm criterion breakdown chart, PDF export, JSON export with user-chosen filename defaulting to a sanitized project name). Professional civic/government visual tone with print-quality PDF. Explicitly out of scope for v1: backend/login/live collaboration, email-sending, a multi-project library, and non-static hosting."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a New Scoring Project (Priority: P1)

A project handler at the agency starts a brand-new consultant-selection project: they name
it, record the committee meeting date and their own name as handler/contact, define the
criteria and their weights, define the scoring scale (point values and labels), list the
firms invited to submit and mark which ones actually submitted, and list the reviewers
(each tagged as "city" or "wfrc"). When satisfied, they export the result as a JSON file
they name themselves.

**Why this priority**: Nothing else in the app — form generation, scoring, dashboards — can
happen without a configured project. This is the foundation every other story depends on.

**Independent Test**: Starting from the Load/Start screen, a handler can walk through every
configuration field, see live validation (e.g., criterion weights summing to 1.0), and
successfully download a `project.json` file whose contents match everything they entered —
with no scores yet — without needing any other part of the app to exist.

**Acceptance Scenarios**:

1. **Given** the Load/Start screen, **When** the handler chooses "Start a new project,"
   **Then** they are taken to the Configuration area with empty project info, firms,
   reviewers, criteria, and scoring scale.
2. **Given** a project with three criteria weighted 0.5, 0.3, and 0.3, **When** the handler
   views the criteria editor, **Then** the running weight total (1.1) is shown with a
   visible warning that it does not sum to 1.0.
3. **Given** a fully configured project (name set, at least one submitted firm, at least one
   reviewer, criteria weights summing to 1.0 within tolerance, a scoring scale with at least
   2 points), **When** the handler exports the project, **Then** they are prompted for a
   filename defaulting to a sanitized version of the project name (e.g.,
   `Very_Good_Project.json`) and a valid `project.json` file downloads containing an empty
   `scores` array.
4. **Given** a project with no name set yet, **When** the handler exports before naming it,
   **Then** the default filename offered is `untitled-project.json`.
5. **Given** a firm that already has one or more scores recorded against it, **When** the
   handler attempts to remove that firm, **Then** the app asks for confirmation before
   deleting it.

---

### User Story 2 - Generate and Distribute Reviewer Scoring Forms (Priority: P2)

Once configuration is complete, the handler generates an Excel workbook for a specific
reviewer (or all reviewers at once) containing that reviewer's scoring task — the submitted
firms crossed with the criteria — and downloads it to email out individually. Each reviewer
opens the workbook in whatever spreadsheet software they already have, with no need to know
anything about this app.

**Why this priority**: This is the mechanism that gets scoring data from reviewers back into
the system without requiring reviewers to use the app; without it, the app cannot collect
real scores at all. It depends on Story 1 having produced a configured project.

**Independent Test**: Given any fully configured project (firms, reviewers, criteria,
scale), generating a form for one reviewer produces a downloadable `.xlsx` file that opens
correctly in Excel, showing an Instructions sheet and a Scoring sheet with one row per
submitted-firm × criterion pair, independent of whether any scores have been entered
anywhere yet.

**Acceptance Scenarios**:

1. **Given** a configured project with 3 submitted firms and 4 criteria, **When** the
   handler generates a form for one reviewer, **Then** the downloaded workbook's Scoring
   sheet contains exactly 12 rows (3 firms × 4 criteria), each with Firm, Criterion,
   Criterion Description, an empty Score cell, and an empty Comments cell.
2. **Given** a generated workbook, **When** the reviewer clicks a Score cell, **Then** only
   the configured scale's values are selectable (no free-typed out-of-range numbers).
3. **Given** a generated workbook, **When** the reviewer attempts to edit the Firm,
   Criterion, or Criterion Description columns, **Then** the edit is prevented by
   sheet/cell protection.
4. **Given** a project with 6 reviewers, **When** the handler chooses "download all forms,"
   **Then** they receive one correctly scoped workbook per reviewer without generating extra
   or missing files.
5. **Given** a generated workbook, **When** its hidden reference columns are inspected,
   **Then** each row carries the correct reviewer, firm, and criterion identifiers used
   later to match the row back to the project data on import.

---

### User Story 3 - Import Returned Scores and View Ranked Results (Priority: P1)

As completed reviewer workbooks come back (one at a time or all together), the handler
uploads them into the app. The app matches each row to the right reviewer/firm/criterion,
flags anything that fails validation, and shows a before/after summary before committing.
The dashboard then shows ranked firms, weighted totals, per-criterion breakdowns, and how
complete the scoring is — usable at any point, even with only some reviewers having
responded.

**Why this priority**: This is the payoff of the whole workflow — turning collected scores
into a rankable, presentable result — and is the single most valuable moment for the
committee viewing the outcome. Import depends on Story 2 having produced valid workbooks
(or Story 5's manual entry as an alternative path).

**Independent Test**: Given a configured project and one or more completed `.xlsx`
workbooks (single or multi-file selection), importing them updates `project.scores`
correctly, surfaces a per-file summary of added/failed rows, and the dashboard immediately
reflects the new scores, rankings, and completion status — independent of whether all
reviewers have responded yet.

**Acceptance Scenarios**:

1. **Given** one completed reviewer workbook, **When** the handler imports it, **Then** they
   see a summary (e.g., "12 scores added") before the import is committed, and confirming
   commits those scores into the project.
2. **Given** three completed workbooks selected at once, **When** the handler imports them,
   **Then** a per-file summary is shown (e.g., "Reviewer X: 12 scores added, Reviewer Y: 3
   rows failed validation"), and only valid rows are committed.
3. **Given** a workbook row whose Score value is not one of the project's configured scale
   values, **When** it is imported, **Then** that row is flagged as failed validation and
   excluded rather than silently accepted.
4. **Given** a firm scored by only 4 of 6 reviewers, **When** the dashboard displays that
   firm's average, **Then** it is computed only from the 4 available scores and is visibly
   labeled as partial (e.g., "4/6 reviewers scored").
5. **Given** a project where all submitted firms have complete scoring, **When** the
   dashboard is viewed, **Then** firms are ranked by Overall Weighted Total and separately by
   City Weighted Total, with tied totals sharing a rank and the next rank skipping
   accordingly.
6. **Given** the dashboard, **When** the handler chooses "Export PDF report," **Then** a
   print-quality PDF is produced containing the project header, ranking summary, charts, and
   per-firm detail with comments.

---

### User Story 4 - Reopen a Project File (Priority: P2)

Anyone with a `project.json` file — the handler continuing later, or a committee member who
just wants to see results — opens the app and uploads that file. If it already has scores,
they land directly on the results dashboard with no setup required. If it's still an
in-progress configuration, they land back in Configuration at a sensible point to keep
filling it in.

**Why this priority**: The app is explicitly stateless between sessions (no server-side
project storage), so reopening a previously exported file is the only way work continues
across sessions or is shared with someone else. It depends on Stories 1 and 3 having
produced files with configuration and/or scores to reopen.

**Independent Test**: Given two sample files — one with only configuration filled in and no
scores, one with configuration plus scores — uploading each from the Load/Start screen
routes to Configuration and Dashboard respectively, with no other part of the app involved.

**Acceptance Scenarios**:

1. **Given** the Load/Start screen, **When** a user uploads a `project.json` that contains
   one or more entries in `scores`, **Then** they land directly on the Dashboard in a
   view-oriented mode.
2. **Given** the Load/Start screen, **When** a user uploads a `project.json` with no entries
   in `scores` (regardless of how much configuration is filled in), **Then** they land on
   Configuration, pre-filled with whatever was already present in the file.
3. **Given** a user viewing the Dashboard after uploading a scored project, **When** they
   choose to edit, **Then** they can switch into Configuration without losing any already
   entered data.

---

### User Story 5 - Manually Enter Reviewer Scores (Priority: P3)

When a reviewer reports their scores back informally (by phone, email text, or paper) rather
than returning the generated workbook, the handler enters those scores directly into a
spreadsheet-like grid in the app, one reviewer at a time.

**Why this priority**: This is a fallback path for the minority of cases where the Excel
round-trip (Story 2/3) isn't used; the app must not require the workbook exchange to
function, but it's not the primary path most reviewers will use.

**Independent Test**: Given a configured project and no imported workbook at all, a handler
can select a reviewer, enter a score and optional comment for every submitted firm ×
criterion cell in the grid, and see those scores reflected in the dashboard exactly as if
they had been imported from a workbook.

**Acceptance Scenarios**:

1. **Given** the manual entry grid for a selected reviewer, **When** the handler types a
   score outside the configured scale's values, **Then** the entry is rejected or flagged,
   matching the same validation applied to workbook imports.
2. **Given** scores entered manually for one reviewer, **When** the handler later imports a
   workbook for the same reviewer covering the same firm/criterion cells, **Then** the
   workbook import overwrites the manually entered values for those specific cells (last
   input wins, matched by reviewer/firm/criterion).

---

### Edge Cases

- What happens when a handler tries to generate reviewer forms before configuration is
  complete (e.g., no criteria defined, or weights not summing to 1.0)? The app should block
  or clearly warn rather than generate a meaningless workbook.
- What happens when an imported workbook's hidden ID columns reference a firm, reviewer, or
  criterion that no longer exists in the current project (e.g., it was deleted after the
  form was sent out)? Those rows must be flagged as failed/unmatched, not silently dropped
  or misapplied to the wrong entity.
- What happens when a criterion is deleted after it has already been scored? Existing score
  entries for that criterion are excluded from all calculations going forward (the criterion
  no longer exists to weight against); the handler is warned before deletion if scores exist,
  mirroring the firm-removal confirmation.
- How does the dashboard behave when zero firms have any scores yet? It should still render
  (project header, firm list with 0/N completion) rather than error or show a blank page.
- What happens if two firms end up with identical weighted totals? They share the same rank,
  and the next distinct rank skips the appropriate number of positions (e.g., 1, 1, 3).
- What happens when a project JSON is uploaded that doesn't match the expected schema at
  all (e.g., an unrelated JSON file)? The app must reject it with a clear error rather than
  attempting to render a broken configuration or dashboard.

## Requirements *(mandatory)*

### Functional Requirements

**Load / entry**

- **FR-001**: The app MUST present exactly two entry actions on the initial screen: "Start a
  new project" and "Upload a project file," with no project list or account step.
- **FR-002**: Uploading a project file containing one or more score entries MUST route
  directly to the Dashboard.
- **FR-003**: Uploading a project file containing no score entries MUST route to
  Configuration, pre-populated with whatever data the file already contains.
- **FR-004**: The app MUST reject a file that does not match the expected project schema
  with a clear, human-readable error, without partially loading it.

**Configuration**

- **FR-005**: The app MUST let the handler edit project info (project name, handler/contact
  name, committee meeting date, notes).
- **FR-006**: The app MUST let the handler add, edit, and remove firms, each with an
  invited flag, a submitted flag, and notes.
- **FR-007**: The app MUST ask for confirmation before removing a firm that has any score
  entries attached to it.
- **FR-008**: The app MUST let the handler add, edit, and remove reviewers, each with a
  name, an explicit type of either "city" or "wfrc," and an optional email.
- **FR-009**: The app MUST let the handler add, edit, and remove scoring criteria, each with
  a name, a numeric weight, and a description.
- **FR-010**: The app MUST show a running total of criterion weights and a visible warning
  whenever that total is not 1.0 within a ±0.001 tolerance.
- **FR-011**: The app MUST let the handler define a scoring scale as a list of points, each
  with a numeric value and a label, and MUST require at least 2 points.
- **FR-012**: The number of firms, reviewers, criteria, and scoring-scale points MUST be
  unrestricted by the app (no hardcoded assumptions about count).
- **FR-013**: "Export project JSON" and "Upload a different project JSON" MUST be available
  from the Configuration area at all times, not gated behind a single save step.
- **FR-014**: Every JSON export MUST let the handler choose the filename at download time,
  defaulting to a sanitized version of the current project name, and falling back to
  `untitled-project.json` only when no project name is set.

**Reviewer form generation and score intake**

- **FR-015**: The app MUST generate a real `.xlsx` workbook per reviewer containing an
  Instructions sheet (project name, reviewer name, the scoring scale legend, and edit
  guidance) and a Scoring sheet with one row per submitted-firm × criterion pair.
- **FR-016**: The Scoring sheet MUST include, per row: Firm, Criterion, Criterion
  Description, Score, and Comments — with a distinct Comments cell per score, not one
  comment per firm.
- **FR-017**: The Score column MUST restrict entry to the project's configured scale values
  via in-file validation (e.g., a dropdown), and the Firm, Criterion, and Criterion
  Description columns MUST be protected against edits.
- **FR-018**: Each row MUST carry hidden, protected identifiers for its reviewer, firm, and
  criterion, and these identifiers — not the visible text — MUST be what the app uses to
  match rows back to the project data model on import.
- **FR-019**: The app MUST offer both a single-reviewer "download form" action and a
  "download all forms" batch action covering every reviewer on the project.
- **FR-020**: The app MUST let the handler import one or multiple completed `.xlsx`
  workbooks in a single action.
- **FR-021**: On import, each row MUST be validated: its Score value MUST be one of the
  project's configured scale values, and the row's identifiers MUST match an existing
  reviewer, firm, and criterion in the current project; rows failing either check MUST be
  flagged and excluded rather than silently accepted.
- **FR-022**: Before committing an import, the app MUST show a summary of the changes,
  per file when multiple files are imported (e.g., counts of scores added and rows failed
  validation).
- **FR-023**: Imported scores MUST overwrite any prior entry for the same
  reviewer/firm/criterion combination.
- **FR-024**: The app MUST provide a manual entry grid (firms × criteria, per selected
  reviewer) as an alternative to workbook import, applying the same score-value validation.

**Calculations and transparency**

- **FR-025**: Only firms with `submitted = true` MUST be included in scoring, ranking, and
  averages.
- **FR-026**: Overall Avg for a firm/criterion MUST be the mean of all reviewers' recorded
  scores for that cell, ignoring reviewers who have not yet scored it.
- **FR-027**: City Avg for a firm/criterion MUST be the mean of recorded scores from
  reviewers of type "city" only; reviewers of type "wfrc" MUST contribute to Overall Avg
  only, never to City Avg.
- **FR-028**: Overall Weighted Total and City Weighted Total for a firm MUST each equal the
  sum, across criteria, of that criterion's respective average multiplied by its weight.
- **FR-029**: Firms MUST be ranked twice — once by Overall Weighted Total and once by City
  Weighted Total — using standard competition ranking (tied totals share a rank; the next
  distinct rank skips accordingly).
- **FR-030**: Everywhere a computed average or total is displayed, the app MUST also show
  how many of the applicable reviewers have scored so far (e.g., "4/6 reviewers scored") so
  a partial result is never presented as if it were final.
- **FR-031**: The app MUST provide an optional "show calculations" view, reachable in one
  action, that displays every reviewer's raw score per firm per criterion alongside the
  computed averages, weights, weighted sub-totals, and final totals — with nothing omitted.

**Dashboard and reporting**

- **FR-032**: The Dashboard MUST display the project header (name, contact, meeting date).
- **FR-033**: The Dashboard MUST show a ranked list of firms with rank, Overall Weighted
  Total, City Weighted Total, and a completion indicator per firm.
- **FR-034**: The Dashboard MUST include a chart comparing firms on Overall vs. City
  weighted totals, and a per-firm breakdown chart showing scores by criterion.
- **FR-035**: The app MUST support exporting a print-quality PDF containing the project
  header, ranking summary, charts, and a per-firm detail section including comments.
- **FR-036**: "Export project JSON" MUST be available from the Dashboard, producing the same
  filename-choice behavior as FR-014, including all scores collected so far.
- **FR-037**: Viewing the Dashboard for an already-scored project MUST require no
  configuration steps.

### Key Entities

- **Project**: The single unit of work the app operates on at any time — holds project
  info (name, contact, meeting date, notes), the scoring scale, the criteria list, the
  firms list, the reviewers list, and the flat scores collection. Persisted only via
  explicit JSON export/import.
- **Scoring Scale Point**: One selectable score value in a project's scale, consisting of a
  numeric value and a descriptive label; a project has 2 or more of these.
- **Criterion**: A named, weighted dimension firms are scored against, with a description
  shown to reviewers; a project's criteria weights must sum to 1.0.
- **Firm**: A consulting firm invited to respond to the RFP, tracked as invited/submitted
  with notes; only submitted firms are scored and ranked.
- **Reviewer**: A person scoring firms, with an explicit type ("city" or "wfrc") that
  determines whether their scores count toward the City average in addition to Overall.
- **Score**: One reviewer's rating (plus optional comment) for one firm on one criterion;
  sparse by nature (absence means "not yet scored," never zero).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A handler can take a project from a blank start through a fully configured
  state (project info, ≥1 submitted firm, ≥1 reviewer, criteria weights summing to 1.0, a
  scoring scale of at least 2 points) and export a valid project file, without needing help
  beyond in-app guidance.
- **SC-002**: A reviewer who has never seen this app can open a generated scoring workbook
  in ordinary spreadsheet software and correctly complete their scoring using only the
  workbook's own Instructions sheet — no separate documentation or app access required.
- **SC-003**: After importing completed reviewer workbooks, 100% of the resulting dashboard
  figures (averages, weighted totals, ranks) match hand-calculated values from the same raw
  scores.
- **SC-004**: Opening a project file that already contains scores lands the viewer on a
  readable ranked-results view with zero additional configuration steps.
- **SC-005**: Every number shown on the Dashboard can be traced, via the calculations view,
  back to the specific raw reviewer scores that produced it — with no computed value that
  cannot be explained this way.
- **SC-006**: The same app, without any code change, supports at least two projects with
  materially different shapes (e.g., 2 firms/3 reviewers/3 criteria on a 2-point scale, and
  6 firms/8 reviewers/6 criteria on a 5-point scale) with correct results in both.
- **SC-007**: No project data (scores, comments, firm or reviewer names) is ever observed
  leaving the browser in outbound network requests during normal use.
- **SC-008**: The exported PDF report remains fully legible (all text readable, no
  low-contrast text) when printed in black-and-white.
- **SC-009**: A handler can complete a full round trip — import a batch of 3+ reviewer
  workbooks in one action and see the dashboard fully updated — in under one minute of
  in-app time, excluding file-selection time.

## Assumptions

- The handler is a single person operating the app at a time per project; concurrent
  multi-handler editing of the same live session is out of scope (consistent with "no
  backend, no accounts").
- Displayed averages and totals are rounded to 2 decimal places for readability, while the
  calculations view shows enough precision to verify the rounding is correct.
- "Download all forms" packages the per-reviewer workbooks in a way a browser can hand to
  the user in one action (e.g., a zip archive); the exact packaging mechanism is an
  implementation detail, not a user-facing requirement beyond "one action produces all
  files."
- Excel workbook protection (locked cells, protected sheets) is used to prevent accidental
  edits, not to secure the file against a deliberate attempt to bypass it; no password is
  required.
- If a criterion is deleted after scores exist against it, those score entries are retained
  in the data but excluded from all calculations (since the criterion they reference no
  longer exists), and the handler is warned before deletion — mirroring firm-removal
  behavior (FR-007).
- Reviewer email addresses, when provided, are for the handler's own reference when sending
  forms manually; the app itself never sends email.
- "City" and "wfrc" are the only two reviewer types needed, per the confirmed source
  spreadsheet's business rule (city reviewers count toward both Overall and City averages;
  wfrc reviewers count toward Overall only).
