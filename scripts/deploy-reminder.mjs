#!/usr/bin/env node
// T007: `npm run deploy` = `vite build` (already run by the npm script chain before this
// file executes) + this reminder. There is no CI/CD pipeline (research.md §9) — deploying
// is a manual build -> review -> commit -> push sequence, and this script exists purely so
// that sequence is one command instead of something a handler has to remember correctly.

const lines = [
  "",
  "==========================================================",
  " Build complete -> docs/",
  "==========================================================",
  "",
  "GitHub Pages serves this repo from main:/docs (Settings > Pages > Source: main / /docs).",
  "There is no CI/CD workflow — you are the deploy step. Before you push:",
  "",
  "  1. Review what changed:      git diff --stat docs/",
  "  2. Stage docs/ + source:     git add docs/ <your source changes>",
  "  3. Commit:                   git commit -m \"...\"",
  "  4. Push to publish:          git push",
  "",
  "If `git diff --stat docs/` looks empty or suspiciously small, the build likely didn't",
  "pick up your latest changes — re-run `npm run build` before committing.",
  "",
];

// eslint-disable-next-line no-console
console.log(lines.join("\n"));
