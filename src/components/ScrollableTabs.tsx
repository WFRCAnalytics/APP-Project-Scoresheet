// A single-row tab strip that stays one row however many tabs there are. When they don't all
// fit, the row scrolls sideways and ‹ › buttons appear at its ends (hidden when everything
// fits, so a short list of tabs looks like a plain tab bar). Long labels are shortened with an
// ellipsis (full text on hover) so a few long names can't push the rest out of view, and the
// selected tab is kept in view.
//
// Implements the WAI-ARIA tabs pattern: role="tablist" / "tab", aria-selected, a roving
// tabindex (only the selected tab is in the Tab order), and Left / Right / Home / End to move
// between tabs. The caller renders the matching role="tabpanel" (see `panelId`, `tabId`).

import { Badge } from "./Badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { scrollableTabId } from "./scrollableTabId";
import "./ScrollableTabs.css";

export interface ScrollableTab {
  id: string;
  label: string;
  /** Small count pill after the label; omitted (not shown as 0) when undefined or 0. */
  badge?: number;
}

export interface ScrollableTabsProps {
  tabs: ScrollableTab[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  idPrefix: string;
  /** id of the tabpanel these tabs control. */
  panelId: string;
}

/** How far the ‹ › buttons scroll, as a fraction of the visible width. */
const SCROLL_STEP = 0.7;

export function ScrollableTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel,
  idPrefix,
  panelId,
}: ScrollableTabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ overflowing: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    setOverflow({
      overflowing,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  // Re-measure whenever the row scrolls or its size changes (window resize, card width).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, tabs.length]);

  // Keep the selected tab fully visible. Scrolls only the tab row itself — never
  // scrollIntoView, which would also scroll the whole page toward the tabs.
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!list || !tab) return;
    const margin = 8;
    if (tab.offsetLeft < list.scrollLeft) {
      list.scrollLeft = Math.max(0, tab.offsetLeft - margin);
    } else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth + margin;
    }
  }, [activeId]);

  function scrollByStep(direction: 1 | -1) {
    const el = listRef.current;
    if (!el) return;
    const left = direction * el.clientWidth * SCROLL_STEP;
    if (el.scrollBy) el.scrollBy({ left, behavior: "smooth" });
    else el.scrollLeft += left;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === activeId);
    let next: number;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onSelect(tabs[next].id);
    document.getElementById(scrollableTabId(idPrefix, tabs[next].id))?.focus();
  }

  const nav = (direction: 1 | -1) => {
    const disabled = direction === -1 ? overflow.atStart : overflow.atEnd;
    return (
      <button
        type="button"
        className="scrollable-tabs-nav"
        aria-label={direction === -1 ? "Scroll tabs left" : "Scroll tabs right"}
        disabled={disabled}
        // The tabs themselves are the keyboard path (arrow keys); these are for the mouse.
        tabIndex={-1}
        onClick={() => scrollByStep(direction)}
      >
        {direction === -1 ? (
          <ChevronLeft size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="scrollable-tabs">
      {overflow.overflowing && nav(-1)}
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        className="scrollable-tabs-list"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={scrollableTabId(idPrefix, tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              title={tab.label}
              className={`scrollable-tab${selected ? " is-active" : ""}`}
              onClick={() => onSelect(tab.id)}
            >
              <span className="scrollable-tab-label">{tab.label}</span>
              {/* A real space, so the tab's accessible name reads "Approach 2", not "Approach2" —
                  it takes no room visually (whitespace between flex items is ignored). */}
              {tab.badge ? (
                <>
                  {" "}
                  <Badge variant="neutral">{tab.badge}</Badge>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      {overflow.overflowing && nav(1)}
    </div>
  );
}
