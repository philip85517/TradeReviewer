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
}: {
  row: TradingRoomHoldingRow;
  queueIds: string[];
  accountLabel: string;
  onOpenInReview: RoomHoldingsPanelProps["onOpenInReview"];
  onRetryQuote?: RoomHoldingsPanelProps["onRetryQuote"];
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
          aria-label="打开持仓回合复盘"
          onClick={() => onOpenInReview(row.instrumentId, row.episodeId, queueIds)}
        >
          复盘
        </button>
      </div>
      <dl className={styles.values}>
        <div><dt>持仓数量</dt><dd><span className={styles.amount}>{number(row.quantity)}</span></dd></div>
        <div><dt>持仓均价</dt><dd title={row.averageCost ?? undefined}><span className={styles.amount}>{averageCost(row.averageCost, costCurrency)}</span></dd></div>
        <div><dt>估值价</dt><dd><span className={styles.amount}>{row.quote?.price === null || !row.quote ? "不可用" : price(row.quote.price, row.quote.currency)}</span></dd></div>
        <div><dt>浮盈亏</dt><dd className={styles[pnlTone(row)]}>{row.unrealizedPnlStatus === "available" ? <span className={styles.amount}>{pnlLabel(row)}</span> : pnlLabel(row)}</dd></div>
      </dl>
      <div className={styles.quoteSummary}>
        <span className={styles.quoteStatus}>{quoteStatusLabel(row)}</span>
        {row.quote && <span className={styles.quoteDate}>报价时间：{row.quote.quoteDate ?? "未知"}</span>}
      </div>
      {row.diagnostic !== "available" && onRetryQuote && <div className={styles.diagnosticActions}>
        {(["missing-quote", "stale-quote", "source-unavailable", "market-data-pending", "market-data-storage-error"] as TradingRoomHoldingDiagnostic[]).includes(row.diagnostic) && <button type="button" disabled={retryFeedback === "running"} onClick={() => void retryQuote()}>{retryFeedback === "running" ? "重试行情进行中" : "重试行情"}</button>}
      </div>}
      {retryLabel && <p className={styles.retryFeedback} role="status">{retryLabel}</p>}
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
  void onOpenDataCheck;
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
          <h2>当前持仓</h2>
          <p className={styles.holdingDate}>持仓日期：{model.asOf}</p>
          <p>按已导入交易流水推导；日收盘价仅作估值，不等同券商实时持仓。</p>
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
      {sort === "pnl" && !canSortPnl && <p className={styles.sortNote}>币种不可直接比较，已保留最近成交顺序。</p>}
      {sort === "pnl" && canSortPnl && <p className={styles.sortNote}>仅在同币种内比较浮盈亏；不可用项置后。</p>}
      {model.rows.length === 0 ? (
        <p className={styles.empty}>当前范围暂无未平仓回合。</p>
      ) : (
        <div className={styles.groups}>
          {groups.map(group => (
            <section className={styles.group} aria-label={`${group.label}持仓`} key={group.market}>
              <h3><span className={`${styles.marketBadge} ${styles[`market${group.market.replace(/[^A-Za-z0-9]/g, "_")}`] ?? ""}`}>{group.label.replace(/^A股·/, "")}</span><small>{group.rows.length} 个回合</small></h3>
              <div className={styles.rows}>
                {group.rows.map(row => (
                  <HoldingRow key={row.episodeId} row={row} queueIds={queueIds} accountLabel={accountLabels.get(row.accountId) ?? "账户"} onOpenInReview={onOpenInReview} onRetryQuote={onRetryQuote} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
