import Decimal from "decimal.js";

import type { FxSnapshot } from "../../lib/fx/contracts";
import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { displayTradeNature } from "../../lib/trades/trading-nature";
import {
  buildReviewQueue,
  normalizeBrokerIds,
  reviewQueueBrokerOptions,
  reviewQueueBrokerTags,
  type ReviewQueueFilter,
  type ReviewQueueItem,
  type ReviewQueueSort,
} from "../../lib/reviews/review-queue";
import {
  canSortLibraryPerformance,
  sortLibraryItems,
} from "../../lib/reviews/library-sorting";
import type {
  TradeLibraryEntry,
} from "../../lib/trades/library";
import type { TradeNature } from "../../lib/trades/types";

export type TradeLibraryBrowseMode = "queue" | "stocks";
export type TradeLibraryReviewStatus = "pending" | "completed" | "all";
export type TradeLibraryFilterValue = "all" | string;

/**
 * The one persisted source of truth for the two library views. `account` is
 * retained for the stock select and legacy callers; `accounts` is the shared
 * multi-select representation used by the queue.
 */
export type TradeLibraryBrowseState = {
  mode: TradeLibraryBrowseMode;
  selectedInstrumentId: string | null;
  selectedEpisodeId: string | null;
  expandedStockIds: string[];
  includeReviewedStockIds: string[];
  query: string;
  market: TradeLibraryFilterValue;
  account: TradeLibraryFilterValue;
  accounts: string[];
  brokers: string[];
  year: TradeLibraryFilterValue;
  tradeNature: TradeNature | "all";
  simulationRunId: TradeLibraryFilterValue;
  reviewStatus: TradeLibraryReviewStatus;
  sort: ReviewQueueSort;
  positionStatus: TradeLibraryFilterValue;
  dataStatus: TradeLibraryFilterValue;
  tag: TradeLibraryFilterValue;
  advancedExpanded: boolean;
  scrollTop: number;
  /** Current one-based page in the stock and round list views. */
  stockPage: number;
  roundPage: number;
};

/** Resolve legacy rows whose episode metadata predates explicit trade nature. */
export function tradeNatureForReviewRow(row: ReviewQueueItem): TradeNature {
  const entryNature = row.entry.tradeNature;
  if (entryNature) return entryNature;
  const episodeNature = row.item.episode.tradeNature;
  if (episodeNature) return episodeNature;
  const execution = row.item.episode.executions[0] ?? row.entry.executions[0];
  return execution ? displayTradeNature(execution) : "unknown";
}

type LegacyBrowseState = Partial<TradeLibraryBrowseState> & {
  view?: TradeLibraryBrowseMode;
  queueFilter?: ReviewQueueFilter;
};

function defaultStateForMode(mode: TradeLibraryBrowseMode): TradeLibraryBrowseState {
  return {
    mode,
    selectedInstrumentId: null,
    selectedEpisodeId: null,
    expandedStockIds: [],
    includeReviewedStockIds: [],
    query: "",
    market: "all",
    account: "all",
    accounts: [],
    brokers: [],
    year: "all",
    tradeNature: "live",
    simulationRunId: "all",
    reviewStatus: "all",
    sort: "newest",
    positionStatus: "all",
    dataStatus: "all",
    tag: "all",
    advancedExpanded: false,
    scrollTop: 0,
    stockPage: 1,
    roundPage: 1,
  };
}

function normalizePage(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export const DEFAULT_TRADE_LIBRARY_BROWSE_STATE = defaultStateForMode("stocks");

function selectedAccountIds(state: LegacyBrowseState, queueFilter?: ReviewQueueFilter) {
  if (state.accounts !== undefined) return [...state.accounts];
  if (queueFilter?.accounts !== undefined) return [...queueFilter.accounts];
  const account = state.account ?? queueFilter?.account;
  return account && account !== "all" ? [account] : [];
}

/** Accepts the pre-ticket queueFilter shape so a restored session keeps its range. */
export function normalizeTradeLibraryBrowseState(
  input?: LegacyBrowseState,
  defaultMode: TradeLibraryBrowseMode = "stocks",
): TradeLibraryBrowseState {
  const { queueFilter, view: legacyView, ...persisted } = input ?? {};
  const mode = persisted.mode ?? legacyView ?? defaultMode;
  const defaults = defaultStateForMode(mode);
  const accounts = selectedAccountIds(persisted, queueFilter);
  const account = persisted.account ?? queueFilter?.account ?? (accounts.length === 1 ? accounts[0] : defaults.account);
  return {
    ...defaults,
    ...persisted,
    mode,
    selectedInstrumentId: persisted.selectedInstrumentId ?? defaults.selectedInstrumentId,
    selectedEpisodeId: persisted.selectedEpisodeId ?? defaults.selectedEpisodeId,
    expandedStockIds: persisted.expandedStockIds ?? defaults.expandedStockIds,
    includeReviewedStockIds: persisted.includeReviewedStockIds ?? defaults.includeReviewedStockIds,
    query: persisted.query ?? queueFilter?.query ?? defaults.query,
    market: persisted.market ?? queueFilter?.market ?? defaults.market,
    account,
    accounts,
    brokers: normalizeBrokerIds(persisted.brokers ?? queueFilter?.brokers ?? defaults.brokers),
    year: persisted.year ?? queueFilter?.year ?? defaults.year,
    tradeNature: (persisted.tradeNature ?? queueFilter?.nature ?? defaults.tradeNature) as TradeLibraryBrowseState["tradeNature"],
    simulationRunId: persisted.simulationRunId ?? queueFilter?.simulationRunId ?? defaults.simulationRunId,
    reviewStatus: persisted.reviewStatus ?? queueFilter?.status ?? defaults.reviewStatus,
    sort: persisted.sort ?? queueFilter?.sort ?? defaults.sort,
    positionStatus: persisted.positionStatus ?? defaults.positionStatus,
    dataStatus: persisted.dataStatus ?? defaults.dataStatus,
    tag: persisted.tag ?? defaults.tag,
    advancedExpanded: persisted.advancedExpanded ?? queueFilter?.advancedExpanded ?? defaults.advancedExpanded,
    scrollTop: persisted.scrollTop ?? defaults.scrollTop,
    stockPage: normalizePage(persisted.stockPage, defaults.stockPage),
    roundPage: normalizePage(persisted.roundPage, defaults.roundPage),
  };
}

export function reviewQueueFilterForBrowseState(
  state: TradeLibraryBrowseState,
): ReviewQueueFilter {
  const accounts = state.accounts.length > 0
    ? state.accounts
    : state.account !== "all"
      ? [state.account]
      : undefined;
  return {
    status: state.reviewStatus,
    query: state.query,
    account: state.account,
    accounts,
    brokers: state.brokers,
    market: state.market,
    year: state.year,
    nature: state.tradeNature,
    simulationRunId: state.simulationRunId,
    sort: state.sort,
    advancedExpanded: state.advancedExpanded,
  };
}

/**
 * Return the stable identity of a filtered browse range.  Navigation-only
 * fields (selection, expansion, scroll and pagination) intentionally do not
 * participate, so returning to a previously visited range can reuse its
 * derived rows and stock model.
 */
export function tradeLibraryBrowseRangeKey(
  state: TradeLibraryBrowseState,
) {
  return JSON.stringify([
    state.query,
    state.market,
    state.account,
    [...state.accounts].sort(),
    normalizeBrokerIds(state.brokers).sort(),
    state.year,
    state.tradeNature,
    state.simulationRunId,
    state.reviewStatus,
    state.sort,
    state.positionStatus,
    state.dataStatus,
    state.tag,
  ]);
}

/**
 * Small LRU cache for derived browse ranges.  The cache is recreated by the
 * page when entries, reviews, market statuses or the FX snapshot identity
 * changes, so stale review/market/FX values cannot survive a source update.
 */
export function createTradeLibraryBrowseCache<T>(limit = 8) {
  const maxEntries = Math.max(1, Math.floor(limit));
  const values = new Map<string, T>();
  return {
    get(key: string) {
      const value = values.get(key);
      if (value !== undefined) {
        values.delete(key);
        values.set(key, value);
      }
      return value;
    },
    set(key: string, value: T) {
      values.delete(key);
      values.set(key, value);
      while (values.size > maxEntries) {
        const oldest = values.keys().next().value;
        if (oldest === undefined) break;
        values.delete(oldest);
      }
    },
    get size() {
      return values.size;
    },
  };
}

function executionTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function compareDateValues(left: string, right: string) {
  const leftTimestamp = executionTimestamp(left);
  const rightTimestamp = executionTimestamp(right);
  const leftKnown = Number.isFinite(leftTimestamp);
  const rightKnown = Number.isFinite(rightTimestamp);
  if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
  if (leftKnown && rightKnown && leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;
  return left.localeCompare(right);
}

function matchesDataStatus(
  entry: TradeLibraryEntry,
  dataStatus: TradeLibraryFilterValue,
  marketDataStatuses: Record<string, MarketDataSyncStatus>,
) {
  if (dataStatus === "all") return true;
  const status = marketDataStatuses[entry.instrument.id] ?? "not-requested";
  const complete = status === "complete" || status === "ready";
  return dataStatus === "complete" ? complete : !complete;
}

function isPerformanceSort(sort: ReviewQueueSort) {
  return sort === "net-profit" || sort === "net-loss" || sort === "return-high" || sort === "return-low";
}

/** Build the canonical episode set consumed by both stock and queue views. */
export function buildTradeLibraryBrowseRows(
  entries: TradeLibraryEntry[],
  state: TradeLibraryBrowseState,
  marketDataStatuses: Record<string, MarketDataSyncStatus>,
  fxSnapshot?: FxSnapshot | null,
): ReviewQueueItem[] {
  const filter = reviewQueueFilterForBrowseState(state);
  const brokerIds = normalizeBrokerIds(state.brokers);
  const rows = buildReviewQueue(entries, { ...filter, brokers: [], sort: "newest" }).filter(({ entry, item }) =>
    (brokerIds.length === 0 || reviewQueueBrokerTags({ entry, item }).some(tag => brokerIds.includes(tag.id))) &&
    (state.positionStatus === "all" || item.episode.status === state.positionStatus) &&
    (state.tag === "all" || item.confirmedTagIds.includes(state.tag)) &&
    matchesDataStatus(entry, state.dataStatus, marketDataStatuses),
  );
  const effectiveSort = isPerformanceSort(state.sort) &&
    !canSortLibraryPerformance(rows, state.simulationRunId).allowed
    ? "newest"
    : state.sort;
  return sortLibraryItems(
    rows.map(row => ({ id: row.item.episode.id, rows: [row], value: row })),
    effectiveSort,
    fxSnapshot ?? undefined,
  ).map(({ value }) => value);
}

function decimal(value: string | null) {
  if (value === null) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function aggregateNumber(values: Array<string | null>) {
  if (values.some(value => decimal(value) === null)) return null;
  return values.reduce((total, value) => total.plus(value as string), new Decimal(0));
}

type TradeLibraryStockAggregateOptions = {
  /** Keep legacy net/return aggregation for callers that still need it. */
  includeFinancial?: boolean;
  /** Keep the small cumulative-R display value used by stock rows. */
  includeCumulativeR?: boolean;
};

/** Aggregate only the already matched episodes, keeping each episode identity. */
export function aggregateTradeLibraryStocks(
  rows: ReviewQueueItem[],
  options: TradeLibraryStockAggregateOptions = {},
): TradeLibraryEntry[] {
  const includeFinancial = options.includeFinancial ?? true;
  const includeCumulativeR = options.includeCumulativeR ?? includeFinancial;
  const grouped = new Map<string, { template: TradeLibraryEntry; rows: ReviewQueueItem[] }>();
  for (const row of rows) {
    const key = row.entry.instrument.id;
    const group = grouped.get(key) ?? { template: row.entry, rows: [] };
    group.rows.push(row);
    grouped.set(key, group);
  }

  return [...grouped.values()].map(({ template, rows: groupRows }) => {
    const items = groupRows.map(row => row.item);
    const executions = items.flatMap(item => item.episode.executions);
    const natures = new Set(groupRows.map(tradeNatureForReviewRow));
    const simulationRuns = new Set(items.map(item => item.episode.simulationRunId ?? template.simulationRunId).filter((value): value is string => Boolean(value)));
    const comparablePerformance = natures.size === 1 && simulationRuns.size <= 1;
    const netPnlValues = includeFinancial ? items.map(item => item.metrics.netPnl) : [];
    const netPnl = includeFinancial && comparablePerformance && items.every(item => item.metrics.pnlAvailable !== false)
      ? aggregateNumber(netPnlValues)
      : null;
    const grossExposure = includeFinancial && comparablePerformance
      ? aggregateNumber(items.map(item => item.metrics.grossExposure))
      : null;
    const returnPercent = netPnl && grossExposure && !grossExposure.isZero()
      ? netPnl.div(grossExposure).times(100).toString()
      : null;
    const rMultiple = includeCumulativeR && comparablePerformance
      ? aggregateNumber(items.map(item => item.rMultiple))
      : null;
    const timestamps = executions.map(execution => execution.executedAt).sort(compareDateValues);
    const firstTradeAt = timestamps[0] ?? items.map(item => item.episode.startedAt).sort(compareDateValues)[0] ?? template.firstTradeAt;
    const episodeDates = items
      .map(item => item.episode.endedAt ?? item.episode.startedAt)
      .sort(compareDateValues);
    const lastTradeAt = timestamps.at(-1) ?? episodeDates.at(-1) ?? template.lastTradeAt;
    return {
      ...template,
      scopeKey: undefined,
      groupId: `${template.instrument.id}|filtered-stock`,
      tradingLabel: natures.size === 1 ? template.tradingLabel : undefined,
      tradeNature: natures.size === 1 ? [...natures][0] as TradeNature : "unknown",
      simulationRunId: simulationRuns.size === 1 ? [...simulationRuns][0] : undefined,
      executions,
      episodes: items,
      accountCount: new Set(executions.map(execution => execution.accountId)).size,
      tradeCount: executions.length,
      episodeCount: items.length,
      firstTradeAt,
      lastTradeAt,
      status: items.some(item => item.episode.status === "open") ? "open" : "closed",
      netPnl: netPnl?.toString() ?? null,
      returnPercent,
      reviewedEpisodeCount: items.filter(item => item.reviewStatus === "completed").length,
      confirmedTagIds: [...new Set(items.flatMap(item => item.confirmedTagIds))],
      cumulativeR: rMultiple?.toString() ?? null,
    };
  });
}

/**
 * Build stock display entries without recalculating legacy net/return totals.
 * The current stock view reads the trusted performance module for financial
 * values; it only needs the aggregate identity, counts, dates, tags and
 * cumulative-R display value here.
 */
export function aggregateTradeLibraryStockDisplayEntries(
  rows: ReviewQueueItem[],
): TradeLibraryEntry[] {
  return aggregateTradeLibraryStocks(rows, {
    includeFinancial: false,
    includeCumulativeR: true,
  });
}

export function resetTradeLibraryBrowseState(
  state: TradeLibraryBrowseState,
): TradeLibraryBrowseState {
  return {
    ...state,
    query: "",
    market: "all",
    account: "all",
    accounts: [],
    brokers: [],
    year: "all",
    simulationRunId: "all",
    reviewStatus: "all",
    sort: "newest",
    positionStatus: "all",
    dataStatus: "all",
    tag: "all",
    advancedExpanded: false,
    includeReviewedStockIds: [],
    stockPage: 1,
    roundPage: 1,
  };
}

function selectedIds(state: TradeLibraryBrowseState) {
  return state.accounts.length > 0
    ? state.accounts
    : state.account !== "all"
      ? [state.account]
      : [];
}

/**
 * Change the always-visible nature filter and remove only incompatible
 * advanced conditions. The returned labels are suitable for the user notice.
 */
export function applyTradeNature(
  state: TradeLibraryBrowseState,
  tradeNature: TradeNature | "all",
  entries: TradeLibraryEntry[],
) {
  const compatibleRows = buildReviewQueue(entries, {
    status: "all",
    nature: tradeNature,
  });
  const compatibleBrokerIds = new Set(compatibleRows.flatMap(reviewQueueBrokerTags).map(tag => tag.id));
  const selectedBrokerIds = normalizeBrokerIds(state.brokers);
  const compatibleAccountIds = new Set(compatibleRows.map(row => row.item.episode.accountId));
  const compatibleRunIds = new Set(compatibleRows.map(row => row.item.episode.simulationRunId ?? row.entry.simulationRunId).filter((value): value is string => Boolean(value)));
  const cleared: string[] = [];
  const brokers = selectedBrokerIds.filter(id => {
    if (compatibleBrokerIds.has(id)) return true;
    cleared.push(`来源平台 ${reviewQueueBrokerOptions(entries).find(option => option.id === id)?.label ?? id}`);
    return false;
  });
  const accounts = selectedIds(state).filter(id => {
    if (compatibleAccountIds.has(id)) return true;
    cleared.push(`账户 ${id}`);
    return false;
  });
  let simulationRunId = state.simulationRunId;
  if (simulationRunId !== "all" && !compatibleRunIds.has(simulationRunId)) {
    cleared.push(`模拟运行 ${simulationRunId}`);
    simulationRunId = "all";
  }
  return {
    state: {
      ...state,
      tradeNature,
      brokers,
      accounts,
      account: accounts.length === 1 ? accounts[0] : "all",
      simulationRunId,
    },
    cleared,
  };
}
