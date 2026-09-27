import Decimal from "decimal.js";
import type { RecallActualMetrics } from "../../lib/recall/actual-metrics";
import type { RecallPhase } from "../../lib/recall/types";
import "./recall-actual-metrics.css";

type Metric = RecallActualMetrics["metrics"][keyof RecallActualMetrics["metrics"]];
const reasons: Record<string, string> = {
  "pre-entry": "成交尚未揭示", "missing-fees": "费用待补齐", "unknown-fees": "费用待补齐",
  "missing-cost": "成本待补齐", "unknown-cost": "成本待补齐", "missing-quantity": "数量待核对",
  "missing-mark": "缺少同口径估值", "missing-price-basis": "价格口径未确认",
  "price-basis-mismatch": "价格口径不同", "currency-mismatch": "币种不同，尚未换算",
  "missing-initial-risk-baseline": "初始风险未记录", "multiple-opening-decisions": "多次建仓，基准待确认",
  "open-position": "尚未平仓", "missing-plan": "原计划未记录", "missing-plan-quantity": "计划数量未记录",
  "missing-plan-entry": "计划入场未记录", "no-exits": "尚无已揭示退出",
  "episode-open": "尚未平仓", "missing-visible-raw-mark": "缺少同口径估值",
  "multiple-opening-decisions-require-prior-episode-budget": "多次建仓，基准待确认",
  "no-visible-executions": "尚无已揭示成交", "incomparable-plan": "原计划缺失或口径不同",
  "unknown-quantity": "数量待核对", "unknown-direction": "方向待核对",
  "inventory-allocation-unavailable": "期初持仓费用分摊待核对", "execution-scope-mismatch": "成交范围不一致",
  "unsupported-currency-precision": "币种精度待确认", "missing-opening-decision": "建仓决策归属待确认",
};
export function formatRecallActualMetricValue(metric: Metric): string {
  if (metric.value === null) return reasons[metric.reason ?? ""] ?? "待核算 · 来源不完整";
  const value = new Decimal(metric.value);
  const shown = metric.unit === "ratio" ? value.mul(100) : value;
  const rounded = shown.toSignificantDigits(8);
  const unit = metric.unit === "ratio" ? "%" : metric.unit === "R" ? "R" : metric.currency ? ` ${metric.currency}` : "";
  return `${rounded.eq(shown) ? "" : "≈"}${rounded.toFixed()}${unit}`;
}

function Value({ metric }: { metric: Metric }) {
  if (metric.value === null) return <span className="recall-actual-missing" title={metric.reason ?? undefined}>{formatRecallActualMetricValue(metric)}</span>;
  return <span title={`${metric.value}${metric.currency ? ` ${metric.currency}` : ""}`}>{formatRecallActualMetricValue(metric)}</span>;
}

export type RecallActualMetricsPanelProps = {
  metrics: RecallActualMetrics | null;
  phase: RecallPhase;
  retained?: boolean;
  /** Show only the trusted headline values; the complete metric set stays in details. */
  compact?: boolean;
};

export function RecallActualMetricsPanel({ metrics, phase, retained = false, compact = false }: RecallActualMetricsPanelProps) {
  if (phase === "pre-entry") return null;
  const sectionClassName = compact ? "recall-actual-metrics recall-actual-metrics--compact" : "recall-actual-metrics";
  if (!metrics) return <section className={sectionClassName} aria-label="实际结果"><h3>实际结果</h3><p>该快照未留存统计口径；请新建快照以记录当前结果。</p></section>;
  const episodeOpen = metrics.metrics.netPnl.value === null && metrics.metrics.netPnl.reason === "episode-open";
  const keys = compact
    ? phase === "holding"
      ? ["remainingQuantity", "realizedNet", "unrealizedGross"] as const
      : episodeOpen
        ? ["realizedNet", "unrealizedGross", "netPnl", "actualR"] as const
        : ["netPnl", "actualR"] as const
    : phase === "holding"
      ? ["remainingQuantity", "averageEntryPrice", "realizedNet", "unrealizedGross"] as const
      : episodeOpen
        ? ["remainingQuantity", "averageEntryPrice", "weightedExitPrice", "realizedNet", "unrealizedGross", "netPnl", "actualR"] as const
        : ["averageEntryPrice", "weightedExitPrice", "netPnl", "actualR"] as const;
  const labels: Record<keyof RecallActualMetrics["metrics"], string> = {
    remainingQuantity: "剩余数量", averageEntryPrice: "实际入场均价", weightedExitPrice: "加权退出均价",
    realizedGross: "已实现毛盈亏", realizedNet: "已实现净盈亏", unrealizedGross: "持仓浮盈亏（未扣费）",
    remainingEntryFee: "剩余入场费用", totalFees: "已揭示费用", netPnl: "回合净盈亏", actualR: "实际 R",
    entryPriceDeviation: "入场偏差（正值更不利）", quantityDeviation: "初始执行量偏差", targetRealization: "目标利润兑现（净／毛）",
  };
  return <section className={sectionClassName} aria-label="实际结果">
    <h3>{phase === "holding" ? "当前执行" : "实际结果"}</h3>
    <p>{retained ? "留存版本" : "按当前已知成交计算"} · 原币口径</p>
    <dl>{keys.map(key => <div key={key}><dt>{labels[key]}</dt><dd><Value metric={metrics.metrics[key]} /></dd></div>)}</dl>
    {metrics.denominator && <p className="recall-actual-risk">{metrics.denominator.method === "fixed-budget" ? "预算 R" : "价格风险 R"} · 冻结分母 {metrics.denominator.amount} {metrics.denominator.currency}</p>}
    <details><summary>费用、计划偏差与退出明细</summary>
      <dl>{(["realizedGross", "totalFees", "remainingEntryFee", "entryPriceDeviation", "quantityDeviation", "targetRealization"] as const).map(key => <div key={key}><dt>{labels[key]}</dt><dd><Value metric={metrics.metrics[key]} /></dd></div>)}</dl>
      {metrics.exitAllocations.map((exit, index) => <div className="recall-actual-exit" key={exit.executionId}>
        <strong>退出 {index + 1} · 数量 {exit.quantity}</strong>
        <dl><div><dt>分配入场费</dt><dd><Value metric={exit.entryFee} /></dd></div><div><dt>本次退出费</dt><dd><Value metric={exit.exitFee} /></dd></div><div><dt>本次净盈亏</dt><dd><Value metric={exit.netPnl} /></dd></div></dl>
      </div>)}
      <p className="recall-actual-source">口径 {metrics.methodVersion} · 文档修订 {metrics.source.documentRevision}。盈亏不自动评价执行质量。</p>
    </details>
  </section>;
}
