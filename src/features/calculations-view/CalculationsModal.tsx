// T042 (redesigned): "Show calculations" is now a modal, not an inline page expansion —
// the old CalculationsView.tsx's single wide per-reviewer table was the actual cause of
// the Dashboard's horizontal overflow with more than a handful of reviewers. Three tabs:
//
// - Heatmap (default): CalculationsHeatmap.tsx — one firm at a time, criteria x reviewers,
//   colored by raw score. Fast to scan, but not the only view of the numbers.
// - Full Table: CalculationsFullTable.tsx — the original detailed audit table, unchanged
//   in content, now properly contained (scrollable, sticky header) instead of overflowing
//   the page. Keeps constitution Principle VI's "nothing hidden" guarantee intact — the
//   heatmap is additive, not a replacement for the raw numbers.
// - Manual Entry: ManualEntryGrid.tsx, relocated here from its old spot at the bottom of
//   CalculationsView — same component, same UPSERT_SCORES commit path, just a tab instead
//   of always-rendered content.
//
// The active view renders inside a role="tabpanel" wrapper — tests scope into it via
// getByRole("tabpanel") rather than a second aria-label, since the modal's own
// aria-labelledby already gives the dialog itself the accessible name "Calculations" (from
// its <h2>) and a second element with the same name would collide.

import { useState } from "react";
import { Modal } from "../../components/Modal";
import type { Project } from "../../types/project";
import { CalculationsFullTable } from "./CalculationsFullTable";
import { CalculationsHeatmap } from "./CalculationsHeatmap";
import { ExportCalculationsButton } from "./ExportCalculationsButton";
import { ManualEntryGrid } from "../reviewer-forms/ManualEntryGrid";

type CalculationsTab = "heatmap" | "table" | "manual";

const TABS: { id: CalculationsTab; label: string }[] = [
  { id: "heatmap", label: "Heatmap" },
  { id: "table", label: "Full Table" },
  { id: "manual", label: "Manual Entry" },
];

export interface CalculationsModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export function CalculationsModal({ open, onClose, project }: CalculationsModalProps) {
  const [tab, setTab] = useState<CalculationsTab>("heatmap");

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="calculations-modal-title" size="xl">
      <div className="calc-modal-header">
        <h2 id="calculations-modal-title">Calculations</h2>
        <ExportCalculationsButton project={project} />
      </div>
      <p className="field-hint">
        Every number here is computed live from the raw scores — nothing is a separately stored
        summary.
      </p>

      <div role="tablist" aria-label="Calculations view" className="calc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`calc-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="calc-tabpanel">
        {tab === "heatmap" && <CalculationsHeatmap project={project} />}
        {tab === "table" && <CalculationsFullTable project={project} />}
        {tab === "manual" && <ManualEntryGrid />}
      </div>
    </Modal>
  );
}
