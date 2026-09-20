import type { InsightEpisodeFact } from "../../lib/insights/episode-facts";
import type { OutcomeBucket, OutcomeStructureReport } from "../../lib/insights/outcome-structure";
import styles from "./outcome-structure.module.css";

type Props = {
  report: OutcomeStructureReport;
  facts: InsightEpisodeFact[];
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

function displayNumber(value: string | null, suffix = "") {
  if (value === null) return "—";
  const number = Number(value);
  const displayed = Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2, useGrouping: false }).format(number)
    : value;
  return displayed + suffix;
}

function EpisodeLinks({
  bucket,
  factsByEpisode,
  onOpenEpisode,
}: {
  bucket: OutcomeBucket;
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <div className={styles.bucketBody}>
      {bucket.episodeIds.map((episodeId) => {
        const fact = factsByEpisode.get(episodeId);
        if (!fact) return null;
        return (
          <button
            className={styles.episode}
            key={episodeId}
            type="button"
            aria-label={"查看" + bucket.label + " " + fact.instrumentName + " " + fact.instrumentSymbol}
            onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}
          >
            <span>{fact.instrumentName}（{fact.instrumentSymbol}）</span>
            <b>{displayNumber(fact.returnPercent, "%")}</b>
          </button>
        );
      })}
      {bucket.episodeIds.length === 0 && <p className={styles.note}>暂无可打开的回合。</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value === null ? "—" : value}</dd>
    </div>
  );
}

function plotCoordinate(value: string, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number / maximum * 100)) : null;
}

function OddsWinRatePlot({
  report,
  factsByEpisode,
  onOpenEpisode,
}: {
  report: OutcomeStructureReport;
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  const point = report.oddsWinRate.point;
  const maximumOdds = Math.max(
    5,
    ...report.oddsWinRate.breakEvenLine.map(({ odds }) => Number(odds)),
    Number(point.odds ?? 0),
  );
  const toSvgPoint = (winRatePercent: string, odds: string) => {
    const x = plotCoordinate(winRatePercent, 100);
    const y = plotCoordinate(odds, maximumOdds);
    return x === null || y === null ? null : `${x},${100 - y}`;
  };
  const linePoints = report.oddsWinRate.breakEvenLine
    .map(({ winRatePercent, odds }) => toSvgPoint(winRatePercent, odds))
    .filter((value): value is string => value !== null)
    .join(" ");
  const pointCoordinates = point.winRatePercent !== null && point.odds !== null
    ? toSvgPoint(point.winRatePercent, point.odds)
    : null;
  const firstFact = point.episodeIds.map((id) => factsByEpisode.get(id)).find(Boolean);
  const openPoint = () => {
    if (firstFact) onOpenEpisode(firstFact.instrumentId, firstFact.episodeId);
  };

  return (
    <div className={styles.oddsPlot}>
      <h4>胜率—赔率关系</h4>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="胜率—赔率散点图，含盈亏平衡线"
      >
        <line className={styles.oddsPlotGrid} x1="0" x2="100" y1="25" y2="25" />
        <line className={styles.oddsPlotGrid} x1="0" x2="100" y1="50" y2="50" />
        <line className={styles.oddsPlotGrid} x1="0" x2="100" y1="75" y2="75" />
        <polyline
          className={styles.breakEvenLine}
          points={linePoints}
          aria-label="盈亏平衡线"
        />
        {pointCoordinates && (
          <circle
            className={styles.oddsPoint}
            cx={pointCoordinates.split(",")[0]}
            cy={pointCoordinates.split(",")[1]}
            r="3"
            role="button"
            tabIndex={0}
            aria-label={`${point.label}，非持平胜率 ${displayNumber(point.winRatePercent, "%")}，赔率 ${displayNumber(point.odds)}，${point.sampleCount} 个回合`}
            onClick={openPoint}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPoint();
              }
            }}
          />
        )}
      </svg>
      <p className={styles.plotNote}>
        横轴：非持平胜率；纵轴：平均盈利 ÷ 平均亏损绝对值。虚线为盈亏平衡线，点为{point.label}（{point.sampleCount} 笔）；点击点可打开代表性回合。
      </p>
      <table className={styles.accessibleTable}>
        <caption>胜率—赔率关系的可读替代表格</caption>
        <thead><tr><th>分组</th><th>非持平胜率</th><th>赔率</th><th>样本</th></tr></thead>
        <tbody>
          <tr>
            <td>{point.label}</td>
            <td>{displayNumber(point.winRatePercent, "%")}</td>
            <td>{displayNumber(point.odds)}</td>
            <td>{point.sampleCount}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OutcomeStructure({ report, facts, onOpenEpisode }: Props) {
  const factsByEpisode = new Map(facts.map((fact) => [fact.episodeId, fact]));
  const maxBinCount = Math.max(1, ...report.histogram.bins.map((bin) => bin.count));
  const sizeLabel = (classification: "reliable" | "unreliable") =>
    classification === "reliable" ? "可可靠分类" : "不可可靠分类";

  return (
    <section className={styles.section} aria-label="收益结构">
      <div className={styles.header}>
        <div>
          <span className="eyebrow">Outcome Structure</span>
          <h2>收益结构</h2>
          <p>主口径：已平仓且费用后收益率可用的回合；描述统计不代表因果或交易建议。</p>
        </div>
        <span className={styles.sample}>{report.sampleCount} 个合格回合</span>
      </div>

      <dl className={styles.metricGrid} aria-label="收益结构核心指标">
        <Metric label="盈利 / 亏损 / 持平" value={report.distribution.profitCount + " / " + report.distribution.lossCount + " / " + report.distribution.flatCount} />
        <Metric label="总胜率（含持平）" value={displayNumber(report.metrics.totalWinRate, "%")} />
        <Metric label="非持平胜率" value={displayNumber(report.metrics.nonFlatWinRate, "%")} />
        <Metric label="平均盈利" value={displayNumber(report.metrics.averageProfitPercent, "%")} />
        <Metric label="中位盈利" value={displayNumber(report.metrics.medianProfitPercent, "%")} />
        <Metric label="平均亏损" value={displayNumber(report.metrics.averageLossPercent, "%")} />
        <Metric label="中位亏损" value={displayNumber(report.metrics.medianLossPercent, "%")} />
        <Metric label="赔率" value={displayNumber(report.metrics.odds)} />
        <Metric label="利润因子" value={displayNumber(report.metrics.profitFactor)} />
        <Metric label="每笔期望收益" value={displayNumber(report.metrics.expectancyPercent, "%")} />
        <Metric label="最大盈利" value={displayNumber(report.metrics.maxProfitPercent, "%")} />
        <Metric label="最大亏损" value={displayNumber(report.metrics.maxLossPercent, "%")} />
      </dl>

      <div className={styles.subsection}>
        <h3>收益率分布（零收益线：0%）</h3>
        <div className={styles.histogramFrame}>
          {report.histogram.zeroPositionPercent !== null && (
            <div className={styles.zeroLine} style={{ left: `${report.histogram.zeroPositionPercent}%` }} aria-label="零收益参考线 0%"><span>0%</span></div>
          )}
          <div className={styles.histogram} aria-label="费用后收益率直方图">
            {report.histogram.bins.map((bin) => {
              const barClass = {
                loss: styles.barLoss,
                flat: styles.barFlat,
                profit: styles.barProfit,
                mixed: styles.barMixed,
              }[bin.tone];
              return (
                <details key={bin.id}>
                  <summary>{bin.label} · {bin.count} 笔</summary>
                  <div className={styles.barArea}>
                    <div className={`${styles.bar} ${barClass}`} style={{ height: Math.max(5, (bin.count / maxBinCount) * 100) + "%" }} aria-hidden="true" />
                  </div>
                  <span className={styles.barLabel}>点击展开回合</span>
                  {bin.episodeIds.map((episodeId) => {
                    const fact = factsByEpisode.get(episodeId);
                    if (!fact) return null;
                    return (
                      <button className={styles.episode} key={episodeId} type="button" aria-label={"查看分布区间 " + fact.instrumentName + " " + fact.instrumentSymbol} onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}>
                        <span>{fact.instrumentName}（{fact.instrumentSymbol}）</span>
                        <b>{displayNumber(fact.returnPercent, "%")}</b>
                      </button>
                    );
                  })}
                </details>
              );
            })}
          </div>
        </div>
        <table className={styles.accessibleTable}>
          <caption>收益率分布的可读替代表格</caption>
          <thead><tr><th>区间</th><th>笔数</th><th>回合入口</th></tr></thead>
          <tbody>{report.histogram.bins.map((bin) => <tr key={bin.id + "-row"}><td>{bin.label}</td><td>{bin.count}</td><td>{bin.episodeIds.length ? "可展开查看" : "—"}</td></tr>)}</tbody>
        </table>
      </div>

      <div className={styles.subsection}>
        <OddsWinRatePlot report={report} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
      </div>

      <div className={styles.subsection}>
        <h3>结果分类</h3>
        <p className={styles.classification}>
          盈利侧：{sizeLabel(report.distribution.profitSize.classification)}（{report.distribution.profitSize.sampleCount} 笔，分界 {displayNumber(report.distribution.profitSize.thresholdPercent, "%")}）；亏损侧：{sizeLabel(report.distribution.lossSize.classification)}（{report.distribution.lossSize.sampleCount} 笔，分界 {displayNumber(report.distribution.lossSize.thresholdPercent, "%")}）。
        </p>
        {report.distribution.unreliableReason && <p className={styles.note}>{report.distribution.unreliableReason}</p>}
        <div className={styles.bucketGrid} aria-label="小亏大亏小赚大赚持平结果桶">
          {report.buckets.map((bucket) => (
            <details className={styles.bucket} key={bucket.id}>
              <summary>{bucket.label} · {bucket.count} 笔 · {displayNumber(bucket.sharePercent, "%")}</summary>
              <EpisodeLinks bucket={bucket} factsByEpisode={factsByEpisode} onOpenEpisode={onOpenEpisode} />
            </details>
          ))}
        </div>
      </div>

      {report.excluded.length > 0 && (
        <details className={styles.subsection}>
          <summary className={styles.note}>另有 {report.excluded.length} 个回合未进入收益结构统计；缺失收益率显示为未知，不按 0 计入。</summary>
          <div className={styles.bucketBody}>
            {report.excluded.map((item) => {
              const fact = factsByEpisode.get(item.episodeId);
              return (
                <div key={`${item.episodeId}:${item.reason}`} className={styles.episode}>
                  <span>{item.instrumentName} · {item.reasonLabel}</span>
                  {fact && <button type="button" onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}>查看回合</button>}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
