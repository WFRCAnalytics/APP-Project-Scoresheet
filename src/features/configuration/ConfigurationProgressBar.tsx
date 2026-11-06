// Non-gating step list for Configuration, shown as a rail down the left of the screen. Every
// step stays independently clickable at all times — this is a progress/orientation aid on top
// of free navigation, not a replacement for it (FR-013, constitution Principle V —
// Flexibility). Each step reports where it stands from the project's own data:
//   - done: set up (green check, the same indicator the old step bar used for visited steps)
//   - attention: set up but something needs a look (an unsigned reviewer, weights not totalling
//     100%) — nothing here blocks anything, it only points
//   - todo: not started yet (the step's number)
// The step button's accessible name stays the bare step label; its summary line is its
// description, so the name never changes as the project is filled in.

import { Check, TriangleAlert } from "lucide-react";

export type ConfigStepState = "done" | "attention" | "todo";

export interface ConfigStep {
  id: string;
  label: string;
  /** One short line under the label ("7 firms, 3 submitted"). */
  summary: string;
  state: ConfigStepState;
}

export interface ConfigurationProgressBarProps {
  steps: ConfigStep[];
  currentStep: string;
  onStepClick: (id: string) => void;
}

export function ConfigurationProgressBar({
  steps,
  currentStep,
  onStepClick,
}: ConfigurationProgressBarProps) {
  const doneCount = steps.filter((s) => s.state === "done").length;
  const attentionCount = steps.filter((s) => s.state === "attention").length;
  return (
    <nav className="config-rail" aria-label="Configuration steps">
      <div className="config-rail-head">
        <p className="config-rail-status">
          {doneCount} of {steps.length} steps complete
          {attentionCount > 0 ? `, ${attentionCount} needs attention` : ""}
        </p>
        <div className="config-rail-meter" aria-hidden="true">
          <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="config-rail-steps">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const summaryId = `config-step-${step.id}-summary`;
          return (
            <li key={step.id}>
              <button
                type="button"
                className={`config-rail-step is-${step.state}${isCurrent ? " is-current" : ""}`}
                aria-label={step.label}
                aria-describedby={summaryId}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStepClick(step.id)}
              >
                <span className="config-rail-mark" aria-hidden="true">
                  {step.state === "done" ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : step.state === "attention" ? (
                    <TriangleAlert size={14} strokeWidth={2.25} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="config-rail-text">
                  <span className="config-rail-label">{step.label}</span>
                  <small id={summaryId} className="config-rail-summary">
                    {step.summary}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
