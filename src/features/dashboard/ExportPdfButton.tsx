// T043: "Export PDF report" (FR-035) — drives the browser's native print pipeline via
// react-to-print against DashboardScreen's printable region (real DOM/CSS, real
// selectable text, Recharts' real SVG vector paths — not a rasterized image; see
// research.md §4 for why this was chosen over html2canvas+jsPDF).

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
    <button type="button" className="button button-primary no-print" onClick={handlePrint}>
      Export PDF report
    </button>
  );
}
