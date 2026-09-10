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
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

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
import {
  syncIntradayMarketDataForRanges,
  type IntradayTimeRange,
} from "../lib/market/intraday-sync-service";
import { buildIntradaySyncRanges } from "../lib/market/intraday-sync-ranges";
import { recoverStaleMarketDataJob } from "../lib/market/market-data-job-recovery";
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
import { runRefreshQueue } from "../lib/market/refresh-queue";
import {
  MarketDataSyncError,
  syncMarketData,
} from "../lib/market/sync-service";
import { canonicalInstrumentId } from "../lib/instruments/display-name";
import { resolveHistoricalInstrumentIdentity } from "../lib/instruments/historical-instrument-identity";
import { refreshInstrumentMetadata } from "../lib/instruments/resolve-service";
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
import { createImportedReplay } from "../lib/replay/imported-replay";
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
import { tradingNatureLabel } from "../lib/trades/trading-nature";
import type {
  Instrument,
  TradeEpisode,
  TradeExecution,
} from "../lib/trades/types";
import type { MarketDataDetails } from "./chart/market-data-popover";
import { ImportConfirmDialog } from "./import/import-confirm-dialog";
import { ImportHistoryDialog } from "./import/import-history-dialog";
import { ScreenshotReviewDialog } from "./import/screenshot-review-dialog";
import {
  useScreenshotImport,
  type PreparedScreenshotImport,
  type ScreenshotImportDependencies,
} from "./import/use-screenshot-import";
import {
  EpisodeSidebar,
  type ImportPhase,
  type MarketDataRefreshState,
} from "./review/episode-sidebar";
import {
  TradeLibrary,
  type TradeLibraryTarget,
  type TradeLibraryBrowseState,
} from "./library/trade-library";
import { ImportActions } from "./import/import-actions";
import { useModalFocus } from "./import/use-modal-focus";
import { PatternInsights } from "./insights/pattern-insights";
import {
  ReviewChartWorkspace,
  type EpisodeOption,
  type ReviewChartViewModel,
} from "./review/review-chart-workspace";

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
  screenshotImportDependencies?: Partial<ScreenshotImportDependencies>;
  /** Injectable only for integration tests; production creates the HTTP client. */
  storageClient?: SqliteHttpClient;
  legacyStateExporter?: (options?: { excludeDemo?: boolean }) => Promise<import("../lib/storage/sqlite-contracts").BrowserStatePayload | null>;
};

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
      dailyJob?.status ??
      (typeof jobOrStatus === "string" ? jobOrStatus : job?.status ?? "not-requested"),
    intradayStatus: intradayJob?.status ?? "not-requested",
    intradayCoverage: [],
    dailyCoverage: [],
    dailyMessage: dailyJob?.message ?? job?.message,
    intradayMessage: intradayJob?.message,
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
        ? dailyJob.status
        : state.dailyStatus,
    intradayStatus:
      state.intradayStatus === "not-requested" && intradayJob
        ? intradayJob.status
        : state.intradayStatus,
    dailyMessage: state.dailyStatus === "complete" ? "日线覆盖已完整" : state.dailyMessage ?? dailyJob?.message ?? job.message,
    intradayMessage: state.intradayMessage ?? intradayJob?.message,
    dailyError: state.dailyStatus === "complete" ? undefined : state.dailyError ?? dailyJob?.error ?? job.error,
    intradayError: state.intradayError ?? intradayJob?.error,
    ...(hasDailyData || hasIntradayData ? {} : {
      dailyStatus: dailyJob?.status ?? job.status,
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
    label: `第 ${chronological.get(episode.id) ?? 1} 次交易${episode.tradeNature === "simulation" ? ` · ${episode.accountLabel}` : ""}`,
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

const EMPTY_MARKET_DATA_REFRESH: MarketDataRefreshState = {
  running: false,
  total: 0,
  completed: 0,
  partial: 0,
  failed: 0,
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

function dailyStatusFromError(error: unknown): MarketDataSyncStatus {
  if (error instanceof MarketDataSyncError) {
    if (
      error.code === "source-rate-limited" ||
      error.code === "source-forbidden" ||
      error.code === "source-unavailable" ||
      error.code === "invalid-response"
    ) {
      return error.code;
    }
    if (
      error.code === "provider-history-limit" ||
      error.code === "no-data"
    ) {
      return "partial";
    }
  }
  return error instanceof DOMException ? "storage-error" : "source-unavailable";
}

function marketDataErrorDetail(error: unknown): MarketDataErrorDetail {
  if (error instanceof MarketDataSyncError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: "source-unavailable", message: error.message };
  }
  return { code: "source-unavailable", message: "行情更新失败" };
}

export function TradeReviewWorkspace({
  initialFrame,
  showDemo = true,
  screenshotImportDependencies,
  storageClient: storageClientOverride,
  legacyStateExporter = exportLegacyBrowserState,
}: Props) {
function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

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

  const [storedInstruments, setStoredInstruments] = useState<Instrument[]>([]);
  const [mobileTradesOpen, setMobileTradesOpen] = useState(false);
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
  const [navigationNotice, setNavigationNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "review" | "library" | "insights"
  >("review");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
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
    useState<MarketDataRefreshState>(EMPTY_MARKET_DATA_REFRESH);
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
  const replayRequestSequence = useRef(0);
  const importRequestSequence = useRef(0);
  const importedExecutionsRef = useRef<TradeExecution[] | null>(null);
  const marketDataRequestSequences = useRef<Record<string, number>>({});
  const marketDataJobsRef = useRef<Record<string, MarketDataJob>>({});
  const marketDataAbortControllers = useRef<
    Record<string, AbortController>
  >({});
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
  const importedInstruments = useMemo(
    () => buildInstrumentTradeSummaries(importedExecutions),
    [importedExecutions],
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
      ? [effectiveImportedCursor, ...importedTimelineCandles.map(candleKnowledgeAt),
          ...(selectedEpisode?.executions.map(execution => execution.executedAt) ?? [])].sort().at(-1)!
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
                hasDailyData: Boolean(state?.daily.length || state?.dailyCoverage.length),
                hasIntradayData: Boolean(state?.intraday.length || state?.intradayCoverage.length),
                intradayJobStatus: marketDataJobs[summary.instrument.id]?.intervals.find(
                  (item) => item.interval === "1h",
                )?.status,
              },
            ),
          ];
        }),
      ),
    [importedInstruments, marketDataJobs, marketStates],
  );
  const marketDataLabels = Object.fromEntries(importedInstruments.map(({ instrument }) => {
    const state = marketStates[instrument.id];
    return [instrument.id, `日线：${marketDataStatusLabel(state?.dailyStatus ?? "not-requested")}；1H：${marketDataStatusLabel(state?.intradayStatus ?? "not-requested")}`];
  }));
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
      ? selectedEpisode?.tradeNature ?? "unknown"
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
    candles: activeSnapshot.candles,
    executions: selectedImportedInstrument && historyMode === "history"
      ? selectedImportedInstrument.executions.filter(execution => selectedEpisode?.executions[0]
        ? execution.source.tradeNature === selectedEpisode.executions[0].source.tradeNature && execution.source.simulationRunId === selectedEpisode.executions[0].source.simulationRunId
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
  const insightFactResult = useMemo(
    () =>
      buildInsightEpisodeFacts(
        tradeLibraryEntries.filter(entry=>entry.tradeNature !== "simulation"),
        marketDataCandles,
        marketDataStatuses,
        suggestionDecisions,
        dailyCoverageByInstrument,
      ),
    [
      dailyCoverageByInstrument,
      marketDataCandles,
      marketDataStatuses,
      suggestionDecisions,
      tradeLibraryEntries,
    ],
  );
  const insightReport = useMemo(
    () =>
      buildPatternInsightReport(
        insightFactResult.facts,
        insightFactResult.excluded,
      ),
    [insightFactResult],
  );
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
    const stored = reviewStates[episodeId];
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
    setPlaying(false);
    replayRequestSequence.current += 1;
    setStepping(false);
    setReplayError(null);
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
    if (instrumentId === "demo") {
      if (!showDemo) return;
      setPlaying(false);
      setSelectedInstrumentId("demo");
      setSelectedEpisodeId(REVIEW_ID);
      const stored = reviewStates[REVIEW_ID];
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
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode) return;
    setPlaying(false);
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
        const recoveredJobs = bootstrap.marketDataJobs.map((job) =>
          recoverStaleMarketDataJob(job),
        );
        await Promise.allSettled(
          recoveredJobs.flatMap((job, index) =>
            job === bootstrap.marketDataJobs[index]
              ? []
              : [storageClient.putMarketDataJob(job)],
          ),
        );
        const jobs = Object.fromEntries(
          recoveredJobs.map((job) => [job.instrumentId, job]),
        );
        marketDataJobsRef.current = jobs;
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
          setSelectedInstrumentId(firstSummary.instrument.id);
          setSelectedEpisodeId(newestEpisode.id);
          setTimeframe(stored?.timeframe ?? "15m");
          setImportedCursor(stored?.replayCursor ?? replayCursorForEpisode([], newestEpisode.startedAt));
          setActivePanelTab(stored?.activePanelTab ?? "stats");
          setDrawingHistory(createDrawingHistory(stored?.drawings ?? []));
        } else if (showDemo && storedDemo) {
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
    if (!hydrated || importedInstruments.length === 0) return;
    let active = true;
    const repository = marketDataRepository;
    const hydrateMarketState = async (summary: InstrumentTradeSummary) => {
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
      if (!active) return;
      setMarketStates((current) => ({
        ...current,
        [summary.instrument.id]: state,
      }));
      restoreHydratedEpisode([{ instrumentId: summary.instrument.id, state }]);
      setHydratedMarketIds(current => new Set([...current, summary.instrument.id]));
    };
    const priorityInstrumentId = selectedHydrationInstrument();
    const selectedSummary = importedInstruments.find(summary => summary.instrument.id === priorityInstrumentId);
    const backgroundSummaries = importedInstruments.filter(summary => summary !== selectedSummary);
    void (async () => {
      if (selectedSummary) await hydrateMarketState(selectedSummary);
      if (active) await Promise.all(backgroundSummaries.map(hydrateMarketState));
    })();
    return () => {
      active = false;
    };
  }, [
    hydrated,
    importedInstruments,
    marketDataRepository,
  ]);

  useEffect(() => {
    if (!hydrated || restoring || !activeEpisodeId || (!showDemo && !selectedImportedInstrument)) return;
    const state: EpisodeReviewState = {
      version: 2,
      episodeId: activeEpisodeId,
      replayCursor: selectedImportedInstrument ? effectiveImportedCursor : activeCursor,
      timeframe,
      activePanelTab,
      drawings: drawingHistory.present,
    };
    void storageClient.putReviewState(state)
      .then(() => setReviewStates((current) => ({ ...current, [activeEpisodeId]: state })))
      .catch(() => setImportError("复盘状态未能保存到 SQLite，请稍后重试。"));
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
    selectedImportedInstrument,
  ]);

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
      for (const controller of Object.values(
        marketDataAbortControllers.current,
      )) {
        controller.abort();
      }
    },
    [],
  );

  async function startMarketDataUpdate(
    instrumentIds: string[],
    options: {
      executions?: TradeExecution[];
      refreshMetadata?: boolean;
      batch?: boolean;
    } = {},
  ) {
    const uniqueInstrumentIds = [...new Set(instrumentIds)];
    if (uniqueInstrumentIds.length === 0) return;
    const executions = options.executions ?? importedExecutions;
    const summariesById = new Map(
      buildInstrumentTradeSummaries(executions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const marketDataFetcher = options.batch
      ? createMarketDataFetcher(fetch)
      : fetch;

    if (options.batch) {
      setFailedMarketDataIds([]);
      setMarketDataRefresh({
        ...EMPTY_MARKET_DATA_REFRESH,
        running: true,
        total: uniqueInstrumentIds.length,
      });
    }

    const results = await runRefreshQueue(
      uniqueInstrumentIds,
      async (instrumentId) => {
        const summary = summariesById.get(instrumentId);
        if (!summary) return undefined;
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
          marketDataRequestSequences.current[instrumentId] !==
          requestSequence
        ) {
          return;
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
        };
        const metadataRefresh = historicalIdentity
          ? persistInstrumentName(historicalIdentity.displayName)
          : options.refreshMetadata && market
            ? refreshInstrumentMetadata(
                {
                  market,
                  symbol: instrument.symbol,
                },
                {
                  repository: metadataRepository,
                  fetcher: fetch,
                  signal: abortController.signal,
                },
              )
                .then((metadata) =>
                  metadata ? persistInstrumentName(metadata.name) : undefined,
                )
                .catch(() => undefined)
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
          const [dailyResult, intradayResult] = await Promise.allSettled([
            syncMarketData({
              instrumentId,
              symbol: marketDataSymbol,
              market,
              currency: instrument.currency,
              required: ranges.daily,
              repository,
              fetcher: marketDataFetcher,
              signal: abortController.signal,
              retryUnavailable: true,
            }),
            syncIntradayMarketDataForRanges({
              instrumentId,
              symbol: marketDataSymbol,
              market,
              currency: instrument.currency,
              requiredRanges: intradayRanges.length
                ? intradayRanges
                : [ranges.intraday],
              repository,
              fetcher: marketDataFetcher,
              signal: abortController.signal,
              interval: "1h",
            }),
          ]);
          if (
            (dailyResult.status === "rejected" &&
              isAbortError(dailyResult.reason)) ||
            (intradayResult.status === "rejected" &&
              isAbortError(intradayResult.reason))
          ) {
            return;
          }
          if (dailyResult.status === "fulfilled") {
            next.daily = dailyResult.value.candles;
            next.dailyStatus = dailyResult.value.status;
            next.dailyError = undefined;
            next.dailyMessage =
              dailyResult.value.status === "latest-available"
                ? "尾部仍待补齐，已保留本地行情；可再次更新重试"
                : dailyResult.value.status === "partial"
                ? "日线更新已完成，仍有缺口"
                : dailyResult.value.source === "cache"
                ? "日线已使用本地缓存"
                : `日线已补齐 ${dailyResult.value.requestedRanges.length} 个缺口`;
            try {
              next.dailyCoverage = await repository.getCoverage(
                instrumentId,
              );
            } catch {
              next.dailyStatus = "storage-error";
              next.dailyMessage = "日线已获取但覆盖状态读取失败";
            }
          } else {
            next.dailyStatus = next.daily.length > 0
              ? coverageStatusForDateRange(ranges.daily, next.dailyCoverage)
              : dailyStatusFromError(dailyResult.reason);
            next.dailyError = marketDataErrorDetail(dailyResult.reason);
            next.dailyMessage =
              dailyResult.reason instanceof Error
                ? `日线：${dailyResult.reason.message}`
                : "日线行情更新失败";
          }
          if (intradayResult.status === "fulfilled") {
            next.intraday = intradayResult.value.candles;
            next.intradayCoverage = intradayResult.value.coverage;
            next.intradayStatus = intradayResult.value.status;
            next.intradayError = intradayResult.value.error;
            next.intradayMessage =
              intradayResult.value.error
                ? `1 小时：${intradayResult.value.error.message}`
                : intradayResult.value.source === "cache"
                ? "1 小时行情已使用本地缓存"
                : `1 小时行情已请求 ${intradayResult.value.requestedRanges.length} 个区间`;
          } else {
            next.intradayStatus =
              intradayResult.reason instanceof DOMException
                ? "storage-error"
                : "source-unavailable";
            next.intradayError = marketDataErrorDetail(intradayResult.reason);
            next.intradayMessage =
              intradayResult.reason instanceof Error
                ? `1 小时：${intradayResult.reason.message}`
                : "1 小时行情更新失败";
          }
        }
        await metadataRefresh;
        if (metadataPersistenceFailed) {
          next.dailyStatus = "storage-error";
          next.dailyMessage =
            "证券新名称未能保存，交易库仍保留原名称。";
        }
        if (
          marketDataRequestSequences.current[instrumentId] !==
          requestSequence
        ) {
          return;
        }
        let overallStatus = combinedMarketDataStatus(
          next.dailyStatus,
          next.intradayStatus,
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
              ...(next.dailyError ? { error: next.dailyError } : {}),
            },
            {
              interval: "1h",
              status: next.intradayStatus,
              message: next.intradayMessage,
              ...(next.intradayError ? { error: next.intradayError } : {}),
            },
          ],
        };
        try {
          await storageClient.putMarketDataJob(completedJob);
          marketDataJobsRef.current[instrumentId] = completedJob;
          setMarketDataJobs((current) => ({
            ...current,
            [instrumentId]: completedJob,
          }));
        } catch {
          next.dailyStatus = "storage-error";
          overallStatus = combinedMarketDataStatus(
            next.dailyStatus,
            next.intradayStatus,
          );
          next.dailyMessage = "行情缓存保留，但同步状态写入失败";
        }
        setMarketStates((current) => ({
          ...current,
          [instrumentId]: next,
        }));
        if (
          marketDataAbortControllers.current[instrumentId] ===
          abortController
        ) {
          delete marketDataAbortControllers.current[instrumentId];
        }
        return overallStatus;
      },
      {
        concurrency: Math.min(
          options.batch ? 3 : 2,
          uniqueInstrumentIds.length,
        ),
        onItemSettled: options.batch
          ? ({ completed, result }) => {
              const status =
                result.status === "fulfilled" ? result.value : undefined;
              setMarketDataRefresh((current) => ({
                ...current,
                completed,
                partial:
                  current.partial + (status === "partial" ? 1 : 0),
                failed:
                  current.failed +
                  (result.status === "rejected" ||
                  isHardMarketDataFailure(status)
                    ? 1
                    : 0),
              }));
            }
          : undefined,
      },
    );

    if (options.batch) {
      const failedIds = results.flatMap((result) => {
        if (result.status === "rejected") return [result.item];
        return isHardMarketDataFailure(result.value) ? [result.item] : [];
      });
      setFailedMarketDataIds(failedIds);
      setMarketDataRefresh((current) => ({
        ...current,
        running: false,
        current: undefined,
      }));
    }
  }

  function previewForImport(
    fileName: string,
    enriched: EnrichedImportResult,
    screenshotMetadata?: {
      captureCount: number;
      duplicateTradeCount: number;
      conflictTradeCount: number;
    },
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
    const incompleteReplacement = Boolean(enriched.monthly && (enriched.unresolved.length > 0 || enriched.exclusions.some(exclusion => exclusion.category === "invalid-row")) && currentExecutionSnapshot().some(execution => belongsToMonthlyDocument(execution, enriched.monthly!)));
    const current = currentExecutionSnapshot().filter(execution => !enriched.monthly || !belongsToMonthlyDocument(execution, enriched.monthly));
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
    const enriched = await enrichStatementImport(parsed, { repository: metadataRepository });
    if (requestId !== importRequestSequence.current) return;
    if (parsed.monthly) {
      const current = currentExecutionSnapshot();
      setPendingImportOriginalExecutions(current);
      setPendingImportMergeBase(current.filter(e => !belongsToMonthlyDocument(e, parsed.monthly!)));
    }
    setPendingEnrichedImport(enriched);
    setPendingImport(previewForImport(file.name, enriched));
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
      ? currentExecutionSnapshot().filter(e => !belongsToMonthlyDocument(e, pendingImport.monthly!))
      : pendingImportMergeBase ?? currentExecutions;
    const previousSummaries = new Map(
      buildInstrumentTradeSummaries(currentExecutions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const reconciliation = pendingImport.monthly ? reconcileExecutions(mergeBase, pendingImport.records) : null;
    if (reconciliation?.conflicts.some(c => !monthlyConflictDecisions.has(c.id))) return;
    const resolvedMonthly = reconciliation ? applyReconciliationDecisions(mergeBase, reconciliation, monthlyConflictDecisions) : null;
    const mergedExecutions = applyMonthlyHistoryEvidence(mergeExecutions(
      resolvedMonthly?.currentAfterReplacements ?? mergeBase,
      resolvedMonthly?.incomingToMerge ?? pendingImport.records,
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
  ) {
    setLibraryTarget({
      requestId: ++libraryTargetSequence.current,
      instrumentId,
      episodeId,
      ...(scopeKey ? { scopeKey } : {}),
    });
    setActiveView("library");
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

  function applyCommand(command: DrawingCommand) {
    setDrawingHistory((history) =>
      applyDrawingCommand(history, command),
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
    if (selectedImportedInstrument) {
      const timeline = aggregateVisibleCandles(
        sourceCandlesForTimeframe(selectedMarketState, next), next,
        selectedImportedInstrument.instrument.market, selectedMarketState.intradayInterval,
      );
      const first = timeline.map(candleKnowledgeAt).sort()[0];
      // A coarser period may have no closed bar at the saved intraday cursor.
      if (first && first > effectiveImportedCursor) setImportedCursor(first);
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
    const persisted = await reviewRepository.put(record);
    if (!persisted) return;
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
    <main className="trade-review-app">
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
      <header className="app-header" inert={stockDrawerOpen || Boolean(dataTarget)}>
        <div className="brand">
          <div className="brand-mark">
            <BookOpenCheck size={19} />
          </div>
          <div>
            <strong>TradeReview</strong>
            <span>历史交易复盘</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="主导航">
          <button
            className={activeView === "review" ? "active" : ""}
            aria-current={activeView === "review" ? "page" : undefined}
            onClick={() => setActiveView("review")}
          >
            逐笔复盘
          </button>
          <button
            className={activeView === "library" ? "active" : ""}
            aria-current={activeView === "library" ? "page" : undefined}
            onClick={() => {
              if (timeframe !== "1D" && timeframe !== "1W") {
                setTimeframe("1D");
              }
              setActiveView("library");
            }}
          >
            交易库
          </button>
          <button
            className={activeView === "insights" ? "active" : ""}
            aria-current={activeView === "insights" ? "page" : undefined}
            onClick={() => setActiveView("insights")}
          >
            模式洞察
          </button>
        </nav>
        <div className="header-actions">
          <span className="demo-chip">
            {showDemo && <Sparkles size={13} />}
            {selectedImportedInstrument
              ? selectedEpisode?.executions[0] ? tradingNatureLabel(selectedEpisode.executions[0]) : "本地导入"
              : showDemo
                ? "演示行情"
                : "等待导入"}
          </span>
          <ImportActions {...importActions} compact />
          {activeView === "review" && <button type="button" className="stock-list-trigger" aria-label="打开股票列表" aria-haspopup="dialog" aria-expanded={stockDrawerOpen} onClick={() => setStockDrawerOpen(true)}><Menu size={19} /><span>股票</span></button>}
          <div className="user-avatar">ZL</div>
        </div>
      </header>

      {activeView === "review" && (showDemo || selectedImportedInstrument) && <div className="review-layout-controls" inert={stockDrawerOpen || Boolean(dataTarget)} aria-label="复盘布局">
        <button className="mobile-trades-toggle" aria-expanded={mobileTradesOpen} onClick={() => setMobileTradesOpen(value=>!value)}>{mobileTradesOpen ? "收起本股交易" : "本股交易"}</button>
        <button className="desktop-left-toggle" aria-expanded={layout.left} onClick={() => { setFocusedChart(false); setLayout((value) => ({ ...value, left: !value.left })); }}>{layout.left ? "收起交易导航" : "展开交易导航"}</button>
        <button className="desktop-right-toggle" aria-expanded={layout.right} onClick={() => { setFocusedChart(false); setLayout((value) => ({ ...value, right: !value.right })); }}>{layout.right ? "收起复盘面板" : "展开复盘面板"}</button>
        <button aria-pressed={focusedChart} onClick={toggleFocus}>{focusedChart ? "恢复布局" : "专注图表"}</button>
      </div>}
      {mobileTradesOpen && <button className="stock-drawer-backdrop" aria-label="关闭本股交易遮罩" onClick={() => setMobileTradesOpen(false)} />}
      {importError && <p role="alert" className="navigation-notice">{importError}</p>}
      {importing && <p role="status" className="global-import-status">正在处理导入记录…</p>}
      {storedInstruments.some(instrument => !importedInstruments.some(item=>item.instrument.id===instrument.id)) && <details className="navigation-notice"><summary>查看已无成交股票的保留记录</summary>{storedInstruments.filter(instrument => !importedInstruments.some(item=>item.instrument.id===instrument.id)).map(instrument => <button key={instrument.id} onClick={() => openDataCheck(instrument.id, "")}>{instrument.name}（{instrument.symbol}）数据记录</button>)}</details>}
      {navigationNotice && <p role="alert" className="navigation-notice">{navigationNotice}<button type="button" onClick={() => setNavigationNotice(null)}>关闭提示</button></p>}
      <div
        inert={Boolean(dataTarget)}
        className={`workspace ${activeView === "review" ? `${layout.left ? "" : "layout-left-hidden"} ${layout.right ? "" : "layout-right-hidden"}` : ""} ${!showDemo && importedInstruments.length === 0 && activeView === "review" ? "empty-mode" : ""} ${
          activeView === "library"
            ? "library-mode"
            : activeView === "insights"
              ? "insights-mode"
              : ""
        }`}
      >
        {activeView === "library" ? (
          <TradeLibrary
            key={libraryTarget?.requestId ?? 0}
            initialBrowseState={libraryBrowseState}
            onBrowseStateChange={setLibraryBrowseState}
            entries={tradeLibraryEntries}
            candlesByInstrument={marketDataCandles}
            marketDataStatuses={marketDataStatuses}
            marketDataLabels={marketDataLabels}
            timeframe={timeframe === "1W" ? "1W" : "1D"}
            onTimeframeChange={setTimeframe}
            onOpenInReview={(instrumentId, episodeId) => {
              const summary = importedInstruments.find((item) => item.instrument.id === instrumentId);
              if (!summary || !selectImportedSummary(summary, episodeId)) {
                setNavigationNotice("该交易回合已变化，请返回股票库重新选择。");
                return;
              }
              setNavigationNotice(null);
              setLibraryTarget(undefined);
              setActiveView("review");
            }}
            reviewsHydrated={reviewsHydrated}
            target={libraryTarget}
            onSaveReview={saveEpisodeReview}
            onInspectData={openDataCheck}
            onRefreshMarketData={(instrumentId) => void startMarketDataUpdate([instrumentId], { refreshMetadata: true })}
          />
        ) : activeView === "insights" ? (
          <PatternInsights
            report={insightReport}
            facts={insightFactResult.facts}
            suggestions={
              suggestionsHydrated && reviewsHydrated
                ? tagSuggestions
                : []
            }
            episodeContexts={insightEpisodeContexts}
            onConfirmSuggestion={confirmSuggestion}
            onEditSuggestion={editSuggestion}
            onRejectSuggestion={rejectSuggestion}
            onOpenEpisode={openLibraryEpisode}
          />
        ) : (
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
            {(showDemo || selectedImportedInstrument) && <div className={`stock-context-shell ${mobileTradesOpen ? "mobile-trades-open" : ""}`}><StockEpisodeNavigation mobileOpen={mobileTradesOpen} onCloseMobile={() => setMobileTradesOpen(false)} instrument={selectedImportedInstrument?.instrument} episodes={episodes} selectedEpisodeId={selectedEpisode?.id} cursor={activeCursor} onSelectEpisode={id => { selectEpisode(id); setMobileTradesOpen(false); }} onLocate={(cursor) => { setPlaying(false); setImportedCursor(cursor); setMobileTradesOpen(false); }} onNext={nextImportedExecution} onSwitchStock={() => { setMobileTradesOpen(false); setStockDrawerOpen(true); }} onLibrary={() => { setMobileTradesOpen(false); setActiveView("library"); }} /></div>}
            {!showDemo && !selectedImportedInstrument ? (
              <section
                className="review-workspace review-workspace-empty"
                aria-label="开始交易复盘"
              >
                <BookOpenCheck size={36} />
                <h1>{importedInstruments.length ? "请选择其他股票继续复盘" : "从一笔真实交易开始复盘"}</h1>
                {importedInstruments.length ? <button onClick={() => setStockDrawerOpen(true)}>选择复盘股票</button> : <p>导入成交记录，选择交易回合，逐步回放当时的行情与判断。</p>}
                <ImportActions {...importActions} />
                <p className="import-format-help">支持富途 Excel、Tiger PDF、招商证券 PDF；截图恢复支持已适配的 Tiger / 富途成交列表。</p>
                <small>原文件在浏览器内解析，核对并确认后才会写入交易库。</small>
              </section>
            ) : selectedImportedInstrument && !selectedEpisode ? (
              <section className="review-workspace review-workspace-empty" role="alert">
                <p>原交易回合已变化，请重新选择。</p>
                <button type="button" className="secondary-action" onClick={() => setActiveView("library")}>前往交易库选择回合</button>
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
              onInspectData={selectedImportedInstrument && selectedEpisode ? () => openDataCheck(selectedImportedInstrument.instrument.id, selectedEpisode.accountId) : undefined}
              onEpisodeChange={selectEpisode}
              onTimeframeChange={setReviewTimeframe}
              onSelectInstrument={selectInstrument}
              onRefreshMarketData={() => {
                if (selectedImportedInstrument) {
                  void startMarketDataUpdate([
                    selectedImportedInstrument.instrument.id,
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
              onSaveReview={saveEpisodeReview}
            />
            )}
            </div>
          </>
        )}
      </div>

      {dataTarget && <StockDataDialog instrument={dataTarget.instrument} initialAccountId={dataTarget.accountId} cursor={dataTarget.cursor} executions={importedExecutions.filter(execution => execution.instrument.id === dataTarget.instrument.id)} marketSummary={marketDataStatusLabel(marketDataStatuses[dataTarget.instrument.id] ?? "not-requested")} marketDetails={[
        marketStates[dataTarget.instrument.id]?.dailyMessage ?? "",
        marketStates[dataTarget.instrument.id]?.intradayMessage ?? "",
        `本地日线：${marketStates[dataTarget.instrument.id]?.daily.length ?? 0} 根；小时线：${marketStates[dataTarget.instrument.id]?.intraday.length ?? 0} 根`,
        ...(marketStates[dataTarget.instrument.id]?.dailyCoverage ?? []).map(segment => `日线覆盖：${segment.startDate} 至 ${segment.endDate}，${marketDataStatusLabel(segment.status)}`),
        ...(marketStates[dataTarget.instrument.id]?.intradayCoverage ?? []).map(segment => `小时线覆盖：${segment.actualStart ?? segment.requestedStart} 至 ${segment.actualEnd ?? segment.requestedEnd}，${marketDataStatusLabel(segment.status)}`),
      ]} refreshing={marketDataStatuses[dataTarget.instrument.id] === "syncing"} onRefresh={() => void startMarketDataUpdate([dataTarget.instrument.id], { refreshMetadata: true })} onClose={() => setDataTarget(undefined)} onRevise={reviseCurrentTrades} loadHistory={tradeRepairClient.history} onSupplement={(accountId, kind) => { const scope = { instrumentId: dataTarget.instrument.id, accountId, accountLabel: importedExecutions.find(e=>e.accountId===accountId)?.accountLabel ?? accountId, kind }; supplementScopeRef.current = scope; setSupplementScope(scope); setDataTarget(undefined); if (kind === "file") importFileRef.current?.click(); else importScreenshotRef.current?.click(); }} retainedReviews={[
        ...new Set([...Object.values(episodeReviews).filter(review => review.instrumentId === dataTarget.instrument.id).map(review => review.episodeId), ...Object.keys(reviewStates).filter(id => id.includes(encodeURIComponent(dataTarget.instrument.id)))])
      ].filter(id => !buildTradeEpisodes(importedExecutions).some(episode => episode.id === id)).map(episodeId => ({ episodeId, review: episodeReviews[episodeId], drawingCount: reviewStates[episodeId]?.drawings.length ?? 0, drawings: reviewStates[episodeId]?.drawings }))} />}

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
    </main>
  );
}
