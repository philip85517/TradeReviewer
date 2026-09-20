import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type { IpoBreakdownGroup, IpoBreakdownReport } from "../../lib/insights/ipo-breakdown";
import { OutcomeDiagnostics } from "./outcome-diagnostics";
import { OddsWinRatePlot } from "./outcome-structure";

type Props = {
  report: IpoBreakdownReport;
  facts: InsightEpisodeFact[];
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

function display(value: string | null, suffix = "") {
  if (value === null) return "—";
  const number = Number(value);
  return `${Number.isFinite(number) ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, useGrouping: false }).format(number) : value}${suffix}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function EpisodeButton({
  fact,
  label,
  onOpenEpisode,
}: {
  fact: InsightEpisodeFact;
  label: string;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <button
      type="button"
      aria-label={`查看${label} ${fact.episodeId}`}
      onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}
    >
      {fact.instrumentName}（{fact.instrumentSymbol}） · {fact.episodeId}
    </button>
  );
}

function BucketLinks({
  group,
  bucket,
  factsByEpisode,
  onOpenEpisode,
}: {
  group: IpoBreakdownGroup;
  bucket: IpoBreakdownGroup["outcome"]["buckets"][number];
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  const facts = bucket.episodeIds
    .map((episodeId) => factsByEpisode.get(episodeId))
    .filter((fact): fact is InsightEpisodeFact => Boolean(fact));
  return facts.length === 0 ? (
    <span>—</span>
  ) : (
    <div>
      {facts.map((fact) => (
        <EpisodeButton
          key={`${group.id}:${bucket.id}:${fact.episodeId}`}
          fact={fact}
          label={`${group.classificationLabel}${bucket.label}`}
          onOpenEpisode={onOpenEpisode}
        />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  factsByEpisode,
  onOpenEpisode,
}: {
  group: IpoBreakdownGroup;
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  const outcome = group.outcome;
  return (
    <article aria-label={group.classificationLabel}>
      <header>
        <h3>{group.classificationLabel}</h3>
        <p>{group.sampleCount} 个回合 · 覆盖 {display(group.coveragePercent, "%")} · {group.comparableSampleCount} 个可比较回合</p>
      </header>
      <dl aria-label={`${group.classificationLabel}收益指标`}>
        <Metric label="盈利 / 亏损 / 持平" value={`${outcome.distribution.profitCount} / ${outcome.distribution.lossCount} / ${outcome.distribution.flatCount}`} />
        <Metric label="总胜率（含持平）" value={display(outcome.metrics.totalWinRate, "%")} />
        <Metric label="非持平胜率" value={display(outcome.metrics.nonFlatWinRate, "%")} />
        <Metric label="平均盈利" value={display(outcome.metrics.averageProfitPercent, "%")} />
        <Metric label="中位盈利" value={display(outcome.metrics.medianProfitPercent, "%")} />
        <Metric label="平均亏损" value={display(outcome.metrics.averageLossPercent, "%")} />
        <Metric label="中位亏损" value={display(outcome.metrics.medianLossPercent, "%")} />
        <Metric label="赔率" value={display(outcome.metrics.odds)} />
      </dl>
      <OddsWinRatePlot
        report={outcome}
        factsByEpisode={new Map(group.facts.map((fact) => [fact.episodeId, fact]))}
        onOpenEpisode={onOpenEpisode}
      />

      <details>
        <summary>收益桶（{outcome.buckets.reduce((total, bucket) => total + bucket.count, 0)} 笔已分类）</summary>
        <table>
          <caption>{group.classificationLabel}收益桶</caption>
          <thead><tr><th>类别</th><th>笔数</th><th>收益中位数</th><th>回合入口</th></tr></thead>
          <tbody>
            {outcome.buckets.map((bucket) => (
              <tr key={bucket.id}>
                <td>{bucket.label}</td>
                <td>{bucket.count}</td>
                <td>{display(bucket.medianReturnPercent, "%")}</td>
                <td><BucketLinks group={group} bucket={bucket} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <OutcomeDiagnostics report={group.diagnostics} facts={group.facts} onOpenEpisode={onOpenEpisode} />

      {group.evidence.length > 0 && (
        <details open>
          <summary>IPO 证据（{group.evidence.length} 个回合）</summary>
          {group.evidence.map((item) => {
            const fact = factsByEpisode.get(item.episodeId);
            return fact ? (
              <div key={item.episodeId}>
                <EpisodeButton fact={fact} label="IPO 证据" onOpenEpisode={onOpenEpisode} />
                <small>{item.evidenceIds.join("、")} · {item.labels.join("、")}</small>
              </div>
            ) : null;
          })}
        </details>
      )}

      {group.excluded.length > 0 && (
        <details>
          <summary>未进入正式收益比较（{group.excluded.length}）</summary>
          {group.excluded.map((item) => (
            <div key={`${item.episodeId}:${item.reason}`}>
              <span>{item.episodeId} · {item.reasonLabel}</span>
              {factsByEpisode.has(item.episodeId) && <EpisodeButton fact={factsByEpisode.get(item.episodeId)!} label="排除回合" onOpenEpisode={onOpenEpisode} />}
            </div>
          ))}
        </details>
      )}

      {group.reasons.length > 0 && (
        <details open={group.id === "unknown"}>
          <summary>无法判定原因（{group.reasons.length}）</summary>
          {group.reasons.map((item) => {
            const fact = factsByEpisode.get(item.episodeId);
            return (
              <div key={item.episodeId}>
                <span>{item.episodeId} · {item.reason}</span>
                {fact && <EpisodeButton fact={fact} label="无法判定" onOpenEpisode={onOpenEpisode} />}
              </div>
            );
          })}
        </details>
      )}
    </article>
  );
}

export function IpoBreakdown({ report, facts, onOpenEpisode }: Props) {
  const factsByEpisode = new Map(facts.map((fact) => [fact.episodeId, fact]));
  return (
    <section aria-label="新股来源拆分">
      <header>
        <span>Source Breakdown</span>
        <h2>新股 / 非新股来源拆分</h2>
        <p>只根据同账户、同标准化证券、同市场的 IPO 配售/获配事件或执行背书判定；不根据名称或上市日期猜测。无法判定不会归入非新股。</p>
        <span>{report.sampleCount} 个收益结构回合 · 描述统计不代表因果或交易建议</span>
      </header>
      <div>
        {report.groups.map((group) => (
          <GroupCard key={group.id} group={group} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
        ))}
      </div>
    </section>
  );
}
