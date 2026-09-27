import Decimal from "decimal.js";

import type { CurrentPortfolioModel, PortfolioCoverage } from "../../lib/reviews/trading-room-portfolio";
import {
  type RoomDisplayCurrency,
  type RoomMoneyView,
} from "../../lib/reviews/trading-room-scope";
import styles from "./room-portfolio-summary.module.css";

export type RoomPortfolioSummaryProps = {
  model: CurrentPortfolioModel;
  reportCurrency?: RoomDisplayCurrency;
  dailyPnl?: RoomMoneyView;
  dailyPnlReason?: string;
  /** Independent KPI projection supplied by the current-day history point. */
  dailyReturnPercent?: string | null;
  dailyReturnPercentAvailable?: boolean;
  dailyReturnPercentReasons?: readonly string[];
  /** Compatibility aliases for callers that use the library's percent name. */
  dailyPnlPercent?: string | null;
  dailyPnlPercentAvailable?: boolean;
  dailyPnlPercentReason?: string | null;
};

function format(value: string | null | undefined, signed = false) {
  if (value === null || value === undefined) return "暂不可用";
  try {
    const number = new Decimal(value);
    return `${signed && number.gt(0) ? "+" : ""}${number.toFixed(2)}`;
  } catch {
    return "暂不可用";
  }
}

function targetValue(view: RoomMoneyView, currency: Exclude<RoomDisplayCurrency, "original">): string | null {
  if (view.targetCurrency === currency || view.converted !== undefined) return view.targetCurrency === currency ? view.converted ?? null : currency === "HKD" ? view.convertedHkd ?? null : view.convertedCny;
  return currency === "HKD" ? view.convertedHkd ?? null : view.convertedCny;
}

function money(view: RoomMoneyView, currency: RoomDisplayCurrency, signed = false) {
  if (currency !== "original") {
    const value = targetValue(view, currency);
    return value === null ? "暂不可用" : `${currency} ${format(value, signed)}`;
  }
  return Object.entries(view.originalByCurrency)
    .map(([code, value]) => `${code} ${format(value, signed)}`)
    .join(" / ") || "暂不可用";
}

function scalarValues(view: RoomMoneyView, currency: RoomDisplayCurrency): string[] {
  if (currency !== "original") {
    const value = targetValue(view, currency);
    return value === null ? [] : [value];
  }
  return Object.values(view.originalByCurrency);
}

function coverageLabel(coverage: PortfolioCoverage) {
  return `${coverage.complete ? "完整覆盖" : "可用小计"} ${coverage.available}/${coverage.total} 个仓位`;
}

function shortDates(text: string) {
  return text.replace(/(\d{4}-\d{2}-\d{2})T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})/g, "$1");
}

function noteLabel(view: RoomMoneyView): string {
  return shortDates(noteTitle(view));
}

function noteTitle(view: RoomMoneyView): string {
  return view.note.replace(/按最新汇率估算为[A-Z]+/, "按最新汇率估算");
}

function typeBreakdown(model: CurrentPortfolioModel): string {
  const counts = { stock: new Set<string>(), etf: new Set<string>(), unknown: new Set<string>() };
  model.rows.forEach((row, index) => {
    const identity = row.holding.instrumentId || row.holding.episodeId || String(index);
    if (row.holding.assetType === "stock") counts.stock.add(identity);
    else if (row.holding.assetType === "etf") counts.etf.add(identity);
    else counts.unknown.add(identity);
  });
  const count = (value: Set<string>) => value.size;
  return `股票 ${count(counts.stock)} · ETF ${count(counts.etf)} · 类型待核对 ${count(counts.unknown)}`;
}

function percentLabel(
  value: string | null | undefined,
  available: boolean | undefined,
): string {
  return available && value !== null && value !== undefined ? `${format(value, true)}%` : "暂不可用";
}

function dailyReasonFor(
  reportCurrency: RoomDisplayCurrency,
  view: RoomMoneyView | undefined,
  reason: string,
): string {
  const hasOriginalValue = Boolean(view && Object.keys(view.originalByCurrency).length > 0);
  return reportCurrency === "original" && hasOriginalValue && /无法换算|汇率不足|换算/.test(reason)
    ? "按原币显示"
    : reason;
}

export function RoomPortfolioSummary({
  model,
  reportCurrency = "original",
  dailyPnl,
  dailyPnlReason,
  dailyReturnPercent,
  dailyReturnPercentAvailable,
  dailyReturnPercentReasons,
  dailyPnlPercent,
  dailyPnlPercentAvailable,
  dailyPnlPercentReason,
}: RoomPortfolioSummaryProps) {
  const dailyReason = dailyReasonFor(reportCurrency, dailyPnl, dailyPnlReason ?? dailyPnl?.note ?? "缺少可核对的前收盘估值，当日盈亏暂不可用");
  const dailyBrief = dailyReason.length > 20 ? `${dailyReason.slice(0, 18)}…` : dailyReason;
  const percentValue = dailyReturnPercent ?? dailyPnlPercent;
  const percentAvailable = dailyReturnPercentAvailable ?? dailyPnlPercentAvailable ?? (percentValue !== null && percentValue !== undefined);
  const percentReason = dailyReturnPercentReasons?.join("；") || dailyPnlPercentReason || (percentAvailable ? "当日盈亏百分比" : "当日盈亏百分比暂不可用");
  const hasShort = model.rows.some(row => row.holding.direction === "short");
  const tone = (view: RoomMoneyView) => {
    const values = scalarValues(view, reportCurrency);
    const valid = values.filter(value => {
      try { return new Decimal(value).isFinite(); } catch { return false; }
    });
    return valid.some(value => new Decimal(value).gt(0)) && valid.every(value => new Decimal(value).gte(0)) ? styles.gain
      : valid.some(value => new Decimal(value).lt(0)) && valid.every(value => new Decimal(value).lte(0)) ? styles.loss : undefined;
  };
  return <section aria-label="当前持仓概览" className={styles.summary}>
    <div className={styles.cards}>
      <div className={styles.card}>
        <span>{hasShort ? "持仓净市值" : "持仓市值"}</span>
        <strong>{money(model.marketValue, reportCurrency)}</strong>
        <small title={coverageLabel(model.coverage.marketValue)}>估值 {model.coverage.marketValue.available}/{model.coverage.marketValue.total}{model.coverage.marketValue.complete ? " · 完整覆盖" : " · 部分估值"}</small>
        <small title={coverageLabel(model.coverage.cost)}>成本 {money(model.cost, reportCurrency)}{model.coverage.cost.complete ? "" : " · 可用小计"}</small>
      </div>
      <div className={styles.card}>
        <span>未实现盈亏</span>
        <strong className={tone(model.unrealizedPnl)}>{money(model.unrealizedPnl, reportCurrency, true)}</strong>
        <small title={coverageLabel(model.coverage.unrealizedPnl)}>盈亏 {model.coverage.unrealizedPnl.available}/{model.coverage.unrealizedPnl.total}{model.coverage.unrealizedPnl.complete ? " · 完整覆盖" : " · 可用小计"}</small>
        <small title="未实现收益率以剩余多头成本为分母">收益率 {model.unrealizedReturnPercent === null ? "暂不可用" : `${format(model.unrealizedReturnPercent, true)}%`}</small>
      </div>
      <div className={styles.card}>
        <span>当日盈亏</span>
        <strong className={dailyPnl ? tone(dailyPnl) : undefined}>{dailyPnl ? money(dailyPnl, reportCurrency, true) : "暂不可用"}</strong>
        <small title={dailyReason}>{dailyBrief}</small>
        <small title={percentReason}>当日百分比 <b aria-label={percentAvailable ? `当日盈亏百分比 ${percentLabel(percentValue, percentAvailable)}` : `当日盈亏百分比暂不可用：${percentReason}`}>{percentLabel(percentValue, percentAvailable)}</b></small>
      </div>
      <div className={styles.card}>
        <span>持仓标的数</span>
        <strong>{model.count}</strong>
        <small>{typeBreakdown(model)}</small>
      </div>
    </div>
    <div className={styles.context}>
      <p className={styles.note}>估值截点：{shortDates(model.asOf)}</p>
      {reportCurrency !== "original" && <p className={styles.note} title={noteTitle(model.marketValue)}>{noteLabel(model.marketValue)}</p>}
    </div>
    {model.empty && <p className={styles.note}>当前空仓</p>}
    <details className={styles.details}><summary>核对估值组成与覆盖</summary>
      <p className={styles.note}>{model.basis}</p>
      <p className={styles.note}>当日依据：{dailyReason}</p>
      <p className={styles.note}>市值：{coverageLabel(model.coverage.marketValue)}；成本：{coverageLabel(model.coverage.cost)}；盈亏：{coverageLabel(model.coverage.unrealizedPnl)}</p>
      <div className={styles.scroll}><table><thead><tr><th>标的 / 账户</th><th>数量</th><th>行情日期</th><th>原币净市值</th><th>剩余成本</th><th>未实现盈亏</th><th>收益率 / 原因</th></tr></thead>
        <tbody>{model.rows.map((row, index) => <tr key={row.holding.episodeId ?? `${row.holding.instrumentId ?? row.holding.instrumentName ?? "row"}:${row.holding.accountId ?? row.holding.accountLabel ?? index}`}>
          <td>{row.holding.instrumentName} · {row.holding.accountLabel}</td><td>{row.holding.quantity ?? "待核对"}</td>
          <td>{row.holding.quote?.quoteDate ?? "无行情"}</td>
          <td>{row.marketValue === null ? "暂不可用" : `${row.holding.settlementCurrency} ${format(row.marketValue)}`}</td>
          <td>{row.cost === null ? "暂不可用" : `${row.holding.settlementCurrency} ${format(row.cost)}`}</td>
          <td>{row.unrealizedPnl === null ? "暂不可用" : `${row.holding.settlementCurrency} ${format(row.unrealizedPnl, true)}`}</td>
          <td>{row.unrealizedReturnPercent == null ? "暂不可用" : `${format(row.unrealizedReturnPercent, true)}%`}{(row.reasons ?? []).length > 0 && <small>{(row.reasons ?? []).join("；")}；请在持仓明细核对证据或更新行情</small>}</td>
        </tr>)}</tbody></table></div>
    </details>
  </section>;
}
