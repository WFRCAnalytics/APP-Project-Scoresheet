// Shared navigation helpers for component tests, introduced by the app-shell/Load/
// Configuration restructure. Centralizing these means every test file that drives the real
// UI shares one place to fix if the Get Started button or step labels ever change, instead
// of N independent copies of the same two clicks.

import { fireEvent, screen } from "@testing-library/react";

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
