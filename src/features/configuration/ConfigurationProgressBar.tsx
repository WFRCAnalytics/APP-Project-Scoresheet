// Non-gating step indicator for Configuration. Every step stays independently clickable at
// all times — this is a progress/orientation aid on top of free navigation, not a
// replacement for it (FR-013, constitution Principle V — Flexibility). "Visited" only means
// "has been viewed this session," not "validated complete": an empty firms list, for
// instance, is a valid resting state, so visiting a step is never blocked or judged here.

import { Check } from "lucide-react";

export interface ConfigStep {
  id: string;
  label: string;
}

export interface ConfigurationProgressBarProps {
  steps: ConfigStep[];
  currentStep: string;
  visitedSteps: Set<string>;
  onStepClick: (id: string) => void;
}

export function ConfigurationProgressBar({
  steps,
  currentStep,
  visitedSteps,
  onStepClick,
}: ConfigurationProgressBarProps) {
  return (
    <ol className="config-progress" aria-label="Configuration steps">
      {steps.map((step, index) => {
        const isCurrent = step.id === currentStep;
        const isVisited = visitedSteps.has(step.id);
        return (
          <li key={step.id} className="config-progress-item">
            <button
              type="button"
              className={`config-progress-step${isCurrent ? " is-current" : ""}${isVisited ? " is-visited" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onStepClick(step.id)}
            >
              <span className="config-progress-dot" aria-hidden="true">
                {isVisited && !isCurrent ? <Check size={14} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="config-progress-label">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
