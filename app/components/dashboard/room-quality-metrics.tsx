"use client";

import { useMemo } from "react";

import { buildTradeQualitySummary, type TradeQualityCurrencySummary } from "../../lib/reviews/trading-room-metrics";
import type { RoomFxSnapshot, TradingRoomRow } from "../../lib/reviews/trading-room-scope";
import styles from "./room-quality-metrics.module.css";

export type RoomQualityMetricsProps = { rows: readonly TradingRoomRow[]; fxSnapshot?: RoomFxSnapshot };

function display(value: string | null, reason: string | null): string {
  if (value !== null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) : "不可计算";
  }
  return reason ?? "不可计算";
}

function CurrencyMetrics({ summary, estimate = false }: { summary: TradeQualityCurrencySummary; estimate?: boolean }) {
  return (
    <section className={styles.currency} aria-label={`${summary.currency}收益质量`}>
      <h3>{summary.currency}{estimate ? "（人民币估算）" : ""}</h3>
      <dl>
        <div><dt>平均盈利</dt><dd>{display(summary.averageWin, "无盈利样本")}</dd></div>
        <div><dt>平均亏损（绝对值）</dt><dd>{display(summary.averageLoss, "无亏损样本")}</dd></div>
        <div><dt>平均盈亏比</dt><dd>{display(summary.payoffRatio, summary.payoffReason)}</dd></div>
        <div><dt>利润因子</dt><dd>{display(summary.profitFactor, summary.profitFactorReason)}</dd></div>
      </dl>
      <p>{summary.wins} 胜 · {summary.losses} 负 · {summary.breakEven} 平 · {summary.sampleCount} 个可信回合</p>
    </section>
  );
}

export function RoomQualityMetrics({ rows, fxSnapshot }: RoomQualityMetricsProps) {
  const summary = useMemo(() => buildTradeQualitySummary(rows, fxSnapshot), [fxSnapshot, rows]);
  return (
    <details className={styles.panel} data-testid="room-quality-metrics">
      <summary>收益质量详情</summary>
      <div className={styles.content}>
        <p className={styles.note}>仅使用同一批可信已平仓回合；持平计入样本数，不计入胜负均值。</p>
        {summary.currencies.length === 0 ? <p className={styles.empty}>当前没有可用的可信回合样本。</p> : summary.comparable && summary.currencies.length > 1
          ? <CurrencyMetrics summary={{ ...summary, currency: "CNY" }} estimate />
          : summary.currencies.map(item => <CurrencyMetrics key={item.currency} summary={item} />)}
        {summary.currencies.length > 1 && !summary.comparable && <p className={styles.note}>汇率快照不完整，无法合计跨币种结果，以下按原币分别计算。</p>}
        {summary.comparable && summary.currencies.length > 1 && fxSnapshot && <p className={styles.note}>人民币估算按 {fxSnapshot.source} 汇率（{fxSnapshot.asOf}）计算。</p>}
        {summary.excludedCount > 0 && <p className={styles.note}>另有 {summary.excludedCount} 个回合因数据证据不足而排除。</p>}
      </div>
    </details>
  );
}
