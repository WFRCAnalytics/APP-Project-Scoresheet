// The app's 5-step workflow (Configure -> Generate Forms -> Collect -> Import -> Results),
// shared between the Load screen's on-page preview strip and the Help guide modal so the
// two never drift into describing a different process.

import { BarChart3, FileSpreadsheet, Mail, Settings2, Upload, type LucideIcon } from "lucide-react";

export interface WorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: "Configure",
    description: "Set up project info, firms, reviewers, criteria, and the scoring scale.",
    icon: Settings2,
  },
  {
    title: "Generate Forms",
    description: "Download an Excel scoring workbook for each reviewer.",
    icon: FileSpreadsheet,
  },
  {
    title: "Collect",
    description: "Reviewers fill out their workbook and send it back.",
    icon: Mail,
  },
  {
    title: "Import",
    description: "Upload the returned workbooks — one at a time or all at once.",
    icon: Upload,
  },
  {
    title: "Results",
    description: "View evaluation results and charts, then export the final PDF report.",
    icon: BarChart3,
  },
];
