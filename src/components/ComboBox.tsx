// A small hand-rolled implementation of the WAI-ARIA "editable combobox with list
// autocomplete" pattern — not a new dependency (constitution Principle VIII's fixed stack).
// Replaces an earlier `<input list>` / `<datalist>` pair for FirmsEditor's Name field: real
// browsers render that with wildly inconsistent, unstyleable suggestion UI (no way to theme
// it to match the rest of the app), which read as visually out of place. This is still a
// plain free-text input under the hood — nothing here restricts what can be typed or
// committed, the dropdown is purely a suggestion overlay.
//
// The suggestion panel renders through a portal into document.body, positioned via
// getBoundingClientRect rather than as a normal absolutely-positioned child of the input's
// own wrapper: every data-table lives inside `.table-wrap`, which uses `overflow: hidden`
// to clip content to its own rounded corners (app.css) — a plain in-flow dropdown would get
// silently clipped the moment a row sits near the bottom edge. `position: fixed` with raw
// (unadjusted) getBoundingClientRect coordinates needs no scroll-offset math since both are
// already viewport-relative; the panel closes on scroll (any ancestor's, caught via a
// capture-phase window listener — scroll doesn't bubble, but capture-phase listeners on a
// common ancestor still see it) rather than continuously repositioning while scrolling.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface ComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  ariaLabel: string;
}

const MAX_VISIBLE_OPTIONS = 8;

interface PanelRect {
  top: number;
  left: number;
  width: number;
}

export function ComboBox({ value, onChange, options, ariaLabel }: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;
  const visible = filtered.slice(0, MAX_VISIBLE_OPTIONS);
  const showPanel = isOpen && (visible.length > 0 || query.length > 0);

  useEffect(() => {
    if (!showPanel) return;
    function closeOnScroll() {
      setIsOpen(false);
    }
    // Capture phase: scroll events don't bubble, but a capture-phase listener on a common
    // ancestor (window) still observes them regardless of which scrollable element scrolled.
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [showPanel]);

  function openPanel() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setPanelRect({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }

  function selectOption(option: string) {
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
    // No explicit .focus() here: a mouse selection arrives via onMouseDown with
    // preventDefault (see below), which already stops focus from ever leaving the input in
    // the first place — calling .focus() again would re-fire onFocus and reopen the panel
    // right back up, showing the just-selected value as its own only "match" (found by the
    // component test written against this behavior).
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openPanel();
      setHighlightedIndex((i) => (i + 1 < visible.length ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openPanel();
      setHighlightedIndex((i) => (i - 1 >= 0 ? i - 1 : visible.length - 1));
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && visible[highlightedIndex]) {
        e.preventDefault();
        selectOption(visible[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  const activeOptionId =
    isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

  return (
    <div className="combobox">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openPanel();
          setHighlightedIndex(-1);
        }}
        onFocus={openPanel}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }}
      />
      {showPanel &&
        panelRect &&
        createPortal(
          <ul
            className="combobox-listbox"
            role="listbox"
            id={listboxId}
            style={{ top: panelRect.top, left: panelRect.left, width: panelRect.width }}
          >
            {visible.length === 0 ? (
              <li className="combobox-empty" role="presentation">
                No matches — this name will be used as-is.
              </li>
            ) : (
              visible.map((option, index) => (
                <li
                  key={option}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={`combobox-option${index === highlightedIndex ? " is-highlighted" : ""}`}
                  // onMouseDown (not onClick) + preventDefault: without this, the input's
                  // own onBlur fires FIRST (closing the panel) before a click event ever
                  // reaches this <li>, so nothing would ever be selectable by mouse — the
                  // standard gotcha for any hand-rolled input+listbox combobox.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option}
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
