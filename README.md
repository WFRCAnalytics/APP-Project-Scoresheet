# Consultant Selection Scoring

A client-only tool for a transportation planning agency to score and rank consulting firms
that responded to an RFP — configurable firms, reviewers, weighted criteria, and scoring
scale, with an Excel-based round trip for collecting reviewer scores and a print-quality
PDF report for the official procurement record.

**No backend, no database, no accounts.** Everything runs in your browser. The only
durable save is a `project.json` file you explicitly download and later re-open — there is
no server-side storage of any project data, ever (see [Constitution
Principles I/II/IV](.specify/memory/constitution.md)).

## How it works

1. **Load** — start a new project, or upload a previously exported `project.json`. A file
   with scores already in it goes straight to the Dashboard; an in-progress file resumes
   in Configuration.
2. **Configuration** — set up project info, firms (invited/submitted), reviewers
   (city/WFRC), weighted criteria, and the scoring scale. Export the JSON at any point.
3. **Reviewer Forms** — generate a real `.xlsx` scoring workbook per reviewer (one button,
   or "download all"). Reviewers fill it in Excel/Sheets/LibreOffice — they never need to
   know this app exists. Import the completed workbooks (one at a time or in bulk) to
   populate scores, or enter scores manually for anyone who reported back by phone/email.
4. **Dashboard** — ranked firms, Overall vs. City weighted totals, a per-firm criterion
   breakdown, a full "show calculations" audit trail, and PDF/JSON export.

The full data model, calculation rules, and file-format contracts live in
[`specs/001-consultant-selection-scoring/`](specs/001-consultant-selection-scoring/) —
`spec.md` for requirements, `data-model.md` for the schema, and `contracts/` for the
`project.json` and reviewer-workbook formats.

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

## Privacy

Scores and comments are procurement-sensitive. This app never calls any external API with
project data — the only network requests the app itself makes are static Google Fonts CDN
requests for font files, carrying no project content. See
`specs/001-consultant-selection-scoring/qa-signoff.md` (T051) for a full audit.
