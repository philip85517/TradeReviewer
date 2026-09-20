import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type {
  OutcomeDiagnostic,
  OutcomeDiagnosticsReport,
  OutcomeDiagnosticSide,
} from "../../lib/insights/outcome-diagnostics";

type Props = {
  report: OutcomeDiagnosticsReport;
  facts: InsightEpisodeFact[];
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

const cardStyle = {
  border: "1px solid #29425a",
  borderRadius: 8,
  padding: 12,
  background: "#111f2e",
} as const;

function display(value: string | null, suffix = "") {
  if (value === null) return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, useGrouping: false }).format(number)}${suffix}`
    : "—";
}

function SideSummary({ label, side }: { label: string; side: OutcomeDiagnosticSide }) {
  return (
    <article style={cardStyle}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>{label}</h3>
      <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: 0 }}>
        <div><dt style={{ color: "#8fa5bd", fontSize: 11 }}>样本</dt><dd style={{ margin: "3px 0 0" }}>{side.sampleCount}</dd></div>
        <div><dt style={{ color: "#8fa5bd", fontSize: 11 }}>广度</dt><dd style={{ margin: "3px 0 0" }}>{display(side.breadthPercent, "%")}</dd></div>
        <div><dt style={{ color: "#8fa5bd", fontSize: 11 }}>最差/最佳 20% 尾部集中度</dt><dd style={{ margin: "3px 0 0" }}>{display(side.tailConcentrationPercent, "%")}</dd></div>
        <div><dt style={{ color: "#8fa5bd", fontSize: 11 }}>最大绝对收益率</dt><dd style={{ margin: "3px 0 0" }}>{display(side.maximumAbsolutePercent, "%")}</dd></div>
      </dl>
      {side.status === "insufficient-sample" && <p style={{ margin: "9px 0 0", color: "#f0c674", fontSize: 12 }}>样本不足，不生成正式诊断</p>}
    </article>
  );
}

function EpisodeLinks({
  kind,
  episodeIds,
  factsByEpisode,
  onOpenEpisode,
}: {
  kind: "证据" | "反例";
  episodeIds: string[];
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <details>
      <summary>{kind === "证据" ? "支持证据" : "反例"}（{episodeIds.length}）</summary>
      <div style={{ paddingTop: 6 }}>
        {episodeIds.map((episodeId) => {
          const fact = factsByEpisode.get(episodeId);
          if (!fact) return null;
          return (
            <button
              key={episodeId}
              type="button"
              aria-label={`查看${kind} ${fact.instrumentName} ${fact.instrumentSymbol}`}
              onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}
              style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "6px 0", border: 0, borderTop: "1px solid #23374d", color: "#c9d8e9", background: "transparent", cursor: "pointer", textAlign: "left" }}
            >
              <span>{fact.instrumentName}（{fact.instrumentSymbol}）</span>
              <b>{display(fact.returnPercent, "%")}</b>
            </button>
          );
        })}
        {episodeIds.length === 0 && <p style={{ color: "#aebed1", fontSize: 12 }}>暂无可打开回合。</p>}
      </div>
    </details>
  );
}

function DiagnosticCard({
  diagnostic,
  factsByEpisode,
  onOpenEpisode,
}: {
  diagnostic: OutcomeDiagnostic;
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <article style={cardStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{diagnostic.label}</h3>
        <span style={{ color: "#8fa5bd", fontSize: 11 }}>{diagnostic.sampleCount} 笔样本</span>
      </header>
      <p style={{ margin: "8px 0", color: "#c9d8e9", fontSize: 12, lineHeight: 1.6 }}>{diagnostic.conclusion}</p>
      <p style={{ margin: "6px 0", color: "#c9d8e9", fontSize: 12 }}>
        {diagnostic.side === "loss" ? "亏损" : "盈利"}广度 {display(diagnostic.breadthPercent, "%")} · {diagnostic.side === "loss" ? "最差" : "最佳"} 20% 尾部集中度 {display(diagnostic.tailConcentrationPercent, "%")}
      </p>
      <p style={{ margin: "6px 0", color: "#8fa5bd", fontSize: 11 }}>
        时间范围：{diagnostic.timeRange.start}—{diagnostic.timeRange.end}
      </p>
      <p style={{ margin: "6px 0", color: "#8fa5bd", fontSize: 11 }}>
        阈值：同侧样本至少 {diagnostic.threshold.minimumSideSampleCount} 笔；尾部占比 {diagnostic.threshold.tailSharePercent}%；广度阈值 {diagnostic.threshold.breadthThresholdPercent}%；最大/中位绝对收益率至少 {diagnostic.threshold.maxToMedianRatio} 倍。
      </p>
      <p style={{ margin: "6px 0", color: "#8fa5bd", fontSize: 11 }}>计算 v{diagnostic.calculationVersion} · 口径：费用后收益率 · 尾部方法：最差/最佳 20% 按绝对收益率取整</p>
      <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
        <EpisodeLinks kind="证据" episodeIds={diagnostic.evidenceEpisodeIds} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
        <EpisodeLinks kind="反例" episodeIds={diagnostic.counterexampleEpisodeIds} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
      </div>
    </article>
  );
}

export function OutcomeDiagnostics({ report, facts, onOpenEpisode }: Props) {
  const factsByEpisode = new Map(facts.map((fact) => [fact.episodeId, fact]));
  return (
    <section aria-label="尾部结构诊断" style={{ marginTop: 18, padding: 16, border: "1px solid #2f4d65", borderRadius: 12, background: "rgba(14, 28, 42, 0.96)" }}>
      <header>
        <span style={{ color: "#7cd4c6", fontSize: 11 }}>TAIL DIAGNOSTICS</span>
        <h2 style={{ margin: "3px 0 4px", fontSize: 16 }}>尾部结构诊断</h2>
        <p style={{ margin: 0, color: "#aebed1", fontSize: 12, lineHeight: 1.6 }}>诊断只描述当前样本的收益分布，不代表因果或交易建议；未知收益率不会按 0 计入。</p>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 14 }}>
        <SideSummary label="亏损侧" side={report.sides.loss} />
        <SideSummary label="盈利侧" side={report.sides.profit} />
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {report.diagnostics.map((diagnostic) => (
          <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
        ))}
        {report.diagnostics.length === 0 && <p style={{ margin: 0, color: "#f0c674", fontSize: 12 }}>样本不足，不生成正式诊断</p>}
      </div>
    </section>
  );
}
