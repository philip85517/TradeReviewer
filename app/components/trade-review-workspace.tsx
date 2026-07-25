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
import type { ImportDiagnostic } from "../lib/import/import-result";
import { aggregateCandles } from "../lib/market/aggregate";
import type { Timeframe } from "../lib/market/types";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import {
  loadReviewState,
  saveReviewState,
} from "../lib/storage/review-storage";
import {
  loadImportedExecutions,
  mergeExecutions,
  saveImportedExecutions,
} from "../lib/storage/import-library";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import type { TradeExecution } from "../lib/trades/types";
import { ChartToolbar } from "./chart/chart-toolbar";
import { DrawingToolbar } from "./chart/drawing-toolbar";
import { ReplayChart } from "./chart/replay-chart";
import { ReplayControls } from "./replay/replay-controls";
import { EpisodeSidebar } from "./review/episode-sidebar";
import { ImportedEpisodeReview } from "./review/imported-episode-review";
import { ThesisPanel } from "./review/thesis-panel";

const REVIEW_ID = "demo-xpev-2025";
const DEFAULT_THESIS =
  "宽通道上升后的第一次深度回撤。等待重新站上短期高点，确认买盘跟随后分批进入；如果跌破前低则逻辑失效。";

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
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("demo");
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const replayRequestSequence = useRef(0);

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
  const importedEpisodes = useMemo(
    () => buildTradeEpisodes(importedExecutions),
    [importedExecutions],
  );
  const selectedImportedEpisode = importedEpisodes.find(
    (episode) => episode.id === selectedEpisodeId,
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
      setImportedExecutions(loadImportedExecutions());
      if (stored) {
        setTimeframe(stored.timeframe);
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
    speed,
    stepping,
  ]);

  function commitDrawings(next: Drawing[]) {
    setDrawingHistory((history) => [...history, drawings]);
    setDrawings(next);
    setRedoHistory([]);
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

  async function importFutu(file: File) {
    setImporting(true);
    try {
      const result = parseFutuWorkbook(await file.arrayBuffer(), {
        fileName: file.name,
        sourceTimezone: "Asia/Shanghai",
      });
      setDiagnostics(result.diagnostics);
      const mergedExecutions = mergeExecutions(
        importedExecutions,
        result.records,
      );
      const rebuiltEpisodes = buildTradeEpisodes(mergedExecutions);
      setImportedExecutions(mergedExecutions);
      saveImportedExecutions(mergedExecutions);
      if (rebuiltEpisodes[0]) {
        setSelectedEpisodeId(rebuiltEpisodes[0].id);
      }
    } catch {
      setDiagnostics([
        {
          severity: "error",
          code: "unreadable-workbook",
          message: "文件无法读取，请确认这是富途导出的 XLSX 对账单。",
        },
      ]);
    } finally {
      setImporting(false);
    }
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
          importedEpisodes={importedEpisodes}
          diagnostics={diagnostics}
          importing={importing}
          onImport={importFutu}
          revealedDemoExecutions={snapshot.executions}
          selectedEpisodeId={selectedEpisodeId}
          onSelectEpisode={setSelectedEpisodeId}
        />

        <section className="review-workspace" aria-label="交易复盘图表工作区">
          <ChartToolbar
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            symbol={selectedImportedEpisode?.instrument.symbol}
            instrumentName={selectedImportedEpisode?.instrument.name}
            market={selectedImportedEpisode?.instrument.market}
          />

          {selectedImportedEpisode ? (
            <ImportedEpisodeReview episode={selectedImportedEpisode} />
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
                    {new Date(cursor).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
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

        <ThesisPanel thesis={thesis} onThesisChange={setThesis} />
      </div>

      <button className="mobile-panel-toggle" aria-label="打开复盘面板">
        <PanelRightOpen size={18} />
      </button>
    </main>
  );
}
