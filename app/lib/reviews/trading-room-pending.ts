import Decimal from "decimal.js";

import { dashboardEpisodeDate, exclusionReasonLabel } from "./dashboard";
import { reviewState } from "./review-queue";
import { buildRoomMoneyView, type RoomDisplayCurrency, type RoomFxSnapshot, type RoomMoneyView, type RoomTargetCurrency, type TradingRoomRow } from "./trading-room-scope";
import { marketTradingDate } from "../market/trading-date";
import type { TradeEpisode, TradeExecution, TradeSide } from "../trades/types";
import type { SharedScope } from "./shared-scope";
import type { RoomAssetCategory, RoomAssetTypeFilter, RoomDateRange, RoomReviewStatus, RoomScope } from "./trading-room-scope";

export type TradeLibraryRoomFilters = {
  assetCategory: RoomAssetCategory;
  assetType: RoomAssetTypeFilter;
  query: string;
  instrumentIds: string[];
  markets: string[];
  currencies: string[];
  reviewStatuses: RoomReviewStatus[];
};

function normalizedFilterValues(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

export function hasTradeLibraryRoomFilters(filters: TradeLibraryRoomFilters): boolean {
  return filters.assetCategory !== "all" ||
    filters.assetType !== "all" ||
    Boolean(filters.query.trim()) ||
    filters.instrumentIds.length > 0 ||
    filters.markets.length > 0 ||
    filters.currencies.length > 0 ||
    filters.reviewStatuses.length > 0;
}

/** Copies only the homepage filters that are not already owned by sharedScope. */
export function roomFiltersFromScope(scope?: RoomScope): TradeLibraryRoomFilters | null {
  if (!scope) return null;
  const assetCategory = scope.assetCategory;
  const assetType = scope.assetType ?? "all";
  const query = scope.query?.trim() ?? "";
  const instrumentIds = normalizedFilterValues(scope.instrumentIds);
  const markets = normalizedFilterValues(scope.markets);
  const currencies = normalizedFilterValues(scope.currencies);
  const reviewStatuses = [...new Set(scope.reviewStatuses)];
  const filters = { assetCategory, assetType, query, instrumentIds, markets, currencies, reviewStatuses };
  return hasTradeLibraryRoomFilters(filters) ? filters : null;
}

/** Homepage state captured before entering the library from a pending row. */
export type RoomPendingSourceSnapshot = {
  sharedScope: SharedScope;
  /** Complete homepage room scope; legacy snapshots may omit it. */
  roomScope?: RoomScope;
  observationPeriod: RoomDateRange;
  historyPeriod: RoomDateRange;
  /** Homepage holdings table's local search and one-based page. */
  holdings: { query: string; page: number };
  /** Homepage pending table's one-based page. */
  pending: { page: number };
  /** Homepage history calendar context to restore after returning. */
  historyCalendar: { displayMonth: string; selectedDate: string | null };
  /** Legacy callers may still provide one shared query/page; new callers must use the scoped fields above. */
  query?: string;
  page?: number;
};

/** Public navigation contract for the shared "view all pending" action. */
export type PendingLibraryNavigationRequest = {
  reviewStatus: "pending";
  positionStatus: "closed";
  closeDateFrom: string;
  closeDateTo: string;
  sourceSnapshot: RoomPendingSourceSnapshot | null;
};

/** Public navigation contract for the homepage's closed-history entry. */
export type HistoryLibraryNavigationRequest = {
  reviewStatus: "all";
  positionStatus: "closed";
  closeDateFrom: string;
  closeDateTo: string;
  sourceSnapshot: RoomPendingSourceSnapshot | null;
};

export type PendingClosingFacts = {
  closingSide: TradeSide | null;
  quantity: string | null;
  weightedPrice: string | null;
  currency: string | null;
  reason: string | null;
};

function validDate(value: string | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function closingSideForEpisode(episode: TradeEpisode): TradeSide | null {
  if (episode.directionKnown === false) return null;
  return episode.direction === "long" ? "sell" : "buy";
}

function decimalValue(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() && decimal.gt(0) ? decimal : null;
  } catch {
    return null;
  }
}

function normalizedCurrency(value: string | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency;
}

function closingExecutions(episode: TradeEpisode): TradeExecution[] {
  const side = closingSideForEpisode(episode);
  return side === null ? [] : episode.executions.filter(execution => execution.side === side);
}

/**
 * Derives the close-side fill facts from episode-owned executions.  In
 * particular, this never reads `source.settlement`, because a source fill
 * that crossed zero may still carry the whole settlement amount.
 */
export function buildPendingClosingFacts(episode: TradeEpisode): PendingClosingFacts {
  const closingSide = closingSideForEpisode(episode);
  if (closingSide === null) {
    return { closingSide: null, quantity: null, weightedPrice: null, currency: null, reason: "closing-side-unavailable" };
  }
  const executions = closingExecutions(episode);
  if (executions.length === 0) {
    return { closingSide, quantity: null, weightedPrice: null, currency: null, reason: "closing-fill-unavailable" };
  }

  const currency = normalizedCurrency(episode.instrument.currency);
  let quantity = new Decimal(0);
  let notional = new Decimal(0);
  let priceUnavailable = false;
  for (const execution of executions) {
    const executionCurrency = normalizedCurrency(execution.instrument.currency);
    if (!currency || !executionCurrency || executionCurrency !== currency) {
      return { closingSide, quantity: null, weightedPrice: null, currency: currency || null, reason: "closing-currency-mismatch" };
    }
    const fillQuantity = decimalValue(execution.quantity);
    if (fillQuantity === null) {
      return { closingSide, quantity: null, weightedPrice: null, currency, reason: "closing-quantity-unavailable" };
    }
    quantity = quantity.plus(fillQuantity);
    const fillPrice = decimalValue(execution.price);
    if (fillPrice === null) {
      priceUnavailable = true;
      continue;
    }
    notional = notional.plus(fillQuantity.times(fillPrice));
  }
  if (quantity.isZero()) {
    return { closingSide, quantity: null, weightedPrice: null, currency, reason: "closing-quantity-unavailable" };
  }
  if (priceUnavailable) {
    return { closingSide, quantity: quantity.toString(), weightedPrice: null, currency, reason: "closing-price-unavailable" };
  }
  return {
    closingSide,
    quantity: quantity.toString(),
    weightedPrice: notional.div(quantity).toString(),
    currency,
    reason: null,
  };
}

/** Returns the final close trading day from the close-side execution evidence. */
export function pendingFinalCloseDate(episode: TradeEpisode): string {
  const executions = closingExecutions(episode).sort((left, right) => left.executedAt.localeCompare(right.executedAt));
  const finalExecution = executions.at(-1);
  const sourceDate = validDate(finalExecution?.source.tradingDate) ?? validDate(finalExecution?.source.marketCalendarDate);
  if (sourceDate) return sourceDate;
  if (finalExecution?.source.timePrecision === "date-only") {
    const dateOnly = validDate(finalExecution.executedAt);
    if (dateOnly) return dateOnly;
  }
  if (finalExecution?.executedAt) return marketTradingDate(finalExecution.executedAt, episode.instrument.market);
  const endedAt = validDate(episode.endedAt);
  return endedAt ?? marketTradingDate(episode.endedAt ?? episode.startedAt, episode.instrument.market);
}

export type RoomPendingReview = {
  episodeId: string; instrumentId: string; instrumentName: string; symbol: string;
  accountId: string; accountLabel: string; closeDate: string;
  closingSide: TradeSide | null; closingQuantity: string | null; closingWeightedPrice: string | null; closingCurrency: string | null;
  closingUnavailableReason: string | null;
  money: RoomMoneyView | null; unavailableReason: string | null;
};
export type RoomPendingReviewsModel = { rows: RoomPendingReview[]; count: number; queueIds: string[]; displayCurrency?: RoomDisplayCurrency };

/** Consumes the exact history scope but never drops a pending row for unreliable PnL. */
export function buildPendingReviews(rows: readonly TradingRoomRow[], fxSnapshot?: RoomFxSnapshot, targetCurrency?: RoomTargetCurrency): RoomPendingReviewsModel {
  const pending = rows.filter(({ row }) => row.item.episode.status === "closed" && reviewState(row.item) === "pending").map(scoped => {
    const episode = scoped.row.item.episode;
    const closingFacts = buildPendingClosingFacts(episode);
    const trustedPnl = scoped.trustedPnl;
    const pnlUnavailableReason = scoped.assetCategory === "unknown"
      ? "未知资产类型，未纳入收益汇总"
      : trustedPnl === null
        ? exclusionReasonLabel(scoped.exclusionReason ?? "pnl-unavailable")
        : null;
    const unavailableReason = [pnlUnavailableReason, closingFacts.reason]
      .filter((reason): reason is string => Boolean(reason))
      .join("；") || null;
    const canShowMoney = scoped.assetCategory !== "unknown" && trustedPnl !== null;
    return {
      episodeId: episode.id, instrumentId: episode.instrument.id, instrumentName: episode.instrument.name, symbol: episode.instrument.symbol,
      accountId: episode.accountId, accountLabel: episode.accountLabel || "未命名账户", closeDate: pendingFinalCloseDate(episode) ?? scoped.closeDate ?? dashboardEpisodeDate(scoped.row),
      closingSide: closingFacts.closingSide, closingQuantity: closingFacts.quantity, closingWeightedPrice: closingFacts.weightedPrice, closingCurrency: closingFacts.currency, closingUnavailableReason: closingFacts.reason,
      money: canShowMoney ? buildRoomMoneyView([{ currency: episode.instrument.currency, amount: trustedPnl }], fxSnapshot, targetCurrency) : null, unavailableReason,
    };
  }).sort((left, right) => right.closeDate.localeCompare(left.closeDate) || left.episodeId.localeCompare(right.episodeId));
  return { rows: pending, count: pending.length, queueIds: pending.map(row => row.episodeId), displayCurrency: targetCurrency ?? "original" };
}
