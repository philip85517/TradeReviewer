"use client";

import type { CostReturnExclusionReason, CostReturnSummary, MonthlyWinRateSummary } from "../../lib/reviews/trading-room-metrics";
import styles from "./room-quality.module.css";

export type RoomQualityProps = {
  /** The summary is passed in so later dashboard consumers can reuse costReturn directly. */
  costReturn: CostReturnSummary;
  monthlyWinRate: MonthlyWinRateSummary;
};

const exclusionLabels: Record<CostReturnExclusionReason, string> = {
  "not-closed": "回合未完整平仓",
  "short-or-unknown-direction": "做空或方向未知",
  "pnl-unavailable": "净盈亏不可用",
  "unknown-fees": "费用未知",
  "history-incomplete": "历史证据不完整",
  "settlement-currency-mismatch": "结算币种不一致",
  "incomplete-cost-evidence": "成本证据不完整",
  "invalid-cost": "成本金额无效",
  "unknown-asset": "资产类型未知",
};

function decimal(value: string | null): string {
  if (value === null) return "不可用";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString("zh-CN", { maximumFractionDigits: 8 })
    : "不可用";
}

function percent(value: string | null): string {
  return value === null ? "不可计算" : `${decimal(value)}%`;
}

function originalMoney(value: Record<string, string>): string {
  const entries = Object.entries(value);
  return entries.length === 0
    ? "暂无可信原币金额"
    : entries.map(([currency, amount]) => `${currency} ${decimal(amount)}`).join(" · ");
}

function exclusionLabel(reason: string): string {
  return exclusionLabels[reason as CostReturnExclusionReason] ?? reason;
}

function CostReturnOverview({ summary, monthlyWinRate }: { summary: CostReturnSummary; monthlyWinRate: MonthlyWinRateSummary }) {
  return (
    <dl className={styles.overview}>
      <div>
        <dt>交易成本收益率</dt>
        <dd className={summary.costReturnPercent === null ? styles.unavailable : styles.value}>
          {percent(summary.costReturnPercent)}
        </dd>
      </div>
      <div>
        <dt>月胜率（合计）</dt>
        <dd>{percent(monthlyWinRate.ratePercent)}</dd>
      </div>
      <div>
        <dt>样本</dt>
        <dd>{summary.applicableCount} 个适用回合 · {summary.excludedCount} 个排除回合</dd>
      </div>
    </dl>
  );
}

export function RoomQuality({ costReturn, monthlyWinRate }: RoomQualityProps) {
  return (
    <section className={styles.panel} aria-label="收益质量">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Quality</span>
          <h2>收益质量</h2>
          <p>交易成本收益率按完整回合的买入成交成本计算；费用已在净盈亏中扣除。</p>
        </div>
        <span className={styles.badge}>{monthlyWinRate.denominator} 个胜率样本</span>
      </header>

      <CostReturnOverview summary={costReturn} monthlyWinRate={monthlyWinRate} />

      {costReturn.unavailableReason && (
        <p className={styles.notice}>{costReturn.unavailableReason}</p>
      )}

      <details className={styles.details} data-testid="room-quality-details">
        <summary>查看月胜率趋势</summary>
        <div className={styles.content}>
          <div className={styles.moneyGrid}>
            <div>
              <span>原币成本</span>
              <strong>{originalMoney(costReturn.buyCost.originalByCurrency)}</strong>
            </div>
            <div>
              <span>人民币估算成本</span>
              <strong>{costReturn.buyCost.convertedCny === null ? "不可用" : `CNY ${decimal(costReturn.buyCost.convertedCny)}`}</strong>
            </div>
            <div>
              <span>原币净盈亏</span>
              <strong>{originalMoney(costReturn.netPnl.originalByCurrency)}</strong>
            </div>
            <div>
              <span>人民币估算净盈亏</span>
              <strong>{costReturn.netPnl.convertedCny === null ? "不可用" : `CNY ${decimal(costReturn.netPnl.convertedCny)}`}</strong>
            </div>
          </div>

          <section className={styles.trend} aria-label="自然月胜率">
            <div className={styles.subheading}>
              <h3>自然月胜率</h3>
              <span>{percent(monthlyWinRate.ratePercent)} · {monthlyWinRate.wins}/{monthlyWinRate.denominator}</span>
            </div>
            {monthlyWinRate.points.length === 0 ? (
              <p className={styles.empty}>当前范围暂无月份样本。</p>
            ) : (
              <div className={styles.months}>
                {monthlyWinRate.points.map(point => (
                  <article className={styles.month} key={point.month}>
                    <div className={styles.monthHeading}>
                      <strong>{point.month}</strong>
                      <span>{percent(point.ratePercent)}</span>
                    </div>
                    <p>{point.wins}/{point.denominator} 个盈利回合 · {point.coverageLabel}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.exclusions} aria-label="成本排除原因">
            <h3>排除原因</h3>
            {Object.keys(costReturn.exclusionReasons).length === 0 ? (
              <p className={styles.empty}>没有排除样本。</p>
            ) : (
              <ul>
                {Object.entries(costReturn.exclusionReasons).map(([reason, count]) => (
                  <li key={reason}>{exclusionLabel(reason)}：{count} 个</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}
