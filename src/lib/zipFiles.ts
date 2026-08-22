// Post-launch improvements, item 4: packages multiple generated files into a single .zip
// Blob. Pulled out of GenerateAllFormsButton.tsx as its own function purely so the JSZip
// API surface touches exactly one file in this codebase.

import JSZip from "jszip";

export async function zipFiles(files: Array<{ filename: string; blob: Blob }>): Promise<Blob> {
  const zip = new JSZip();
  for (const { filename, blob } of files) {
    zip.file(filename, blob);
  }
  return zip.generateAsync({ type: "blob" });
}
