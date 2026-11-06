// Renders the report's Recharts charts off-screen and hands back their <svg> markup, which
// svgToPdf.tsx then turns into vector graphics inside the PDF. They are the very same chart
// components the Dashboard uses (the permanently light-colored "PrintCopy" variants, with their
// grow-in animation off), just mounted into a hidden stage at the width they will have on the page
// — Recharts lays itself out from its container's width, so the label sizes and wrapping you see
// in the PDF are the ones the chart really computed for that size.

import { createRoot } from "react-dom/client";
import { CriterionBreakdownChartPrintCopy } from "../../features/dashboard/CriterionBreakdownChart";
import { OverallApplicantBarChartPrintCopy } from "../../features/dashboard/OverallApplicantBarChart";
import type { Project } from "../../types/project";

/** Pixel widths the charts are laid out at. The PDF scales each down to its printed width, so
 * these are chosen to land the chart's 12px labels at roughly 8-10pt on paper. */
export const BAR_CHART_RENDER_WIDTH = 720;
export const RADAR_RENDER_WIDTH = 520;
/** Past this many firms the bar chart labels bars with rank numbers, not names (no room for ten
 * names across the page); the ranking table right above the chart gives the names. */
export const BAR_CHART_RANK_LABELS_AFTER = 6;

export interface CapturedCharts {
  bar: string | null;
  /** Radar chart markup keyed by firm id. */
  radars: Record<string, string>;
}

const STAGE_CSS = `
  .report-stage { position: fixed; left: -99999px; top: 0; pointer-events: none; }
  .report-stage .print-chart-copy { position: static !important; }
  .report-stage [data-chart="bar"] .print-chart-copy { width: ${BAR_CHART_RENDER_WIDTH}px !important; }
  .report-stage [data-chart^="radar:"] .print-chart-copy { width: ${RADAR_RENDER_WIDTH}px !important; }
`;

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function serialize(svg: SVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

function chartSvg(stage: HTMLElement, key: string): SVGElement | null {
  const wrapper = Array.from(stage.querySelectorAll("[data-chart]")).find(
    (el) => el.getAttribute("data-chart") === key,
  );
  return wrapper?.querySelector("svg.recharts-surface") ?? null;
}

/** Waits until every expected chart has drawn and stopped changing (Recharts sizes itself in a
 * second pass once its container has been measured), or gives up after `timeoutMs`. */
async function settled(stage: HTMLElement, keys: string[], timeoutMs: number): Promise<void> {
  const start = performance.now();
  let previous = "";
  let stableFrames = 0;
  while (performance.now() - start < timeoutMs) {
    await frame();
    const svgs = keys.map((key) => chartSvg(stage, key));
    if (svgs.every((svg) => svg && svg.querySelector("path, rect"))) {
      const snapshot = svgs.map((svg) => svg?.innerHTML.length ?? 0).join(",");
      stableFrames = snapshot === previous ? stableFrames + 1 : 0;
      previous = snapshot;
      if (stableFrames >= 4) return;
    }
  }
}

export async function captureReportCharts(
  project: Project,
  firmIds: string[],
  timeoutMs = 6000,
): Promise<CapturedCharts> {
  const stage = document.createElement("div");
  stage.className = "report-stage";
  stage.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = STAGE_CSS;
  stage.appendChild(style);
  const mount = document.createElement("div");
  stage.appendChild(mount);
  document.body.appendChild(stage);

  const root = createRoot(mount);
  try {
    root.render(
      <>
        <div data-chart="bar">
          <OverallApplicantBarChartPrintCopy project={project} rankLabelsAfter={BAR_CHART_RANK_LABELS_AFTER} />
        </div>
        {firmIds.map((firmId) => (
          <div key={firmId} data-chart={`radar:${firmId}`}>
            <CriterionBreakdownChartPrintCopy project={project} firmId={firmId} />
          </div>
        ))}
      </>,
    );

    const keys = ["bar", ...firmIds.map((id) => `radar:${id}`)];
    await settled(stage, keys, timeoutMs);

    const bar = chartSvg(stage, "bar");
    const radars: Record<string, string> = {};
    for (const firmId of firmIds) {
      const svg = chartSvg(stage, `radar:${firmId}`);
      if (svg) radars[firmId] = serialize(svg);
    }
    return { bar: bar ? serialize(bar) : null, radars };
  } finally {
    root.unmount();
    stage.remove();
  }
}
