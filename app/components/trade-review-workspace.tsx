"use client";
import { scopedRecords, supplementChanges, type SupplementScope } from "../lib/import/scoped-supplement";

import {
  BookOpenCheck,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { StockDataDialog } from "./review/stock-data-dialog";
import { tradeRepairClient } from "../lib/storage/trade-repair-client";
import type { TradeRevisionRequest } from "../lib/storage/trade-revisions";
import { StockEpisodeNavigation } from "./review/stock-episode-navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";

import {
  applyDrawingCommand,
  redoDrawingAtCursor,
  createDrawingHistory,
  setAllDrawingsLockedAtCursor,
  undoDrawingAtCursor,
  type DrawingCommand,
  type DrawingHistory,
} from "../lib/chart/drawing-commands";
import type { DrawingTool } from "../lib/chart/drawings";
import type {
  DemoReplayFrame,
  DemoReplayMode,
} from "../lib/demo/replay-frame";
import type {
  StatementParseResult,
  TradingViewSimulationContext,
} from "../lib/import/contracts";
import {
  enrichStatementImport,
  type EnrichedImportResult,
} from "../lib/import/enrich-import";
import { parseBrokerStatement } from "../lib/import/dispatcher";
import { applyMonthlyHistoryEvidence } from "../lib/import/statement-evidence";
import { belongsToMonthlyDocument } from "../lib/import/statement-identity";
import { assessMonthlyReimport } from "../lib/import/monthly-reimport";
import type { StatementTimeOptions } from "../lib/import/monthly-statement";
import { MonthlyStatementReview } from "./import/monthly-statement-review";
import { TradingViewContextDialog } from "./import/tradingview-context-dialog";
import {
  applyReconciliationDecisions,
  reconcileExecutions,
  type ReconciliationDecision,
} from "../lib/import/execution-reconciliation";
import {
  createImportPreview,
  type ImportPreview,
} from "../lib/import/import-preview";
import { buildInsightEpisodeFacts } from "../lib/insights/episode-facts";
import { buildPatternInsightReport } from "../lib/insights/insight-engine";
import { buildTagSuggestions } from "../lib/insights/tag-suggestions";
import type { TagSuggestionRecord } from "../lib/insights/types";
import { aggregateCandles } from "../lib/market/aggregate";
import {
  resolveTimeframeAvailability,
  type TimeframeAvailability,
} from "../lib/market/availability";
import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  NativeIntradayInterval,
  SupportedMarket,
} from "../lib/market/contracts";
import type { IntradayTimeRange } from "../lib/market/intraday-sync-service";
import { buildIntradaySyncRanges } from "../lib/market/intraday-sync-ranges";
import { normalizeProviderLatestTails, reconcileDailyCoverage } from "../lib/market/coverage-tail";
import {
  combinedMarketDataStatus,
  coverageStatusForDateRange,
  coverageStatusForTimeRanges,
  displayMarketDataStatus,
  marketDataStatusLabel,
  type MarketDataSyncStatus,
} from "../lib/market/sync-status";
import {
  requiredMarketDataRange,
  requiredRangeExpanded,
} from "../lib/market/sync-range";
import { statementReplayBounds } from "../lib/market/statement-range";
import { createMarketDataFetcher } from "../lib/market/market-data-fetch";
import {
  failedRefreshItems,
  runRefreshQueue,
} from "../lib/market/refresh-queue";
import {
  classifyMarketDataRefreshStatus,
  failureDetailForReason,
  summarizePersistedMarketDataJobs,
  type GlobalMarketRefreshInventoryItem,
  type GlobalMarketRefreshFailureDetail,
} from "../lib/market/refresh-summary";
import { refreshMarketData } from "../lib/market/market-data-service";
import { canonicalInstrumentId } from "../lib/instruments/display-name";
import type { ResolvedInstrument } from "../lib/instruments/metadata-contracts";
import { resolveHistoricalInstrumentIdentity } from "../lib/instruments/historical-instrument-identity";
import { resolveInstrumentMetadataBatch, refreshInstrumentMetadata } from "../lib/instruments/resolve-service";
import {
  LocalizedMetadataHydrationQueue,
} from "../lib/reviews/localized-metadata-hydration";
import {
  marketCalendarDateOffset,
  marketTradingDate,
} from "../lib/market/trading-date";
import {
  candleKnowledgeAt,
  dailyRecordToChartCandle,
  marketRecordToChartCandle,
  type Candle,
  type Timeframe,
} from "../lib/market/types";
import {
  createImportedReplay,
  latestImportedHistoryCursor,
} from "../lib/replay/imported-replay";
import { formatBeijingDate } from "../lib/replay/format-time";
import { calculatePositionPathMetrics } from "../lib/replay/position-path-metrics";
import { intradayReplayRestriction } from "../lib/replay/replay-precision";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import {
  createEmptyEpisodeReviewRecord,
  episodePlanAtCursor,
} from "../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import type { ChartSettings } from "../lib/storage/chart-settings";
import type { ImportHistoryEntry } from "../lib/storage/import-history";
import type {
  MarketDataErrorDetail,
  MarketDataJob,
} from "../lib/storage/market-data-jobs";
import {
  mergeExecutions,
} from "../lib/storage/import-library";
import type { EpisodeReviewState } from "../lib/storage/review-storage";
import type { MarketDataRepository } from "../lib/storage/market-data-repository";
import {
  ApiEpisodeReviewRepository,
  ApiInstrumentMetadataRepository,
  ApiMarketDataRepository,
  ApiTagSuggestionRepository,
} from "../lib/storage/sqlite-repositories";
import {
  createSqliteHttpClient,
  type SqliteHttpClient,
} from "../lib/storage/sqlite-http-client";
import { exportLegacyBrowserState } from "../lib/storage/browser-state-export";
import {
  migrateLegacyBrowserState,
} from "../lib/storage/browser-state-migration";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import {
  buildInstrumentTradeSummaries,
  type InstrumentTradeSummary,
} from "../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../lib/trades/library";
import { tradingNatureLabel, displayTradeNature } from "../lib/trades/trading-nature";
import { buildReviewQueue } from "../lib/reviews/review-queue";
import { localizedInstrumentOverlay, overlayStoredInstrumentMetadata } from "../lib/reviews/instrument-display-overlay";
import type {
  TradingRoomInstrumentMetadata,
  TradingRoomMetadataInput,
} from "../lib/reviews/trading-room-scope";
import type {
  Instrument,
  TradeEpisode,
  TradeExecution,
} from "../lib/trades/types";
import type { StoredInstrument } from "../lib/storage/sqlite-contracts";
import type { MarketDataDetails } from "./chart/market-data-popover";
import { ImportConfirmDialog } from "./import/import-confirm-dialog";
import { ImportHistoryDialog } from "./import/import-history-dialog";
import { ImportManagementDrawer } from "./import/import-management-drawer";
import { ScreenshotReviewDialog } from "./import/screenshot-review-dialog";
import {
  useScreenshotImport,
  type PreparedScreenshotImport,
  type ScreenshotImportDependencies,
} from "./import/use-screenshot-import";
import {
  EpisodeSidebar,
  type ImportPhase,
} from "./review/episode-sidebar";
import {
  TradeLibrary,
  type TradeLibraryTarget,
  type TradeLibraryBrowseState,
} from "./library/trade-library";
import { DataManagement } from "./data-management/data-management";
import { FxPanel } from "./data-management/fx-panel";
import { QualityDetails } from "./data-management/quality-details";
import { TradingRoomPrincipalSlot } from "./data-management/trading-room-principal-slot";
import { useModalFocus } from "./import/use-modal-focus";
import { ReviewSummary, initialReviewSummaryFilters, type ReviewSummaryDrafts } from "./insights/review-summary";
import { ReviewDashboard } from "./dashboard/review-dashboard";
import { SharedScopeBar } from "./scope/shared-scope-bar";
import { DEFAULT_SHARED_SCOPE, normalizeSharedScope, filterEntriesBySharedScope, sharedScopeStorageKey, type SharedScope } from "../lib/reviews/shared-scope";
import { TagSuggestionPanel } from "./insights/tag-suggestion-panel";
import { RuleChecks } from "./review/rule-checks";
import type { EpisodeNotesProps } from "./review/episode-notes-panel";
import { createReviewSummaryClient } from "../lib/storage/review-summary-client";
import { filterTradeLibraryEntriesByScope, reviewScopeOptions, trackedRuleCandidates, type ReviewSummaryRange } from "../lib/reviews/review-summary";
import { PatternInsights, type Category } from "./insights/pattern-insights";
import {
  ReviewChartWorkspace,
  type EpisodeOption,
  type ReviewChartViewModel,
} from "./review/review-chart-workspace";
import { RecallWorkspace } from "./recall/recall-workspace";
import type {
  ReviewChartLocateRequest,
  ReviewChartLocateResult,
} from "../lib/replay/chart-location";
import {
  EMPTY_GLOBAL_MARKET_REFRESH,
  type GlobalMarketRefreshState,
} from "./global-market-refresh";
import { RefreshCancellationService } from "../lib/market/refresh-cancellation";
import { withGlobalMarketRefreshLock } from "../lib/market/refresh-lock";
import { retryMarketData } from "../lib/market/retry-market-data";
import { composeAbortSignals } from "../lib/instruments/abort-signal";
import { toRoomFxSnapshot } from "../lib/fx/room-contracts";
import { useFxRates } from "../lib/fx/use-fx-rates";
import type {
  TradingRoomQualityDimensionId,
  TradingRoomQualityModel,
} from "../lib/reviews/trading-room-quality";
import type { TradingRoomQuote } from "../lib/reviews/trading-room-holdings";

const REVIEW_ID = "demo-xpev-2025";
const DEFAULT_THESIS =
  "宽通道上升后的第一次深度回撤。等待重新站上短期高点，确认买盘跟随后分批进入；如果跌破前低则逻辑失效。";
const DEMO_INSTRUMENT: Instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};
const SUPPORTED_MARKETS = new Set<SupportedMarket>([
  "US",
  "HK",
  "CN-SH",
  "CN-SZ",
]);
const ALL_TIMEFRAMES: TimeframeAvailability = {
  "15m": { enabled: true },
  "1h": { enabled: true },
  "4h": { enabled: true },
  "1D": { enabled: true },
  "1W": { enabled: true },
};

type InstrumentMarketState = {
  daily: DailyCandleRecord[];
  intraday: MarketCandleRecord[];
  intradayInterval: NativeIntradayInterval;
  dailyStatus: MarketDataSyncStatus;
  intradayStatus: MarketDataSyncStatus;
  intradayCoverage: IntervalCoverageSegment[];
  dailyCoverage: CoverageSegment[];
  dailyMessage?: string;
  intradayMessage?: string;
  dailyError?: MarketDataErrorDetail;
  intradayError?: MarketDataErrorDetail;
};

type Props = {
  initialFrame: DemoReplayFrame;
  showDemo?: boolean;
  /** Optional future data-management module, such as the FX updater. */
  fxSlot?: ReactNode;
  screenshotImportDependencies?: Partial<ScreenshotImportDependencies>;
  /** Injectable only for integration tests; production creates the HTTP client. */
  storageClient?: SqliteHttpClient;
  legacyStateExporter?: (options?: { excludeDemo?: boolean }) => Promise<import("../lib/storage/sqlite-contracts").BrowserStatePayload | null>;
};

type ReviewReturnView = "dashboard" | "library" | "insights";

const DEFAULT_CHART_SETTINGS: ChartSettings = {
  version: 1,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red",
};

function isChartSettings(value: Record<string, unknown>): value is ChartSettings {
  return value.version === 1 &&
    typeof value.showGrid === "boolean" &&
    typeof value.showVolume === "boolean" &&
    typeof value.showExecutions === "boolean" &&
    typeof value.showAverageCost === "boolean" &&
    (value.colorScheme === "teal-red" || value.colorScheme === "green-red" || value.colorScheme === "blue-orange");
}

function displaySavedMarketDataStatus(status: MarketDataSyncStatus) {
  return status === "syncing" ? "not-requested" as const : status;
}

function isUnfinishedMarketDataJob(job: MarketDataJob | undefined) {
  return Boolean(
    job &&
      (job.status === "syncing" ||
        job.status === "not-requested" ||
        job.intervals.some(
          (interval) =>
            interval.status === "syncing" ||
            interval.status === "not-requested",
        )),
  );
}

function emptyMarketState(
  jobOrStatus: MarketDataJob | MarketDataSyncStatus = "not-requested",
): InstrumentMarketState {
  const job = typeof jobOrStatus === "string" ? undefined : jobOrStatus;
  const dailyJob = job?.intervals.find((item) => item.interval === "1D");
  const intradayJob = job?.intervals.find((item) => item.interval === "1h");
  return {
    daily: [],
    intraday: [],
    intradayInterval: "1h",
    dailyStatus:
      displaySavedMarketDataStatus(dailyJob?.status ??
        (typeof jobOrStatus === "string" ? jobOrStatus : job?.status ?? "not-requested")),
    intradayStatus: displaySavedMarketDataStatus(intradayJob?.status ?? "not-requested"),
    intradayCoverage: [],
    dailyCoverage: [],
    dailyMessage: dailyJob?.status === "syncing"
      ? "上次日线更新未结束，可重新尝试"
      : dailyJob?.message ?? job?.message,
    intradayMessage: intradayJob?.status === "syncing"
      ? "上次 1 小时更新未结束，可重新尝试"
      : intradayJob?.message,
    dailyError: dailyJob?.error ?? job?.error,
    intradayError: intradayJob?.error,
  };
}

function applyPersistedMarketDataJob(
  state: InstrumentMarketState,
  job: MarketDataJob | undefined,
): InstrumentMarketState {
  if (!job) return state;
  const dailyJob = job.intervals.find((item) => item.interval === "1D");
  const intradayJob = job.intervals.find((item) => item.interval === "1h");
  const hasDailyData = state.daily.length > 0 || state.dailyCoverage.length > 0;
  const hasIntradayData =
    state.intraday.length > 0 || state.intradayCoverage.length > 0;
  return {
    ...state,
    dailyStatus:
      state.dailyStatus === "not-requested" && dailyJob
        ? dailyJob.status === "syncing" ? "not-requested" : dailyJob.status
        : state.dailyStatus,
    intradayStatus:
      state.intradayStatus === "not-requested" && intradayJob
        ? intradayJob.status === "syncing" ? "not-requested" : intradayJob.status
        : state.intradayStatus,
    dailyMessage: state.dailyStatus === "complete"
      ? "日线覆盖已完整"
      : state.dailyMessage ??
        (dailyJob?.status === "syncing"
          ? "上次日线更新未结束，可重新尝试"
          : dailyJob?.message ?? job.message),
    intradayMessage: state.intradayMessage ?? intradayJob?.message,
    dailyError: state.dailyStatus === "complete" ? undefined : state.dailyError ?? dailyJob?.error ?? job.error,
    intradayError: state.intradayError ?? intradayJob?.error,
    ...(hasDailyData || hasIntradayData ? {} : {
      dailyStatus: displaySavedMarketDataStatus(dailyJob?.status ?? job.status),
    }),
  };
}

function supportedMarket(value: string) {
  const normalized = value.toUpperCase() as SupportedMarket;
  return SUPPORTED_MARKETS.has(normalized) ? normalized : undefined;
}

function marketRanges(summary: InstrumentTradeSummary) {
  const market = supportedMarket(summary.instrument.market);
  const bounds = statementReplayBounds(summary);
  const daily = requiredMarketDataRange(
    bounds.firstAt,
    bounds.lastAt,
    {
      open: bounds.open,
      market,
    },
  );
  return {
    daily,
    intraday: {
      startTime: `${daily.startDate}T00:00:00.000Z`,
      endTime: `${daily.endDate}T23:59:59.999Z`,
    } satisfies IntradayTimeRange,
  };
}

async function readInstrumentMarketState(
  summary: InstrumentTradeSummary,
  repository: MarketDataRepository,
): Promise<InstrumentMarketState> {
  const ranges = marketRanges(summary);
  const market = supportedMarket(summary.instrument.market);
  const intradayRanges = market
    ? buildIntradaySyncRanges(sortedEpisodes(summary), market)
    : [ranges.intraday];
  const [daily, dailyCoverage, hourly, hourlyCoverage, legacyIntraday, legacyCoverage] =
    await Promise.all([
      repository.getDailyCandles(
        summary.instrument.id,
        ranges.daily.startDate,
        ranges.daily.endDate,
      ),
      repository.getCoverage(summary.instrument.id),
      repository.getCandles(
        summary.instrument.id,
        "1h",
        ranges.intraday.startTime,
        ranges.intraday.endTime,
      ),
      repository.getIntervalCoverage(summary.instrument.id, "1h"),
      repository.getCandles(
        summary.instrument.id,
        "15m",
        ranges.intraday.startTime,
        ranges.intraday.endTime,
      ),
      repository.getIntervalCoverage(summary.instrument.id, "15m"),
    ]);
  const useHourly = hourly.length > 0 || hourlyCoverage.length > 0;
  const normalizedDailyCoverage = market
    ? normalizeProviderLatestTails(market, reconcileDailyCoverage(market, ranges.daily, dailyCoverage, daily), daily)
    : dailyCoverage;
  return {
    daily,
    intraday: useHourly ? hourly : legacyIntraday,
    intradayInterval: useHourly ? "1h" : "15m",
    dailyStatus: coverageStatusForDateRange(
      ranges.daily,
      normalizedDailyCoverage,
    ),
    intradayStatus: coverageStatusForTimeRanges(
      intradayRanges,
      useHourly ? hourlyCoverage : legacyCoverage,
    ),
    intradayCoverage: useHourly ? hourlyCoverage : legacyCoverage,
    dailyCoverage: normalizedDailyCoverage,
  };
}

function intervalRecordToCandle(record: MarketCandleRecord): Candle {
  return marketRecordToChartCandle(record);
}

function dailyRecordToKnowledgeCandle(record: DailyCandleRecord): Candle {
  return dailyRecordToChartCandle(record);
}

function sourceCandlesForTimeframe(
  marketState: InstrumentMarketState,
  timeframe: Timeframe,
) {
  if (timeframe === "15m" && marketState.intradayInterval !== "15m") {
    return [];
  }
  return timeframe === "15m" || timeframe === "1h" || timeframe === "4h"
    ? marketState.intraday.map(intervalRecordToCandle)
    : marketState.daily.map(dailyRecordToKnowledgeCandle);
}

function replayCursorForEpisode(source: Candle[], episodeStartedAt: string) {
  const sorted = [...source].sort(
    (left, right) =>
      Date.parse(candleKnowledgeAt(left)) -
      Date.parse(candleKnowledgeAt(right)),
  );
  const prior = sorted.findLast(
    (candle) => Date.parse(candleKnowledgeAt(candle)) < Date.parse(episodeStartedAt),
  );
  return prior ? candleKnowledgeAt(prior) : new Date(Date.parse(episodeStartedAt) - 1).toISOString();
}

function replayHistoryStartsAfter(source: Candle[], cursor: string, episodeStartedAt?: string) {
  if (episodeStartedAt && Date.parse(cursor) === Date.parse(episodeStartedAt) && !source.some(candle => Date.parse(candleKnowledgeAt(candle)) <= Date.parse(cursor))) return true;
  const first = [...source].sort(
    (left, right) => Date.parse(left.time) - Date.parse(right.time),
  )[0];
  return Boolean(first && Date.parse(first.time) > Date.parse(cursor));
}

function aggregateVisibleCandles(
  source: Candle[],
  timeframe: Timeframe,
  market: string,
  sourceInterval: NativeIntradayInterval,
) {
  if (
    timeframe === "15m" ||
    timeframe === "1D" ||
    (timeframe === "1h" && sourceInterval === "1h")
  ) {
    return [...source].sort((left, right) => left.time.localeCompare(right.time));
  }
  return aggregateCandles(source, timeframe, {
    sourceInterval:
      timeframe === "1h" || timeframe === "4h" ? sourceInterval : "1D",
    market,
  });
}

const INTRADAY_BAR_MILLISECONDS: Record<NativeIntradayInterval, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};
const INTRADAY_PRE_ENTRY_CONTEXT_DAYS = 7;

function containingIntradayBarEnd(
  timestamp: string,
  interval: NativeIntradayInterval = "1h",
) {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return timestamp;
  const barStart =
    Math.floor(milliseconds / INTRADAY_BAR_MILLISECONDS[interval]) *
    INTRADAY_BAR_MILLISECONDS[interval];
  return new Date(
    barStart + INTRADAY_BAR_MILLISECONDS[interval] - 1,
  ).toISOString();
}

function latestIso(values: string[], fallback: string) {
  return values.reduce(
    (latest, value) => (value > latest ? value : latest),
    fallback,
  );
}

function endOfIsoDate(value: string) {
  return `${value.slice(0, 10)}T23:59:59.999Z`;
}

function intradayContextStart(timestamp: string, market: string) {
  return marketCalendarDateOffset(
    timestamp,
    market,
    -INTRADAY_PRE_ENTRY_CONTEXT_DAYS,
  );
}

function episodeWindow(
  state: InstrumentMarketState,
  episode: TradeEpisode,
) {
  const market = episode.instrument.market;
  const lastExecutionAt = latestIso(
    episode.executions.map((execution) => execution.executedAt),
    episode.startedAt,
  );
  const holdingEnd = episode.endedAt ?? lastExecutionAt;
  const intradayInterval = state.intradayInterval;
  const dailyRange = requiredMarketDataRange(
    episode.startedAt,
    holdingEnd,
    { market: supportedMarket(market) },
  );
  // Seven calendar days normally provide roughly five completed sessions of
  // chart context without letting unrelated older episodes enable intraday.
  const intradayStart = intradayContextStart(episode.startedAt, market);
  const holdingEndTime = containingIntradayBarEnd(holdingEnd, intradayInterval);
  const holdingEndDate = marketTradingDate(holdingEnd, market);

  if (episode.status === "closed") {
    return {
      intradayStart,
      intradayEnd: holdingEndTime,
      intradayInterval,
      dailyStartDate: dailyRange.startDate,
      dailyEndDate: dailyRange.endDate,
    };
  }

  const completeIntradayCoverage = state.intradayCoverage.flatMap(
    (segment) => {
      if (segment.actualEnd) {
        return [containingIntradayBarEnd(segment.actualEnd, intradayInterval)];
      }
      return segment.status === "complete"
        ? [containingIntradayBarEnd(segment.requestedEnd, intradayInterval)]
        : [];
    },
  );
  const completeDailyCoverage = state.dailyCoverage
    .filter((segment) => segment.status === "complete")
    .map((segment) => segment.endDate);
  const end = latestIso(
    [
      ...state.intraday.map((candle) =>
        containingIntradayBarEnd(candle.timestamp, intradayInterval),
      ),
      ...completeIntradayCoverage,
      ...state.daily.map((candle) =>
        endOfIsoDate(candle.tradingDate),
      ),
      ...completeDailyCoverage.map(endOfIsoDate),
    ],
    holdingEndTime,
  );
  const endDate = latestIso(
    [
      ...state.intraday.map((candle) =>
        marketTradingDate(candle.timestamp, market),
      ),
      ...state.intradayCoverage.flatMap((segment) => {
        const coveredEnd =
          segment.actualEnd ??
          (segment.status === "complete"
            ? segment.requestedEnd
            : undefined);
        return coveredEnd
          ? [marketTradingDate(coveredEnd, market)]
          : [];
      }),
      ...state.daily.map((candle) => candle.tradingDate),
      ...completeDailyCoverage,
    ],
    holdingEndDate,
  );
  return {
    intradayStart,
    intradayEnd: end,
    intradayInterval,
    dailyStartDate: dailyRange.startDate,
    dailyEndDate: latestIso([dailyRange.endDate, endDate], dailyRange.endDate),
  };
}

function coverageOverlapsEpisode(
  segment: IntervalCoverageSegment,
  window: ReturnType<typeof episodeWindow>,
) {
  const start = segment.requestedStart;
  const end = containingIntradayBarEnd(
    segment.requestedEnd,
    window.intradayInterval,
  );
  return (
    start <= window.intradayEnd &&
    end >= window.intradayStart
  );
}

function resolveEpisodeTimeframeAvailability(
  state: InstrumentMarketState,
  episode: TradeEpisode | undefined,
) {
  if (!episode) {
    return resolveTimeframeAvailability({
      intradayCandles: state.intraday,
      dailyCandles: state.daily,
      intradayCoverage: state.intradayCoverage,
      intradayInterval: state.intradayInterval,
    });
  }
  const window = episodeWindow(state, episode);
  const intradayCandles = state.intraday.filter(
    (candle) =>
      candle.timestamp <= window.intradayEnd &&
      containingIntradayBarEnd(candle.timestamp, state.intradayInterval) >=
        window.intradayStart,
  );
  const dailyCandles = state.daily.filter(
    (candle) =>
      candle.tradingDate >= window.dailyStartDate &&
      candle.tradingDate <= window.dailyEndDate,
  );
  const intradayCoverage = state.intradayCoverage.filter((segment) =>
    coverageOverlapsEpisode(segment, window),
  );
  const availability = resolveTimeframeAvailability({
    intradayCandles,
    dailyCandles,
    intradayCoverage,
    intradayInterval: state.intradayInterval,
  });
  if (
    intradayCandles.length === 0 &&
    intradayCoverage.length === 0 &&
    state.intraday.length > 0
  ) {
    for (const timeframe of ["15m", "1h", "4h"] as const) {
      availability[timeframe] = {
        enabled: false,
        reason:
          state.intradayInterval === "1h"
            ? "该交易回合没有可用的 1 小时行情"
            : "该交易回合没有可用的 15 分钟行情",
      };
    }
  }
  const precisionRestriction = intradayReplayRestriction(episode);
  if (precisionRestriction) {
    for (const tf of ["15m", "1h", "4h"] as const) availability[tf] = { enabled: false, reason: precisionRestriction };
  }
  return availability;
}

function providerLabel(
  provider: DailyCandleRecord["provider"] | undefined,
) {
  if (provider === "tencent") return "腾讯行情";
  if (provider === "tiger") return "Tiger OpenAPI";
  if (provider === "baostock") return "BaoStock";
  if (provider === "eastmoney") return "东方财富";
  if (provider === "yahoo") return "Yahoo Finance";
  if (provider === "sina") return "新浪美股";
  if (provider === "baidu") return "百度行情";
  return null;
}

function marketDataDetails(
  state: InstrumentMarketState,
  availability: TimeframeAvailability,
): MarketDataDetails[] {
  const firstDaily = state.daily[0];
  const lastDaily = state.daily.at(-1);
  const firstIntraday = state.intraday[0];
  const lastIntraday = state.intraday.at(-1);
  return [
    {
      providerLabel: providerLabel(firstIntraday?.provider),
      nativeInterval: state.intradayInterval,
      coverageStart:
        firstIntraday?.timestamp ??
        state.intradayCoverage.find((segment) => segment.actualStart)
          ?.actualStart,
      coverageEnd:
        lastIntraday?.timestamp ??
        state.intradayCoverage.findLast((segment) => segment.actualEnd)
          ?.actualEnd,
      fetchedAt:
        lastIntraday?.fetchedAt ??
        state.intradayCoverage.findLast((segment) => segment.fetchedAt)
          ?.fetchedAt,
      status: state.intradayStatus,
      limitationReason:
        state.intradayMessage ??
        (availability[state.intradayInterval].enabled
          ? undefined
          : availability[state.intradayInterval].reason),
      availableTimeframes: (
        ["15m", "1h", "4h"] as const
      ).filter((timeframe) => availability[timeframe].enabled),
    },
    {
      providerLabel: providerLabel(firstDaily?.provider),
      nativeInterval: "1D",
      coverageStart:
        firstDaily?.tradingDate ?? state.dailyCoverage[0]?.startDate,
      coverageEnd:
        lastDaily?.tradingDate ?? state.dailyCoverage.at(-1)?.endDate,
      fetchedAt:
        lastDaily?.fetchedAt ??
        state.dailyCoverage.findLast((segment) => segment.fetchedAt)
          ?.fetchedAt,
      status: state.dailyStatus,
      limitationReason: state.dailyMessage,
      availableTimeframes: (["1D", "1W"] as const).filter(
        (timeframe) => availability[timeframe].enabled,
      ),
    },
  ];
}

function defaultReviewRecord(
  episodeId: string,
  instrumentId: string,
  thesis = "",
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: new Date(0).toISOString(),
    plan: {
      thesis,
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
    },
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: false,
    },
    confirmedTagIds: [],
  };
}

function sortedEpisodes(summary: InstrumentTradeSummary | undefined) {
  return summary
    ? buildTradeEpisodes(summary.executions).sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      )
    : [];
}

function episodeOptions(episodes: TradeEpisode[], reviews: Record<string, EpisodeReviewRecord>): EpisodeOption[] {
  const chronological = new Map(
    [...episodes]
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
      .map((episode, index) => [episode.id, index + 1]),
  );
  return episodes.map((episode) => ({
    id: episode.id,
    label: `第 ${chronological.get(episode.id) ?? 1} 次交易${displayTradeNature(episode.executions[0]) === "simulation" ? ` · ${episode.accountLabel}` : ""}`,
    contextLabel: `${marketTradingDate(episode.startedAt, episode.instrument.market)} · ${episode.executions[0]?.accountLabel ?? "账户未记录"} · ${reviews[episode.id]?.review.completed ? "已复盘" : "待复盘"}`,
    startedAt: episode.startedAt,
    endedAt: episode.endedAt,
    status: episode.status,
  }));
}

async function fetchDemoFrame(
  mode: DemoReplayMode,
  cursor: string,
) {
  const params = new URLSearchParams({ cursor, mode });
  const response = await fetch(`/api/demo-replay?${params}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("replay request failed");
  return (await response.json()) as DemoReplayFrame;
}

const EMPTY_MARKET_DATA_REFRESH: GlobalMarketRefreshState =
  EMPTY_GLOBAL_MARKET_REFRESH;

type ActiveMarketRefreshRun = {
  key: string;
  controller: AbortController;
  promise: Promise<void>;
  snapshotIds: ReadonlySet<string>;
  batch: boolean;
};

type MarketDataUpdateOptions = {
  executions?: TradeExecution[];
  refreshMetadata?: boolean;
  batch?: boolean;
};

type MarketHydrationInFlight = {
  key: string;
  runId: number;
};

type MarketDataRefreshOutcome = {
  status: MarketDataSyncStatus;
  /** At least one interval failed and can be retried for this instrument. */
  retryable: boolean;
};

type MarketDataRefreshSnapshot = {
  state: InstrumentMarketState;
  sequence: number;
  job?: MarketDataJob;
};

function isHardMarketDataFailure(status: unknown) {
  return (
    status === "source-rate-limited" ||
    status === "source-forbidden" ||
    status === "source-unavailable" ||
    status === "invalid-response" ||
    status === "storage-error" ||
    status === "error" ||
    status === "needs-provider"
  );
}

/** Select an existing account before opening a quality check for an instrument.
 * Quality actions currently carry instrument ids only, so use the first
 * concrete imported account as the dialog's starting scope instead of the
 * empty id which would hide that account's executions and repair actions.
 */
export function defaultAccountIdForInstrument(
  instrumentId: string,
  executions: ReadonlyArray<TradeExecution>,
): string {
  return executions.find(
    execution =>
      execution.instrument.id === instrumentId &&
      execution.accountId.trim().length > 0,
  )?.accountId ?? "";
}

export function accountIdForQualityCheck(
  instrumentId: string,
  executions: ReadonlyArray<TradeExecution>,
  episodeAccountId?: string,
): string {
  const accountId = episodeAccountId?.trim();
  return accountId || defaultAccountIdForInstrument(instrumentId, executions);
}

function qualityModelSignature(model: TradingRoomQualityModel): string {
  return JSON.stringify(model);
}

export function TradeReviewWorkspace({
  initialFrame,
  showDemo = true,
  fxSlot,
  screenshotImportDependencies,
  storageClient: storageClientOverride,
  legacyStateExporter = exportLegacyBrowserState,
}: Props) {
  const [storageClient] = useState<SqliteHttpClient>(
    () => storageClientOverride ?? createSqliteHttpClient(),
  );
  const marketDataRepository = useMemo(
    () => new ApiMarketDataRepository(storageClient),
    [storageClient],
  );
  const reviewRepository = useMemo(
    () => new ApiEpisodeReviewRepository(storageClient),
    [storageClient],
  );
  const suggestionRepository = useMemo(
    () => new ApiTagSuggestionRepository(storageClient),
    [storageClient],
  );
  const metadataRepository = useMemo(
    () => new ApiInstrumentMetadataRepository(storageClient),
    [storageClient],
  );

  const [storedInstruments, setStoredInstruments] = useState<StoredInstrument[]>([]);
  const [mobileTradesOpen, setMobileTradesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dataTarget, setDataTarget] = useState<{ instrument: Instrument; accountId: string; cursor?: string }>();
  const [layout, setLayout] = useState({ left: true, right: true });
  const [focusedChart, setFocusedChart] = useState(false);
  const layoutBeforeFocus = useRef(layout);
  function toggleFocus() {
    if (focusedChart) setLayout(layoutBeforeFocus.current);
    else { layoutBeforeFocus.current = layout; setLayout({ left: false, right: false }); setDrawerOpen(false); setMobileTradesOpen(false); }
    setFocusedChart(!focusedChart);
  }
  const [stockDrawerOpen, setStockDrawerOpen] = useState(false);
  const stockDrawerRef = useModalFocus(() => setStockDrawerOpen(false), stockDrawerOpen);
  const tradingViewInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importScreenshotRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.("(min-width: 1060px)");
    if (!media) return;
    const closeOnDesktop = () => { if (media.matches) { setStockDrawerOpen(false); setMobileTradesOpen(false); } };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const [libraryBrowseState, setLibraryBrowseState] = useState<TradeLibraryBrowseState>();
  const [sharedScope, setSharedScope] = useState<SharedScope>(DEFAULT_SHARED_SCOPE);
  const [sharedScopeRestored, setSharedScopeRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(sharedScopeStorageKey());
      // Restore browser-only preferences after hydration so the server and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSharedScope(normalizeSharedScope(JSON.parse(saved)));
    } catch { /* A malformed or unavailable preference must not block the ledger. */ }
    setSharedScopeRestored(true);
  }, []);
  useEffect(() => {
    if (!sharedScopeRestored) return;
    try { window.localStorage.setItem(sharedScopeStorageKey(), JSON.stringify(sharedScope)); } catch { /* Storage may be disabled. */ }
  }, [sharedScope, sharedScopeRestored]);
  const updateSharedScope = useCallback((patch: Partial<SharedScope>) => {
    setSharedScope(current => normalizeSharedScope({ ...current, ...patch }));
  }, []);

  const [reviewQueueIds, setReviewQueueIds] = useState<string[]>();
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);
  const [qualityModel, setQualityModel] = useState<TradingRoomQualityModel | null>(null);
  const updateQualityModel = useCallback((next: TradingRoomQualityModel) => {
    setQualityModel(current => current && qualityModelSignature(current) === qualityModelSignature(next)
      ? current
      : next);
  }, []);
  const [activeView, setActiveViewState] = useState<
    "dashboard" | "review" | "library" | "insights" | "data"
  >(showDemo ? "review" : "dashboard");
  const recallLeaveGuardRef = useRef<(() => Promise<boolean>) | null>(null);
  const navigationAttemptRef = useRef(0);
  const registerRecallLeaveGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    recallLeaveGuardRef.current = guard;
  }, []);
  function setActiveView(next: typeof activeView) {
    const attempt = ++navigationAttemptRef.current;
    if (activeView !== "review" || next === "review" || !recallLeaveGuardRef.current) {
      setActiveViewState(next);
      return;
    }
    void recallLeaveGuardRef.current().then(allowed => {
      if (allowed && attempt === navigationAttemptRef.current) setActiveViewState(next);
    }).catch(() => setNavigationNotice("复盘尚未保存，请重试保存后再离开。"));
  }
  const [reviewReturnView, setReviewReturnView] = useState<ReviewReturnView>(
    showDemo ? "library" : "dashboard",
  );
  const fxRates = useFxRates({
    enabled: !showDemo,
  });
  const fxSnapshot = useMemo(() => toRoomFxSnapshot(fxRates.state), [fxRates.state]);
  const resolvedFxSlot = fxSlot ?? (
    !showDemo ? (
      <FxPanel
        state={fxRates.state}
        loading={fxRates.loading}
        refreshing={fxRates.refreshing}
        error={fxRates.error}
        onRefresh={fxRates.refresh}
      />
    ) : undefined
  );
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [legacyTimeframe, setLegacyTimeframe] = useState<"1D" | "1W">("1D");
  const [historyMode, setHistoryMode] = useState<"history" | "replay">("history");
  const [frame, setFrame] = useState(initialFrame);
  const [playing, setPlaying] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(700);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawingHistory, setDrawingHistory] = useState<DrawingHistory>(
    () => createDrawingHistory(),
  );
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [layersOpen, setLayersOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<"stats" | "notes">(
    "stats",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importManagementOpen, setImportManagementOpen] = useState(false);
  const [settings, setSettings] = useState<ChartSettings>(
    DEFAULT_CHART_SETTINGS,
  );
  const [importedExecutions, setImportedExecutions] = useState<
    TradeExecution[]
  >([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(
    showDemo ? "demo" : "",
  );
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(REVIEW_ID);
  const [locateRequest, setLocateRequest] = useState<ReviewChartLocateRequest>();
  const [importedCursor, setImportedCursor] = useState(initialFrame.cursor);
  const supplementScopeRef = useRef<SupplementScope | null>(null);
  const [supplementScope, setSupplementScope] = useState<SupplementScope | null>(null);
  const [supplementExcluded, setSupplementExcluded] = useState(0);
  const supplementSaving = useRef(false);
  const supplementRequestRef = useRef<TradeRevisionRequest | null>(null);
  const [savingSupplement, setSavingSupplement] = useState(false);
  const screenshotExcludedRef = useRef(0);
  function clearSupplement() { supplementRequestRef.current = null; supplementScopeRef.current = null; setSupplementScope(null); setSupplementExcluded(0); }
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(
    null,
  );
  const [pendingTradingViewFile, setPendingTradingViewFile] =
    useState<File | null>(null);
  const [pendingParsedImport, setPendingParsedImport] =
    useState<StatementParseResult | null>(null);
  const [monthlyReview, setMonthlyReview] = useState<{ file: File; parsed: StatementParseResult } | null>(null);
  const [monthlyConflictDecisions, setMonthlyConflictDecisions] = useState<ReadonlyMap<string, ReconciliationDecision>>(new Map());
  const importFileQueue = useRef<File[]>([]);
  const [pendingEnrichedImport, setPendingEnrichedImport] =
    useState<EnrichedImportResult | null>(null);
  const [pendingImportOriginalExecutions, setPendingImportOriginalExecutions] =
    useState<TradeExecution[] | null>(null);
  const [pendingImportMergeBase, setPendingImportMergeBase] =
    useState<TradeExecution[] | null>(null);
  const [pendingScreenshotDecisions, setPendingScreenshotDecisions] =
    useState<ReadonlyMap<string, ReconciliationDecision> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(
    [],
  );
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [marketStates, setMarketStates] = useState<
    Record<string, InstrumentMarketState>
  >({});
  const [marketDataJobs, setMarketDataJobs] = useState<
    Record<string, MarketDataJob>
  >({});
  const [marketDataRefresh, setMarketDataRefresh] =
    useState<GlobalMarketRefreshState>(EMPTY_MARKET_DATA_REFRESH);
  const [failedMarketDataIds, setFailedMarketDataIds] = useState<string[]>([]);
  const [hydratedMarketIds, setHydratedMarketIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [episodeReviews, setEpisodeReviews] = useState<
    Record<string, EpisodeReviewRecord>
  >({});
  const [reviewsHydrated, setReviewsHydrated] = useState(false);
  const [suggestionDecisions, setSuggestionDecisions] = useState<
    TagSuggestionRecord[]
  >([]);
  const [suggestionsHydrated, setSuggestionsHydrated] = useState(false);
  const [libraryTarget, setLibraryTarget] =
    useState<TradeLibraryTarget>();
  const [importing, setImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [savingImport, setSavingImport] = useState(false);
  const [retryingUnresolved, setRetryingUnresolved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageState, setStorageState] = useState<
    "loading" | "migration" | "ready" | "error"
  >("loading");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [reviewStates, setReviewStates] = useState<
    Record<string, EpisodeReviewState>
  >({});
  const drawingDraftsRef = useRef<Record<string, EpisodeReviewState>>({});
  const drawingSaveQueuesRef = useRef<Record<string, Promise<void>>>({});
  const drawingSaveSequencesRef = useRef<Record<string, number>>({});
  const drawingSaveErrorsRef = useRef<Record<string, string>>({});
  const drawingEpisodeRef = useRef<string | undefined>(
    showDemo ? REVIEW_ID : undefined,
  );
  const [drawingSaveErrors, setDrawingSaveErrors] = useState<Record<string, string>>({});
  const [drawingSavePending, setDrawingSavePending] = useState<Record<string, boolean>>({});
  const replayRequestSequence = useRef(0);
  const importRequestSequence = useRef(0);
  const importedExecutionsRef = useRef<TradeExecution[] | null>(null);
  const marketDataRequestSequences = useRef<Record<string, number>>({});
  const metadataRefreshes = useRef<Record<string, Promise<ResolvedInstrument | undefined>>>({});
  const localizedHydrationAttempted = useRef(new Set<string>());
  const localizedHydrationQueue = useRef<LocalizedMetadataHydrationQueue | null>(null);
  if (!localizedHydrationQueue.current) {
    localizedHydrationQueue.current = new LocalizedMetadataHydrationQueue(localizedHydrationAttempted.current);
  }
  const marketDataJobsRef = useRef<Record<string, MarketDataJob>>({});
  const marketDataAbortControllers = useRef<
    Record<string, AbortController>
  >({});
  const refreshCancellation = useRef(new RefreshCancellationService());
  const activeMarketRefreshRuns = useRef(new Map<string, ActiveMarketRefreshRun>());
  const marketHydrationKeys = useRef(new Map<string, string>());
  const marketHydrationInFlight = useRef(new Map<string, MarketHydrationInFlight>());
  const marketHydrationRunSequence = useRef(0);
  const [suggestionGeneratedAt] = useState(() => new Date().toISOString());
  const libraryTargetSequence = useRef(0);

  function currentExecutionSnapshot() {
    return importedExecutionsRef.current ?? [];
  }

  const screenshotImport = useScreenshotImport({
    currentExecutions: currentExecutionSnapshot,
    onPrepared: prepareScreenshotImport,
    transformRecords: records => {
      const filtered = supplementScopeRef.current ? scopedRecords(records, supplementScopeRef.current) : records;
      screenshotExcludedRef.current = records.length - filtered.length; return filtered;
    },
    dependencies: screenshotImportDependencies,
  });
  const rawImportedInstruments = useMemo(
    () => buildInstrumentTradeSummaries(importedExecutions),
    [importedExecutions],
  );
  // Metadata overlays can update an execution's display name without changing
  // the market-data range. Keep that update out of the inventory hydration
  // dependency so one rename cannot restart reads for every instrument.
  const rawImportedInstrumentHydrationKey = useMemo(
    () => rawImportedInstruments
      .map((summary) => `${summary.instrument.id}:${summary.tradeCount}:${summary.firstTradeAt}:${summary.lastTradeAt}`)
      .join("|"),
    [rawImportedInstruments],
  );
  const importedInstruments = useMemo(
    () => overlayStoredInstrumentMetadata(rawImportedInstruments, storedInstruments),
    [rawImportedInstruments, storedInstruments],
  );
  const instrumentMetadata = useMemo<TradingRoomMetadataInput>(() => {
    const metadata = new Map<string, TradingRoomInstrumentMetadata>();
    for (const storedInstrument of storedInstruments) {
      const resolved = storedInstrument.metadata;
      if (!resolved) continue;
      metadata.set(storedInstrument.id, {
        market: resolved.market,
        symbol: resolved.symbol,
        assetType: resolved.assetType,
      });
    }
    return metadata;
  }, [storedInstruments]);
  const selectedRawImportedInstrument = rawImportedInstruments.find(
    (item) => item.instrument.id === selectedInstrumentId,
  );
  const selectedImportedInstrument = importedInstruments.find(
    (item) => item.instrument.id === selectedInstrumentId,
  );
  const episodes = useMemo(
    () => sortedEpisodes(selectedImportedInstrument),
    [selectedImportedInstrument],
  );
  const selectedEpisode = selectedEpisodeId
    ? episodes.find((episode) => episode.id === selectedEpisodeId)
    : episodes[0];
  const selectedMarketState = useMemo(
    () =>
      selectedImportedInstrument
        ? marketStates[selectedImportedInstrument.instrument.id] ??
          emptyMarketState()
        : emptyMarketState("complete"),
    [marketStates, selectedImportedInstrument],
  );
  const importedAvailability = useMemo(
    () =>
      resolveEpisodeTimeframeAvailability(
        selectedMarketState,
        selectedEpisode,
      ),
    [selectedEpisode, selectedMarketState],
  );
  const importedSourceCandles = useMemo(
    () =>
      selectedImportedInstrument
        ? sourceCandlesForTimeframe(selectedMarketState, timeframe)
        : [],
    [selectedImportedInstrument, selectedMarketState, timeframe],
  );
  const importedTimelineCandles = useMemo(
    () =>
      selectedImportedInstrument
        ? aggregateVisibleCandles(
            importedSourceCandles,
          timeframe,
          selectedImportedInstrument.instrument.market,
          selectedMarketState.intradayInterval,
        )
        : [],
    [
      importedSourceCandles,
      selectedImportedInstrument,
      selectedMarketState.intradayInterval,
      timeframe,
    ],
  );
  const recallCandlesByTimeframe = useMemo<Partial<Record<Timeframe, Candle[]>>>(
    () => {
      if (!selectedImportedInstrument) return {};
      return Object.fromEntries(
        (Object.keys(ALL_TIMEFRAMES) as Timeframe[]).map((nextTimeframe) => [
          nextTimeframe,
          aggregateVisibleCandles(
            sourceCandlesForTimeframe(selectedMarketState, nextTimeframe),
            nextTimeframe,
            selectedImportedInstrument.instrument.market,
            selectedMarketState.intradayInterval,
          ),
        ]),
      );
    },
    [selectedImportedInstrument, selectedMarketState],
  );
  const firstImportedKnownCursor = useMemo(() => {
    const first = [...importedTimelineCandles].sort(
      (left, right) =>
        Date.parse(candleKnowledgeAt(left)) -
        Date.parse(candleKnowledgeAt(right)),
    )[0];
    return first ? candleKnowledgeAt(first) : undefined;
  }, [importedTimelineCandles]);
  const effectiveImportedCursor = importedCursor;
  const importedHistoryStartsAfterTrade = Boolean(
    selectedImportedInstrument &&
      selectedEpisode &&
      firstImportedKnownCursor &&
      selectedEpisode.executions.some(execution => execution.source.tradingSession !== "grey-market" && Date.parse(execution.executedAt) <= Date.parse(firstImportedKnownCursor)),
  );
  const activeCursor = selectedImportedInstrument
    ? historyMode === "history"
      ? latestImportedHistoryCursor(
          effectiveImportedCursor,
          importedTimelineCandles,
          selectedEpisode?.executions ?? [],
        )
      : effectiveImportedCursor
    : frame.cursor;
  const importedVisibleSource = useMemo(
    () =>
      importedSourceCandles.filter(
        (candle) => candleKnowledgeAt(candle) <= activeCursor,
      ),
    [activeCursor, importedSourceCandles],
  );
  const importedDisplayCandles = useMemo(
    () =>
      importedTimelineCandles.filter(
        (candle) => candleKnowledgeAt(candle) <= activeCursor,
      ),
    [activeCursor, importedTimelineCandles],
  );
  const importedReplay = createImportedReplay({
    candles: importedTimelineCandles,
    executions: selectedEpisode?.executions ?? [],
    storedCursor: effectiveImportedCursor,
  });
  const importedCanGoBack = importedTimelineCandles.some(
    (candle) => candleKnowledgeAt(candle) < activeCursor,
  );
  const importedCanGoForward = importedTimelineCandles.some(
    (candle) => candleKnowledgeAt(candle) > activeCursor,
  );
  const importedCanGoToNextExecution = Boolean(
    selectedEpisode?.executions.some(
      (execution) => execution.executedAt > activeCursor,
    ),
  );

  const demoChartCandles = useMemo(
    () => aggregateCandles(frame.candles15m, timeframe),
    [frame.candles15m, timeframe],
  );
  const demoSnapshot = useMemo(
    () =>
      createReplaySnapshot({
        candles: demoChartCandles,
        executions: frame.executions,
        cursor: frame.cursor,
      }),
    [demoChartCandles, frame.cursor, frame.executions],
  );
  const importedSnapshot = useMemo(
    () =>
      createReplaySnapshot({
        candles: importedDisplayCandles,
        executions: selectedEpisode?.executions ?? [],
        cursor: activeCursor,
      }),
    [activeCursor, importedDisplayCandles, selectedEpisode?.executions],
  );
  const activeSnapshot = selectedImportedInstrument
    ? importedSnapshot
    : demoSnapshot;
  const activeEpisodeId = selectedImportedInstrument
    ? selectedEpisode?.id ?? selectedEpisodeId
    : REVIEW_ID;
  const activeDrawingSaveError = drawingSaveErrors[activeEpisodeId];
  const activeDrawingSavePending = Boolean(drawingSavePending[activeEpisodeId]);
  const activeInstrument = selectedImportedInstrument?.instrument ??
    DEMO_INSTRUMENT;
  const activeReview = episodeReviews[activeEpisodeId];
  const activePlan = episodePlanAtCursor(activeReview, activeCursor);
  const activePositionEvents = useMemo(
    () => [...new Map(activeSnapshot.executions.flatMap(execution => execution.source.positionEvents ?? []).map(event => [event.id, event])).values()],
    [activeSnapshot.executions],
  );
  const activeMetrics = useMemo(
    () =>
      calculatePositionPathMetrics({
        candles: selectedImportedInstrument
          ? importedVisibleSource
          : frame.candles15m,
        executions: selectedImportedInstrument
          ? selectedEpisode?.executions ?? []
          : frame.executions,
        cursor: activeCursor,
        episodeStartedAt:
          selectedEpisode?.startedAt ??
          initialFrame.candles15m[0]?.time ??
          initialFrame.cursor,
        episodeEndedAt: selectedEpisode?.endedAt,
        plannedRiskAmount: activePlan?.plannedRiskAmount,
      }),
    [
      activeCursor,
      activePlan?.plannedRiskAmount,
      frame.candles15m,
      frame.executions,
      importedVisibleSource,
      initialFrame.candles15m,
      initialFrame.cursor,
      selectedEpisode,
      selectedImportedInstrument,
    ],
  );

  const marketDataCandles = useMemo(
    () =>
      Object.fromEntries(
        importedInstruments.map((summary) => [
          summary.instrument.id,
          marketStates[summary.instrument.id]?.daily ?? [],
        ]),
      ),
    [importedInstruments, marketStates],
  );
  const dailyCoverageByInstrument = useMemo(
    () =>
      Object.fromEntries(
        importedInstruments.map((summary) => [
          summary.instrument.id,
          marketStates[summary.instrument.id]?.dailyCoverage ?? [],
        ]),
      ),
    [importedInstruments, marketStates],
  );
  const marketDataStatuses = useMemo(
    () =>
      Object.fromEntries(
        importedInstruments.map((summary) => {
          const state = marketStates[summary.instrument.id];
          return [
            summary.instrument.id,
            displayMarketDataStatus(
              state?.dailyStatus ?? ("not-requested" satisfies MarketDataSyncStatus),
              state?.intradayStatus ?? ("not-requested" satisfies MarketDataSyncStatus),
              {
                hasDailyData: Boolean(state?.daily.length),
                hasIntradayData: Boolean(state?.intraday.length),
                intradayJobStatus: displaySavedMarketDataStatus(
                  marketDataJobs[summary.instrument.id]?.intervals.find(
                    (item) => item.interval === "1h",
                  )?.status ?? "not-requested",
                ),
              },
            ),
          ];
        }),
      ),
    [importedInstruments, marketDataJobs, marketStates],
  );
  const marketDataLabels = useMemo(
    () => Object.fromEntries(importedInstruments.map(({ instrument }) => {
      const state = marketStates[instrument.id];
      return [instrument.id, `日线：${marketDataStatusLabel(state?.dailyStatus ?? "not-requested")}；1H：${marketDataStatusLabel(state?.intradayStatus ?? "not-requested")}`];
    })),
    [importedInstruments, marketStates],
  );
  const marketDataDailyStatuses = useMemo(
    () => Object.fromEntries(importedInstruments.map(({ instrument }) => [
      instrument.id,
      marketStates[instrument.id]?.dailyStatus ?? ("not-requested" satisfies MarketDataSyncStatus),
    ])),
    [importedInstruments, marketStates],
  );
  const tradeLibraryEntries = useMemo(
    () =>
      buildTradeLibraryEntries(
        importedInstruments,
        marketDataCandles,
        marketDataStatuses,
        episodeReviews,
      ),
    [
      episodeReviews,
      importedInstruments,
      marketDataCandles,
      marketDataStatuses,
    ],
  );
  const scopedTradeLibraryEntries = useMemo(
    () => filterEntriesBySharedScope(tradeLibraryEntries, sharedScope),
    [tradeLibraryEntries, sharedScope],
  );
  const sharedAccountOptions = useMemo(() => {
    const scopeEntries = filterEntriesBySharedScope(tradeLibraryEntries, { ...sharedScope, accountIds: [] });
    const options = [...new Map(scopeEntries.flatMap(entry => entry.executions.map(execution =>
      [execution.accountId, { id: execution.accountId, label: execution.accountLabel || "未命名账户" }] as const))).values()];
    const counts = new Map<string, number>();
    for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
    const seen = new Map<string, number>();
    return options.map(option => {
      const ordinal = (seen.get(option.label) ?? 0) + 1;
      seen.set(option.label, ordinal);
      return { ...option, label: (counts.get(option.label) ?? 0) > 1 ? `${option.label} · 账户 ${ordinal}` : option.label };
    });
  }, [tradeLibraryEntries, sharedScope]);
  const qualityInput = useMemo(
    () => ({
      marketDataStatuses,
      marketDataDailyStatuses,
      marketDataCandles,
      marketDataLabels,
      marketDataJobs,
      fxState: fxRates.state,
      fxSnapshot,
    }),
    [fxRates.state, fxSnapshot, marketDataCandles, marketDataDailyStatuses, marketDataJobs, marketDataLabels, marketDataStatuses],
  );
  const holdingsQuotesByInstrument = useMemo<Readonly<Record<string, TradingRoomQuote | undefined>>>(
    () => Object.fromEntries(
      tradeLibraryEntries.map(entry => [
        entry.instrument.id,
        entry.latestQuote
          ? {
              price: entry.latestQuote.price,
              currency: entry.latestQuote.currency,
              quoteDate: entry.latestQuote.quoteDate,
              fetchedAt: entry.latestQuote.fetchedAt,
              provider: entry.latestQuote.provider,
              freshness: "current" as const,
            }
          : undefined,
      ]),
    ),
    [tradeLibraryEntries],
  );
  const holdingsAsOf = useMemo(() => new Date().toISOString(), []);
  const currentEpisodeIds = useMemo(
    () => new Set(tradeLibraryEntries.flatMap(entry => entry.episodes.map(({ episode }) => episode.id))),
    [tradeLibraryEntries],
  );
  const searchableInstruments = useMemo(
    () =>
      [
        ...(showDemo
          ? [
              {
                id: "demo",
                name: DEMO_INSTRUMENT.name,
                symbol: DEMO_INSTRUMENT.symbol,
                market: DEMO_INSTRUMENT.market,
              },
            ]
          : []),
        ...importedInstruments.map(({ instrument }) => ({
          id: instrument.id,
          name: instrument.name,
          symbol: instrument.symbol,
          market: instrument.market,
        })),
      ],
    [importedInstruments, showDemo],
  );

  const viewModel: ReviewChartViewModel = {
    source: selectedImportedInstrument ? "imported" : "demo",
    tradeNature: selectedImportedInstrument
      ? selectedEpisode?.executions[0] ? displayTradeNature(selectedEpisode.executions[0]) : "unknown"
      : undefined,
    simulationRunId: selectedImportedInstrument
      ? selectedEpisode?.simulationRunId
      : undefined,
    historyMode: selectedImportedInstrument ? historyMode : undefined,
    episodeId: activeEpisodeId,
    instrument: activeInstrument,
    timeframe,
    timeframeAvailability: selectedImportedInstrument
      ? importedAvailability
      : ALL_TIMEFRAMES,
    cursor: activeCursor,
    focusedExecutions: selectedEpisode?.executions,
    candles: activeSnapshot.candles,
    executions: selectedImportedInstrument && historyMode === "history"
      ? selectedImportedInstrument.executions.filter(execution => selectedEpisode?.executions[0]
        ? execution.accountId === selectedEpisode.accountId && execution.source.tradeNature === selectedEpisode.executions[0].source.tradeNature && execution.source.simulationRunId === selectedEpisode.executions[0].source.simulationRunId
        : true)
      : activeSnapshot.executions,
    positionEvents: activePositionEvents,
    position: activeSnapshot.position,
    pathMetrics: activeMetrics,
    canGoBack: selectedImportedInstrument
      ? importedCanGoBack
      : frame.canGoBack && !stepping && !restoring,
    canGoForward: selectedImportedInstrument
      ? importedCanGoForward
      : frame.canGoForward && !stepping && !restoring,
    canGoToNextExecution: selectedImportedInstrument
      ? importedCanGoToNextExecution
      : frame.canGoForward && !stepping && !restoring,
    replayError,
    replayNotice: importedHistoryStartsAfterTrade
      ? "缺少首笔成交之前的历史行情背景：当前周期没有此前已完成的 K 线。可能是上市首日或数据尚未覆盖；可检查行情或切换更小周期，推进后按时间揭示成交。"
      : null,
    dataDetails: selectedImportedInstrument
      ? marketDataDetails(selectedMarketState, importedAvailability)
      : [
          {
            providerLabel: "内置演示数据",
            nativeInterval: "15m",
            coverageStart: frame.candles15m[0]?.time,
            coverageEnd: frame.candles15m.at(-1)?.time,
            status: "complete",
            availableTimeframes: [
              "15m",
              "1h",
              "4h",
              "1D",
              "1W",
            ],
          },
        ],
    refreshDisabledReason:
      !selectedImportedInstrument && (stepping || restoring)
        ? "正在读取演示回放数据"
      : undefined,
  };
  // The legacy chart remains available for the demo branch below. Keep an
  // alias so its callbacks retain the imported-data behavior if that branch
  // is reached without narrowing the outer Recall branch to `never`.
  const legacySelectedImportedInstrument = selectedImportedInstrument;
  const pendingReviewInstrumentIds = useMemo(() => tradeLibraryEntries.filter((entry) => entry.reviewedEpisodeCount < entry.episodeCount).map((entry) => entry.instrument.id), [tradeLibraryEntries]);
  const tagSuggestions = useMemo(
    () =>
      buildTagSuggestions(
        tradeLibraryEntries,
        marketDataCandles,
        suggestionDecisions,
        suggestionGeneratedAt,
      ),
    [
      marketDataCandles,
      suggestionDecisions,
      suggestionGeneratedAt,
      tradeLibraryEntries,
    ],
  );
  const [summaryFilters, setSummaryFilters] = useState(initialReviewSummaryFilters);
  const [summaryDrafts, setSummaryDrafts] = useState<ReviewSummaryDrafts>({});
  const [insightsTab, setInsightsTab] = useState<"summary" | "patterns">("summary");
  const [patternCategory, setPatternCategory] = useState<Category>("all");
  const [dataTab, setDataTab] = useState<"import" | "quality" | "settings">("import");
  const [requestedSummaryScope, setRequestedSummaryScope] = useState("");
  const summaryClient = useMemo(() => createReviewSummaryClient(), []);
  const summaryScopes = useMemo(() => reviewScopeOptions(scopedTradeLibraryEntries), [scopedTradeLibraryEntries]);
  const summaryScope = summaryScopes.some(scope => scope.id === requestedSummaryScope)
    ? requestedSummaryScope : summaryScopes[0]?.id ?? "";
  const insightEpisodeContexts = useMemo(
    () =>
      Object.fromEntries(
        tradeLibraryEntries.flatMap((entry) =>
          entry.episodes.map((item, index) => [
            item.episode.id,
            {
              instrumentId: entry.instrument.id,
              instrumentName: entry.instrument.name,
              instrumentSymbol: entry.instrument.symbol,
              episodeLabel: `第 ${entry.episodes.length - index} 次交易`,
              dateRange: `${formatBeijingDate(item.episode.startedAt)}—${
                item.episode.endedAt
                  ? formatBeijingDate(item.episode.endedAt)
                  : "持仓中"
              }`,
            },
          ]),
        ),
      ),
    [tradeLibraryEntries],
  );
  function renderScopedInsights(range: ReviewSummaryRange) {
    const entries = filterTradeLibraryEntriesByScope(scopedTradeLibraryEntries, summaryScope, range);
    const ids = new Set(entries.flatMap(entry => entry.episodes.map(item => item.episode.id)));
    const result = buildInsightEpisodeFacts(entries, marketDataCandles, marketDataStatuses, suggestionDecisions, dailyCoverageByInstrument);
    return <PatternInsights
      report={buildPatternInsightReport(result.facts, result.excluded)} facts={result.facts}
      suggestions={suggestionsHydrated && reviewsHydrated ? tagSuggestions.filter(suggestion => ids.has(suggestion.episodeId)) : []}
      episodeContexts={insightEpisodeContexts} onConfirmSuggestion={confirmSuggestion}
      onEditSuggestion={editSuggestion} onRejectSuggestion={rejectSuggestion} onRevokeSuggestion={revokeSuggestion} onOpenEpisode={(instrumentId, episodeId) => openLibraryEpisode(instrumentId, episodeId, undefined, "insights")}
      category={patternCategory} onCategoryChange={setPatternCategory}
    />;
  }
  function reviewExtras(episode: TradeEpisode): Pick<EpisodeNotesProps, "ruleContent" | "suggestions"> {
    const candidates = trackedRuleCandidates(tradeLibraryEntries, episode.id);
    const suggestions = suggestionsHydrated && reviewsHydrated ? tagSuggestions.filter(item => item.episodeId === episode.id) : [];
    return {
      ruleContent: (draft, update) => <RuleChecks candidates={candidates} checks={draft.review.ruleChecks ?? []} onChange={update} onOpenSource={openLibraryEpisode} />,
      suggestions: suggestions.length ? (onBusyChange) => <details className="review-episode-suggestions"><summary>本回合标签建议（{suggestions.filter(item => item.status === "suggested").length}）</summary><TagSuggestionPanel onBusyChange={onBusyChange} suggestions={suggestions} episodeContexts={insightEpisodeContexts} onConfirm={confirmSuggestion} onEdit={editSuggestion} onReject={rejectSuggestion} onRevoke={revokeSuggestion} onOpenEpisode={openLibraryEpisode} /></details> : undefined,
    };
  }


  async function requestFrame(
    mode: DemoReplayMode,
    requestedCursor = frame.cursor,
  ) {
    if (stepping || restoring) return;
    const requestId = ++replayRequestSequence.current;
    setStepping(true);
    setReplayError(null);
    try {
      const nextFrame = await fetchDemoFrame(mode, requestedCursor);
      if (requestId !== replayRequestSequence.current) return;
      setFrame(nextFrame);
      if (!nextFrame.canGoForward) setPlaying(false);
    } catch {
      if (requestId !== replayRequestSequence.current) return;
      setPlaying(false);
      setReplayError("回放数据暂时无法读取，请重试。");
    } finally {
      if (requestId === replayRequestSequence.current) {
        setStepping(false);
      }
    }
  }

  function restoreEpisodeUi(
    episodeId: string,
    fallbackCursor: string,
    preferredTimeframe: Timeframe,
    source: Candle[] = [],
    episodeStartedAt = fallbackCursor,
  ) {
    const stored = drawingDraftsRef.current[episodeId] ?? reviewStates[episodeId];
    drawingEpisodeRef.current = episodeId;
    setTimeframe(stored?.timeframe ?? preferredTimeframe);
    const storedCursor = stored?.replayCursor;
    setImportedCursor(
      storedCursor &&
        source.length > 0 &&
        replayHistoryStartsAfter(source, storedCursor, episodeStartedAt)
        ? replayCursorForEpisode(source, episodeStartedAt)
        : storedCursor ?? fallbackCursor,
    );
    setActivePanelTab(stored?.activePanelTab ?? "stats");
    setDrawingHistory(createDrawingHistory(stored?.drawings ?? []));
    setActiveTool("cursor");
    setSelectedDrawingId(null);
    setLayersOpen(false);
    setDrawerOpen(false);
  }

  function selectImportedSummary(summary: InstrumentTradeSummary, episodeId?: string) {
    const availableEpisodes = sortedEpisodes(summary);
    const newest = episodeId
      ? availableEpisodes.find((episode) => episode.id === episodeId)
      : availableEpisodes[0];
    if (!newest) return false;
    setImportManagementOpen(false);
    setPlaying(false);
    replayRequestSequence.current += 1;
    setStepping(false);
    setReplayError(null);
    setLocateRequest(undefined);
    setSelectedInstrumentId(summary.instrument.id);
    setSelectedEpisodeId(newest.id);
    const state = marketStates[summary.instrument.id] ?? emptyMarketState();
    const availability = resolveEpisodeTimeframeAvailability(
      state,
      newest,
    );
    const preferred =
      state.intradayInterval === "1h" && availability["1h"].enabled
        ? "1h"
        : availability["15m"].enabled
          ? "15m"
          : "1D";
    const source = sourceCandlesForTimeframe(state, preferred);
    const fallback = replayCursorForEpisode(source, newest.startedAt);
    restoreEpisodeUi(newest.id, fallback, preferred, source, newest.startedAt);
    return true;
  }

  function selectInstrument(instrumentId: string) {
    setReviewQueueIds(undefined);
    if (instrumentId === "demo") {
      if (!showDemo) return;
      setImportManagementOpen(false);
      setPlaying(false);
      setSelectedInstrumentId("demo");
      setSelectedEpisodeId(REVIEW_ID);
      setLocateRequest(undefined);
      const stored = drawingDraftsRef.current[REVIEW_ID] ?? reviewStates[REVIEW_ID];
      drawingEpisodeRef.current = REVIEW_ID;
      setTimeframe(stored?.timeframe ?? "1D");
      setActivePanelTab(stored?.activePanelTab ?? "stats");
      setDrawingHistory(createDrawingHistory(stored?.drawings ?? []));
      setSelectedDrawingId(null);
      setLayersOpen(false);
      setDrawerOpen(false);
      setReplayError(null);
      if (
        stored?.replayCursor &&
        stored.replayCursor !== frame.cursor
      ) {
        const requestId = ++replayRequestSequence.current;
        setRestoring(true);
        void fetchDemoFrame("restore", stored.replayCursor)
          .then((restoredFrame) => {
            if (requestId === replayRequestSequence.current) {
              setFrame(restoredFrame);
            }
          })
          .catch(() => {
            if (requestId === replayRequestSequence.current) {
              setReplayError(
                "上次演示回放位置无法恢复，已保留当前安全位置。",
              );
            }
          })
          .finally(() => {
            if (requestId === replayRequestSequence.current) {
              setRestoring(false);
            }
          });
      }
      return;
    }
    const summary = importedInstruments.find(
      (item) => item.instrument.id === instrumentId,
    );
    if (summary) selectImportedSummary(summary);
  }

  function selectEpisode(episodeId: string) {
    setReviewQueueIds(undefined);
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode) return;
    setPlaying(false);
    setLocateRequest(undefined);
    setSelectedEpisodeId(episode.id);
    const availability = resolveEpisodeTimeframeAvailability(
      selectedMarketState,
      episode,
    );
    const preferred =
      selectedMarketState.intradayInterval === "1h" &&
      availability["1h"].enabled
        ? "1h"
        : availability["15m"].enabled
          ? "15m"
          : "1D";
    const source = sourceCandlesForTimeframe(
      selectedMarketState,
      preferred,
    );
    const fallback = replayCursorForEpisode(source, episode.startedAt);
    restoreEpisodeUi(episode.id, fallback, preferred, source, episode.startedAt);
  }

  function requestExecutionLocation(request: ReviewChartLocateRequest) {
    if (
      request.instrumentId !== selectedImportedInstrument?.instrument.id ||
      request.episodeId !== selectedEpisode?.id
    ) {
      return;
    }
    setNavigationNotice(null);
    setLocateRequest(request);
  }

  function handleLocateResult(result: ReviewChartLocateResult) {
    if (result.requestId !== locateRequest?.requestId) return;
    if (result.status === "missing") {
      setNavigationNotice("目标交易日缺少日线行情，未跳转到邻近日；可先更新该股票行情。");
    } else if (result.status === "unavailable") {
      setNavigationNotice(result.reason ?? "该成交当前不可定位，请先补齐行情。");
    }
  }

  useEffect(() => {
    let active = true;
    const requestId = ++replayRequestSequence.current;
    const bootstrapWorkspace = async () => {
      try {
        setStorageState("loading");
        setStorageError(null);
        let bootstrap = await storageClient.getBootstrap();
        if (!bootstrap.migration) {
          const legacyState = await legacyStateExporter({ excludeDemo: !showDemo });
          if (legacyState) {
            setStorageState("migration");
            await migrateLegacyBrowserState(storageClient, legacyState, {
              ignoreLocalMarker: true,
            });
            bootstrap = await storageClient.getBootstrap();
          }
        }
        if (!active) return;
        setStoredInstruments(bootstrap.instruments);
        const productionExecutions = applyMonthlyHistoryEvidence(showDemo
          ? bootstrap.executions
          : bootstrap.executions.filter((execution) => execution.source.platform !== "demo"),
          bootstrap.importHistory.flatMap(entry => entry.monthly ? [entry.monthly] : []));
        const storedSummaries = buildInstrumentTradeSummaries(
          productionExecutions,
        );
        // A saved `syncing` job is an unfinished snapshot. Loading the page
        // must not turn it into a terminal failure or write a new job; the
        // user can decide whether to recover it after seeing its last attempt.
        const savedJobs = bootstrap.marketDataJobs;
        const jobs = Object.fromEntries(
          savedJobs.map((job) => [job.instrumentId, job]),
        );
        marketDataJobsRef.current = jobs;
        const inventory = storedSummaries.map(({ instrument }) => ({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          market: instrument.market,
        }));
        const savedRefreshSummary = summarizePersistedMarketDataJobs(
          savedJobs,
          inventory,
        );
        const hasSavedMarketDataJobs = savedJobs.some((job) =>
          storedSummaries.some(
            (summary) => summary.instrument.id === job.instrumentId,
          ),
        );
        const states = Object.fromEntries(
          bootstrap.reviewStates.filter((state) => showDemo || state.episodeId !== REVIEW_ID).map((state) => [state.episodeId, state]),
        );
        const reviews = Object.fromEntries(
          bootstrap.reviews.filter((record) => showDemo || record.episodeId !== REVIEW_ID).map((record) => [record.episodeId, record]),
        );
        if (showDemo && !reviews[REVIEW_ID]) {
          reviews[REVIEW_ID] = defaultReviewRecord(
            REVIEW_ID,
            DEMO_INSTRUMENT.id,
            DEFAULT_THESIS,
          );
        }
        importedExecutionsRef.current = productionExecutions;
        setImportedExecutions(productionExecutions);
        setImportHistory(bootstrap.importHistory);
        setReviewStates(states);
        setEpisodeReviews(reviews);
        setReviewsHydrated(true);
        setSuggestionDecisions(bootstrap.tagSuggestions.filter((suggestion) => showDemo || suggestion.episodeId !== REVIEW_ID));
        setSuggestionsHydrated(true);
        setSettings(isChartSettings(bootstrap.settings) ? bootstrap.settings : DEFAULT_CHART_SETTINGS);
        setMarketDataJobs(jobs);
        setFailedMarketDataIds(
          hasSavedMarketDataJobs
            ? savedRefreshSummary.retryableInstrumentIds
            : [],
        );
        setMarketDataRefresh(
          hasSavedMarketDataJobs
            ? {
                ...EMPTY_MARKET_DATA_REFRESH,
                total: savedRefreshSummary.total,
                processed: savedRefreshSummary.processed,
                completed: savedRefreshSummary.completed,
                partial: savedRefreshSummary.partial,
                failed: savedRefreshSummary.failed,
                retryable: savedRefreshSummary.retryable,
                failureDetails: savedRefreshSummary.failureDetails,
                unfinishedInstrumentIds: savedRefreshSummary.unfinishedInstrumentIds,
                unfinishedDetails: savedRefreshSummary.unfinishedDetails,
                restored: true,
              }
            : EMPTY_MARKET_DATA_REFRESH,
        );
        setMarketStates(
          Object.fromEntries(
            storedSummaries.map((summary) => [
              summary.instrument.id,
              emptyMarketState(jobs[summary.instrument.id] ?? "not-requested"),
            ]),
          ),
        );
        const firstSummary = storedSummaries[0];
        const newestEpisode = sortedEpisodes(firstSummary)[0];
        const storedDemo = states[REVIEW_ID];
        if (firstSummary && newestEpisode) {
          const stored = states[newestEpisode.id];
          drawingEpisodeRef.current = newestEpisode.id;
          setSelectedInstrumentId(firstSummary.instrument.id);
          setSelectedEpisodeId(newestEpisode.id);
          setTimeframe(stored?.timeframe ?? "15m");
          setImportedCursor(stored?.replayCursor ?? replayCursorForEpisode([], newestEpisode.startedAt));
          setActivePanelTab(stored?.activePanelTab ?? "stats");
          setDrawingHistory(createDrawingHistory(stored?.drawings ?? []));
        } else if (showDemo && storedDemo) {
          drawingEpisodeRef.current = REVIEW_ID;
          setTimeframe(storedDemo.timeframe);
          setActivePanelTab(storedDemo.activePanelTab);
          setDrawingHistory(createDrawingHistory(storedDemo.drawings));
        }
        try {
          if (showDemo && storedDemo?.replayCursor && storedDemo.replayCursor !== initialFrame.cursor) {
            const restoredFrame = await fetchDemoFrame("restore", storedDemo.replayCursor);
            if (active && requestId === replayRequestSequence.current) setFrame(restoredFrame);
          }
        } catch {
          if (active && requestId === replayRequestSequence.current) {
            setReplayError("上次回放位置无法恢复，已从安全起点开始。");
          }
        }
        if (active && requestId === replayRequestSequence.current) {
          setRestoring(false);
          setHydrated(true);
          setStorageState("ready");
        }
      } catch (error) {
        if (!active || requestId !== replayRequestSequence.current) return;
        setRestoring(false);
        setStorageState("error");
        setStorageError(error instanceof Error ? error.message : "无法连接 SQLite 存储");
      }
    };
    void bootstrapWorkspace();
    return () => {
      active = false;
      replayRequestSequence.current += 1;
    };
  }, [bootstrapAttempt, initialFrame.cursor, legacyStateExporter, showDemo, storageClient]);

  useEffect(() => {
    if (!hydrated || storedInstruments.length === 0) return;
    localizedHydrationQueue.current?.enqueue(storedInstruments);
  }, [hydrated, storedInstruments]);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    const queue = localizedHydrationQueue.current;
    if (!queue) return () => controller.abort();
    void queue.run({
      repository: metadataRepository,
      fetcher: fetch,
      signal: controller.signal,
      reload: async () => (await storageClient.getBootstrap()).instruments,
      onProgress: setStoredInstruments,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [hydrated, metadataRepository, storageClient]);

  // Read the latest selection only when an inventory hydration completes. Saving a
  // cursor or switching episodes must never re-read every instrument's cache.
  const restoreHydratedEpisode = useEffectEvent((results: Array<{ instrumentId: string; state: InstrumentMarketState }>) => {
      if (!selectedImportedInstrument || !selectedEpisode || hydratedMarketIds.has(selectedImportedInstrument.instrument.id)) return;
      const selectedState = results.find(
        (result) =>
          result.instrumentId ===
          selectedImportedInstrument.instrument.id,
      )?.state;
      if (!selectedState) return;
      const stored = reviewStates[selectedEpisode.id];
      const availability = resolveEpisodeTimeframeAvailability(
        selectedState,
        selectedEpisode,
      );
      const nextTimeframe = stored?.timeframe ??
        (selectedState.intraday.length > 0 ? selectedState.intradayInterval : "1D");
      const availableTimeframe = availability[nextTimeframe].enabled
        ? nextTimeframe
        : availability["15m"].enabled
          ? "15m"
          : availability["1D"].enabled
            ? "1D"
            : nextTimeframe;
      setTimeframe(availableTimeframe);
      const source = sourceCandlesForTimeframe(selectedState, availableTimeframe);
      if (!stored) {
        setImportedCursor(
          replayCursorForEpisode(source, selectedEpisode.startedAt),
        );
      } else if (
        source.length > 0 &&
        replayHistoryStartsAfter(source, stored.replayCursor, selectedEpisode.startedAt)
      ) {
        setImportedCursor(
          replayCursorForEpisode(source, selectedEpisode.startedAt),
        );
      }
  });

  const selectedHydrationInstrument = useEffectEvent(() => selectedImportedInstrument?.instrument.id);

  useEffect(() => {
    if (!hydrated) return;
    if (rawImportedInstruments.length === 0) {
      marketHydrationKeys.current.clear();
      return;
    }
    let active = true;
    const repository = marketDataRepository;
    const currentHydrationKeys = new Map(
      rawImportedInstruments.map((summary) => [
        summary.instrument.id,
        `${summary.instrument.id}:${summary.tradeCount}:${summary.firstTradeAt}:${summary.lastTradeAt}`,
      ]),
    );
    const summariesToHydrate = rawImportedInstruments.filter((summary) => {
      const id = summary.instrument.id;
      const key = currentHydrationKeys.get(id);
      return (
        marketHydrationKeys.current.get(id) !== key &&
        marketHydrationInFlight.current.get(id)?.key !== key
      );
    });
    if (summariesToHydrate.length === 0) return;
    const runId = ++marketHydrationRunSequence.current;
    const ownedKeys = new Map(
      summariesToHydrate.map((summary) => {
        const id = summary.instrument.id;
        const key = currentHydrationKeys.get(id)!;
        marketHydrationInFlight.current.set(id, { key, runId });
        return [id, key] as const;
      }),
    );
    const hydrateMarketState = async (summary: InstrumentTradeSummary) => {
      const id = summary.instrument.id;
      const key = ownedKeys.get(id);
      let state: InstrumentMarketState;
      try {
        state = applyPersistedMarketDataJob(
          await readInstrumentMarketState(summary, repository),
          marketDataJobsRef.current[summary.instrument.id],
        );
      } catch {
        state = {
          ...emptyMarketState("storage-error"),
          intradayStatus: "storage-error" as const,
          dailyMessage: "无法读取本地日线缓存",
          intradayMessage: "无法读取本地 1 小时缓存",
        };
      }
      if (
        !active ||
        !key ||
        marketHydrationInFlight.current.get(id)?.runId !== runId
      ) {
        return;
      }
      // Only a successfully owned read may advance the durable hydration key.
      // Cleanup removes this ownership, so an interrupted read is retried by
      // the next inventory effect.
      marketHydrationKeys.current.set(id, key);
      marketHydrationInFlight.current.delete(id);
      setMarketStates((current) => ({
        ...current,
        [id]: state,
      }));
      restoreHydratedEpisode([{ instrumentId: id, state }]);
      setHydratedMarketIds(current => new Set([...current, id]));
    };
    const priorityInstrumentId = selectedHydrationInstrument();
    const selectedSummary = summariesToHydrate.find(summary => summary.instrument.id === priorityInstrumentId);
    const backgroundSummaries = summariesToHydrate.filter(summary => summary !== selectedSummary);
    void (async () => {
      if (selectedSummary) await hydrateMarketState(selectedSummary);
      if (active) await Promise.all(backgroundSummaries.map(hydrateMarketState));
    })();
    return () => {
      active = false;
      for (const [id, key] of ownedKeys) {
        const current = marketHydrationInFlight.current.get(id);
        if (current?.runId === runId && current.key === key) {
          marketHydrationInFlight.current.delete(id);
        }
      }
    };
  }, [
    hydrated,
    rawImportedInstrumentHydrationKey,
    marketDataRepository,
  ]);

  function setDrawingSaveError(episodeId: string, message: string) {
    drawingSaveErrorsRef.current[episodeId] = message;
    setDrawingSaveErrors((current) => ({ ...current, [episodeId]: message }));
  }

  function clearDrawingSaveError(episodeId: string) {
    delete drawingSaveErrorsRef.current[episodeId];
    setDrawingSaveErrors((current) => {
      if (!(episodeId in current)) return current;
      const next = { ...current };
      delete next[episodeId];
      return next;
    });
  }

  function enqueueDrawingState(state: EpisodeReviewState): Promise<void> {
    const episodeId = state.episodeId;
    drawingDraftsRef.current[episodeId] = state;
    const sequence = (drawingSaveSequencesRef.current[episodeId] ?? 0) + 1;
    drawingSaveSequencesRef.current[episodeId] = sequence;
    setDrawingSavePending((current) => ({ ...current, [episodeId]: true }));

    const previous = drawingSaveQueuesRef.current[episodeId] ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        if (drawingSaveSequencesRef.current[episodeId] !== sequence) return;
        await storageClient.putReviewState(state);
        if (drawingSaveSequencesRef.current[episodeId] !== sequence) return;
        setReviewStates((current) => ({ ...current, [episodeId]: state }));
        clearDrawingSaveError(episodeId);
      });
    drawingSaveQueuesRef.current[episodeId] = operation;
    void operation.then(
      () => {
        if (drawingSaveSequencesRef.current[episodeId] === sequence) {
          setDrawingSavePending((current) => ({ ...current, [episodeId]: false }));
        }
      },
      (error) => {
        if (drawingSaveSequencesRef.current[episodeId] === sequence) {
          setDrawingSavePending((current) => ({ ...current, [episodeId]: false }));
          setDrawingSaveError(
            episodeId,
            error instanceof Error && error.message
              ? `复盘状态未能保存到 SQLite：${error.message}`
              : "复盘状态未能保存到 SQLite，请点击“重试保存复盘状态”。",
          );
        }
      },
    );
    return operation;
  }

  function retryDrawingState(episodeId: string): Promise<void> {
    const draft = drawingDraftsRef.current[episodeId];
    return draft ? enqueueDrawingState(draft) : Promise.resolve();
  }

  async function flushLatestDrawingState(state: EpisodeReviewState) {
    let operation = enqueueDrawingState(state);
    let expectedSequence = drawingSaveSequencesRef.current[state.episodeId] ?? 0;
    for (;;) {
      await operation;
      const latestOperation = drawingSaveQueuesRef.current[state.episodeId];
      const latestSequence = drawingSaveSequencesRef.current[state.episodeId] ?? 0;
      if (latestSequence === expectedSequence && latestOperation === operation) {
        return;
      }
      if (latestOperation && latestOperation !== operation) {
        operation = latestOperation;
        expectedSequence = latestSequence;
        continue;
      }
      const candidate = drawingDraftsRef.current[state.episodeId] ?? state;
      operation = enqueueDrawingState(candidate);
      expectedSequence = drawingSaveSequencesRef.current[state.episodeId] ?? 0;
    }
  }

  useEffect(() => {
    if (
      !hydrated ||
      restoring ||
      !activeEpisodeId ||
      drawingEpisodeRef.current !== activeEpisodeId ||
      (!showDemo && !selectedRawImportedInstrument)
    ) return;
    const state: EpisodeReviewState = {
      version: 2,
      episodeId: activeEpisodeId,
      replayCursor: selectedImportedInstrument ? effectiveImportedCursor : activeCursor,
      timeframe,
      activePanelTab,
      drawings: drawingHistory.present,
    };
    void enqueueDrawingState(state);
  }, [
    activeCursor,
    effectiveImportedCursor,
    activeEpisodeId,
    activePanelTab,
    drawingHistory.present,
    hydrated,
    restoring,
    storageClient,
    timeframe,
    showDemo,
    selectedRawImportedInstrument,
  ]);

  useEffect(() => {
    if (activeView !== "review" || !activeEpisodeId) return;
    const draft = drawingDraftsRef.current[activeEpisodeId];
    if (!draft) return;
    setDrawingHistory((current) =>
      current.present === draft.drawings
        ? current
        : createDrawingHistory(draft.drawings),
    );
  }, [activeEpisodeId, activeView]);

  useEffect(() => {
    if (!playing) return;
    if (selectedImportedInstrument) {
      if (!importedCanGoForward) {
        const timeout = window.setTimeout(() => setPlaying(false), 0);
        return () => window.clearTimeout(timeout);
      }
      const timeout = window.setTimeout(() => {
        const next =
          importedTimelineCandles.find(
            (candle) => candleKnowledgeAt(candle) > activeCursor,
          )
            ? candleKnowledgeAt(
                importedTimelineCandles.find(
                  (candle) => candleKnowledgeAt(candle) > activeCursor,
                )!,
              )
            : activeCursor;
        setImportedCursor(next);
        if (
          !importedTimelineCandles.some(
            (candle) => candleKnowledgeAt(candle) > next,
          )
        ) {
          setPlaying(false);
        }
      }, speed);
      return () => window.clearTimeout(timeout);
    }
    if (!frame.canGoForward || stepping || restoring) return;
    const timeout = window.setTimeout(() => {
      const requestId = ++replayRequestSequence.current;
      setStepping(true);
      setReplayError(null);
      void fetchDemoFrame("next", frame.cursor)
        .then((nextFrame) => {
          if (requestId !== replayRequestSequence.current) return;
          setFrame(nextFrame);
          if (!nextFrame.canGoForward) setPlaying(false);
        })
        .catch(() => {
          if (requestId !== replayRequestSequence.current) return;
          setPlaying(false);
          setReplayError("回放数据暂时无法读取，请重试。");
        })
        .finally(() => {
          if (requestId === replayRequestSequence.current) {
            setStepping(false);
          }
        });
    }, speed);
    return () => window.clearTimeout(timeout);
  }, [
    frame.canGoForward,
    frame.cursor,
    importedCanGoForward,
    activeCursor,
    importedTimelineCandles,
    playing,
    restoring,
    selectedImportedInstrument,
    speed,
    stepping,
  ]);

  useEffect(
    () => () => {
      refreshCancellation.current.cancelAll();
      for (const controller of Object.values(
        marketDataAbortControllers.current,
      )) {
        controller.abort();
      }
    },
    [],
  );

  function refreshSavedGlobalMarketSummary() {
    const inventory: GlobalMarketRefreshInventoryItem[] =
      buildInstrumentTradeSummaries(currentExecutionSnapshot()).map(
        ({ instrument }) => ({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          market: instrument.market,
        }),
      );
    const summary = summarizePersistedMarketDataJobs(
      Object.values(marketDataJobsRef.current),
      inventory,
    );
    setFailedMarketDataIds((current) =>
      activeMarketRefreshRuns.current.has("all")
        ? current
        : summary.retryableInstrumentIds,
    );
    setMarketDataRefresh((current) => {
      // A single-stock completion may race an explicitly running global
      // batch. Its durable job is still useful for the next batch summary,
      // but it must never replace the batch progress in the header.
      if (
        current.running ||
        activeMarketRefreshRuns.current.has("all")
      ) {
        return current;
      }
      return {
        ...EMPTY_MARKET_DATA_REFRESH,
        total: summary.total,
        processed: summary.processed,
        completed: summary.completed,
        partial: summary.partial,
        failed: summary.failed,
        retryable: summary.retryable,
        failureDetails: summary.failureDetails,
        unfinishedInstrumentIds: summary.unfinishedInstrumentIds,
        unfinishedDetails: summary.unfinishedDetails,
        // The terminal counts are reconstructed from durable per-instrument
        // jobs. Keep the label explicit so it cannot be read as a new batch
        // total when this was a single-stock refresh or a retry subset.
        restored: true,
      };
    });
  }

  function cancelMarketDataUpdate() {
    const run = activeMarketRefreshRuns.current.get("all");
    if (!run) return;
    refreshCancellation.current.cancel("all");
    for (const instrumentId of run.snapshotIds) {
      marketDataAbortControllers.current[instrumentId]?.abort();
    }
  }

  async function startMarketDataUpdate(
    instrumentIds?: readonly string[],
    options: MarketDataUpdateOptions = {},
  ): Promise<boolean> {
    let started = false;
    await withGlobalMarketRefreshLock(
      async () => {
        started = true;
        await runMarketDataUpdate(instrumentIds, options);
      },
      () => setNavigationNotice(
        activeMarketRefreshRuns.current.size > 0
          ? "当前页面正在更新行情，请等待完成。"
          : "其他页面正在更新行情，请稍后再试。",
      ),
    );
    return started;
  }

  async function runMarketDataUpdate(
    instrumentIds?: readonly string[],
    options: MarketDataUpdateOptions = {},
  ) {
    // Snapshot both the inventory and its derived summaries before any
    // provider work starts. Imports completed during this run are reported and
    // picked up by the next explicit batch instead of changing the work set
    // underneath the queue.
    const snapshotExecutions = options.executions ?? currentExecutionSnapshot();
    const snapshotSummaries = buildInstrumentTradeSummaries(snapshotExecutions);
    const uniqueInstrumentIds = [
      ...new Set(
        instrumentIds ?? snapshotSummaries.map((summary) => summary.instrument.id),
      ),
    ];
    if (uniqueInstrumentIds.length === 0) return;
    // The full inventory is the baseline for "new imports" even when this
    // run is a retry subset. A retry should not report every untouched stock
    // as newly imported merely because it was outside its target set.
    const inventorySnapshotIds = new Set(
      snapshotSummaries.map((summary) => summary.instrument.id),
    );
    const key = options.batch
      ? "all"
      : `instrument:${[...uniqueInstrumentIds].sort().join(",")}`;
    const globalRun = activeMarketRefreshRuns.current.get("all");
    if (
      globalRun &&
      !options.batch &&
      uniqueInstrumentIds.some((id) => globalRun.snapshotIds.has(id))
    ) {
      return globalRun.promise;
    }
    const existingRun = activeMarketRefreshRuns.current.get(key);
    if (existingRun) return existingRun.promise;
    const cancellation = refreshCancellation.current.begin(key);
    if (cancellation.duplicate) {
      return activeMarketRefreshRuns.current.get(key)?.promise;
    }
    const snapshotIds = new Set(uniqueInstrumentIds);
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    activeMarketRefreshRuns.current.set(key, {
      key,
      controller: cancellation.controller,
      promise: completion,
      snapshotIds,
      batch: Boolean(options.batch),
    });
    try {
    const executions = snapshotExecutions;
    const summariesById = new Map(
      buildInstrumentTradeSummaries(executions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const marketDataFetcher = options.batch
      ? createMarketDataFetcher((input, init) =>
          fetch(input, { ...init, cache: "no-store" }),
        )
      : fetch;
    const refreshSnapshots = new Map<string, MarketDataRefreshSnapshot>();
    const cancelledRestoreWrites: Promise<void>[] = [];
    const cancelledRestoreStorageFailures = new Set<string>();

    if (options.batch) {
      setFailedMarketDataIds([]);
      setMarketDataRefresh({
        ...EMPTY_MARKET_DATA_REFRESH,
        running: true,
        total: uniqueInstrumentIds.length,
      });
    }

    const restoreCancelledSnapshot = (instrumentId: string) => {
      const snapshot = refreshSnapshots.get(instrumentId);
      if (
        !snapshot ||
        marketDataRequestSequences.current[instrumentId] !== snapshot.sequence
      ) {
        return;
      }
      const restoreStatus = (
        status: MarketDataSyncStatus,
        hasData: boolean,
      ): MarketDataSyncStatus =>
        status === "syncing"
          ? hasData
            ? "stale"
            : "not-requested"
          : status;
      const restored = {
        ...snapshot.state,
        dailyStatus: restoreStatus(
          snapshot.state.dailyStatus,
          Boolean(
            snapshot.state.daily.length || snapshot.state.dailyCoverage.length,
          ),
        ),
        intradayStatus: restoreStatus(
          snapshot.state.intradayStatus,
          Boolean(
            snapshot.state.intraday.length ||
              snapshot.state.intradayCoverage.length,
          ),
        ),
        dailyMessage:
          snapshot.state.dailyMessage ?? "行情更新已取消，保留原有日线缓存。",
        intradayMessage:
          snapshot.state.intradayMessage ?? "行情更新已取消，保留原有小时线缓存。",
      };
      setMarketStates((current) =>
        marketDataRequestSequences.current[instrumentId] === snapshot.sequence
          ? { ...current, [instrumentId]: restored }
          : current,
      );
      const summary = summariesById.get(instrumentId);
      if (!summary) return;
      const cancelledMessage = "本次行情更新已取消，原有本地缓存已保留；可再次恢复。";
      const previousJob = snapshot.job;
      // A cancelled recovery must remain recoverable. Preserve a terminal
      // saved job exactly; for a missing or unfinished job, record the new
      // attempt as not-requested so it remains outside failed/retry counts.
      const job: MarketDataJob = previousJob &&
        !isUnfinishedMarketDataJob(previousJob)
        ? previousJob
        : {
            instrumentId,
            symbol: summary.instrument.symbol,
            market: summary.instrument.market,
            requestedAt: new Date().toISOString(),
            status: "not-requested",
            message: cancelledMessage,
            intervals: (previousJob?.intervals.length
              ? previousJob.intervals
              : [
                  { interval: "1D" as const, status: "not-requested" as const },
                  { interval: "1h" as const, status: "not-requested" as const },
                ]
            ).map((interval) =>
              interval.status === "syncing" || interval.status === "not-requested"
                ? {
                    ...interval,
                    status: "not-requested" as const,
                    message: cancelledMessage,
                    error: undefined,
                  }
                : interval,
            ),
          };
      if (marketDataRequestSequences.current[instrumentId] !== snapshot.sequence) {
        return;
      }
      marketDataJobsRef.current[instrumentId] = job;
      setMarketDataJobs((current) => ({ ...current, [instrumentId]: job }));
      const persistRestore = async () => {
        if (marketDataRequestSequences.current[instrumentId] !== snapshot.sequence) {
          return;
        }
        try {
          await storageClient.putMarketDataJob(job);
        } catch {
          if (marketDataRequestSequences.current[instrumentId] !== snapshot.sequence) {
            return;
          }
          const message = "行情缓存已保留，但取消后的同步状态未能保存；请重试该标的。";
          cancelledRestoreStorageFailures.add(instrumentId);
          const failedJob: MarketDataJob = {
            ...job,
            status: "storage-error",
            message,
            intervals: job.intervals.map((interval) => ({
              ...interval,
              status: "storage-error",
              message,
            })),
          };
          marketDataJobsRef.current[instrumentId] = failedJob;
          setMarketDataJobs((current) => ({
            ...current,
            [instrumentId]: failedJob,
          }));
          setMarketStates((current) => {
            const state = current[instrumentId];
            if (!state) return current;
            return {
              ...current,
              [instrumentId]: {
                ...state,
                dailyStatus: "storage-error",
                intradayStatus: "storage-error",
                dailyMessage: message,
                intradayMessage: message,
              },
            };
          });
          setImportError(message);
        }
      };
      cancelledRestoreWrites.push(persistRestore());
    };

    const results = await runRefreshQueue<string, MarketDataRefreshOutcome>(
      uniqueInstrumentIds,
      async (instrumentId) => {
        const summary = summariesById.get(instrumentId);
        if (!summary) {
          throw new Error(`找不到待更新的标的：${instrumentId}`);
        }
        if (options.batch) {
          setMarketDataRefresh((current) => ({
            ...current,
            current: summary.instrument.name,
          }));
        }
        const requestSequence =
          (marketDataRequestSequences.current[instrumentId] ?? 0) + 1;
        marketDataRequestSequences.current[instrumentId] = requestSequence;
        marketDataAbortControllers.current[instrumentId]?.abort();
        const abortController = new AbortController();
        marketDataAbortControllers.current[instrumentId] = abortController;
        if (options.batch) {
          refreshSnapshots.set(instrumentId, {
            state: marketStates[instrumentId] ?? emptyMarketState(),
            sequence: requestSequence,
            job: marketDataJobsRef.current[instrumentId],
          });
        }
        const requestSignal = composeAbortSignals(
          cancellation.signal,
          abortController.signal,
        );
        const repository = marketDataRepository;
        let cached = marketStates[instrumentId] ?? emptyMarketState();
        try {
          cached = await readInstrumentMarketState(summary, repository);
        } catch {
          cached = {
            ...cached,
            dailyStatus: "storage-error",
            intradayStatus: "storage-error",
            dailyMessage: "无法读取本地日线缓存",
            intradayMessage: "无法读取本地 1 小时缓存",
          };
        }
        if (
          cancellation.signal.aborted ||
          marketDataRequestSequences.current[instrumentId] !==
          requestSequence
        ) {
          if (cancellation.signal.aborted) {
            throw cancellation.signal.reason ?? new DOMException("行情更新已取消", "AbortError");
          }
          throw new DOMException("行情更新已被较新的请求取代", "AbortError");
        }
        setMarketStates((current) => ({
          ...current,
          [instrumentId]: {
            ...cached,
            dailyStatus: "syncing",
            intradayStatus: "syncing",
            dailyMessage: undefined,
            intradayMessage: undefined,
            dailyError: undefined,
            intradayError: undefined,
          },
        }));

        const { instrument } = summary;
        const market = supportedMarket(instrument.market);
        const historicalIdentity = resolveHistoricalInstrumentIdentity({
          market: instrument.market,
          symbol: instrument.symbol,
          name: instrument.name,
          executedAt: summary.executions.map(
            (execution) => execution.executedAt,
          ),
        });
        const marketDataSymbol =
          historicalIdentity?.marketDataSymbol ?? instrument.symbol;
        const ranges = marketRanges(summary);
        const summaryEpisodes = sortedEpisodes(summary);
        const intradayRanges = market
          ? buildIntradaySyncRanges(summaryEpisodes, market)
          : [];
        const requestedAt = new Date().toISOString();
        try {
          await storageClient.putMarketDataJob({
            instrumentId,
            symbol: instrument.symbol,
            market: instrument.market,
            requestedAt,
            status: "syncing",
            intervals: [
              { interval: "1D", status: "syncing" },
              { interval: "1h", status: "syncing" },
            ],
          });
        } catch {
          cached = {
            ...cached,
            dailyStatus: "storage-error",
            dailyMessage: "无法记录本地行情更新状态",
          };
        }
        let metadataPersistenceFailed = false;
        const persistInstrumentName = async (name: string) => {
          if (
            marketDataRequestSequences.current[instrumentId] !==
            requestSequence
          ) {
            return;
          }
          const current = currentExecutionSnapshot();
          const renamed = current.map((execution) =>
            canonicalInstrumentId(
              execution.instrument.symbol,
              execution.instrument.market,
            ) === instrumentId
              ? {
                  ...execution,
                  instrument: {
                    ...execution.instrument,
                    name,
                  },
                }
              : execution,
          );
          try {
            await storageClient.mergeExecutions({
              instruments: [{
                id: instrumentId,
                market: instrument.market,
                symbol: instrument.symbol,
                name,
                currency: instrument.currency,
              }],
              executions: renamed,
            });
          } catch {
            metadataPersistenceFailed = true;
            setImportError(
              "已查询到证券新名称，但新名称未能保存；交易库仍保留原名称。",
            );
            return;
          }
          importedExecutionsRef.current = renamed;
          setImportedExecutions(renamed);
          setStoredInstruments((current) => {
            const index = current.findIndex((item) => item.id === instrumentId);
            const base = index >= 0 ? current[index] : instrument;
            const next = { ...base, name };
            if (index < 0) return [...current, next];
            return current.map((item, itemIndex) => itemIndex === index ? next : item);
          });
        };
        const metadataRefresh = historicalIdentity
          ? persistInstrumentName(historicalIdentity.displayName)
            : options.refreshMetadata && market
            ? (() => {
                const existingRefresh = metadataRefreshes.current[instrumentId];
                const refresh = existingRefresh ?? refreshInstrumentMetadata(
                  {
                    market,
                    symbol: instrument.symbol,
                  },
                  {
                    repository: metadataRepository,
                    fetcher: fetch,
                    signal: requestSignal,
                  },
                ).catch(() => undefined);
                if (!existingRefresh) {
                  metadataRefreshes.current[instrumentId] = refresh;
                  void refresh.finally(() => {
                    if (metadataRefreshes.current[instrumentId] === refresh) {
                      delete metadataRefreshes.current[instrumentId];
                    }
                  });
                }
                return refresh.then((metadata) => {
                  if (!metadata) return undefined;
                  if (metadata.localizedName) {
                    setStoredInstruments((current) => {
                      const existing = current.findIndex((item) => item.id === instrumentId);
                      const base = existing >= 0 ? current[existing] : instrument;
                      const projected = localizedInstrumentOverlay(base, metadata);
                      if (existing < 0) return [...current, projected];
                      return current.map((item, index) => index === existing ? projected : item);
                    });
                    // A localized response is an additive display overlay;
                    // do not rewrite any execution's original name.
                    return undefined;
                  }
                  // Preserve the pre-existing canonical-name refresh behavior
                  // for providers that have not supplied a localized overlay.
                  return persistInstrumentName(metadata.name);
                });
              })()
            : Promise.resolve();
        let next = { ...cached };
        if (!market) {
          next = {
            ...next,
            dailyStatus: "source-unavailable",
            intradayStatus: "source-unavailable",
            dailyMessage: `暂不支持 ${instrument.market} 市场日线行情`,
            intradayMessage: `暂不支持 ${instrument.market} 市场 1 小时行情`,
            dailyError: {
              code: "source-unavailable",
              message: `暂不支持 ${instrument.market} 市场日线行情`,
            },
            intradayError: {
              code: "source-unavailable",
              message: `暂不支持 ${instrument.market} 市场 1 小时行情`,
            },
          };
        } else {
          const refreshed = await refreshMarketData({
            instrumentId,
            symbol: marketDataSymbol,
            market,
            currency: instrument.currency,
            dailyRange: ranges.daily,
            hourlyRanges: intradayRanges.length ? intradayRanges : [ranges.intraday],
            repository,
            fetcher: marketDataFetcher,
            signal: requestSignal,
            retryUnavailable: true,
            forceRefresh: Boolean(options.refreshMetadata || options.batch),
            previous: {
              daily: next.daily,
              dailyCoverage: next.dailyCoverage,
              intraday: next.intraday,
              intradayCoverage: next.intradayCoverage,
              intradayInterval: next.intradayInterval,
            },
          });
          next.daily = refreshed.daily.candles;
          next.dailyCoverage = refreshed.daily.coverage;
          next.dailyStatus = refreshed.daily.status;
          next.dailyError = refreshed.daily.refreshErrorSource === "coverage-read"
            ? refreshed.daily.refreshError ?? refreshed.daily.error
            : refreshed.daily.error ?? refreshed.daily.refreshError;
          next.dailyMessage = refreshed.daily.error
            ? refreshed.daily.refreshErrorSource === "coverage-read"
              ? `日线已获取但覆盖状态读取失败；${refreshed.daily.error.message}`
              : `日线：${refreshed.daily.error.message}`
            : refreshed.daily.refreshErrorSource === "coverage-read"
              ? "日线已获取但覆盖状态读取失败"
              : refreshed.daily.refreshError
                ? `日线：${refreshed.daily.refreshError.message}`
              : refreshed.daily.status === "latest-available"
                ? "尾部仍待补齐，已保留本地行情；可再次更新重试"
                : refreshed.daily.status === "partial"
                  ? "日线更新已完成，仍有缺口"
                  : refreshed.daily.source === "cache"
                    ? "日线已使用本地缓存"
                    : `日线已补齐 ${refreshed.daily.requestedRanges.length} 个缺口`;
          next.intradayInterval = refreshed.hourly.interval;
          next.intraday = refreshed.hourly.candles;
          next.intradayCoverage = refreshed.hourly.coverage;
          next.intradayStatus = refreshed.hourly.status;
          next.intradayError = refreshed.hourly.error ?? refreshed.hourly.refreshError;
          next.intradayMessage = refreshed.hourly.error
            ? `1 小时：${refreshed.hourly.error.message}`
            : refreshed.hourly.refreshError
              ? `1 小时：${refreshed.hourly.refreshError.message}`
              : refreshed.hourly.source === "cache"
              ? "1 小时行情已使用本地缓存"
              : `1 小时行情已请求 ${refreshed.hourly.requestedRanges.length} 个区间`;
        }
        await metadataRefresh;
        if (cancellation.signal.aborted) {
          throw cancellation.signal.reason ?? new DOMException("行情更新已取消", "AbortError");
        }
        if (metadataPersistenceFailed) {
          next.dailyStatus = "storage-error";
          next.dailyMessage =
            "证券新名称未能保存，交易库仍保留原名称。";
        }
        if (
          marketDataRequestSequences.current[instrumentId] !==
          requestSequence
        ) {
          throw new DOMException("行情更新已被较新的请求取代", "AbortError");
        }
        let overallStatus = displayMarketDataStatus(
          next.dailyStatus,
          next.intradayStatus,
          {
            hasDailyData: Boolean(next.daily.length),
            hasIntradayData: Boolean(
              next.intraday.length,
            ),
          },
        );
        const completedJob: MarketDataJob = {
          instrumentId,
          symbol: instrument.symbol,
          market: instrument.market,
          requestedAt,
          status: overallStatus,
          ...(next.dailyError ?? next.intradayError
            ? { error: next.dailyError ?? next.intradayError }
            : {}),
          message: [next.dailyMessage, next.intradayMessage]
            .filter(Boolean)
            .join("；"),
          intervals: [
            {
              interval: "1D",
              status: next.dailyStatus,
              message: next.dailyMessage,
              coverageStart: ranges.daily.startDate,
              coverageEnd: ranges.daily.endDate,
              ...(next.dailyError ? { error: next.dailyError } : {}),
            },
            {
              interval: "1h",
              status: next.intradayStatus,
              message: next.intradayMessage,
              coverageStart:
                intradayRanges[0]?.startTime ?? ranges.intraday.startTime,
              coverageEnd:
                intradayRanges.at(-1)?.endTime ?? ranges.intraday.endTime,
              ...(next.intradayError ? { error: next.intradayError } : {}),
            },
          ],
        };
        let persistedTerminalJob = false;
        try {
          await storageClient.putMarketDataJob(completedJob);
          marketDataJobsRef.current[instrumentId] = completedJob;
          persistedTerminalJob = true;
          setMarketDataJobs((current) => ({
            ...current,
            [instrumentId]: completedJob,
          }));
        } catch {
          next.dailyStatus = "storage-error";
          overallStatus = displayMarketDataStatus(
            next.dailyStatus,
            next.intradayStatus,
            {
              hasDailyData: Boolean(next.daily.length),
              hasIntradayData: Boolean(
                next.intraday.length,
              ),
            },
          );
          next.dailyMessage = "行情缓存保留，但同步状态写入失败";
        }
        setMarketStates((current) => ({
          ...current,
          [instrumentId]: next,
        }));
        if (persistedTerminalJob && !options.batch) {
          refreshSavedGlobalMarketSummary();
        }
        if (
          marketDataAbortControllers.current[instrumentId] ===
          abortController
        ) {
          delete marketDataAbortControllers.current[instrumentId];
        }
        return {
          status: overallStatus,
          retryable:
            Boolean(next.dailyError || next.intradayError) ||
            isHardMarketDataFailure(overallStatus),
        } satisfies MarketDataRefreshOutcome;
      },
      {
        concurrency: Math.min(
          options.batch ? 3 : 2,
          uniqueInstrumentIds.length,
        ),
        onItemStarted: options.batch
          ? ({ item, active }) => {
              const summary = summariesById.get(item);
              setMarketDataRefresh((current) => ({
                ...current,
                active,
                current: summary?.instrument.name ?? item,
              }));
            }
          : undefined,
              onItemSettled: options.batch
          ? ({ completed, active, result }) => {
              const outcome =
                result.status === "fulfilled" ? result.value : undefined;
              const status = outcome?.status;
              const retryable = Boolean(
                outcome?.retryable ||
                (status && isHardMarketDataFailure(status)) ||
                result.status === "rejected",
              );
              const category = result.status === "fulfilled"
                ? classifyMarketDataRefreshStatus(status)
                : result.status === "rejected"
                  ? "failed" as const
                  : undefined;
              setMarketDataRefresh((current) => ({
                ...current,
                // `processed` is the queue's settled count. The result
                // counters below are mutually exclusive; retryable is an
                // independent action count and may overlap partial results.
                processed: completed,
                completed:
                  current.completed +
                  (category === "complete" ? 1 : 0),
                active,
                partial:
                  current.partial + (category === "partial" ? 1 : 0),
                failed:
                  current.failed +
                  (category === "failed" ? 1 : 0),
                retryable:
                  (current.retryable ?? current.failed) +
                  (retryable ? 1 : 0),
                cancelled:
                  (current.cancelled ?? 0) +
                  (result.status === "cancelled" ? 1 : 0),
              }));
              if (result.status === "cancelled") {
                restoreCancelledSnapshot(result.item);
              }
              refreshSnapshots.delete(result.item);
            }
          : undefined,
        signal: options.batch ? cancellation.signal : undefined,
      },
    );

    // A cancelled worker first restores the in-memory state and then queues a
    // terminal job write. Wait for every such write before exposing the batch
    // as idle, otherwise a subsequent refresh can be overwritten by the old
    // fire-and-forget cancellation write.
    if (cancelledRestoreWrites.length > 0) {
      await Promise.allSettled(cancelledRestoreWrites);
    }

    if (options.batch) {
      const failedIds = [
        ...new Set([
          ...failedRefreshItems(
            results,
            (outcome: MarketDataRefreshOutcome) =>
              outcome.retryable || isHardMarketDataFailure(outcome.status),
          ),
          ...cancelledRestoreStorageFailures,
        ]),
      ];
      const cancelled = results.filter((result) => result.status === "cancelled").length;
      const currentIds = new Set(
        buildInstrumentTradeSummaries(currentExecutionSnapshot()).map(
          (summary) => summary.instrument.id,
        ),
      );
      const newlyImported = [...currentIds].filter(
        (id) => !inventorySnapshotIds.has(id),
      ).length;
      const persistedRefreshSummary = summarizePersistedMarketDataJobs(
        uniqueInstrumentIds
          .map((id) => marketDataJobsRef.current[id])
          .filter((job): job is MarketDataJob => Boolean(job)),
        uniqueInstrumentIds,
      );
      const persistedFailureDetails = new Map(
        persistedRefreshSummary.failureDetails.map((detail) => [
          detail.instrumentId,
          detail,
        ]),
      );
      const failureDetails: GlobalMarketRefreshFailureDetail[] = [];
      for (const result of results) {
        if (result.status === "cancelled") {
          const detail = persistedFailureDetails.get(result.item);
          if (detail) failureDetails.push(detail);
          continue;
        }
        const outcome = result.status === "fulfilled" ? result.value : undefined;
        const isRetryable = Boolean(
          outcome?.retryable ||
          (outcome?.status && isHardMarketDataFailure(outcome.status)) ||
          result.status === "rejected",
        );
        if (!isRetryable && !cancelledRestoreStorageFailures.has(result.item)) {
          continue;
        }
        const persisted = persistedFailureDetails.get(result.item);
        if (persisted) {
          failureDetails.push(persisted);
          continue;
        }
        const summary = summariesById.get(result.item);
        if (!summary) continue;
        const reason = result.status === "rejected"
          ? result.reason instanceof Error
            ? result.reason.message
            : "行情更新失败"
          : outcome?.status
            ? `行情更新状态：${outcome.status}`
            : "该标的行情更新未完成";
        failureDetails.push(
          failureDetailForReason({
            instrumentId: result.item,
            symbol: summary.instrument.symbol,
            market: summary.instrument.market,
            reason,
            status: result.status === "fulfilled" ? outcome?.status : "error",
          }),
        );
      }
      const finalInventory: GlobalMarketRefreshInventoryItem[] =
        buildInstrumentTradeSummaries(currentExecutionSnapshot()).map(
          ({ instrument }) => ({
            instrumentId: instrument.id,
            symbol: instrument.symbol,
            market: instrument.market,
          }),
        );
      const finalSummary = summarizePersistedMarketDataJobs(
        Object.values(marketDataJobsRef.current),
        finalInventory,
      );
      const finalFailureDetails = new Map(
        finalSummary.failureDetails.map((detail) => [
          detail.instrumentId,
          detail,
        ]),
      );
      for (const detail of failureDetails) {
        if (!finalFailureDetails.has(detail.instrumentId)) {
          finalFailureDetails.set(detail.instrumentId, detail);
        }
      }
      const finalRetryableIds = [
        ...new Set([
          ...finalSummary.retryableInstrumentIds,
          ...failedIds,
        ]),
      ];
      setFailedMarketDataIds(finalRetryableIds);
      setMarketDataRefresh((current) => ({
        ...current,
        running: false,
        current: undefined,
        active: 0,
        cancelled,
        newlyImported,
        total: finalSummary.total || current.total,
        processed: finalSummary.total > 0 ? finalSummary.processed : current.processed,
        completed: finalSummary.total > 0 ? finalSummary.completed : current.completed,
        partial: finalSummary.total > 0 ? finalSummary.partial : current.partial,
        failed: finalSummary.total > 0
          ? finalSummary.failed
          : current.failed + cancelledRestoreStorageFailures.size,
        retryable: finalSummary.total > 0
          ? finalRetryableIds.length
          : (current.retryable ?? current.failed) + cancelledRestoreStorageFailures.size,
        unfinishedInstrumentIds: finalSummary.unfinishedInstrumentIds,
        unfinishedDetails: finalSummary.unfinishedDetails,
        failureDetails: [...finalFailureDetails.values()],
        // This is the saved per-instrument inventory after the queue settles;
        // it is not a claim that every row belonged to this run.
        restored: true,
      }));
    }
    } finally {
      refreshCancellation.current.finish(key, cancellation.controller);
      activeMarketRefreshRuns.current.delete(key);
      resolveCompletion();
    }
  }

  async function recoverUnfinishedMarketData() {
    if (activeMarketRefreshRuns.current.size > 0) {
      setNavigationNotice("当前页面正在更新行情，请等待完成。");
      return;
    }

    await withGlobalMarketRefreshLock(
      async () => {
        if (activeMarketRefreshRuns.current.size > 0) {
          setNavigationNotice("当前页面正在更新行情，请等待完成。");
          return;
        }
        let bootstrap;
        try {
          bootstrap = await storageClient.getBootstrap();
        } catch {
          setNavigationNotice("无法读取已保存的行情状态，请稍后再试。");
          return;
        }
        const inventory: GlobalMarketRefreshInventoryItem[] =
          buildInstrumentTradeSummaries(currentExecutionSnapshot()).map(
            ({ instrument }) => ({
              instrumentId: instrument.id,
              symbol: instrument.symbol,
              market: instrument.market,
            }),
          );
        const jobs = Object.fromEntries(
          bootstrap.marketDataJobs.map((job) => [job.instrumentId, job]),
        );
        const summary = summarizePersistedMarketDataJobs(
          bootstrap.marketDataJobs,
          inventory,
        );
        marketDataJobsRef.current = jobs;
        setMarketDataJobs(jobs);
        setFailedMarketDataIds(summary.retryableInstrumentIds);
        if (summary.unfinishedInstrumentIds.length === 0) {
          setMarketDataRefresh((current) =>
            current.running
              ? current
              : {
                  ...EMPTY_MARKET_DATA_REFRESH,
                  total: summary.total,
                  processed: summary.processed,
                  completed: summary.completed,
                  partial: summary.partial,
                  failed: summary.failed,
                  retryable: summary.retryable,
                  failureDetails: summary.failureDetails,
                  unfinishedInstrumentIds: summary.unfinishedInstrumentIds,
                  unfinishedDetails: summary.unfinishedDetails,
                  restored: true,
                },
          );
          setNavigationNotice("没有仍未完成的行情任务，已刷新已保存状态。");
          return;
        }
        setNavigationNotice(null);
        await runMarketDataUpdate(summary.unfinishedInstrumentIds, {
          refreshMetadata: true,
          batch: true,
        });
      },
      () => setNavigationNotice(
        activeMarketRefreshRuns.current.size > 0
          ? "当前页面正在更新行情，请等待完成。"
          : "其他页面正在更新行情，请稍后再试。",
      ),
    );
  }

  function previewForImport(
    fileName: string,
    enriched: EnrichedImportResult,
    screenshotMetadata?: {
      captureCount: number;
      duplicateTradeCount: number;
      conflictTradeCount: number;
    },
    options?: { allowIncompleteMonthlyReimport?: boolean },
  ) {
    const basePreview = createImportPreview(
      fileName,
      enriched,
      screenshotMetadata
        ? {
            sourceKind: "screenshot",
            captureCount: screenshotMetadata.captureCount,
            duplicateTradeCount: screenshotMetadata.duplicateTradeCount,
            conflictTradeCount: screenshotMetadata.conflictTradeCount,
          }
        : undefined,
    );
    if (screenshotMetadata) return basePreview;
    const incompleteReplacement = Boolean(
      enriched.monthly &&
        !options?.allowIncompleteMonthlyReimport &&
        (enriched.unresolved.length > 0 ||
          enriched.exclusions.some(
            (exclusion) => exclusion.category === "invalid-row",
          )) &&
        currentExecutionSnapshot().some((execution) =>
          belongsToMonthlyDocument(execution, enriched.monthly!),
        ),
    );
    const current = currentExecutionSnapshot().filter(
      (execution) =>
        !enriched.monthly ||
        !belongsToMonthlyDocument(execution, enriched.monthly),
    );
    const merged = mergeExecutions(current, enriched.importable);
    const retainedIncomingCount = Math.max(
      0,
      merged.length - current.length,
    );
    const libraryDuplicateCount = Math.max(
      0,
      enriched.importable.length - retainedIncomingCount,
    );
    return {
      ...basePreview,
      ...(incompleteReplacement ? { blocked: true, blockingReason: "同一月结单仍有证券分类未完成，暂不替换已存成交。请重试分类或取消；旧记录保持不变。" } : {}),
      duplicateTradeCount:
        basePreview.duplicateTradeCount + libraryDuplicateCount,
    };
  }

  async function prepareScreenshotImport(
    prepared: PreparedScreenshotImport,
  ) {
    const requestId = ++importRequestSequence.current;
    const originalExecutions = currentExecutionSnapshot();
    if (supplementScopeRef.current) setSupplementExcluded(screenshotExcludedRef.current);
    const { incomingToMerge } =
      applyReconciliationDecisions(
        originalExecutions,
        prepared.reconciliation,
        prepared.decisions,
      );
    const incomingInstrumentIds = new Set(
      incomingToMerge.map(({ instrument }) => instrument.id),
    );
    const parsed: StatementParseResult = {
      ...prepared.parsed,
      records: incomingToMerge,
      candidates: prepared.parsed.candidates.filter((candidate) =>
        incomingInstrumentIds.has(
          canonicalInstrumentId(candidate.symbol, candidate.market),
        ),
      ),
    };
    const conflictTradeCount = prepared.reconciliation.conflicts.reduce(
      (total, conflict) => total + conflict.incoming.length,
      0,
    );
    setImporting(true);
    setImportPhase("classifying");
    setImportError(null);
    setPendingImport(null);
    setPendingParsedImport(parsed);
    setPendingEnrichedImport(null);
    setPendingImportOriginalExecutions(originalExecutions);
    setPendingImportMergeBase(null);
    setPendingScreenshotDecisions(prepared.decisions);
    try {
      await Promise.resolve();
      setImportPhase("resolving");
      const rawEnriched = await enrichStatementImport(parsed, {
        repository: metadataRepository,
      });
      if (requestId !== importRequestSequence.current) return;
      const survivorReconciliation = reconcileExecutions(
        originalExecutions,
        rawEnriched.importable,
      );
      const { currentAfterReplacements, incomingToMerge: survivors } =
        applyReconciliationDecisions(
          originalExecutions,
          survivorReconciliation,
          prepared.decisions,
        );
      const enriched = { ...rawEnriched, importable: survivors };
      const preview = previewForImport(prepared.fileName, enriched, {
        captureCount: prepared.captureCount,
        duplicateTradeCount: prepared.reconciliation.duplicates.length,
        conflictTradeCount,
      });
      setPendingEnrichedImport(enriched);
      setPendingImportMergeBase(currentAfterReplacements);
      setPendingImport(preview);
      setImportPhase("ready");
    } catch (error) {
      if (requestId !== importRequestSequence.current) return;
      setImportError(
        error instanceof Error
          ? error.message
          : "截图成交补全失败，请检查后重试。",
      );
      setImportPhase("idle");
      setPendingImportOriginalExecutions(null);
      setPendingImportMergeBase(null);
      setPendingScreenshotDecisions(null);
      throw error;
    } finally {
      if (requestId === importRequestSequence.current) {
        setImporting(false);
      }
    }
  }

  function openDataCheck(instrumentId: string, accountId: string) {
    const instrument = importedInstruments.find(item => item.instrument.id === instrumentId)?.instrument ?? storedInstruments.find(item=>item.id===instrumentId);
    if (!instrument) return;
    setPlaying(false); setDrawerOpen(false); setStockDrawerOpen(false);
    setDataTarget({ instrument, accountId, ...(activeView === "review" ? { cursor: activeCursor } : {}) });
  }
  function openQualityDetails(model: TradingRoomQualityModel) {
    setQualityModel(model);
    setPlaying(false);
    setDataTab("quality");
    setActiveView("data");
  }
  async function retryDataQuality(
    dimension: TradingRoomQualityDimensionId,
    instrumentIds: readonly string[],
  ): Promise<void> {
    if (dimension === "fx") {
      await fxRates.refresh();
      return;
    }
    if (dimension !== "historical" && dimension !== "holdings") {
      throw new Error("该数据质量项没有可执行的重试动作");
    }
    if (instrumentIds.length === 0) {
      throw new Error("没有可重试的行情标的");
    }
    const ids = [...new Set(instrumentIds)].filter(id =>
      importedInstruments.some(item => item.instrument.id === id),
    );
    if (ids.length === 0) {
      throw new Error("可重试标的不在当前导入范围内");
    }
    await retryMarketData({
      dimension,
      instrumentIds: ids,
      start: () => startMarketDataUpdate(ids, {
        refreshMetadata: true,
        batch: false,
      }),
      jobFor: id => marketDataJobsRef.current[id],
    });
  }
  function openQualityDataCheck(
    _dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) {
    const instrumentId = ids.find(id =>
      importedInstruments.some(item => item.instrument.id === id) ||
      storedInstruments.some(item => item.id === id),
    );
    setDataTab("quality");
    setActiveView("data");
    if (instrumentId) {
      const episodeAccountId = episodeId
        ? tradeLibraryEntries
            .find(entry => entry.instrument.id === instrumentId)
            ?.episodes.find(item => item.episode.id === episodeId)
            ?.episode.accountId
        : undefined;
      openDataCheck(
        instrumentId,
        accountIdForQualityCheck(instrumentId, importedExecutions, episodeAccountId),
      );
    }
  }
  function applyCorrectedExecutions(executions: TradeExecution[]) {
    importedExecutionsRef.current = executions;
    setImportedExecutions(executions);
    if (selectedEpisodeId && !buildTradeEpisodes(executions).some(episode => episode.id === selectedEpisodeId)) {
      setNavigationNotice("成交已修订，原回合身份发生变化。请重新选择回合；原笔记和绘图已保留，可在数据检查中核对。");
    }
  }
  async function reviseCurrentTrades(input: TradeRevisionRequest) {
    const result = await tradeRepairClient.revise(input);
    applyCorrectedExecutions(result.executions);
  }

  async function prepareStatementPreview(file: File, parsed: StatementParseResult, requestId: number) {
    setMonthlyConflictDecisions(new Map());
    setPendingParsedImport(parsed);
    setImportPhase("resolving");
    const rawEnriched = await enrichStatementImport(parsed, { repository: metadataRepository });
    if (requestId !== importRequestSequence.current) return;
    if (parsed.monthly) {
      const current = currentExecutionSnapshot();
      const reimport = assessMonthlyReimport(
        current,
        parsed.records,
        rawEnriched,
        parsed.monthly,
      );
      setPendingImportOriginalExecutions(current);
      setPendingImportMergeBase(
        reimport.idempotent
          ? current
          : current.filter((e) => !belongsToMonthlyDocument(e, parsed.monthly!)),
      );
      setPendingEnrichedImport(reimport.enriched);
      setPendingImport(
        previewForImport(file.name, reimport.enriched, undefined, {
          allowIncompleteMonthlyReimport: reimport.idempotent,
        }),
      );
      setImportPhase("ready");
      return;
    }
    setPendingImportMergeBase(null);
    setPendingEnrichedImport(rawEnriched);
    setPendingImport(previewForImport(file.name, rawEnriched));
    setImportPhase("ready");
  }

  async function continueMonthlyReview() {
    if (!monthlyReview || monthlyReview.parsed.blocked) return;
    const requestId = ++importRequestSequence.current;
    setImporting(true);
    try {
      await prepareStatementPreview(monthlyReview.file, monthlyReview.parsed, requestId);
      if (requestId === importRequestSequence.current) setMonthlyReview(null);
    } catch (error) {
      if (requestId === importRequestSequence.current) {
        setImportError(error instanceof Error ? error.message : "月结单分类失败，请重试");
        setImportPhase("idle");
      }
    } finally { if (requestId === importRequestSequence.current) setImporting(false); }
  }

  function startStatementBatch(files: File[]) {
    const [first, ...rest] = [...files].sort((a, b) => a.name.localeCompare(b.name));
    importFileQueue.current = rest;
    if (first) void parseImport(first);
  }

  async function parseImport(file: File, timeOptions: StatementTimeOptions = {}, tradingViewContext?: TradingViewSimulationContext) {
    setPendingTradingViewFile(null);
    screenshotImport.cancel();
    const requestId = ++importRequestSequence.current;
    setImporting(true);
    setImportPhase("detecting");
    setImportError(null);
    setPendingImport(null);
    setPendingParsedImport(null);
    setPendingEnrichedImport(null);
    setPendingImportOriginalExecutions(null);
    setPendingImportMergeBase(null);
    setPendingScreenshotDecisions(null);
    setMonthlyReview(null);
    try {
      await Promise.resolve();
      setImportPhase("parsing");
      const parsed = tradingViewContext
        ? await parseBrokerStatement(file, { ...timeOptions, tradingViewContext })
        : Object.keys(timeOptions).length > 0
          ? await parseBrokerStatement(file, timeOptions)
          : await parseBrokerStatement(file);
      const scope = supplementScopeRef.current;
      if (scope) {
        const filtered = scopedRecords(parsed.records, scope);
        setSupplementExcluded(parsed.records.length - filtered.length);
        parsed.records = filtered;
        parsed.candidates = parsed.candidates.filter(candidate => canonicalInstrumentId(candidate.symbol, candidate.market) === scope.instrumentId);
        setPendingImportOriginalExecutions(currentExecutionSnapshot());
        if (!filtered.length) throw new Error("文件中没有当前股票和账户的成交，范围外记录已排除。");
        if (reconcileExecutions(currentExecutionSnapshot(), filtered).conflicts.length) throw new Error("当前账户存在冲突成交，请先在数据检查中核对修订，再补充导入。未覆盖原记录。");
      }
      if (requestId !== importRequestSequence.current) return;
      if (parsed.broker !== "unknown" && parsed.monthly) {
        setMonthlyReview({ file, parsed });
        setImportPhase("ready");
        return;
      }
      if (parsed.broker === "unknown" || parsed.blocked) {
        const missingTradingViewContext = parsed.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "tradingview-missing-instrument-context",
        );
        if (missingTradingViewContext && !tradingViewContext) {
          setPendingTradingViewFile(file);
          setImporting(false);
          setImportPhase("idle");
          return;
        }
        const message = parsed.diagnostics.find(
          (diagnostic) => diagnostic.severity === "error",
        )?.message;
        throw new Error(message ?? "暂时无法识别这个交易记录");
      }
      if (parsed.broker === "tradingview") {
        const incoming = parsed.records[0];
        const contextConflict = currentExecutionSnapshot().some(
          (existing) =>
            existing.source.platform === "tradingview" &&
            existing.source.fileFingerprint === incoming.source.fileFingerprint &&
            existing.instrument.id !== incoming.instrument.id,
        );
        if (contextConflict) {
          throw new Error("同一 CSV 已关联到另一证券，已停止导入。请核对原导入记录与本次证券代码。");
        }
      }
      setImportPhase("classifying");
      await Promise.resolve();
      await prepareStatementPreview(file, parsed, requestId);
    } catch (error) {
      if (requestId !== importRequestSequence.current) return;
      setImportError(
        error instanceof Error
          ? error.message
          : "暂时无法识别这个文件。请确认它来自富途、Tiger 或 A股招商银行格式。",
      );
      setImportPhase("idle");
    } finally {
      if (requestId === importRequestSequence.current) {
        setImporting(false);
      }
    }
  }

  async function retryUnresolved(instrumentIds: string[]) {
    if (
      instrumentIds.length === 0 ||
      !pendingParsedImport ||
      !pendingEnrichedImport ||
      !pendingImport
    ) {
      return;
    }
    const requestId = ++importRequestSequence.current;
    setRetryingUnresolved(true);
    setImportError(null);
    try {
      const rawEnriched = await enrichStatementImport(pendingParsedImport, {
        repository: metadataRepository,
        forceRefresh: true,
        onlyInstrumentIds: instrumentIds,
        previous: pendingEnrichedImport,
      });
      if (requestId !== importRequestSequence.current) return;
      let enriched = rawEnriched;
      const screenshotDuplicateTradeCount = pendingImport.duplicateTradeCount;
      let screenshotConflictTradeCount = pendingImport.conflictTradeCount ?? 0;
      if (
        pendingImport.sourceKind === "screenshot" &&
        pendingImportOriginalExecutions &&
        pendingScreenshotDecisions
      ) {
        const survivorReconciliation = reconcileExecutions(
          pendingImportOriginalExecutions,
          rawEnriched.importable,
        );
        const { currentAfterReplacements, incomingToMerge } =
          applyReconciliationDecisions(
            pendingImportOriginalExecutions,
            survivorReconciliation,
            pendingScreenshotDecisions,
          );
        enriched = { ...rawEnriched, importable: incomingToMerge };
        setPendingImportMergeBase(currentAfterReplacements);
        screenshotConflictTradeCount = survivorReconciliation.conflicts.reduce(
          (total, conflict) => total + conflict.incoming.length,
          0,
        );
      }
      const preview = previewForImport(
        pendingImport.fileName,
        enriched,
        pendingImport.sourceKind === "screenshot"
          ? {
              captureCount: pendingImport.captureCount ?? 0,
              duplicateTradeCount: screenshotDuplicateTradeCount,
              conflictTradeCount: screenshotConflictTradeCount,
            }
          : undefined,
      );
      setPendingEnrichedImport(enriched);
      setPendingImport(preview);
    } catch (error) {
      if (requestId !== importRequestSequence.current) return;
      setImportError(
        error instanceof Error
          ? error.message
          : "重新查询证券名称失败，请稍后再试。",
      );
    } finally {
      if (requestId === importRequestSequence.current) {
        setRetryingUnresolved(false);
      }
    }
  }

  async function confirmImport() {
    if (!pendingImport || pendingImport.blocked || retryingUnresolved || savingImport) {
      return;
    }
    if (supplementScopeRef.current) {
      if (supplementSaving.current) return;
      const scope = supplementScopeRef.current;
      supplementSaving.current = true; setSavingSupplement(true);
      try {
        const before = pendingImportOriginalExecutions ?? currentExecutionSnapshot();
        const changes = supplementChanges(before, mergeExecutions(pendingImportMergeBase ?? before, pendingImport.records), scope);
        if (changes.length) {
          const batchId = `supplement:${crypto.randomUUID()}`;
          const request = supplementRequestRef.current ?? { id: batchId, instrumentId: scope.instrumentId, accountId: scope.accountId, reason: `补充导入：${pendingImport.fileName}`, changes: changes.map(change => ({ ...change, after: change.after ? { ...change.after, source: { ...change.after.source, batchId: change.after.source.batchId ?? batchId } } : null })), importHistory: { id: batchId, fileName: pendingImport.fileName, sourceLabel: pendingImport.sourceLabel, importedAt: new Date().toISOString(), tradeCount: changes.filter(change=>change.after).length, instrumentCount: 1, excludedInstrumentCount: pendingImport.excludedInstrumentCount, excludedRecordCount: supplementExcluded, duplicateTradeCount: pendingImport.duplicateTradeCount, unresolvedInstrumentCount: pendingImport.unresolvedInstrumentCount }, expectedScope: before.filter(e => e.instrument.id === scope.instrumentId && e.accountId === scope.accountId) };
          supplementRequestRef.current = request;
          const result = await tradeRepairClient.revise(request);
          applyCorrectedExecutions(result.executions);
          if (request.importHistory) setImportHistory(history => [request.importHistory!, ...history.filter(entry=>entry.id !== request.importHistory!.id)]);
        }
        setPendingImport(null); setPendingParsedImport(null); setPendingEnrichedImport(null); setPendingImportOriginalExecutions(null); setPendingImportMergeBase(null); setPendingScreenshotDecisions(null); setImportPhase("idle"); clearSupplement();
      } catch (error) { setImportError(error instanceof Error ? error.message : "补充导入未保存，请重试。"); } finally { supplementSaving.current = false; setSavingSupplement(false); }
      return;
    }
    importRequestSequence.current += 1;
    const currentExecutions =
      pendingImportOriginalExecutions ?? currentExecutionSnapshot();
    const mergeBase = pendingImport.monthly
      ? pendingImportMergeBase ??
        currentExecutionSnapshot().filter(
          (e) => !belongsToMonthlyDocument(e, pendingImport.monthly!),
        )
      : pendingImportMergeBase ?? currentExecutions;
    const importBatchId = pendingImport.id;
    const recordsForStorage = pendingImport.records.map((execution) => ({
      ...execution,
      source: {
        ...execution.source,
        batchId: importBatchId,
      },
    }));
    const previousSummaries = new Map(
      buildInstrumentTradeSummaries(currentExecutions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const reconciliation = pendingImport.monthly ? reconcileExecutions(mergeBase, recordsForStorage) : null;
    if (reconciliation?.conflicts.some(c => !monthlyConflictDecisions.has(c.id))) return;
    const resolvedMonthly = reconciliation ? applyReconciliationDecisions(mergeBase, reconciliation, monthlyConflictDecisions) : null;
    const mergedExecutions = applyMonthlyHistoryEvidence(mergeExecutions(
      resolvedMonthly?.currentAfterReplacements ?? mergeBase,
      resolvedMonthly?.incomingToMerge ?? recordsForStorage,
    ), [
      ...importHistory.filter(entry => entry.monthly?.documentId !== pendingImport.monthly?.documentId)
        .flatMap(entry => entry.monthly ? [entry.monthly] : []),
      ...(pendingImport.monthly ? [pendingImport.monthly] : []),
    ]);
    const mergedIds = new Set(mergedExecutions.map((execution) => execution.id));
    // Reinsert explicitly retained conflicting rows together, so storage cannot
    // reinterpret the user's keep-both decision as an unresolved conflict.
    const decidedExistingIds = new Set(reconciliation?.conflicts.flatMap(c => c.existing.map(e => e.id)) ?? []);
    const replaceExecutionIds = currentExecutions
      .filter((execution) => !mergedIds.has(execution.id) || decidedExistingIds.has(execution.id) || Boolean(pendingImport.monthly && belongsToMonthlyDocument(execution, pendingImport.monthly)))
      .map((execution) => execution.id);
    const summaries = buildInstrumentTradeSummaries(mergedExecutions);
    const importedAt = new Date().toISOString();
    const historyEntry: ImportHistoryEntry = {
      ...(pendingImport.monthly ? { monthly: pendingImport.monthly } : {}),
      id: pendingImport.id,
      fileName: pendingImport.fileName,
      sourceLabel: pendingImport.sourceLabel,
      importedAt,
      firstTradeAt: pendingImport.firstTradeAt,
      lastTradeAt: pendingImport.lastTradeAt,
      tradeCount: pendingImport.tradeCount,
      instrumentCount: pendingImport.instrumentCount,
      excludedInstrumentCount: pendingImport.excludedInstrumentCount,
      excludedRecordCount: pendingImport.exclusionGroups.reduce(
        (total, group) => total + group.count,
        0,
      ),
      duplicateTradeCount: pendingImport.duplicateTradeCount,
      ...(pendingImport.tradeNature
        ? { tradeNature: pendingImport.tradeNature }
        : {}),
      ...(pendingImport.simulationRunId
        ? { simulationRunId: pendingImport.simulationRunId }
        : {}),
      ...(pendingImport.sourceKind === "screenshot"
        ? {
            sourceKind: "screenshot" as const,
            captureCount: pendingImport.captureCount ?? 0,
            conflictTradeCount: pendingImport.conflictTradeCount ?? 0,
          }
        : pendingImport.sourceKind === "tradingview"
          ? { sourceKind: "tradingview" as const }
        : {}),
      unresolvedInstrumentCount:
        pendingImport.unresolvedInstrumentCount,
    };
    setSavingImport(true);
    setImportError(null);
    try {
      await storageClient.mergeExecutions({
        executions: mergedExecutions,
        instruments: summaries.map(({ instrument }) => instrument),
        importHistory: [historyEntry],
        ...(replaceExecutionIds.length > 0 ? { replaceExecutionIds } : {}),
      });
    } catch (error) {
      setImportError(
        error instanceof Error && "code" in error && error.code === "conflict"
          ? "同一 CSV 已关联另一证券，请核对已有导入记录。当前预览尚未保存。"
          : "SQLite 未能保存这次导入，请检查服务状态后重试。",
      );
      return;
    } finally {
      setSavingImport(false);
    }
    importedExecutionsRef.current = mergedExecutions;
    setImportedExecutions(mergedExecutions);
    setImportHistory([
      historyEntry,
      ...importHistory.filter((entry) => entry.id !== historyEntry.id),
    ]);
    const importedIds = pendingImport.instruments.map(
      (item) => item.instrument.id,
    );
    for (const evidence of [...(pendingImport.monthly?.positions ?? []), ...(pendingImport.monthly?.events ?? [])]) {
      if (evidence.market && evidence.symbol) importedIds.push(canonicalInstrumentId(evidence.symbol, evidence.market));
    }
    const automaticSyncIds = summaries
      .filter((summary) => importedIds.includes(summary.instrument.id))
      .filter((summary) => {
        const previous = previousSummaries.get(summary.instrument.id);
        const range = marketRanges(summary).daily;
        const previousRange = previous
          ? marketRanges(previous).daily
          : undefined;
        const newestEpisode = sortedEpisodes(summary)[0];
        const previousNewestEpisode = sortedEpisodes(previous)[0];
        const episodeShape = (episode: TradeEpisode | undefined) =>
          episode
            ? `${episode.startedAt}|${episode.endedAt ?? ""}|${episode.status}`
            : "";
        return (
          requiredRangeExpanded(previousRange, range) ||
          episodeShape(newestEpisode) !== episodeShape(previousNewestEpisode)
        );
      })
      .map((summary) => summary.instrument.id);
    const firstImported = summaries.find((item) =>
      importedIds.includes(item.instrument.id),
    );
    if (firstImported && activeView === "review") {
      const importedEpisode = sortedEpisodes(buildInstrumentTradeSummaries(pendingImport.records).find(item=>item.instrument.id===firstImported.instrument.id))[0];
      selectImportedSummary(firstImported, importedEpisode?.id);
    }
    void startMarketDataUpdate(automaticSyncIds, {
      executions: mergedExecutions,
      batch: automaticSyncIds.length > 1,
    });
    setPendingImport(null);
    setPendingParsedImport(null);
    setPendingEnrichedImport(null);
    setPendingImportOriginalExecutions(null);
    setPendingImportMergeBase(null);
    setPendingScreenshotDecisions(null);
    setImportPhase("idle");
    const nextFile = importFileQueue.current.shift();
    if (nextFile) void parseImport(nextFile);
  }

  function openLibraryEpisode(
    instrumentId: string,
    episodeId: string,
    scopeKey?: string,
    returnView: ReviewReturnView = "library",
  ) {
    setReviewReturnView(returnView);
    const summary = importedInstruments.find((item) => item.instrument.id === instrumentId);
    if (summary && selectImportedSummary(summary, episodeId)) {
      setHistoryMode("history");
      setReviewQueueIds(undefined);
      setActivePanelTab("notes");
      setLibraryTarget(undefined);
      setNavigationNotice(null);
      setActiveView("review");
      return;
    }
    setLibraryTarget({
      requestId: ++libraryTargetSequence.current,
      instrumentId,
      episodeId,
      ...(scopeKey ? { scopeKey } : {}),
    });
    setActiveView("library");
  }

  function returnToLibrary() {
    setImportManagementOpen(false);
    setPlaying(false);
    setLibraryTarget(undefined);
    setLibraryBrowseState((current) =>
      current
        ? { ...current, selectedInstrumentId: null, selectedEpisodeId: null }
        : current,
    );
    setActiveView("library");
  }

  function returnFromReview() {
    if (reviewReturnView === "dashboard") {
      setPlaying(false);
      setLibraryTarget(undefined);
      setActiveView("dashboard");
      return;
    }
    if (reviewReturnView === "insights") {
      setPlaying(false);
      setLibraryTarget(undefined);
      setActiveView("insights");
      return;
    }
    returnToLibrary();
  }

  function continueFromReview() {
    const candidates = buildReviewQueue(tradeLibraryEntries, {status:"pending", ...(reviewQueueIds ? {} : {account:selectedEpisode?.accountId, nature:selectedEpisode?.executions[0] ? displayTradeNature(selectedEpisode.executions[0]) : undefined, simulationRunId:selectedEpisode?.simulationRunId})});
    const next = reviewQueueIds
      ? candidates
        .filter(row => reviewQueueIds.indexOf(row.item.episode.id) > reviewQueueIds.indexOf(activeEpisodeId))
        .sort((left, right) => reviewQueueIds.indexOf(left.item.episode.id) - reviewQueueIds.indexOf(right.item.episode.id))[0]
      : candidates.find(row => row.item.episode.id !== activeEpisodeId);
    if (next) {
      const summary = importedInstruments.find(item => item.instrument.id === next.entry.instrument.id);
      if (summary && selectImportedSummary(summary, next.item.episode.id)) {
        setActivePanelTab("notes");
        setPlaying(false);
        return;
      }
    }
    setReviewQueueIds(undefined);
    setLibraryTarget(undefined);
    if (reviewReturnView === "library") {
      setLibraryBrowseState(current => current ? {...current,selectedInstrumentId:null,selectedEpisodeId:null} : undefined);
    }
    setNavigationNotice("本轮复盘已完成，可以到阶段总结整理下一步。");
    setActiveView(reviewReturnView);
  }

  async function acceptSuggestion(
    suggestion: TagSuggestionRecord,
    finalTagId: string,
    status: "confirmed" | "edited",
  ) {
    const decidedAt = new Date().toISOString();
    const decided: TagSuggestionRecord = {
      ...suggestion,
      status,
      finalTagId,
      decidedAt,
    };
    const current =
      episodeReviews[suggestion.episodeId] ??
      createEmptyEpisodeReviewRecord(
        suggestion.episodeId,
        suggestion.instrumentId,
        decidedAt,
      );
    const review: EpisodeReviewRecord = {
      ...current,
      tagDictionaryVersion: suggestion.tagDictionaryVersion,
      updatedAt: decidedAt,
      confirmedTagIds: [
        ...new Set([...current.confirmedTagIds, finalTagId]),
      ],
    };
    await storageClient.putSuggestionDecision({ suggestion: decided, review });
    setSuggestionDecisions((records) => [
      ...records.filter(({ id }) => id !== decided.id),
      decided,
    ]);
    setEpisodeReviews((records) => ({
      ...records,
      [review.episodeId]: review,
    }));
  }

  function confirmSuggestion(suggestion: TagSuggestionRecord) {
    return acceptSuggestion(suggestion, suggestion.tagId, "confirmed");
  }

  function editSuggestion(
    suggestion: TagSuggestionRecord,
    finalTagId: string,
  ) {
    return acceptSuggestion(suggestion, finalTagId, "edited");
  }

  async function rejectSuggestion(suggestion: TagSuggestionRecord) {
    const decided: TagSuggestionRecord = {
      ...suggestion,
      status: "rejected",
      finalTagId: null,
      decidedAt: new Date().toISOString(),
    };
    await suggestionRepository.put(decided);
    setSuggestionDecisions((records) => [
      ...records.filter(({ id }) => id !== decided.id),
      decided,
    ]);
  }

  async function revokeSuggestion(suggestion: TagSuggestionRecord) {
    const finalTagId = suggestion.finalTagId ?? suggestion.tagId;
    const current = episodeReviews[suggestion.episodeId];
    if (!current) throw new Error("该回合记录已变化，请刷新后重试。");
    const supportedElsewhere = suggestionDecisions.some(item => item.id !== suggestion.id &&
      item.episodeId === suggestion.episodeId && (item.status === "confirmed" || item.status === "edited") &&
      (item.finalTagId ?? item.tagId) === finalTagId);
    const decidedAt = new Date().toISOString();
    const decided: TagSuggestionRecord = { ...suggestion, status: "rejected", finalTagId: null, decidedAt };
    const review: EpisodeReviewRecord = {
      ...current,
      updatedAt: decidedAt,
      confirmedTagIds: supportedElsewhere ? current.confirmedTagIds : current.confirmedTagIds.filter(id => id !== finalTagId),
    };
    await storageClient.putSuggestionDecision({ suggestion: decided, review });
    setSuggestionDecisions(records => records.map(item => item.id === decided.id ? decided : item));
    setEpisodeReviews(records => ({ ...records, [review.episodeId]: review }));
  }

  function applyCommand(command: DrawingCommand) {
    setDrawingHistory((history) =>
      applyDrawingCommand(history, command, activeCursor),
    );
    if (command.type === "add") setActiveTool("cursor");
  }

  function setReviewTimeframe(next: Timeframe) {
    if (
      selectedImportedInstrument &&
      !importedAvailability[next].enabled
    ) {
      return;
    }
    setTimeframe(next);
    setSelectedDrawingId(null);
  }

  function previousImported() {
    const exact = importedReplay.currentCursor === activeCursor;
    const previous = exact
      ? importedReplay.previous()
      : importedTimelineCandles.findLast(
          (candle) => candleKnowledgeAt(candle) < activeCursor,
        )
        ? candleKnowledgeAt(
            importedTimelineCandles.findLast(
              (candle) => candleKnowledgeAt(candle) < activeCursor,
            )!,
          )
        : undefined;
    if (previous) setImportedCursor(previous);
  }

  function nextImported() {
    const exact = importedReplay.currentCursor === activeCursor;
    const next = exact
      ? importedReplay.next()
      : importedTimelineCandles.find(
          (candle) => candleKnowledgeAt(candle) > activeCursor,
        )
        ? candleKnowledgeAt(
            importedTimelineCandles.find(
              (candle) => candleKnowledgeAt(candle) > activeCursor,
            )!,
          )
        : undefined;
    if (next) setImportedCursor(next);
  }

  function nextImportedExecution() {
    const fromReplay = importedReplay.nextExecution();
    const next =
      fromReplay > activeCursor
        ? fromReplay
        : selectedEpisode?.executions.find(
            (execution) => execution.executedAt > activeCursor,
          )?.executedAt;
    if (next) setImportedCursor(next);
  }

  async function saveEpisodeReview(record: EpisodeReviewRecord) {
    const requiresDrawingFlush = Boolean(
      record.review.completed || record.review.deferredReason?.trim(),
    );
    if (requiresDrawingFlush && record.episodeId === activeEpisodeId) {
      if (drawingSaveErrorsRef.current[record.episodeId]) {
        throw new Error(
          "复盘状态尚未保存，请点击“重试保存复盘状态”后再完成本回合。",
        );
      }
      try {
        await flushLatestDrawingState({
          version: 2,
          episodeId: record.episodeId,
          replayCursor: selectedImportedInstrument
            ? effectiveImportedCursor
            : activeCursor,
          timeframe,
          activePanelTab,
          drawings: drawingHistory.present,
        });
      } catch {
        throw new Error(
          "复盘状态尚未保存，请点击“重试保存复盘状态”后再完成本回合。",
        );
      }
    }
    const persisted = await reviewRepository.put(record);
    if (!persisted) throw new Error("复盘记录已更新，本次保存未被接受，请重新载入后重试");
    setEpisodeReviews((current) => {
      const visible = current[record.episodeId];
      if (
        visible &&
        Date.parse(visible.updatedAt) > Date.parse(record.updatedAt)
      ) {
        return current;
      }
      return {
        ...current,
        [record.episodeId]: record,
      };
    });
  }

  function startScreenshotImport(files: File[]) {

                importRequestSequence.current += 1;
                setImportError(null);
                setPendingImport(null);
                setPendingParsedImport(null);
                setPendingEnrichedImport(null);
                setPendingImportOriginalExecutions(null);
                setPendingImportMergeBase(null);
                setPendingScreenshotDecisions(null);
                void screenshotImport.start(files).catch((error) => {
                  setImportError(
                    error instanceof Error ? error.message : "截图识别失败",
                  );
                });

  }

  const importActions = {
    disabled: importing,
    onTradingView: () => { clearSupplement(); tradingViewInputRef.current?.click(); },
    onFile: () => { clearSupplement(); importFileRef.current?.click(); },
    onScreenshot: () => { clearSupplement(); importScreenshotRef.current?.click(); },
  };

  const episodeSidebar = (
    <EpisodeSidebar
      pendingReviewInstrumentIds={pendingReviewInstrumentIds}
      importedInstruments={importedInstruments}
      showDemo={showDemo}
      importing={importing}
      importPhase={importPhase}
      importError={importError}
      onImport={(file) => startStatementBatch([file])}
      onImportFiles={startStatementBatch}
      onTradingViewImport={(file) => {
        screenshotImport.cancel();
        importRequestSequence.current += 1;
        setPendingImport(null);
        setImportError(null);
        void parseImport(file);
      }}
      onScreenshotImport={startScreenshotImport}
      onOpenHistory={() => setShowImportHistory(true)}
      revealedDemoExecutions={demoSnapshot.executions}
      selectedInstrumentId={selectedInstrumentId}
      onSelectInstrument={(id) => {
        selectInstrument(id);
        setImportManagementOpen(false);
        setStockDrawerOpen(false);
      }}
      marketDataStatuses={marketDataStatuses}
      marketDataLabels={marketDataLabels}
      onUpdateMarketData={(instrumentId) =>
        void startMarketDataUpdate([instrumentId], {
          refreshMetadata: true,
        })
      }
      onUpdateAllMarketData={() =>
        void startMarketDataUpdate(
          importedInstruments.map((item) => item.instrument.id),
          { refreshMetadata: true, batch: true },
        )
      }
      onRetryFailedMarketData={() =>
        void startMarketDataUpdate(failedMarketDataIds, {
          refreshMetadata: true,
          batch: true,
        })
      }
      marketDataRefresh={marketDataRefresh}
    />
  );

  if (storageState !== "ready") {
    const failed = storageState === "error";
    return (
      <main className="trade-review-app" aria-live="polite">
        <section className="review-workspace review-workspace-loading" aria-busy={!failed} aria-label="SQLite 存储状态">
          <strong>{failed ? "无法打开交易数据" : storageState === "migration" ? "正在迁移浏览器交易数据" : "正在连接交易数据"}</strong>
          <span>{failed ? storageError ?? "SQLite 存储暂时不可用。" : storageState === "migration" ? "首次升级会将现有浏览器数据安全迁移到 SQLite。" : "正在从 SQLite 读取交易记录…"}</span>
          {failed && <button type="button" onClick={() => setBootstrapAttempt((value) => value + 1)}>重试</button>}
        </section>
      </main>
    );
  }

  return (
    <main className={`trade-review-app ${activeView === "review" ? "is-review" : ""}`}>
      <input hidden ref={importFileRef} aria-label="导入交易记录" type="file" accept=".xlsx,.xls,.pdf" multiple={!supplementScope} disabled={importing} onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length) startStatementBatch(files);
        event.currentTarget.value = "";
      }} />
      <input hidden ref={tradingViewInputRef} aria-label="导入 TradingView 模拟交易" type="file" accept=".csv,text/csv" disabled={importing} onChange={event => {
        const file = event.target.files?.[0];
        if (file) { screenshotImport.cancel(); importRequestSequence.current += 1; setPendingImport(null); setImportError(null); void parseImport(file); }
        event.currentTarget.value = "";
      }} />
      <input hidden ref={importScreenshotRef} aria-label="从截图恢复交易" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple disabled={importing} onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length) startScreenshotImport(files);
        event.currentTarget.value = "";
      }} />
      <aside className={`app-header app-sidebar ${mobileNavOpen ? "mobile-nav-open" : ""}`} inert={stockDrawerOpen || Boolean(dataTarget)} aria-label="主导航">
        <div className="brand">
          <div className="brand-mark">
            <BookOpenCheck size={19} />
          </div>
          <div>
            <strong>TradeReview</strong>
            <span>历史交易复盘</span>
          </div>
        </div>
        <button
          type="button"
          className="mobile-nav-trigger"
          aria-label="导航"
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileNavOpen((open) => !open)}
          onKeyDown={event => { if (event.key === "Escape") setMobileNavOpen(false); }}
        >
          <Menu size={18} />
          <span>导航</span>
        </button>
        <nav id="primary-navigation" className="app-nav" aria-label="主导航" onKeyDown={event => { if (event.key === "Escape") { setMobileNavOpen(false); document.querySelector<HTMLButtonElement>(".mobile-nav-trigger")?.focus(); } }}>
          <button
            className={activeView === "dashboard" ? "active" : ""}
            aria-current={activeView === "dashboard" ? "page" : undefined}
            onClick={() => {
              setPlaying(false);
              setMobileNavOpen(false);
              setActiveView("dashboard");
            }}
          >
            我的交易室
          </button>
          <button
            className={activeView === "library" ? "active" : ""}
            aria-current={activeView === "library" ? "page" : undefined}
            onClick={() => {
              returnToLibrary();
              setMobileNavOpen(false);
            }}
          >
            交易库
          </button>
          <button
            className={activeView === "insights" ? "active" : ""}
            aria-current={activeView === "insights" ? "page" : undefined}
            onClick={() => {
              setMobileNavOpen(false);
              setActiveView("insights");
            }}
          >
            分析
          </button>
          <button
            className={activeView === "data" ? "active" : ""}
            aria-current={activeView === "data" ? "page" : undefined}
            onClick={() => {
              setPlaying(false);
              setMobileNavOpen(false);
              setActiveView("data");
            }}
          >
            数据
          </button>
        </nav>
      </aside>

      {mobileNavOpen && <button className="mobile-navigation-backdrop" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-content">
      {activeView === "review" && (showDemo || selectedImportedInstrument) && <header className="page-header review-page-header" aria-label="页面顶栏" inert={stockDrawerOpen || Boolean(dataTarget)}>
        <div className="header-actions">
          {selectedImportedInstrument && activeView === "review" && (
            <button
              type="button"
              className="header-data-management"
              aria-label="打开导入与数据管理"
              aria-haspopup="dialog"
              aria-controls="import-management-dialog"
              onClick={() => setImportManagementOpen(true)}
            >
              数据
            </button>
          )}
          <span className="demo-chip">
            {showDemo && <Sparkles size={13} />}
            {selectedImportedInstrument
              ? selectedEpisode?.executions[0] ? tradingNatureLabel(selectedEpisode.executions[0]) : "本地导入"
              : showDemo
                ? "演示行情"
                : "等待导入"}
          </span>
          {activeView === "review" && <button type="button" className="stock-list-trigger" aria-label="打开股票列表" aria-haspopup="dialog" aria-expanded={stockDrawerOpen} onClick={() => setStockDrawerOpen(true)}><Menu size={19} /><span>股票</span></button>}
          <div className="user-avatar">ZL</div>
        </div>
      </header>}
      {showDemo && activeView !== "review" && <header className="page-header" aria-label="页面顶栏" inert={stockDrawerOpen || Boolean(dataTarget)}>
        <div className="header-actions">
          <button type="button" className="secondary-action" onClick={() => setActiveView("review")}>返回演示复盘</button>
        </div>
      </header>}
      {activeView === "review" && (showDemo || selectedImportedInstrument) && <div className="review-layout-controls" inert={stockDrawerOpen || Boolean(dataTarget)} aria-label="复盘布局">
        {!showDemo && <button onClick={returnFromReview}>返回{reviewReturnView === "dashboard" ? "我的交易室" : reviewReturnView === "insights" ? "分析" : "交易库"}</button>}
        {selectedImportedInstrument && selectedEpisode && activeView === "review" && (
          <button
            type="button"
            className="header-data-check"
            aria-label="检查/修复数据"
            onClick={() => openDataCheck(selectedImportedInstrument.instrument.id, selectedEpisode.accountId)}
          >
            检查/修复数据
          </button>
        )}
        {showDemo && <>
          <button className="mobile-trades-toggle" aria-expanded={mobileTradesOpen} onClick={() => setMobileTradesOpen(value=>!value)}>{mobileTradesOpen ? "收起本股交易" : "本股交易"}</button>
          <button className="desktop-left-toggle" aria-expanded={layout.left} onClick={() => { setFocusedChart(false); setLayout((value) => ({ ...value, left: !value.left })); }}>{layout.left ? "收起交易导航" : "展开交易导航"}</button>
          <button className="desktop-right-toggle" aria-expanded={layout.right} onClick={() => { setFocusedChart(false); setLayout((value) => ({ ...value, right: !value.right })); }}>{layout.right ? "收起复盘面板" : "展开复盘面板"}</button>
        </>}
        <button aria-pressed={focusedChart} onClick={toggleFocus}>{focusedChart ? "标准布局" : "专注图表"}</button>
      </div>}
      {mobileTradesOpen && <button className="stock-drawer-backdrop" aria-label="关闭本股交易遮罩" onClick={() => setMobileTradesOpen(false)} />}
      {importError && activeView !== "data" && <p role="alert" className="navigation-notice">{importError}</p>}
      {activeDrawingSaveError && <p role="alert" className="navigation-notice">{activeDrawingSaveError}<button type="button" disabled={activeDrawingSavePending} onClick={() => void retryDrawingState(activeEpisodeId).catch(() => undefined)}>重试保存复盘状态</button></p>}
      {importing && <p role="status" className="global-import-status">正在处理导入记录…</p>}
      {navigationNotice && activeView !== "data" && <p role="alert" className="navigation-notice">{navigationNotice}<button type="button" onClick={() => setNavigationNotice(null)}>关闭提示</button></p>}
      <div
        inert={Boolean(dataTarget)}
        className={`workspace ${activeView === "review" && !showDemo && selectedImportedInstrument ? "recall-mode" : ""} ${activeView === "review" ? `${layout.left ? "" : "layout-left-hidden"} ${layout.right ? "" : "layout-right-hidden"}` : ""} ${!showDemo && importedInstruments.length === 0 && activeView === "review" ? "empty-mode" : ""} ${
          activeView === "dashboard"
            ? "dashboard-mode"
            : activeView === "library"
            ? "library-mode"
            : activeView === "insights"
              ? "insights-mode"
              : activeView === "data"
                ? "data-management-mode"
              : ""
        }`}
      >
        <div
          aria-hidden={activeView !== "dashboard"}
          style={{
            display: activeView === "dashboard" ? "block" : "none",
            gridColumn: "1 / -1",
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <ReviewDashboard
            visible={activeView === "dashboard"}
            sharedScope={sharedScope}
            onSharedScopeChange={updateSharedScope}
            sharedAccountOptions={sharedAccountOptions}
            entries={tradeLibraryEntries}
            colorScheme={settings.colorScheme}
            instrumentMetadata={instrumentMetadata}
            fxSnapshot={fxSnapshot}
            principalEnabled={!showDemo}
            holdingsQuotesByInstrument={holdingsQuotesByInstrument}
            holdingsCandlesByInstrument={marketDataCandles}
            holdingsAsOf={holdingsAsOf}
            holdingsStaleAfterDays={3}
            qualityInput={!showDemo ? qualityInput : undefined}
            onQualityModelChange={updateQualityModel}
            onOpenDataManagement={openQualityDetails}
            onOpenPrincipalSettings={() => {
              setPlaying(false);
              setDataTab("settings");
              setActiveView("data");
            }}
            onRetryDataQuality={retryDataQuality}
            onOpenDataCheck={openQualityDataCheck}
            onOpenInReview={(instrumentId, episodeId, queueIds) => {
              const summary = importedInstruments.find((item) => item.instrument.id === instrumentId);
              if (!summary || !selectImportedSummary(summary, episodeId)) {
                setNavigationNotice("该交易回合已变化，请返回我的交易室重新选择。");
                return;
              }
              setNavigationNotice(null);
              setReviewQueueIds(queueIds);
              setHistoryMode("history");
              setActivePanelTab("notes");
              setReviewReturnView("dashboard");
              setLibraryTarget(undefined);
              setActiveView("review");
            }}
          />
        </div>
        <div
          aria-hidden={activeView !== "data"}
          className="data-management-page"
          style={{
            display: activeView === "data" ? "block" : "none",
            gridColumn: "1 / -1",
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          <SharedScopeBar scope={sharedScope} accountOptions={sharedAccountOptions} onChange={updateSharedScope} />
          <DataManagement
            activeTab={dataTab}
            onTabChange={setDataTab}
            importActions={importActions}
            marketRefresh={{
              instrumentCount: importedInstruments.length,
              state: marketDataRefresh,
              onRefresh: () => void startMarketDataUpdate(undefined, {
                refreshMetadata: true,
                batch: true,
              }),
              onCancel: cancelMarketDataUpdate,
              onRetryFailed: () => void startMarketDataUpdate(failedMarketDataIds, {
                refreshMetadata: true,
                batch: true,
              }),
              onRecoverUnfinished: () => void recoverUnfinishedMarketData(),
            }}
            retainedInstruments={storedInstruments}
            activeInstrumentIds={importedInstruments.map((item) => item.instrument.id)}
            onOpenDataCheck={(instrumentId) => openDataCheck(instrumentId, "")}
            importHistoryCount={importHistory.length}
            onOpenImportHistory={() => setShowImportHistory(true)}
            importError={importError}
            navigationNotice={navigationNotice}
            onDismissNotice={() => {
              setImportError(null);
              setNavigationNotice(null);
            }}
            qualitySlot={qualityModel ? (
              <QualityDetails
                model={qualityModel}
                onOpenDataManagement={openQualityDetails}
                onRetryDataQuality={retryDataQuality}
                onOpenDataCheck={openQualityDataCheck}
              />
            ) : undefined}
            principalSlot={!showDemo ? (sharedScope.nature === "unknown" ? <p role="status">交易性质尚未核实，参考分配资本不可用。请先核对账本性质。</p> : <TradingRoomPrincipalSlot
                entries={scopedTradeLibraryEntries}
                sharedScope={{ nature: sharedScope.nature, simulationRunId: sharedScope.simulationRunId, accountIds: sharedScope.accountIds, reportCurrency: sharedScope.reportCurrency }}
                instrumentMetadata={instrumentMetadata}
                fxSnapshot={fxSnapshot}
                enabled
              />
            ) : undefined}
            fxSlot={resolvedFxSlot}
          />
        </div>
        {activeView === "library" ? (
          <TradeLibrary
            sharedScope={sharedScope}
            onSharedScopeChange={updateSharedScope}
            sharedAccountOptions={sharedAccountOptions}
            defaultMode="queue"
            key={libraryTarget?.requestId ?? 0}
            initialBrowseState={libraryBrowseState}
            onBrowseStateChange={setLibraryBrowseState}
            entries={scopedTradeLibraryEntries}
            candlesByInstrument={marketDataCandles}
            marketDataStatuses={marketDataStatuses}
            marketDataLabels={marketDataLabels}
            timeframe={legacyTimeframe}
            onTimeframeChange={(next) => {
              if (next === "1D" || next === "1W") setLegacyTimeframe(next);
            }}
            onOpenInReview={(instrumentId, episodeId, queueIds) => {
              const summary = importedInstruments.find((item) => item.instrument.id === instrumentId);
              if (!summary || !selectImportedSummary(summary, episodeId)) {
                setNavigationNotice("该交易回合已变化，请返回股票库重新选择。");
                return;
              }
              setNavigationNotice(null);
              setReviewQueueIds(queueIds);
              setHistoryMode("history");
              setActivePanelTab("notes");
              setReviewReturnView("library");
              setLibraryTarget(undefined);
              setActiveView("review");
            }}
            reviewsHydrated={reviewsHydrated}
            target={libraryTarget}
            onSaveReview={saveEpisodeReview}
            reviewExtras={reviewExtras}
            onInspectData={openDataCheck}
            onRefreshMarketData={(instrumentId) => void startMarketDataUpdate([instrumentId], { refreshMetadata: true })}
            onImport={() => {
              setDataTab("import");
              setActiveView("data");
            }}
          />
        ) : activeView !== "dashboard" && activeView === "insights" ? (
          <div className="scoped-insights-page"><SharedScopeBar scope={sharedScope} accountOptions={sharedAccountOptions} onChange={updateSharedScope} /><ReviewSummary activeTab={insightsTab} onTabChange={setInsightsTab} onImport={() => {
            setDataTab("import");
            setActiveView("data");
          }} filterStore={{filters:summaryFilters,setFilters:setSummaryFilters}} draftStore={{drafts:summaryDrafts,setDrafts:setSummaryDrafts}} entries={scopedTradeLibraryEntries} scopeId={summaryScope} onScopeChange={setRequestedSummaryScope} client={summaryClient} onOpenEpisode={(instrumentId, episodeId) => openLibraryEpisode(instrumentId, episodeId, undefined, "insights")}>
            {renderScopedInsights}
          </ReviewSummary></div>
        ) : activeView === "review" ? (
          <>
            {stockDrawerOpen && <button type="button" className="stock-drawer-backdrop" aria-label="关闭股票列表遮罩" tabIndex={-1} onClick={() => setStockDrawerOpen(false)} />}
            <aside ref={stockDrawerRef} className={`stock-sidebar-shell stock-picker-shell ${stockDrawerOpen ? "drawer-open" : ""}`} role={stockDrawerOpen ? "dialog" : undefined} aria-modal={stockDrawerOpen || undefined} aria-label={stockDrawerOpen ? "选择复盘股票" : undefined}>
            {stockDrawerOpen && <header className="stock-drawer-heading"><strong>选择复盘股票</strong><button type="button" aria-label="关闭股票列表" onClick={() => setStockDrawerOpen(false)}><X size={20} /></button></header>}
            <EpisodeSidebar
              hideImportActions
              pendingReviewInstrumentIds={pendingReviewInstrumentIds}
              importedInstruments={importedInstruments}
              showDemo={showDemo}
              importing={importing}
              importPhase={importPhase}
              importError={null}
              onImport={(file) => startStatementBatch([file])}
              onImportFiles={startStatementBatch}
              onTradingViewImport={file=>{ screenshotImport.cancel(); importRequestSequence.current+=1; setPendingImport(null); setImportError(null); void parseImport(file); }}
              onScreenshotImport={(files) => {
                importRequestSequence.current += 1;
                setImportError(null);
                setPendingImport(null);
                setPendingParsedImport(null);
                setPendingEnrichedImport(null);
                setPendingImportOriginalExecutions(null);
                setPendingImportMergeBase(null);
                setPendingScreenshotDecisions(null);
                void screenshotImport.start(files).catch((error) => {
                  setImportError(
                    error instanceof Error ? error.message : "截图识别失败",
                  );
                });
              }}
              onOpenHistory={() => setShowImportHistory(true)}
              revealedDemoExecutions={demoSnapshot.executions}
              selectedInstrumentId={selectedInstrumentId}
              onSelectInstrument={(id) => { selectInstrument(id); setStockDrawerOpen(false); }}
              marketDataStatuses={marketDataStatuses}
              marketDataLabels={marketDataLabels}
              onUpdateMarketData={(instrumentId) =>
                void startMarketDataUpdate([instrumentId], {
                  refreshMetadata: true,
                })
              }
              onUpdateAllMarketData={() =>
                void startMarketDataUpdate(
                  importedInstruments.map((item) => item.instrument.id),
                  { refreshMetadata: true, batch: true },
                )
              }
              onRetryFailedMarketData={() =>
                void startMarketDataUpdate(failedMarketDataIds, {
                  refreshMetadata: true,
                  batch: true,
                })
              }
              marketDataRefresh={marketDataRefresh}
            />
            </aside>
            <div className="review-content" inert={stockDrawerOpen || Boolean(dataTarget)}>
            {showDemo && <div className={`stock-context-shell ${mobileTradesOpen ? "mobile-trades-open" : ""}`}><StockEpisodeNavigation mobileOpen={mobileTradesOpen} onCloseMobile={() => setMobileTradesOpen(false)} instrument={selectedImportedInstrument?.instrument} episodes={episodes} selectedEpisodeId={selectedEpisode?.id} cursor={activeCursor} onSelectEpisode={id => { selectEpisode(id); setMobileTradesOpen(false); }} onLocate={(cursor) => { setPlaying(false); setImportedCursor(cursor); setMobileTradesOpen(false); }} onLocateRequest={requestExecutionLocation} onNext={nextImportedExecution} onSwitchStock={() => { setMobileTradesOpen(false); setStockDrawerOpen(true); }} onLibrary={() => { setMobileTradesOpen(false); returnFromReview(); }} returnLabel={reviewReturnView === "dashboard" ? "返回我的交易室" : reviewReturnView === "insights" ? "返回模式洞察" : undefined} /></div>}
            {!showDemo && !selectedImportedInstrument ? (
              <section
                className="review-workspace review-workspace-empty"
                aria-label="开始交易复盘"
              >
                <BookOpenCheck size={36} />
                <h1>{importedInstruments.length ? "请选择其他股票继续复盘" : "从一笔真实交易开始复盘"}</h1>
                {importedInstruments.length ? <button onClick={() => setStockDrawerOpen(true)}>选择复盘股票</button> : <p>前往数据管理导入成交记录，选择交易回合，逐步回放当时的行情与判断。</p>}
                <button type="button" className="primary-action" onClick={() => setActiveView("data")}>前往数据管理</button>
              </section>
            ) : selectedImportedInstrument && !selectedEpisode ? (
              <section className="review-workspace review-workspace-empty" role="alert">
                <p>原交易回合已变化，请重新选择。</p>
                <button type="button" className="secondary-action" onClick={returnToLibrary}>前往交易库选择回合</button>
              </section>
            ) : selectedImportedInstrument &&
            !hydratedMarketIds.has(
              selectedImportedInstrument.instrument.id,
            ) ? (
              <section
                className="review-workspace review-workspace-loading"
                aria-label="交易复盘图表工作区"
                aria-busy="true"
              >
                正在读取本地行情与回放状态…
              </section>
            ) : selectedImportedInstrument ? (
              <div className="recall-review-host">
                <RecallWorkspace
                  onLeaveGuardChange={registerRecallLeaveGuard}
                  focused={focusedChart}
                  onFocusedChange={setFocusedChart}
                  episode={selectedEpisode!}
                  episodes={episodes}
                  instrument={selectedImportedInstrument.instrument}
                  instruments={searchableInstruments}
                  timeframeAvailability={importedAvailability}
                  importedTimelineCandles={importedTimelineCandles}
                  candlesByTimeframe={recallCandlesByTimeframe}
                  settings={settings}
                  initialDrawings={drawingHistory.present}
                  dataDetails={marketDataDetails(selectedMarketState, importedAvailability)}
                  onEpisodeChange={selectEpisode}
                  onInstrumentChange={selectInstrument}
                  onTimeframeChange={(nextTimeframe) => setTimeframe(nextTimeframe)}
                  onSettingsChange={(next) => {
                    setSettings(next);
                    void storageClient.putSettings(next).catch(() => {
                      setImportError("图表设置未能保存到 SQLite，请稍后重试。");
                    });
                  }}
                  onRefreshMarketData={() => {
                    void startMarketDataUpdate([
                      selectedImportedInstrument.instrument.id,
                    ], {
                      refreshMetadata: true,
                    });
                  }}
                />
                {importManagementOpen && (
                  <ImportManagementDrawer
                    onClose={() => setImportManagementOpen(false)}
                  >
                    {episodeSidebar}
                  </ImportManagementDrawer>
                )}
              </div>
            ) : (
            <ReviewChartWorkspace
              model={viewModel}
              episodeOptions={
                selectedImportedInstrument
                  ? episodeOptions(episodes, episodeReviews)
                  : [
                      {
                        id: REVIEW_ID,
                        label: "演示交易",
                        startedAt:
                          initialFrame.candles15m[0]?.time ??
                          initialFrame.cursor,
                        status: "open",
                      },
                    ]
              }
              playing={playing}
              speed={speed}
              activeTool={activeTool}
              drawingHistory={drawingHistory}
              selectedDrawingId={selectedDrawingId}
              layersOpen={layersOpen}
              settings={settings}
              instruments={searchableInstruments}
              review={activeReview}
              visiblePlan={activePlan}
              activePanelTab={activePanelTab}
              drawerOpen={drawerOpen}
              onInspectData={legacySelectedImportedInstrument && selectedEpisode ? () => openDataCheck(legacySelectedImportedInstrument.instrument.id, selectedEpisode.accountId) : undefined}
              onEpisodeChange={selectEpisode}
              onTimeframeChange={setReviewTimeframe}
              onSelectInstrument={selectInstrument}
              onRefreshMarketData={() => {
                if (legacySelectedImportedInstrument) {
                  void startMarketDataUpdate([
                    legacySelectedImportedInstrument.instrument.id,
                  ], {
                    refreshMetadata: true,
                  });
                } else {
                  void requestFrame("restore", frame.cursor);
                }
              }}
              onToggleLayers={() => setLayersOpen((open) => !open)}
              onSettingsChange={(next) => {
                setSettings(next);
                void storageClient.putSettings(next).catch(() => {
                  setImportError("图表设置未能保存到 SQLite，请稍后重试。");
                });
              }}
              onToolChange={setActiveTool}
              onDrawingCommand={applyCommand}
              onSelectDrawing={setSelectedDrawingId}
              onUndoDrawing={() =>
                setDrawingHistory((history) =>
                  undoDrawingAtCursor(
                    history,
                    activeCursor,
                    timeframe,
                  ),
                )
              }
              onRedoDrawing={() =>
                setDrawingHistory((history) =>
                  redoDrawingAtCursor(
                    history,
                    activeCursor,
                    timeframe,
                  ),
                )
              }
              onClearDrawings={() =>
                setDrawingHistory((history) =>
                  history.present
                    .filter(
                      (drawing) =>
                        drawing.createdAtCursor <= activeCursor &&
                        !drawing.locked,
                    )
                    .reduce(
                      (next, drawing) =>
                        applyDrawingCommand(next, {
                          type: "delete",
                          id: drawing.id,
                        }),
                      history,
                    ),
                )
              }
              onToggleAllDrawings={() =>
                setDrawingHistory((history) =>
                  setAllDrawingsLockedAtCursor(
                    history,
                    activeCursor,
                    timeframe,
                  ),
                )
              }
              onPrevious={() => {
                setPlaying(false);
                if (selectedImportedInstrument) previousImported();
                else void requestFrame("previous");
              }}
              onNext={() => {
                setPlaying(false);
                if (selectedImportedInstrument) nextImported();
                else void requestFrame("next");
              }}
              onNextExecution={() => {
                setPlaying(false);
                if (selectedImportedInstrument) nextImportedExecution();
                else void requestFrame("next-execution");
              }}
              onTogglePlay={() => setPlaying((value) => !value)}
              onHistoryModeChange={(mode) => {
                setPlaying(false);
                setHistoryMode(mode);
              }}
              onSpeedChange={setSpeed}
              onActivePanelTabChange={setActivePanelTab}
              onDrawerOpenChange={setDrawerOpen}
              locateRequest={locateRequest}
              onLocateResult={handleLocateResult}
              onLocateTimeframeChange={setReviewTimeframe}
              onSaveReview={saveEpisodeReview}
              onCompleteReview={selectedImportedInstrument ? continueFromReview : undefined}
              reviewExtras={selectedEpisode ? reviewExtras(selectedEpisode) : undefined}
            />
            )}
            </div>
          </>
        ) : null}
      </div>

      {dataTarget && <StockDataDialog instrument={dataTarget.instrument} initialAccountId={dataTarget.accountId} cursor={dataTarget.cursor} executions={importedExecutions.filter(execution => execution.instrument.id === dataTarget.instrument.id)} marketSummary={marketDataStatusLabel(marketDataStatuses[dataTarget.instrument.id] ?? "not-requested")} marketDetails={[
        `当前行情状态：${marketDataLabels[dataTarget.instrument.id] ?? "行情源待连接"}`,
        marketStates[dataTarget.instrument.id]?.dailyMessage ?? "",
        marketStates[dataTarget.instrument.id]?.intradayMessage ?? "",
        `本地日线：${marketStates[dataTarget.instrument.id]?.daily.length ?? 0} 根；小时线：${marketStates[dataTarget.instrument.id]?.intraday.length ?? 0} 根`,
        ...(marketStates[dataTarget.instrument.id]?.dailyCoverage ?? []).map(segment => `日线覆盖：${segment.startDate} 至 ${segment.endDate}，${marketDataStatusLabel(segment.status)}`),
        ...(marketStates[dataTarget.instrument.id]?.intradayCoverage ?? []).map(segment => `小时线覆盖：${segment.actualStart ?? segment.requestedStart} 至 ${segment.actualEnd ?? segment.requestedEnd}，${marketDataStatusLabel(segment.status)}`),
      ]} refreshing={marketDataStatuses[dataTarget.instrument.id] === "syncing"} onRefresh={() => void startMarketDataUpdate([dataTarget.instrument.id], { refreshMetadata: true })} onClose={() => setDataTarget(undefined)} onRevise={reviseCurrentTrades} loadHistory={tradeRepairClient.history} onSupplement={(accountId, kind) => { const scope = { instrumentId: dataTarget.instrument.id, accountId, accountLabel: importedExecutions.find(e=>e.accountId===accountId)?.accountLabel ?? accountId, kind }; supplementScopeRef.current = scope; setSupplementScope(scope); setDataTarget(undefined); if (kind === "file") importFileRef.current?.click(); else importScreenshotRef.current?.click(); }} retainedReviews={[
        ...new Set([...Object.values(episodeReviews).filter(review => review.instrumentId === dataTarget.instrument.id).map(review => review.episodeId), ...Object.keys(reviewStates).filter(id => id.includes(encodeURIComponent(dataTarget.instrument.id)))])
      ].filter(id => !currentEpisodeIds.has(id)).map(episodeId => ({ episodeId, review: episodeReviews[episodeId], drawingCount: reviewStates[episodeId]?.drawings.length ?? 0, drawings: reviewStates[episodeId]?.drawings }))} />}

      {supplementScope && <div role="status" className="supplement-scope-notice">补充导入范围：{supplementScope.instrumentId} · {supplementScope.accountLabel}。截图成交将归入此账户；其他股票与文件中的其他账户已排除（{supplementExcluded} 笔）。{!pendingImport && !screenshotImport.open && !importing && <button onClick={clearSupplement}>取消补充导入</button>}</div>}
      {monthlyReview && (
        <MonthlyStatementReview
          fileName={monthlyReview.file.name}
          parsed={monthlyReview.parsed}
          busy={importing}
          onReparse={options => void parseImport(monthlyReview.file, options)}
          onContinue={() => void continueMonthlyReview()}
          onCancel={() => {
            importRequestSequence.current += 1;
            importFileQueue.current = [];
            setMonthlyReview(null);
            setImporting(false);
            setImportPhase("idle");
          }}
        />
      )}
      {pendingImport && (
        <ImportConfirmDialog
          preview={pendingImport}
          conflicts={pendingImport.monthly ? reconcileExecutions(importedExecutions.filter(e => !belongsToMonthlyDocument(e, pendingImport.monthly!)), pendingImport.records).conflicts : []}
          conflictDecisions={monthlyConflictDecisions}
          onConflictDecision={(id, decision) => setMonthlyConflictDecisions(current => new Map(current).set(id, decision))}
          scopeNotice={supplementScope ? `仅补充 ${supplementScope.instrumentId} / ${supplementScope.accountLabel}；范围外排除 ${supplementExcluded} 笔。截图成交归入此账户。` : undefined}
          saveError={importError}
          saving={savingImport || savingSupplement}
          onCancel={() => {
            if (savingImport || supplementSaving.current) return;
            clearSupplement();
            importRequestSequence.current += 1;
            importFileQueue.current = [];
            setRetryingUnresolved(false);
            setPendingImport(null);
            setPendingParsedImport(null);
            setPendingEnrichedImport(null);
            setPendingImportOriginalExecutions(null);
            setPendingImportMergeBase(null);
            setPendingScreenshotDecisions(null);
            setImportPhase("idle");
          }}
          onConfirm={confirmImport}
          onRetryUnresolved={(instrumentIds) =>
            void retryUnresolved(instrumentIds)
          }
          retryingUnresolved={retryingUnresolved}
        />
      )}
      {pendingTradingViewFile && (
        <TradingViewContextDialog
          fileName={pendingTradingViewFile.name}
          onCancel={() => setPendingTradingViewFile(null)}
          onConfirm={(context) => {
            const file = pendingTradingViewFile;
            setPendingTradingViewFile(null);
            void parseImport(file, {}, context);
          }}
        />
      )}
      {screenshotImport.open &&
        !screenshotImport.completing &&
        screenshotImport.state && (
        <ScreenshotReviewDialog
          scopeNotice={supplementScope ? `仅补充 ${supplementScope.instrumentId} / ${supplementScope.accountLabel}。本股截图成交将归入该账户，其他股票会在确认前排除。` : undefined}
          state={screenshotImport.state}
          images={screenshotImport.images}
          reconciliation={screenshotImport.reconciliation}
          decisions={screenshotImport.decisions}
          onAction={screenshotImport.dispatch}
          onDecision={screenshotImport.decide}
          onRetryImage={(imageId) => {
            void screenshotImport.retryImage(imageId);
          }}
          onRemoveImage={screenshotImport.removeImage}
          onCancel={() => {
            if (savingImport || supplementSaving.current) return;
            clearSupplement();
            importRequestSequence.current += 1;
            screenshotImport.cancel();
            setImporting(false);
            setImportPhase("idle");
            setPendingImportOriginalExecutions(null);
            setPendingImportMergeBase(null);
            setPendingScreenshotDecisions(null);
          }}
          onCompleteReview={() => {
            void screenshotImport.completeReview().catch((error) => {
              setImportError(
                error instanceof Error
                  ? error.message
                  : "截图导入准备失败",
              );
            });
          }}
        />
      )}
      {showImportHistory && (
        <ImportHistoryDialog
          entries={importHistory}
          onClose={() => setShowImportHistory(false)}
        />
      )}
      </div>
    </main>
  );
}
