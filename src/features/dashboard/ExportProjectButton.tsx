// T044: Export project JSON, available on the Dashboard, including all scores collected
// so far (FR-036, FR-037). Thin wrapper around the shared implementation — see
// components/ExportProjectJsonButton.tsx for why this isn't a second, independently
// maintained copy of the same logic Configuration's export button (T029) needs.

import { ExportProjectJsonButton } from "../../components/ExportProjectJsonButton";

export function ExportProjectButton() {
  return <ExportProjectJsonButton />;
}
