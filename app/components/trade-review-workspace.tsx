"use client";

import {
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  Menu,
  PanelRightOpen,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  demoCandles15m,
  demoInitialCursorIndex,
} from "../data/demo-market";
import { demoExecutions } from "../data/demo-trades";
import type { Drawing, DrawingTool } from "../lib/chart/drawings";
import { clampDrawingToCursor } from "../lib/chart/drawings";
import { parseFutuWorkbook } from "../lib/import/futu";
import type { ImportDiagnostic } from "../lib/import/import-result";
import { aggregateCandles } from "../lib/market/aggregate";
import type { Timeframe } from "../lib/market/types";
import { createReplaySnapshot } from "../lib/replay/replay-engine";
import {
  loadReviewState,
  saveReviewState,
} from "../lib/storage/review-storage";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import type { TradeEpisode } from "../lib/trades/types";
import { ChartToolbar } from "./chart/chart-toolbar";
import { DrawingToolbar } from "./chart/drawing-toolbar";
import { ReplayChart } from "./chart/replay-chart";
import { ReplayControls } from "./replay/replay-controls";
import { EpisodeSidebar } from "./review/episode-sidebar";
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

export function TradeReviewWorkspace() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [cursorIndex, setCursorIndex] = useState(demoInitialCursorIndex);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingHistory, setDrawingHistory] = useState<Drawing[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Drawing[][]>([]);
  const [thesis, setThesis] = useState(DEFAULT_THESIS);
  const [importedEpisodes, setImportedEpisodes] = useState<TradeEpisode[]>([]);
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostic[]>([]);
  const [importing, setImporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const cursor = demoCandles15m[cursorIndex].time;
  const revealedBaseCandles = useMemo(
    () => demoCandles15m.slice(0, cursorIndex + 1),
    [cursorIndex],
  );
  const chartCandles = useMemo(
    () => aggregateCandles(revealedBaseCandles, timeframe),
    [revealedBaseCandles, timeframe],
  );
  const snapshot = useMemo(
    () =>
      createReplaySnapshot({
        candles: chartCandles,
        executions: demoExecutions,
        cursor,
      }),
    [chartCandles, cursor],
  );
  const visibleDrawings = useMemo(
    () =>
      drawings.filter(
        (drawing) =>
          drawing.visibleOn === "all" ||
          drawing.visibleOn.includes(timeframe),
      ),
    [drawings, timeframe],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = loadReviewState(REVIEW_ID);
      if (stored) {
        const storedIndex = demoCandles15m.findIndex(
          (candle) => candle.time === stored.replayCursor,
        );
        if (storedIndex >= 0) setCursorIndex(storedIndex);
        setTimeframe(stored.timeframe);
        setThesis(stored.thesis);
        setDrawings(stored.drawings);
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    const interval = window.setInterval(() => {
      setCursorIndex((current) => {
        if (current >= demoCandles15m.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearInterval(interval);
  }, [playing, speed]);

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

  function goToNextExecution() {
    const nextExecution = demoExecutions.find(
      (execution) => execution.executedAt > cursor,
    );
    if (!nextExecution) {
      setCursorIndex((current) =>
        Math.min(current + 1, demoCandles15m.length - 1),
      );
      return;
    }
    const target = demoCandles15m.findIndex(
      (candle) => candle.time >= nextExecution.executedAt,
    );
    if (target >= 0) setCursorIndex(target);
  }

  async function importFutu(file: File) {
    setImporting(true);
    try {
      const result = parseFutuWorkbook(await file.arrayBuffer());
      setDiagnostics(result.diagnostics);
      setImportedEpisodes(buildTradeEpisodes(result.records));
    } catch {
      setDiagnostics([
        {
          severity: "error",
          code: "unreadable-workbook",
          message: "文件无法读取，请确认这是富途导出的 XLSX 对账单。",
        },
      ]);
      setImportedEpisodes([]);
    } finally {
      setImporting(false);
    }
  }

  const latestCandle = snapshot.candles.at(-1);
  const pnlPositive = Number(snapshot.position.unrealizedPnl) >= 0;

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
        />

        <section className="review-workspace" aria-label="交易复盘图表工作区">
          <ChartToolbar
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          <div className="chart-layout">
            <DrawingToolbar
              activeTool={activeTool}
              canUndo={drawingHistory.length > 0}
              canRedo={redoHistory.length > 0}
              onToolChange={setActiveTool}
              onUndo={undoDrawing}
              onRedo={redoDrawing}
              onClear={() => {
                if (drawings.length > 0) commitDrawings([]);
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
                  canGoBack={cursorIndex > 0}
                  canGoForward={cursorIndex < demoCandles15m.length - 1}
                  onPrevious={() => {
                    setPlaying(false);
                    setCursorIndex((current) => Math.max(0, current - 1));
                  }}
                  onNext={() => {
                    setPlaying(false);
                    setCursorIndex((current) =>
                      Math.min(
                        demoCandles15m.length - 1,
                        current + 1,
                      ),
                    );
                  }}
                  onNextExecution={() => {
                    setPlaying(false);
                    goToNextExecution();
                  }}
                  onTogglePlay={() => setPlaying((value) => !value)}
                  onSpeedChange={setSpeed}
                />
                <div className="replay-status">
                  <CalendarDays size={14} />
                  <span>游标之后的数据未加载</span>
                  <span className="status-separator">·</span>
                  <CircleDollarSign size={14} />
                  <span>费用 {money(snapshot.position.fees)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ThesisPanel thesis={thesis} onThesisChange={setThesis} />
      </div>

      <button className="mobile-panel-toggle" aria-label="打开复盘面板">
        <PanelRightOpen size={18} />
      </button>
    </main>
  );
}
