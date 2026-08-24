// Component coverage for CriteriaEditor's weight field accepting either a decimal fraction
// or a percent in the same box (see lib/weightInput.ts for the parsing rule). A
// weightInput.test.ts unit test already covers the parser itself in isolation; this drives
// the real UI to confirm the draft/commit-on-blur wiring, the live "= X%" readout, and the
// invalid-input revert actually work end-to-end, not just the pure function they call.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";
import { goToConfigStep, openGetStartedModal } from "../helpers/appNav";

function weightInput(): HTMLInputElement {
  return screen.getByLabelText(
    "Criterion weight — decimal fraction of 1.0, or a percent (e.g. 0.25 or 25%)",
  ) as HTMLInputElement;
}

function renderAtCriteria(): void {
  render(<App />);
  openGetStartedModal();
  fireEvent.click(screen.getByRole("button", { name: "Start a new project" }));
  goToConfigStep("Criteria");
  fireEvent.click(screen.getByRole("button", { name: "Add criterion" }));
}

describe("CriteriaEditor — weight field accepts decimal or percent", () => {
  it("typing a bare percent number (no sign) commits as a decimal fraction on blur", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0.6");
    expect(screen.getByText("= 60%")).toBeInTheDocument();
  });

  it("typing an explicit percent sign commits the same way", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "60%" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0.6");
    expect(screen.getByText("= 60%")).toBeInTheDocument();
  });

  it("typing a plain decimal fraction is taken literally, not reinterpreted as a percent", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "0.25" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0.25");
    expect(screen.getByText("= 25%")).toBeInTheDocument();
  });

  it("a bare '1' is taken as 1.0 (100%) — the single-criterion case, not 1%", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(input.value).toBe("1");
    expect(screen.getByText("= 100%")).toBeInTheDocument();
  });

  it("the '= X%' readout updates live while typing, before blur commits anything", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "40%" } });
    // Not blurred yet — the underlying criterion.weight (and hence input.value on next
    // render if it reverted to canonical) hasn't changed, but the preview readout should
    // already reflect what blur WOULD commit.
    expect(screen.getByText("= 40%")).toBeInTheDocument();
  });

  it("invalid text reverts to the last-committed value on blur instead of being stored", () => {
    renderAtCriteria();
    const input = weightInput();
    // Commit a known-good value first.
    fireEvent.change(input, { target: { value: "50%" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0.5");

    // Now type garbage and blur — must revert, not silently store NaN/0.
    fireEvent.change(input, { target: { value: "not a number" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0.5");
    expect(screen.getByText("= 50%")).toBeInTheDocument();
  });

  it("the running-total banner shows both the decimal and its percent equivalent", () => {
    renderAtCriteria();
    const input = weightInput();
    fireEvent.change(input, { target: { value: "100%" } });
    fireEvent.blur(input);
    expect(screen.getByText(/Running total:/)).toBeInTheDocument();
    expect(screen.getByText("1.000")).toBeInTheDocument();
    expect(screen.getByText(/\(100%\)/)).toBeInTheDocument();
  });
});
