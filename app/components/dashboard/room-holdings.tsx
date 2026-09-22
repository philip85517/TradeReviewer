"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import {
  buildTradingRoomHoldings,
  type TradingRoomHoldingDiagnostic,
  type TradingRoomHoldingRow,
  type TradingRoomHoldingsOptions,
} from "../../lib/reviews/trading-room-holdings";
import styles from "./room-holdings.module.css";

export type RoomHoldingsPanelProps = TradingRoomHoldingsOptions & {
  entries: readonly TradeLibraryEntry[];
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

function money(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
      signDisplay: "always",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currencyCode(currency)}`;
  }
}

function price(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "不可用";
  const decimals = value.split(".")[1]?.length ?? 0;
  if (decimals > 100) return "高精度报价（见技术证据）";
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

function quoteFreshnessLabel(row: TradingRoomHoldingRow): string {
  if (!row.quote) return "缺少行情";
  if (row.quoteStatus === "stale") return "行情已过期";
  if (row.quoteStatus === "unavailable") return "行情不可用";
  if (row.quote.freshness === "future") return "行情日期晚于截点";
  return "行情可用";
}

function pnlLabel(row: TradingRoomHoldingRow): string {
  if (row.unrealizedPnlStatus === "available") {
    return money(row.unrealizedPnl, row.quote?.currency ?? row.row.entry.instrument.currency);
  }
  if (row.unrealizedPnlStatus === "stale") return "浮盈亏不可用 · 行情已过期";
  if (row.quoteStatus === "missing") return "浮盈亏不可用 · 缺少行情";
  return "浮盈亏不可用";
}

function pnlTone(row: TradingRoomHoldingRow): "positive" | "negative" | "unavailable" {
  if (row.unrealizedPnlStatus !== "available" || row.unrealizedPnl === null) return "unavailable";
  return Number(row.unrealizedPnl) < 0 ? "negative" : "positive";
}

function quoteDetail(row: TradingRoomHoldingRow): string {
  if (!row.quote) return "缺少行情，未计算浮盈亏";
  return quoteFreshnessLabel(row);
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

function diagnosticLabel(diagnostic: TradingRoomHoldingDiagnostic): string {
  switch (diagnostic) {
    case "missing-quote": return "缺少行情";
    case "stale-quote": return "行情已过期";
    case "future-quote": return "行情晚于统计截点";
    case "pre-trade-quote": return "行情早于最近交易";
    case "currency-mismatch": return "行情币种不匹配";
    case "invalid-quote": return "行情价格无效";
    case "source-unavailable": return "行情源暂不可用";
    case "source-unsupported": return "行情源不支持或未连接";
    case "market-data-pending": return "行情更新进行中";
    case "market-data-storage-error": return "行情状态读取失败";
    case "position-evidence": return "持仓证据待核对";
    default: return "行情可用";
  }
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
  viewedDate,
  onOpenInReview,
  onRetryQuote,
  onOpenDataCheck,
}: {
  row: TradingRoomHoldingRow;
  queueIds: string[];
  accountLabel: string;
  viewedDate: string;
  onOpenInReview: RoomHoldingsPanelProps["onOpenInReview"];
  onRetryQuote?: RoomHoldingsPanelProps["onRetryQuote"];
  onOpenDataCheck?: RoomHoldingsPanelProps["onOpenDataCheck"];
}) {
  const [retryFeedback, setRetryFeedback] = useState<RetryFeedback>("idle");
  const costCurrency = row.settlementCurrency ?? row.row.entry.instrument.currency;

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
  return (
    <article className={styles.row}>
      <div className={styles.rowHeading}>
        <div>
          <strong>{row.instrumentName}</strong>
          <span>{row.symbol} · {assetLabel(row)} · {accountLabel} · 方向：{directionLabel(row)}</span>
        </div>
        <button
          type="button"
          className={styles.reviewButton}
          onClick={() => onOpenInReview(row.instrumentId, row.episodeId, queueIds)}
        >
          打开持仓回合复盘
        </button>
      </div>
      <dl className={styles.values}>
        <div><dt>持仓数量</dt><dd><span className={styles.amount}>{number(row.quantity)}</span></dd></div>
        <div><dt>持仓均价</dt><dd title={row.averageCost ?? undefined}><span className={styles.amount}>{averageCost(row.averageCost, costCurrency)}</span></dd></div>
        <div><dt>估值价</dt><dd><span className={styles.amount}>{row.quote?.price === null || !row.quote ? "不可用" : price(row.quote.price, row.quote.currency)}</span>{row.quote?.freshness === "stale" && <small className={styles.staleLabel}>过期参考价</small>}</dd></div>
        <div><dt>浮盈亏</dt><dd className={styles[pnlTone(row)]}>{row.unrealizedPnlStatus === "available" ? <span className={styles.amount}>{pnlLabel(row)}</span> : pnlLabel(row)}</dd></div>
      </dl>
      <p className={styles.quoteDetail}>
        行情：{quoteDetail(row)} · 行情日期 {row.quote?.quoteDate ?? "未知"}
        {row.quote?.price !== null && row.quote ? ` · ${row.quote.currency}` : ""}
      </p>
      <details className={styles.evidence} role="group" aria-label="行情详情">
        <summary>技术证据</summary>
        {row.statusReason && row.unrealizedPnlStatus !== "available" && <p className={styles.statusReason}>{row.statusReason}</p>}
        <p>持仓均价完整值：{row.averageCost ?? "待核对"}</p>
        {row.quote?.price && row.quote.price.split(".")[1]?.length > 100 && <p>估值价原始值：{row.quote.price}</p>}
        <p>行情日期：{row.quote?.quoteDate ?? "未知"} · 行情来源：{row.quote?.provider ?? "未知"} · 采集时间：{row.quote?.fetchedAt ?? "未知"} · 方向证据：{row.row.item.episode.directionKnown === false ? "来源未确认，未按数量正负推断" : "回合方向字段"}</p>
        <p>流水覆盖截止：{row.latestTradeDate ?? "未知"} · 查看日：{viewedDate}</p>
      </details>
      {row.diagnostic !== "available" && <div className={styles.diagnosticActions}>
        <span className={styles.diagnosticLabel}>{diagnosticLabel(row.diagnostic)}</span>
        {(["missing-quote", "stale-quote", "source-unavailable", "market-data-pending", "market-data-storage-error"] as TradingRoomHoldingDiagnostic[]).includes(row.diagnostic) && onRetryQuote && <button type="button" disabled={retryFeedback === "running"} onClick={() => void retryQuote()}>{retryFeedback === "running" ? "重试行情进行中" : "重试行情"}</button>}
        {onOpenDataCheck && <button type="button" onClick={() => onOpenDataCheck(row.instrumentId, row.episodeId)}>查看数据</button>}
      </div>}
      {retryLabel && <p className={styles.retryFeedback} role="status">{retryLabel}</p>}
      {row.statusReason && row.unrealizedPnlStatus !== "available" && <details className={styles.diagnosticDetails}>
        <summary>查看诊断详情</summary>
        <p className={styles.statusReason}>{row.statusReason}</p>
        {row.positionEvidence.status === "unverified-negative" && <p className={styles.statusReason}>
          缺失证据字段：{row.positionEvidence.missing.join("、") || "无"}
          {row.positionEvidence.sourceFormatRuleIds.length > 0 ? `；来源规则：${row.positionEvidence.sourceFormatRuleIds.join("、")}` : ""}
        </p>}
      </details>}
    </article>
  );
}

export function RoomHoldingsPanel({
  entries,
  onOpenInReview,
  onRetryQuote,
  onOpenDataCheck,
  ...options
}: RoomHoldingsPanelProps) {
  const [sort, setSort] = useState<"recent" | "pnl">("recent");
  const model = useMemo(
    () => buildTradingRoomHoldings(entries, options),
    [entries, options],
  );
  const queueIds = model.rows.map(row => row.episodeId);
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
  const groups = useMemo(() => model.groups.map(group => ({ ...group, rows: sortedRows.filter(row => row.market === group.market) })), [model.groups, sortedRows]);

  return (
    <section className={styles.panel} aria-label="当前持仓" data-current-date={model.asOf}>
      <header className={styles.heading}>
        <div>
          <h2>当前持仓，截至 {model.asOf}</h2>
          <p>根据已导入交易流水和持仓证据推导；流水覆盖截止 {model.latestImportedTradeDate ?? "未知"}，查看日 {model.asOf}。日收盘价仅作估值，不等同券商实时持仓。</p>
        </div>
        <div className={styles.headerActions}>
          <label>排序持仓 <select aria-label="排序持仓" value={sort} onChange={event => setSort(event.target.value as "recent" | "pnl")}><option value="recent">最近成交</option><option value="pnl" disabled={!canSortPnl}>浮盈亏</option></select></label>
          <span className={styles.count}>{model.rows.length} 个未平仓回合</span>
        </div>
      </header>
      {sort === "pnl" && !canSortPnl && <p className={styles.sortNote}>币种不可直接比较，已保留最近成交顺序。</p>}
      {sort === "pnl" && canSortPnl && <p className={styles.sortNote}>仅在同币种内比较浮盈亏；不可用项置后。</p>}
      {model.rows.length === 0 ? (
        <p className={styles.empty}>当前范围暂无未平仓回合。</p>
      ) : (
        <div className={styles.groups}>
          {groups.map(group => (
            <section className={styles.group} aria-label={`${group.label}持仓`} key={group.market}>
              <h3>{group.label}<small>{group.rows.length} 个回合</small></h3>
              <div className={styles.rows}>
                {group.rows.map(row => (
                  <HoldingRow key={row.episodeId} row={row} queueIds={queueIds} accountLabel={accountLabels.get(row.accountId) ?? "账户"} viewedDate={model.asOf} onOpenInReview={onOpenInReview} onRetryQuote={onRetryQuote} onOpenDataCheck={onOpenDataCheck} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
