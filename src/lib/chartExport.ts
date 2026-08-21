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

import { downloadBlob } from "./downloadBlob";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", SVG_NAMESPACE);
  }
  return new XMLSerializer().serializeToString(clone);
}

function readSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const width = svg.width.baseVal.value || svg.getBoundingClientRect().width;
  const height = svg.height.baseVal.value || svg.getBoundingClientRect().height;
  return { width, height };
}

export function downloadChartAsSvg(svg: SVGSVGElement, filename: string): void {
  const markup = serializeSvg(svg);
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
  scale = 2,
): Promise<void> {
  const markup = serializeSvg(svg);
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const { width, height } = readSvgDimensions(svg);
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
