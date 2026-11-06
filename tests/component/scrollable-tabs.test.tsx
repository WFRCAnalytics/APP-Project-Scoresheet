// ScrollableTabs: a tab strip that stays on one row however many tabs there are — it scrolls
// (with ‹ › buttons that only appear when the tabs don't fit), shortens long labels, and
// follows the WAI-ARIA tabs keyboard pattern. jsdom has no layout, so overflow is simulated by
// giving the tablist element a scrollWidth / clientWidth / scrollLeft and firing a scroll event.

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollableTabs } from "../../src/components/ScrollableTabs";

const TABS = [
  { id: "a", label: "Alpha", badge: 2 },
  { id: "b", label: "A Very Long Criterion Name That Needs Shortening" },
  { id: "c", label: "Gamma", badge: 0 },
];

function Harness({ initial = "a" }: { initial?: string }) {
  const [active, setActive] = useState(initial);
  return (
    <>
      <ScrollableTabs
        tabs={TABS}
        activeId={active}
        onSelect={setActive}
        ariaLabel="Test tabs"
        idPrefix="t"
        panelId="t-panel"
      />
      <div role="tabpanel" id="t-panel">
        {active}
      </div>
    </>
  );
}

const tablist = () => screen.getByRole("tablist", { name: "Test tabs" });

function simulateLayout(el: HTMLElement, layout: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
  for (const [key, value] of Object.entries(layout)) {
    Object.defineProperty(el, key, { value, configurable: true, writable: true });
  }
  fireEvent.scroll(el);
}

describe("ScrollableTabs — tabs", () => {
  it("marks the active tab selected, with a roving tabindex", () => {
    render(<Harness />);
    const [alpha, long, gamma] = screen.getAllByRole("tab");
    expect(alpha).toHaveAttribute("aria-selected", "true");
    expect(long).toHaveAttribute("aria-selected", "false");
    expect(alpha).toHaveAttribute("tabindex", "0");
    expect(long).toHaveAttribute("tabindex", "-1");
    expect(gamma).toHaveAttribute("tabindex", "-1");
  });

  it("gives every tab its full label as a tooltip, since long ones are cut with an ellipsis", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: /A Very Long Criterion/ })).toHaveAttribute(
      "title",
      "A Very Long Criterion Name That Needs Shortening",
    );
  });

  it("shows a count badge only when it is above zero", () => {
    render(<Harness />);
    const [alpha, long, gamma] = screen.getAllByRole("tab");
    expect(alpha.querySelector(".badge")).toHaveTextContent("2");
    expect(long.querySelector(".badge")).toBeNull();
    expect(gamma.querySelector(".badge")).toBeNull(); // 0 is not shown
  });

  it("selects a tab on click and links it to its panel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Gamma" }));
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-controls", "t-panel");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("c");
  });
});

describe("ScrollableTabs — keyboard", () => {
  it("moves with ArrowRight / ArrowLeft, wrapping at the ends, and focuses the new tab", () => {
    render(<Harness />);
    fireEvent.keyDown(tablist(), { key: "ArrowRight" });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("b");
    expect(screen.getAllByRole("tab")[1]).toHaveFocus();

    fireEvent.keyDown(tablist(), { key: "ArrowLeft" });
    fireEvent.keyDown(tablist(), { key: "ArrowLeft" }); // from the first tab, wraps to the last
    expect(screen.getByRole("tabpanel")).toHaveTextContent("c");
  });

  it("jumps with Home and End", () => {
    render(<Harness initial="b" />);
    fireEvent.keyDown(tablist(), { key: "End" });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("c");
    fireEvent.keyDown(tablist(), { key: "Home" });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("a");
  });

  it("ignores other keys", () => {
    render(<Harness />);
    fireEvent.keyDown(tablist(), { key: "x" });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("a");
  });
});

describe("ScrollableTabs — overflow", () => {
  it("shows no scroll buttons when every tab fits", () => {
    render(<Harness />);
    simulateLayout(tablist(), { scrollWidth: 300, clientWidth: 400, scrollLeft: 0 });
    expect(screen.queryByRole("button", { name: /Scroll tabs/ })).not.toBeInTheDocument();
  });

  it("shows ‹ › when the tabs don't fit — ‹ disabled at the start", () => {
    render(<Harness />);
    simulateLayout(tablist(), { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 });
    expect(screen.getByRole("button", { name: "Scroll tabs left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Scroll tabs right" })).toBeEnabled();
  });

  it("scrolls by most of the visible width when › is clicked", () => {
    render(<Harness />);
    const list = tablist();
    const scrollBy = vi.fn();
    (list as HTMLElement & { scrollBy: typeof scrollBy }).scrollBy = scrollBy;
    simulateLayout(list, { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Scroll tabs right" }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 210, behavior: "smooth" }); // 70% of 300
  });

  it("disables › once scrolled to the end, and enables ‹", () => {
    render(<Harness />);
    simulateLayout(tablist(), { scrollWidth: 900, clientWidth: 300, scrollLeft: 600 });
    expect(screen.getByRole("button", { name: "Scroll tabs right" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Scroll tabs left" })).toBeEnabled();
  });
});
