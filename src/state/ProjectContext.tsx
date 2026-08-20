// T014: React Context + useReducer over the in-memory Project — the single source of
// truth every feature reads from and writes to while the app is running (constitution
// Principle III: one project at a time). Persistence is explicit export/import only
// (constitution Principle II); this context never talks to a server.

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { Project } from "../types/project";
import { projectReducer, type ProjectAction, type ProjectState } from "./projectReducer";

interface ProjectContextValue {
  project: ProjectState;
  dispatch: Dispatch<ProjectAction>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, dispatch] = useReducer(projectReducer, null);
  return <ProjectContext.Provider value={{ project, dispatch }}>{children}</ProjectContext.Provider>;
}

/** Access the current project and dispatch — throws if used outside `<ProjectProvider>`
 * (a programming error, not a runtime "no project loaded" state, which is represented by
 * `project` being `null`). */
export function useProjectContext(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error("useProjectContext must be used within a <ProjectProvider>");
  }
  return value;
}

/** Convenience hook for the common "no project loaded" guard — narrows `project` to
 * non-null for the caller. */
export function useLoadedProject(): { project: Project; dispatch: Dispatch<ProjectAction> } {
  const { project, dispatch } = useProjectContext();
  if (!project) {
    throw new Error("useLoadedProject called with no project loaded — guard with `project` first.");
  }
  return { project, dispatch };
}
