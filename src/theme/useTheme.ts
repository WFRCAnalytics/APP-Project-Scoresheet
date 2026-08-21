// Light/dark theme preference — a UI display preference, NOT project data, so it sits
// outside constitution Principle II entirely: Principle II governs the Project object (the
// procurement record, whose only source of truth is explicit project.json export/import).
// This has no relationship to that object and isn't the sessionRecovery.ts "recover unsaved
// work" convenience either (that one is sessionStorage, single-slot, and documents its own
// scope in its own module header) — localStorage is appropriate here specifically because
// neither constraint applies to a display preference.
//
// Default: follow the OS's prefers-color-scheme, live (a system theme change mid-session is
// picked up immediately if the user never overrode it). First manual toggle sets an explicit
// override that persists across sessions until toggled again.

import { useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "consultant-selection-scoring:theme-preference:v1";

function readStoredPreference(): ThemePreference | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

export function useTheme(): { theme: ThemePreference; toggleTheme: () => void } {
  const [override, setOverride] = useState<ThemePreference | null>(() => readStoredPreference());
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const theme: ThemePreference = override ?? (systemPrefersDark ? "dark" : "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggleTheme() {
    const next: ThemePreference = theme === "dark" ? "light" : "dark";
    setOverride(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence, same spirit as sessionRecovery.ts's own silent-failure
      // rule — a failed write just means the preference resets next session, never a
      // crashed or broken toggle for the current one.
    }
  }

  return { theme, toggleTheme };
}
