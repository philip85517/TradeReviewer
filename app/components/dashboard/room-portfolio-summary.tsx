import Decimal from "decimal.js";

import type { CurrentPortfolioModel, PortfolioCoverage } from "../../lib/reviews/trading-room-portfolio";
import {
  type RoomDisplayCurrency,
  type RoomMoneyView,
} from "../../lib/reviews/trading-room-scope";
import styles from "./room-portfolio-summary.module.css";

export type RoomPortfolioSummaryProps = {
  model: CurrentPortfolioModel;
  /** Whether the empty state represents all holdings or the selected market. */
  scope?: "overall" | "market";
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
    const [integer, fraction = "00"] = number.toFixed(2).split(".");
    const negative = integer.startsWith("-");
    const digits = negative ? integer.slice(1) : integer;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formatted = `${negative ? "-" : ""}${grouped}.${fraction}`;
    return `${signed && number.gt(0) ? "+" : ""}${formatted}`;
  } catch {
    return "暂不可用";
  }
}

function targetValue(view: RoomMoneyView, currency: Exclude<RoomDisplayCurrency, "original">): string | null {
  if (view.targetCurrency === currency || view.converted !== undefined) return view.targetCurrency === currency ? view.converted ?? null : currency === "HKD" ? view.convertedHkd ?? null : view.convertedCny;
  return currency === "HKD" ? view.convertedHkd ?? null : view.convertedCny;
}

function moneyLines(view: RoomMoneyView | undefined, currency: RoomDisplayCurrency, signed = false, originalCurrencies?: readonly string[]): string[] {
  if (currency !== "original") {
    const value = view ? targetValue(view, currency) : null;
    return value === null ? ["暂不可用"] : [`${currency} ${format(value, signed)}`];
  }
  const currencyOrder = ["CNY", "HKD", "USD"];
  const entries = (originalCurrencies ?? (view ? Object.keys(view.originalByCurrency) : [])).map(code => [code, view?.originalByCurrency[code] ?? null] as const)
    .sort(([left], [right]) => {
      const leftIndex = currencyOrder.indexOf(left);
      const rightIndex = currencyOrder.indexOf(right);
      return (leftIndex < 0 ? currencyOrder.length : leftIndex) - (rightIndex < 0 ? currencyOrder.length : rightIndex) || left.localeCompare(right);
    });
  return entries.length > 0 ? entries.map(([code, value]) => `${code} ${value === null ? "暂不可用" : format(value, signed)}`) : ["暂不可用"];
}

function subtotalValue(model: CurrentPortfolioModel | undefined, key: "marketValue" | "cost" | "unrealizedPnl", currency: RoomDisplayCurrency): string | null {
  if (!model || currency === "original") return null;
  const subtotal = model.subtotals?.[key];
  return subtotal?.currency === currency ? subtotal.value : null;
}

function scalarValues(view: RoomMoneyView, currency: RoomDisplayCurrency, fallback?: string | null): string[] {
  if (currency !== "original") {
    const value = targetValue(view, currency);
    return value === null ? (fallback === null || fallback === undefined ? [] : [fallback]) : [value];
  }
  return Object.values(view.originalByCurrency);
}

function coverageLabel(coverage: PortfolioCoverage) {
  return `${coverage.complete ? "完整覆盖" : "可用小计"} ${coverage.available}/${coverage.total} 个仓位`;
}

function metricCoverageLabel(metric: "市值" | "未实现盈亏", coverage: PortfolioCoverage): string {
  if (coverage.complete) return `${metric} ${coverage.available}/${coverage.total} · 完整覆盖`;
  return metric === "市值"
    ? `已估值 ${coverage.available}/${coverage.total} 个仓位`
    : `已计算盈亏 ${coverage.available}/${coverage.total} 个仓位`;
}

function displayedCoverage(model: CurrentPortfolioModel, key: "marketValue" | "cost" | "unrealizedPnl", currency: RoomDisplayCurrency): PortfolioCoverage {
  if (currency === "original" || model.subtotals?.[key]?.complete) return model.coverage[key];
  const subtotal = model.subtotals?.[key];
  return subtotal ? { available: subtotal.available, total: subtotal.total, complete: subtotal.complete } : model.coverage[key];
}

function currencyCode(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "人民币" || normalized === "RMB") return "CNY";
  if (normalized === "港币" || normalized === "HK$") return "HKD";
  if (normalized === "美元" || normalized === "US$") return "USD";
  return normalized || "币种待核对";
}

function currencyCoverage(model: CurrentPortfolioModel, key: "marketValue" | "cost" | "unrealizedPnl", currency: string): string {
  const rows = model.rows.filter(row => currencyCode(row.holding.settlementCurrency) === currency);
  const available = rows.filter(row => row[key] !== null).length;
  return `${available}/${rows.length}`;
}

function asOfLabel(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(parsed);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}（UTC+8）`;
}

function currencyUniverse(model: CurrentPortfolioModel, view?: RoomMoneyView): string[] {
  const values = new Set([
    ...(view ? Object.keys(view.originalByCurrency) : []),
    ...model.rows.map(row => currencyCode(row.holding.settlementCurrency)),
  ]);
  const order = ["CNY", "HKD", "USD"];
  return [...values].sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    return (leftIndex < 0 ? order.length : leftIndex) - (rightIndex < 0 ? order.length : rightIndex) || left.localeCompare(right);
  });
}

function MoneyLines({ view, currency, signed = false, model, coverageKey }: {
  view?: RoomMoneyView;
  currency: RoomDisplayCurrency;
  signed?: boolean;
  model?: CurrentPortfolioModel;
  coverageKey?: "marketValue" | "cost" | "unrealizedPnl";
}) {
  const currencies = currency === "original" && model ? currencyUniverse(model, view) : undefined;
  const strictValue = view ? (currency === "original" ? null : targetValue(view, currency)) : null;
  const fallback = strictValue === null && model && coverageKey ? subtotalValue(model, coverageKey, currency) : null;
  const lines = strictValue === null && fallback !== null ? [`${currency} ${format(fallback, signed)}`] : moneyLines(view, currency, signed, currencies);
  return <span className={`${styles.amountList} ${lines.length === 1 ? styles.singleAmount : styles.multiAmount}`}>{lines.map((line, index) => <span key={line}>{line}{currencies && coverageKey && <em> · 覆盖 {currencyCoverage(model!, coverageKey, currencies[index])}</em>}</span>)}</span>;
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

function dailyEvidenceLabel(
  model: CurrentPortfolioModel,
  view: RoomMoneyView | undefined,
  reportCurrency: RoomDisplayCurrency,
): string {
  if (!view) return "当日估值证据不可用";
  if (reportCurrency !== "original") return targetValue(view, reportCurrency) === null ? "当日估值证据不可用" : "当日估值证据完整";
  const currencies = currencyUniverse(model, view);
  const hasGap = currencies.some(currency => view.originalByCurrency[currency] === undefined || view.originalByCurrency[currency] === null);
  return hasGap ? "当日估值证据存在缺口" : "当日估值证据完整";
}

export function RoomPortfolioSummary({
  model,
  scope = "overall",
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
  const dailyEvidence = dailyEvidenceLabel(model, dailyPnl, reportCurrency);
  const percentValue = dailyReturnPercent ?? dailyPnlPercent;
  const percentAvailable = dailyReturnPercentAvailable ?? dailyPnlPercentAvailable ?? (percentValue !== null && percentValue !== undefined);
  const percentReason = dailyReturnPercentReasons?.join("；") || dailyPnlPercentReason || (percentAvailable ? "当日盈亏百分比" : "当日盈亏百分比暂不可用");
  const hasShort = model.rows.some(row => row.holding.direction === "short");
  const marketCoverage = displayedCoverage(model, "marketValue", reportCurrency);
  const costCoverage = displayedCoverage(model, "cost", reportCurrency);
  const pnlCoverage = displayedCoverage(model, "unrealizedPnl", reportCurrency);
  const tone = (view: RoomMoneyView, key?: "marketValue" | "unrealizedPnl") => {
    const values = scalarValues(view, reportCurrency, key ? subtotalValue(model, key, reportCurrency) : null);
    const valid = values.filter(value => {
      try { return new Decimal(value).isFinite(); } catch { return false; }
    });
    return valid.some(value => new Decimal(value).gt(0)) && valid.every(value => new Decimal(value).gte(0)) ? styles.gain
      : valid.some(value => new Decimal(value).lt(0)) && valid.every(value => new Decimal(value).lte(0)) ? styles.loss : undefined;
  };
  return <section aria-label="当前持仓概览" className={styles.summary}>
    <div className={styles.cards}>
      <div className={styles.card}>
        <span>{marketCoverage.complete ? (hasShort ? "持仓净市值" : "持仓市值") : "已知市值小计"}</span>
        <strong><MoneyLines view={model.marketValue} currency={reportCurrency} model={model} coverageKey="marketValue" /></strong>
        <small title={coverageLabel(marketCoverage)}>{metricCoverageLabel("市值", marketCoverage)}</small>
        <small title={coverageLabel(costCoverage)}>成本 <MoneyLines view={model.cost} currency={reportCurrency} model={model} coverageKey="cost" />{costCoverage.complete ? "" : " · 可用小计"}</small>
      </div>
      <div className={styles.card}>
        <span>{pnlCoverage.complete ? "未实现盈亏" : "已知未实现盈亏小计"}</span>
        <strong className={tone(model.unrealizedPnl, "unrealizedPnl")}><MoneyLines view={model.unrealizedPnl} currency={reportCurrency} signed model={model} coverageKey="unrealizedPnl" /></strong>
        <small title={coverageLabel(pnlCoverage)}>{metricCoverageLabel("未实现盈亏", pnlCoverage)}</small>
        <small title="未实现收益率以剩余多头成本为分母">收益率 {model.unrealizedReturnPercent === null ? "暂不可用" : `${format(model.unrealizedReturnPercent, true)}%`}</small>
      </div>
      <div className={styles.card}>
        <span>当日盈亏</span>
        <strong className={dailyPnl ? tone(dailyPnl) : undefined}><MoneyLines view={dailyPnl} currency={reportCurrency} signed model={model} /></strong>
        <small title={dailyReason}>{dailyEvidence} · {dailyBrief}</small>
        <small title={percentReason}>当日百分比 <b aria-label={percentAvailable ? `当日盈亏百分比 ${percentLabel(percentValue, percentAvailable)}` : `当日盈亏百分比暂不可用：${percentReason}`}>{percentLabel(percentValue, percentAvailable)}</b></small>
      </div>
      <div className={styles.card}>
        <span>持仓标的数</span>
        <strong>{model.count}</strong>
        <small>{typeBreakdown(model)}</small>
      </div>
    </div>
    <div className={styles.context}>
      <p className={styles.note}><time dateTime={model.asOf} title={model.asOf}>估值截点：{asOfLabel(model.asOf)}</time></p>
      {reportCurrency !== "original" && <p className={styles.note} title={noteTitle(model.marketValue)}>{noteLabel(model.marketValue)}</p>}
    </div>
    {model.empty && <p className={styles.note}>{scope === "market" ? "当前市场暂无持仓" : "当前空仓"}</p>}
    <details className={styles.details}><summary>核对估值组成与覆盖</summary>
      <p className={styles.note}>{model.basis}</p>
      <p className={styles.note}>当日依据：{dailyReason}</p>
      <p className={styles.note}>原币证据覆盖：市值 {coverageLabel(model.coverage.marketValue)}；成本 {coverageLabel(model.coverage.cost)}；盈亏 {coverageLabel(model.coverage.unrealizedPnl)}。{reportCurrency !== "original" && ` ${reportCurrency} 换算覆盖：市值 ${coverageLabel(marketCoverage)}；成本 ${coverageLabel(costCoverage)}；盈亏 ${coverageLabel(pnlCoverage)}。`}</p>
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
