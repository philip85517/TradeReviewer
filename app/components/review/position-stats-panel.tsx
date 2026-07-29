import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";

type Props = {
  instrumentLabel: string;
  currency: string;
  metrics: PositionPathMetrics;
  plan: EpisodeReviewRecord["plan"] | undefined;
};

function amount(value: string | null | undefined, currency: string, signed = false) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...(signed ? { signDisplay: "always" as const } : {}),
  }).format(number);
}

function percentage(value: string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

function duration(milliseconds: number | null) {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return "—";
  const hours = milliseconds / (60 * 60 * 1000);
  if (hours < 48) return `${Number(hours.toFixed(1))} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

function rMultiple(value: string | null) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}R`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="position-stat"><dt>{label}</dt><dd>{value}</dd>{detail && <small>{detail}</small>}</div>;
}

export function PositionStatsPanel({
  instrumentLabel,
  currency,
  metrics,
  plan,
}: Props) {
  const reason = metrics.unavailableReason;
  const current = metrics.current;
  const currentAvailable = [
    current.quantity,
    current.grossCapitalDeployed,
    current.realizedPnl,
    current.fees,
  ].some((value) => Number(value) !== 0);
  const currentValue = (value: string, format: (input: string) => string) =>
    currentAvailable ? format(value) : "—";
  const path = (value: PositionPathMetrics["mfe"]) => ({
    value: amount(value?.amount, currency, true),
    detail: value?.percent === null || value === null ? reason : percentage(value.percent),
  });
  const missingPlanReason = "复盘计划尚未填写。";
  return (
    <section className="position-stats-panel" aria-label={`${instrumentLabel} 路径统计`}>
      <header><span className="eyebrow">Position path</span><h2>仓位统计</h2><span>{instrumentLabel}</span></header>
      <section aria-labelledby="current-state-heading"><h3 id="current-state-heading">当前状态</h3><dl>
        <Metric label="持仓数量" value={currentAvailable ? current.quantity : "—"} detail={currentAvailable ? undefined : reason} />
        <Metric label="平均成本" value={currentValue(current.averageCost, (value) => amount(value, currency))} detail={currentAvailable ? undefined : reason} />
        <Metric label="已实现盈亏" value={currentValue(current.realizedPnl, (value) => amount(value, currency, true))} detail={currentAvailable ? undefined : reason} />
        <Metric label="浮动盈亏" value={currentValue(current.unrealizedPnl, (value) => amount(value, currency, true))} detail={currentAvailable ? undefined : reason} />
        <Metric label="当前净盈亏" value={currentValue(current.netPnl, (value) => amount(value, currency, true))} detail={currentAvailable ? undefined : reason} />
        <Metric label="收益率" value={currentValue(current.returnPercent, percentage)} detail={currentAvailable ? undefined : reason} />
        <Metric label="累计费用" value={currentValue(current.fees, (value) => amount(value, currency))} detail={currentAvailable ? undefined : reason} />
        <Metric label="持仓时长" value={duration(metrics.holdingMilliseconds)} detail={metrics.holdingMilliseconds === null ? reason : undefined} />
      </dl></section>
      <section aria-labelledby="path-risk-heading"><h3 id="path-risk-heading">路径风险</h3><dl>
        <Metric label="最大盈利（MFE）" {...path(metrics.mfe)} />
        <Metric label="最大亏损（MAE）" {...path(metrics.mae)} />
        <Metric label="最大回撤" {...path(metrics.maximumDrawdown)} />
        <Metric label="盈利回吐" {...path(metrics.profitGiveback)} />
      </dl></section>
      <section aria-labelledby="plan-comparison-heading"><h3 id="plan-comparison-heading">计划对比</h3><dl>
        <Metric label="计划风险" value={amount(plan?.plannedRiskAmount, currency)} detail={plan?.plannedRiskAmount ? undefined : missingPlanReason} />
        <Metric label="当前 R 倍数" value={rMultiple(metrics.rMultiple)} detail={metrics.rMultiple === null ? reason : undefined} />
        <Metric label="失效条件" value={plan?.invalidationCondition || "—"} detail={plan?.invalidationCondition ? undefined : missingPlanReason} />
        <Metric label="目标区间" value={plan?.targetRange || "—"} detail={plan?.targetRange ? undefined : missingPlanReason} />
      </dl></section>
    </section>
  );
}
