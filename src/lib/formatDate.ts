// Shared ISO-date display formatter — extracted from DashboardScreen.tsx (its original
// sole caller) when the Calculations .xlsx export's Project Info sheet needed the exact
// same "August 20, 2026" formatting for the committee meeting date, rather than either
// duplicating the logic a second time or reaching into a feature component from lib code.

/** "2026-08-20" -> "August 20, 2026". Parses the Y/M/D components manually and builds the
 * Date from local-time components rather than `new Date(isoDate)` — the latter parses a
 * bare date string as UTC midnight, which `toLocaleDateString()` can then render as the
 * PREVIOUS day in any timezone west of UTC (a classic off-by-one-day bug). Falls back to
 * the raw string if it isn't the expected shape rather than showing "Invalid Date". */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
