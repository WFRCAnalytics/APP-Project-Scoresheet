// Shared "rough width estimate" heuristic for Poppins (--font-body) — used anywhere a chart
// needs to guess a label's rendered width without a live DOM/canvas measurement pass
// (lib/chartExport.ts's detached, about-to-be-serialized SVG clone has no cheap way to do
// that; features/dashboard's axis-label wrapping runs on every render and a canvas
// measurement pass there would be needless work for a rough estimate). Not pixel-perfect —
// callers that use this should already tolerate some slack (e.g. wrapAxisLabel's safety
// margin) rather than relying on an exact fit.
const AVG_CHAR_WIDTH_FACTOR = 0.58;

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVG_CHAR_WIDTH_FACTOR;
}
