# Contract: `project.json` (the source-of-truth file)

This is the app's only durable interface to the outside world for configuration and
results (constitution Principle IX). There is no server API — this document plays the role
a REST/GraphQL contract would in a client-server app.

## Shape

Exactly the `Project` interface in `data-model.md`, serialized as JSON, `schemaVersion`
included. No wrapper envelope, no additional top-level fields.

## Producing a file (export)

Triggered from: Configuration area (FR-013, at any point) and Dashboard (FR-036, always
available once results exist).

1. Serialize the current in-memory `Project` exactly as-is (including `schemaVersion` and
   any orphaned scores retained per the deletion rules in `data-model.md`).
2. Compute the default filename (see `lib/filenames.ts`):
   - If `project.projectName` is non-empty: sanitize it (replace whitespace with `_`, strip
     characters outside `[A-Za-z0-9_-]`) and append `.json` — e.g. `Very_Good_Project.json`
     (spec FR-014, Story 1 Acceptance Scenario 3).
   - If `project.projectName` is empty: `untitled-project.json` (spec FR-014, Story 1
     Acceptance Scenario 4).
3. Present a save/download prompt pre-filled with that default filename but editable by the
   handler (FR-014 — never forced/locked to the default).
4. No confirmation dialog beyond the browser's native save prompt; export never mutates the
   in-memory `Project`.

## Consuming a file (import / upload)

Triggered from: the Load screen (FR-001/FR-002/FR-003) and Configuration's "Upload a
different project JSON" (FR-013).

1. Parse the file as JSON. If parsing fails, or the top-level shape does not match `Project`
   at all (missing required arrays, wrong types) → reject with a clear, human-readable error;
   nothing is partially loaded (FR-004). This check happens *before* step 2.
2. Read `schemaVersion`:
   - Missing, or an older version this app recognizes → run the corresponding migration(s)
     forward in memory, then continue to step 3 as if the file were already current-version
     (FR-038).
   - A version newer than this app supports, or an unrecognized value → reject with a clear
     error naming the unsupported version; do not attempt to load (FR-038).
3. Validate the (now current-version) structure against `data-model.md`'s field types and
   the rules listed there (e.g. `scoringScale.length >= 2` is *informational* at load time —
   an under-configured file is not rejected, it's just routed to Configuration to finish, per
   step 4).
4. Routing decision (FR-002/FR-003):
   - `scores.length > 0` → load into state, navigate to Dashboard (view mode).
   - `scores.length === 0` → load into state, navigate to Configuration, pre-filled with
     whatever is present (including a completely empty/new-ish project).
5. Loading a file never touches `sessionStorage`'s separate unsaved-work-recovery slot
   (constitution Principle II) — those are independent mechanisms; a fresh upload always
   wins over any stale recovery snapshot, and the app must not silently merge the two.

## Compatibility guarantee

Every `project.json` this app ever produces remains importable by every later version of
this app, for as long as that version number is a "recognized older version" the migration
chain covers (FR-038) — this is the concrete mechanism protecting the constitution's
"official procurement record" durability expectation. Dropping migration support for an old
`schemaVersion` is a breaking change requiring a constitution/plan amendment, not a routine
code change.
