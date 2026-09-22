"use client";

import { useMemo, useState } from "react";

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
  return "不可用";
}

function quoteDetail(row: TradingRoomHoldingRow): string {
  const latestTrade = row.latestTradeDate ?? "最近交易日未知";
  if (!row.quote) return `最近交易日 ${latestTrade} · 缺少行情，未计算浮盈亏`;
  const date = row.quote.quoteDate ?? "行情日期未知";
  const fetchedAt = row.quote.fetchedAt ?? "采集时间未知";
  const provider = row.quote.provider ?? "来源未知";
  return `最近交易日 ${latestTrade} · ${date} · 采集 ${fetchedAt} · ${provider} · ${quoteFreshnessLabel(row)}`;
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
  onOpenInReview,
  onRetryQuote,
  onOpenDataCheck,
}: {
  row: TradingRoomHoldingRow;
  queueIds: string[];
  accountLabel: string;
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
              <span>{row.symbol} · {assetLabel(row)} · {directionLabel(row)} · {accountLabel}</span>
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
        <div><dt>持仓数量</dt><dd>{number(row.quantity)}</dd></div>
        <div><dt>可用成本</dt><dd>{row.averageCost === null ? "待核对" : money(row.averageCost, costCurrency)}</dd></div>
        <div><dt>行情价格</dt><dd>{row.quote?.price === null || !row.quote ? "不可用" : money(row.quote.price, row.quote.currency)}</dd></div>
        <div><dt>浮盈亏</dt><dd className={row.unrealizedPnlStatus === "available" ? styles.available : styles.unavailable}>{pnlLabel(row)}</dd></div>
      </dl>
      <details className={styles.quoteDetails} role="group" aria-label="行情详情">
        <summary>行情详情</summary>
        <p className={styles.quoteDetail}>
          {quoteDetail(row)}
          {row.quote?.price !== null && row.quote ? ` · ${row.quote.currency}` : ""}
        </p>
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
  const model = useMemo(
    () => buildTradingRoomHoldings(entries, options),
    [entries, options],
  );
  const queueIds = model.rows.map(row => row.episodeId);
  const accountLabels = accountDisplayLabels(model.rows);

  return (
    <section className={styles.panel} aria-label="当前持仓">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Open positions</span>
          <h2>当前持仓，截至 {model.asOf}</h2>
          <p>根据已导入交易流水和持仓证据推导；已导入流水最新交易日 {model.latestImportedTradeDate ?? "未知"}。日收盘价仅作估值，不等同券商实时持仓。</p>
        </div>
        <span className={styles.count}>{model.rows.length} 个未平仓回合</span>
      </header>
      {model.rows.length === 0 ? (
        <p className={styles.empty}>当前范围暂无未平仓回合。</p>
      ) : (
        <div className={styles.groups}>
          {model.groups.map(group => (
            <section className={styles.group} aria-label={`${group.label}持仓`} key={group.market}>
              <h3>{group.label}<small>{group.rows.length} 个回合</small></h3>
              <div className={styles.rows}>
                {group.rows.map(row => (
                <HoldingRow key={row.episodeId} row={row} queueIds={queueIds} accountLabel={accountLabels.get(row.accountId) ?? "账户"} onOpenInReview={onOpenInReview} onRetryQuote={onRetryQuote} onOpenDataCheck={onOpenDataCheck} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
