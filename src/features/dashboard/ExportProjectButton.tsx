// T044: Export project JSON, available on the Dashboard, including all scores collected
// so far (FR-036, FR-037). Thin wrapper around the shared implementation — see
// components/ExportProjectJsonButton.tsx for why this isn't a second, independently
// maintained copy of the same logic Configuration's export button (T029) needs.
//
// Not a plain re-export (unlike Configuration's own wrapper) specifically to pin
// variant="compact" — the Dashboard toolbar's split-button treatment, which is deliberately
// NOT the default so Configuration's call site needs zero changes to keep its original
// always-visible label+input+button rendering.

import { ExportProjectJsonButton } from "../../components/ExportProjectJsonButton";

export function ExportProjectButton() {
  return <ExportProjectJsonButton variant="compact" />;
}
