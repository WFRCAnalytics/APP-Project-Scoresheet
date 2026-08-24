// T043: "Export PDF report" (FR-035) — drives the browser's native print pipeline via
// react-to-print against DashboardScreen's printable region (real DOM/CSS, real
// selectable text, Recharts' real SVG vector paths — not a rasterized image; see
// research.md §4 for why this was chosen over html2canvas+jsPDF).
//
// The one true PRIMARY action in the Dashboard toolbar (post-launch redesign) — the PDF is
// the actual procurement-record deliverable this whole tool exists to produce, so it's the
// only button that keeps solid `button-primary` styling; every other toolbar control is
// secondary/icon-only next to it (DashboardScreen.tsx's own header comment has the full
// rationale). Visible label shortened to "PDF Report" now that it sits inside a
// clearly-exported "export" toolbar group with an icon of its own — aria-label keeps the
// fuller original phrasing for screen-reader clarity.

import { FileText } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { useLoadedProject } from "../../state/ProjectContext";
import { PRINT_PAGE_STYLE, printDocumentTitle } from "../../lib/pdf/printLayout";
import type { RefObject } from "react";

export function ExportPdfButton({ printRef }: { printRef: RefObject<HTMLDivElement> }) {
  const { project } = useLoadedProject();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: printDocumentTitle(project.project.projectName),
    pageStyle: PRINT_PAGE_STYLE,
  });

  return (
    <button
      type="button"
      className="button button-primary no-print"
      onClick={handlePrint}
      aria-label="Export PDF report"
      title="Export PDF report"
    >
      <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
      PDF Report
    </button>
  );
}
