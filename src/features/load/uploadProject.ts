// T023: Parses an uploaded project.json File and decides where it routes to, per
// contracts/project-file.md's "Consuming a file" section (FR-002, FR-003, FR-004).
// Kept separate from LoadScreen.tsx so the parse+route decision is testable and reusable
// from Configuration's "Upload a different project JSON" action (T030) without
// duplicating logic — both entry points must make the exact same routing decision
// (FR-002/FR-003), not two independently-maintained copies of it.

import { validateAndMigrateProject } from "../../lib/project-schema";
import type { Project } from "../../types/project";

export type UploadArea = "configuration" | "dashboard";

export type UploadResult =
  | { ok: true; project: Project; area: UploadArea }
  | { ok: false; error: string };

/** Reads a File's text content. Uses FileReader rather than the newer `File.text()`
 * method — both are supported in every real target browser, but `FileReader` also works
 * in jsdom's test environment (`File.prototype.text` isn't implemented there), so
 * component tests can exercise the real upload path instead of only the pure
 * `routeUploadedProject` function. */
export async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Given the raw text content of an uploaded file, validates it (schema version + shape)
 * and decides which area to route to: Dashboard if it already has scores, Configuration
 * otherwise (FR-002, FR-003) — regardless of how much configuration is or isn't filled
 * in yet.
 */
export function routeUploadedProject(rawText: string): UploadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "This file is not valid JSON — it may be corrupted or the wrong file." };
  }

  const result = validateAndMigrateProject(parsed);
  if (!result.valid) {
    return { ok: false, error: result.error };
  }

  const area: UploadArea = result.project.scores.length > 0 ? "dashboard" : "configuration";
  return { ok: true, project: result.project, area };
}

export async function routeUploadedFile(file: File): Promise<UploadResult> {
  const text = await readFileText(file);
  return routeUploadedProject(text);
}
