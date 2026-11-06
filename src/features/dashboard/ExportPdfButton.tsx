// "PDF Report" in the Dashboard toolbar: builds and downloads the formatted PDF report
// (lib/report/) — a designed document generated from the project's data (cover, results overview,
// evaluation framework, one profile per firm with its charts, reviewer scores and comments). It is
// real vector PDF with selectable text, not the browser's print dialog.
//
// The one true PRIMARY action in the Dashboard toolbar: the PDF is the procurement-record
// deliverable this tool exists to produce, so it keeps solid `button-primary` styling while every
// other toolbar control is secondary. The report code (PDF renderer, fonts, layout) is loaded on
// the first click, so it never weighs on the app's initial load.

import { FileText } from "lucide-react";
import { useState } from "react";
import { downloadBlob } from "../../lib/downloadBlob";
import { useLoadedProject } from "../../state/ProjectContext";

export function ExportPdfButton() {
  const { project } = useLoadedProject();
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setGenerating(true);
    setFailed(false);
    try {
      const { generateReport } = await import("../../lib/report/generateReport");
      const { blob, filename } = await generateReport(project);
      downloadBlob(blob, filename);
    } catch (error) {
      console.error("PDF report generation failed", error);
      setFailed(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      type="button"
      className="button button-primary no-print"
      onClick={handleClick}
      disabled={generating}
      data-loading={generating}
      aria-label="Export PDF report"
      title={
        failed
          ? "The report could not be generated. Try again."
          : "Download the formatted PDF report"
      }
    >
      <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
      {generating ? "Building PDF…" : failed ? "Failed, retry" : "PDF Report"}
    </button>
  );
}
