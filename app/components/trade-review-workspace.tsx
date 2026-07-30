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
import { parseFutuWorkbook } from "../lib/import/futu";
import {
  createImportPreview,
  type ImportPreview,
} from "../lib/import/import-preview";
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
import { episodePlanAtCursor } from "../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import {
  loadChartSettings,
  saveChartSettings,
  type ChartSettings,
} from "../lib/storage/chart-settings";
import { IndexedDbEpisodeReviewRepository } from "../lib/storage/indexeddb-episode-review-repository";
import { IndexedDbMarketDataRepository } from "../lib/storage/indexeddb-market-data-repository";
import {
  loadImportHistory,
  type ImportHistoryEntry,
} from "../lib/storage/import-history";
import {
  loadImportedExecutions,
  mergeExecutions,
} from "../lib/storage/import-library";
import { persistImportBatch } from "../lib/storage/import-transaction";
import {
  loadMarketDataJobs,
  saveMarketDataJob,
} from "../lib/storage/market-data-jobs";
import {
  loadReviewState,
  saveReviewState,
} from "../lib/storage/review-storage";
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
import { TradeLibrary } from "./library/trade-library";
import { EpisodeSidebar } from "./review/episode-sidebar";
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
};

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
  repository: IndexedDbMarketDataRepository,
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function TradeReviewWorkspace({ initialFrame }: Props) {
  const [activeView, setActiveView] = useState<"review" | "library">(
    "review",
  );
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
  const [settings, setSettings] = useState<ChartSettings>(() =>
    loadChartSettings(),
  );
  const [importedExecutions, setImportedExecutions] = useState<
    TradeExecution[]
  >([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("demo");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(REVIEW_ID);
  const [importedCursor, setImportedCursor] = useState(initialFrame.cursor);
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(
    null,
  );
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
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const replayRequestSequence = useRef(0);
  const marketDataRequestSequences = useRef<Record<string, number>>({});
  const marketDataAbortControllers = useRef<
    Record<string, AbortController>
  >({});
  const legacyDemoThesis = useRef(DEFAULT_THESIS);

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
        {
          id: "demo",
          name: DEMO_INSTRUMENT.name,
          symbol: DEMO_INSTRUMENT.symbol,
          market: DEMO_INSTRUMENT.market,
        },
        ...importedInstruments.map(({ instrument }) => ({
          id: instrument.id,
          name: instrument.name,
          symbol: instrument.symbol,
          market: instrument.market,
        })),
      ],
    [importedInstruments],
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
    const stored = loadReviewState(episodeId);
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
      setPlaying(false);
      setSelectedInstrumentId("demo");
      setSelectedEpisodeId(REVIEW_ID);
      const stored = loadReviewState(REVIEW_ID);
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
    const animationFrame = window.requestAnimationFrame(() => {
      const requestId = ++replayRequestSequence.current;
      const storedExecutions = loadImportedExecutions();
      const storedSummaries =
        buildInstrumentTradeSummaries(storedExecutions);
      const jobs = new Map(
        loadMarketDataJobs().map((job) => [job.instrumentId, job.status]),
      );
      setImportedExecutions(storedExecutions);
      setImportHistory(loadImportHistory());
      setMarketStates(
        Object.fromEntries(
          storedSummaries.map((summary) => [
            summary.instrument.id,
            emptyMarketState(
              jobs.get(summary.instrument.id) ?? "not-requested",
            ),
          ]),
        ),
      );

      const firstSummary = storedSummaries[0];
      const newestEpisode = sortedEpisodes(firstSummary)[0];
      const storedDemo = loadReviewState(REVIEW_ID);
      legacyDemoThesis.current =
        storedDemo?.legacyThesis || DEFAULT_THESIS;
      if (firstSummary && newestEpisode) {
        setSelectedInstrumentId(firstSummary.instrument.id);
        setSelectedEpisodeId(newestEpisode.id);
        const stored = loadReviewState(newestEpisode.id);
        setTimeframe(stored?.timeframe ?? "15m");
        setImportedCursor(
          stored?.replayCursor ?? newestEpisode.startedAt,
        );
        setActivePanelTab(stored?.activePanelTab ?? "stats");
        setDrawingHistory(
          createDrawingHistory(stored?.drawings ?? []),
        );
      } else if (storedDemo) {
        setTimeframe(storedDemo.timeframe);
        setActivePanelTab(storedDemo.activePanelTab);
        setDrawingHistory(createDrawingHistory(storedDemo.drawings));
      }

      const restore = async () => {
        try {
          if (
            storedDemo &&
            storedDemo.replayCursor !== initialFrame.cursor
          ) {
            const restoredFrame = await fetchDemoFrame(
              "restore",
              storedDemo.replayCursor,
            );
            if (requestId === replayRequestSequence.current) {
              setFrame(restoredFrame);
            }
          }
        } catch {
          if (requestId === replayRequestSequence.current) {
            setReplayError(
              "上次回放位置无法恢复，已从安全起点开始。",
            );
          }
        } finally {
          if (requestId === replayRequestSequence.current) {
            setRestoring(false);
            setHydrated(true);
          }
        }
      };
      void restore();
    });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      replayRequestSequence.current += 1;
    };
  }, [initialFrame.cursor]);

  useEffect(() => {
    if (!hydrated || importedInstruments.length === 0) return;
    let active = true;
    const repository = new IndexedDbMarketDataRepository();
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
      const stored = loadReviewState(selectedEpisode.id);
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
    selectedEpisode,
    selectedImportedInstrument,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void new IndexedDbEpisodeReviewRepository()
      .getAll()
      .then((records) => {
        if (!active) return;
        const reviews = Object.fromEntries(
          records.map((record) => [record.episodeId, record]),
        );
        if (!reviews[REVIEW_ID]) {
          reviews[REVIEW_ID] = defaultReviewRecord(
            REVIEW_ID,
            DEMO_INSTRUMENT.id,
            legacyDemoThesis.current,
          );
        }
        setEpisodeReviews(reviews);
      })
      .catch(() => {
        if (active) {
          setEpisodeReviews({
            [REVIEW_ID]: defaultReviewRecord(
              REVIEW_ID,
              DEMO_INSTRUMENT.id,
              legacyDemoThesis.current,
            ),
          });
        }
      })
      .finally(() => {
        if (active) setReviewsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || restoring || !activeEpisodeId) return;
    saveReviewState(activeEpisodeId, {
      version: 2,
      episodeId: activeEpisodeId,
      replayCursor: activeCursor,
      timeframe,
      activePanelTab,
      drawings: drawingHistory.present,
    });
  }, [
    activeCursor,
    activeEpisodeId,
    activePanelTab,
    drawingHistory.present,
    hydrated,
    restoring,
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
    episodeIdsByInstrument: Readonly<Record<string, string>> = {},
  ) {
    if (instrumentIds.length === 0) return;
    const summariesById = new Map(
      buildInstrumentTradeSummaries([
        ...importedExecutions,
        ...(pendingImport?.records ?? []),
      ]).map((item) => [item.instrument.id, item]),
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
        const repository = new IndexedDbMarketDataRepository();
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
          saveMarketDataJob({
            instrumentId,
            symbol: instrument.symbol,
            market: instrument.market,
            requestedAt,
            status: "syncing",
          });
        } catch {
          cached = {
            ...cached,
            dailyStatus: "storage-error",
            dailyMessage: "无法记录本地行情更新状态",
          };
        }

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

        if (
          marketDataRequestSequences.current[instrumentId] !==
          requestSequence
        ) {
          return;
        }
        try {
          saveMarketDataJob({
            instrumentId,
            symbol: instrument.symbol,
            market: instrument.market,
            requestedAt,
            status: next.dailyStatus,
            message: [next.dailyMessage, next.intradayMessage]
              .filter(Boolean)
              .join("；"),
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

  async function parseImport(file: File) {
    setImporting(true);
    setImportError(null);
    try {
      const result = parseFutuWorkbook(await file.arrayBuffer(), {
        fileName: file.name,
        sourceTimezone: "Asia/Shanghai",
      });
      setPendingImport(createImportPreview(file.name, result));
    } catch {
      setImportError(
        "暂时无法识别这个文件。请确认它是已适配券商导出的 XLSX 交易记录。",
      );
    } finally {
      setImporting(false);
    }
  }

  function confirmImport() {
    if (!pendingImport || pendingImport.blocked) return;
    const previousSummaries = new Map(
      buildInstrumentTradeSummaries(importedExecutions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    const mergedExecutions = mergeExecutions(
      importedExecutions,
      pendingImport.records,
    );
    const summaries = buildInstrumentTradeSummaries(mergedExecutions);
    const importedAt = new Date().toISOString();
    const historyEntry: ImportHistoryEntry = {
      id: pendingImport.id,
      fileName: pendingImport.fileName,
      importedAt,
      firstTradeAt: pendingImport.firstTradeAt,
      lastTradeAt: pendingImport.lastTradeAt,
      tradeCount: pendingImport.tradeCount,
      instrumentCount: pendingImport.instrumentCount,
      excludedInstrumentCount: pendingImport.excludedInstrumentCount,
    };
    try {
      persistImportBatch(
        importedExecutions,
        mergedExecutions,
        historyEntry,
      );
    } catch {
      setImportError(
        "浏览器未能保存这次导入，请检查隐私模式或本地存储空间后重试。",
      );
      setPendingImport(null);
      return;
    }
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
        return requiredRangeExpanded(previousRange, range);
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
    void startMarketDataUpdate(automaticSyncIds, automaticEpisodeIds);
    setPendingImport(null);
  }

  function renamePendingInstrument(instrumentId: string, name: string) {
    const normalizedName = name.trim() || "名称待行情源补充";
    setPendingImport((current) =>
      current
        ? {
            ...current,
            records: current.records.map((record) =>
              record.instrument.id === instrumentId
                ? {
                    ...record,
                    instrument: {
                      ...record.instrument,
                      name: normalizedName,
                    },
                  }
                : record,
            ),
            instruments: current.instruments.map((item) =>
              item.instrument.id === instrumentId
                ? {
                    ...item,
                    instrument: {
                      ...item.instrument,
                      name: normalizedName,
                    },
                    executions: item.executions.map((execution) => ({
                      ...execution,
                      instrument: {
                        ...execution.instrument,
                        name: normalizedName,
                      },
                    })),
                  }
                : item,
            ),
          }
        : null,
    );
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
    const persisted =
      await new IndexedDbEpisodeReviewRepository().put(record);
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
            disabled
            aria-label="模式洞察（下一阶段）"
            title="规则统计与模式洞察将在下一阶段开放"
          >
            模式洞察
          </button>
        </nav>
        <div className="header-actions">
          <span className="demo-chip">
            <Sparkles size={13} />
            {selectedImportedInstrument ? "本地导入" : "演示行情"}
          </span>
          <button className="icon-button mobile-menu" aria-label="打开菜单">
            <Menu size={19} />
          </button>
          <div className="user-avatar">ZL</div>
        </div>
      </header>

      <div
        className={`workspace ${activeView === "library" ? "library-mode" : ""}`}
      >
        {activeView === "library" ? (
          <TradeLibrary
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
            onSaveReview={saveEpisodeReview}
          />
        ) : (
          <>
            <EpisodeSidebar
              importedInstruments={importedInstruments}
              importing={importing}
              importError={importError}
              onImport={parseImport}
              onOpenHistory={() => setShowImportHistory(true)}
              revealedDemoExecutions={demoSnapshot.executions}
              selectedInstrumentId={selectedInstrumentId}
              onSelectInstrument={selectInstrument}
              marketDataStatuses={marketDataStatuses}
              onUpdateMarketData={(instrumentId) =>
                void startMarketDataUpdate([instrumentId])
              }
            />
            {selectedImportedInstrument &&
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
                  ]);
                } else {
                  void requestFrame("restore", frame.cursor);
                }
              }}
              onToggleLayers={() => setLayersOpen((open) => !open)}
              onSettingsChange={(next) => {
                setSettings(next);
                saveChartSettings(next);
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
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
          onRenameInstrument={renamePendingInstrument}
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
