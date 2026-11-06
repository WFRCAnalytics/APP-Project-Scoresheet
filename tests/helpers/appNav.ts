// Shared navigation helpers for component tests, introduced by the app-shell/Load/
// Configuration restructure. Centralizing these means every test file that drives the real
// UI shares one place to fix if the Get Started button or step labels ever change, instead
// of N independent copies of the same two clicks.

import { fireEvent, screen, within } from "@testing-library/react";

/** Opens the Load screen's "Get Started" modal, exposing the "Start a new project" /
 * "Upload a project file" actions that used to be directly on the page. */
export function openGetStartedModal(): void {
  fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
}

/** Jumps directly to a Configuration step via its progress-bar button — the same
 * non-gating navigation a real user has (every step is independently clickable at any
 * time; this is not simulating a restricted/gated flow). */
export function goToConfigStep(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

/** Reshapes the Scale step's rows to exactly `values`, via the real UI. A new project starts
 * with the 1/3/5 defaults (DEFAULT_SCORING_SCALE), so tests about the editor's own mechanics
 * (identity, precision, floor) call this to start from a known layout instead of assuming an
 * empty scale. Requires at least 2 values (the editor's floor). */
export function setScaleValues(values: number[]): void {
  const click = (name: string, index = -1) => {
    const buttons = screen.getAllByRole("button", { name });
    fireEvent.click(buttons.at(index) as HTMLElement);
  };
  while (screen.getAllByLabelText("Scale point value").length > values.length) click("Remove");
  while (screen.getAllByLabelText("Scale point value").length < values.length) {
    click("Add scale point");
  }
  values.forEach((value, i) => {
    const input = screen.getAllByLabelText("Scale point value")[i] as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(value) } });
    fireEvent.blur(input);
  });
}

/** What the Dashboard's ranked-firms list shows for one firm: the option itself plus the rank
 * badge and the three weighted totals as displayed text. */
export function rankedFirm(name: string) {
  const list = screen.getByRole("listbox", { name: "Ranked firms" });
  const option = within(list)
    .getAllByRole("option")
    .find((o) => o.querySelector(".dash-ranked-firm")?.textContent === name);
  if (!option) throw new Error(`No ranked-firms option for "${name}"`);
  const totals = Array.from(option.querySelectorAll(".dash-ranked-num")).map((n) => n.textContent);
  return {
    option,
    rank: option.querySelector(".badge")?.textContent,
    overall: totals[0],
    applicant: totals[1],
    wfrc: totals[2],
    completion: option.querySelector(".dash-ranked-progress")?.textContent,
  };
}

/** Every option of the Dashboard's ranked-firms list, in the order shown. */
export function rankedFirmNames(): (string | null | undefined)[] {
  return within(screen.getByRole("listbox", { name: "Ranked firms" }))
    .getAllByRole("option")
    .map((o) => o.querySelector(".dash-ranked-firm")?.textContent);
}
