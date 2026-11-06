// "Excel" in the Dashboard toolbar: downloads the calculations workbook (Results, Calculations,
// Comments, and the project's configuration tabs — lib/excel/generateCalculationsWorkbook.ts).
// This replaced the old "Show calculations" dialog: its heatmap is now the Dashboard's Reviewer
// scores tab, its manual entry lives on Reviewer Forms, and its full audit table — every raw
// score plus each criterion's averages, weighted contributions and completion — is the
// workbook's Calculations tab, so nothing the dialog showed is lost, it just isn't on screen.

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { downloadBlob } from "../../lib/downloadBlob";
import { generateCalculationsWorkbook } from "../../lib/excel/generateCalculationsWorkbook";
import { useLoadedProject } from "../../state/ProjectContext";

export function ExportExcelButton() {
  const { project } = useLoadedProject();
  const [generating, setGenerating] = useState(false);

  async function handleClick() {
    setGenerating(true);
    try {
      const { blob, filename } = await generateCalculationsWorkbook(project);
      downloadBlob(blob, filename);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      type="button"
      className="button button-secondary no-print"
      onClick={handleClick}
      disabled={generating}
      data-loading={generating}
      aria-label="Export Excel workbook"
      title="Export the calculations as an Excel workbook (.xlsx)"
    >
      <FileSpreadsheet size={16} strokeWidth={1.75} aria-hidden="true" />
      Excel
    </button>
  );
}
