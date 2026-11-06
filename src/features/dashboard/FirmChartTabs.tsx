// A firm's two charts on the Dashboard as tabs instead of one tall stack:
//   - Criterion breakdown — the radar chart (CriterionBreakdownChart)
//   - Reviewer scores     — the dot chart (ReviewerScoreSpreadChart)
// The firm's comments are NOT a tab here: they are their own section below (FirmCommentsTabs),
// so they stay in view whichever chart is open.
//
// Only the open tab's chart is rendered (not merely hidden): Recharts sizes a chart from its
// container, and a chart inside a display:none panel would measure 0 x 0. Switching tabs
// therefore redraws the chart, the same as it drawing when the row is first expanded.
//
// On-screen only. The printed/PDF report uses RankedFirmsTablePrintCopy, which lays out the
// print versions of both charts one after another — tabs can't print.

import { useState } from "react";
import { ScrollableTabs } from "../../components/ScrollableTabs";
import { scrollableTabId } from "../../components/scrollableTabId";
import type { Project } from "../../types/project";
import { CriterionBreakdownChart } from "./CriterionBreakdownChart";
import { ReviewerScoreSpreadChart } from "./ReviewerScoreSpreadChart";

type ChartTab = "breakdown" | "spread";

export function FirmChartTabs({ project, firmId }: { project: Project; firmId: string }) {
  const [active, setActive] = useState<ChartTab>("breakdown");
  const idPrefix = `firm-${firmId}-charts`;
  const panelId = `${idPrefix}-panel`;

  return (
    <div className="firm-chart-tabs">
      <ScrollableTabs
        tabs={[
          { id: "breakdown", label: "Criterion breakdown" },
          { id: "spread", label: "Reviewer scores" },
        ]}
        activeId={active}
        onSelect={(id) => setActive(id as ChartTab)}
        ariaLabel="Firm charts"
        idPrefix={idPrefix}
        panelId={panelId}
      />

      <div role="tabpanel" id={panelId} aria-labelledby={scrollableTabId(idPrefix, active)}>
        {active === "breakdown" ? (
          <CriterionBreakdownChart project={project} firmId={firmId} />
        ) : (
          <ReviewerScoreSpreadChart project={project} firmId={firmId} />
        )}
      </div>
    </div>
  );
}
