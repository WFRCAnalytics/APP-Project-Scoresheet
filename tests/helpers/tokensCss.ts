// Shared src/theme/tokens.css parsing, used by both tests/unit/contrast.test.ts (T020) and
// tests/unit/elevationTokens.test.ts — extracted out of contrast.test.ts so the two don't
// carry independent copies of the same "read the real CSS file, don't duplicate its values
// in a second hand-maintained list" parser. Both tests exist for the same underlying reason:
// a token changed in tokens.css without a matching fix (contrast OR — the elevation case —
// dark-mode visibility) should fail immediately, not drift silently.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const TOKENS_PATH = resolve(process.cwd(), "src/theme/tokens.css");

export type TokenMap = Record<string, string>;

/** Strips CSS `/* ... *\/` comments (including multi-line ones) before any other parsing
 * step here. Comments are replaced with a single space rather than removed outright, so a
 * comment sitting directly between two otherwise-adjacent tokens can never accidentally
 * glue them together.
 *
 * This exists because a naive `--([\w-]+):` regex cannot tell a real custom-property
 * declaration apart from prose that merely LOOKS like one — e.g. this file's own comments
 * describing a CSS selector such as `.card--interactive:hover` contain the substring
 * `--interactive:`, which matched as if it were declaring a property named `interactive`.
 * That's not hypothetical: it happened twice while writing tokens.css's dark-mode elevation
 * fix, silently corrupting the parse (the bogus match's greedy `[^;]+` value capture ran
 * past the real next declaration, swallowing it) and producing a confusing false-positive
 * test failure rather than an obvious one. Comments are content authors write freely and
 * never intend to be parsed as data — stripping them before parsing, rather than asking
 * every future comment to avoid the pattern, is the actual fix. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Extracts `--name: value;` custom-property declarations from a CSS block body. */
export function parseDeclarations(blockBody: string): TokenMap {
  const tokens: TokenMap = {};
  const re = /--([\w-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripCssComments(blockBody)))) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** Finds the first `:root { ... }` block starting at `fromIndex` and returns its body
 * plus the index just past its closing brace. Assumes no nested braces inside (true for
 * this file — it's a flat custom-property list, no rulesets nested inside :root). */
export function extractRootBlock(css: string, fromIndex: number): { body: string; endIndex: number } {
  const start = css.indexOf(":root", fromIndex);
  if (start === -1) throw new Error("No :root block found");
  const openBrace = css.indexOf("{", start);
  const closeBrace = css.indexOf("}", openBrace);
  return { body: css.slice(openBrace + 1, closeBrace), endIndex: closeBrace + 1 };
}

/** Resolves `var(--foo)` references against an already-parsed token map, a few passes
 * deep (enough for this file's short reference chains). Leaves the value alone if it
 * isn't a bare `var()` reference (a literal color, font stack, a composite expression like
 * `rgb(var(--shadow-color) / 0.5)`, etc. — those are left as-is, matching how they'd need
 * a real CSS engine to fully resolve; callers that need them resolved use the raw pieces
 * (e.g. --shadow-color itself) instead of the composite). */
export function resolveTokens(raw: TokenMap): TokenMap {
  const resolved: TokenMap = { ...raw };
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const [name, value] of Object.entries(resolved)) {
      const varMatch = value.match(/^var\(--([\w-]+)\)$/);
      if (varMatch && resolved[varMatch[1]] && resolved[varMatch[1]] !== value) {
        resolved[name] = resolved[varMatch[1]];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return resolved;
}

/** Loads tokens.css's light (:root) and dark (@media prefers-color-scheme: dark's
 * :root:not([data-theme="light"]) override) token sets, dark = light-mode tokens with
 * dark-mode overrides layered on top — mirroring how the CSS cascade actually resolves
 * them at runtime (same :root selector, later rule wins for anything it redefines,
 * anything it doesn't redefine falls through unchanged). */
export function loadTokens(): { light: TokenMap; dark: TokenMap } {
  // Stripped once, up front, for the whole file — not just inside parseDeclarations —
  // so a stray `{`/`}` inside a comment (none exist today, but nothing stops one being
  // added later) can't also throw off extractRootBlock's brace matching, which runs
  // before parseDeclarations ever sees the text.
  const css = stripCssComments(readFileSync(TOKENS_PATH, "utf-8"));

  const rootBlock = extractRootBlock(css, 0);
  const lightRaw = parseDeclarations(rootBlock.body);

  const darkMediaIndex = css.indexOf("prefers-color-scheme: dark", rootBlock.endIndex);
  if (darkMediaIndex === -1) {
    throw new Error("expected a @media (prefers-color-scheme: dark) block");
  }
  const darkRootBlock = extractRootBlock(css, darkMediaIndex);
  const darkOverridesRaw = parseDeclarations(darkRootBlock.body);

  const light = resolveTokens(lightRaw);
  const dark = resolveTokens({ ...lightRaw, ...darkOverridesRaw });

  return { light, dark };
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value);
}
