// Downloads a Recharts-rendered <svg> as a standalone .svg file, or rasterizes it to a
// .png — using only native browser APIs (Blob, Image, Canvas), no export library. Same
// "prefer native browser capability over an extra dependency" call research.md §4 already
// made for the PDF export (rejecting html2canvas+jsPDF in favor of react-to-print's native
// print pipeline) — this is the same principle applied to per-chart image export.
//
// Prerequisite this relies on: the SVG's own fill/stroke/text colors must already be
// literal hex, not `var(--...)` CSS custom-property references. theme/chartColors.ts
// resolves those to hex before they ever reach Recharts, specifically so the SVG grabbed
// here is self-contained — an SVG used outside this document (a saved .svg file, or an
// <img> used to draw into a canvas) has no `:root` to resolve a CSS variable against, and
// `stroke`'s CSS-invalid-value fallback is "none" (invisible), not black — gridlines with
// an unresolved `stroke="var(--color-border)"` would silently vanish rather than just look
// wrong.
//
// Two gaps found after shipping the above (both from real exported files, not hypothetical):
//  1. No font: an exported chart's <text> elements have no font-family of their own — on
//     screen they only ever inherit Poppins from `body { font-family: var(--font-body) }`
//     (app.css), which doesn't travel with a standalone serialized SVG. Fixed by setting an
//     explicit font-family on the exported root (the same fallback stack --font-body uses)
//     AND embedding the actual Poppins font data as a base64 @font-face (lib/fontEmbed.ts),
//     so the export renders correctly even on a system that doesn't have Poppins installed
//     — not just requesting a font name that may not resolve to anything.
//  2. No legend: Recharts' own <Legend> renders as an HTML element OUTSIDE the <svg> (a
//     sibling `.recharts-legend-wrapper` <div>, absolutely positioned by the browser's own
//     flexbox layout) — invisible to this file, which only ever captures and serializes the
//     <svg> element itself. Fixed by drawing a small legend directly as real SVG <rect>/
//     <text> elements INTO the exported copy only (the on-screen chart is untouched, still
//     using Recharts' own Legend) — real SVG shapes are the only thing guaranteed to survive
//     BOTH the standalone-.svg-file case and the PNG-via-canvas rasterization case (a
//     <foreignObject>-embedded HTML legend would likely work when the .svg is opened in a
//     real browser tab, but not when drawn into a canvas via `ctx.drawImage(svgAsImg, ...)`
//     — that path renders the SVG as a "restricted" image that most browsers refuse to
//     paint foreignObject content into at all).

import { fetchEmbeddedFontFaceCss } from "./fontEmbed";
import { downloadBlob } from "./downloadBlob";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// Matches --font-body's own fallback stack (theme/tokens.css) — if the embedded-font fetch
// above ever fails (offline export, ad blocker, Google Fonts API shape change), a viewer
// that happens to have Poppins installed system-wide still gets it correctly, and everyone
// else gets the same reasonable system-font fallback the app itself would use, rather than
// whatever arbitrary default the viewing application has.
const CHART_FONT_STACK =
  "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

export interface LegendItem {
  label: string;
  color: string;
}

const LEGEND_ROW_HEIGHT = 28;
const LEGEND_FONT_SIZE = 12;
const LEGEND_SWATCH_SIZE = 10;
const LEGEND_ITEM_GAP = 8; // between a swatch and its own label
const LEGEND_GROUP_GAP = 20; // between one item and the next

/** Rough width estimate for a legend label — good enough for horizontally centering a
 * short, known-in-advance label list (every legend on this Dashboard has 2-3 items), not
 * pixel-perfect text measurement (which would need a live DOM/canvas measurement pass this
 * already-cloned, about-to-be-detached SVG has no cheap way to perform). */
function estimateTextWidth(text: string): number {
  return text.length * (LEGEND_FONT_SIZE * 0.58);
}

/** Appends a legend row as real SVG shapes below the chart's existing content, and grows
 * the SVG's own height (and viewBox, if present) to make room for it — mutates `clone` in
 * place. No-ops if there's no legend to draw, leaving the export exactly as it was before
 * this fix existed. */
function appendLegend(
  clone: SVGSVGElement,
  items: LegendItem[],
  chartWidth: number,
  chartHeight: number,
  foregroundColor: string,
): number {
  if (items.length === 0) return chartHeight;

  const itemWidths = items.map(
    (item) => LEGEND_SWATCH_SIZE + LEGEND_ITEM_GAP + estimateTextWidth(item.label),
  );
  const totalWidth = itemWidths.reduce((sum, w) => sum + w, 0) + LEGEND_GROUP_GAP * (items.length - 1);

  const group = document.createElementNS(SVG_NAMESPACE, "g");
  let x = Math.max(0, (chartWidth - totalWidth) / 2);
  const y = chartHeight + LEGEND_ROW_HEIGHT / 2;

  items.forEach((item, i) => {
    const rect = document.createElementNS(SVG_NAMESPACE, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y - LEGEND_SWATCH_SIZE / 2));
    rect.setAttribute("width", String(LEGEND_SWATCH_SIZE));
    rect.setAttribute("height", String(LEGEND_SWATCH_SIZE));
    rect.setAttribute("fill", item.color);
    group.appendChild(rect);

    const text = document.createElementNS(SVG_NAMESPACE, "text");
    text.setAttribute("x", String(x + LEGEND_SWATCH_SIZE + LEGEND_ITEM_GAP));
    text.setAttribute("y", String(y));
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-size", String(LEGEND_FONT_SIZE));
    text.setAttribute("fill", foregroundColor);
    text.textContent = item.label;
    group.appendChild(text);

    x += itemWidths[i] + LEGEND_GROUP_GAP;
  });

  clone.appendChild(group);

  const newHeight = chartHeight + LEGEND_ROW_HEIGHT;
  clone.setAttribute("height", String(newHeight));
  const viewBox = clone.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) {
      parts[3] = newHeight;
      clone.setAttribute("viewBox", parts.join(" "));
    }
  }
  return newHeight;
}

/** Prefers the literal `width`/`height` ATTRIBUTES (which Recharts always sets on its root
 * <svg>) over `.width.baseVal.value` — functionally identical in a real browser (Recharts
 * keeps both in sync), but attribute parsing also works in test environments whose SVG
 * support doesn't implement SVGAnimatedLength (jsdom, notably), where `.baseVal` is
 * `undefined` rather than throwing or falling through cleanly. `getBoundingClientRect()`
 * stays as the last-resort fallback for an SVG with neither. */
function readSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const attrWidth = parseFloat(svg.getAttribute("width") ?? "");
  const attrHeight = parseFloat(svg.getAttribute("height") ?? "");
  const width =
    Number.isFinite(attrWidth) && attrWidth > 0
      ? attrWidth
      : svg.width?.baseVal?.value || svg.getBoundingClientRect().width;
  const height =
    Number.isFinite(attrHeight) && attrHeight > 0
      ? attrHeight
      : svg.height?.baseVal?.value || svg.getBoundingClientRect().height;
  return { width, height };
}

async function serializeSvg(
  svg: SVGSVGElement,
  legendItems: LegendItem[],
  foregroundColor: string,
): Promise<{ markup: string; width: number; height: number }> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", SVG_NAMESPACE);
  }
  clone.setAttribute("font-family", CHART_FONT_STACK);

  const { width, height } = readSvgDimensions(svg);
  const finalHeight = appendLegend(clone, legendItems, width, height, foregroundColor);

  const fontFaceCss = await fetchEmbeddedFontFaceCss();
  if (fontFaceCss) {
    const styleEl = document.createElementNS(SVG_NAMESPACE, "style");
    styleEl.textContent = fontFaceCss;
    clone.insertBefore(styleEl, clone.firstChild);
  }

  return { markup: new XMLSerializer().serializeToString(clone), width, height: finalHeight };
}

export async function downloadChartAsSvg(
  svg: SVGSVGElement,
  filename: string,
  legendItems: LegendItem[],
  foregroundColor: string,
): Promise<void> {
  const { markup } = await serializeSvg(svg, legendItems, foregroundColor);
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load the chart as an image."));
    image.src = url;
  });
}

/**
 * Rasterizes the SVG to a PNG via an offscreen <canvas> — load the serialized SVG as an
 * <img>, draw it into a canvas, export the canvas as a PNG blob. `scale` renders at a
 * higher pixel density than the on-screen SVG (2x by default) so the PNG isn't blurry when
 * viewed or printed larger than the dashboard card. `backgroundColor` is painted behind the
 * chart first — Recharts' SVG has no background rect of its own, so without this the PNG
 * would come out with a transparent background instead of matching the app's theme.
 */
export async function downloadChartAsPng(
  svg: SVGSVGElement,
  filename: string,
  backgroundColor: string,
  legendItems: LegendItem[],
  foregroundColor: string,
  scale = 2,
): Promise<void> {
  const { markup, width, height } = await serializeSvg(svg, legendItems, foregroundColor);
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale) || image.naturalWidth;
    canvas.height = Math.round(height * scale) || image.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available.");

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Failed to create PNG image data.");
    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
