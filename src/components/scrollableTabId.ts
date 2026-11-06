/** The DOM id of a ScrollableTabs tab — a tab's panel needs it for its aria-labelledby. Lives
 * apart from ScrollableTabs.tsx so that file exports only the component (React fast refresh). */
export function scrollableTabId(idPrefix: string, id: string): string {
  return `${idPrefix}-tab-${id}`;
}
