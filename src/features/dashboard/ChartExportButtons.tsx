// Small "PNG" / "SVG" download pair, shared by both Dashboard charts. Excluded from print
// (.no-print) — these are interactive controls, not part of the PDF record.

import { useState } from "react";
import { downloadChartAsPng, downloadChartAsSvg } from "../../lib/chartExport";
import { chartExportFilename } from "../../lib/filenames";

export interface ChartExportButtonsProps {
  /** Looks up the live <svg> element at click time, not render time — the chart may not
   * have rendered yet (no data) or may have changed since this button last rendered. */
  getSvg: () => SVGSVGElement | null;
  projectName: string;
  chartLabel: string;
  backgroundColor: string;
}

export function ChartExportButtons({
  getSvg,
  projectName,
  chartLabel,
  backgroundColor,
}: ChartExportButtonsProps) {
  const [exportingPng, setExportingPng] = useState(false);

  function handleSvgClick() {
    const svg = getSvg();
    if (!svg) return;
    downloadChartAsSvg(svg, chartExportFilename(projectName, chartLabel, "svg"));
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
      <button type="button" className="button button-secondary" onClick={handleSvgClick}>
        SVG
      </button>
    </div>
  );
}
