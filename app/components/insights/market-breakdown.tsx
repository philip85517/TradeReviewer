import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type {
  MarketBreakdownGroup,
  MarketBreakdownReport,
} from "../../lib/insights/market-breakdown";

type Props = {
  report: MarketBreakdownReport;
  facts: InsightEpisodeFact[];
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

function displayNumber(value: string | null, suffix = "") {
  if (value === null) return "—";
  const number = Number(value);
  const displayed = Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 2,
        useGrouping: false,
      }).format(number)
    : value;
  return displayed + suffix;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span>{label}{value}</span>;
}

function GroupCard({
  group,
  onOpenEpisode,
}: {
  group: MarketBreakdownGroup;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <article aria-label={`${group.label}收益结构`}>
      <header>
        <h3>{group.label}</h3>
        <span>{group.sampleCount} 个合格回合</span>
      </header>
      <p>{group.description}</p>
      <p>口径：收益率口径</p>
      {group.descriptiveOnly && (
        <p>仅描述统计：样本少于 3，不生成诊断或排名。</p>
      )}
      {group.excluded.length > 0 && (
        <p>另有 {group.excluded.length} 个回合排除；缺失收益率显示为未知。</p>
      )}
      <dl aria-label={`${group.label}核心指标`}>
        <Metric
          label="盈利 / 亏损 / 持平"
          value={`${group.report.distribution.profitCount} / ${group.report.distribution.lossCount} / ${group.report.distribution.flatCount}`}
        />
        <Metric label="总胜率（含持平）" value={displayNumber(group.report.metrics.totalWinRate, "%")} />
        <Metric label="非持平胜率" value={displayNumber(group.report.metrics.nonFlatWinRate, "%")} />
        <Metric label="平均盈利" value={displayNumber(group.report.metrics.averageProfitPercent, "%")} />
        <Metric label="中位盈利" value={displayNumber(group.report.metrics.medianProfitPercent, "%")} />
        <Metric label="平均亏损" value={displayNumber(group.report.metrics.averageLossPercent, "%")} />
        <Metric label="中位亏损" value={displayNumber(group.report.metrics.medianLossPercent, "%")} />
        <Metric label="赔率" value={displayNumber(group.report.metrics.odds)} />
        <Metric label="利润因子" value={displayNumber(group.report.metrics.profitFactor)} />
        <Metric label="最大盈利" value={displayNumber(group.report.metrics.maxProfitPercent, "%")} />
        <Metric label="最大亏损" value={displayNumber(group.report.metrics.maxLossPercent, "%")} />
      </dl>
      <p>结果分布：{group.report.buckets.map((bucket) => `${bucket.label} ${bucket.count} 笔`).join("；")}</p>
      <p>金额口径：跨币种不合并金额；仅在原币或 FX 可比较时显示。</p>
      <details>
        <summary>查看{group.label}交易回合（{group.facts.length}）</summary>
        {group.facts.map((fact) => (
          <button
            key={fact.episodeId}
            type="button"
            aria-label={`查看${group.label} ${fact.instrumentName}`}
            onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}
          >
            {fact.instrumentName} · {displayNumber(fact.returnPercent, "%")}
          </button>
        ))}
        {group.facts.length === 0 && <p>暂无可打开的回合。</p>}
      </details>
    </article>
  );
}

export function MarketBreakdown({ report, facts, onOpenEpisode }: Props) {
  const factsByEpisode = new Map(facts.map((fact) => [fact.episodeId, fact]));
  return (
    <section aria-label="分市场收益结构">
      <header>
        <span>Market Breakdown</span>
        <h2>分市场表现</h2>
        <p>
          各组复用收益结构报告的分布、胜率、赔率和排除口径；这是描述统计，不代表因果或交易建议。
        </p>
        <p>跨币种仅合并可比较的收益率和比例指标；金额不可用时显示未知。</p>
      </header>
      <div>
        {report.groups.map((group) => (
          <GroupCard
            key={group.market}
            group={{
              ...group,
              facts: group.facts
                .map((fact) => factsByEpisode.get(fact.episodeId) ?? fact),
            }}
            onOpenEpisode={onOpenEpisode}
          />
        ))}
      </div>
    </section>
  );
}
