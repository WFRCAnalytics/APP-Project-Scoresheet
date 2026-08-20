# Phase 0 Research: Consultant Selection Scoring

All items below were fully specified by the user's plan input or resolvable by an
unambiguous default consistent with the constitution; there were no open `NEEDS
CLARIFICATION` markers carried in from the spec or Technical Context.

## 1. Excel workbook library: ExcelJS

**Decision**: Use ExcelJS for both generating reviewer workbooks and parsing returned ones.

**Rationale**: One library for both directions of the round trip (spec FR-015–FR-024)
avoids reconciling two different `.xlsx` implementations' quirks. ExcelJS supports
everything the reviewer-workbook contract needs in one package: per-cell data validation
(dropdown lists for the Score column), sheet/cell protection (locking the Firm/Criterion/
Description columns), and arbitrary hidden columns (the reviewerId/firmId/criterionId
carriers) — all as first-class API surface, not workarounds.

**Alternatives considered**: SheetJS/xlsx (excellent read support, but its free tier has
materially weaker write-side support for cell protection and data-validation dropdowns —
would need a second library or paid tier to cover generation); hand-rolling OOXML — rejected
as needless complexity for a solved problem.

## 2. ExcelJS + Vite browser bundling (Node/Buffer polyfill)

**Decision**: ExcelJS's browser build depends on Node's `Buffer` global, which Vite does not
polyfill by default (Vite targets browsers, not Node). Resolve with `vite-plugin-node-polyfills`
(scoped to just `buffer`) plus `define: { global: 'globalThis' }` in `vite.config.ts`. Import
ExcelJS's browser entry point (`exceljs/dist/exceljs.min.js` or the package's documented
browser field) rather than the default Node-oriented entry, to avoid pulling in `fs`.

**Rationale**: This is a well-known, well-documented gotcha for ExcelJS-in-Vite specifically
(not just "some bundler issue") — the fix is narrow (one polyfilled global) rather than a
full Node-compat shim, which keeps the static-bundle-size and "no hidden Node dependency"
constitution posture intact.

**Verification requirement (carried into `quickstart.md` and tasks)**: An automated test
that ExcelJS-generates-then-ExcelJS-reads-back a workbook only proves internal consistency,
not that Microsoft Excel agrees the file is well-formed. A manual step — open a generated
workbook in real Excel (or Google Sheets/LibreOffice, per spec SC-002) and confirm the Score
dropdown, locked columns, and hidden ID columns all behave as intended — is a required part
of the Definition of Done for the reviewer-form feature, not optional polish.

## 3. Charting library: Recharts

**Decision**: Recharts for the Dashboard's bar chart (Overall vs. City weighted totals) and
per-firm criterion breakdown chart.

**Rationale**: Recharts renders to SVG and composes as ordinary React components, which
matters for two spec requirements simultaneously: (a) charts inherit the same CSS custom
properties as the rest of the UI, so brand/theme/dark-mode tokens apply without a second
theming system, and (b) SVG output prints as crisp vector graphics through react-to-print's
native-print pipeline (see next item), which a canvas-based library would rasterize.

**Alternatives considered**: Chart.js — canvas-based, meaning both any post-hoc DOM/CSS
theming and the print-quality PDF goal (spec FR-035, SC-008) would require re-rendering to
an image at a fixed resolution; rejected in favor of Recharts' SVG-first approach.

## 4. PDF export: react-to-print (not html2canvas+jsPDF)

**Decision**: Use react-to-print to drive the browser's native print pipeline against a
dedicated print-layout React component, rather than html2canvas+jsPDF.

**Rationale**: html2canvas rasterizes the DOM into a bitmap before jsPDF embeds it — text
becomes an image, which directly works against spec SC-008 ("remains fully legible ... no
low-contrast text") and against the WCAG 2.1 AA target (spec SC-010): rasterized text is not
selectable, not searchable, and degrades at typical PDF zoom levels. react-to-print instead
prints the real DOM through the browser's own print engine, so real (selectable, accessible)
text and Recharts' real SVG vector paths both render natively — the standard approach for a
"looks right when actually printed" requirement, which this procurement record explicitly
is. A dedicated print stylesheet (`@media print`) is used to force high-contrast colors
(constitution Principle VII's explicit carve-out: legibility over strict brand-color
literalism in the PDF specifically).

**Alternatives considered**: html2canvas + jsPDF — rejected per above; kept as a documented
fallback only if a specific browser's print-to-PDF behavior proves unworkable during
implementation.

## 5. State management: React Context + `useReducer`, no external store

**Decision**: The entire in-memory `Project` object is held in one `React.Context` backed by
`useReducer`, with actions corresponding to the spec's editing operations (add/edit/remove
firm, reviewer, criterion; apply score import; etc.). No Redux, Zustand, Jotai, or similar.

**Rationale**: Directed explicitly by the user's plan input, and independently justified —
there is exactly one mutable object, one active editor (constitution Principle III: one
project at a time), and no need for time-travel debugging, middleware, or cross-tab sync
that would justify a dedicated state library.

## 6. Routing: no router library, top-level state machine instead

**Decision**: The five app areas (Load, Configuration, Reviewer Forms, Calculations view,
Dashboard) are switched via a simple state value in `App.tsx`, not `react-router` or similar.

**Rationale**: None of the spec's user stories require deep-linkable URLs, browser
back/forward semantics, or bookmarkable app states — the entry point is always the Load
screen with a freshly uploaded or new project (constitution Principle II: stateless between
sessions). Introducing a router mainly adds GitHub Pages sub-path/base-path routing
complexity (hash-routing workarounds) for no corresponding spec requirement. Revisit only if
a future spec explicitly asks for shareable/bookmarkable in-app links.

## 7. Excel workbook protection: no password

**Decision**: Sheet/cell protection (locking Firm/Criterion/Description columns and hiding
the ID columns) is applied without a protection password.

**Rationale**: Matches spec Assumptions — protection exists to prevent accidental edits by a
reviewer, not to secure the file against a deliberate bypass attempt. A password would also
create an operational support burden (a forgotten/lost password locking a handler out of
their own generated file) with no real security benefit for this use case.

## 8. Testing stack

**Decision**: Vitest + React Testing Library. The calculation engine ships as pure,
dependency-free TypeScript in `src/lib/calculations.ts`, unit-tested directly against
hand-computed fixtures (not through the UI) so its correctness is verifiable independent of
any rendering concern — directly serving constitution Principle VI (Transparency) and spec
SC-003/SC-005.

**Rationale**: Vitest is Vite-native (shares config/transform pipeline, fast, no separate
bundler setup) and is the de facto default for Vite+React+TS projects; React Testing Library
is the standard companion for component-level tests in this stack. No project-specific
reason to deviate.

## 9. Deployment: GitHub Pages "Deploy from a branch" (`/docs` on `main`), no CI/CD

**Decision**: No GitHub Actions workflow. `vite.config.ts` sets `base:
'/APP-Project-Scoresheet/'` (the repository name) and `build.outDir: 'docs'`. GitHub Pages
is configured (Settings → Pages → Source: `main`, folder: `/docs`) to serve that committed
directory directly. The deploy step is manual and entirely local: run `npm run build`,
commit the regenerated `/docs` folder together with any source changes, and push to `main`.
`/docs` is tracked in version control — it *is* the deployed artifact, not a build
scratch directory — while `node_modules/` and any other build scratch space stay
gitignored as usual.

**Rationale**: Directed by user input (superseding the earlier GitHub Actions decision from
this feature's first planning pass) — the agency wants a zero-CI, zero-secrets deployment
path: whoever pushes to `main` with an up-to-date `/docs` folder *is* the deploy action,
with no separate pipeline to configure, debug, or grant repo permissions to. Still fully
static and serverless (constitution Principle I unaffected either way).

**Operational implication for `quickstart.md`/tasks**: because `/docs` is both a build
output *and* a tracked file, the local Definition-of-Done workflow must include running
`npm run build` and verifying the diff to `/docs` looks sane (no stale files from a
previous, differently-configured build) before every commit that's meant to ship — there is
no CI step to catch a forgotten rebuild.

**Alternatives considered**: GitHub Actions building on push (the original decision) —
rejected per updated user direction in favor of the simpler, dependency-free manual flow;
worth revisiting only if the team later wants build-on-PR previews or wants to stop
committing generated output to version control.

## 10. WFRC Brand Tokens (Principle VII — fetched, not invented)

Per constitution Principle VII, the following values were read directly from
`https://github.com/WFRCAnalytics/wfrc-brand` (default branch `main`) on 2026-08-20, not
approximated. Sources: `_extensions/wfrc-brand/brand.yml`,
`_extensions/wfrc-brand/assets/theme/_wfrc-colors.scss`,
`_extensions/wfrc-brand/assets/theme/_wfrc-fonts.scss`, and the
`_extensions/wfrc-brand/assets/logo/` directory listing (all three subfolders confirmed to
contain the exact files `brand.yml` declares).

### Typography

| Role | Family | Notes |
|---|---|---|
| Body | Poppins | weights 300–700, normal + italic; loaded from Google Fonts |
| Headings / navigation / labels | Inter | weights 300–700, normal + italic |
| Monospace / code-style display | Fira Code | weights 400/500/700, normal + italic |

Base body size 16px, line-height 1.5. Headings weight 700, line-height 1.2. This app's
`theme/fonts.ts` loads all three families (with the weight/style ranges above) from the
Google Fonts CDN — matching brand.yml's own `source: google` declaration, so no self-hosted
font files need to be vendored.

### Colors — primary WFRC tokens

| Token | Hex | Role in this app |
|---|---|---|
| `wfrc-blue` | `#023c5b` | Primary brand color — primary buttons, headings (light mode), active states |
| `wfrc-secondary-blue` | `#52b6d5` | Accent — links, secondary actions, headings color in dark mode uses a lightened variant `#8fcfe3` (brand.yml's own dark-mode heading color) |
| `wfrc-yellow` | `#f8b93e` | Accent — warning/highlight only; **fails WCAG AA as text-on-white** (bright yellow, low luminance contrast), so it is restricted to backgrounds/borders/icons with a dark foreground on top, never used as small body/label text color |
| `wfrc-gray` | `#7f7a76` | Neutral/text-adjacent color — secondary text, borders, disabled states |

### Colors — light/dark mode base

| Token | Light | Dark |
|---|---|---|
| Foreground (body text) | `black` → `#151515` | `white` → `#ffffff` |
| Background | `white` → `#ffffff` | `#081b26` (brand.yml's dedicated dark background, deliberately richer than a plain darkened `wfrc-blue`) |
| Headings color | `wfrc-blue` (`#023c5b`) | `#8fcfe3` (lightened `wfrc-secondary-blue`, brand.yml's explicit dark-mode override) |

### Colors — categorical palette for charts (RTP + Wasatch Choice)

Per constitution Principle VII, per-firm chart series (bar/radar colors) draw from this
palette, in this fixed order, rather than any invented chart-color set:

`rtp-blue` `#3f748e` → `rtp-green` `#789d4b` → `rtp-mustard` `#c98b3a` → `rtp-fuschia`
`#9d4879` → `rtp-turquoise` `#608a8f` → `rtp-red` `#c23c33` → `rtp-purple` `#585377` →
`rtp-seafoam` `#597f72` → `rtp-maroon` `#6f2d3d` → `rtp-pink` `#e28c7f`

(Ordered by contrast distinctness against both light and dark backgrounds; `wc-*` Wasatch
Choice colors are available as a secondary/overflow set if a project configures more firms
than the RTP set comfortably distinguishes — data-model.md does not hardcode a limit per
spec FR-012, so `theme/tokens.css` should expose the full combined RTP+WC list for the chart
color-assignment function to cycle through.)

**Dark-mode contrast flag carried into implementation tasks**: several RTP colors (e.g.
`rtp-maroon` `#6f2d3d`, `rtp-blue` `#3f748e`) are dark enough that they need a lightened
dark-mode variant to stay legible against the `#081b26` background and meet the WCAG 2.1 AA
target (spec SC-010) — brand.yml does not itself provide dark-mode variants for the RTP/WC
set (only for the four primary tokens + foreground/background), so this app must compute or
hand-pick AA-safe dark-mode variants as part of `theme/tokens.css`. This is a concrete
implementation task, not a resolved design; flag it in `tasks.md`.

### Logo assets (to copy into `src/assets/logo/`, not referenced from the other repo)

Confirmed present at `_extensions/wfrc-brand/assets/logo/` on the source repo:

- `horizontal/WFRC_logo_horizontal_color_transparent.png` (light-mode default, per brand.yml)
- `horizontal/WFRC_logo_horizontal_white_transparent.png` (dark-mode default)
- `stacked/WFRC_logo_stacked_color_transparent.png`
- `stacked/WFRC_logo_stacked_white_transparent.png`
- `abbreviated/WFRC_logo_abbreviated_color_transparent.png`
- `abbreviated/WFRC_logo_abbreviated_white_transparent.png`

brand.yml's own size guidance: use `horizontal-color`/`horizontal-white` at large sizes
(app header), `stacked-*` at medium (e.g. PDF cover), `abbreviated-*` at small (e.g. favicon
or compact header on narrow viewports) — light/dark selection follows the same
`light`/`dark` pairing brand.yml declares.

### Accessibility target

WCAG 2.1 Level AA (spec SC-010, resolved during `/speckit-clarify`). Automated contrast
checks (e.g. via `axe-core` in component tests, or a lightweight custom check in
`theme/tokens.css`'s build step) verify text/background pairs before they ship, rather than
relying on manual eyeballing alone.
