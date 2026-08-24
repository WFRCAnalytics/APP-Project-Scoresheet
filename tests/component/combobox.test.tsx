// Component coverage for the hand-rolled ComboBox (components/ComboBox.tsx) — the WAI-ARIA
// editable-combobox pattern that replaced FirmsEditor's earlier native <input list>/
// <datalist> pair. Tested standalone here (not through FirmsEditor) so it's exercised as a
// reusable primitive, not coupled to any one caller's data.

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ComboBox } from "../../src/components/ComboBox";

const OPTIONS = ["Alpha Co", "Beta Co", "Gamma Co", "Delta Co"] as const;

function ControlledComboBox() {
  const [value, setValue] = useState("");
  return <ComboBox ariaLabel="Firm name" options={OPTIONS} value={value} onChange={setValue} />;
}

describe("ComboBox", () => {
  it("shows the full option list on focus when empty", () => {
    render(<ControlledComboBox />);
    fireEvent.focus(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    for (const option of OPTIONS) {
      expect(screen.getByRole("option", { name: option })).toBeInTheDocument();
    }
  });

  it("filters options as the user types (case-insensitive substring match)", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "co" } }); // matches all four — still narrow it
    fireEvent.change(input, { target: { value: "gam" } });

    expect(screen.getByRole("option", { name: "Gamma Co" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha Co" })).not.toBeInTheDocument();
  });

  it("clicking an option selects it and closes the panel", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole("option", { name: "Beta Co" }));

    expect(input.value).toBe("Beta Co");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowDown + Enter selects the highlighted option via keyboard alone", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // highlights "Alpha Co" (index 0)
    fireEvent.keyDown(input, { key: "ArrowDown" }); // highlights "Beta Co" (index 1)
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("Beta Co");
  });

  it("Escape closes the panel without changing the typed value", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Something Custom" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("Something Custom");
  });

  it("accepts a value that matches nothing in the option list — still a plain free-text field", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Brand New Firm Nobody Has Heard Of" } });

    expect(input.value).toBe("Brand New Firm Nobody Has Heard Of");
    expect(screen.getByText("No matches — this name will be used as-is.")).toBeInTheDocument();
  });

  it("closes the panel on blur", () => {
    render(<ControlledComboBox />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.blur(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
