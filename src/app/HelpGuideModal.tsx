// Lightweight in-app guide — a short explanation of the app's workflow, not a full manual.
// Rendered as a modal over the existing state machine rather than a new route, matching
// research.md §6's decision against a router.

import { Modal } from "../components/Modal";
import { WORKFLOW_STEPS } from "../lib/workflowSteps";

export interface HelpGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function HelpGuideModal({ open, onClose }: HelpGuideModalProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="help-guide-title" size="sm">
      <h2 id="help-guide-title">How this app works</h2>
      <ol className="help-guide-steps">
        {WORKFLOW_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <Icon
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="help-guide-step-icon"
              />
              <span>
                <strong>{step.title}.</strong> {step.description}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="actions-row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="button button-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
