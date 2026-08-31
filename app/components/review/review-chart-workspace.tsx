"use client";

import { CalendarDays, CircleDollarSign } from "lucide-react";
import { useMemo, useRef } from "react";

import type {
  DrawingCommand,
  DrawingHistory,
} from "../../lib/chart/drawing-commands";
import {
  canRedoDrawingAtCursor,
  canUndoDrawingAtCursor,
} from "../../lib/chart/drawing-commands";
import {
  visibleDrawingsAtCursor,
  type DrawingTool,
} from "../../lib/chart/drawings";
import type { TimeframeAvailability } from "../../lib/market/availability";
import type { Candle, Timeframe } from "../../lib/market/types";
import type { PositionLedgerSnapshot } from "../../lib/replay/position-ledger";
import type { PositionPathMetrics } from "../../lib/replay/position-path-metrics";
import { formatReplayCursor } from "../../lib/replay/format-time";
import type {
  EpisodePlan,
  EpisodeReviewRecord,
} from "../../lib/reviews/types";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { ChartToolbar } from "../chart/chart-toolbar";
import { DrawingLayersPanel } from "../chart/drawing-layers-panel";
import { DrawingToolbar } from "../chart/drawing-toolbar";
import type { SearchableInstrument } from "../chart/instrument-search-popover";
import type { MarketDataDetails } from "../chart/market-data-popover";
import { ReplayChart } from "../chart/replay-chart";
import { useFullscreen } from "../chart/use-fullscreen";
import { ReplayControls } from "../replay/replay-controls";
import { ReviewSidePanel } from "./review-side-panel";

export type ReviewChartViewModel = {
  source: "demo" | "imported";
  episodeId: string;
  instrument: Instrument;
  timeframe: Timeframe;
  timeframeAvailability: TimeframeAvailability;
  cursor: string;
  candles: Candle[];
  executions: TradeExecution[];
  position: PositionLedgerSnapshot;
  pathMetrics: PositionPathMetrics;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoToNextExecution: boolean;
  replayError: string | null;
  replayNotice?: string | null;
  dataDetails: MarketDataDetails[];
  refreshDisabledReason: string | undefined;
};

export type EpisodeOption = {
  id: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  status: "open" | "closed";
};

type Props = {
  model: ReviewChartViewModel;
  episodeOptions: EpisodeOption[];
  playing: boolean;
  speed: number;
  activeTool: DrawingTool;
  drawingHistory: DrawingHistory;
  selectedDrawingId: string | null;
  layersOpen: boolean;
  settings: ChartSettings;
  instruments: SearchableInstrument[];
  review?: EpisodeReviewRecord;
  visiblePlan?: EpisodePlan;
  activePanelTab: "stats" | "notes";
  drawerOpen: boolean;
  onEpisodeChange: (episodeId: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onSelectInstrument: (instrumentId: string) => void;
  onRefreshMarketData: () => void;
  onToggleLayers: () => void;
  onSettingsChange: (settings: ChartSettings) => void;
  onToolChange: (tool: DrawingTool) => void;
  onDrawingCommand: (command: DrawingCommand) => void;
  onSelectDrawing: (id: string | null) => void;
  onUndoDrawing: () => void;
  onRedoDrawing: () => void;
  onClearDrawings: () => void;
  onToggleAllDrawings: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onNextExecution: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onActivePanelTabChange: (tab: "stats" | "notes") => void;
  onDrawerOpenChange: (open: boolean) => void;
  onSaveReview: (record: EpisodeReviewRecord) => Promise<void>;
};

function money(value: string, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(Number(value));
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function executionTimestampLabel(execution: TradeExecution) {
  if (execution.source.timePrecision === "date-only") {
    return `${execution.source.sourceTimestampText ?? "日期未知"} · 对账单未提供成交时间`;
  }
  return dateTime(execution.executedAt);
}

function fee(value: string, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function executionSource(execution: TradeExecution) {
  const source = execution.source;
  return [
    source.platform,
    source.sheet,
    `第 ${source.row} 行`,
  ].filter(Boolean).join(" · ");
}

export function ReviewChartWorkspace({
  model,
  episodeOptions,
  playing,
  speed,
  activeTool,
  drawingHistory,
  selectedDrawingId,
  layersOpen,
  settings,
  instruments,
  review,
  visiblePlan,
  activePanelTab,
  drawerOpen,
  onEpisodeChange,
  onTimeframeChange,
  onSelectInstrument,
  onRefreshMarketData,
  onToggleLayers,
  onSettingsChange,
  onToolChange,
  onDrawingCommand,
  onSelectDrawing,
  onUndoDrawing,
  onRedoDrawing,
  onClearDrawings,
  onToggleAllDrawings,
  onPrevious,
  onNext,
  onNextExecution,
  onTogglePlay,
  onSpeedChange,
  onActivePanelTabChange,
  onDrawerOpenChange,
  onSaveReview,
}: Props) {
  const workspaceRef = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(workspaceRef);
  const knowledgeVisibleDrawings = useMemo(
    () =>
      drawingHistory.present.filter((drawing) => {
        const visibleOnTimeframe =
          drawing.visibleOn === "all" ||
          drawing.visibleOn.includes(model.timeframe);
        return (
          drawing.createdAtCursor <= model.cursor &&
          visibleOnTimeframe
        );
      }),
    [drawingHistory.present, model.cursor, model.timeframe],
  );
  const chartDrawings = useMemo(
    () =>
      visibleDrawingsAtCursor(
        drawingHistory.present,
        model.cursor,
        model.timeframe,
      ),
    [drawingHistory.present, model.cursor, model.timeframe],
  );
  const allDrawingsLocked =
    knowledgeVisibleDrawings.length > 0 &&
    knowledgeVisibleDrawings.every((drawing) => drawing.locked);
  const canUndo = canUndoDrawingAtCursor(
    drawingHistory,
    model.cursor,
    model.timeframe,
  );
  const canRedo = canRedoDrawingAtCursor(
    drawingHistory,
    model.cursor,
    model.timeframe,
  );
  const latestCandle = model.candles.at(-1);
  const pnlPositive = Number(model.position.netPnl) >= 0;
  const instrumentLabel = `${model.instrument.name}（${model.instrument.symbol}）`;
  const episodeStartedAt =
    episodeOptions.find((episode) => episode.id === model.episodeId)
      ?.startedAt ?? model.cursor;

  return (
    <>
      <section
        ref={workspaceRef}
        className="review-workspace"
        aria-label="交易复盘图表工作区"
      >
        <header className="review-chart-heading">
          <div>
            <span className="eyebrow">
              {model.source === "demo" ? "演示回放" : "本地导入"}
            </span>
            <h1>{instrumentLabel}</h1>
          </div>
          <label className="episode-selector">
            <span>交易回合</span>
            <select
              aria-label="交易回合"
              value={model.episodeId}
              onChange={(event) => onEpisodeChange(event.target.value)}
            >
              {episodeOptions.map((episode) => (
                <option key={episode.id} value={episode.id}>
                  {episode.label} · {episode.status === "closed" ? "已平仓" : "持仓中"}
                </option>
              ))}
            </select>
          </label>
        </header>

        <ChartToolbar
          timeframe={model.timeframe}
          timeframeAvailability={model.timeframeAvailability}
          onTimeframeChange={onTimeframeChange}
          instruments={instruments}
          onSelectInstrument={onSelectInstrument}
          dataDetails={model.dataDetails}
          onRefreshMarketData={onRefreshMarketData}
          refreshDisabledReason={model.refreshDisabledReason}
          layersOpen={layersOpen}
          layersDisabledReason={
            knowledgeVisibleDrawings.length === 0
              ? "当前游标和周期暂无绘图"
              : undefined
          }
          onToggleLayers={onToggleLayers}
          fullscreen={fullscreen}
          settings={settings}
          onSettingsChange={onSettingsChange}
          symbol={model.instrument.symbol}
          instrumentName={model.instrument.name}
          market={model.instrument.market}
        />

        <div className="chart-layout">
          <DrawingToolbar
            activeTool={activeTool}
            canUndo={canUndo}
            canRedo={canRedo}
            allLocked={allDrawingsLocked}
            onToolChange={onToolChange}
            onUndo={onUndoDrawing}
            onRedo={onRedoDrawing}
            onToggleLock={onToggleAllDrawings}
            onClear={onClearDrawings}
          />
          <div className="chart-column">
            <div className="position-strip">
              <div className="position-primary">
                <span className={`live-dot ${playing ? "playing" : ""}`} />
                <span
                  data-testid="replay-cursor"
                  data-cursor={model.cursor}
                >
                  {formatReplayCursor(model.cursor)}
                </span>
                <strong>{latestCandle?.close.toFixed(2) ?? "—"}</strong>
                <span className="currency-label">
                  {model.instrument.currency}
                </span>
              </div>
              <div className="position-stats">
                <span>
                  持仓 <b>{model.position.quantity}</b>
                </span>
                <span>
                  均价{" "}
                  <b>{Number(model.position.averageCost).toFixed(2)}</b>
                </span>
                <span>
                  浮动盈亏{" "}
                  <b className={pnlPositive ? "positive" : "negative"}>
                    {money(
                      model.position.unrealizedPnl,
                      model.instrument.currency,
                    )}
                  </b>
                </span>
                <span>
                  已实现{" "}
                  <b>
                    {money(
                      model.position.realizedPnl,
                      model.instrument.currency,
                    )}
                  </b>
                </span>
                <span>
                  净盈亏{" "}
                  <b
                    data-testid="net-pnl"
                    className={pnlPositive ? "positive" : "negative"}
                  >
                    {money(model.position.netPnl, model.instrument.currency)}
                  </b>
                </span>
                <span>
                  收益率{" "}
                  <b className={pnlPositive ? "positive" : "negative"}>
                    {Number(model.position.returnPercent).toFixed(2)}%
                  </b>
                </span>
              </div>
            </div>

            <ReplayChart
              episodeId={model.episodeId}
              candles={model.candles}
              executions={model.executions}
              cursor={model.cursor}
              averageCost={Number(model.position.averageCost)}
              drawings={chartDrawings}
              activeTool={activeTool}
              settings={settings}
              selectedDrawingId={selectedDrawingId}
              plannedRiskAmount={visiblePlan?.plannedRiskAmount}
              currency={model.instrument.currency}
              onSelectDrawing={onSelectDrawing}
              onCommand={onDrawingCommand}
            />

            {layersOpen && (
              <DrawingLayersPanel
                drawings={knowledgeVisibleDrawings}
                onCommand={onDrawingCommand}
                onSelectDrawing={onSelectDrawing}
                selectedDrawingId={selectedDrawingId}
              />
            )}

            <div className="chart-footer">
              <ReplayControls
                playing={playing}
                speed={speed}
                canGoBack={model.canGoBack}
                canGoForward={model.canGoForward}
                canGoToNextExecution={model.canGoToNextExecution}
                onPrevious={onPrevious}
                onNext={onNext}
                onNextExecution={onNextExecution}
                onTogglePlay={onTogglePlay}
                onSpeedChange={onSpeedChange}
              />
              <div className="replay-status">
                {model.replayError && (
                  <span className="replay-error" role="alert">
                    {model.replayError}
                  </span>
                )}
                {model.replayNotice && (
                  <span className="replay-notice" role="alert">
                    {model.replayNotice}
                  </span>
                )}
                <CalendarDays size={14} />
                <span>游标之后的数据未加载</span>
                <span className="status-separator">·</span>
                <CircleDollarSign size={14} />
                <span>
                  费用 {money(model.position.fees, model.instrument.currency)}
                </span>
              </div>
            </div>

            <details className="execution-details">
              <summary>当前游标成交明细（{model.executions.length}）</summary>
              {model.executions.length === 0 ? (
                <p>游标之前尚无成交。</p>
              ) : (
                <ol>
                  {model.executions.map((execution) => {
                    const dateOnly =
                      execution.source.timePrecision === "date-only";
                    const sourceTimestamp =
                      execution.source.sourceTimestampText;
                    return (
                      <li key={execution.id}>
                        <time
                          dateTime={dateOnly ? undefined : execution.executedAt}
                        >
                          {executionTimestampLabel(execution)}
                        </time>
                        <b>{execution.side === "buy" ? "买入" : "卖出"}</b>
                        <span>
                          {execution.quantity} × {execution.price}
                        </span>
                        <span>
                          费用 {fee(execution.fee, model.instrument.currency)}
                        </span>
                        <small>来源 {executionSource(execution)}</small>
                        <small>
                          时区 {execution.source.sourceTimezone ?? "未记录"}
                        </small>
                        {!dateOnly && sourceTimestamp && (
                          <small>{sourceTimestamp}</small>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </details>
          </div>
        </div>
      </section>

      <ReviewSidePanel
        instrumentLabel={instrumentLabel}
        currency={model.instrument.currency}
        metrics={model.pathMetrics}
        review={review}
        visiblePlan={visiblePlan}
        episodeId={model.episodeId}
        instrumentId={model.instrument.id}
        knowledgeCursor={model.cursor}
        episodeStartedAt={episodeStartedAt}
        activeTab={activePanelTab}
        onActiveTabChange={onActivePanelTabChange}
        onSaveReview={onSaveReview}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={onDrawerOpenChange}
      />
    </>
  );
}
