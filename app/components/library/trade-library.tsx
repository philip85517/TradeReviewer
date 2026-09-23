"use client";

import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Clock3,
  Database,
  RefreshCw,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { aggregateCandles } from "../../lib/market/aggregate";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { FxSnapshot } from "../../lib/fx/contracts";
import {
  marketDataStatusLabel,
  type MarketDataSyncStatus,
} from "../../lib/market/sync-status";
import {
  formatMarketTradingDate,
  marketTradingDate,
} from "../../lib/market/trading-date";
import { formatBeijingDateTime } from "../../lib/replay/format-time";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { reviewTagLabel } from "../../lib/reviews/review-tags";
import {
  dailyRecordToChartCandle,
  type Timeframe,
} from "../../lib/market/types";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../../lib/trades/library";
import { ReplayChart } from "../chart/replay-chart";
import { EpisodeReviewEditor } from "../review/episode-review-editor";
import type { EpisodeNotesProps } from "../review/episode-notes-panel";
import type { TradeEpisode } from "../../lib/trades/types";
import { executionFeeCurrency } from "../../lib/trades/types";
import {
  REVIEW_QUEUE_SORT_OPTIONS,
  reviewState,
  type ReviewQueueFilter,
  type ReviewQueueItem,
  type ReviewQueueSort,
} from "../../lib/reviews/review-queue";
import {
  canSortLibraryPerformance,
  sortLibraryItems,
} from "../../lib/reviews/library-sorting";
import {
  summarizeLibraryPerformance,
  type LibraryPerformanceSummary,
} from "../../lib/reviews/library-performance";
import {
  dashboardMarketFilterOptions,
} from "../../lib/reviews/dashboard";
import { ReviewQueue } from "./review-queue";
import { LibraryFilterDrawer } from "./library-filter-drawer";
import {
  buildLibraryFilterOptions,
  formatBrokerLabel,
  formatSimulationRunLabel,
} from "./library-filter-options";
import {
  buildTradeLibraryStockGroups,
  LibraryStockRounds,
  type TradeLibraryStockGroup,
} from "./library-stock-rounds";
import {
  aggregateTradeLibraryStockDisplayEntries,
  applyTradeNature,
  buildTradeLibraryBrowseRows,
  createTradeLibraryBrowseCache,
  normalizeTradeLibraryBrowseState,
  resetTradeLibraryBrowseState,
  reviewQueueFilterForBrowseState,
  tradeLibraryBrowseRangeKey,
  type TradeLibraryBrowseState,
} from "./library-browse-state";
import { FxRatesControl } from "./fx-rates-control";
import { LibraryPerformanceSummaryView } from "./library-performance-summary";
import type { SharedScope } from "../../lib/reviews/shared-scope";
import { SharedScopeBar } from "../scope/shared-scope-bar";
import "./trade-library.css";

export type { TradeLibraryBrowseState } from "./library-browse-state";

type Props = {
  defaultMode?: "queue" | "stocks";
  reviewExtras?: (episode: TradeEpisode) => Pick<EpisodeNotesProps, "ruleContent" | "suggestions">;
  initialBrowseState?: TradeLibraryBrowseState;
  onBrowseStateChange?: (state: TradeLibraryBrowseState) => void;
  entries: TradeLibraryEntry[];
  candlesByInstrument: Record<string, DailyCandleRecord[]>;
  marketDataStatuses: Record<string, MarketDataSyncStatus>;
  marketDataLabels?: Record<string, string>;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onOpenInReview: (instrumentId: string, episodeId: string, queueIds?: string[]) => void;
  onImport?: () => void;
  onInspectData?: (instrumentId: string, accountId: string) => void;
  onRefreshMarketData?: (instrumentId: string) => void;
  onSaveReview: (record: EpisodeReviewRecord) => void | Promise<void>;
  reviewsHydrated: boolean;
  target?: TradeLibraryTarget;
  sharedScope?: SharedScope;
  onSharedScopeChange?: (patch: Partial<SharedScope>) => void;
  sharedAccountOptions?: readonly { id: string; label: string }[];
};

function entryKey(entry: TradeLibraryEntry) {
  return `${entry.instrument.id}|${entry.scopeKey ?? "legacy"}`;
}

function natureLabel(nature: TradeLibraryEntry["tradeNature"]) {
  return nature === "simulation" ? "模拟盘" : nature === "live" ? "实盘" : "来源未知";
}

export type TradeLibraryTarget = {
  requestId: number;
  instrumentId: string;
  episodeId: string;
  scopeKey?: string;
};

type AdvancedFilterKind = "broker" | "account" | "year" | "simulationRunId" | "positionStatus" | "dataStatus" | "tag";
type AppliedFilterChip = {
  key: string;
  label: string;
  kind: AdvancedFilterKind;
  value?: string;
};

const PAGINATION_RESET_KEYS: ReadonlySet<keyof TradeLibraryBrowseState> = new Set([
  "query",
  "market",
  "account",
  "accounts",
  "brokers",
  "year",
  "tradeNature",
  "simulationRunId",
  "reviewStatus",
  "sort",
  "positionStatus",
  "dataStatus",
  "tag",
]);

function AppliedFilterChips({
  chips,
  onRemove,
}: {
  chips: AppliedFilterChip[];
  onRemove: (kind: AdvancedFilterKind, value?: string) => void;
}) {
  if (chips.length === 0) return null;
  return <div className="library-active-filter-chips" aria-label="已应用筛选">
    {chips.map(({ key, label, kind, value }) => <span className="library-filter-chip" key={key}>
      {label}
      <button type="button" aria-label={`移除${label}`} onClick={() => onRemove(kind, value)}>×</button>
    </span>)}
  </div>;
}

function money(value: string | null, currency: string) {
  if (value === null) return "数据待补齐";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

function feeCurrency(executions: TradeEpisode["executions"]): string | undefined {
  const currencies = new Set(executions.map(executionFeeCurrency));
  return currencies.size === 1 ? [...currencies][0] : undefined;
}

function feeLabel(execution: TradeEpisode["executions"][number]) {
  return execution.source.feeStatus === "unknown"
    ? "待核对"
    : `${execution.fee} ${executionFeeCurrency(execution)}`;
}

function isPerformanceSort(sort: ReviewQueueSort) {
  return sort === "net-profit" || sort === "net-loss" || sort === "return-high" || sort === "return-low";
}

function episodeLabel(
  item: TradeLibraryEpisode,
  chronologicalNumber: number,
) {
  const { episode, metrics } = item;
  return `第 ${chronologicalNumber} 次交易 · ${
    episode.directionKnown === false || episode.accuracy?.reasons.includes("ambiguous-opening") ? "方向待核对" : episode.direction === "long" ? "多头" : "空头"
  } · ${metrics.buyCount} 买 / ${metrics.sellCount} 卖`;
}

const LIBRARY_DISPLAY_PAGE_SIZE = 100;

function pageSlice<T>(items: readonly T[], page: number) {
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const start = (currentPage - 1) * LIBRARY_DISPLAY_PAGE_SIZE;
  return items.slice(start, start + LIBRARY_DISPLAY_PAGE_SIZE);
}

export type LibraryDisplayMetricSelection = {
  mode: "queue" | "stocks";
  queueRows: ReviewQueueItem[];
  roundPage: number;
  stockGroups: TradeLibraryStockGroup[];
  stockPage: number;
  expandedStockIds: readonly string[];
  includeReviewedStockIds: readonly string[];
  reviewStatus: TradeLibraryBrowseState["reviewStatus"];
};

/**
 * Select rows whose financial values are visible in the current list state.
 * Full rows remain available to summaries, sorting and review traversal; this
 * bounded set prevents hidden pages from doing display-only metric work.
 */
export function selectLibraryDisplayMetricRows({
  mode,
  queueRows,
  roundPage,
  stockGroups,
  stockPage,
  expandedStockIds,
  includeReviewedStockIds,
  reviewStatus,
}: LibraryDisplayMetricSelection): ReviewQueueItem[] {
  if (mode === "queue") return pageSlice(queueRows, roundPage);

  const expanded = new Set(expandedStockIds);
  const rows: ReviewQueueItem[] = [];
  for (const group of pageSlice(stockGroups, stockPage)) {
    const instrumentId = group.entry.instrument.id;
    if (!expanded.has(instrumentId)) continue;
    const locallyIncluded = reviewStatus !== "all" && includeReviewedStockIds.includes(instrumentId);
    rows.push(...(locallyIncluded ? group.allRows : group.rows));
  }
  return rows;
}

function displayEpisodePerformance(
  rows: readonly ReviewQueueItem[],
  fxSnapshot: FxSnapshot | null,
) {
  const performance = new Map<string, LibraryPerformanceSummary>();
  for (const row of rows) {
    performance.set(
      row.item.episode.id,
      summarizeLibraryPerformance([row], fxSnapshot ?? undefined),
    );
  }
  return performance;
}

function displayInstrumentPerformance(
  groups: readonly TradeLibraryStockGroup[],
  fxSnapshot: FxSnapshot | null,
) {
  const performance = new Map<string, LibraryPerformanceSummary>();
  for (const group of groups) {
    performance.set(
      group.entry.instrument.id,
      summarizeLibraryPerformance(group.rows, fxSnapshot ?? undefined),
    );
  }
  return performance;
}

type TradeLibraryBrowseDerivedModel = {
  browseRows: ReviewQueueItem[];
  allStatusBrowseRows: ReviewQueueItem[];
  filteredEntries: TradeLibraryEntry[];
  rawStockGroups: TradeLibraryStockGroup[];
  performanceSummary: LibraryPerformanceSummary;
  performanceSortAvailability: ReturnType<typeof canSortLibraryPerformance>;
  reviewedCount: number;
};

export function TradeLibrary({
  entries,
  candlesByInstrument,
  marketDataStatuses,
  marketDataLabels,
  timeframe,
  onTimeframeChange,
  onOpenInReview,
  onImport,
  onSaveReview,
  onInspectData,
  onRefreshMarketData,
  reviewsHydrated,
  target,
  initialBrowseState,
  onBrowseStateChange,
  defaultMode = "stocks",
  reviewExtras,
  sharedScope,
  onSharedScopeChange,
  sharedAccountOptions,
}: Props) {
  const [browseState, setBrowseState] = useState<TradeLibraryBrowseState>(() => {
    const normalized = normalizeTradeLibraryBrowseState(initialBrowseState, defaultMode);
    return target
      ? {
          ...normalized,
          selectedInstrumentId: target.instrumentId,
          selectedEpisodeId: target.episodeId,
        }
      : normalized;
  });
  const {
    mode,
    selectedInstrumentId,
    selectedEpisodeId,
    expandedStockIds,
    includeReviewedStockIds,
    query,
    market,
    account,
    accounts,
    brokers,
    year,
    tradeNature,
    simulationRunId,
    reviewStatus,
    sort,
    positionStatus,
    dataStatus,
    tag,
    scrollTop,
    stockPage,
    roundPage,
  } = browseState;
  const updateBrowseState = (patch: Partial<TradeLibraryBrowseState>) =>
    setBrowseState(current => {
      const next = { ...current, ...patch };
      const filterChanged = Object.keys(patch).some(key => PAGINATION_RESET_KEYS.has(key as keyof TradeLibraryBrowseState));
      if (filterChanged) {
        next.stockPage = 1;
        next.roundPage = 1;
      }
      return next;
    });
  const [queueNotice, setQueueNotice] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [fxSnapshot, setFxSnapshot] = useState<FxSnapshot | null>(null);
  const processedIds = useRef(new Set<string>());
  const reopenedIds = useRef(new Set<string>());
  const sectionRef = useRef<HTMLElement>(null);
  const browseTabFocusMode = useRef<TradeLibraryBrowseState["mode"] | null>(null);
  useLayoutEffect(() => {
    onBrowseStateChange?.(browseState);
  }, [browseState, onBrowseStateChange]);
  useLayoutEffect(() => {
    if (!browseTabFocusMode.current) return;
    sectionRef.current
      ?.querySelector<HTMLButtonElement>(`[data-mode="${browseTabFocusMode.current}"]`)
      ?.focus();
    browseTabFocusMode.current = null;
  }, [mode]);
  useLayoutEffect(() => {
    if (!selectedInstrumentId && sectionRef.current) sectionRef.current.scrollTop = scrollTop;
    // Restore only when returning to the list; scrolling itself must not reposition it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstrumentId]);

  const selectedEntry = entries.find(
    (entry) => entryKey(entry) === selectedInstrumentId
      || (entry.instrument.id === selectedInstrumentId && (!selectedEpisodeId || entry.episodes.some(item=>item.episode.id===selectedEpisodeId))),
  );
  const selectedEpisode = selectedEpisodeId
    ? selectedEntry?.episodes.find(({ episode }) => episode.id === selectedEpisodeId)
    : selectedEntry?.episodes[0];
  const selectionMissing = Boolean(selectedInstrumentId && (!selectedEntry || !selectedEpisode));

  const filterOptions = useMemo(
    () => ({
      markets: [...new Set(entries.map((entry) => entry.instrument.market))],
      marketOptions: dashboardMarketFilterOptions(entries),
      accounts: [
        ...new Map(
          entries
            .flatMap((entry) => entry.executions)
            .map((execution) => [
              execution.accountId,
              {
                id: execution.accountId,
                label: execution.accountLabel,
              },
            ]),
        ).values(),
      ],
      years: [
        ...new Set(
          entries.flatMap((entry) =>
            entry.executions.map((execution) =>
              marketTradingDate(
                execution.executedAt,
                execution.instrument.market,
              ).slice(0, 4),
            ),
          ),
        ),
      ].sort((a, b) => b.localeCompare(a)),
      simulationRuns: [
        ...new Map(
          entries
            .filter(
              (entry) =>
                entry.tradeNature === "simulation" &&
                entry.simulationRunId,
            )
            .map((entry) => [
              entry.simulationRunId as string,
              entry.simulationRunId as string,
            ]),
        ).values(),
      ],
    }),
    [entries],
  );
  const advancedOptions = useMemo(
    () => buildLibraryFilterOptions(entries),
    [entries],
  );

  // The workspace owns nature/account/run. Derive the browse state from that
  // scope so the stock rows and queue cannot keep stale page-local values.
  const effectiveTradeNature = (sharedScope?.nature ?? tradeNature) as TradeLibraryBrowseState["tradeNature"];
  const sharedAccountIds = sharedScope?.accountIds;
  const effectiveAccounts = useMemo(
    () => sharedAccountIds ? [...sharedAccountIds] : accounts,
    [accounts, sharedAccountIds],
  );
  const effectiveAccount = sharedScope
    ? (sharedScope.accountIds.length === 1 ? sharedScope.accountIds[0]! : "all")
    : account;
  const effectiveSimulationRunId: TradeLibraryBrowseState["simulationRunId"] = sharedScope
    ? (sharedScope.nature === "simulation" && sharedScope.simulationRunId ? sharedScope.simulationRunId : "all")
    : simulationRunId;

  // Keep expansion, selection and scroll state out of the filter derivation.
  // Those interactions should not rebuild the 5,000-row browse model.
  const browseFilterState = useMemo<TradeLibraryBrowseState>(
    () => ({
      mode: "stocks",
      selectedInstrumentId: null,
      selectedEpisodeId: null,
      expandedStockIds: [],
      includeReviewedStockIds: [],
      query,
      market,
      account: effectiveAccount,
      accounts: [...effectiveAccounts],
      brokers: [...brokers],
      year,
      tradeNature: effectiveTradeNature,
      simulationRunId: effectiveSimulationRunId,
      reviewStatus,
      sort,
      positionStatus,
      dataStatus,
      tag,
      advancedExpanded: false,
      scrollTop: 0,
      stockPage: 1,
      roundPage: 1,
    }),
    [
      brokers,
      dataStatus,
      market,
      positionStatus,
      query,
      reviewStatus,
      sort,
      tag,
      year,
      effectiveAccount,
      effectiveAccounts,
      effectiveSimulationRunId,
      effectiveTradeNature,
    ],
  );
  const allStatusFilterState = useMemo<TradeLibraryBrowseState>(
    () => ({ ...browseFilterState, reviewStatus: "all" }),
    [browseFilterState],
  );

  const browseModelSource = useMemo(
    () => ({ entries, fxSnapshot, marketDataStatuses, reviewsHydrated }),
    [entries, fxSnapshot, marketDataStatuses, reviewsHydrated],
  );
  // Recreate the bounded cache whenever source identities change; this is the
  // invalidation boundary for reviews, market status and FX values.
  const browseModelCache = useMemo(
    () => createTradeLibraryBrowseCache<TradeLibraryBrowseDerivedModel>(8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [browseModelSource],
  );
  const browseModel = useMemo(() => {
    const key = tradeLibraryBrowseRangeKey(browseFilterState);
    const cached = browseModelCache.get(key);
    if (cached) return cached;

    const browseRows = buildTradeLibraryBrowseRows(
      entries,
      browseFilterState,
      marketDataStatuses,
      fxSnapshot,
    );
    const allStatusBrowseRows = reviewStatus === "all"
      ? browseRows
      : buildTradeLibraryBrowseRows(
          entries,
          allStatusFilterState,
          marketDataStatuses,
          fxSnapshot,
        );
    const filteredEntries = aggregateTradeLibraryStockDisplayEntries(browseRows);
    const model: TradeLibraryBrowseDerivedModel = {
      browseRows,
      allStatusBrowseRows,
      filteredEntries,
      rawStockGroups: buildTradeLibraryStockGroups(
        browseRows,
        allStatusBrowseRows,
        filteredEntries,
      ),
      performanceSummary: summarizeLibraryPerformance(
        browseRows,
        fxSnapshot ?? undefined,
      ),
      performanceSortAvailability: canSortLibraryPerformance(
        browseRows,
        effectiveSimulationRunId,
      ),
      reviewedCount: allStatusBrowseRows.filter(
        row => reviewState(row.item) === "completed",
      ).length,
    };
    browseModelCache.set(key, model);
    return model;
  }, [
    allStatusFilterState,
    browseFilterState,
    browseModelCache,
    entries,
    fxSnapshot,
    marketDataStatuses,
    reviewStatus,
    effectiveSimulationRunId,
  ]);
  const {
    browseRows,
    allStatusBrowseRows,
    filteredEntries,
    rawStockGroups,
    performanceSummary,
    performanceSortAvailability,
    reviewedCount,
  } = browseModel;
  const pendingBrowseRows = useMemo(
    () => browseRows.filter(row => reviewState(row.item) === "pending"),
    [browseRows],
  );
  const effectiveSort = isPerformanceSort(sort) && !performanceSortAvailability.allowed
    ? "newest"
    : sort;
  const queueFilter = reviewQueueFilterForBrowseState({
    ...browseState,
    sort: effectiveSort,
    tradeNature: effectiveTradeNature,
    simulationRunId: effectiveSimulationRunId,
    accounts: [...effectiveAccounts],
    account: effectiveAccount,
  });
  const stockGroups = useMemo(
    () => sortLibraryItems(
      rawStockGroups.map(group => ({
        id: group.entry.instrument.id,
        rows: group.rows,
        value: group,
      })),
      effectiveSort,
      fxSnapshot ?? undefined,
    ).map(({ value }) => value),
    [effectiveSort, fxSnapshot, rawStockGroups],
  );
  const visibleStockGroups = useMemo(
    () => pageSlice(stockGroups, stockPage),
    [stockGroups, stockPage],
  );
  const displayMetricRows = useMemo(
    () => selectLibraryDisplayMetricRows({
      mode,
      queueRows: browseRows,
      roundPage,
      stockGroups,
      stockPage,
      expandedStockIds,
      includeReviewedStockIds,
      reviewStatus,
    }),
    [browseRows, expandedStockIds, includeReviewedStockIds, mode, reviewStatus, roundPage, stockGroups, stockPage],
  );
  const performanceByInstrument = useMemo(
    () => mode === "stocks"
      ? displayInstrumentPerformance(visibleStockGroups, fxSnapshot)
      : new Map<string, LibraryPerformanceSummary>(),
    [fxSnapshot, mode, visibleStockGroups],
  );
  const performanceByEpisode = useMemo(
    () => displayEpisodePerformance(displayMetricRows, fxSnapshot),
    [displayMetricRows, fxSnapshot],
  );
  const performanceGroupLabels = useMemo(
    () => Object.fromEntries(
      advancedOptions.simulationRuns.map(option => [
        `simulation|${encodeURIComponent(option.id)}`,
        option.label,
      ]),
    ),
    [advancedOptions.simulationRuns],
  );
  const detailRows = mode === "stocks" && selectedEntry
    ? browseRows.filter(row => entryKey(row.entry) === entryKey(selectedEntry))
    : browseRows;
  const queueRows = detailRows;
  const detailIds = new Set(queueRows.map(row => row.item.episode.id));
  const openQueued = ({entry,item}: ReviewQueueItem, requestedQueueIds?: string[]) => {
    if (processedIds.current.has(item.episode.id)) reopenedIds.current.add(item.episode.id);
    processedIds.current.delete(item.episode.id);
    updateBrowseState({
      selectedInstrumentId: entryKey(entry),
      selectedEpisodeId: item.episode.id,
    });
    setQueueNotice("");
    onOpenInReview(
      entry.instrument.id,
      item.episode.id,
      requestedQueueIds ?? queueRows.map(row => row.item.episode.id),
    );
  };
  const continueReview = () => {
    if (selectedEpisodeId) processedIds.current.add(selectedEpisodeId);
    const currentIndex = queueRows.findIndex(row => row.item.episode.id === selectedEpisode?.episode.id);
    const next = queueRows.slice(Math.max(currentIndex + 1, 0)).find(row => reviewState(row.item) === "pending" && !processedIds.current.has(row.item.episode.id))
      ?? queueRows.slice(0, Math.max(currentIndex, 0)).find(row => reopenedIds.current.has(row.item.episode.id) && reviewState(row.item) === "pending");
    if (next) openQueued(next);
    else {
      updateBrowseState({
        selectedInstrumentId: null,
        selectedEpisodeId: null,
        mode: "queue",
      });
      setQueueNotice("本轮复盘已完成。可以回看结论，或到阶段总结整理下一步。");
    }
  };

  const updateSort = (next: ReviewQueueSort) => {
    if (isPerformanceSort(next)) {
      const availability = canSortLibraryPerformance(browseRows, simulationRunId);
      if (!availability.allowed) {
        updateBrowseState({ sort: "newest" });
        setQueueNotice(`当前范围无法按绩效排序：${availability.reason ?? "请缩小统计范围"}。`);
        return;
      }
    }
    updateBrowseState({ sort: next });
    setQueueNotice("");
  };

  const updateQueueFilter = (next: ReviewQueueFilter) => {
    const accounts = next.accounts ?? (
      next.account && next.account !== "all" ? [next.account] : []
    );
    const nextRun = next.simulationRunId ?? "all";
    const clearedSimulationRun = nextRun === "all" && browseState.simulationRunId !== "all";
    updateBrowseState({
      query: next.query ?? "",
      market: next.market ?? "all",
      account: accounts.length === 1 ? accounts[0] : "all",
      accounts,
      brokers: next.brokers ?? [],
      year: next.year ?? "all",
      tradeNature: (next.nature ?? "all") as TradeLibraryBrowseState["tradeNature"],
      simulationRunId: nextRun,
      reviewStatus: next.status ?? "all",
      sort: clearedSimulationRun && isPerformanceSort(sort) ? "newest" : next.sort ?? "newest",
      advancedExpanded: next.advancedExpanded ?? false,
    });
    processedIds.current.clear();
    reopenedIds.current.clear();
  };

  const changeTradeNature = (value: TradeLibraryBrowseState["tradeNature"]) => {
    const changed = applyTradeNature(browseState, value, entries);
    if (isPerformanceSort(sort) && changed.cleared.some(label => label.startsWith("模拟运行"))) {
      changed.state.sort = "newest";
    }
    const friendlyCleared = changed.cleared.map(label => {
      if (label.startsWith("账户 ")) {
        const id = label.slice("账户 ".length);
        return `账户 ${accountLabels.get(id) ?? id}`;
      }
      if (label.startsWith("模拟运行 ")) {
        const id = label.slice("模拟运行 ".length);
        return `模拟运行 ${runLabels.get(id) ?? formatSimulationRunLabel(id)}`;
      }
      return label;
    });
    updateBrowseState(changed.state);
    setQueueNotice(
      friendlyCleared.length > 0
        ? `已切换为${value === "live" ? "实盘" : value === "simulation" ? "模拟盘" : value === "unknown" ? "来源未知" : "全部性质"}，已清除：${friendlyCleared.join("、")}`
        : "",
    );
    processedIds.current.clear();
    reopenedIds.current.clear();
  };

  const resetBrowseFilters = () => {
    updateBrowseState(resetTradeLibraryBrowseState(browseState));
    setQueueNotice("");
    processedIds.current.clear();
    reopenedIds.current.clear();
  };

  const applyAdvancedFilters = (patch: Partial<TradeLibraryBrowseState>) => {
    const accounts = patch.accounts ?? browseState.accounts;
    const clearedSimulationRun = patch.simulationRunId === "all" && browseState.simulationRunId !== "all";
    updateBrowseState({
      ...patch,
      accounts,
      account: patch.account ?? (accounts.length === 1 ? accounts[0] : "all"),
      sort: clearedSimulationRun && isPerformanceSort(sort) ? "newest" : patch.sort ?? sort,
    });
    if (sharedScope && onSharedScopeChange && patch.accounts) {
      onSharedScopeChange({ accountIds: [...accounts] });
    }
    processedIds.current.clear();
    reopenedIds.current.clear();
    setQueueNotice("");
    setFilterDrawerOpen(false);
  };

  const advancedFilterCount = [
    ...browseState.brokers,
    ...browseState.accounts,
    browseState.year !== "all" ? browseState.year : "",
    browseState.simulationRunId !== "all" ? browseState.simulationRunId : "",
    browseState.positionStatus !== "all" ? browseState.positionStatus : "",
    browseState.dataStatus !== "all" ? browseState.dataStatus : "",
    browseState.tag !== "all" ? browseState.tag : "",
  ].filter(Boolean).length;

  const startReview = () => {
    const firstPending = pendingBrowseRows[0];
    if (!firstPending) return;
    openQueued(firstPending, browseRows.map(row => row.item.episode.id));
  };

  const removeAdvancedFilter = (
    kind: AdvancedFilterKind,
    value?: string,
  ) => {
    const patch: Partial<TradeLibraryBrowseState> = {};
    if (kind === "broker" && value) patch.brokers = browseState.brokers.filter(id => id !== value);
    if (kind === "account" && value) {
      const accounts = browseState.accounts.filter(id => id !== value);
      patch.accounts = accounts;
      patch.account = accounts.length === 1 ? accounts[0] : "all";
    }
    if (kind === "year") patch.year = "all";
    if (kind === "simulationRunId") {
      patch.simulationRunId = "all";
      if (sort === "net-profit" || sort === "net-loss" || sort === "return-high" || sort === "return-low") {
        patch.sort = "newest";
      }
    }
    if (kind === "positionStatus") patch.positionStatus = "all";
    if (kind === "dataStatus") patch.dataStatus = "all";
    if (kind === "tag") patch.tag = "all";
    updateBrowseState(patch);
    setQueueNotice("");
    processedIds.current.clear();
    reopenedIds.current.clear();
  };

  const accountLabels = new Map(advancedOptions.accounts.map(option => [option.id, option.label]));
  const runLabels = new Map(advancedOptions.simulationRuns.map(option => [option.id, option.label]));
  const appliedFilterChips = [
    ...browseState.brokers.map(id => ({
      key: `broker:${id}`,
      label: `来源平台：${advancedOptions.brokers.find(option => option.id === id)?.label ?? formatBrokerLabel(id)}`,
      kind: "broker" as const,
      value: id,
    })),
    ...browseState.accounts.map(id => ({
      key: `account:${id}`,
      label: `账户：${accountLabels.get(id) ?? id}`,
      kind: "account" as const,
      value: id,
    })),
    ...(browseState.year !== "all" ? [{
      key: "year",
      label: `年份：${browseState.year}`,
      kind: "year" as const,
    }] : []),
    ...(browseState.simulationRunId !== "all" ? [{
      key: "simulationRunId",
      label: `模拟运行：${runLabels.get(browseState.simulationRunId) ?? formatSimulationRunLabel(browseState.simulationRunId)}`,
      kind: "simulationRunId" as const,
      value: browseState.simulationRunId,
    }] : []),
    ...(browseState.positionStatus !== "all" ? [{
      key: "positionStatus",
      label: `持仓状态：${browseState.positionStatus === "open" ? "持仓中" : "已平仓"}`,
      kind: "positionStatus" as const,
    }] : []),
    ...(browseState.dataStatus !== "all" ? [{
      key: "dataStatus",
      label: `行情：${browseState.dataStatus === "complete" ? "完整" : "待补齐"}`,
      kind: "dataStatus" as const,
    }] : []),
    ...(browseState.tag !== "all" ? [{
      key: "tag",
      label: `标签：${reviewTagLabel(browseState.tag)}`,
      kind: "tag" as const,
      value: browseState.tag,
    }] : []),
  ] satisfies AppliedFilterChip[];

  const toggleExpandedStock = (instrumentId: string) => {
    const expanded = expandedStockIds.includes(instrumentId)
      ? expandedStockIds.filter(id => id !== instrumentId)
      : [...expandedStockIds, instrumentId];
    updateBrowseState({ expandedStockIds: expanded });
  };

  const toggleIncludeReviewedStock = (instrumentId: string) => {
    const included = includeReviewedStockIds.includes(instrumentId)
      ? includeReviewedStockIds.filter(id => id !== instrumentId)
      : [...includeReviewedStockIds, instrumentId];
    updateBrowseState({ includeReviewedStockIds: included });
  };

  const updateBrowseMode = (nextMode: TradeLibraryBrowseState["mode"]) => {
    updateBrowseState({ mode: nextMode });
  };

  const handleBrowseTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    const nextMode = nextTab?.dataset.mode as TradeLibraryBrowseState["mode"] | undefined;
    if (!nextTab || !nextMode) return;
    event.preventDefault();
    browseTabFocusMode.current = nextMode;
    updateBrowseMode(nextMode);
  };

  const sharedBrowseControls = (
    <>
      <div className="library-shared-browse-controls" aria-label="交易库常用筛选">
      {!sharedScope && <label>
        <span>交易性质</span>
        <select
          aria-label="按交易性质筛选"
          value={tradeNature}
          onChange={(event) => changeTradeNature(event.target.value as TradeLibraryBrowseState["tradeNature"])}
        >
          <option value="all">全部性质</option>
          <option value="live">实盘</option>
          <option value="simulation">模拟盘</option>
          <option value="unknown">来源未知</option>
        </select>
      </label>}
      <label>
        <span>市场</span>
        <select
          aria-label="按市场筛选"
          value={market}
          onChange={(event) => updateBrowseState({ market: event.target.value })}
        >
          {filterOptions.marketOptions.map(({ value, label }) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="library-shared-search">
        <span>搜索</span>
        <input
          type="search"
          aria-label={mode === "stocks" ? "搜索股票" : "搜索复盘回合"}
          placeholder="名称或代码"
          value={query}
          onChange={(event) => updateBrowseState({ query: event.target.value })}
        />
      </label>
      <label>
        <span>复盘状态</span>
        <select
          aria-label="按复盘状态筛选"
          value={reviewStatus}
          onChange={(event) => updateBrowseState({ reviewStatus: event.target.value as TradeLibraryBrowseState["reviewStatus"] })}
        >
          <option value="all">全部回合</option>
          <option value="pending">待复盘</option>
          <option value="completed">已复盘</option>
        </select>
      </label>
      <label>
        <span>排序</span>
        <select
          aria-label="交易库排序"
          value={effectiveSort}
          onChange={(event) => updateSort(event.target.value as ReviewQueueSort)}
        >
          {REVIEW_QUEUE_SORT_OPTIONS.map(option => (
            <option value={option.value} key={option.value}>
              {option.value === "newest" ? "最近成交在前" : option.value === "oldest" ? "最早成交在前" : option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="primary-action" onClick={startReview} disabled={!pendingBrowseRows[0]}>
        开始复盘{pendingBrowseRows.length > 0 ? `（${pendingBrowseRows.length}）` : ""}
      </button>
      <button type="button" className="secondary-action" onClick={resetBrowseFilters}>
        重置筛选
      </button>
      <button type="button" className="secondary-action" onClick={() => setFilterDrawerOpen(true)}>
        高级筛选{advancedFilterCount > 0 ? `（${advancedFilterCount}）` : ""}
      </button>
      </div>
      <AppliedFilterChips chips={appliedFilterChips} onRemove={removeAdvancedFilter} />
      {isPerformanceSort(sort) && !performanceSortAvailability.allowed && <p role="status" className="review-queue-notice">绩效排序不可用：{performanceSortAvailability.reason ?? "请缩小范围"}。</p>}
      {queueNotice && <p role="status" className="review-queue-notice">{queueNotice}</p>}
    </>
  );
  const filterDrawer = filterDrawerOpen ? (
    <LibraryFilterDrawer
      value={browseState}
      entries={entries}
      options={advancedOptions}
      onApply={applyAdvancedFilters}
      onClose={() => setFilterDrawerOpen(false)}
    />
  ) : null;
  const fxRatesStrip = (
    <div className="library-fx-strip" aria-label="交易库人民币折算">
      <div>
        <strong>{sharedScope?.reportCurrency === "original" ? "原币金额" : "统计参考折算 · CNY"}</strong>
        <span>{sharedScope?.reportCurrency === "original" ? "当前范围按原币显示，不合并不同币种" : fxSnapshot
          ? `ECB 快照 · ${fxSnapshot.rateDate}${fxSnapshot.cacheStatus === "cached" ? " · 缓存" : ""}`
          : "统计折算尚无 ECB 快照；原币金额仍可查看"}</span>
      </div>
      <details>
        <summary>折算用途与快照</summary>
        <p>此处使用 ECB 参考汇率统一展示，不代表各成交日的历史绩效汇率。数据页的中行汇率用于当前估值参考，两者独立更新。</p>
        <FxRatesControl onSnapshotChange={setFxSnapshot} />
      </details>
    </div>
  );
  const performanceSummaryView = (
    <LibraryPerformanceSummaryView
      summary={performanceSummary}
      stockCount={filteredEntries.length}
      roundCount={browseRows.length}
      reviewedCount={reviewedCount}
      progressTotal={allStatusBrowseRows.length}
      groupLabels={performanceGroupLabels}
      reportCurrency={sharedScope?.reportCurrency ?? "CNY"}
    />
  );
  const libraryHeader = (
    <header className="library-header">
      <div>
        <span className="eyebrow">Trade Library</span>
        <h1>交易库</h1>
      </div>
      <div className="library-header-actions"><strong>{filteredEntries.length} 个标的 · {browseRows.length} 个回合</strong></div>
    </header>
  );
  const sharedScopeControl = sharedScope && onSharedScopeChange
    ? <SharedScopeBar scope={sharedScope} accountOptions={sharedAccountOptions} onChange={onSharedScopeChange} />
    : null;
  const libraryViewTabs = (
    <div className="module-tabs" role="tablist" aria-label="交易库浏览视图" onKeyDown={handleBrowseTabKeyDown}>
      <button type="button" role="tab" data-mode="stocks" aria-selected={mode === "stocks"} onClick={() => updateBrowseMode("stocks")}>按标的浏览</button>
      <button type="button" role="tab" data-mode="queue" aria-selected={mode === "queue"} onClick={() => updateBrowseMode("queue")}>按回合浏览</button>
    </div>
  );
  const emptyBrowseAction = entries.length === 0
    ? onImport && <button type="button" className="primary-action" onClick={onImport}>去导入</button>
    : <button type="button" className="secondary-action" onClick={resetBrowseFilters}>清除筛选</button>;
  const emptyLibraryState = (
    <div className="library-empty">
      <strong>还没有导入交易</strong>
      {emptyBrowseAction}
    </div>
  );

  if (entries.length === 0) {
    return (
      <section ref={sectionRef} className="trade-library" aria-label="交易库">
        {libraryHeader}
        {sharedScopeControl}
        {libraryViewTabs}
        {emptyLibraryState}
      </section>
    );
  }

  if (selectedEntry && selectedEpisode) {
    const { episode, metrics } = selectedEpisode;
    const candles = candlesByInstrument[selectedEntry.instrument.id] ?? [];
    const chartCandles = aggregateCandles(
      candles.map(dailyRecordToChartCandle),
      timeframe === "1W" ? "1W" : "1D",
    );
    const cursor =
      chartCandles.at(-1)?.time ??
      episode.endedAt ??
      episode.startedAt;
    const selectedIndex = selectedEntry.episodes.findIndex(
      (item) => item.episode.id === episode.id,
    );
    const selectedNumber = selectedEntry.episodeCount - selectedIndex;

    return (
      <section className="trade-library trade-library-detail" aria-label="交易库">
        <header className="library-detail-header">
          <button
            className="library-back"
            aria-label="返回股票库"
            onClick={() => {
              updateBrowseState({
                selectedInstrumentId: null,
                selectedEpisodeId: null,
              });
            }}
          >
            <ArrowLeft size={15} />
            返回股票库
          </button>
          <div>
            <span className="eyebrow">
              股票交易库 · {natureLabel(selectedEntry.tradeNature)}
            </span>
            <h1>
              {selectedEntry.instrument.name}（
              {selectedEntry.instrument.symbol}）
            </h1>
            <p>
              {selectedEntry.tradingLabel} · {episode.accountLabel} · 当前回合 {episode.executions.length} 笔成交
            </p>
          </div>
          {onInspectData && <button className="stock-data-entry" onClick={() => onInspectData(selectedEntry.instrument.id, selectedEpisode.episode.accountId)}>检查/修复数据</button>}
          {onRefreshMarketData && <div className="library-market-actions">
            <button type="button" className="secondary-action" aria-label="更新当前股票行情" disabled={marketDataStatuses[selectedEntry.instrument.id] === "syncing"} onClick={() => onRefreshMarketData(selectedEntry.instrument.id)}><RefreshCw size={16} />{marketDataStatuses[selectedEntry.instrument.id] === "syncing" ? "正在更新…" : "更新行情"}</button>
            <span role="status">{marketDataStatusLabel(marketDataStatuses[selectedEntry.instrument.id] ?? "not-requested")}</span>
          </div>}
          <button
            className="library-open-review"
            onClick={() =>
              onOpenInReview(selectedEntry.instrument.id, episode.id, queueRows.map(row => row.item.episode.id))
            }
          >
            <BookOpenCheck size={15} />
            打开统一工作台
          </button>
        </header>

        <div className="library-detail-layout">
          <aside className="library-episode-rail" aria-label="交易回合列表">
            <div className="library-episode-heading">
              <span>交易回合</span>
              <b>最近优先</b>
            </div>
            {selectedEntry.episodes.filter(item => detailIds.has(item.episode.id)).map((item) => {
              const chronologicalNumber =
                selectedEntry.episodeCount - selectedEntry.episodes.indexOf(item);
              const active = item.episode.id === episode.id;
              return (
                <button
                  key={item.episode.id}
                  className={`library-episode-card ${active ? "active" : ""}`}
                  aria-label={episodeLabel(item, chronologicalNumber)}
                  onClick={() =>
                    updateBrowseState({ selectedEpisodeId: item.episode.id })
                  }
                >
                  <div>
                    <strong>第 {chronologicalNumber} 次交易</strong>
                    <span
                      className={`library-position-chip ${item.episode.status}`}
                    >
                      {item.episode.status === "open" ? "持仓中" : "已平仓"}
                    </span>
                  </div>
                  <p>
                    {formatMarketTradingDate(
                      item.episode.startedAt,
                      item.episode.instrument.market,
                    )}—
                    {item.episode.endedAt
                      ? formatMarketTradingDate(
                          item.episode.endedAt,
                          item.episode.instrument.market,
                        )
                      : "至今"}
                  </p>
                  <span className="library-review-status">
                    {item.reviewStatus === "completed"
                      ? "已复盘"
                      : "待复盘"}
                  </span>
                  <div>
                    <span>
                      {item.episode.directionKnown === false || item.episode.accuracy?.reasons.includes("ambiguous-opening") ? "方向待核对" : item.episode.direction === "long" ? "多头" : "空头"} ·{" "}
                      {item.metrics.buyCount} 买 / {item.metrics.sellCount} 卖
                    </span>
                    <b
                      className={
                        Number(item.metrics.netPnl ?? 0) >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {money(
                        item.metrics.netPnl,
                        selectedEntry.instrument.currency,
                      )}
                    </b>
                  </div>
                </button>
              );
            })}
          </aside>

          <div className="library-episode-content">
            <div className="library-episode-summary">
              <div>
                <span className="eyebrow">当前回合</span>
                <h2>第 {selectedNumber} 次交易</h2>
                <p>
                  {episode.accountLabel} ·{" "}
                  {episode.directionKnown === false || episode.accuracy?.reasons.includes("ambiguous-opening") ? "方向待核对" : episode.direction === "long" ? "多头" : "空头"} ·{" "}
                  {episode.status === "open" ? "持仓中" : "已平仓"}
                </p>
              </div>
              <div className="library-timeframes" aria-label="交易库K线周期">
                <button
                  className={timeframe === "1D" ? "active" : ""}
                  onClick={() => onTimeframeChange("1D")}
                >
                  1D
                </button>
                <button
                  className={timeframe === "1W" ? "active" : ""}
                  onClick={() => onTimeframeChange("1W")}
                >
                  1W
                </button>
              </div>
            </div>

            <div className="library-metric-grid">
              <div>
                <span>净盈亏</span>
                <strong
                  className={
                    Number(metrics.netPnl ?? 0) >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {money(metrics.netPnl, selectedEntry.instrument.currency)}
                </strong>
              </div>
              <div>
                <span>收益率</span>
                <strong>
                  {metrics.returnPercent === null
                    ? "数据待补齐"
                    : `${Number(metrics.returnPercent).toFixed(2)}%`}
                </strong>
              </div>
              <div>
                <span>成交</span>
                <strong>
                  {metrics.buyCount} 买 / {metrics.sellCount} 卖
                </strong>
              </div>
              <div>
                <span>费用</span>
                <strong>{episode.executions.some(e => e.source.feeStatus === "unknown") ? "待核对" : feeCurrency(episode.executions) ? `${metrics.fees} ${feeCurrency(episode.executions)}` : "币种待核对"}</strong>
              </div>
              <div>
                <span>R 倍数</span>
                <strong>
                  {selectedEpisode.rMultiple === null
                    ? "—"
                    : `${selectedEpisode.rMultiple}R`}
                </strong>
              </div>
            </div>

            {chartCandles.length > 0 ? (
              <div className="library-chart">
                <div className="library-chart-meta">
                  <BarChart3 size={14} />
                  <span>
                    {timeframe === "1W" ? "周线" : "日线"} · 本地缓存 · 买卖点
                  </span>
                </div>
                <ReplayChart
                  episodeId={episode.id}
                  viewportKey={`${episode.id}:${timeframe}:${chartCandles[0]?.time ?? ""}:${chartCandles.at(-1)?.time ?? ""}`}
                  focusRange={{start:episode.startedAt,end:episode.endedAt}}
                  candles={chartCandles}
                  executions={episode.executions}
                  cursor={cursor}
                  currency={selectedEntry.instrument.currency}
                  averageCost={0}
                  drawings={[]}
                  activeTool="cursor"
                  selectedDrawingId={null}
                  plannedRiskAmount={undefined}
                  settings={{
                    version: 1,
                    showGrid: true,
                    showVolume: true,
                    showExecutions: true,
                    showAverageCost: true,
                    colorScheme: "teal-red",
                  }}
                  onSelectDrawing={() => undefined}
                  onCommand={() => undefined}
                />
              </div>
            ) : (
              <div className="library-chart-empty">
                <Database size={20} />
                <strong>本地尚无行情</strong>
                <span>使用上方“更新行情”补齐这只股票的数据。</span>
              </div>
            )}


            {reviewsHydrated ? (
              <EpisodeReviewEditor
                key={episode.id}
                episodeId={episode.id}
                instrumentId={selectedEntry.instrument.id}
                netPnl={metrics.netPnl}
                record={selectedEpisode.review}
                onSave={async record => {
                  await onSaveReview(record);
                  if (!record.review.completed && !record.review.deferredReason) processedIds.current.delete(record.episodeId);
                }}
                onComplete={continueReview}
                {...reviewExtras?.(episode)}
              />
            ) : (
              <section
                className="episode-review-editor"
                aria-label="正在读取当前回合复盘"
                aria-live="polite"
              >
                正在读取本机复盘记录…
              </section>
            )}

            {episode.executions.some(execution => execution.source.sourceReport) && <section className="simulation-source-report" aria-label="模拟交易源报告">
              <h3>TradingView 源报告</h3>
              <p>报告字段仅作来源对照，不并入本地成交账本的计算。</p>
              {episode.executions.filter(execution => execution.source.sourceReport).map(execution => <details key={execution.id}>
                <summary>交易 {execution.source.sourceTradeId} · 报告净盈亏 {money(execution.source.sourceReport!.netPnl, selectedEntry.instrument.currency)}</summary>
                <dl><div><dt>报告收益率</dt><dd>{execution.source.sourceReport!.returnPercent}%</dd></div><div><dt>持仓 K 线</dt><dd>{execution.source.sourceReport!.durationBars}</dd></div></dl>
              </details>)}
            </section>}
            <details className="library-execution-details">
              <summary>成交明细 · 当前回合 {episode.executions.length} 笔</summary>
            <div className="library-execution-table">
              <div className="library-execution-head">
                <span>时间</span>
                <span>方向</span>
                <span>数量</span>
                <span>价格</span>
                <span>费用</span>
              </div>
              {episode.executions.map((execution) => (
                <div
                  className="library-execution-row"
                  data-testid="library-execution-row"
                  key={execution.id}
                >
                  <span>
                    <Clock3 size={12} />
                    {execution.source.timePrecision === "date-only"
                      ? `${formatMarketTradingDate(execution.executedAt, execution.instrument.market)} · 未提供成交时刻`
                      : formatBeijingDateTime(execution.executedAt)}
                    {execution.source.sourceTimestampText && (
                      <small
                        title={`原始时间（${execution.source.sourceTimezone ?? "来源时区"}）`}
                      >
                        {execution.source.sourceTimestampText}
                      </small>
                    )}
                  </span>
                  <b
                    className={
                      execution.side === "buy" ? "positive" : "negative"
                    }
                  >
                    {execution.side === "buy" ? "买入" : "卖出"}
                  </b>
                  <span>{execution.quantity}</span>
                  <span>{execution.price}</span>
                  <span>{feeLabel(execution)}</span>
                </div>
              ))}
            </div>
            </details>


          </div>
        </div>
      </section>
    );
  }

  if (mode === "queue" && !selectionMissing) return <section ref={sectionRef} className="trade-library" aria-label="交易库" onScroll={(event) => updateBrowseState({ scrollTop: event.currentTarget.scrollTop })}>{filterDrawer}{libraryHeader}{sharedScopeControl}{libraryViewTabs}{sharedBrowseControls}{fxRatesStrip}{performanceSummaryView}<ReviewQueue compact entries={entries} rows={browseRows} pendingRows={pendingBrowseRows} filter={queueFilter} onFilter={updateQueueFilter} onSort={updateSort} performanceSortAvailability={performanceSortAvailability} onOpen={openQueued} onBrowseStocks={() => updateBrowseMode("stocks")} notice={queueNotice} performanceByEpisode={performanceByEpisode} page={roundPage} onPageChange={page => updateBrowseState({ roundPage: page })} reportCurrency={sharedScope?.reportCurrency ?? "CNY"} />{browseRows.length === 0 && emptyBrowseAction && <div className="library-empty-actions">{emptyBrowseAction}</div>}</section>;

  return (
    <section ref={sectionRef} className="trade-library" aria-label="交易库" onScroll={(event) => updateBrowseState({ scrollTop: event.currentTarget.scrollTop })}>
      {filterDrawer}
      {selectionMissing && <p role="alert" className="navigation-notice">原股票或交易回合已变化，请重新选择。<button type="button" onClick={() => updateBrowseState({ selectedInstrumentId: null, selectedEpisodeId: null })}>重新选择</button></p>}
      {libraryHeader}
      {sharedScopeControl}
      {libraryViewTabs}

      {sharedBrowseControls}
      {fxRatesStrip}
      {performanceSummaryView}

      {filteredEntries.length === 0 ? (
        <div className="library-empty">
          <Database size={28} />
          <strong>
            {entries.length === 0 ? "还没有导入交易" : "没有符合条件的股票"}
          </strong>
          <span>
            {entries.length === 0
              ? "使用下方“去导入”添加券商成交记录。"
              : "调整搜索词或筛选条件后再试。"}
          </span>
          {emptyBrowseAction}
        </div>
      ) : (
        <LibraryStockRounds
          groups={stockGroups}
          expandedStockIds={expandedStockIds}
          includeReviewedStockIds={includeReviewedStockIds}
          reviewStatus={reviewStatus}
          performanceByInstrument={performanceByInstrument}
          performanceByEpisode={performanceByEpisode}
          fxSnapshot={fxSnapshot}
          sort={effectiveSort}
          onSort={updateSort}
          performanceSortAvailability={performanceSortAvailability}
          page={stockPage}
          onPageChange={page => updateBrowseState({ stockPage: page })}
          marketDataLabels={marketDataLabels}
          marketDataStatuses={marketDataStatuses}
          onToggleExpanded={toggleExpandedStock}
          onToggleIncludeReviewed={toggleIncludeReviewedStock}
          onOpenRound={(row, queueIds) => onOpenInReview(row.entry.instrument.id, row.item.episode.id, queueIds)}
          money={money}
          natureLabel={natureLabel}
          marketDataStatusLabel={marketDataStatusLabel}
          reviewTagLabel={reviewTagLabel}
        />
      )}
    </section>
  );
}
