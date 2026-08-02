"use client";

import {
  BookOpenCheck,
  Menu,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
import type { StatementParseResult } from "../lib/import/contracts";
import {
  enrichStatementImport,
  type EnrichedImportResult,
} from "../lib/import/enrich-import";
import { parseBrokerStatement } from "../lib/import/dispatcher";
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
  SupportedMarket,
} from "../lib/market/contracts";
import {
  syncIntradayMarketData,
  type IntradayTimeRange,
} from "../lib/market/intraday-sync-service";
import {
  coverageStatusForSegments,
  type MarketDataSyncStatus,
} from "../lib/market/sync-status";
import {
  hasOpenPosition,
  requiredMarketDataRange,
  requiredRangeExpanded,
} from "../lib/market/sync-range";
import { syncMarketData } from "../lib/market/sync-service";
import { canonicalInstrumentId } from "../lib/instruments/display-name";
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
import { calculatePositionPathMetrics } from "../lib/replay/position-path-metrics";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import {
  createEmptyEpisodeReviewRecord,
  episodePlanAtCursor,
} from "../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import {
  type ChartSettings,
} from "../lib/storage/chart-settings";
import type { ImportHistoryEntry } from "../lib/storage/import-history";
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
  SQLITE_MIGRATION_MARKER_KEY,
} from "../lib/storage/browser-state-migration";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import {
  buildInstrumentTradeSummaries,
  type InstrumentTradeSummary,
} from "../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../lib/trades/library";
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
} from "./review/episode-sidebar";
import {
  TradeLibrary,
  type TradeLibraryTarget,
} from "./library/trade-library";
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
  dailyStatus: MarketDataSyncStatus;
  intradayStatus: MarketDataSyncStatus;
  intradayCoverage: IntervalCoverageSegment[];
  dailyCoverage: CoverageSegment[];
  dailyMessage?: string;
  intradayMessage?: string;
};

type Props = {
  initialFrame: DemoReplayFrame;
  showDemo?: boolean;
  screenshotImportDependencies?: Partial<ScreenshotImportDependencies>;
  /** Injectable only for integration tests; production creates the HTTP client. */
  storageClient?: SqliteHttpClient;
  legacyStateExporter?: () => Promise<import("../lib/storage/sqlite-contracts").BrowserStatePayload | null>;
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
  dailyStatus: MarketDataSyncStatus = "not-requested",
): InstrumentMarketState {
  return {
    daily: [],
    intraday: [],
    dailyStatus,
    intradayStatus: "not-requested",
    intradayCoverage: [],
    dailyCoverage: [],
  };
}

function supportedMarket(value: string) {
  const normalized = value.toUpperCase() as SupportedMarket;
  return SUPPORTED_MARKETS.has(normalized) ? normalized : undefined;
}

function marketRanges(summary: InstrumentTradeSummary) {
  const market = supportedMarket(summary.instrument.market);
  const daily = requiredMarketDataRange(
    summary.firstTradeAt,
    summary.lastTradeAt,
    {
      open: hasOpenPosition(summary.executions),
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

function episodeIntradaySyncRange(
  episode: TradeEpisode,
  market: SupportedMarket,
): IntradayTimeRange {
  const lastExecutionAt = latestIso(
    episode.executions.map((execution) => execution.executedAt),
    episode.startedAt,
  );
  const startTime = intradayContextStart(
    episode.startedAt,
    episode.instrument.market,
  );
  if (episode.status === "closed") {
    return {
      startTime,
      endTime: containingIntradayBarEnd(
        episode.endedAt ?? lastExecutionAt,
      ),
    };
  }
  const latestCompletedSession = requiredMarketDataRange(
    episode.startedAt,
    lastExecutionAt,
    { open: true, market },
  ).endDate;
  return {
    startTime,
    endTime: endOfIsoDate(latestCompletedSession),
  };
}

async function readInstrumentMarketState(
  summary: InstrumentTradeSummary,
  repository: MarketDataRepository,
): Promise<InstrumentMarketState> {
  const ranges = marketRanges(summary);
  const [daily, dailyCoverage, intraday, intradayCoverage] =
    await Promise.all([
      repository.getDailyCandles(
        summary.instrument.id,
        ranges.daily.startDate,
        ranges.daily.endDate,
      ),
      repository.getCoverage(summary.instrument.id),
      repository.getCandles(
        summary.instrument.id,
        "15m",
        ranges.intraday.startTime,
        ranges.intraday.endTime,
      ),
      repository.getIntervalCoverage(summary.instrument.id, "15m"),
    ]);
  return {
    daily,
    intraday,
    dailyStatus: coverageStatusForSegments(dailyCoverage),
    intradayStatus: coverageStatusForSegments(intradayCoverage),
    intradayCoverage,
    dailyCoverage,
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
  return timeframe === "15m" || timeframe === "1h" || timeframe === "4h"
    ? marketState.intraday.map(intervalRecordToCandle)
    : marketState.daily.map(dailyRecordToKnowledgeCandle);
}

function aggregateVisibleCandles(
  source: Candle[],
  timeframe: Timeframe,
  market: string,
) {
  if (timeframe === "15m" || timeframe === "1D") {
    return [...source].sort((left, right) => left.time.localeCompare(right.time));
  }
  return aggregateCandles(source, timeframe, {
    sourceInterval:
      timeframe === "1h" || timeframe === "4h" ? "15m" : "1D",
    market,
  });
}

const INTRADAY_BAR_MILLISECONDS = 15 * 60 * 1000;
const INTRADAY_PRE_ENTRY_CONTEXT_DAYS = 7;

function containingIntradayBarEnd(timestamp: string) {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) return timestamp;
  const barStart =
    Math.floor(milliseconds / INTRADAY_BAR_MILLISECONDS) *
    INTRADAY_BAR_MILLISECONDS;
  return new Date(
    barStart + INTRADAY_BAR_MILLISECONDS - 1,
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
  const dailyRange = requiredMarketDataRange(
    episode.startedAt,
    holdingEnd,
  );
  // Seven calendar days normally provide roughly five completed sessions of
  // chart context without letting unrelated older episodes enable intraday.
  const intradayStart = intradayContextStart(episode.startedAt, market);
  const holdingEndTime = containingIntradayBarEnd(holdingEnd);
  const holdingEndDate = marketTradingDate(holdingEnd, market);

  if (episode.status === "closed") {
    return {
      intradayStart,
      intradayEnd: holdingEndTime,
      dailyStartDate: dailyRange.startDate,
      dailyEndDate: dailyRange.endDate,
    };
  }

  const completeIntradayCoverage = state.intradayCoverage.flatMap(
    (segment) => {
      if (segment.actualEnd) {
        return [containingIntradayBarEnd(segment.actualEnd)];
      }
      return segment.status === "complete"
        ? [containingIntradayBarEnd(segment.requestedEnd)]
        : [];
    },
  );
  const completeDailyCoverage = state.dailyCoverage
    .filter((segment) => segment.status === "complete")
    .map((segment) => segment.endDate);
  const end = latestIso(
    [
      ...state.intraday.map((candle) =>
        containingIntradayBarEnd(candle.timestamp),
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
    dailyStartDate: dailyRange.startDate,
    dailyEndDate: endDate,
  };
}

function coverageOverlapsEpisode(
  segment: IntervalCoverageSegment,
  window: ReturnType<typeof episodeWindow>,
) {
  const start = segment.requestedStart;
  const end = containingIntradayBarEnd(segment.requestedEnd);
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
    });
  }
  const window = episodeWindow(state, episode);
  const intradayCandles = state.intraday.filter(
    (candle) =>
      candle.timestamp <= window.intradayEnd &&
      containingIntradayBarEnd(candle.timestamp) >=
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
  });
  if (
    intradayCandles.length === 0 &&
    intradayCoverage.length === 0 &&
    state.intraday.length > 0
  ) {
    for (const timeframe of ["15m", "1h", "4h"] as const) {
      availability[timeframe] = {
        enabled: false,
        reason: "该交易回合没有可用的 15 分钟行情",
      };
    }
  }
  return availability;
}

function providerLabel(
  provider: DailyCandleRecord["provider"] | undefined,
) {
  if (provider === "tencent") return "腾讯行情";
  if (provider === "eastmoney") return "东方财富";
  if (provider === "yahoo") return "Yahoo Finance";
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
      nativeInterval: "15m",
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
        (availability["15m"].enabled
          ? undefined
          : availability["15m"].reason),
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

function episodeOptions(episodes: TradeEpisode[]): EpisodeOption[] {
  const chronological = new Map(
    [...episodes]
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
      .map((episode, index) => [episode.id, index + 1]),
  );
  return episodes.map((episode) => ({
    id: episode.id,
    label: `第 ${chronological.get(episode.id) ?? 1} 次交易`,
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

  const [activeView, setActiveView] = useState<
    "review" | "library" | "insights"
  >("review");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
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
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(
    null,
  );
  const [pendingParsedImport, setPendingParsedImport] =
    useState<StatementParseResult | null>(null);
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
  const selectedEpisode =
    episodes.find((episode) => episode.id === selectedEpisodeId) ??
    episodes[0];
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
  const activeCursor = selectedImportedInstrument
    ? importedCursor
    : frame.cursor;
  const importedVisibleSource = useMemo(
    () =>
      importedSourceCandles.filter(
        (candle) => candleKnowledgeAt(candle) <= activeCursor,
      ),
    [activeCursor, importedSourceCandles],
  );
  const importedTimelineCandles = useMemo(
    () =>
      selectedImportedInstrument
        ? aggregateVisibleCandles(
            importedSourceCandles,
            timeframe,
            selectedImportedInstrument.instrument.market,
          )
        : [],
    [importedSourceCandles, selectedImportedInstrument, timeframe],
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
    storedCursor: importedCursor,
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
  const marketDataStatuses = useMemo(
    () =>
      Object.fromEntries(
        importedInstruments.map((summary) => [
          summary.instrument.id,
          marketStates[summary.instrument.id]?.dailyStatus ??
            ("not-requested" satisfies MarketDataSyncStatus),
        ]),
      ),
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
    episodeId: activeEpisodeId,
    instrument: activeInstrument,
    timeframe,
    timeframeAvailability: selectedImportedInstrument
      ? importedAvailability
      : ALL_TIMEFRAMES,
    cursor: activeCursor,
    candles: activeSnapshot.candles,
    executions: activeSnapshot.executions,
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
        tradeLibraryEntries,
        marketDataCandles,
        marketDataStatuses,
        suggestionDecisions,
      ),
    [
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
              dateRange: `${new Date(item.episode.startedAt).toLocaleDateString("zh-CN")}—${
                item.episode.endedAt
                  ? new Date(item.episode.endedAt).toLocaleDateString("zh-CN")
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
  ) {
    const stored = reviewStates[episodeId];
    setTimeframe(stored?.timeframe ?? preferredTimeframe);
    setImportedCursor(stored?.replayCursor ?? fallbackCursor);
    setActivePanelTab(stored?.activePanelTab ?? "stats");
    setDrawingHistory(createDrawingHistory(stored?.drawings ?? []));
    setActiveTool("cursor");
    setSelectedDrawingId(null);
    setLayersOpen(false);
    setDrawerOpen(false);
  }

  function selectImportedSummary(summary: InstrumentTradeSummary) {
    const [newest] = sortedEpisodes(summary);
    if (!newest) return;
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
    const preferred = availability["15m"].enabled ? "15m" : "1D";
    const source = sourceCandlesForTimeframe(state, preferred);
    const fallback =
      source.findLast(
        (candle) => candleKnowledgeAt(candle) <= newest.startedAt,
      )
        ? candleKnowledgeAt(
            source.findLast(
              (candle) => candleKnowledgeAt(candle) <= newest.startedAt,
            )!,
          )
        : newest.startedAt;
    restoreEpisodeUi(newest.id, fallback, preferred);
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
    const preferred = availability["15m"].enabled ? "15m" : "1D";
    const source = sourceCandlesForTimeframe(
      selectedMarketState,
      preferred,
    );
    const fallback =
      source.findLast(
        (candle) => candleKnowledgeAt(candle) <= episode.startedAt,
      )
        ? candleKnowledgeAt(
            source.findLast(
              (candle) => candleKnowledgeAt(candle) <= episode.startedAt,
            )!,
          )
        : episode.startedAt;
    restoreEpisodeUi(episode.id, fallback, preferred);
  }

  useEffect(() => {
    let active = true;
    const requestId = ++replayRequestSequence.current;
    const bootstrapWorkspace = async () => {
      try {
        setStorageState("loading");
        setStorageError(null);
        let bootstrap = await storageClient.getBootstrap();
        const migrationMarker = window.localStorage.getItem(
          SQLITE_MIGRATION_MARKER_KEY,
        );
        if (!migrationMarker && !bootstrap.migration) {
          const legacyState = await legacyStateExporter();
          if (legacyState) {
          setStorageState("migration");
          await migrateLegacyBrowserState(storageClient, legacyState);
            bootstrap = await storageClient.getBootstrap();
          }
        }
        if (!active) return;
        const storedSummaries = buildInstrumentTradeSummaries(
          bootstrap.executions,
        );
        const jobs = new Map(
          bootstrap.marketDataJobs.map((job) => [job.instrumentId, job.status]),
        );
        const states = Object.fromEntries(
          bootstrap.reviewStates.map((state) => [state.episodeId, state]),
        );
        const reviews = Object.fromEntries(
          bootstrap.reviews.map((record) => [record.episodeId, record]),
        );
        if (showDemo && !reviews[REVIEW_ID]) {
          reviews[REVIEW_ID] = defaultReviewRecord(
            REVIEW_ID,
            DEMO_INSTRUMENT.id,
            DEFAULT_THESIS,
          );
        }
        importedExecutionsRef.current = bootstrap.executions;
        setImportedExecutions(bootstrap.executions);
        setImportHistory(bootstrap.importHistory);
        setReviewStates(states);
        setEpisodeReviews(reviews);
        setReviewsHydrated(true);
        setSuggestionDecisions(bootstrap.tagSuggestions);
        setSuggestionsHydrated(true);
        setSettings(isChartSettings(bootstrap.settings) ? bootstrap.settings : DEFAULT_CHART_SETTINGS);
        setMarketStates(
          Object.fromEntries(
            storedSummaries.map((summary) => [
              summary.instrument.id,
              emptyMarketState(jobs.get(summary.instrument.id) ?? "not-requested"),
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
          setImportedCursor(stored?.replayCursor ?? newestEpisode.startedAt);
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

  useEffect(() => {
    if (!hydrated || importedInstruments.length === 0) return;
    let active = true;
    const repository = marketDataRepository;
    void Promise.all(
      importedInstruments.map(async (summary) => {
        try {
          return {
            instrumentId: summary.instrument.id,
            state: await readInstrumentMarketState(summary, repository),
          };
        } catch {
          return {
            instrumentId: summary.instrument.id,
            state: {
              ...emptyMarketState("storage-error"),
              intradayStatus: "storage-error" as const,
              dailyMessage: "无法读取本地日线缓存",
              intradayMessage: "无法读取本地 15 分钟缓存",
            },
          };
        }
      }),
    ).then((results) => {
      if (!active) return;
      setMarketStates((current) => ({
        ...current,
        ...Object.fromEntries(
          results.map((result) => [
            result.instrumentId,
            result.state,
          ]),
        ),
      }));
      setHydratedMarketIds(
        (current) =>
          new Set([
            ...current,
            ...results.map((result) => result.instrumentId),
          ]),
      );
      if (!selectedImportedInstrument || !selectedEpisode) return;
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
        (selectedState.intraday.length > 0 ? "15m" : "1D");
      const availableTimeframe = availability[nextTimeframe].enabled
        ? nextTimeframe
        : availability["15m"].enabled
          ? "15m"
          : availability["1D"].enabled
            ? "1D"
            : nextTimeframe;
      setTimeframe(availableTimeframe);
      if (!stored) {
        const source = sourceCandlesForTimeframe(
          selectedState,
          availableTimeframe,
        );
        setImportedCursor(
          source.findLast(
            (candle) =>
              candleKnowledgeAt(candle) <= selectedEpisode.startedAt,
          )
            ? candleKnowledgeAt(
                source.findLast(
                  (candle) =>
                    candleKnowledgeAt(candle) <= selectedEpisode.startedAt,
                )!,
              )
            : selectedEpisode.startedAt,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [
    hydrated,
    importedInstruments,
    marketDataRepository,
    reviewStates,
    selectedEpisode,
    selectedImportedInstrument,
  ]);

  useEffect(() => {
    if (!hydrated || restoring || !activeEpisodeId) return;
    const state: EpisodeReviewState = {
      version: 2,
      episodeId: activeEpisodeId,
      replayCursor: activeCursor,
      timeframe,
      activePanelTab,
      drawings: drawingHistory.present,
    };
    void storageClient.putReviewState(state)
      .then(() => setReviewStates((current) => ({ ...current, [activeEpisodeId]: state })))
      .catch(() => setImportError("复盘状态未能保存到 SQLite，请稍后重试。"));
  }, [
    activeCursor,
    activeEpisodeId,
    activePanelTab,
    drawingHistory.present,
    hydrated,
    restoring,
    storageClient,
    timeframe,
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
            (candle) => candleKnowledgeAt(candle) > importedCursor,
          )
            ? candleKnowledgeAt(
                importedTimelineCandles.find(
                  (candle) => candleKnowledgeAt(candle) > importedCursor,
                )!,
              )
            : importedCursor;
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
    importedCursor,
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
      episodeIdsByInstrument?: Readonly<Record<string, string>>;
    } = {},
  ) {
    if (instrumentIds.length === 0) return;
    const executions = options.executions ?? importedExecutions;
    const episodeIdsByInstrument =
      options.episodeIdsByInstrument ?? {};
    const summariesById = new Map(
      buildInstrumentTradeSummaries(executions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );

    await Promise.all(
      instrumentIds.map(async (instrumentId) => {
        const summary = summariesById.get(instrumentId);
        if (!summary) return;
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
            intradayMessage: "无法读取本地 15 分钟缓存",
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
          },
        }));

        const { instrument } = summary;
        const market = supportedMarket(instrument.market);
        const ranges = marketRanges(summary);
        const summaryEpisodes = sortedEpisodes(summary);
        const requestedEpisodeId =
          episodeIdsByInstrument[instrumentId] ??
          (instrumentId === selectedInstrumentId
            ? selectedEpisodeId
            : undefined);
        const requestedEpisode =
          summaryEpisodes.find(
            (episode) => episode.id === requestedEpisodeId,
          ) ?? summaryEpisodes[0];
        const requestedAt = new Date().toISOString();
        try {
          await storageClient.putMarketDataJob({
            instrumentId,
            symbol: instrument.symbol,
            market: instrument.market,
            requestedAt,
            status: "syncing",
            intervals: [{ interval: "1D", status: "syncing" }],
          });
        } catch {
          cached = {
            ...cached,
            dailyStatus: "storage-error",
            dailyMessage: "无法记录本地行情更新状态",
          };
        }
        let metadataPersistenceFailed = false;
        const metadataRefresh =
          options.refreshMetadata && market
            ? refreshInstrumentMetadata(
                {
                  market,
                  symbol: instrument.symbol,
                },
                {
                  repository:
                    metadataRepository,
                  fetcher: fetch,
                  signal: abortController.signal,
                },
              )
                .then(async (metadata) => {
                  if (
                    !metadata ||
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
                            name: metadata.name,
                          },
                        }
                      : execution,
                  );
                  try {
                    await storageClient.mergeExecutions({
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
                })
                .catch(() => undefined)
            : Promise.resolve();
        let next = { ...cached };
        if (!market) {
          next = {
            ...next,
            dailyStatus: "source-unavailable",
            intradayStatus: "source-unavailable",
            dailyMessage: `暂不支持 ${instrument.market} 市场日线行情`,
            intradayMessage: `暂不支持 ${instrument.market} 市场 15 分钟行情`,
          };
        } else {
          const [dailyResult, intradayResult] = await Promise.allSettled([
            syncMarketData({
              instrumentId,
              symbol: instrument.symbol,
              market,
              currency: instrument.currency,
              required: ranges.daily,
              repository,
              fetcher: fetch,
              signal: abortController.signal,
            }),
            syncIntradayMarketData({
              instrumentId,
              symbol: instrument.symbol,
              market,
              currency: instrument.currency,
              required: requestedEpisode
                ? episodeIntradaySyncRange(requestedEpisode, market)
                : ranges.intraday,
              repository,
              fetcher: fetch,
              signal: abortController.signal,
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
            next.dailyMessage =
              dailyResult.value.source === "cache"
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
            next.dailyStatus =
              dailyResult.reason instanceof DOMException
                ? "storage-error"
                : "source-unavailable";
            next.dailyMessage =
              dailyResult.reason instanceof Error
                ? `日线：${dailyResult.reason.message}`
                : "日线行情更新失败";
          }
          if (intradayResult.status === "fulfilled") {
            next.intraday = intradayResult.value.candles;
            next.intradayCoverage = intradayResult.value.coverage;
            next.intradayStatus = intradayResult.value.status;
            next.intradayMessage =
              intradayResult.value.source === "cache"
                ? "15 分钟行情已使用本地缓存"
                : `15 分钟行情已请求 ${intradayResult.value.requestedRanges.length} 个区间`;
          } else {
            next.intradayStatus =
              intradayResult.reason instanceof DOMException
                ? "storage-error"
                : "source-unavailable";
            next.intradayMessage =
              intradayResult.reason instanceof Error
                ? `15 分钟：${intradayResult.reason.message}`
                : "15 分钟行情更新失败";
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
        try {
          await storageClient.putMarketDataJob({
            instrumentId,
            symbol: instrument.symbol,
            market: instrument.market,
            requestedAt,
            status: next.dailyStatus,
            message: [next.dailyMessage, next.intradayMessage]
              .filter(Boolean)
              .join("；"),
            intervals: [{
              interval: "1D",
              status: next.dailyStatus,
              message: [next.dailyMessage, next.intradayMessage]
                .filter(Boolean)
                .join("；") || undefined,
            }],
          });
        } catch {
          next.dailyStatus = "storage-error";
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
      }),
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
    const current = currentExecutionSnapshot();
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
      duplicateTradeCount:
        basePreview.duplicateTradeCount + libraryDuplicateCount,
    };
  }

  async function prepareScreenshotImport(
    prepared: PreparedScreenshotImport,
  ) {
    const requestId = ++importRequestSequence.current;
    const originalExecutions = currentExecutionSnapshot();
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

  async function parseImport(file: File) {
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
    try {
      await Promise.resolve();
      setImportPhase("parsing");
      const parsed = await parseBrokerStatement(file);
      if (requestId !== importRequestSequence.current) return;
      if (parsed.broker === "unknown" || parsed.blocked) {
        const message = parsed.diagnostics.find(
          (diagnostic) => diagnostic.severity === "error",
        )?.message;
        throw new Error(message ?? "暂时无法识别这个交易记录");
      }
      setPendingParsedImport(parsed);
      setImportPhase("classifying");
      await Promise.resolve();
      setImportPhase("resolving");
      const enriched = await enrichStatementImport(parsed, {
        repository: metadataRepository,
      });
      if (requestId !== importRequestSequence.current) return;
      const preview = previewForImport(file.name, enriched);
      setPendingEnrichedImport(enriched);
      setPendingImport(preview);
      setImportPhase("ready");
    } catch (error) {
      if (requestId !== importRequestSequence.current) return;
      setImportError(
        error instanceof Error
          ? error.message
          : "暂时无法识别这个文件。请确认它来自富途、Tiger 或招商证券。",
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
    if (!pendingImport || pendingImport.blocked || retryingUnresolved) {
      return;
    }
    importRequestSequence.current += 1;
    const currentExecutions =
      pendingImportOriginalExecutions ?? currentExecutionSnapshot();
    const mergeBase = pendingImportMergeBase ?? currentExecutions;
    const previousSummaries = new Map(
      buildInstrumentTradeSummaries(currentExecutions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const mergedExecutions = mergeExecutions(
      mergeBase,
      pendingImport.records,
    );
    const summaries = buildInstrumentTradeSummaries(mergedExecutions);
    const importedAt = new Date().toISOString();
    const historyEntry: ImportHistoryEntry = {
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
      ...(pendingImport.sourceKind === "screenshot"
        ? {
            sourceKind: "screenshot" as const,
            captureCount: pendingImport.captureCount ?? 0,
            conflictTradeCount: pendingImport.conflictTradeCount ?? 0,
          }
        : {}),
      unresolvedInstrumentCount:
        pendingImport.unresolvedInstrumentCount,
    };
    try {
      await storageClient.mergeExecutions({
        executions: mergedExecutions,
        instruments: summaries.map(({ instrument }) => instrument),
        importHistory: [historyEntry],
      });
    } catch {
      setImportError(
        "SQLite 未能保存这次导入，请检查服务状态后重试。",
      );
      setPendingImport(null);
      setPendingImportOriginalExecutions(null);
      setPendingImportMergeBase(null);
      setPendingScreenshotDecisions(null);
      return;
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
    const automaticSyncIds = summaries
      .filter((summary) => importedIds.includes(summary.instrument.id))
      .filter((summary) => {
        const previous = previousSummaries.get(summary.instrument.id);
        const market = supportedMarket(summary.instrument.market);
        const range = requiredMarketDataRange(
          summary.firstTradeAt,
          summary.lastTradeAt,
          {
            open: hasOpenPosition(summary.executions),
            market,
          },
        );
        const previousRange = previous
          ? requiredMarketDataRange(
              previous.firstTradeAt,
              previous.lastTradeAt,
              {
                open: hasOpenPosition(previous.executions),
                market,
              },
            )
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
    const automaticEpisodeIds = Object.fromEntries(
      summaries.flatMap((summary) => {
        if (!automaticSyncIds.includes(summary.instrument.id)) return [];
        const newestEpisode = sortedEpisodes(summary)[0];
        return newestEpisode
          ? [[summary.instrument.id, newestEpisode.id]]
          : [];
      }),
    );
    if (firstImported) selectImportedSummary(firstImported);
    void startMarketDataUpdate(automaticSyncIds, {
      executions: mergedExecutions,
      episodeIdsByInstrument: automaticEpisodeIds,
    });
    setPendingImport(null);
    setPendingParsedImport(null);
    setPendingEnrichedImport(null);
    setPendingImportOriginalExecutions(null);
    setPendingImportMergeBase(null);
    setPendingScreenshotDecisions(null);
    setImportPhase("idle");
  }

  function openLibraryEpisode(instrumentId: string, episodeId: string) {
    setLibraryTarget({
      requestId: ++libraryTargetSequence.current,
      instrumentId,
      episodeId,
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
    await suggestionRepository.put(decided);
    const persistedReview = await reviewRepository.put(review);
    if (!persistedReview) {
      throw new Error("确认建议时未写入复盘记录");
    }
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
    setTimeframe(next);
    setSelectedDrawingId(null);
  }

  function previousImported() {
    const exact = importedReplay.currentCursor === importedCursor;
    const previous = exact
      ? importedReplay.previous()
      : importedTimelineCandles.findLast(
          (candle) => candleKnowledgeAt(candle) < importedCursor,
        )
        ? candleKnowledgeAt(
            importedTimelineCandles.findLast(
              (candle) => candleKnowledgeAt(candle) < importedCursor,
            )!,
          )
        : undefined;
    if (previous) setImportedCursor(previous);
  }

  function nextImported() {
    const exact = importedReplay.currentCursor === importedCursor;
    const next = exact
      ? importedReplay.next()
      : importedTimelineCandles.find(
          (candle) => candleKnowledgeAt(candle) > importedCursor,
        )
        ? candleKnowledgeAt(
            importedTimelineCandles.find(
              (candle) => candleKnowledgeAt(candle) > importedCursor,
            )!,
          )
        : undefined;
    if (next) setImportedCursor(next);
  }

  function nextImportedExecution() {
    const fromReplay = importedReplay.nextExecution();
    const next =
      fromReplay > importedCursor
        ? fromReplay
        : selectedEpisode?.executions.find(
            (execution) => execution.executedAt > importedCursor,
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
      <header className="app-header">
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
              ? "本地导入"
              : showDemo
                ? "演示行情"
                : "等待导入"}
          </span>
          <button className="icon-button mobile-menu" aria-label="打开菜单">
            <Menu size={19} />
          </button>
          <div className="user-avatar">ZL</div>
        </div>
      </header>

      <div
        className={`workspace ${
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
            entries={tradeLibraryEntries}
            candlesByInstrument={marketDataCandles}
            marketDataStatuses={marketDataStatuses}
            timeframe={timeframe === "1W" ? "1W" : "1D"}
            onTimeframeChange={setTimeframe}
            onOpenInReview={(instrumentId) => {
              selectInstrument(instrumentId);
              setActiveView("review");
            }}
            reviewsHydrated={reviewsHydrated}
            target={libraryTarget}
            onSaveReview={saveEpisodeReview}
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
            <EpisodeSidebar
              importedInstruments={importedInstruments}
              showDemo={showDemo}
              importing={importing}
              importPhase={importPhase}
              importError={importError}
              onImport={parseImport}
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
              onSelectInstrument={selectInstrument}
              marketDataStatuses={marketDataStatuses}
              onUpdateMarketData={(instrumentId) =>
                void startMarketDataUpdate([instrumentId], {
                  refreshMetadata: true,
                })
              }
            />
            {!showDemo && !selectedImportedInstrument ? (
              <section
                className="review-workspace review-workspace-empty"
                aria-label="交易复盘图表工作区"
              >
                <strong>暂无导入交易</strong>
                <span>请先从左侧导入交易记录，再开始复盘。</span>
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
                  ? episodeOptions(episodes)
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
              onSpeedChange={setSpeed}
              onActivePanelTabChange={setActivePanelTab}
              onDrawerOpenChange={setDrawerOpen}
              onSaveReview={saveEpisodeReview}
            />
            )}
          </>
        )}
      </div>

      {pendingImport && (
        <ImportConfirmDialog
          preview={pendingImport}
          onCancel={() => {
            importRequestSequence.current += 1;
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
      {screenshotImport.open &&
        !screenshotImport.completing &&
        screenshotImport.state && (
        <ScreenshotReviewDialog
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
