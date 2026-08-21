// T021 (Phase 2) + T022/T030 (Phase 3) + T031-T044 (Phase 4/5): top-level area-switch
// state machine — Load -> Configuration -> Reviewer Forms -> Dashboard. No router
// library (research.md §6). The Calculations view (FR-031) is intentionally NOT a
// separate top-level area — it's an inline toggle inside DashboardScreen, which matches
// the spec's own "hidden by default behind a toggle... reachable in one click" wording
// more directly than a fifth navigable area would.

import { useEffect, useState } from "react";
import { ConfigurationScreen } from "./features/configuration/ConfigurationScreen";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { LoadScreen } from "./features/load/LoadScreen";
import type { UploadArea } from "./features/load/uploadProject";
import { ReviewerFormsScreen } from "./features/reviewer-forms/ReviewerFormsScreen";
import { ProjectProvider, useProjectContext } from "./state/ProjectContext";
import { loadBrandFonts } from "./theme/fonts";
import type { Project } from "./types/project";

export type Area = "load" | "configuration" | "reviewer-forms" | "dashboard";

function AppShell() {
  const [area, setArea] = useState<Area>("load");
  const { dispatch } = useProjectContext();

  function loadProjectAndNavigate(project: Project, target: Area) {
    dispatch({ type: "SET_PROJECT", project });
    setArea(target);
  }

  function handleUploadRouting(project: Project, uploadArea: UploadArea) {
    loadProjectAndNavigate(project, uploadArea === "dashboard" ? "dashboard" : "configuration");
  }

  switch (area) {
    case "load":
      return (
        <LoadScreen
          onStartNew={(project) => loadProjectAndNavigate(project, "configuration")}
          onProjectLoaded={handleUploadRouting}
        />
      );
    case "configuration":
      return (
        <ConfigurationScreen
          onProjectReplaced={handleUploadRouting}
          onGenerateForms={() => setArea("reviewer-forms")}
        />
      );
    case "reviewer-forms":
      return (
        <ReviewerFormsScreen
          onBackToConfiguration={() => setArea("configuration")}
          onGoToDashboard={() => setArea("dashboard")}
        />
      );
    case "dashboard":
      return <DashboardScreen onEditProject={() => setArea("configuration")} />;
  }
}

export default function App() {
  useEffect(() => {
    loadBrandFonts();
  }, []);

  return (
    <div className="app-shell">
      <ProjectProvider>
        <AppShell />
      </ProjectProvider>
    </div>
  );
}
