"use client";

import { useState } from "react";
import Decimal from "decimal.js";

import type { CashSummary, CashSummaryStatus } from "../../lib/cash/cash-model";
import {
  buildRoomAllocation,
  type RoomAllocationGroup,
  type RoomAllocationItem,
  type RoomAllocationOptions,
} from "../../lib/reviews/trading-room-allocation";
import type { CurrentPortfolioModel } from "../../lib/reviews/trading-room-portfolio";
import type { TradingRoomQualityDimensionId } from "../../lib/reviews/trading-room-quality";
import {
  type RoomDisplayCurrency,
  type RoomFxSnapshot,
  type RoomMoneyView,
  type RoomTargetCurrency,
} from "../../lib/reviews/trading-room-scope";
import styles from "./room-allocation.module.css";
import { RoomValuationDiagnostics } from "./room-valuation-diagnostics";

const colors = ["#3797ff", "#29c9af", "#efac65", "#a484ef", "#71829e"];
const dimensions = [["market", "按市场"], ["assetType", "按资产类型"]] as const;

export type RoomAllocationProps = {
  model: CurrentPortfolioModel;
  /** Whether the empty state represents all holdings or the selected market. */
  scope?: "overall" | "market";
  reportCurrency?: RoomDisplayCurrency;
  targetCurrency?: RoomTargetCurrency;
  fxSnapshot?: RoomFxSnapshot;
  cashSummary?: CashSummary | null;
  cashBaselineDetails?: readonly CashBaselineDisplayDetail[];
  cashScopeLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetryValuation?: () => void;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
};

export type CashBaselineDisplayDetail = {
  accountId: string;
  accountLabel?: string;
  currency: string;
  balance: string;
  asOf: string | null;
  source: string;
  revision: number;
  coverage: "available" | "partial" | "unavailable" | string;
};

const fixed = (value: string | null, signed = false) => {
  if (value === null) return "不可用";
  try {
    const number = new Decimal(value);
    const [whole, fraction] = number.toFixed(2).split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${signed && number.gt(0) ? "+" : ""}${grouped}.${fraction}`;
  } catch {
    return "不可用";
  }
};

function amountLabel(view: RoomMoneyView, currency: RoomDisplayCurrency, status?: CashSummaryStatus): string {
  if (status === "zero") {
    if (currency !== "original" && (view.targetCurrency === currency || view.targetCurrency === undefined)) return `${currency} 0.00`;
    const originalCurrency = Object.keys(view.originalByCurrency)[0];
    return originalCurrency ? `${originalCurrency} 0.00` : "0.00";
  }
  if (currency !== "original") {
    const value = view.targetCurrency === currency
      ? view.converted ?? null
      : currency === "HKD" ? view.convertedHkd ?? null : view.convertedCny;
    if (value !== null) return `${currency} ${fixed(value)}`;
    const originals = Object.entries(view.originalByCurrency);
    return originals.length > 0 ? originals.map(([code, amount]) => `${code} ${fixed(amount)}（原币）`).join(" · ") : "暂不可用";
  }
  const values = Object.entries(view.originalByCurrency);
  return values.length > 0 ? values.map(([code, value]) => `${code} ${fixed(value)}`).join(" · ") : "暂不可用";
}

function cashStatusLabel(status: CashSummaryStatus): string {
  switch (status) {
    case "available": return "可核对";
    case "zero": return "今日无卖出回款";
    case "partial": return "部分覆盖";
    default: return "暂不可用";
  }
}

function cashCoverageLabel(coverage: CashBaselineDisplayDetail["coverage"]): string {
  if (coverage === "available") return "完整覆盖";
  if (coverage === "partial") return "部分覆盖";
  if (coverage === "unavailable") return "暂不可用";
  return coverage;
}

function cashAsOfLabel(value: string | null): string {
  if (!value) return "日期未提供";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return `${parsed.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function valuationCutoffLabel(value: string | null | undefined): string {
  if (!value) return "未知";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
  }).formatToParts(parsed).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName ?? "UTC"}`;
}

function itemAmount(item: RoomAllocationItem): string {
  return item.amount === null ? "不可用" : fixed(item.amount, item.amount.startsWith("-"));
}

function Donut({ group }: { group: RoomAllocationGroup }) {
  const amount = group.netValue === null ? "不可用" : `${group.currency} ${fixed(group.netValue)}`;
  return <div className={styles.donutWrap}>
    <svg className={`${styles.donut} donut`} data-testid="allocation-donut" viewBox="4 4 152 152" role="img" aria-label={`${group.currency} ${amount} 总市值`}>
      <circle cx="80" cy="80" r="67" fill="none" stroke="#20334e" strokeWidth="18" />
      {group.items.map((item, index) => {
        const share = Number(item.percent ?? 0);
        const currentOffset = group.items.slice(0, index).reduce((sum, previous) => sum + Number(previous.percent ?? 0), 0);
        return <circle key={item.label} cx="80" cy="80" r="67" fill="none"
          stroke={colors[index % colors.length]} strokeWidth="18" pathLength="100"
          strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-currentOffset}
          transform="rotate(-90 80 80)" />;
      })}
      <text x="80" y="75" textAnchor="middle" className={styles.donutValue}>{amount}</text>
      <text x="80" y="92" textAnchor="middle" className={styles.donutCaption}>总市值</text>
    </svg>
  </div>;
}

function SignedBars({ group }: { group: RoomAllocationGroup }) {
  return <div className={styles.signedChart} aria-label={`${group.currency} 多空总敞口 ${fixed(group.denominator)}`}>
    <strong>{group.currency} {group.netValue === null ? "不可用" : fixed(group.netValue, true)}</strong>
    <span>净市值</span>
    <div className={styles.zeroAxis} aria-hidden="true" />
    <small>总敞口 {group.currency} {fixed(group.denominator)}；多空占比按绝对市值计算</small>
  </div>;
}

function SignedSubtotal({ group }: { group: RoomAllocationGroup }) {
  return <div className={styles.signedChart} aria-label={`${group.currency} 多空净市值小计`}>
    <strong>{group.currency} {group.netValue === null ? "不可用" : fixed(group.netValue, true)}</strong>
    <span>净市值小计</span>
    <small>保留可信多头/空头金额；当前覆盖不足，比例图暂不可用</small>
  </div>;
}

function LegendItem({ item, index, signed, showRatios, showCoverage }: { item: RoomAllocationItem; index: number; signed: boolean; showRatios: boolean; showCoverage: boolean }) {
  return <li className={styles.legendItem}>
    <div className={styles.legendHeading}>
      <span><i style={{ background: colors[index % colors.length] }} />{item.label}</span>
      <strong>{itemAmount(item)}</strong>
      {showRatios && <span>{item.percent === null ? "—" : `${fixed(item.percent, item.percent.startsWith("-"))}%`}</span>}
    </div>
    {signed && <div className={styles.sideValues}>
      <span className={styles.positiveText}>多头 {item.longAmount === null ? "—" : `+${fixed(item.longAmount)}`} {item.longPercent === null ? "" : `(+${fixed(item.longPercent)}%)`}</span>
      <span className={styles.negativeText}>空头 {item.shortAmount === null ? "—" : fixed(item.shortAmount, true)} {item.shortPercent === null ? "" : `(${fixed(item.shortPercent, true)}%)`}</span>
      {showRatios && <div className={styles.barTrack} aria-hidden="true">
        <b className={styles.positiveBar} style={{ width: `${Math.min(50, Math.abs(Number(item.longPercent ?? 0)) / 2)}%` }} />
        <b className={styles.negativeBar} style={{ width: `${Math.min(50, Math.abs(Number(item.shortPercent ?? 0)) / 2)}%` }} />
      </div>}
    </div>}
    {showCoverage && <small>{item.available === item.total ? "完整覆盖" : "可用小计"} {item.available}/{item.total} 个仓位</small>}
  </li>;
}

function CashField({ label, description, view, status, reportCurrency }: {
  label: string;
  description?: string;
  view: RoomMoneyView;
  status: CashSummaryStatus;
  reportCurrency: RoomDisplayCurrency;
}) {
  const display = amountLabel(view, reportCurrency, status);
  const unavailable = status === "unavailable" || display === "暂不可用";
  return <div className={styles.cashField}>
    <span>{label}</span>
    <strong className={unavailable ? styles.mutedValue : undefined}>{display}</strong>
    {description && <small>{description}</small>}
    <small>{cashStatusLabel(status)}</small>
  </div>;
}

function CashStrip({ summary, reportCurrency, cashBaselineDetails, cashScopeLabel, loading, error }: {
  summary: CashSummary | null | undefined;
  reportCurrency: RoomDisplayCurrency;
  cashBaselineDetails?: readonly CashBaselineDisplayDetail[];
  cashScopeLabel?: string;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) return <div className={styles.cashStrip} aria-label="现金状态">{cashScopeLabel && <small>{cashScopeLabel}</small>}<p className={styles.cashMessage}>现金数据加载中…</p></div>;
  if (error) return <div className={styles.cashStrip} aria-label="现金状态">{cashScopeLabel && <small>{cashScopeLabel}</small>}<p className={styles.cashMessage}>{`现金数据读取失败：${error}`}</p></div>;
  if (!summary) return <div className={styles.cashStrip} aria-label="现金状态">{cashScopeLabel && <small>{cashScopeLabel}</small>}<p className={styles.cashMessage}>现金数据暂不可用</p></div>;
  return <div className={styles.cashStrip} aria-label="现金状态">
    {cashScopeLabel && <small>{cashScopeLabel}</small>}
    <CashField label="今日卖出回款" view={summary.todayProceeds} status={summary.todayProceedsStatus} reportCurrency={reportCurrency} />
    <CashField label="参考现金" description="基准+股票/ETF成交变化" view={summary.cashTotal} status={summary.cashTotalStatus} reportCurrency={reportCurrency} />
    {summary.asOf && <span className={styles.cashAsOf}>现金基准截至 {cashAsOfLabel(summary.asOf)}</span>}
    {cashBaselineDetails && cashBaselineDetails.length > 0 && <details className={styles.cashDetails} role="group" aria-label="现金基准详情">
      <summary>查看基准详情（{cashBaselineDetails.length} 条）</summary>
      <ul>
        {cashBaselineDetails.map((detail) => <li key={`${detail.accountId}:${detail.currency}`}>
          <strong>{detail.accountLabel ?? detail.accountId}</strong>
          <span>{detail.currency} {detail.balance} · 截至 {cashAsOfLabel(detail.asOf)} · 来源 {detail.source} · 版本 {detail.revision} · {cashCoverageLabel(detail.coverage)}</span>
        </li>)}
      </ul>
    </details>}
  </div>;
}

export function RoomAllocation({
  model,
  scope = "overall",
  reportCurrency = "original",
  targetCurrency,
  fxSnapshot,
  cashSummary,
  cashBaselineDetails,
  cashScopeLabel = "全账户范围（当前账户筛选）",
  loading,
  error,
  onRetryValuation,
  onOpenDataCheck,
}: RoomAllocationProps) {
  const [dimension, setDimension] = useState<RoomAllocationOptions["dimension"]>("market");
  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>();
  const availableCurrencies = [...new Set(model.rows.map(row => row.holding.settlementCurrency?.trim().toUpperCase() || "币种待核对"))]
    .sort((left, right) => {
      const order = ["CNY", "HKD", "USD"];
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex) || left.localeCompare(right);
    });
  const effectiveSelectedCurrency = reportCurrency === "original"
    ? selectedCurrency && availableCurrencies.includes(selectedCurrency) ? selectedCurrency : availableCurrencies[0]
    : undefined;
  const allocation = buildRoomAllocation(model, { dimension, reportCurrency, targetCurrency, fxSnapshot, selectedCurrency: effectiveSelectedCurrency });
  const group = allocation.groups[0];
  const showRatios = Boolean(group?.complete && group.denominator && new Decimal(group.denominator).gt(0));
  return (
    <section className={styles.panel} aria-label="当前持仓资产分布">
      <header className={styles.header}>
        <h3>资产分布（持仓市值）</h3>
        <div className={styles.tabs} role="tablist" aria-label="资产分布维度">
          {dimensions.map(([value, label]) => <button type="button" key={value} aria-pressed={dimension === value} onClick={() => setDimension(value)}>{label}</button>)}
        </div>
      </header>
      {reportCurrency === "original" && allocation.currencies.length > 1 && <div className={styles.currencyTabs} role="tablist" aria-label="分布原币">
        {allocation.currencies.map(currency => <button type="button" role="tab" key={currency} aria-selected={allocation.selectedCurrency === currency} onClick={() => setSelectedCurrency(currency)}>{currency}</button>)}
      </div>}
      <p className={styles.note}>{allocation.empty ? "暂无可信持仓市值" : <><span>{group?.complete ? "完整覆盖" : "可用小计"} {group?.available ?? allocation.available}/{group?.total ?? allocation.total} 个仓位 · 估值截点 </span><time dateTime={allocation.asOf ?? undefined} title={allocation.asOf ?? undefined}>{valuationCutoffLabel(allocation.asOf)}</time></>}</p>
      {allocation.empty && <p className={styles.empty}>{scope === "market" ? "当前市场暂无持仓，暂无资产分布" : "当前空仓，暂无资产分布"}</p>}
      {group && <div className={styles.distributionBody}>
        <div className={styles.chartColumn}>
          {group.signed ? showRatios ? <SignedBars group={group} /> : <SignedSubtotal group={group} /> : showRatios ? <Donut group={group} /> : <div className={styles.unavailableSummary}><strong>{group.currency} {group.netValue === null ? "不可用" : fixed(group.netValue)}</strong><span>已知市值小计</span><small>覆盖 {group.available}/{group.total} 个仓位 · 比例暂不可用</small></div>}
        </div>
        <div className={styles.legend}>
          <strong className={styles.legendTitle}>{group.currency} {group.signed ? "多空分布" : "持仓分布"}</strong>
          <ul>{group.items.map((item, index) => <LegendItem key={item.label} item={item} index={index} signed={group.signed} showRatios={showRatios} showCoverage={!group.complete} />)}</ul>
        </div>
      </div>}
      {reportCurrency === "original" && !allocation.globalComplete && <div className={styles.gapNote}>
        <span>全卡缺口：{allocation.globalNote}</span>
      </div>}
      {group && (!group.complete || group.signed || group.currency === "币种待核对") && <div className={styles.note}>
        <span>{group.complete ? "完整覆盖" : `可用小计，比例不可用 · 覆盖 ${group.available}/${group.total} 个仓位`}</span>
        {group.signed && <span>{group.complete
          ? "空头以负条形表示，比例分母为多空绝对市值总敞口"
          : "空头保留负号，多空可信小计分开"}</span>}
      </div>}
      <RoomValuationDiagnostics
        model={model}
        cashSummary={cashSummary}
        additionalReasons={allocation.globalMissingReasons}
        onRetryValuation={onRetryValuation}
        onOpenDataCheck={onOpenDataCheck}
      />
      <CashStrip summary={cashSummary} reportCurrency={reportCurrency} cashBaselineDetails={cashBaselineDetails} cashScopeLabel={cashScopeLabel} loading={loading} error={error} />
    </section>
  );
}
