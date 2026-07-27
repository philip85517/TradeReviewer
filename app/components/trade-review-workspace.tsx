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
import { parseFutuWorkbook } from "../lib/import/futu";
import {
  createImportPreview,
  type ImportPreview,
} from "../lib/import/import-preview";
import { aggregateCandles } from "../lib/market/aggregate";
import type {
  DailyCandleRecord,
  SupportedMarket,
} from "../lib/market/contracts";
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
import type { Timeframe } from "../lib/market/types";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import { formatReplayCursor } from "../lib/replay/format-time";
import {
  loadReviewState,
  saveReviewState,
} from "../lib/storage/review-storage";
import {
  loadImportedExecutions,
  mergeExecutions,
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
import { buildInstrumentTradeSummaries } from "../lib/trades/instruments";
import type { TradeExecution } from "../lib/trades/types";
import { ChartToolbar } from "./chart/chart-toolbar";
import { DrawingToolbar } from "./chart/drawing-toolbar";
import { ImportConfirmDialog } from "./import/import-confirm-dialog";
import { ImportHistoryDialog } from "./import/import-history-dialog";
import { ReplayChart } from "./chart/replay-chart";
import { ReplayControls } from "./replay/replay-controls";
import { EpisodeSidebar } from "./review/episode-sidebar";
import { ImportedEpisodeReview } from "./review/imported-episode-review";
import { ThesisPanel } from "./review/thesis-panel";

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

export function TradeReviewWorkspace({ initialFrame }: Props) {
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
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const replayRequestSequence = useRef(0);
  const marketDataRequestSequences = useRef<Record<string, number>>({});
  const marketDataAbortControllers = useRef<
    Record<string, AbortController>
  >({});

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
    if (!hydrated || !selectedImportedInstrument) return;
    let active = true;
    const summary = selectedImportedInstrument;
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
    const repository = new IndexedDbMarketDataRepository();
    void Promise.all([
      repository.getDailyCandles(
        summary.instrument.id,
        range.startDate,
        range.endDate,
      ),
      repository.getCoverage(summary.instrument.id),
    ]).then(([candles, coverage]) => {
      if (!active) return;
      setMarketDataCandles((current) => ({
        ...current,
        [summary.instrument.id]: candles,
      }));
      setMarketDataStatuses((current) => ({
        ...current,
        [summary.instrument.id]: coverageStatusForSegments(coverage),
      }));
    }).catch(() => {
      if (!active) return;
      setMarketDataStatuses((current) => ({
        ...current,
        [summary.instrument.id]: "storage-error",
      }));
    });
    return () => {
      active = false;
    };
  }, [hydrated, selectedImportedInstrument]);

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

  async function startMarketDataUpdate(instrumentIds: string[]) {
    if (instrumentIds.length === 0) return;
    const summariesById = new Map(
      buildInstrumentTradeSummaries([
        ...importedExecutions,
        ...(pendingImport?.records ?? []),
      ]).map((item) => [item.instrument.id, item]),
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
        const repository = new IndexedDbMarketDataRepository();
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
    void startMarketDataUpdate(automaticSyncIds);
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
          <button className="active">逐笔复盘</button>
          <button>交易库</button>
          <button>模式洞察</button>
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

      <div className="workspace">
        <EpisodeSidebar
          importedInstruments={importedInstruments}
          importing={importing}
          importError={importError}
          onImport={parseImport}
          onOpenHistory={() => setShowImportHistory(true)}
          revealedDemoExecutions={snapshot.executions}
          selectedInstrumentId={selectedInstrumentId}
          onSelectInstrument={selectInstrument}
          marketDataStatuses={marketDataStatuses}
          onUpdateMarketData={(instrumentId) =>
            void startMarketDataUpdate([instrumentId])
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
                ])
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
      </div>

      <button className="mobile-panel-toggle" aria-label="打开复盘面板">
        <PanelRightOpen size={18} />
      </button>
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
