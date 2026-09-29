"use client";

import Decimal from "decimal.js";
import { useEffect, useState } from "react";
import { roomMoneyValue, type RoomDisplayCurrency, type RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import type {
  PendingLibraryNavigationRequest,
  RoomPendingReviewsModel,
  RoomPendingSourceSnapshot,
} from "../../lib/reviews/trading-room-pending";
import styles from "./room-pending-reviews.module.css";

export type RoomPendingReviewsProps = {
  model: RoomPendingReviewsModel;
  pageSize?: number;
  onOpenInReview: (instrumentId: string, episodeId: string, queueIds?: string[]) => void;
  sourceSnapshot?: RoomPendingSourceSnapshot | null;
  onViewAllPending?: (request: PendingLibraryNavigationRequest) => void;
  /** One-based page so the homepage table can be restored without an index conversion. */
  page?: number;
  onPageChange?: (page: number) => void;
};
function originalAmount(view: RoomMoneyView) {
  return Object.entries(view.originalByCurrency)
    .map(([currency, value]) => `${new Decimal(value).gte(0) ? "+" : ""}${new Decimal(value).toFixed(2)} ${currency}`)
    .join(" · ") || "不可用";
}

function amount(view: RoomMoneyView, displayCurrency: RoomDisplayCurrency = "original") {
  if (displayCurrency === "original") return originalAmount(view);
  const selected = roomMoneyValue(view);
  const selectedCurrency = displayCurrency;
  if (selected !== null) return `${new Decimal(selected).gte(0) ? "+" : ""}${new Decimal(selected).toFixed(2)} ${selectedCurrency}`;
  const original = originalAmount(view);
  return `${displayCurrency}暂不可用${original === "不可用" ? "" : ` · 原币：${original}`}`;
}
function tone(view: RoomMoneyView | null, displayCurrency: RoomDisplayCurrency = "original") {
  const value = view
    ? displayCurrency === "original" ? Object.values(view.originalByCurrency)[0] : roomMoneyValue(view)
    : undefined;
  return value === undefined || value === null || new Decimal(value).isZero() ? "neutral" : new Decimal(value).gt(0) ? "positive" : "negative";
}

function directionLabel(side: RoomPendingReviewsModel["rows"][number]["closingSide"]) {
  return side === "sell" ? "卖出平仓" : side === "buy" ? "买入平仓" : "方向待核对";
}

const pendingReasonLabels: Record<string, string> = {
  "closing-side-unavailable": "平仓方向证据不足",
  "closing-fill-unavailable": "缺少平仓成交证据",
  "closing-currency-mismatch": "平仓字段币种无法统一",
  "closing-quantity-unavailable": "平仓数量证据不足",
  "closing-price-unavailable": "成交均价证据不足",
  "pnl-unavailable": "回合净盈亏不可用",
  "missing-pnl": "缺少回合净盈亏",
};

function pendingReasonLabel(reason: string | null) {
  const labels = reason?.split("；")
    .filter(value => !value.startsWith("closing-"))
    .map(value => pendingReasonLabels[value] ?? value) ?? [];
  return labels.length > 0 ? labels.join("；") : null;
}

function closingFieldNote(reason: string | null, field: "price" | "quantity") {
  if (reason === "closing-price-unavailable" && field === "price") return "成交均价证据不足";
  if (reason === "closing-quantity-unavailable" && field === "quantity") return "平仓数量证据不足";
  if (reason === "closing-currency-mismatch") return "平仓字段币种无法统一";
  if (reason === "closing-fill-unavailable") return "缺少平仓成交证据";
  return null;
}

function closingPriceDisplay(value: string | null, currency: string | null) {
  if (!value || !currency) {
    return { display: "不可用", full: null };
  }
  const raw = value.trim();
  if (!raw) return { display: "不可用", full: null };
  let display = raw;
  try {
    const parsed = new Decimal(raw);
    if (parsed.isFinite() && parsed.gte(0)) display = parsed.toDecimalPlaces(6).toString();
  } catch {
    // Keep the source text visible when it is not a valid decimal.
  }
  return { display: `${display} ${currency}`, full: `${raw} ${currency}` };
}

export function RoomPendingReviews({ model, pageSize = 3, onOpenInReview, sourceSnapshot = null, onViewAllPending, page, onPageChange }: RoomPendingReviewsProps) {
  const [localPage, setLocalPage] = useState(1);
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.max(1, Math.floor(pageSize)) : 3;
  const pageCount = Math.max(1, Math.ceil(model.count / size));
  const requestedPage = onPageChange ? page ?? 1 : localPage;
  const currentPage = Math.min(Math.max(requestedPage, 1), pageCount);
  const start = (currentPage - 1) * size;
  const rows = model.rows.slice(start, start + size);
  useEffect(() => {
    if (requestedPage === currentPage) return;
    if (onPageChange) onPageChange(currentPage);
  }, [currentPage, onPageChange, requestedPage]);
  const viewAll = () => {
    if (onViewAllPending) {
      const dates = model.rows.map(row => row.closeDate).filter(Boolean).sort();
      onViewAllPending({
        reviewStatus: "pending",
        positionStatus: "closed",
        closeDateFrom: sourceSnapshot?.historyPeriod.startDate ?? dates[0] ?? "",
        closeDateTo: sourceSnapshot?.historyPeriod.endDate ?? dates.at(-1) ?? "",
        sourceSnapshot: sourceSnapshot ? { ...sourceSnapshot, pending: { ...sourceSnapshot.pending, page: currentPage } } : null,
      });
      return;
    }
  };
  return <section className={styles.panel} aria-label="待复盘的已完成交易">
    <header><h3>待复盘的已完成交易（{model.count}）</h3>{model.count > 0 && <button type="button" onClick={viewAll}>查看全部待复盘</button>}</header>
    <p className={styles.note}>按最近平仓日期排序 · 仅待复盘，已完成与暂不复盘不列入；盈亏待核对仍可复盘。</p>
    {model.count === 0 ? <p className={styles.note}>当前范围没有待复盘的已平仓回合。</p> : <>
      <div className={styles.tableWrap}><table><thead><tr><th>平仓日期</th><th>标的</th><th>方向</th><th>成交均价</th><th>数量</th><th>回合净盈亏</th><th>状态</th><th>操作</th></tr></thead><tbody>{rows.map(row => {
        const closingPrice = closingPriceDisplay(row.closingWeightedPrice, row.closingCurrency);
        const priceLabel = closingPrice.full
          ? `成交均价：${closingPrice.display}；完整原值：${closingPrice.full}`
          : "成交均价：不可用";
        return <tr key={row.episodeId}>
        <td data-label="平仓日期">{row.closeDate || "日期待核对"}</td>
        <td data-label="标的"><strong>{row.instrumentName}</strong><small>{row.symbol} · {row.accountLabel}</small></td>
        <td data-label="方向">{directionLabel(row.closingSide)}</td>
        <td data-label="成交均价" className={styles.priceCell} aria-label={priceLabel}><span className={styles.priceValue} title={closingPrice.full ? `完整原值：${closingPrice.full}` : undefined}>{closingPrice.display}</span>{closingFieldNote(row.closingUnavailableReason, "price") && <small>{closingFieldNote(row.closingUnavailableReason, "price")}</small>}</td>
        <td data-label="数量">{row.closingQuantity ?? "不可用"}{closingFieldNote(row.closingUnavailableReason, "quantity") && <small>{closingFieldNote(row.closingUnavailableReason, "quantity")}</small>}</td>
        <td data-label="回合净盈亏" className={styles[tone(row.money, model.displayCurrency)]}>{row.money ? amount(row.money, model.displayCurrency) : "不可用"}{pendingReasonLabel(row.unavailableReason) && <small>{pendingReasonLabel(row.unavailableReason)}</small>}</td>
        <td data-label="状态"><span className={styles.pending}>待复盘</span></td>
        <td data-label="操作"><button type="button" onClick={() => onOpenInReview(row.instrumentId, row.episodeId, model.queueIds)}>开始复盘</button></td>
      </tr>;
      })}</tbody></table></div>
      <footer><span>显示 {start + 1}–{start + rows.length}，共 {model.count} 条</span>{pageCount > 1 && <nav aria-label="待复盘分页"><button type="button" aria-label="上一页待复盘" disabled={currentPage === 1} onClick={() => onPageChange ? onPageChange(currentPage - 1) : setLocalPage(currentPage - 1)}>‹</button><span className={styles.pageNumbers}>{Array.from({ length: pageCount }, (_, index) => index + 1).map(pageNumber => <button key={pageNumber} type="button" aria-label={`第${pageNumber}页待复盘`} aria-current={pageNumber === currentPage ? "page" : undefined} disabled={pageNumber === currentPage} onClick={() => onPageChange ? onPageChange(pageNumber) : setLocalPage(pageNumber)}>{pageNumber}</button>)}</span><button type="button" aria-label="下一页待复盘" disabled={currentPage >= pageCount} onClick={() => onPageChange ? onPageChange(currentPage + 1) : setLocalPage(currentPage + 1)}>›</button></nav>}</footer>
    </>}
  </section>;
}
