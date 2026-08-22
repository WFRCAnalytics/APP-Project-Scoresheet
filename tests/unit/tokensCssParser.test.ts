// Regression test for tests/helpers/tokensCss.ts, the shared parser contrast.test.ts and
// elevationTokens.test.ts both use to read src/theme/tokens.css. Its `--name: value;`
// custom-property regex used to match that pattern anywhere in the file, including inside
// /* ... */ comments — a comment containing prose like ".card--interactive:hover" contains
// the substring "--interactive:", which the regex couldn't tell apart from a real
// declaration. This silently corrupted the parse (the bogus match's greedy value capture
// ran past the real next declaration and swallowed it) and produced a confusing false-
// positive test failure twice while writing tokens.css's dark-mode elevation fix — a
// hand-wavy "reword the comment" fix each time, not a real one. This test locks in the
// actual fix: parseDeclarations strips comments before parsing, so it stops mattering
// whether a comment's prose happens to look like a declaration.

import { describe, expect, it } from "vitest";
import { parseDeclarations, stripCssComments } from "../helpers/tokensCss";

describe("tokensCss parser ignores custom-property-shaped text inside comments", () => {
  it("stripCssComments removes /* ... */ blocks, including ones spanning multiple lines", () => {
    const css = `
      /* a
         multi-line
         comment */
      --real-token: 1px;
    `;
    const stripped = stripCssComments(css);
    expect(stripped).not.toContain("multi-line");
    expect(stripped).toContain("--real-token: 1px;");
  });

  it("does not glue two declarations together when a comment sits directly between them", () => {
    // No whitespace around the comment on purpose — stripCssComments must replace it with
    // something (a space), not delete it outright, or "1px" and "--b" would run together.
    const css = "--a: 1px;/* comment */--b: 2px;";
    const tokens = parseDeclarations(css);
    expect(tokens["a"]).toBe("1px");
    expect(tokens["b"]).toBe("2px");
  });

  it("a comment that looks like a custom-property declaration is not picked up as a real token (the exact bug found)", () => {
    // The user's own example, verbatim.
    const css = `
      /* don't confuse this --parser: with a real one */
      --actual-token: 42px;
    `;
    const tokens = parseDeclarations(css);
    expect(tokens["parser"]).toBeUndefined();
    expect(tokens["actual-token"]).toBe("42px");
  });

  it("reproduces the real regression: a BEM-modifier-plus-colon inside a comment (e.g. '.card--interactive:hover') no longer swallows the next real declaration", () => {
    const css = `
      /* Used only by the interactive card's .card--interactive:hover state, not at rest. */
      --shadow-ring-hover: 0 0 0 2px color-mix(in srgb, white 24%, transparent);
      --overlay-backdrop: rgb(0 0 0 / 0.5);
    `;
    const tokens = parseDeclarations(css);
    expect(tokens["interactive"]).toBeUndefined();
    expect(tokens["shadow-ring-hover"]).toBe(
      "0 0 0 2px color-mix(in srgb, white 24%, transparent)",
    );
    expect(tokens["overlay-backdrop"]).toBe("rgb(0 0 0 / 0.5)");
  });
});
