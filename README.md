# Proposal Evaluation Scoresheet

A client-only tool for WFRC to score and rank RFP proposals — configurable firms, reviewers,
weighted criteria, and scoring scale, with an Excel-based round trip for collecting reviewer
scores and a print-quality PDF report for the official procurement record.

**No backend, no database, no accounts.** Everything runs in your browser. The only
durable save is a `project.json` file you explicitly download and later re-open — there is
no server-side storage of any project data, ever (see [Constitution
Principles I/II/IV](.specify/memory/constitution.md)).

## How it works

1. **Load** — start a new project, or upload a previously exported `project.json`. A file
   with scores already in it goes straight to the Dashboard; an in-progress file resumes
   in Configuration.
2. **Configuration** — set up project info, firms (invited/submitted, picked from a
   searchable/creatable name list), reviewers (**TLC Applicant** or **WFRC**), weighted
   criteria (weights entered as a decimal or a percent, your choice), and the scoring scale
   (a fixed set of discrete points, or a continuous range like 1.0–5.0). Export the JSON at
   any point.
3. **Reviewer Forms** — generate a real `.xlsx` scoring workbook per reviewer (one button,
   or "download all" as a single `.zip`). Reviewers fill it in Excel/Sheets/LibreOffice —
   they never need to know this app exists. Import the completed workbooks (one at a time or
   in bulk) to populate scores, or enter scores manually for anyone who reported back by
   phone/email.
4. **Dashboard** — a sortable, per-row-expandable ranked firms table (Overall, TLC
   Applicant-only, and WFRC-only weighted totals, each its own rank lens), per-firm
   criterion-breakdown and reviewer-score-spread charts, a full "show calculations" audit
   trail (every raw score and derived number, traceable back to its formula — nothing is a
   hardcoded snapshot, including in the `.xlsx` export), and PDF/JSON export.

The full data model, calculation rules, and file-format contracts live in
[`specs/001-consultant-selection-scoring/`](specs/001-consultant-selection-scoring/) —
`spec.md` for requirements, `data-model.md` for the schema, and `contracts/` for the
`project.json` and reviewer-workbook formats. (The spec folder and the `package.json` name
predate the "Proposal Evaluation Scoresheet" rename and still say "consultant-selection-
scoring" — an internal/historical label only, not user-facing.)

## Development

```bash
npm install
npm run dev        # start the Vite dev server
npm run test        # run the test suite (Vitest)
npm run lint        # ESLint
npm run build        # production build -> /docs
```

Requires Node.js 20+.

### Testing notes

- `tests/unit/` — pure-logic tests (the calculation engine, schema validation, contrast
  ratios) with no React or DOM involved.
- `tests/integration/` — ExcelJS generate/parse round trips. Some run under Vitest's
  `node` environment rather than the project default (`jsdom`) — see the file-level
  comments; it's because `Blob.arrayBuffer()` and `FileReader` aren't both available in
  either single environment, and each test picks whichever one it actually needs.
- `tests/component/` — full app-flow tests using React Testing Library, exercising real
  generated/parsed `.xlsx` data (not mocks) through the actual rendered UI.
- Opening a generated reviewer workbook in **real** Excel (not just re-parsing it with
  ExcelJS) is a manual step no automated test can substitute for — see
  `specs/001-consultant-selection-scoring/qa-signoff.md`.

## Deployment

No CI/CD — deployment is a manual, local build-and-commit, published via GitHub Pages
"Deploy from a branch" (`main` / `/docs`):

```bash
npm run deploy
```

This runs `npm run build` (which writes straight into the tracked `/docs` folder — that
*is* the deployed site, not a build-scratch directory excluded from git) and then prints a
reminder of the remaining manual steps:

```bash
git diff --stat docs/     # sanity-check the diff actually reflects your latest build
git add docs/ <your source changes>
git commit -m "..."
git push                  # this is what actually publishes — GitHub Pages picks it up
```

See `specs/001-consultant-selection-scoring/research.md` §9 for the full rationale
(no CI, no build server — whoever pushes to `main` with an up-to-date `/docs` *is* the
deploy step).

## Brand & accessibility

Visual identity (colors, typography, logo) is sourced directly from the [WFRC brand
repository](https://github.com/WFRCAnalytics/wfrc-brand), not invented — see
`specs/001-consultant-selection-scoring/research.md` §10 for the exact fetched values and
`src/theme/tokens.css` for how they're applied, including the accessibility-driven
adjustments (documented inline) needed to meet WCAG 2.1 AA in both light and dark mode.
Charts use that same palette for their data-series colors (never invented hex values), with
a fixed WFRC = blue / Overall = orange / TLC Applicant = green convention throughout.

## Privacy

Scores and comments are procurement-sensitive. This app never calls any external API with
project data — the only network requests the app itself makes are static Google Fonts CDN
requests for font files, carrying no project content. See
`specs/001-consultant-selection-scoring/qa-signoff.md` (T051) for a full audit.

## Possible future direction (not yet planned or built)

Ideas raised internally for where this tool could go next, if the underlying architecture
ever changes to support them — captured here so they aren't lost, **not** a roadmap or a
commitment:

- A disclaimer / non-disclosure form reviewers acknowledge before they can see or score a
  proposal.
- Letting the TLC applicant fill out their own submission online, instead of the current
  offline-proposal-plus-Excel-scoring-workbook flow.
- A full pipeline: sign in → accept disclaimer → get access to the proposal → score it →
  submit — replacing today's "generate a workbook, email it, import it back" exchange.
- Real firm information (contact details, website, etc.) pulled automatically from a firms
  database, instead of today's static name-only list.
- Email notifications to reviewers (e.g. "you have a new proposal to score," reminders for
  outstanding scores) instead of the current manual "hand them a file" workflow.
- Integrating with WFRC's Google Workspace/organization APIs — e.g. writing scores into a
  Google Sheet — as a possible lighter-weight alternative to standing up a dedicated
  backend/database for any of the above.

**Every one of these requires a real backend, a firms database, and/or a third-party
integration** — accounts, authenticated access control, and server-side (or third-party)
storage of procurement-sensitive material — which is the opposite of this app's current,
deliberate design (see Constitution Principles I/II/IV above, and `Privacy` above): no
accounts, no server, no data ever leaving the browser except as a file the user explicitly
downloads. That trade-off is *why* privacy is currently a non-issue here: there is nothing
to breach, because nothing is stored or transmitted anywhere. Taking on any of the above
would mean deliberately giving that up in exchange for new capability, and reopening real
questions that don't have answers yet — who hosts it and pays for that hosting, who is
responsible for its security and uptime, how reviewer/applicant identities are verified,
how long submitted data is retained and who can access it, what happens to that data if the
hosting arrangement ever ends, and — for any third-party integration (Google Workspace or
otherwise) — whose account owns that data, what that provider's own access/retention terms
are, and whether routing procurement-sensitive scoring data through an external API is
acceptable at all. None of that is designed yet; this section exists so the trade-off is
visible before anyone starts building toward it. A dedicated follow-up discussion is
expected before any of this moves forward.
