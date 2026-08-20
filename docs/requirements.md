# Consultant Selection Scoring App — Requirements & Spec-Kit Instruction Package

Status: **Planning only — nothing has been built yet.**
Purpose: this document is what you paste into Claude Code (via GitHub spec-kit) in stages. Each section below maps to one spec-kit command. Copy the labeled blocks in order; don't paste the whole document at once.

---

## 0. What the current spreadsheet actually does (confirmed from your file)

- **Setup sheet**: project metadata, a firms list (invited + submitted Y/N + notes), a flat reviewer name list, criteria + weights (must sum to 1), and a 3-point scoring scale (1/3/5) with descriptions.
- **Master Composite sheet**: one block per firm (only firms marked "submitted" are pulled in). For each criterion it computes an **Overall Avg** (all reviewers), a **City Avg** (city reviewers only — currently just the first N columns, which is fragile), then multiplies each by the criterion weight to get **Overall Wtd** and **City Wtd**, sums those into two weighted totals per firm, and ranks firms on each total.
- **Reviewer Score Sheet** (one tab per reviewer): reviewer picks their name, sees criteria/weights/descriptions, scores each submitted firm per criterion with comments.
- Key business rule you confirmed: **WFRC reviewers count toward the Overall score only. City reviewers count toward both Overall and a separate City-only score.**

The one real fragility in the original sheet: reviewer type is implied by column position, not a real field. The new app fixes that with an explicit `type` on every reviewer.

---

## 1. Non-negotiable constraints (put these in `/speckit.constitution`)

```
/speckit.constitution

This project is a Vite-based JavaScript/TypeScript single-page app, hosted as a fully
static site on GitHub Pages. Non-negotiable principles:

1. NO BACKEND, NO DATABASE, NO ACCOUNTS. The app must run entirely client-side and be
   deployable as static files. Any feature requiring a server is out of scope.
2. STATELESS BETWEEN SESSIONS BY DEFAULT. The app must not silently persist project
   data across browser sessions/reloads as the source of truth. The single source of
   truth is a project JSON file the user explicitly downloads (export) and later
   re-opens (import). It is acceptable to use in-memory state, and optionally
   sessionStorage/localStorage purely as a "recover unsaved work" convenience — but
   never as a substitute for explicit export, and it must be clearly labeled as
   temporary/local-only, easy to clear, and never treated as a project list.
3. ONE PROJECT AT A TIME. The app has no concept of a multi-project dashboard or
   project library. It loads exactly one project JSON at a time and edits it in memory.
4. PRIVACY / CONFIDENTIALITY. Scores and comments are sensitive (consultant selection).
   Never call any external API with project data. No analytics that transmit content.
   Everything happens in the browser.
5. FLEXIBILITY OVER HARD-CODING. Number of firms, number of reviewers, number of
   criteria, and the scoring scale (number of points + their labels) must all be
   fully configurable per project — never hard-coded to today's example (4 firms,
   6 reviewers, 4 criteria, 1/3/5 scale).
6. TRANSPARENCY. Every computed number (averages, weighted scores, ranks) must be
   traceable back to raw inputs in an optional "show calculations" view — nothing
   should be a black box, mirroring how the original spreadsheet showed its formulas.
7. WFRC BRAND IDENTITY. This app is not a Quarto site, but its visual identity must
   follow the Wasatch Front Regional Council brand defined in
   https://github.com/WFRCAnalytics/wfrc-brand. Before implementing any styling,
   fetch/clone that repo and read the actual values directly rather than guessing:
     - _extensions/wfrc-brand/brand.yml — the portable brand.yml spec (colors,
       typography, logo declarations)
     - _extensions/wfrc-brand/assets/theme/_wfrc-colors.scss — exact hex values for
       the brand color tokens (wfrc-blue, wfrc-secondary-blue, wfrc-yellow, wfrc-gray,
       plus RTP and Wasatch Choice palette colors)
     - _extensions/wfrc-brand/assets/theme/_wfrc-fonts.scss — exact font stacks
     - _extensions/wfrc-brand/assets/logo/ — logo assets (horizontal/stacked/
       abbreviated, color/white variants); copy the appropriate files into this
       project's own assets rather than referencing the other repo at runtime
   If this repo genuinely cannot be reached from the build/dev environment, stop and
   flag that rather than inventing brand values.
   Translate these into CSS custom properties / Tailwind theme tokens in this app —
   do not pull in Quarto tooling itself, just mirror the brand values:
     - Typography: Poppins for body text, Inter for headings/navigation/labels,
       Fira Code for any monospace or code-style display, all loaded from Google
       Fonts (self-host or use the same Google Fonts CDN approach)
     - Colors: wfrc-blue as the primary brand color, wfrc-secondary-blue and
       wfrc-yellow as accents, wfrc-gray as the neutral/text color, and the RTP/
       Wasatch Choice palette as the categorical palette for charts (e.g. per-firm
       bar/radar colors on the dashboard) — never invent arbitrary chart colors
       when this palette exists for the purpose
     - Support light/dark mode matching system preference, consistent with how
       wfrc-brand themes both modes
   Layer WCAG-reasonable contrast and print-friendly PDF export on top of these
   brand colors — this is still an official government procurement record, so
   legibility takes priority over strict brand-color literalism in the PDF report
   specifically (e.g. don't render pale brand-yellow text on white in print).
8. TECH STACK: Vite + React + TypeScript. Charting library of implementer's choice
   (Recharts or Chart.js). PDF export via a client-side library (e.g. react-to-print,
   or html2canvas + jsPDF). No server-rendered PDF generation. Excel read/write via a
   client-side library (e.g. ExcelJS) for the reviewer-form workflow — see Section 3.
9. TWO FILE FORMATS, TWO DIFFERENT JOBS — do not blur these:
   - Project configuration + all results are saved/loaded ONLY as project.json
     (the full data model in Section 2). This is the single source of truth.
   - The handler-to-reviewer exchange (sending a scoring form out, getting scores
     back) happens ONLY as .xlsx Excel files — never JSON, never a hosted page —
     because reviewers should be able to open, fill, and return the form using
     software they already have (Excel, or Excel-compatible apps), with zero
     knowledge of this app. The main app both generates these .xlsx files and
     parses returned .xlsx files back into project.scores.
```

---

## 2. Data model (this is the backbone — get this right before anything else)

Give Claude Code this schema verbatim as part of `/speckit.specify` (Section 3 below embeds it). Everything else in the app is a view over this JSON.

```jsonc
{
  "schemaVersion": "1.0",
  "project": {
    "projectName": "",
    "localGovContact": "",
    "procurementAgent": "",          // WFRC PM
    "committeeMeetingDate": "",      // ISO date
    "notes": ""
  },
  "scoringScale": [
    // fully configurable: any number of points, each with a numeric value + label
    { "value": 1, "label": "Completely unqualified" },
    { "value": 3, "label": "Adequate, acceptable experience" },
    { "value": 5, "label": "More than qualified; will produce an excellent product" }
  ],
  "criteria": [
    {
      "id": "crit-1",
      "name": "Project Approach and Schedule",
      "weight": 0.20,               // fractional; all criteria weights must sum to 1.0
      "description": ""
    }
  ],
  "firms": [
    {
      "id": "firm-1",
      "name": "Meta",
      "invited": true,
      "submitted": true,            // non-submitting firms are excluded from scoring/ranking
      "notes": ""
    }
  ],
  "reviewers": [
    {
      "id": "rev-1",
      "name": "Mark",
      "type": "city",               // "city" | "wfrc"  — explicit field, not column order
      "email": ""
    }
  ],
  "scores": [
    // flat/normalized — one row per (reviewer, firm, criterion). Sparse: a reviewer who
    // hasn't scored a given firm/criterion yet simply has no entry here.
    {
      "reviewerId": "rev-1",
      "firmId": "firm-1",
      "criterionId": "crit-1",
      "value": 4,
      "comment": "",
      "updatedAt": "2026-08-20T00:00:00Z"
    }
  ]
}
```

**Everything below is derived, never stored:**
- `overallAvg(firm, criterion)` = mean of `value` across all reviewers who scored that firm/criterion (any type)
- `cityAvg(firm, criterion)` = mean of `value` across reviewers where `type == "city"` only
- `overallWeightedTotal(firm)` = Σ over criteria of `overallAvg(firm, criterion) × criterion.weight`
- `cityWeightedTotal(firm)` = Σ over criteria of `cityAvg(firm, criterion) × criterion.weight`
- Ranks computed only among firms where `submitted == true`, sorted descending by the relevant total, ties handled the way Excel `RANK()` does (equal scores share a rank, next rank skips)
- Completion tracking: for each firm, what fraction of expected (reviewer × criterion) cells are filled in — needed so the dashboard can flag "3 of 6 reviewers still pending" rather than silently averaging partial data as if it were final

---

## 3. Functional spec (paste as `/speckit.specify`)

```
/speckit.specify

Build "Consultant Selection Scoring" — a tool used by a transportation planning agency
to score and rank consulting firms that responded to an RFP.

DATA MODEL
Use exactly this JSON shape as the single project data structure (paste schema from
Section 2 above). All app state derives from and edits this object in memory.

CALCULATION RULES
- A firm is only scored/ranked if firms[].submitted === true.
- Overall Avg per firm per criterion = mean of all reviewers' scores for that cell.
- City Avg per firm per criterion = mean of scores from reviewers with type "city" only.
  WFRC-type reviewers contribute to Overall Avg only, never to City Avg.
- Overall Weighted Total (firm) = sum across criteria of (Overall Avg × criterion weight).
- City Weighted Total (firm) = sum across criteria of (City Avg × criterion weight).
- Firms are ranked twice: once by Overall Weighted Total, once by City Weighted Total.
  Ties share a rank (standard competition ranking, like Excel RANK()).
- Criterion weights must sum to 1.0 (±0.001 tolerance); show a validation warning
  anywhere weights are edited if they don't.
- Averages must ignore missing (not-yet-entered) scores rather than treating them as
  zero, and the UI must visibly flag incomplete scoring (e.g. "4/6 reviewers scored")
  wherever a computed average is shown, so an early partial average is never mistaken
  for a final result.

END-TO-END WORKFLOW (this is the flow the app must support, in order — use it to
sanity-check the app structure below)

  1. Homepage: exactly two choices — "Start a new project" or "Upload a project file."
  2a. Upload path: user picks a project.json.
      - If it's already got scores in it, go straight to the DASHBOARD (view mode).
      - If it's incomplete (partial config, partial/no scores), go to CONFIGURATION
        so the handler can keep filling it in, then re-download the updated
        project.json when done — same file, just further along.
  2b. New project path: walks the handler through CONFIGURATION — project name,
      handler name, committee date, criteria + weights, scoring scale, the list of
      invited firms and which responded, and the reviewer list with each one tagged
      city or WFRC.
  3. Once configuration is complete: handler generates and downloads the reviewer
     .xlsx forms (one per reviewer) and emails each one out individually.
  4. Handler downloads project_name.json (see naming rule below) and keeps it as the
     local record of the configuration before any scores come back.
  5. As completed .xlsx files arrive from reviewers, the handler uploads them into the
     app — one at a time, or in bulk (support selecting multiple files in one upload
     action; see Section 3 below) — which populates project.scores.
  6. The DASHBOARD updates automatically as scores come in (partial results are fine
     to view, as long as completion status is visibly flagged per the calculation
     rules above).
  7. Handler exports the final PDF report, and downloads the updated project_name.json
     (now containing all scores) to keep as the final record.

PROJECT FILE NAMING
- Every JSON export should let the handler name the file themselves at download time
  (a standard save-file prompt/filename field), defaulting to a sanitized version of
  the current project name, e.g. "Very_Good_Project.json" — not a generic
  "project.json," and not forced/locked to that default either. Fall back to
  something like "untitled-project.json" only if no project name is set yet. This
  applies at every export point in the workflow (step 4 and step 7 above), not just
  a final "save."

APP STRUCTURE (5 areas)

1. LOAD / START screen
   - Exactly two entry actions, side by side: "Start a new project" and "Upload a
     project file" (file picker for project.json). No project list, no accounts —
     this is the sole entry point every session.
   - Uploading a project JSON that already has scores in it routes straight to the
     DASHBOARD (area 5) in a read/view-oriented mode — anyone with the project.json,
     not just the handler, should be able to open the app, upload it, and immediately
     see at-a-glance results, then optionally switch into editing if they need to.
   - Uploading a project JSON that's incomplete (config not finished, and/or no
     scores yet) routes to CONFIGURATION (area 2) at whatever step makes sense given
     what's already filled in, so the handler can pick up where they left off and
     re-export when ready.

2. CONFIGURATION area (the "project handler" role — used both for a brand-new
   project and to resume an incomplete uploaded one)
   - Project info form (name, handler name, committee meeting date, notes)
   - Firms editor: add/remove firms, mark invited/submitted, notes. Removing a firm
     should ask for confirmation if it already has scores attached.
   - Reviewers editor: add/remove reviewers, name + type (city/wfrc) + optional email
   - Criteria & weights editor: add/remove criteria, name, weight, description; live
     validation that weights sum to 1.0 with a running total shown
   - Scoring scale editor: add/remove scale points, each with a numeric value and a
     label; must have at least 2 points
   - "Export project JSON" and "Upload a different project JSON" available from this
     area at all times (this is the save/resume mechanism, not a single save button)
   - Once the handler considers configuration complete, a clear next step forward
     into area 3 (generate reviewer forms) — this is the natural point in the
     workflow where they'd download project_name.json as the pre-scoring record
     (step 4 above) before sending forms out

3. REVIEWER FORM GENERATOR + SCORE INTAKE — EXCEL-BASED (the two-way piece that
   replaces "sending a sheet to reviewers")
   - "Generate reviewer form" produces a real .xlsx workbook (built client-side, e.g.
     with ExcelJS) for ONE selected reviewer — NOT an HTML file, NOT a JSON file. The
     reviewer must be able to open it in Excel (or Google Sheets/LibreOffice) with no
     knowledge of this app at all.
   - Workbook layout (be explicit, don't leave this to guesswork):
       - An "Instructions" sheet: project name, reviewer name, the scoring scale
         legend (each configured value + its label), and a one-line note that only
         the "Score" and "Comments" columns should be edited.
       - A "Scoring" sheet: one row per (submitted firm × criterion) pair — a flat
         table, not the old nested block layout — with columns:
         Firm | Criterion | Criterion Description | Score | Comments.
         Every score gets its own Comments cell on the same row (i.e. a comment per
         individual score, not one comment box for the whole firm) — this matches
         how the original spreadsheet captured per-criterion debrief notes.
         "Score" cells use Excel data validation restricted to the configured scale's
         values (dropdown list) so the reviewer can't type an out-of-range number.
         Every other column (Firm, Criterion, Criterion Description) is locked via
         sheet/cell protection so it can't be accidentally edited or reordered.
       - Hidden, protected columns to the right of the visible table carry
         reviewerId, firmId, and criterionId for each row. These are what the app
         uses to match rows back to the data model on import — never re-derive the
         match from the visible firm/criterion NAME text, since that's exactly what
         a reviewer could accidentally edit.
   - Same generator should offer this per reviewer individually ("download form for
     [reviewer]") and a "download all forms" batch action (one workbook per reviewer,
     either zipped or as sequential downloads) to hand out at once — the handler then
     emails each one to its reviewer individually (the app doesn't send email).
   - Back in the main app, the handler has two ways to get scores in:
       a) "Import completed reviewer workbook(s)" — a file picker that accepts either
          a single .xlsx or multiple at once (multi-select), since the handler may
          upload returned forms one at a time as they trickle in, or all together
          once everyone's responded. Each file is read via its hidden ID columns and
          merged into project.scores (matched by reviewerId/firmId/criterionId,
          overwriting any prior entries for that reviewer on those cells). Show a
          before/after diff/summary for confirmation before committing — for a
          multi-file upload, summarize per file (e.g. "Reviewer X: 12 scores added,
          Reviewer Y: 3 rows failed validation"). Validate on import that every Score
          value is one of the configured scale values and flag any row that fails
          validation instead of silently accepting it.
       b) Manual entry grid — a spreadsheet-like grid in the app itself (firms ×
          criteria, per selected reviewer) for typing scores in directly, for when a
          reviewer reports scores back by phone/email/paper instead of the workbook.

4. MASTER / CALCULATIONS view ("show your work" — optionally visible)
   - Hidden by default behind a toggle (e.g. "Show calculations" / advanced view),
     but must be reachable in one click for anyone who wants to audit the numbers.
   - Reproduces the transparency of the original spreadsheet's Master Composite tab:
     per firm, a full grid of every reviewer's raw score per criterion, the computed
     Overall Avg / City Avg / weights / Overall Wtd / City Wtd per criterion, and the
     two weighted totals — nothing hidden, everything traceable to raw inputs.
   - This is also a reasonable place to host the manual score-entry grid from area 3b.

5. DASHBOARD / RESULTS page (default landing view once a project has data — must be
   understandable "at a glance")
   - Project header (name, contact, meeting date)
   - Ranked firm list/cards showing rank, Overall Weighted Total, City Weighted Total,
     and a completion indicator (how many reviewers have scored so far)
   - A bar chart comparing firms on Overall vs City weighted totals
   - A per-firm breakdown (e.g. radar/spider chart or grouped bars) showing scores by
     criterion, so a viewer can see WHY a firm ranked where it did, not just the number
   - "Export PDF report" — produces a print-quality PDF containing the project header,
     ranking summary, charts, and a per-firm detail section with comments, suitable for
     the official procurement file
   - "Export project JSON" always available here too — this is the final
     project_name.json save (step 7 of the workflow above), now containing every
     score, and it's what the handler keeps as the permanent record alongside the PDF
   - This page must work purely as a viewer: loading a project.json that already has
     scores and landing here should require no configuration step at all — the two
     deliverables from a completed project are the PDF (for the official record) and
     the project.json itself (for anyone who needs to reopen and re-view or continue
     editing later)

VISUAL DESIGN
- Professional civic/government tone: restrained palette, clear type hierarchy, no
  playful UI. Should look credible attached to a public procurement record.
- Print/PDF layouts are a first-class concern, not an afterthought — check how the
  dashboard looks in the exported PDF, not just in-browser.

OUT OF SCOPE FOR V1 (call these out explicitly so the agent doesn't build them)
- No backend, no login, no live multi-user collaboration
- No email-sending (the app produces files; the human sends the email)
- No project library/multi-project dashboard
- No non-static hosting (must work as GitHub Pages static files)
```

---

## 4. Suggested `/speckit.clarify` follow-ups

After `/speckit.specify`, run `/speckit.clarify` — it will likely surface questions like tie-break display, decimal rounding, what happens to scores if a criterion is deleted after scoring started, and how strictly to lock down the generated Excel workbook (full sheet protection with a password, or just cell-level locking without a password — no password is fine, the protection is to prevent accidental edits, not to secure the file). Answer those in the moment; you don't need me for that stage, but paste me the clarify output if any answer feels like a real design fork and I'll sanity-check it before you proceed to `/speckit.plan`.

---

## 5. What to do at `/speckit.plan` and `/speckit.tasks`

These two stages are where Claude Code decides file structure, libraries, and task breakdown. You mostly don't need to feed it much beyond the constitution + spec — but two things worth adding explicitly when you run `/speckit.plan`:

```
/speckit.plan

Prefer Recharts for charts (React-native, good SVG output for PDF export) and
react-to-print or html2canvas+jsPDF for the PDF report. Use ExcelJS for both
generating reviewer workbooks (data validation dropdowns + cell/sheet protection +
hidden ID columns, per Section 3) and parsing returned workbooks back into scores —
one library for both directions keeps this simpler than mixing libraries. Flag and
resolve any Node/Buffer polyfill issues ExcelJS needs when bundled by Vite for the
browser (it's a common gotcha — confirm the generated workbook actually opens
correctly in real Excel, not just that the JS ran without errors). Use TypeScript
throughout. State management: plain React state/context is enough — do not add
Redux/Zustand for a single in-memory object of this size. Deploy via GitHub Actions
to GitHub Pages (vite.config base path set for project pages).
```

Let `/speckit.tasks` and `/speckit.analyze` run as normal — those don't need your input, just review the generated `tasks.md` for anything that looks like it drifted from the constraints above (most common drift: someone adding localStorage-as-database, or a "projects list" screen).

---

## 6. Review checklist — bring me the output at each stage

When you paste back what Claude Code produces, here's what I'll actually check:

**After `/speckit.specify` / `/speckit.plan`:**
- Does the data model match Section 2 exactly (especially: is `reviewer.type` a real explicit field, not inferred)?
- Does anything imply a backend, accounts, or persistent multi-project storage?
- Is the City/WFRC averaging rule stated correctly (WFRC → Overall only; City → both)?

**After `/speckit.tasks`:**
- Are the 5 app areas from Section 3 all represented as discrete tasks?
- Is the reviewer workbook generation/parsing treated as real .xlsx read/write (ExcelJS or equivalent), not accidentally simplified into a JSON download or an HTML form? The reviewer must never need to touch this app or a browser to fill out their scores.
- Do the generated workbook and the import/parse logic agree on the same hidden-ID-column approach, so matching survives a reviewer renaming a firm column header or reordering rows?
- Is weight-sum validation and "ignore missing scores in averages" called out anywhere, or did it get lost?

**After `/speckit.implement` (actual code):**
- I'll want to see: the core calculation module (ideally pure functions, unit-testable, no React) — paste that file specifically, it's the highest-risk-of-bugs piece
- The exported project JSON of a small test run (2 firms, 2 reviewers, 2 criteria) so I can hand-check the math against what you'd expect from the spreadsheet
- Open the generated reviewer .xlsx in actual Excel (not just eyeball the code) — confirm the dropdown validation works, protected cells can't be edited, and it round-trips cleanly back through the import
- A screenshot or description of the dashboard, and of the PDF export

Bring me code/output in whatever chunks make sense — you don't need to wait until the very end. The calculation module and the data schema are the two things worth getting me to check early, since everything else is comparatively easy to fix later.

---

## 7. Open items to decide later (not blocking, but flag when you get there)

- Exact PDF report layout/branding (logo, agency name on the cover, etc.) — cosmetic, easy to defer
- Whether "download all reviewer forms" zips .xlsx files or triggers sequential downloads (browser-dependent; Claude Code can just pick one and you can react to it)
- Rounding/decimal display precision for scores and totals (spreadsheet showed things like 4.25 — probably keep 2 decimal places, worth confirming once you see it rendered)
- Whether the generated workbook should also show each criterion's weight to the reviewer (current spec says no, keep it score-only) — easy to flip if you decide reviewers should see it after all
- What happens on import if a reviewer's returned workbook has extra/missing rows compared to the current project config (e.g. a firm was added after the form went out) — the diff-before-committing step in Section 3 should surface this, but confirm the actual UX reads clearly once built
- Bulk vs one-at-a-time import: the spec now asks for a file picker that accepts both, so you don't have to pre-decide — but check in practice whether the multi-file summary view (Section 3, step a) is actually easy to read with 5-6 reviewers at once
