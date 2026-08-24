// T022: The Load screen — the sole entry point every session (constitution Principle III:
// one project at a time). Its two entry actions (FR-001) live inside GetStartedModal,
// opened from a single hero CTA here.
//
// Terminology pass: product framing moved from "Consultant Selection Scoring" / "rank
// consulting firms" to "Project Evaluation Scoresheet" throughout user-facing copy — the
// header (AppHeader.tsx) already says this; the browser tab title (index.html), PDF report
// title (printLayout.ts), and Excel workbook metadata (generateWorkbook.ts) were updated to
// match. The Dashboard's "Rank"/"Ranked Firms" labels are deliberately UNCHANGED — they're
// literally correct (a computed 1st/2nd/3rd position), so only the app's overall framing
// language changed, not every occurrence of the word.
//
// Second terminology pass: "Project Evaluation Scoresheet" renamed to "Proposal Evaluation
// Scoresheet" — the app scores each firm's proposal, not the underlying capital project (the
// project is what the RFP is for; "projectName" the data field is unaffected) or the firm
// itself. Same scope as before: the branding string everywhere it appears, plus this screen's
// hero copy below. "Rank"/"Ranked Firms" still stands — ranking the firms by their proposal
// scores is accurate language, not part of what was wrong.
//
// Also fills out what was a near-empty page: a workflow preview strip (same 5 steps as
// HelpGuideModal, shared via lib/workflowSteps.ts so the two can't drift) and three
// value-prop cards restating real constitution principles in plain language, not invented
// marketing copy.

import { Eye, FileCheck2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { WORKFLOW_STEPS } from "../../lib/workflowSteps";
import type { Project } from "../../types/project";
import { GetStartedModal } from "./GetStartedModal";
import type { UploadArea } from "./uploadProject";

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Nothing Leaves Your Browser",
    description: "No accounts, no servers — your scores and comments stay on this device.",
  },
  {
    icon: FileCheck2,
    title: "No Installs for Reviewers",
    description: "Reviewers just need Excel (or Sheets) — no knowledge of this app required.",
  },
  {
    icon: Eye,
    title: "Every Number Traces Back",
    description: "Every computed total is auditable down to the raw score that produced it.",
  },
];

export interface LoadScreenProps {
  onStartNew: (project: Project) => void;
  onProjectLoaded: (project: Project, area: UploadArea) => void;
}

export function LoadScreen({ onStartNew, onProjectLoaded }: LoadScreenProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section aria-label="Load">
      <div className="load-hero">
        <h1>Evaluate and Score Proposals</h1>
        <p className="page-subtitle">
          A proposal evaluation scoresheet for scoring and comparing the proposals consulting
          firms submitted in response to your RFP.
        </p>
        <button
          type="button"
          className="button button-primary button-lg"
          onClick={() => setModalOpen(true)}
        >
          Get Started
        </button>
      </div>

      <ol className="workflow-preview" aria-label="How this app works">
        {WORKFLOW_STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="workflow-step">
              <span className="workflow-step-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <span className="workflow-step-title">
                {index + 1}. {step.title}
              </span>
              <span className="workflow-step-description">{step.description}</span>
            </li>
          );
        })}
      </ol>

      <div className="value-props">
        {VALUE_PROPS.map((prop) => {
          const Icon = prop.icon;
          return (
            <div key={prop.title} className="card value-prop-card">
              <Icon className="card-icon" size={26} strokeWidth={1.75} aria-hidden="true" />
              <h3>{prop.title}</h3>
              <p className="field-hint">{prop.description}</p>
            </div>
          );
        })}
      </div>

      <p className="load-footer">Built for the Wasatch Front Regional Council.</p>

      <GetStartedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onStartNew={onStartNew}
        onProjectLoaded={onProjectLoaded}
      />
    </section>
  );
}
