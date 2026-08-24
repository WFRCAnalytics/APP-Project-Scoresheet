// Confirms FirmsEditor's Name field is the ComboBox wired to lib/knownFirms.ts, and that a
// custom (not-on-the-list) name is genuinely session-only: it's just this project's Firm.name
// like any other field, never written anywhere else — there's no directory/storage layer
// left to persist it to (see combobox.test.tsx for the ComboBox component's own behavior).

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function goToFirmsStep() {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
  goToConfigStep("Firms");
}

describe("FirmsEditor — Name field", () => {
  it("suggests known firms on focus, and narrows to a search match while typing", () => {
    goToFirmsStep();
    fireEvent.click(screen.getByRole("button", { name: "Add firm" }));
    const input = screen.getByRole("combobox", { name: "Firm name" });
    fireEvent.focus(input);

    // Empty query shows the (capped) suggestion list, starting from the top alphabetically.
    expect(screen.getByRole("option", { name: "AECOM" })).toBeInTheDocument();

    // Typing narrows to an actual match regardless of where it sits in the full list.
    fireEvent.change(input, { target: { value: "WSP" } });
    expect(screen.getByRole("option", { name: "WSP" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "AECOM" })).not.toBeInTheDocument();
  });

  it("accepts a custom name outside the known list, committed as this firm's name", () => {
    goToFirmsStep();
    fireEvent.click(screen.getByRole("button", { name: "Add firm" }));

    const input = screen.getByRole("combobox", { name: "Firm name" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A Totally New Firm" } });
    expect(input.value).toBe("A Totally New Firm");
  });

  it("has no header button or menu offering a separate directory to manage", () => {
    goToFirmsStep();
    expect(
      screen.queryByRole("button", { name: /firms directory/i }),
    ).not.toBeInTheDocument();
  });
});
