// lib/chartExport.ts's two post-launch fixes, both found from real exported files rather
// than hypothetical bugs:
//  1. No font: exported <text> elements had no font-family of their own (only ever
//     inherited Poppins from the live page's `body` rule, which doesn't travel with a
//     standalone serialized SVG) — fixed by setting an explicit font-family on the export
//     root AND embedding the real font data as a base64 @font-face (lib/fontEmbed.ts).
//  2. No legend: Recharts' own <Legend> renders as HTML OUTSIDE the <svg>, invisible to
//     this file's clone-and-serialize approach — fixed by drawing a legend as real SVG
//     shapes directly into the exported copy only.
//
// downloadBlob is mocked so these tests can inspect the actual serialized markup rather
// than just asserting "a download was triggered." Each test resets the module registry and
// re-imports chartExport.ts/fontEmbed.ts fresh — fontEmbed.ts caches its fetch result at
// module scope (deliberately, so a real session doesn't re-fetch the font on every export),
// which would otherwise leak the FIRST test's fetch outcome into every test after it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { downloadBlobMock } = vi.hoisted(() => ({ downloadBlobMock: vi.fn() }));
vi.mock("../../src/lib/downloadBlob", () => ({ downloadBlob: downloadBlobMock }));

const SVG_NS = "http://www.w3.org/2000/svg";

function buildTestSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("width", "320");
  svg.setAttribute("height", "240");
  svg.setAttribute("viewBox", "0 0 320 240");
  const text = document.createElementNS(SVG_NS, "text");
  text.textContent = "Alpha Co";
  svg.appendChild(text);
  document.body.appendChild(svg); // real layout/attribute access needs it attached
  return svg;
}

// jsdom's Blob doesn't implement .text()/.arrayBuffer() — same known gap this suite already
// works around elsewhere (tests/integration's Excel round-trips) via FileReader instead.
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function lastDownloadedMarkup(): Promise<string> {
  const [blob] = downloadBlobMock.mock.calls[downloadBlobMock.mock.calls.length - 1] as [Blob, string];
  return readBlobText(blob);
}

/** Re-imports chartExport.ts fresh (see file header comment on why every test needs this). */
async function freshDownloadChartAsSvg() {
  vi.resetModules();
  const mod = await import("../../src/lib/chartExport");
  return mod.downloadChartAsSvg;
}

beforeEach(() => {
  downloadBlobMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("chartExport — font embedding", () => {
  it("sets an explicit font-family on the exported SVG root, even if the font fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const downloadChartAsSvg = await freshDownloadChartAsSvg();
    const svg = buildTestSvg();

    await downloadChartAsSvg(svg, "chart.svg", [], "#151515");

    const markup = await lastDownloadedMarkup();
    expect(markup).toContain('font-family="Poppins,');
    // No embedded @font-face when the fetch failed — export still succeeds, just without it.
    expect(markup).not.toContain("@font-face");
  });

  it("embeds the fetched font as a base64 @font-face when the fetch succeeds", async () => {
    const fakeCss = `@font-face{font-family:'Poppins';unicode-range:U+0000-00FF;src:url(https://fonts.gstatic.com/s/poppins/fake.woff2) format('woff2');}`;
    const fakeFontBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("fonts.googleapis.com")) {
          return Promise.resolve({ ok: true, text: () => Promise.resolve(fakeCss) });
        }
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(fakeFontBytes) });
      }),
    );
    const downloadChartAsSvg = await freshDownloadChartAsSvg();
    const svg = buildTestSvg();

    await downloadChartAsSvg(svg, "chart.svg", [], "#151515");

    const markup = await lastDownloadedMarkup();
    expect(markup).toContain("@font-face");
    expect(markup).toContain("data:font/woff2;base64,");
  });
});

describe("chartExport — legend", () => {
  it("adds no legend markup and leaves height unchanged when legendItems is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); // font irrelevant here
    const downloadChartAsSvg = await freshDownloadChartAsSvg();
    const svg = buildTestSvg();

    await downloadChartAsSvg(svg, "chart.svg", [], "#151515");

    const markup = await lastDownloadedMarkup();
    expect(markup).not.toContain("<rect");
    expect(markup).toContain('height="240"');
  });

  it("draws a colored swatch + label per legend item, and grows the SVG height to fit them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const downloadChartAsSvg = await freshDownloadChartAsSvg();
    const svg = buildTestSvg();
    const legendItems: { label: string; color: string }[] = [
      { label: "Overall", color: "#c48839" },
      { label: "TLC Applicant", color: "#789d4b" },
      { label: "WFRC", color: "#3f748e" },
    ];

    await downloadChartAsSvg(svg, "chart.svg", legendItems, "#151515");

    const markup = await lastDownloadedMarkup();
    for (const item of legendItems) {
      expect(markup).toContain(`fill="${item.color}"`);
      expect(markup).toContain(`>${item.label}<`);
    }
    // Original height (240) + the fixed legend row height (28) = 268.
    expect(markup).toContain('height="268"');
    expect(markup).toContain('viewBox="0 0 320 268"');
  });
});
