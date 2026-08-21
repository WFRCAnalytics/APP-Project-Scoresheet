import { useState } from "react";
import { downloadBlob } from "../../lib/downloadBlob";
import { generateCalculationsWorkbook } from "../../lib/excel/generateCalculationsWorkbook";
import type { Project } from "../../types/project";

export function ExportCalculationsButton({ project }: { project: Project }) {
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
      className="button button-secondary"
      onClick={handleClick}
      disabled={generating}
      data-loading={generating}
    >
      Export as .xlsx
    </button>
  );
}
