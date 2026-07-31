"use client";

import {
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  Menu,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import Decimal from "decimal.js";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Drawing, DrawingTool } from "../lib/chart/drawings";
import {
  clampDrawingToCursor,
  visibleDrawingsAtCursor,
} from "../lib/chart/drawings";
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
import { applyReconciliationDecisions } from "../lib/import/execution-reconciliation";
import {
  createImportPreview,
  type ImportPreview,
} from "../lib/import/import-preview";
import { buildInsightEpisodeFacts } from "../lib/insights/episode-facts";
import { buildPatternInsightReport } from "../lib/insights/insight-engine";
import { buildTagSuggestions } from "../lib/insights/tag-suggestions";
import type { TagSuggestionRecord } from "../lib/insights/types";
import { aggregateCandles } from "../lib/market/aggregate";
import type {
  DailyCandleRecord,
  SupportedMarket,
} from "../lib/market/contracts";
import { buildTradeLibraryEntries } from "../lib/trades/library";
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
import type { Timeframe } from "../lib/market/types";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import { formatReplayCursor } from "../lib/replay/format-time";
import {
  loadReviewState,
  saveReviewState,
} from "../lib/storage/review-storage";
import { IndexedDbEpisodeReviewRepository } from "../lib/storage/indexeddb-episode-review-repository";
import { IndexedDbTagSuggestionRepository } from "../lib/storage/indexeddb-tag-suggestion-repository";
import { persistSuggestionDecision } from "../lib/storage/indexeddb-suggestion-decision";
import { createEmptyEpisodeReviewRecord } from "../lib/reviews/review-metrics";
import type { EpisodeReviewRecord } from "../lib/reviews/types";
import {
  loadImportedExecutions,
  mergeExecutions,
  saveImportedExecutions,
} from "../lib/storage/import-library";
import {
  loadImportHistory,
  type ImportHistoryEntry,
} from "../lib/storage/import-history";
import { persistImportBatch } from "../lib/storage/import-transaction";
import {
  loadMarketDataJobs,
  saveMarketDataJob,
} from "../lib/storage/market-data-jobs";
import { IndexedDbMarketDataRepository } from "../lib/storage/indexeddb-market-data-repository";
import { IndexedDbInstrumentMetadataRepository } from "../lib/storage/indexeddb-instrument-metadata-repository";
import { buildInstrumentTradeSummaries } from "../lib/trades/instruments";
import type { TradeExecution } from "../lib/trades/types";
import { ChartToolbar } from "./chart/chart-toolbar";
import { DrawingToolbar } from "./chart/drawing-toolbar";
import { ImportConfirmDialog } from "./import/import-confirm-dialog";
import { ImportHistoryDialog } from "./import/import-history-dialog";
import { ScreenshotReviewDialog } from "./import/screenshot-review-dialog";
import {
  useScreenshotImport,
  type PreparedScreenshotImport,
  type ScreenshotImportDependencies,
} from "./import/use-screenshot-import";
import { ReplayChart } from "./chart/replay-chart";
import { ReplayControls } from "./replay/replay-controls";
import {
  EpisodeSidebar,
  type ImportPhase,
} from "./review/episode-sidebar";
import { ImportedEpisodeReview } from "./review/imported-episode-review";
import { ThesisPanel } from "./review/thesis-panel";
import {
  TradeLibrary,
  type TradeLibraryTarget,
} from "./library/trade-library";
import { PatternInsights } from "./insights/pattern-insights";

const REVIEW_ID = "demo-xpev-2025";
const DEFAULT_THESIS =
  "宽通道上升后的第一次深度回撤。等待重新站上短期高点，确认买盘跟随后分批进入；如果跌破前低则逻辑失效。";
const SUPPORTED_MARKETS = new Set<SupportedMarket>([
  "US",
  "HK",
  "CN-SH",
  "CN-SZ",
]);

function money(value: string, currency = "USD") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

type Props = {
  initialFrame: DemoReplayFrame;
  screenshotImportDependencies?: Partial<ScreenshotImportDependencies>;
};

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
  screenshotImportDependencies,
}: Props) {
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
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingHistory, setDrawingHistory] = useState<Drawing[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Drawing[][]>([]);
  const [thesis, setThesis] = useState(DEFAULT_THESIS);
  const [importedExecutions, setImportedExecutions] = useState<
    TradeExecution[]
  >([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("demo");
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
  const [importError, setImportError] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(
    [],
  );
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [marketDataStatuses, setMarketDataStatuses] = useState<
    Record<string, MarketDataSyncStatus>
  >({});
  const [marketDataCandles, setMarketDataCandles] = useState<
    Record<string, DailyCandleRecord[]>
  >({});
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
    if (importedExecutionsRef.current === null) {
      importedExecutionsRef.current = loadImportedExecutions();
    }
    return importedExecutionsRef.current;
  }

  const screenshotImport = useScreenshotImport({
    currentExecutions: currentExecutionSnapshot,
    onPrepared: prepareScreenshotImport,
    dependencies: screenshotImportDependencies,
  });

  const cursor = frame.cursor;
  const chartCandles = useMemo(
    () => aggregateCandles(frame.candles15m, timeframe),
    [frame.candles15m, timeframe],
  );
  const snapshot = useMemo(
    () =>
      createReplaySnapshot({
        candles: chartCandles,
        executions: frame.executions,
        cursor,
      }),
    [chartCandles, cursor, frame.executions],
  );
  const visibleDrawings = useMemo(
    () => visibleDrawingsAtCursor(drawings, cursor, timeframe),
    [cursor, drawings, timeframe],
  );
  const allDrawingsLocked =
    drawings.length > 0 && drawings.every((drawing) => drawing.locked);
  const importedInstruments = useMemo(
    () => buildInstrumentTradeSummaries(importedExecutions),
    [importedExecutions],
  );
  const selectedImportedInstrument = importedInstruments.find(
    (item) => item.instrument.id === selectedInstrumentId,
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
    requestedCursor = cursor,
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requestId = ++replayRequestSequence.current;
      const stored = loadReviewState(REVIEW_ID);
      const storedExecutions = loadImportedExecutions();
      importedExecutionsRef.current = storedExecutions;
      const storedInstrumentSummaries =
        buildInstrumentTradeSummaries(storedExecutions);
      setImportedExecutions(storedExecutions);
      if (storedInstrumentSummaries[0]) {
        setSelectedInstrumentId(
          storedInstrumentSummaries[0].instrument.id,
        );
      }
      setImportHistory(loadImportHistory());
      const storedMarketDataJobs = loadMarketDataJobs();
      const storedMarketDataStatuses = new Map(
        storedMarketDataJobs.map((job) => [job.instrumentId, job.status]),
      );
      setMarketDataStatuses(
        Object.fromEntries(
          storedInstrumentSummaries.map((item) => [
            item.instrument.id,
            storedMarketDataStatuses.get(item.instrument.id) ??
              ("not-requested" satisfies MarketDataSyncStatus),
          ]),
        ),
      );
      if (stored) {
        setTimeframe(
          storedInstrumentSummaries.length > 0
            ? "1D"
            : stored.timeframe,
        );
        setThesis(stored.thesis);
        setDrawings(stored.drawings);
      }

      const restore = async () => {
        try {
          if (stored && stored.replayCursor !== initialFrame.cursor) {
            const restoredFrame = await fetchDemoFrame(
              "restore",
              stored.replayCursor,
            );
            if (requestId === replayRequestSequence.current) {
              setFrame(restoredFrame);
            }
          }
        } catch {
          if (requestId === replayRequestSequence.current) {
              setReplayError("上次回放位置无法恢复，已从安全起点开始。");
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
      window.cancelAnimationFrame(frame);
      replayRequestSequence.current += 1;
    };
  }, [initialFrame.cursor]);

  useEffect(() => {
    if (!hydrated || importedInstruments.length === 0) return;
    let active = true;
    const repository = new IndexedDbMarketDataRepository();
    void Promise.all(
      importedInstruments.map(async (summary) => {
        const instrumentId = summary.instrument.id;
        const range = requiredMarketDataRange(
          summary.firstTradeAt,
          summary.lastTradeAt,
          {
            open: hasOpenPosition(summary.executions),
            market: SUPPORTED_MARKETS.has(
              summary.instrument.market.toUpperCase() as SupportedMarket,
            )
              ? (summary.instrument.market.toUpperCase() as SupportedMarket)
              : undefined,
          },
        );
        try {
          const [candles, coverage] = await Promise.all([
            repository.getDailyCandles(
              instrumentId,
              range.startDate,
              range.endDate,
            ),
            repository.getCoverage(instrumentId),
          ]);
          return {
            candles,
            instrumentId,
            status: coverageStatusForSegments(coverage),
          };
        } catch {
          return {
            candles: [],
            instrumentId,
            status: "storage-error" as const,
          };
        }
      }),
    ).then((results) => {
      if (!active) return;
      setMarketDataCandles((current) => {
        const next = { ...current };
        for (const result of results) {
          next[result.instrumentId] = result.candles;
        }
        return next;
      });
      setMarketDataStatuses((current) => {
        const next = { ...current };
        for (const result of results) {
          if (current[result.instrumentId] !== "syncing") {
            next[result.instrumentId] = result.status;
          }
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [hydrated, importedInstruments]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void new IndexedDbEpisodeReviewRepository()
      .getAll()
      .then((records) => {
        if (!active) return;
        setEpisodeReviews(
          Object.fromEntries(
            records.map((record) => [record.episodeId, record]),
          ),
        );
        setReviewsHydrated(true);
      })
      .catch(() => {
        if (active) {
          setEpisodeReviews({});
          setReviewsHydrated(false);
        }
      });
    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void new IndexedDbTagSuggestionRepository()
      .getAll()
      .then((records) => {
        if (active) {
          setSuggestionDecisions(records);
          setSuggestionsHydrated(true);
        }
      })
      .catch(() => {
        if (active) {
          setSuggestionDecisions([]);
          setSuggestionsHydrated(false);
        }
      });
    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveReviewState(REVIEW_ID, {
      version: 1,
      replayCursor: cursor,
      timeframe,
      thesis,
      drawings,
    });
  }, [cursor, drawings, hydrated, thesis, timeframe]);

  useEffect(() => {
    if (!playing) return;
    if (selectedImportedInstrument) return;
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
    playing,
    restoring,
    selectedImportedInstrument,
    speed,
    stepping,
  ]);

  function commitDrawings(next: Drawing[]) {
    setDrawingHistory((history) => [...history, drawings]);
    setDrawings(next);
    setRedoHistory([]);
  }

  function selectInstrument(instrumentId: string) {
    if (instrumentId !== "demo") {
      setPlaying(false);
      setTimeframe("1D");
      replayRequestSequence.current += 1;
      setStepping(false);
    }
    setSelectedInstrumentId(instrumentId);
  }

  function addDrawing(drawing: Drawing) {
    commitDrawings([...drawings, clampDrawingToCursor(drawing, cursor)]);
    setActiveTool("cursor");
  }

  function undoDrawing() {
    const previous = drawingHistory.at(-1);
    if (!previous) return;
    setRedoHistory((history) => [...history, drawings]);
    setDrawings(previous);
    setDrawingHistory((history) => history.slice(0, -1));
  }

  function redoDrawing() {
    const next = redoHistory.at(-1);
    if (!next) return;
    setDrawingHistory((history) => [...history, drawings]);
    setDrawings(next);
    setRedoHistory((history) => history.slice(0, -1));
  }

  async function startMarketDataUpdate(
    instrumentIds: string[],
    options: {
      executions?: TradeExecution[];
      refreshMetadata?: boolean;
    } = {},
  ) {
    if (instrumentIds.length === 0) return;
    const executions = options.executions ?? importedExecutions;
    const summariesById = new Map(
      buildInstrumentTradeSummaries(executions).map((item) => [
        item.instrument.id,
        item,
      ]),
    );
    setMarketDataStatuses((current) => ({
      ...current,
      ...Object.fromEntries(
        instrumentIds.map((instrumentId) => [instrumentId, "syncing"]),
      ),
    }));

    await Promise.all(
      instrumentIds.map(async (instrumentId) => {
        const summary = summariesById.get(instrumentId);
        if (!summary) return;
        const { instrument } = summary;
        const normalizedMarket = instrument.market.toUpperCase();
        const requestSequence =
          (marketDataRequestSequences.current[instrumentId] ?? 0) + 1;
        marketDataRequestSequences.current[instrumentId] = requestSequence;
        marketDataAbortControllers.current[instrumentId]?.abort();
        const abortController = new AbortController();
        marketDataAbortControllers.current[instrumentId] = abortController;
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
          setMarketDataStatuses((current) => ({
            ...current,
            [instrumentId]: "storage-error",
          }));
        }
        let status: MarketDataSyncStatus = "source-unavailable";
        let message = "行情更新请求失败，请稍后重试。";
        let metadataPersistenceFailed = false;
        const repository = new IndexedDbMarketDataRepository();
        const metadataRefresh = options.refreshMetadata
          ? refreshInstrumentMetadata(
              {
                market: normalizedMarket as SupportedMarket,
                symbol: instrument.symbol,
              },
              {
                repository:
                  new IndexedDbInstrumentMetadataRepository(),
                fetcher: fetch,
                signal: abortController.signal,
              },
            )
              .then((metadata) => {
                if (
                  !metadata ||
                  marketDataRequestSequences.current[instrumentId] !==
                    requestSequence
                ) {
                  return;
                }
                const current = currentExecutionSnapshot();
                const next = current.map((execution) =>
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
                  saveImportedExecutions(next);
                } catch {
                  metadataPersistenceFailed = true;
                  setImportError(
                    "已查询到证券新名称，但新名称未能保存；交易库仍保留原名称。",
                  );
                  return;
                }
                importedExecutionsRef.current = next;
                setImportedExecutions(next);
              })
              .catch(() => undefined)
          : Promise.resolve();
        try {
          if (!SUPPORTED_MARKETS.has(normalizedMarket as SupportedMarket)) {
            throw new Error(`暂不支持 ${instrument.market} 市场行情`);
          }
          const result = await syncMarketData({
            instrumentId,
            symbol: instrument.symbol,
            market: normalizedMarket as SupportedMarket,
            currency: instrument.currency,
            required: requiredMarketDataRange(
              summary.firstTradeAt,
              summary.lastTradeAt,
              {
                open: hasOpenPosition(summary.executions),
                market: normalizedMarket as SupportedMarket,
              },
            ),
            repository,
            fetcher: fetch,
            signal: abortController.signal,
          });
          status = result.status;
          message =
            result.source === "cache"
              ? "已使用本地缓存，未请求外部行情。"
              : `已补齐 ${result.requestedRanges.length} 个行情缺口。`;
          setMarketDataCandles((current) => ({
            ...current,
            [instrumentId]: result.candles,
          }));
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }
          status =
            error instanceof DOMException
              ? "storage-error"
              : "source-unavailable";
          message =
            error instanceof Error ? error.message : "行情更新失败";
          try {
            const range = requiredMarketDataRange(
              summary.firstTradeAt,
              summary.lastTradeAt,
              {
                open: hasOpenPosition(summary.executions),
                market: normalizedMarket as SupportedMarket,
              },
            );
            const cached = await repository.getDailyCandles(
              instrumentId,
              range.startDate,
              range.endDate,
            );
            if (cached.length > 0) {
              setMarketDataCandles((current) => ({
                ...current,
                [instrumentId]: cached,
              }));
            }
          } catch {
            status = "storage-error";
          }
        }
        await metadataRefresh;
        if (metadataPersistenceFailed) {
          status = "storage-error";
          message = "证券新名称未能保存，交易库仍保留原名称。";
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
            status,
            message,
          });
        } catch {
          status = "storage-error";
        }
        setMarketDataStatuses((current) => ({
          ...current,
          [instrumentId]: status,
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
    const { currentAfterReplacements, incomingToMerge } =
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
    setPendingImportMergeBase(currentAfterReplacements);
    try {
      await Promise.resolve();
      setImportPhase("resolving");
      const enriched = await enrichStatementImport(parsed, {
        repository: new IndexedDbInstrumentMetadataRepository(),
      });
      if (requestId !== importRequestSequence.current) return;
      const preview = previewForImport(prepared.fileName, enriched, {
        captureCount: prepared.captureCount,
        duplicateTradeCount: prepared.reconciliation.duplicates.length,
        conflictTradeCount,
      });
      setPendingEnrichedImport(enriched);
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
        repository: new IndexedDbInstrumentMetadataRepository(),
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
      const enriched = await enrichStatementImport(pendingParsedImport, {
        repository: new IndexedDbInstrumentMetadataRepository(),
        forceRefresh: true,
        onlyInstrumentIds: instrumentIds,
        previous: pendingEnrichedImport,
      });
      if (requestId !== importRequestSequence.current) return;
      const preview = previewForImport(
        pendingImport.fileName,
        enriched,
        pendingImport.sourceKind === "screenshot"
          ? {
              captureCount: pendingImport.captureCount ?? 0,
              duplicateTradeCount: pendingImport.duplicateTradeCount,
              conflictTradeCount: pendingImport.conflictTradeCount ?? 0,
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

  function confirmImport() {
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
      persistImportBatch(
        currentExecutions,
        mergedExecutions,
        historyEntry,
      );
    } catch {
      setImportError(
        "浏览器未能保存这次导入，请检查隐私模式或本地存储空间后重试。",
      );
      setPendingImport(null);
      setPendingImportOriginalExecutions(null);
      setPendingImportMergeBase(null);
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
        const normalizedMarket =
          summary.instrument.market.toUpperCase() as SupportedMarket;
        const range = requiredMarketDataRange(
          summary.firstTradeAt,
          summary.lastTradeAt,
          {
            open: hasOpenPosition(summary.executions),
            market: SUPPORTED_MARKETS.has(normalizedMarket)
              ? normalizedMarket
              : undefined,
          },
        );
        const previousRange = previous
          ? requiredMarketDataRange(
              previous.firstTradeAt,
              previous.lastTradeAt,
              {
                open: hasOpenPosition(previous.executions),
                market: SUPPORTED_MARKETS.has(normalizedMarket)
                  ? normalizedMarket
                  : undefined,
              },
            )
          : undefined;
        return requiredRangeExpanded(previousRange, range);
      })
      .map((summary) => summary.instrument.id);
    const firstImported = summaries.find((item) =>
      importedIds.includes(item.instrument.id),
    );
    if (firstImported) {
      selectInstrument(firstImported.instrument.id);
    }
    void startMarketDataUpdate(automaticSyncIds, {
      executions: mergedExecutions,
    });
    setPendingImport(null);
    setPendingParsedImport(null);
    setPendingEnrichedImport(null);
    setPendingImportOriginalExecutions(null);
    setPendingImportMergeBase(null);
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
    const persistedReview = await persistSuggestionDecision({
      suggestion: decided,
      review,
    });
    if (!persistedReview) {
      throw new Error("确认建议时未写入复盘记录");
    }
    setSuggestionDecisions((records) => [
      ...records.filter(({ id }) => id !== decided.id),
      decided,
    ]);
    setEpisodeReviews((records) => ({
      ...records,
      [persistedReview.episodeId]: persistedReview,
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
    await persistSuggestionDecision({ suggestion: decided });
    setSuggestionDecisions((records) => [
      ...records.filter(({ id }) => id !== decided.id),
      decided,
    ]);
  }

  const latestCandle = snapshot.candles.at(-1);
  const pnlPositive = Number(snapshot.position.unrealizedPnl) >= 0;
  const netPnl = new Decimal(snapshot.position.realizedPnl)
    .plus(snapshot.position.unrealizedPnl)
    .minus(snapshot.position.fees)
    .toString();

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
            <Sparkles size={13} />
            演示行情
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
            timeframe={
              timeframe === "1W" ? "1W" : "1D"
            }
            onTimeframeChange={setTimeframe}
            onOpenInReview={(instrumentId) => {
              selectInstrument(instrumentId);
              setActiveView("review");
            }}
            reviewsHydrated={reviewsHydrated}
            target={libraryTarget}
            onSaveReview={async (record) => {
              await new IndexedDbEpisodeReviewRepository().put(record);
              setEpisodeReviews((current) => ({
                ...current,
                [record.episodeId]: record,
              }));
            }}
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
            void screenshotImport.start(files).catch((error) => {
              setImportError(
                error instanceof Error ? error.message : "截图识别失败",
              );
            });
          }}
          onOpenHistory={() => setShowImportHistory(true)}
          revealedDemoExecutions={snapshot.executions}
          selectedInstrumentId={selectedInstrumentId}
          onSelectInstrument={selectInstrument}
          marketDataStatuses={marketDataStatuses}
          onUpdateMarketData={(instrumentId) =>
            void startMarketDataUpdate([instrumentId], {
              refreshMetadata: true,
            })
          }
        />

        <section className="review-workspace" aria-label="交易复盘图表工作区">
          <ChartToolbar
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            symbol={selectedImportedInstrument?.instrument.symbol}
            instrumentName={selectedImportedInstrument?.instrument.name}
            market={selectedImportedInstrument?.instrument.market}
            supportedTimeframes={
              selectedImportedInstrument ? ["1D", "1W"] : undefined
            }
          />

          {selectedImportedInstrument ? (
            <ImportedEpisodeReview
              summary={selectedImportedInstrument}
              marketDataStatus={
                marketDataStatuses[
                  selectedImportedInstrument.instrument.id
                ] ?? "not-requested"
              }
              candles={
                marketDataCandles[
                  selectedImportedInstrument.instrument.id
                ] ?? []
              }
              timeframe={timeframe}
              onUpdateMarketData={() =>
                void startMarketDataUpdate([
                  selectedImportedInstrument.instrument.id,
                ], {
                  refreshMetadata: true,
                })
              }
            />
          ) : (
            <div className="chart-layout">
            <DrawingToolbar
              activeTool={activeTool}
              canUndo={drawingHistory.length > 0}
              canRedo={redoHistory.length > 0}
              allLocked={allDrawingsLocked}
              onToolChange={setActiveTool}
              onUndo={undoDrawing}
              onRedo={redoDrawing}
              onToggleLock={() => {
                if (drawings.length === 0) return;
                commitDrawings(
                  drawings.map((drawing) => ({
                    ...drawing,
                    locked: !allDrawingsLocked,
                  })),
                );
              }}
              onClear={() => {
                const lockedDrawings = drawings.filter(
                  (drawing) => drawing.locked,
                );
                if (lockedDrawings.length !== drawings.length) {
                  commitDrawings(lockedDrawings);
                }
              }}
            />
            <div className="chart-column">
              <div className="position-strip">
                <div className="position-primary">
                  <span
                    className={`live-dot ${playing ? "playing" : ""}`}
                  />
                  <span data-testid="replay-cursor">
                    {formatReplayCursor(cursor)}
                  </span>
                  <strong>{latestCandle?.close.toFixed(2)}</strong>
                  <span className="currency-label">USD</span>
                </div>
                <div className="position-stats">
                  <span>
                    持仓 <b>{snapshot.position.quantity}</b>
                  </span>
                  <span>
                    均价 <b>{Number(snapshot.position.averageCost).toFixed(2)}</b>
                  </span>
                  <span>
                    浮动盈亏{" "}
                    <b
                      data-testid="unrealized-pnl"
                      className={pnlPositive ? "positive" : "negative"}
                    >
                      {money(snapshot.position.unrealizedPnl)}
                    </b>
                  </span>
                  <span>
                    已实现 <b>{money(snapshot.position.realizedPnl)}</b>
                  </span>
                  <span>
                    净盈亏{" "}
                    <b className={Number(netPnl) >= 0 ? "positive" : "negative"}>
                      {money(netPnl)}
                    </b>
                  </span>
                  <span>
                    收益率{" "}
                    <b className={pnlPositive ? "positive" : "negative"}>
                      {Number(snapshot.position.returnPercent).toFixed(2)}%
                    </b>
                  </span>
                </div>
              </div>

              <ReplayChart
                candles={snapshot.candles}
                executions={snapshot.executions}
                cursor={cursor}
                averageCost={Number(snapshot.position.averageCost)}
                drawings={visibleDrawings}
                activeTool={activeTool}
                onAddDrawing={addDrawing}
              />

              <div className="chart-footer">
                <ReplayControls
                  playing={playing}
                  speed={speed}
                  canGoBack={frame.canGoBack && !stepping && !restoring}
                  canGoForward={frame.canGoForward && !stepping && !restoring}
                  onPrevious={() => {
                    setPlaying(false);
                    void requestFrame("previous");
                  }}
                  onNext={() => {
                    setPlaying(false);
                    void requestFrame("next");
                  }}
                  onNextExecution={() => {
                    setPlaying(false);
                    void requestFrame("next-execution");
                  }}
                  onTogglePlay={() => setPlaying((value) => !value)}
                  onSpeedChange={setSpeed}
                />
                <div className="replay-status">
                  {replayError && (
                    <span className="replay-error" role="alert">
                      {replayError}
                    </span>
                  )}
                  <CalendarDays size={14} />
                  <span>游标之后的数据未加载</span>
                  <span className="status-separator">·</span>
                  <CircleDollarSign size={14} />
                  <span>费用 {money(snapshot.position.fees)}</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        <ThesisPanel
          thesis={thesis}
          onThesisChange={setThesis}
          instrumentLabel={
            selectedImportedInstrument
              ? `${selectedImportedInstrument.instrument.name}（${selectedImportedInstrument.instrument.symbol}）`
              : "小鹏汽车（XPEV）"
          }
          available={!selectedImportedInstrument}
        />
          </>
        )}
      </div>

      {activeView === "review" && (
        <button className="mobile-panel-toggle" aria-label="打开复盘面板">
          <PanelRightOpen size={18} />
        </button>
      )}
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
            setImportPhase("idle");
          }}
          onConfirm={confirmImport}
          onRetryUnresolved={(instrumentIds) =>
            void retryUnresolved(instrumentIds)
          }
          retryingUnresolved={retryingUnresolved}
        />
      )}
      {screenshotImport.open && screenshotImport.state && (
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
