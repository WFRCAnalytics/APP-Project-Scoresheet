// Builds the formatted PDF report for a project and returns it as a Blob. The heavy parts (the PDF
// renderer, its fonts, the document layout) are loaded with a dynamic import the first time someone
// asks for a report, so they never weigh on the app's initial load.

import logoUrl from "../../assets/logo/horizontal/WFRC_logo_horizontal_white_transparent.png";
import type { Project } from "../../types/project";
import { reportPdfFilename } from "../filenames";
import { captureReportCharts, BAR_CHART_RENDER_WIDTH, RADAR_RENDER_WIDTH } from "./captureCharts";
import { buildReportModel } from "./reportModel";

/** Printed widths, in points, of the two charts (see ReportDocument.tsx's layout). */
const BAR_PRINT_WIDTH = 524;
const RADAR_PRINT_WIDTH = 380;

export async function generateReport(project: Project): Promise<{ blob: Blob; filename: string }> {
  const model = buildReportModel(project);

  const [{ pdf }, { ReportDocument }, { FONTS, registerReportFonts }, { svgMarkupToPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ReportDocument"),
    import("./reportTheme"),
    import("./svgToPdf"),
  ]);
  registerReportFonts();

  // The charts are laid out at their on-screen pixel width and scaled down to their printed width.
  const captured = await captureReportCharts(
    project,
    model.firms.map((f) => f.firm.id),
  );
  const fontFamily = FONTS.body;
  const bar = captured.bar
    ? svgMarkupToPdf(captured.bar, { width: BAR_PRINT_WIDTH, fontFamily, fontSize: 12 })
    : null;
  const radars = Object.fromEntries(
    Object.entries(captured.radars).map(([firmId, markup]) => [
      firmId,
      svgMarkupToPdf(markup, { width: RADAR_PRINT_WIDTH, fontFamily, fontSize: 12 }),
    ]),
  );

  const blob = await pdf(
    <ReportDocument model={model} project={project} charts={{ bar, radars }} logoUrl={logoUrl} />,
  ).toBlob();
  return { blob, filename: reportPdfFilename(project.project.projectName) };
}

export { BAR_CHART_RENDER_WIDTH, RADAR_RENDER_WIDTH };
