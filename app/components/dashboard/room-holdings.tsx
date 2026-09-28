"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { SharedReportCurrency } from "../../lib/reviews/shared-scope";
import {
  type TradingRoomHoldingDiagnostic,
  type TradingRoomHoldingRow,
  type TradingRoomHoldingsOptions,
} from "../../lib/reviews/trading-room-holdings";
import { buildCurrentPortfolio, type CurrentPortfolioModel, type CurrentPortfolioRow } from "../../lib/reviews/trading-room-portfolio";
import { buildRoomMoneyView, roomMoneyValue, roomTodayKey, type RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";
import { expectedTradingDates } from "../../lib/market/calendar";
import type { DailyCandleRecord, SupportedMarket } from "../../lib/market/contracts";
import styles from "./room-holdings.module.css";

export type RoomHoldingsPanelProps = TradingRoomHoldingsOptions & {
  entries: readonly TradeLibraryEntry[];
  portfolioModel?: CurrentPortfolioModel;
  /** The page's shared report currency. Prices and costs stay in their source currency. */
  reportCurrency?: SharedReportCurrency;
  /** The same FX snapshot used by the page-level portfolio projection. */
  fxSnapshot?: RoomFxSnapshot;
  /** Optional shell-owned browse state for return navigation and async refresh. */
  browseState?: { query: string; page: number };
  onBrowseStateChange?: (state: { query: string; page: number }) => void;
  onOpenInReview: (
    instrumentId: string,
    episodeId: string,
    queueIds?: string[],
  ) => void;
  onRetryQuote?: (instrumentId: string) => void | Promise<void>;
  onOpenDataCheck?: (instrumentId: string, episodeId: string) => void;
};

function currencyCode(value: string | null | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency || "USD";
}

function money(value: string | null, currency: string | null | undefined, signed = true): string {
  if (value === null) return "不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
      signDisplay: signed ? "always" : "auto",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currencyCode(currency)}`;
  }
}

type HoldingsDisplayOptions = {
  reportCurrency?: SharedReportCurrency;
  fxSnapshot?: RoomFxSnapshot;
};

type DisplayMoney = {
  value: string | null;
  currency: string;
  reason: string | null;
};

function displayMoneyValue(
  value: string | null,
  sourceCurrency: string | null | undefined,
  options: HoldingsDisplayOptions,
): DisplayMoney {
  const source = currencyCode(sourceCurrency);
  const reportCurrency = options.reportCurrency ?? "original";
  if (value === null) {
    return {
      value: null,
      currency: reportCurrency === "original" ? source : reportCurrency,
      reason: "缺少可信金额",
    };
  }
  if (reportCurrency === "original") return { value, currency: source, reason: null };
  const view = buildRoomMoneyView([{ currency: sourceCurrency ?? "", amount: value }], options.fxSnapshot, reportCurrency);
  const converted = roomMoneyValue(view);
  return {
    value: converted,
    currency: reportCurrency,
    reason: converted === null ? view.note : null,
  };
}

function displayMoneyLabel(value: string | null, sourceCurrency: string | null | undefined, options: HoldingsDisplayOptions, signed = true): string {
  const displayed = displayMoneyValue(value, sourceCurrency, options);
  if (displayed.value !== null) return money(displayed.value, displayed.currency, signed);
  return displayed.reason ? `不可用（${displayed.reason}）` : "不可用";
}

function reportUnit(options: HoldingsDisplayOptions, sourceCurrency: string | null | undefined): string {
  return options.reportCurrency && options.reportCurrency !== "original"
    ? options.reportCurrency
    : currencyCode(sourceCurrency);
}

function price(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "不可用";
  const decimals = value.split(".")[1]?.length ?? 0;
  if (decimals > 100) return `${currencyCode(currency)} ${value}`;
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency", currency: currencyCode(currency),
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      signDisplay: "never",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(decimals)} ${currencyCode(currency)}`;
  }
}

function averageCost(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "可用成本待核对";
  if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) < 0) return "待核对";
  const display = new Decimal(value).toDecimalPlaces(6).toString();
  return price(display, currency);
}

function number(value: string | null, fractionDigits = 2): string {
  if (value === null) return "待核对";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "待核对";
  return parsed.toLocaleString("zh-CN", { maximumFractionDigits: fractionDigits });
}

function quoteStatusLabel(row: TradingRoomHoldingRow): string {
  if (!row.quote || row.quote.price === null) return "暂无可用报价";
  if (row.quote.freshness === "stale" || row.quoteStatus === "stale") {
    return "旧报价 · 非实时";
  }
  if (row.quoteStatus === "unavailable" || row.quoteStatus === "missing" || row.quote.freshness === "future") return "暂无可用报价";
  return "最新可用价 · 日收盘（非实时）";
}

function pnlLabel(row: TradingRoomHoldingRow): string {
  if (row.unrealizedPnlStatus === "available") {
    return money(row.unrealizedPnl, row.quote?.currency ?? row.row.entry.instrument.currency);
  }
  if (row.unrealizedPnlStatus === "stale") return "暂不可用（报价较旧）";
  if (row.quoteStatus === "missing") return "暂不可用（缺少报价）";
  return "暂不可用";
}

function pnlTone(row: TradingRoomHoldingRow): "positive" | "negative" | "neutral" | "unavailable" {
  if (row.unrealizedPnlStatus !== "available" || row.unrealizedPnl === null) return "unavailable";
  const value = Number(row.unrealizedPnl);
  if (value === 0) return "neutral";
  return value < 0 ? "negative" : "positive";
}

function assetLabel(row: TradingRoomHoldingRow): string {
  if (row.assetType === "etf") return "ETF";
  if (row.assetType === "stock") return "股票";
  return "资产类型待核对";
}

function directionLabel(row: TradingRoomHoldingRow): string {
  if (row.direction === "short") return "空头";
  if (row.direction === "long") return "多头";
  return "方向待核对";
}

function percent(value: string | null): string {
  if (value === null) return "暂不可用";
  const amount = new Decimal(value);
  return `${amount.gt(0) ? "+" : ""}${amount.toFixed(2)}%`;
}

function safeCsv(value: string): string {
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function holdingsCsv(rows: readonly CurrentPortfolioRow[], asOf: string, options: HoldingsDisplayOptions = {}): string {
  const headings = ["证券", "代码", "市场", "账户", "数量", "币种", "成本价", "估值价", "持仓市值", "未实现盈亏", "收益率", "报价日期", "估值截点", "状态"];
  const values = rows.map(value => {
    const row = value.holding;
    const currency = row.settlementCurrency ?? "币种待核对";
    return [row.instrumentName, row.symbol, row.marketLabel, row.accountLabel,
      number(row.quantity), reportUnit(options, currency), averageCost(row.averageCost, currency), price(row.quote?.price ?? null, row.quote?.currency),
      displayMoneyLabel(value.marketValue, currency, options, false), row.unrealizedPnlStatus === "available"
        ? displayMoneyLabel(value.unrealizedPnl, currency, options)
        : pnlLabel(row), percent(value.unrealizedReturnPercent),
      row.quote?.quoteDate ?? "未知", asOf, value.reasons.join("；") || quoteStatusLabel(row)];
  });
  return [headings, ...values].map(line => line.map(safeCsv).join(",")).join("\r\n");
}

function shortRecordDate(value: string, asOf: string): string {
  const parsed = new Date(value);
  const recordDate = Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : roomTodayKey(parsed);
  const anchor = asOf.slice(0, 10);
  const recordMs = Date.parse(`${recordDate}T00:00:00Z`);
  const anchorMs = Date.parse(`${anchor}T00:00:00Z`);
  if (Number.isFinite(recordMs) && Number.isFinite(anchorMs)) {
    const days = Math.round((anchorMs - recordMs) / 86_400_000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days > 1 && days <= 30) return `${days}天前`;
  }
  return recordDate;
}

export function holdingPriceSeries(row: TradingRoomHoldingRow, candles: readonly DailyCandleRecord[], asOf: string) {
  const end = asOf.slice(0, 10);
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  let dates: string[];
  try { dates = expectedTradingDates(row.market as SupportedMarket, start.toISOString().slice(0, 10), end); }
  catch { return []; }
  return dates.map(date => {
    const candle = candles.find(item => item.instrumentId === row.instrumentId && item.tradingDate === date && item.adjustmentMode === "raw" && item.currency === row.settlementCurrency);
    let value: number | null = null;
    try { if (candle && new Decimal(candle.close).isFinite() && new Decimal(candle.close).gt(0)) value = Number(candle.close); } catch { /* invalid source remains a gap */ }
    return { date, value };
  });
}

function PriceTrend({ row, candles, asOf }: { row: TradingRoomHoldingRow; candles: readonly DailyCandleRecord[]; asOf: string }) {
  const points = holdingPriceSeries(row, candles, asOf);
  const known = points.filter(point => point.value !== null);
  if (!known.length) return <span className={styles.trendMissing}>近30日价格暂无数据</span>;
  const min = Math.min(...known.map(point => point.value!));
  const max = Math.max(...known.map(point => point.value!));
  const y = (value: number) => 27 - (max === min ? 12 : (value - min) / (max - min) * 24);
  const path = points.map((point, index) => {
    if (point.value === null) return "";
    const command = `${index === 0 || points[index - 1].value === null ? "M" : "L"}${index / Math.max(points.length - 1, 1) * 100},${y(point.value)}`;
    return command;
  }).join(" ");
  return <div className={styles.trend}>
    <svg viewBox="0 0 100 32" role="img" aria-label={`近30日价格走势，${known.length}/${points.length}个交易日有报价，缺失处断开`}><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5"/>{points.map((point,index) => point.value === null ? null : <circle key={point.date} cx={index / Math.max(points.length - 1, 1) * 100} cy={y(point.value)} r="1"/>)}</svg>
    <small>{known.length}/{points.length} 日 · 价格走势</small>
  </div>;
}

type RetryFeedback = "idle" | "running" | "settled" | "success" | "still-unavailable" | "failed";

function retryFeedbackLabel(value: RetryFeedback): string | null {
  switch (value) {
    case "running": return "行情重试进行中";
    case "success": return "行情重试成功";
    case "still-unavailable": return "行情重试完成，仍不可用";
    case "failed": return "行情重试失败";
    default: return null;
  }
}

function accountDisplayLabels(rows: readonly TradingRoomHoldingRow[]): ReadonlyMap<string, string> {
  const byLabel = new Map<string, string[]>();
  for (const row of rows) {
    const label = row.accountLabel.trim() || "账户";
    const ids = byLabel.get(label) ?? [];
    if (!ids.includes(row.accountId)) ids.push(row.accountId);
    byLabel.set(label, ids);
  }
  const display = new Map<string, string>();
  for (const [label, ids] of byLabel) {
    const ordered = [...ids].sort((left, right) => left.localeCompare(right));
    ordered.forEach((accountId, index) => {
      display.set(accountId, ordered.length > 1 ? `${label} · ${index + 1}` : label);
    });
  }
  return display;
}

function HoldingRow({
  row,
  queueIds,
  accountLabel,
  onOpenInReview,
  onRetryQuote,
  onOpenDataCheck,
  value,
  candles,
  asOf,
  reportCurrency,
  fxSnapshot,
}: {
  row: TradingRoomHoldingRow;
  value: CurrentPortfolioRow;
  candles: readonly DailyCandleRecord[];
  asOf: string;
  onOpenDataCheck?: RoomHoldingsPanelProps["onOpenDataCheck"];
  queueIds: string[];
  accountLabel: string;
  onOpenInReview: RoomHoldingsPanelProps["onOpenInReview"];
  onRetryQuote?: RoomHoldingsPanelProps["onRetryQuote"];
  reportCurrency: SharedReportCurrency;
  fxSnapshot?: RoomFxSnapshot;
}) {
  const [retryFeedback, setRetryFeedback] = useState<RetryFeedback>("idle");
  const costCurrency = row.settlementCurrency ?? row.row.entry.instrument.currency;
  const displayOptions = { reportCurrency, fxSnapshot } satisfies HoldingsDisplayOptions;
  const displayedPnl = displayMoneyValue(value.unrealizedPnl, costCurrency, displayOptions);

  async function retryQuote() {
    if (!onRetryQuote || retryFeedback === "running") return;
    setRetryFeedback("running");
    try {
      const result = onRetryQuote(row.instrumentId);
      if (!result || typeof result.then !== "function") {
        setRetryFeedback("failed");
        return;
      }
      await result;
      setRetryFeedback("settled");
    } catch {
      setRetryFeedback("failed");
    }
  }
  const visibleRetryFeedback = retryFeedback === "settled"
    ? row.diagnostic === "available" ? "success" : "still-unavailable"
    : retryFeedback === "still-unavailable" && row.diagnostic === "available"
      ? "success"
      : retryFeedback;
  const retryLabel = retryFeedbackLabel(visibleRetryFeedback);
  const record = row.row.item.review;
  const recall = row.row.item.recallReview;
  const updatedAt = recall?.updatedAt ?? record?.updatedAt;
  const summary = recall
    ? recall.text.trim() || `已留存${recall.snapshotCount}份快照`
    : record?.review.keyDecision?.trim() || record?.review.reusableRule.trim() || record?.plan.thesis.trim() || "已有复盘记录";
  const quoteMeta = `${quoteStatusLabel(row)}；报价时间：${row.quote?.quoteDate ?? "未知"}`;
  return <tr className={`${styles.tableRow} ${row.diagnostic === "available" ? styles.rowQuoteReady : styles.rowQuoteIssue}`}>
    <td data-label="证券"><strong>{row.instrumentName}</strong><small>{row.symbol} · {assetLabel(row)}</small><small>{accountLabel} · 方向：{directionLabel(row)}</small><details className={styles.rowDetails}><summary>详情</summary><p>账户：{accountLabel}；方向：{directionLabel(row)}</p><p>最近成交：{row.lastActivityAt}</p><p>报价精确时间：{row.quote?.fetchedAt ?? "未知"}</p></details></td>
    <td data-label="市场"><span className={`${styles.marketBadge} ${styles[`market${row.market.replace(/[^A-Za-z0-9]/g, "_")}`] ?? ""}`}>{row.marketLabel}</span></td>
    <td data-label="持仓数量"><dl><dd title={row.quantity ?? undefined}>{number(row.quantity)}</dd></dl></td>
    <td data-label="持仓均价"><dl><dd title={row.averageCost ?? undefined}>{averageCost(row.averageCost, costCurrency)}</dd></dl></td>
    <td data-label="估值价" title={quoteMeta}><dl><dd>{price(row.quote?.price ?? null, row.quote?.currency)}</dd></dl><small>{quoteStatusLabel(row)}</small><small>报价时间：{row.quote?.quoteDate ?? "未知"}</small></td>
    <td data-label="持仓市值"><dl><dd>{displayMoneyLabel(value.marketValue, costCurrency, displayOptions, false)}</dd></dl><small>{reportUnit(displayOptions, costCurrency)}</small></td>
    <td data-label="浮盈亏"><dl><dd className={styles[row.unrealizedPnlStatus === "available" && displayedPnl.value !== null ? pnlTone(row) : "unavailable"]}>{row.unrealizedPnlStatus === "available" ? displayMoneyLabel(value.unrealizedPnl, costCurrency, displayOptions) : pnlLabel(row)}</dd></dl><small>{reportUnit(displayOptions, costCurrency)}</small></td>
    <td data-label="盈亏率"><dl><dd className={styles[pnlTone(row)]}>{percent(value.unrealizedReturnPercent)}</dd></dl></td>
    <td data-label="近30日价格"><PriceTrend row={row} candles={candles} asOf={asOf}/></td>
    <td data-label="最近记录">{updatedAt ? <><span className={styles.recordDate}><time dateTime={updatedAt} aria-label={`最近记录精确时间：${updatedAt}`} title={`精确时间：${updatedAt}`}>{shortRecordDate(updatedAt, asOf)}</time><span className={styles.visuallyHidden}>{updatedAt}</span></span><span className={styles.recordSummary} title={summary}>{summary.slice(0, 70)}</span></> : <span>暂无记录</span>}</td>
    <td data-label="操作" className={styles.rowActions}>
      <button type="button" className={styles.reviewButton} aria-label="打开持仓回合复盘" onClick={() => onOpenInReview(row.instrumentId, row.episodeId, queueIds)}>看图·记录</button>
      {row.diagnostic !== "available" && <details className={styles.evidence}><summary>估值说明</summary><p>{value.reasons.join("；") || row.statusReason || "估值证据待核对"}</p>
        {onOpenDataCheck && row.diagnostic === "position-evidence" && <button type="button" onClick={() => onOpenDataCheck(row.instrumentId, row.episodeId)}>核对持仓证据</button>}
      </details>}
      {onRetryQuote && (["missing-quote", "stale-quote", "source-unavailable", "market-data-pending", "market-data-storage-error"] as TradingRoomHoldingDiagnostic[]).includes(row.diagnostic) && <button type="button" disabled={retryFeedback === "running"} onClick={() => void retryQuote()}>{retryFeedback === "running" ? "重试行情进行中" : "重试行情"}</button>}
      {retryLabel && <p className={styles.retryFeedback} role="status">{retryLabel}</p>}
    </td>
  </tr>;

}

export function RoomHoldingsPanel({
  entries,
  onOpenInReview,
  onRetryQuote,
  onOpenDataCheck,
  portfolioModel,
  reportCurrency = "original",
  fxSnapshot,
  browseState,
  onBrowseStateChange,
  ...options
}: RoomHoldingsPanelProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"recent" | "pnl">("recent");
  const visibleQuery = browseState?.query ?? query;
  const visiblePage = browseState?.page ?? page;
  function updateBrowseState(next: { query: string; page: number }) {
    if (!browseState) {
      setQuery(next.query);
      setPage(next.page);
    }
    onBrowseStateChange?.(next);
  }
  const targetCurrency = reportCurrency === "original" ? undefined : reportCurrency;
  const portfolio = useMemo(() => portfolioModel ?? buildCurrentPortfolio(entries, { ...options, fxSnapshot, targetCurrency }), [entries, options, portfolioModel, fxSnapshot, targetCurrency]);
  const model = portfolio.holdings;
  const accountLabels = accountDisplayLabels(model.rows);
  const currencies = new Set(model.rows.map(row => row.settlementCurrency ?? row.quote?.currency).filter(Boolean));
  const canSortPnl = currencies.size <= 1;
  const sortedRows = useMemo(() => {
    if (sort !== "pnl" || !canSortPnl) return model.rows;
    return [...model.rows].sort((left, right) => {
      if (left.unrealizedPnlStatus !== "available") return right.unrealizedPnlStatus === "available" ? 1 : right.episodeId.localeCompare(left.episodeId);
      if (right.unrealizedPnlStatus !== "available") return -1;
      return Number(right.unrealizedPnl) - Number(left.unrealizedPnl) || right.lastActivityAt.localeCompare(left.lastActivityAt);
    });
  }, [canSortPnl, model.rows, sort]);
  const needle = visibleQuery.trim().toLocaleLowerCase();
  const filtered = sortedRows.filter(row => [row.instrumentName, row.symbol, row.accountLabel, row.accountId, row.marketLabel].some(text => text.toLocaleLowerCase().includes(needle)));
  const groupedRows = model.groups.flatMap(group => filtered.filter(row => row.market === group.market));
  const pages = Math.max(1, Math.ceil(groupedRows.length / 5));
  const currentPage = Math.min(Math.max(visiblePage, 1), pages);
  const shown = groupedRows.slice((currentPage - 1) * 5, currentPage * 5);
  const queueIds = groupedRows.map(row => row.episodeId);
  const values = new Map(portfolio.rows.map(row => [row.holding.episodeId, row]));
  function exportRows() {
    const csv = holdingsCsv(groupedRows.map(row => values.get(row.episodeId)!), portfolio.asOf, { reportCurrency, fxSnapshot });
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `holdings-${model.asOf}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.panel} aria-label="当前持仓" data-current-date={model.asOf}>
      <header className={styles.heading}>
        <div>
          <h2>当前持仓</h2>
          <p className={styles.holdingDate}>持仓日期：{model.asOf}</p>
          <details className={styles.tableInfo}><summary>估值说明</summary><p>按已导入交易流水推导；日收盘价仅作估值，不等同券商实时持仓。</p></details>
        </div>
        <div className={styles.headerActions}>
          <fieldset className={styles.sortOptions}>
            <legend>排序持仓</legend>
            <label><input type="radio" name="holdings-sort" value="recent" checked={sort === "recent"} onChange={() => setSort("recent")} />最近成交</label>
            <label><input type="radio" name="holdings-sort" value="pnl" checked={sort === "pnl"} disabled={!canSortPnl} onChange={() => setSort("pnl")} />浮盈亏</label>
          </fieldset>
          <span className={styles.count}>{model.rows.length} 个未平仓回合</span>
        </div>
      </header>
      <div className={styles.tableToolbar}><label>搜索持仓<input type="search" aria-label="搜索持仓" value={visibleQuery} placeholder="代码、名称、账户" onChange={event => updateBrowseState({ query: event.target.value, page: 1 })} /></label><button type="button" disabled={!filtered.length} onClick={exportRows}>导出当前筛选 CSV（{filtered.length}）</button></div>
      {sort === "pnl" && !canSortPnl && <p className={styles.sortNote}>币种不可直接比较，已保留最近成交顺序。</p>}
      {sort === "pnl" && canSortPnl && <p className={styles.sortNote}>仅在同币种内比较浮盈亏；不可用项置后。</p>}
      {model.rows.length === 0 ? (
        <p className={styles.empty}>当前范围暂无未平仓回合。</p>
      ) : (
        <div className={styles.tableScroll}><table className={styles.table}><thead><tr>{["证券", "市场", "持仓数量", "持仓均价", "估值价", "持仓市值", "未实现盈亏", "盈亏率", "近30日走势", "最近记录", "操作"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {shown.map(row => (
            <HoldingRow key={row.episodeId} row={row} value={values.get(row.episodeId)!} candles={options.candlesByInstrument?.[row.instrumentId] ?? []} asOf={model.asOf} queueIds={queueIds} accountLabel={accountLabels.get(row.accountId) ?? "账户"} onOpenInReview={onOpenInReview} onRetryQuote={onRetryQuote} onOpenDataCheck={onOpenDataCheck} reportCurrency={reportCurrency} fxSnapshot={fxSnapshot} />
          ))}
        </tbody></table></div>
      )}
      {!filtered.length && model.rows.length > 0 && <p>没有匹配的持仓</p>}
      <nav className={styles.pagination} aria-label="持仓分页"><span>显示 {(filtered.length === 0 ? 0 : (currentPage - 1) * 5 + 1)}–{Math.min(currentPage * 5, filtered.length)}，共 {filtered.length} 个仓位</span><div className={styles.pageButtons}><button type="button" aria-label="上一页持仓" disabled={currentPage <= 1} onClick={() => updateBrowseState({ query: visibleQuery, page: currentPage - 1 })}>上一页</button>{Array.from({ length: pages }, (_, index) => index + 1).map(pageNumber => <button type="button" key={pageNumber} aria-label={`第${pageNumber}页`} aria-current={pageNumber === currentPage ? "page" : undefined} disabled={pageNumber === currentPage} onClick={() => updateBrowseState({ query: visibleQuery, page: pageNumber })}>{pageNumber}</button>)}<button type="button" aria-label="下一页持仓" disabled={currentPage >= pages} onClick={() => updateBrowseState({ query: visibleQuery, page: currentPage + 1 })}>下一页</button></div></nav>
    </section>
  );
}
