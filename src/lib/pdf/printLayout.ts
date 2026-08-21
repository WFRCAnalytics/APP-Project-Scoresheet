// T043: Print-layout constants for the PDF export. react-to-print copies the parent
// document's stylesheets into its print iframe by default (`copyStyles: true`), so
// theme/tokens.css's `@media print` block (the actual high-contrast color overrides —
// constitution Principle VII's PDF carve-out) already applies without duplicating it
// here. This module only adds what react-to-print needs beyond that: page geometry and
// the buttons/controls that must never appear in the printed output.

export const PRINT_PAGE_STYLE = `
  @page {
    size: letter;
    margin: 0.75in;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

export function printDocumentTitle(projectName: string): string {
  const name = projectName.trim() || "Untitled Project";
  return `${name} — Consultant Selection Scoring Report`;
}
