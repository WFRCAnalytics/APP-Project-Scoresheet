// T021: Top-level area-switch state machine — Load -> Configuration -> Reviewer Forms ->
// Calculations view -> Dashboard. No router library (research.md §6): none of the app's
// user stories need deep-linkable URLs or browser back/forward semantics, and a router
// would add GitHub Pages sub-path/base-path routing complexity for no corresponding
// requirement. Switching areas is just a state value here.
//
// This file is Phase 2 (Foundational) scaffolding only. The five areas below are
// placeholders — their real implementations are Phase 3+ (T022 onward), deliberately not
// built in this pass so the foundational code (this file, ProjectContext, calculations,
// schema validation, theme) can be reviewed before anything is built on top of it.

import { useEffect, useState } from "react";
import { ProjectProvider, useProjectContext } from "./state/ProjectContext";
import { loadBrandFonts } from "./theme/fonts";

export type Area = "load" | "configuration" | "reviewer-forms" | "calculations" | "dashboard";

function AreaPlaceholder({ area }: { area: Area }) {
  const { project } = useProjectContext();
  const labels: Record<Area, string> = {
    load: "Load",
    configuration: "Configuration",
    "reviewer-forms": "Reviewer Forms",
    calculations: "Calculations",
    dashboard: "Dashboard",
  };
  return (
    <section aria-label={`${labels[area]} area (placeholder)`}>
      <h1>{labels[area]}</h1>
      <p>
        This area is not implemented yet — it will be built in a later phase. Foundational
        state is wired up: a project is {project ? "currently loaded" : "not currently loaded"}.
      </p>
    </section>
  );
}

function AppShell() {
  const [area] = useState<Area>("load");
  return (
    <div className="app-shell">
      <AreaPlaceholder area={area} />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    loadBrandFonts();
  }, []);

  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  );
}
