// Shared blob-download trigger — the same mechanism ExportProjectButton.tsx uses for
// project.json, reused here for .xlsx workbooks so there's one implementation of
// "make the browser save this Blob under this filename," not one per feature.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
