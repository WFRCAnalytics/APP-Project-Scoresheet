// Regression test for a real user report: "I add 4 scale points (1, 2, 3, 4); when I edit
// row 4's value to 10, the row that was 1 changes to 10 too." Root cause: UPDATE_SCALE_POINT/
// REMOVE_SCALE_POINT used to identify which point to act on by `value` (matching with
// `p.value === action.value` in a `.map()`/`.filter()`), because ScoringScalePoint has no
// separate `id` field. That's fine as long as no two points ever share a value — but a real
// user typing "10" over an existing "4" passes through an intermediate "1" (clear the field,
// type "1", then "0"), which collides with another row that's ALREADY 1. At that instant
// `.map()` matches every point whose value is 1 — both the row genuinely holding 1 AND the
// row transiently passing through 1 — and mutates both. This is exactly why the fix is
// `index`, not `value`: index can never collide, regardless of what value a point transiently
// (or even permanently) holds.
//
// This is a reducer-only test (not a rendered-component one) specifically because the bug
// lives entirely in projectReducer.ts's own matching logic — ScoringScaleEditor.tsx's render
// order/keying was already fixed for a different, earlier bug (see that component's header
// comment) and isn't what's under test here.

import { describe, expect, it } from "vitest";
import { projectReducer, type ProjectState } from "../../src/state/projectReducer";
import { createEmptyProject } from "../../src/types/project";

function fixtureState(): ProjectState {
  const project = createEmptyProject();
  project.scoringScale = [
    { value: 1, label: "One" },
    { value: 2, label: "Two" },
    { value: 3, label: "Three" },
    { value: 4, label: "Four" },
  ];
  return project;
}

describe("projectReducer — UPDATE_SCALE_POINT/REMOVE_SCALE_POINT identify rows by index, not value", () => {
  it("updating one point to a value another point already holds only changes the targeted row", () => {
    let state = fixtureState();

    // Row 3 (index 3, value 4) edited to 1 — collides with row 0 (index 0), which is
    // already 1. Only index 3 should change.
    state = projectReducer(state, {
      type: "UPDATE_SCALE_POINT",
      index: 3,
      patch: { value: 1 },
    });

    expect(state!.scoringScale.map((p) => p.value)).toEqual([1, 2, 3, 1]);
    // Row 0's label is untouched — proof it's a genuinely different row, not just a value
    // that happens to look the same.
    expect(state!.scoringScale[0].label).toBe("One");
    expect(state!.scoringScale[3].label).toBe("Four");
  });

  it("reproduces the exact reported sequence: typing '10' over row 3's '4' one keystroke at a time never touches row 0's '1'", () => {
    let state = fixtureState();

    // Simulates a real user clearing the Value input (browser fires onChange with "") then
    // typing "1" then "0" — three separate UPDATE_SCALE_POINT dispatches, all targeting
    // index 3 (ScoringScaleEditor always dispatches the row's own stable index, never its
    // current value — see that component's onChange handlers).
    state = projectReducer(state, { type: "UPDATE_SCALE_POINT", index: 3, patch: { value: 0 } });
    state = projectReducer(state, { type: "UPDATE_SCALE_POINT", index: 3, patch: { value: 1 } }); // transiently collides with row 0
    state = projectReducer(state, { type: "UPDATE_SCALE_POINT", index: 3, patch: { value: 10 } });

    expect(state!.scoringScale.map((p) => p.value)).toEqual([1, 2, 3, 10]);
    expect(state!.scoringScale[0].value).toBe(1); // the bug: this used to become 10 too
  });

  it("removing a point that collides in value with another only removes the targeted index", () => {
    let state = fixtureState();
    // Make row 3 collide with row 0 first (value 1 on both), same as a real transient edit.
    state = projectReducer(state, {
      type: "UPDATE_SCALE_POINT",
      index: 3,
      patch: { value: 1 },
    });
    expect(state!.scoringScale.map((p) => p.value)).toEqual([1, 2, 3, 1]);

    // Remove index 3 specifically — must leave exactly row 0 (also value 1) untouched.
    state = projectReducer(state, { type: "REMOVE_SCALE_POINT", index: 3 });

    expect(state!.scoringScale).toHaveLength(3);
    expect(state!.scoringScale.map((p) => p.value)).toEqual([1, 2, 3]);
    expect(state!.scoringScale[0].label).toBe("One");
  });
});
