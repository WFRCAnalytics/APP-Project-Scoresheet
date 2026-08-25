// Small "PNG" / "SVG" download pair, shared by both Dashboard charts. Excluded from print
// (.no-print) — these are interactive controls, not part of the PDF record.

import { useState } from "react";
import { downloadChartAsPng, downloadChartAsSvg, type LegendItem } from "../../lib/chartExport";
import { chartExportFilename } from "../../lib/filenames";

export interface ChartExportButtonsProps {
  /** Looks up the live <svg> element at click time, not render time — the chart may not
   * have rendered yet (no data) or may have changed since this button last rendered. */
  getSvg: () => SVGSVGElement | null;
  projectName: string;
  chartLabel: string;
  backgroundColor: string;
  /** Foreground/text color for the legend lib/chartExport.ts draws directly into the
   * exported file — Recharts' own on-screen <Legend> renders as HTML OUTSIDE the <svg>, so
   * it's invisible to the export pipeline unless redrawn as real SVG shapes there. */
  foregroundColor: string;
  /** The legend entries to draw into the exported file — same name/color pairs the caller's
   * on-screen <Legend> already shows. Pass `[]` for a chart with no legend. */
  legendItems: LegendItem[];
}

export function ChartExportButtons({
  getSvg,
  projectName,
  chartLabel,
  backgroundColor,
  foregroundColor,
  legendItems,
}: ChartExportButtonsProps) {
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingSvg, setExportingSvg] = useState(false);

  async function handleSvgClick() {
    const svg = getSvg();
    if (!svg) return;
    setExportingSvg(true);
    try {
      await downloadChartAsSvg(
        svg,
        chartExportFilename(projectName, chartLabel, "svg"),
        legendItems,
        foregroundColor,
      );
    } finally {
      setExportingSvg(false);
    }
  }

  async function handlePngClick() {
    const svg = getSvg();
    if (!svg) return;
    setExportingPng(true);
    try {
      await downloadChartAsPng(
        svg,
        chartExportFilename(projectName, chartLabel, "png"),
        backgroundColor,
        legendItems,
        foregroundColor,
      );
    } finally {
      setExportingPng(false);
    }
  }

  return (
    <div className="chart-export-buttons no-print">
      <button
        type="button"
        className="button button-secondary"
        onClick={handlePngClick}
        disabled={exportingPng}
        data-loading={exportingPng}
      >
        PNG
      </button>
      <button
        type="button"
        className="button button-secondary"
        onClick={handleSvgClick}
        disabled={exportingSvg}
        data-loading={exportingSvg}
      >
        SVG
      </button>
    </div>
  );
}
