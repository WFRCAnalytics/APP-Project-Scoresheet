// The formatted PDF report, laid out with react-pdf. It only lays out: every figure comes
// pre-computed from reportModel.ts, and every chart arrives as ready-made vector content
// (svgToPdf.tsx), so nothing here calculates or measures anything.
//
// Structure: cover -> results overview (ranking table + chart) -> evaluation framework (criteria,
// scale, reviewers, method) -> one profile per firm in rank order (radar, criterion table, reviewer
// heatmap, every comment) -> data notes when there is anything to flag. The wording throughout is
// deliberately neutral: the report supports the committee's deliberation, it doesn't pick a firm.

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import { round2 } from "../calculations";
import { weightedTotalRange } from "../scoreScale";
import { heatmapBackgroundFor, heatmapTextColorFor } from "../../theme/heatmapColor";
import type { Project } from "../../types/project";
import { BAR_CHART_RANK_LABELS_AFTER } from "./captureCharts";
import { REVIEWER_TYPE_LABEL } from "./reportModel";
import type { FirmReport, ReportModel } from "./reportModel";
import { COLORS, FONTS, METRIC_COLORS } from "./reportTheme";

export interface ReportCharts {
  bar: ReactElement | null;
  /** Radar chart per firm id. */
  radars: Record<string, ReactElement | null>;
}

export interface ReportDocumentProps {
  model: ReportModel;
  project: Project;
  charts: ReportCharts;
  /** Absolute URL of the white WFRC logo shown on the cover. */
  logoUrl: string;
}

const DISCLAIMER =
  "This report summarizes reviewer scores to support the selection committee's discussion. " +
  "Scores and rankings are decision-support information only; they are not a selection decision.";

const s = StyleSheet.create({
  page: {
    paddingTop: 58,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  coverPage: { fontFamily: FONTS.body, fontSize: 9.5, color: COLORS.text, lineHeight: 1.4 },
  runningHeader: {
    position: "absolute",
    top: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
    fontSize: 7.5,
    color: COLORS.gray,
  },
  runningFooter: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.gray,
  },
  h1: { fontFamily: FONTS.heading, fontWeight: 700, fontSize: 20, lineHeight: 1.25, color: COLORS.navy },
  h2: { fontFamily: FONTS.heading, fontWeight: 700, fontSize: 13, lineHeight: 1.3, color: COLORS.navy },
  h3: { fontFamily: FONTS.heading, fontWeight: 600, fontSize: 10.5, lineHeight: 1.3, color: COLORS.navy },
  muted: { color: COLORS.gray },
  small: { fontSize: 8 },
  bold: { fontWeight: 600 },
  accentRule: { width: 34, height: 3, backgroundColor: COLORS.yellow, marginTop: 4, marginBottom: 12 },
  card: {
    borderWidth: 0.75,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
  },
  note: {
    backgroundColor: COLORS.panel,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.navy,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  warn: {
    backgroundColor: COLORS.amberBackground,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amberBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: {
    fontFamily: FONTS.heading,
    fontWeight: 600,
    fontSize: 7.5,
    color: COLORS.navy,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 5,
  },
  trHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1.25,
    borderBottomColor: COLORS.navy,
    paddingBottom: 4,
  },
  num: { textAlign: "right", fontVariant: "tabular-nums" },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    fontFamily: FONTS.heading,
    fontWeight: 700,
    fontSize: 9,
    textAlign: "center",
    paddingTop: 5.2,
  },
});

/** Scores and totals are always shown to two decimals so columns line up (4.30, not 4.3). */
const n2 = (value: number): string => value.toFixed(2);
/** A group total, or a dash when that group has not scored the firm at all (not a real zero). */
const groupTotal = (value: number, has: boolean): string => (has ? n2(value) : "—");
const fmt = (value: number | null): string => (value === null ? "—" : n2(value));

function SectionTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View>
      <Text style={s.h1}>{title}</Text>
      <View style={s.accentRule} />
      {children}
    </View>
  );
}

function Running({ model }: { model: ReportModel }) {
  return (
    <>
      <View style={s.runningHeader} fixed>
        <Text>{model.projectName}</Text>
        <Text>Proposal Evaluation Report</Text>
      </View>
      <View style={s.runningFooter} fixed>
        <Text>Decision-support analysis. Not a selection decision.</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

/** A horizontal bar showing `value` within the scale's [min, max]. */
function ScoreBar({ value, min, max, color, width = 70 }: { value: number | null; min: number; max: number; color: string; width?: number }) {
  const pct = value === null || max <= min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View style={{ width, height: 5, backgroundColor: COLORS.panel, borderRadius: 2.5 }}>
      <View style={{ width: width * pct, height: 5, backgroundColor: color, borderRadius: 2.5 }} />
    </View>
  );
}

function Legend() {
  const items = [
    ["Overall", METRIC_COLORS.overall],
    ["TLC Applicant", METRIC_COLORS.applicant],
    ["WFRC", METRIC_COLORS.wfrc],
  ] as const;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 4 }}>
      {items.map(([label, color]) => (
        <View key={label} style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 8 }}>
          <View style={{ width: 8, height: 8, backgroundColor: color, borderRadius: 1.5, marginRight: 4 }} />
          <Text style={[s.small, s.muted]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------- cover

function Cover({ model, logoUrl }: { model: ReportModel; logoUrl: string }) {
  const meta: [string, string][] = [
    ["Local government contact", model.info.localGovContact || "Not recorded"],
    ["Procurement agent", model.info.procurementAgent || "Not recorded"],
    ["Selection committee meeting", model.meetingDate || "Not scheduled"],
    ["Report generated", model.generatedOn],
  ];
  const stats: [string, string][] = [
    [String(model.firms.length), model.firms.length === 1 ? "firm evaluated" : "firms evaluated"],
    [String(model.reviewers.length), model.reviewers.length === 1 ? "reviewer" : "reviewers"],
    [String(model.criteria.length), model.criteria.length === 1 ? "criterion" : "criteria"],
    [`${model.scored} of ${model.expected}`, "scores recorded"],
  ];
  const contents: [string, string][] = [
    ["Results overview", "Ranking of every evaluated firm, with weighted totals compared"],
    ["Evaluation framework", "Criteria and weights, scoring scale, reviewers and method"],
    ["Firm profiles", "One profile per firm in rank order: criterion breakdown, reviewer scores and comments"],
  ];
  if (model.notSubmitted.length > 0 || model.unsignedReviewers.length > 0 || model.isPartial) {
    contents.push(["Data notes", "Items to be aware of when reading these results"]);
  }

  return (
    <Page size="LETTER" style={s.coverPage} bookmark="Cover">
      <View style={{ backgroundColor: COLORS.navy, paddingHorizontal: 44, paddingTop: 40, paddingBottom: 46 }}>
        <Image src={logoUrl} style={{ width: 150 }} />
        <Text style={{ fontFamily: FONTS.heading, fontWeight: 600, fontSize: 11, lineHeight: 1.3, color: COLORS.skyBlue, marginTop: 52 }}>
          Proposal Evaluation Report
        </Text>
        <Text style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 28, color: COLORS.white, marginTop: 6, lineHeight: 1.2 }}>
          {model.projectName}
        </Text>
        <View style={{ width: 44, height: 4, backgroundColor: COLORS.yellow, marginTop: 16 }} />
      </View>

      <View style={{ paddingHorizontal: 44, paddingTop: 28 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {meta.map(([label, value]) => (
            <View key={label} style={{ width: "50%", marginBottom: 12, paddingRight: 12 }}>
              <Text style={[s.small, s.muted]}>{label}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: 500 }}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          {stats.map(([value, label], i) => (
            <View
              key={label}
              style={{
                flex: 1,
                marginLeft: i === 0 ? 0 : 8,
                backgroundColor: COLORS.panel,
                borderTopWidth: 3,
                borderTopColor: COLORS.navy,
                paddingVertical: 10,
                paddingHorizontal: 10,
              }}
            >
              <Text style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: COLORS.navy }}>{value}</Text>
              <Text style={[s.small, s.muted]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.note, { marginTop: 22 }]}>
          <Text style={[s.h3, { marginBottom: 3 }]}>How to read this report</Text>
          <Text>{DISCLAIMER}</Text>
        </View>

        {model.isPartial && (
          <View style={[s.warn, { marginTop: 8 }]}>
            <Text>
              <Text style={s.bold}>Partial results. </Text>
              {model.scored} of {model.expected} expected scores have been recorded. Totals and rankings may change as
              the remaining scores arrive.
            </Text>
          </View>
        )}
        {model.unsignedReviewers.length > 0 && (
          <View style={[s.warn, { marginTop: 8 }]}>
            <Text>
              <Text style={s.bold}>Confidentiality not confirmed. </Text>
              {model.unsignedReviewers.map((r) => r.name).join(", ")}{" "}
              {model.unsignedReviewers.length === 1 ? "has" : "have"} not signed the confidentiality form.
            </Text>
          </View>
        )}

        <Text style={[s.h2, { marginTop: 26, marginBottom: 6 }]}>In this report</Text>
        {contents.map(([title, text]) => (
          <View key={title} style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
            <Text style={{ width: 130, fontWeight: 600, color: COLORS.navy }}>{title}</Text>
            <Text style={[s.muted, { flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------------------------ overview

function Overview({ model, project, chart }: { model: ReportModel; project: Project; chart: ReactElement | null }) {
  const { min, max } = weightedTotalRange(project);
  const top = model.firms[0];
  const second = model.firms[1];
  const differing = model.firms.filter((f) => f.hasApplicant && f.hasWfrc && f.applicantRank !== f.wfrcRank);

  return (
    <Page size="LETTER" style={s.page} bookmark="Results overview">
      <Running model={model} />
      <SectionTitle title="Results overview" />
      <Text style={{ marginBottom: 12 }}>
        Firms ranked by overall weighted score, which counts every reviewer. The TLC Applicant and WFRC columns count
        only that group's reviewers. Scores run from {round2(min)} to {round2(max)}.
      </Text>

      <View style={s.trHead}>
        <Text style={[s.th, { width: 34 }]}>Rank</Text>
        <Text style={[s.th, { flex: 1 }]}>Firm</Text>
        <Text style={[s.th, { width: 120 }]}>Overall</Text>
        <Text style={[s.th, s.num, { width: 62 }]}>TLC Applicant</Text>
        <Text style={[s.th, s.num, { width: 44 }]}>WFRC</Text>
        <Text style={[s.th, s.num, { width: 56 }]}>Scores in</Text>
      </View>
      {model.firms.map((firm) => (
        <View key={firm.firm.id} style={s.tr} wrap={false}>
          <View style={{ width: 34 }}>
            <Text style={s.rankBadge}>{firm.rank}</Text>
          </View>
          <Text style={{ flex: 1, fontWeight: 600, paddingRight: 8 }}>{firm.firm.name}</Text>
          <View style={{ width: 120, flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.num, { width: 30, fontWeight: 600 }]}>{n2(firm.overall)}</Text>
            <View style={{ marginLeft: 8 }}>
              <ScoreBar value={firm.overall} min={min} max={max} color={METRIC_COLORS.overall} width={72} />
            </View>
          </View>
          <Text style={[s.num, { width: 62 }]}>{groupTotal(firm.applicant, firm.hasApplicant)}</Text>
          <Text style={[s.num, { width: 44 }]}>{groupTotal(firm.wfrc, firm.hasWfrc)}</Text>
          <Text style={[s.num, s.muted, { width: 56 }]}>
            {firm.scored}/{firm.expected}
          </Text>
        </View>
      ))}

      {chart && (
        <View style={{ marginTop: 20 }} wrap={false}>
          <Text style={[s.h3, { marginBottom: 6 }]}>Weighted totals by firm</Text>
          {chart}
          <Legend />
          {model.firms.length > BAR_CHART_RANK_LABELS_AFTER && (
            <Text style={[s.small, s.muted, { textAlign: "center", marginTop: 3 }]}>
              Numbers under the bars are the firms' ranks in the table above.
            </Text>
          )}
        </View>
      )}

      <View style={[s.note, { marginTop: 14 }]} wrap={false}>
        <Text style={[s.h3, { marginBottom: 3 }]}>Reading these results</Text>
        {top && second && (
          <Text style={{ marginBottom: 2 }}>
            The two highest overall totals ({top.firm.name} at {n2(top.overall)} and {second.firm.name} at{" "}
            {n2(second.overall)}) differ by {n2(Math.abs(top.overall - second.overall))} points.
          </Text>
        )}
        {differing.length > 0 && (
          <Text style={{ marginBottom: 2 }}>
            TLC Applicant and WFRC reviewers rank {differing.length === 1 ? "this firm" : "these firms"} differently:{" "}
            {differing.map((f) => f.firm.name).join(", ")}.
          </Text>
        )}
        <Text>{DISCLAIMER}</Text>
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------------------------ framework

function Framework({ model }: { model: ReportModel }) {
  const signedLabel = (value: boolean | null) =>
    value === true ? "Signed" : value === false ? "Not signed" : "Not recorded";
  return (
    <Page size="LETTER" style={s.page} bookmark="Evaluation framework">
      <Running model={model} />
      <SectionTitle title="Evaluation framework" />

      <Text style={[s.h2, { marginBottom: 6 }]}>Criteria and weights</Text>
      <View style={s.trHead}>
        <Text style={[s.th, { width: 130 }]}>Criterion</Text>
        <Text style={[s.th, { width: 92 }]}>Weight</Text>
        <Text style={[s.th, { flex: 1 }]}>What reviewers assess</Text>
      </View>
      {model.criteria.map((c) => (
        <View key={c.id} style={[s.tr, { alignItems: "flex-start" }]} wrap={false}>
          <Text style={{ width: 130, fontWeight: 600, paddingRight: 8 }}>{c.name}</Text>
          <View style={{ width: 92, flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.num, { width: 30 }]}>{round2(c.weight * 100)}%</Text>
            <View style={{ marginLeft: 6 }}>
              <ScoreBar value={c.weight} min={0} max={Math.max(...model.criteria.map((x) => x.weight), 0.0001)} color={COLORS.navy} width={46} />
            </View>
          </View>
          <Text style={[s.muted, { flex: 1 }]}>{c.description || "No description provided."}</Text>
        </View>
      ))}

      <Text style={[s.h2, { marginTop: 20, marginBottom: 4 }]}>Scoring scale</Text>
      <Text style={{ marginBottom: 6 }}>
        {model.scaleMode === "discrete"
          ? "Reviewers pick one of the listed values."
          : `Reviewers may enter any value from ${model.scaleMin} to ${model.scaleMax}; the listed points are reference anchors.`}
      </Text>
      <View style={{ flexDirection: "row" }} wrap={false}>
        {model.scale.map((point, i) => (
          <View
            key={point.value}
            style={{
              flex: 1,
              marginLeft: i === 0 ? 0 : 6,
              borderWidth: 0.75,
              borderColor: COLORS.border,
              borderRadius: 4,
              padding: 8,
            }}
          >
            <Text style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: COLORS.navy }}>
              {point.value}
            </Text>
            <Text style={s.muted}>{point.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.h2, { marginTop: 20, marginBottom: 6 }]}>Reviewers</Text>
      <View style={s.trHead}>
        <Text style={[s.th, { flex: 1 }]}>Name</Text>
        <Text style={[s.th, { width: 110 }]}>Group</Text>
        <Text style={[s.th, { width: 110 }]}>Confidentiality form</Text>
      </View>
      {model.reviewers.map((r) => (
        <View key={r.id} style={s.tr} wrap={false}>
          <Text style={{ flex: 1, fontWeight: 600 }}>{r.name}</Text>
          <Text style={{ width: 110 }}>{REVIEWER_TYPE_LABEL[r.type]}</Text>
          <Text style={{ width: 110, color: r.confidentialitySigned === false ? COLORS.amberBorder : COLORS.text }}>
            {signedLabel(r.confidentialitySigned)}
          </Text>
        </View>
      ))}

      <View style={[s.note, { marginTop: 20 }]} wrap={false}>
        <Text style={[s.h3, { marginBottom: 3 }]}>How the numbers are calculated</Text>
        <Text style={{ marginBottom: 2 }}>
          For each criterion, a firm's score is the average of the scores reviewers recorded. A firm's weighted total
          adds each criterion's average multiplied by its weight.
        </Text>
        <Text style={{ marginBottom: 2 }}>
          A criterion no one has scored yet is left out rather than counted as zero. Firms with equal totals share a
          rank, and the next rank is skipped.
        </Text>
        <Text>Only firms that submitted a proposal are scored and ranked.</Text>
      </View>
    </Page>
  );
}

// ---------------------------------------------------------------------------------- firm profile

function MetricTile({ label, value, rank, color, has = true }: { label: string; value: number; rank: number; color: string; has?: boolean }) {
  return (
    <View style={{ width: 84, marginLeft: 6, borderTopWidth: 3, borderTopColor: color, backgroundColor: COLORS.panel, paddingVertical: 6, paddingHorizontal: 8 }}>
      <Text style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: COLORS.navy }}>{groupTotal(value, has)}</Text>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={[s.small, s.muted]}>{has ? `Rank ${rank}` : "No scores yet"}</Text>
    </View>
  );
}

function Insight({ label, title, detail }: { label: string; title: string; detail: string }) {
  return (
    <View style={{ marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: COLORS.skyBlue }}>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={{ fontWeight: 600, fontSize: 9 }}>{title}</Text>
      <Text style={[s.small, s.muted]}>{detail}</Text>
    </View>
  );
}

function FirmProfile({
  firm,
  total,
  model,
  project,
  radar,
}: {
  firm: FirmReport;
  total: number;
  model: ReportModel;
  project: Project;
  radar: ReactElement | null;
}) {
  const { min, max } = weightedTotalRange(project);
  const { scaleMin, scaleMax } = model;
  const cols = model.criteria.length;
  const colWidth = cols > 0 ? 380 / cols : 0;

  return (
    <>
      <Page size="LETTER" style={s.page} bookmark={`${firm.rank}. ${firm.firm.name}`}>
        <Running model={model} />
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <Text style={[s.rankBadge, { width: 34, height: 34, borderRadius: 17, fontSize: 15, paddingTop: 8.5, backgroundColor: COLORS.yellow, color: COLORS.navy }]}>
            {firm.rank}
          </Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.h1, { fontSize: 18 }]}>{firm.firm.name}</Text>
            <Text style={[s.small, s.muted]}>
              Ranked {firm.rank} of {total} by overall score
            </Text>
          </View>
          <MetricTile label="Overall" value={firm.overall} rank={firm.rank} color={METRIC_COLORS.overall} />
          <MetricTile label="TLC Applicant" value={firm.applicant} rank={firm.applicantRank} color={METRIC_COLORS.applicant} has={firm.hasApplicant} />
          <MetricTile label="WFRC" value={firm.wfrc} rank={firm.wfrcRank} color={METRIC_COLORS.wfrc} has={firm.hasWfrc} />
        </View>
        <View style={{ height: 1.25, backgroundColor: COLORS.navy, marginBottom: 12 }} />

        {firm.scored < firm.expected && (
          <View style={[s.warn, { marginBottom: 10 }]}>
            <Text>
              {firm.scored} of {firm.expected} scores recorded for this firm. Its totals are based on the scores
              recorded so far.
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 380 }}>
            <Text style={[s.h3, { marginBottom: 2 }]}>Criterion breakdown</Text>
            {radar}
            <Legend />
          </View>
          <View style={{ flex: 1, marginLeft: 16, paddingTop: 22 }}>
            {firm.strongest && (
              <Insight label="Highest-scoring criterion" title={firm.strongest.criterion.name} detail={`${fmt(firm.strongest.overall)} average`} />
            )}
            {firm.weakest && firm.weakest !== firm.strongest && (
              <Insight label="Lowest-scoring criterion" title={firm.weakest.criterion.name} detail={`${fmt(firm.weakest.overall)} average`} />
            )}
            {firm.biggestGap && Math.abs(firm.biggestGap.gap) >= 0.05 && (
              <Insight
                label="Largest difference between groups"
                title={firm.biggestGap.result.criterion.name}
                detail={`TLC Applicant ${fmt(firm.biggestGap.result.applicant)} vs WFRC ${fmt(firm.biggestGap.result.wfrc)}`}
              />
            )}
          </View>
        </View>

        <Text style={[s.h3, { marginTop: 12, marginBottom: 4 }]}>Scores by criterion</Text>
        <View style={s.trHead}>
          <Text style={[s.th, { flex: 1 }]}>Criterion</Text>
          <Text style={[s.th, { width: 130 }]}>Overall</Text>
          <Text style={[s.th, s.num, { width: 70 }]}>TLC Applicant</Text>
          <Text style={[s.th, s.num, { width: 60 }]}>WFRC</Text>
        </View>
        {firm.criteria.map(({ criterion, overall, applicant, wfrc }) => (
          <View key={criterion.id} style={s.tr} wrap={false}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontWeight: 600 }}>{criterion.name}</Text>
              <Text style={[s.small, s.muted]}>{round2(criterion.weight * 100)}% of total</Text>
            </View>
            <View style={{ width: 130, flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.num, { width: 28, fontWeight: 600 }]}>{fmt(overall)}</Text>
              <View style={{ marginLeft: 8 }}>
                <ScoreBar value={overall} min={scaleMin} max={scaleMax} color={METRIC_COLORS.overall} width={80} />
              </View>
            </View>
            <Text style={[s.num, { width: 70 }]}>{fmt(applicant)}</Text>
            <Text style={[s.num, { width: 60, paddingRight: 6 }]}>{fmt(wfrc)}</Text>
          </View>
        ))}
        <View style={[s.tr, { backgroundColor: COLORS.panel, borderBottomWidth: 0 }]} wrap={false}>
          <Text style={{ flex: 1, fontWeight: 600, paddingLeft: 2 }}>Weighted total</Text>
          <View style={{ width: 130, flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.num, { width: 28, fontWeight: 600 }]}>{n2(firm.overall)}</Text>
            <View style={{ marginLeft: 8 }}>
              <ScoreBar value={firm.overall} min={min} max={max} color={METRIC_COLORS.overall} width={80} />
            </View>
          </View>
          <Text style={[s.num, { width: 70, fontWeight: 600 }]}>{groupTotal(firm.applicant, firm.hasApplicant)}</Text>
          <Text style={[s.num, { width: 60, paddingRight: 6, fontWeight: 600 }]}>{groupTotal(firm.wfrc, firm.hasWfrc)}</Text>
        </View>
      </Page>

      <Page size="LETTER" style={s.page}>
        <Running model={model} />
        <Text style={[s.h2, { marginBottom: 2 }]}>{firm.firm.name}: reviewer scores</Text>
        <View style={s.accentRule} />

        {firm.groups.length === 0 ? (
          <Text style={s.muted}>No scores have been recorded for this firm yet.</Text>
        ) : (
          <View>
            <View style={s.trHead}>
              <Text style={[s.th, { width: 100 }]}>Reviewer</Text>
              {model.criteria.map((c) => (
                <Text key={c.id} style={[s.th, { width: colWidth, textAlign: "center", fontSize: 6.5, paddingHorizontal: 1 }]}>
                  {c.name}
                </Text>
              ))}
              <Text style={[s.th, { width: 44, textAlign: "center" }]}>Total</Text>
            </View>
            {firm.groups.map((group) => (
              <View key={group.type}>
                <View style={{ backgroundColor: COLORS.panel, paddingVertical: 3, paddingHorizontal: 4, marginTop: 6 }}>
                  <Text style={[s.th, { fontSize: 7.5 }]}>{group.label}</Text>
                </View>
                {group.rows.map((row) => (
                  <View key={row.reviewer.id} style={[s.tr, { paddingVertical: 2.5 }]} wrap={false}>
                    <Text style={{ width: 100, fontSize: 8.5, paddingRight: 4 }}>{row.reviewer.name}</Text>
                    {row.scores.map((value, i) => (
                      <HeatCell key={i} value={value} width={colWidth} scaleMin={scaleMin} scaleMax={scaleMax} />
                    ))}
                    <Text style={{ width: 44, textAlign: "center", fontWeight: 600 }}>{fmt(row.total)}</Text>
                  </View>
                ))}
                <View style={[s.tr, { paddingVertical: 2.5, borderBottomWidth: 0 }]} wrap={false}>
                  <Text style={{ width: 100, fontSize: 8, fontWeight: 600 }}>Group average</Text>
                  {group.averages.map((value, i) => (
                    <Text key={i} style={{ width: colWidth, textAlign: "center", fontSize: 8, fontWeight: 600 }}>
                      {fmt(value)}
                    </Text>
                  ))}
                  <View style={{ width: 44 }} />
                </View>
              </View>
            ))}
            <View style={[s.tr, { marginTop: 4, borderTopWidth: 1.25, borderTopColor: COLORS.navy, borderBottomWidth: 0 }]} wrap={false}>
              <Text style={{ width: 100, fontSize: 8, fontWeight: 600, color: COLORS.navy }}>All reviewers</Text>
              {firm.overallAverages.map((value, i) => (
                <Text key={i} style={{ width: colWidth, textAlign: "center", fontSize: 8, fontWeight: 600, color: COLORS.navy }}>
                  {fmt(value)}
                </Text>
              ))}
              <Text style={{ width: 44, textAlign: "center", fontWeight: 700, color: COLORS.navy }}>{n2(firm.overall)}</Text>
            </View>
            <HeatLegend scaleMin={scaleMin} scaleMax={scaleMax} />
          </View>
        )}

        <Text style={[s.h2, { marginTop: 22, marginBottom: 2 }]}>Reviewer comments</Text>
        <View style={s.accentRule} />
        {firm.comments.length === 0 ? (
          <Text style={s.muted}>No comments were recorded for this firm.</Text>
        ) : (
          firm.comments.map(({ criterion, entries }) => (
            <View key={criterion.id} style={{ marginBottom: 10 }}>
              <Text style={[s.h3, { marginBottom: 4 }]} minPresenceAhead={50}>
                {criterion.name}
              </Text>
              {entries.map((entry, i) => (
                <View
                  key={i}
                  wrap={false}
                  style={{ flexDirection: "row", marginBottom: 4, borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: 8 }}
                >
                  <View style={{ width: 108 }}>
                    <Text style={{ fontWeight: 600, fontSize: 8.5 }}>{entry.reviewerName}</Text>
                    <Text style={[s.small, s.muted]}>
                      {REVIEWER_TYPE_LABEL[entry.reviewerType]}, scored {round2(entry.value)}
                    </Text>
                  </View>
                  <Text style={{ flex: 1 }}>{entry.text}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </Page>
    </>
  );
}

function HeatCell({ value, width, scaleMin, scaleMax }: { value: number | null; width: number; scaleMin: number; scaleMax: number }) {
  if (value === null) {
    return <Text style={{ width, textAlign: "center", color: COLORS.gray }}>—</Text>;
  }
  const background = heatmapBackgroundFor(value, scaleMin, scaleMax);
  return (
    <View style={{ width, paddingHorizontal: 1.5 }}>
      <Text
        style={{
          backgroundColor: background,
          color: heatmapTextColorFor(background),
          textAlign: "center",
          paddingVertical: 2.5,
          fontWeight: 600,
          fontSize: 8.5,
          borderRadius: 2,
        }}
      >
        {round2(value)}
      </Text>
    </View>
  );
}

function HeatLegend({ scaleMin, scaleMax }: { scaleMin: number; scaleMax: number }) {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Text style={[s.small, s.muted, { marginRight: 6 }]}>Lower ({scaleMin})</Text>
      {steps.map((t) => (
        <View key={t} style={{ width: 22, height: 8, backgroundColor: heatmapBackgroundFor(scaleMin + (scaleMax - scaleMin) * t, scaleMin, scaleMax) }} />
      ))}
      <Text style={[s.small, s.muted, { marginLeft: 6 }]}>Higher ({scaleMax})</Text>
    </View>
  );
}

// ------------------------------------------------------------------------------------ data notes

function DataNotes({ model }: { model: ReportModel }) {
  return (
    <Page size="LETTER" style={s.page} bookmark="Data notes">
      <Running model={model} />
      <SectionTitle title="Data notes" />
      {model.isPartial && (
        <View style={[s.warn, { marginBottom: 10 }]}>
          <Text style={[s.h3, { marginBottom: 2 }]}>Scoring is not complete</Text>
          <Text>
            {model.scored} of {model.expected} expected scores have been recorded. Treat totals and rankings as
            provisional until every reviewer has finished.
          </Text>
        </View>
      )}
      {model.unsignedReviewers.length > 0 && (
        <View style={[s.warn, { marginBottom: 10 }]}>
          <Text style={[s.h3, { marginBottom: 2 }]}>Confidentiality forms outstanding</Text>
          <Text>{model.unsignedReviewers.map((r) => r.name).join(", ")}</Text>
        </View>
      )}
      {model.notSubmitted.length > 0 && (
        <View>
          <Text style={[s.h2, { marginBottom: 6 }]}>Firms not scored</Text>
          <Text style={{ marginBottom: 6 }}>These firms did not submit a proposal, so they are not scored or ranked.</Text>
          <View style={s.trHead}>
            <Text style={[s.th, { width: 160 }]}>Firm</Text>
            <Text style={[s.th, { width: 70 }]}>Invited</Text>
            <Text style={[s.th, { flex: 1 }]}>Notes</Text>
          </View>
          {model.notSubmitted.map((firm) => (
            <View key={firm.id} style={[s.tr, { alignItems: "flex-start" }]} wrap={false}>
              <Text style={{ width: 160, fontWeight: 600 }}>{firm.name}</Text>
              <Text style={{ width: 70 }}>{firm.invited ? "Yes" : "No"}</Text>
              <Text style={[s.muted, { flex: 1 }]}>{firm.notes || "—"}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

export function ReportDocument({ model, project, charts, logoUrl }: ReportDocumentProps) {
  const hasNotes = model.isPartial || model.unsignedReviewers.length > 0 || model.notSubmitted.length > 0;
  return (
    <Document
      title={`${model.projectName} - Proposal Evaluation Report`}
      author="Wasatch Front Regional Council"
      subject="Proposal evaluation scoring summary"
      creator="Proposal Evaluation Scoresheet"
    >
      <Cover model={model} logoUrl={logoUrl} />
      <Overview model={model} project={project} chart={charts.bar} />
      <Framework model={model} />
      {model.firms.map((firm) => (
        <FirmProfile
          key={firm.firm.id}
          firm={firm}
          total={model.firms.length}
          model={model}
          project={project}
          radar={charts.radars[firm.firm.id] ?? null}
        />
      ))}
      {hasNotes && <DataNotes model={model} />}
    </Document>
  );
}
