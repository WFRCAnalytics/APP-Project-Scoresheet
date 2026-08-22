// 004 post-launch improvements, item 3: unit coverage for the duplicate-name detection
// helper shared by FirmsEditor and ReviewersEditor.

import { describe, expect, it } from "vitest";
import { findDuplicateNames } from "../../src/lib/duplicateNames";

describe("findDuplicateNames", () => {
  it("returns nothing when all names are distinct", () => {
    expect(findDuplicateNames(["Acme Co", "Beta Corp", "Gamma LLC"]).size).toBe(0);
  });

  it("flags an exact duplicate", () => {
    const dupes = findDuplicateNames(["Acme Co", "Beta Corp", "Acme Co"]);
    expect(dupes.get("Acme Co")).toBe(2);
  });

  it("treats different casing as the same name", () => {
    const dupes = findDuplicateNames(["Acme Co", "acme co"]);
    expect(dupes.size).toBe(1);
    expect([...dupes.values()][0]).toBe(2);
  });

  it("treats surrounding whitespace as the same name", () => {
    const dupes = findDuplicateNames(["Acme Co", "  Acme Co  "]);
    expect(dupes.size).toBe(1);
  });

  it("ignores empty and whitespace-only names entirely", () => {
    expect(findDuplicateNames(["", "  ", ""]).size).toBe(0);
  });

  it("reports multiple distinct duplicate groups independently", () => {
    const dupes = findDuplicateNames(["Acme Co", "Acme Co", "Beta Corp", "Beta Corp", "Gamma LLC"]);
    expect(dupes.size).toBe(2);
    expect(dupes.get("Acme Co")).toBe(2);
    expect(dupes.get("Beta Corp")).toBe(2);
    expect(dupes.has("Gamma LLC")).toBe(false);
  });

  it("counts three-or-more-way duplicates correctly", () => {
    const dupes = findDuplicateNames(["Acme Co", "Acme Co", "Acme Co"]);
    expect(dupes.get("Acme Co")).toBe(3);
  });

  it("uses the first occurrence's original casing/whitespace for display", () => {
    const dupes = findDuplicateNames(["Acme Co", "ACME CO"]);
    expect(dupes.has("Acme Co")).toBe(true);
  });
});
