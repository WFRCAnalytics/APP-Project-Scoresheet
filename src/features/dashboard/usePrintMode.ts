// Tracks whether the page is currently mid-print, via the same beforeprint/afterprint
// window events theme/chartColors.ts already relies on for this exact printRef + react-to-
// print pipeline (see that file's comment for why `window`-level events fire correctly
// here). RankedFirmsTable uses this to force two things back to their canonical,
// unambiguous form for the procurement record regardless of whatever a viewer left the
// on-screen UI showing: row order (always rank order, never the on-screen sort) and row
// expansion (always fully expanded, never collapsed) — sorting and collapsing are pure
// on-screen viewing conveniences and must never cause the PDF to omit or reorder data.
import { useEffect, useState } from "react";

export function usePrintMode(): boolean {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const start = () => setIsPrinting(true);
    const end = () => setIsPrinting(false);
    window.addEventListener("beforeprint", start);
    window.addEventListener("afterprint", end);
    return () => {
      window.removeEventListener("beforeprint", start);
      window.removeEventListener("afterprint", end);
    };
  }, []);

  return isPrinting;
}
