// 004 post-launch improvements, item 4: unit coverage for the JSZip wrapper used by
// "Download all forms".

import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { zipFiles } from "../../src/lib/zipFiles";

describe("zipFiles", () => {
  it("packages every file under its given name, preserving content", async () => {
    const blob = await zipFiles([
      { filename: "a.txt", blob: new Blob(["hello"]) },
      { filename: "b.txt", blob: new Blob(["world"]) },
    ]);

    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files).sort()).toEqual(["a.txt", "b.txt"]);
    expect(await zip.files["a.txt"].async("string")).toBe("hello");
    expect(await zip.files["b.txt"].async("string")).toBe("world");
  });

  it("produces an empty archive for an empty file list", async () => {
    const blob = await zipFiles([]);
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
