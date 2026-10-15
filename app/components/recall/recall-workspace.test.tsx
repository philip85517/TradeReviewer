import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRecallPlanRevision, freezeRecallPlanDraft, upsertRecallPlanDraft } from "../../lib/recall/plans";
import { emptyRecallPlanInput } from "./recall-plan-sidebar";
import { confirmRecallRetainedState, freezeRecallSnapshotBundle } from "../../lib/recall/retained-bundles";
import { createRecallDocument, validateRecallDocument } from "../../lib/recall/document";
import { RecallRepositoryError } from "../../lib/recall/repository";
import { calculateRecallActualMetrics } from "../../lib/recall/actual-metrics";
import { retainRecallActualMetrics } from "../../lib/recall/metric-retention";
import { upsertRecallManualEvaluationDraft } from "../../lib/recall/manual-evaluations";
import { applyRecallSizing } from "../../lib/recall/sizing";
import type { RecallDocument, RecallSnapshot, RecallWorkingContext } from "../../lib/recall/types";
import type { Candle, Timeframe } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import { NO_REVEALED_EXECUTIONS } from "../../lib/replay/recall-replay";
import {
  RecallWorkspace,
  reconcileRecallSaveResponse,
  transitionRecallPanelState,
  type RecallRepository,
} from "./recall-workspace";
import { DrawingLayersPanel } from "../chart/drawing-layers-panel";

const originalTradereviewDbPath = process.env.TRADEREVIEW_DB_PATH;

const replayChartHarness = vi.hoisted(() => {
  const viewport = {
    version: 1 as const,
    logicalRange: { from: 0, to: 1 },
    barSpacing: 6,
    rightOffset: 0,
    width: 600,
    height: 400,
  };
  return {
    viewport,
    deferReady: false,
    pendingReady: null as (() => void) | null,
    readyCount: 0,
    plotLayout: null as { width: number; height: number; axisWidth: number; plotCenterX: number } | null,
    lastProps: null as { averageCost?: number; settings?: { showAverageCost?: boolean }; onPlanPriceChange?: (id: string, price: string) => void; planLinesEditable?: boolean; onRequestCursorTool?: () => void; onPlotLayoutChange?: (layout: { width: number; height: number; axisWidth: number; plotCenterX: number }) => void } | null,
    handle: {
      capture: vi.fn().mockResolvedValue({ imageDataUrl: "data:image/png;base64,AA==", viewport }),
      prepareTextDraft: vi.fn().mockResolvedValue(true),
      flush: vi.fn().mockResolvedValue(undefined),
      getViewport: vi.fn(() => viewport),
      restoreViewport: vi.fn(),
      fitAll: vi.fn(),
    },
  };
});

vi.mock("../chart/replay-chart", () => ({
  ReplayChart: ({
    onCommand,
    onReady,
    cursor,
    candles,
    executions,
    drawings,
    selectedDrawingId,
    averageCost,
    settings,
    onPlanPriceChange,
    planLinesEditable,
    onDrawingInteractionStart,
    activeTool,
    onSelectDrawing,
    onRequestCursorTool,
    onPlotLayoutChange,
  }: {
    onCommand: (command: unknown) => void;
    onReady?: (handle: typeof replayChartHarness.handle | null) => void;
    cursor?: string;
    candles?: Array<{ time: string }>;
    executions?: Array<{ id: string }>;
    drawings?: Array<{ id: string }>;
    averageCost?: number;
    settings?: { showAverageCost?: boolean };
    onPlanPriceChange?: (id: string, price: string) => void;
    planLinesEditable?: boolean;
    onDrawingInteractionStart?: () => void;
    activeTool?: string;
    onSelectDrawing?: (id: string | null) => void;
    selectedDrawingId?: string | null;
    onRequestCursorTool?: () => void;
    onPlotLayoutChange?: (layout: { width: number; height: number; axisWidth: number; plotCenterX: number }) => void;
  }) => {
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const replayDrawing = {
      version: 2,
      id: "drawing-1",
      episodeId: "episode-1",
      name: "测试线",
      tool: "horizontal-line",
      anchors: [{ time: "2025-01-02T10:00:00.000Z", price: 10 }],
      style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      zIndex: 0,
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
      createdAtCursor: "2025-01-02T10:00:00.000Z",
    };
    useEffect(() => {
      if (replayChartHarness.deferReady) {
        replayChartHarness.pendingReady = () => {
          onReadyRef.current?.(replayChartHarness.handle);
          replayChartHarness.readyCount += 1;
        };
        return () => {
          onReady?.(null);
        };
      }
      onReady?.(replayChartHarness.handle);
      replayChartHarness.readyCount += 1;
      return () => onReady?.(null);
    }, [replayChartHarness.deferReady]);
    useEffect(() => {
      if (replayChartHarness.plotLayout) onPlotLayoutChange?.(replayChartHarness.plotLayout);
    }, [onPlotLayoutChange]);
    replayChartHarness.lastProps = { averageCost, settings, onPlanPriceChange, planLinesEditable, onRequestCursorTool, onPlotLayoutChange };
    return <div className="chart-stage">
      <div data-testid="mock-replay-chart" data-active-tool={activeTool} data-selected-drawing-id={selectedDrawingId ?? ""} data-cursor={cursor} data-execution-cursor={executions?.at(-1)?.id} data-revealed-candles={candles?.map((candle) => candle.time).join(",")} data-drawing-ids={drawings?.map((drawing) => drawing.id).join(",")} />
      <button type="button" onClick={() => onCommand({ type: "add", drawing: replayDrawing })}>add drawing</button>
      <button type="button" onClick={() => onCommand({ type: "add", drawing: {...replayDrawing, id: "text-1", tool: "text", text: "新 Text"} })}>add Text</button>
      <button type="button" onClick={() => onCommand({ type: "add", drawing: {...replayDrawing, id: "text-2", tool: "text", text: "第二个 Text"} })}>add second Text</button>
      <button type="button" onClick={() => onSelectDrawing?.("text-1")}>select Text</button>
      <button type="button" onClick={() => onDrawingInteractionStart?.()}>start drawing interaction</button>
    </div>;
  },
}));

const drawing = {
  version: 2 as const,
  id: "drawing-1",
  episodeId: "episode-1",
  name: "测试线",
  tool: "horizontal-line" as const,
  anchors: [{ time: "2025-01-02T10:00:00.000Z", price: 10 }],
  style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
  zIndex: 0,
  hidden: false,
  locked: false,
  visibleOn: "all" as const,
  stage: "during-replay" as const,
  createdAtCursor: "2025-01-02T10:00:00.000Z",
};

const candle: Candle = {
  time: "2025-01-02T10:00:00.000Z",
  knowledgeAt: "2025-01-02T10:15:00.000Z",
  open: 10,
  high: 11,
  low: 9,
  close: 10.5,
  volume: 100,
};

const episode: TradeEpisode = {
  id: "episode-1",
  accountId: "account-1",
  accountLabel: "Test account",
  instrument: {
    id: "US:TEST",
    symbol: "TEST",
    name: "Test",
    market: "US",
    currency: "USD",
  },
  direction: "long",
  status: "closed",
  startedAt: "2025-01-02T10:00:00.000Z",
  endedAt: "2025-01-02T10:20:00.000Z",
  openingQuantity: "1",
  remainingQuantity: "0",
  executions: [{
    id: "fill-1",
    source: { platform: "test", row: 1 },
    accountId: "account-1",
    accountLabel: "Test account",
    instrument: {
      id: "US:TEST",
      symbol: "TEST",
      name: "Test",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2025-01-02T10:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
  }],
};

const availability = {
  "15m": { enabled: true },
  "1h": { enabled: false, reason: "no hourly" },
  "4h": { enabled: false, reason: "no hourly" },
  "1D": { enabled: true },
  "1W": { enabled: true },
} as const;

const settings = {
  version: 1 as const,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red" as const,
};

const replayCandles = [
  candle,
  { ...candle, time: "2025-01-02T10:15:00.000Z", knowledgeAt: "2025-01-02T10:30:00.000Z" },
  { ...candle, time: "2025-01-02T10:30:00.000Z", knowledgeAt: "2025-01-02T10:45:00.000Z" },
];
const incompleteWeeklyCandle = {
  ...candle,
  time: "2025-01-01T00:00:00.000Z",
  knowledgeAt: "2025-01-10T00:00:00.000Z",
};
const replayEpisode: TradeEpisode = {
  ...episode,
  executions: [
    episode.executions[0],
    { ...episode.executions[0], id: "fill-2", executedAt: "2025-01-02T10:16:00.000Z", side: "buy" },
    { ...episode.executions[0], id: "fill-3", executedAt: "2025-01-02T10:31:00.000Z", side: "sell" },
  ],
};

const dateOnlyPreEntryEpisode: TradeEpisode = {
  ...episode,
  id: "date-only-pre-entry-episode",
  executions: [
    {
      ...episode.executions[0],
      id: "date-entry",
      executedAt: "2025-01-02T08:00:00.000Z",
      source: { ...episode.executions[0].source, timePrecision: "date-only" },
    },
    {
      ...episode.executions[0],
      id: "date-exit",
      executedAt: "2025-01-02T07:00:00.000Z",
      side: "sell",
      source: { ...episode.executions[0].source, timePrecision: "date-only" },
    },
  ],
};

const completionEpisode: TradeEpisode = {
  ...episode,
  id: "completion-episode",
  status: "closed",
  startedAt: "2025-01-02T10:00:00.000Z",
  endedAt: "2025-01-02T10:31:00.000Z",
  openingQuantity: "10",
  remainingQuantity: "0",
  executions: [
    { ...episode.executions[0], id: "completion-entry", executedAt: "2025-01-02T10:00:00.000Z", quantity: "10", price: "10", fee: "1" },
    { ...episode.executions[0], id: "completion-partial", executedAt: "2025-01-02T10:16:00.000Z", side: "sell", quantity: "6", price: "14", fee: "1" },
    { ...episode.executions[0], id: "completion-close", executedAt: "2025-01-02T10:31:00.000Z", side: "sell", quantity: "4", price: "12", fee: "1" },
  ],
};

function renderRecall(
  nextEpisode: TradeEpisode,
  initial: RecallDocument,
  repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockResolvedValue({ ...initial, revision: initial.revision + 1 }),
    fetch: vi.fn(),
  },
  onLeaveGuardChange?: (guard: (() => Promise<boolean>) | null) => void,
  candlesByTimeframe = { "15m": replayCandles, "1D": replayCandles, "1W": replayCandles },
  initialDrawings: NormalizedDrawing[] = [],
  compactControls = false,
  headerActions: ReactNode = null,
) {
  return render(
    <RecallWorkspace
      episode={nextEpisode}
      episodes={[nextEpisode]}
      instrument={nextEpisode.instrument}
      instruments={[{ ...nextEpisode.instrument, market: "US" }]}
      timeframeAvailability={availability}
      importedTimelineCandles={replayCandles}
      candlesByTimeframe={candlesByTimeframe}
      settings={settings}
      initialDrawings={initialDrawings}
      repository={repository}
      onEpisodeChange={vi.fn()}
      onInstrumentChange={vi.fn()}
      onSettingsChange={vi.fn()}
      onLeaveGuardChange={onLeaveGuardChange}
      compactControls={compactControls}
      headerActions={headerActions}
    />,
  );
}

describe("recommended panel control contracts", () => {
  it("keeps parent actions in a native More menu and returns focus on Escape", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const onData = vi.fn();
    const onStock = vi.fn();
    const onReturn = vi.fn();
    const onRepair = vi.fn();
    const onFocus = vi.fn();
    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], false, (
      <div className="recall-header-actions">
        <button type="button" className="recall-header-action" aria-label="打开导入与数据管理" onClick={onData}>数据</button>
        <button type="button" className="recall-header-action" aria-label="打开股票列表" onClick={onStock}>股票</button>
        <button type="button" className="recall-header-action" onClick={onReturn}>返回我的交易室</button>
        <button type="button" className="recall-header-action" aria-label="检查/修复数据" onClick={onRepair}>检查/修复数据</button>
        <button type="button" className="recall-header-action" onClick={onFocus}>专注图表</button>
      </div>
    ));

    const summary = await screen.findByLabelText("更多操作");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary).toHaveAttribute("title", "更多操作");
    const menu = summary.closest("details") as HTMLDetailsElement;
    expect(menu).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(menu).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "打开导入与数据管理" })).toBeVisible();
    expect(screen.getByRole("button", { name: "打开股票列表" })).toBeVisible();
    expect(screen.getByRole("button", { name: "返回我的交易室" })).toBeVisible();
    expect(screen.getByRole("button", { name: "检查/修复数据" })).toBeVisible();
    expect(screen.getByRole("button", { name: "专注图表" })).toBeVisible();

    summary.focus();
    expect(summary).toHaveFocus();
    // jsdom's user-event tabbable selector does not include native <summary>;
    // anchor on the focused summary, then verify Tab traversal across every action.
    const data = screen.getByRole("button", { name: "打开导入与数据管理" });
    data.focus();
    expect(data).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "打开股票列表" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "返回我的交易室" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "检查/修复数据" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "专注图表" })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "打开股票列表" }));
    expect(onStock).toHaveBeenCalledTimes(1);
    expect(menu).not.toHaveAttribute("open");

    await userEvent.click(summary);
    summary.focus();
    const repair = screen.getByRole("button", { name: "检查/修复数据" });
    repair.focus();
    await userEvent.keyboard("{Escape}");
    expect(menu).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();
  });

  it("keeps More's remembered plan state when narrow mode yields it", () => {
    const initial = { episodeId: "episode-1", planOpen: true, moreOpen: false, rememberedPlanOpen: null };
    const open = transitionRecallPanelState(initial, { type: "toggle-more", contentWidth: 390 });
    expect(open).toMatchObject({ moreOpen: true, planOpen: false, rememberedPlanOpen: true });
    expect(transitionRecallPanelState(open, { type: "toggle-more", contentWidth: 390 })).toMatchObject({ moreOpen: false, planOpen: true, rememberedPlanOpen: null });
  });

  it("uses stable edge identities and does not let Space on controls play replay", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], true);
    const user = userEvent.setup();
    const left = await screen.findByRole("button", { name: "收起回合与决策导航" });
    const right = await screen.findByRole("button", { name: "关闭计划侧栏" });
    const more = await screen.findByRole("button", { name: "更多 / 记录" });
    const play = await screen.findByRole("button", { name: "播放回放" });
    const readPosition = () => {
      const cutoff = screen.getByLabelText(/行情时间/);
      const chart = screen.getByTestId("mock-replay-chart");
      return {
        fullCutoffs: cutoff.getAttribute("aria-label"),
        cutoffs: Array.from(cutoff.querySelectorAll("span")).map(span => ({ text: span.textContent, fullTime: span.title })),
        marketCursor: chart.getAttribute("data-cursor"),
        executionCursor: chart.getAttribute("data-execution-cursor"),
        candles: chart.getAttribute("data-revealed-candles"),
        phase: document.querySelector('.recall-phases [aria-pressed="true"]')?.textContent,
      };
    };
    const position = readPosition();
    expect(position.cutoffs).toHaveLength(2);
    const expectLayoutOnly = () => {
      expect(readPosition()).toEqual(position);
      expect(replayChartHarness.handle.fitAll).not.toHaveBeenCalled();
    };
    expect(left).toHaveAttribute("aria-controls", "recall-nav-episode-1");
    expect(right).toHaveAttribute("aria-controls", "recall-plan-sidebar-episode-1");
    expect(more).toHaveAttribute("aria-controls", "recall-replay-more-body-episode-1");
    more.focus();
    await user.keyboard(" ");
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "更多 / 记录" })).toBe(more);
    expect(play).toHaveAttribute("aria-pressed", "false");
    expectLayoutOnly();
    await user.keyboard("{ENTER}");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expectLayoutOnly();
    await user.click(left);
    const closedLeft = screen.getByRole("button", { name: "展开回合与决策导航" });
    expect(closedLeft).toBe(left);
    expectLayoutOnly();
    await user.click(left);
    const openLeft = screen.getByRole("button", { name: "收起回合与决策导航" });
    expect(openLeft).toBe(left);
    expect(left).toHaveAttribute("aria-expanded", "true");
    expectLayoutOnly();
    await user.click(right);
    const closedRight = screen.getByRole("button", { name: "打开计划侧栏" });
    expect(closedRight).toBe(right);
    expect(left).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("recall-plan-sidebar-episode-1")).toHaveAttribute("hidden");
    expectLayoutOnly();
    await user.click(right);
    const openRight = screen.getByRole("button", { name: "关闭计划侧栏" });
    expect(openRight).toBe(right);
    expect(right).toHaveAttribute("aria-expanded", "true");
    expectLayoutOnly();
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const moreBodyAction = screen.getByRole("button", { name: "完整历史" });
    moreBodyAction.focus();
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(more);
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "更多 / 记录" })).toBe(more);
    expectLayoutOnly();
  });
});

describe("real review replay journey", () => {
  it("guards workspace Space playback behind one pending Text decision", async () => {
    const base = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const initial: RecallDocument = {
      ...base,
      working: {
        ...base.working,
        phase: "pre-entry",
        hasSeenFuture: false,
        cursor: "2025-01-02T09:59:59.000Z",
        executionCursor: NO_REVEALED_EXECUTIONS,
      },
    };
    renderRecall(replayEpisode, initial);

    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-revealed-candles", replayCandles[0].time));
    const cutoffBeforeGuard = {
      candles: chart.getAttribute("data-revealed-candles"),
      executions: chart.getAttribute("data-execution-cursor"),
    };
    const workspace = screen.getByRole("region", { name: "导入交易回忆复盘工作区" });
    const play = screen.getByRole("button", { name: "播放" });

    let releaseContinue!: (allowed: boolean) => void;
    replayChartHarness.handle.prepareTextDraft.mockReset();
    fireEvent.keyDown(workspace, { key: " ", code: "Space", isComposing: true });
    expect(replayChartHarness.handle.prepareTextDraft).not.toHaveBeenCalled();
    expect(play).toHaveAttribute("aria-pressed", "false");
    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(() => new Promise(resolve => { releaseContinue = resolve; }));
    fireEvent.keyDown(workspace, { key: " ", code: "Space" });
    fireEvent.keyDown(workspace, { key: " ", code: "Space" });
    await Promise.resolve();
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledTimes(1);
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("phase-change");
    expect(play).toHaveAttribute("aria-pressed", "false");
    expect(chart).toHaveAttribute("data-revealed-candles", cutoffBeforeGuard.candles);
    expect(chart).toHaveAttribute("data-execution-cursor", cutoffBeforeGuard.executions);

    await act(async () => { releaseContinue(false); });
    expect(play).toHaveAttribute("aria-pressed", "false");
    expect(chart).toHaveAttribute("data-revealed-candles", cutoffBeforeGuard.candles);
    expect(chart).toHaveAttribute("data-execution-cursor", cutoffBeforeGuard.executions);

    let releaseComplete!: (allowed: boolean) => void;
    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(() => new Promise(resolve => { releaseComplete = resolve; }));
    fireEvent.keyDown(workspace, { key: " ", code: "Space" });
    await Promise.resolve();
    expect(play).toHaveAttribute("aria-pressed", "false");
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledTimes(2);
    await act(async () => { releaseComplete(true); });
    await waitFor(() => expect(play).toHaveAttribute("aria-pressed", "true"));
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledTimes(2);
    expect(chart).toHaveAttribute("data-revealed-candles", cutoffBeforeGuard.candles);
    expect(chart).toHaveAttribute("data-execution-cursor", cutoffBeforeGuard.executions);
  });

  it("guards rewind and playback behind one pending Text decision", async () => {
    const base = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const initial: RecallDocument = {
      ...base,
      working: {
        ...base.working,
        phase: "pre-entry",
        hasSeenFuture: false,
        cursor: "2025-01-02T09:59:59.000Z",
        executionCursor: NO_REVEALED_EXECUTIONS,
      },
    };
    renderRecall(replayEpisode, initial);

    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-revealed-candles", replayCandles[0].time));
    const revealedBeforeRewind = chart.getAttribute("data-revealed-candles");

    let release!: (allowed: boolean) => void;
    replayChartHarness.handle.prepareTextDraft.mockReset();
    replayChartHarness.handle.prepareTextDraft.mockImplementation(() => new Promise(resolve => { release = resolve; }));

    fireEvent.click(screen.getByRole("button", { name: "上一根 K 线" }));
    await Promise.resolve();
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("phase-change");
    expect(chart).toHaveAttribute("data-revealed-candles", revealedBeforeRewind);

    fireEvent.click(screen.getByRole("button", { name: "播放" }));
    await Promise.resolve();
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "播放" })).toHaveAttribute("aria-pressed", "false");

    await act(async () => { release(true); });
    await waitFor(() => expect(chart).not.toHaveAttribute("data-revealed-candles", revealedBeforeRewind));
  });

  it("saves a Text completion made by the save guard in the current draft", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const save = vi.fn(async (next: RecallDocument) => ({ ...next, revision: next.revision + 1 }));
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      fetch: vi.fn(),
      save,
    };
    let leaveGuard: (() => Promise<boolean>) | null = null;
    renderRecall(replayEpisode, initial, repository, guard => { leaveGuard = guard; });

    fireEvent.click(await screen.findByRole("button", { name: "add drawing" }));
    replayChartHarness.handle.prepareTextDraft.mockReset();
    replayChartHarness.handle.prepareTextDraft.mockImplementation(async reason => {
      if (reason === "save") fireEvent.click(screen.getByRole("button", { name: "add Text" }));
      return true;
    });

    await act(async () => { expect(await leaveGuard!()).toBe(true); });
    const saved = save.mock.calls.at(-1)?.[0] as RecallDocument | undefined;
    const savedText = saved && [
      ...saved.working.drawings,
      ...(saved.working.editingContext?.drawings ?? []),
      ...Object.values(saved.working.phaseContexts ?? {}).flatMap(context => context.drawings),
      ...(saved.working.decisionDrafts ?? []).flatMap(context => context.drawings),
    ].find(candidate => candidate.id === "text-1");
    expect(savedText).toMatchObject({ tool: "text", text: "新 Text" });
  });

  it("waits for the text draft decision before leaving the review", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    let release!: (allowed: boolean) => void;
    replayChartHarness.handle.prepareTextDraft.mockReset();
    replayChartHarness.handle.prepareTextDraft.mockResolvedValue(true);
    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let leaveGuard: (() => Promise<boolean>) | null = null;
    renderRecall(replayEpisode, initial, undefined, guard => { leaveGuard = guard; });

    await screen.findByTestId("mock-replay-chart");
    expect(leaveGuard).not.toBeNull();
    let leaving: Promise<boolean> | undefined;
    await act(async () => { leaving = leaveGuard!(); });
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("leave");
    let settled = false;
    void leaving!.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await act(async () => { release(true); });
    await expect(leaving).resolves.toBe(true);
  });

  it("keeps a failed save dirty and retries the same candidate", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      fetch: vi.fn(),
      save: vi.fn()
        .mockRejectedValueOnce(new Error("服务暂不可用"))
        .mockImplementation(async (document: RecallDocument) => ({ ...document, revision: document.revision + 1 })),
    };
    let leaveGuard: (() => Promise<boolean>) | null = null;
    renderRecall(replayEpisode, initial, repository, guard => { leaveGuard = guard; });

    fireEvent.click(await screen.findByRole("button", { name: "add drawing" }));
    await act(async () => { expect(await leaveGuard!()).toBe(false); });
    expect(screen.getByRole("dialog")).toHaveTextContent("服务暂不可用");
    const retry = screen.getByRole("button", { name: "重试保存" });
    fireEvent.click(retry);
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "重试保存" })).not.toBeInTheDocument();
  });

  it("keeps S0 cutoffs, an anchored Text stage, and the early cursor after save and reopen", async () => {
    const isolatedDbPath = `${process.cwd()}/.scratch/review-visual-baseline-plan-20261011/evidence/task-1-journey.sqlite`;
    process.env.TRADEREVIEW_DB_PATH = isolatedDbPath;
    let persisted: RecallDocument | undefined;
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const s0: RecallDocument = {
      ...initial,
      working: {
        ...initial.working,
        phase: "pre-entry",
        hasSeenFuture: false,
        cursor: "2025-01-02T09:59:59.000Z",
        executionCursor: NO_REVEALED_EXECUTIONS,
      },
    };
    const repository: RecallRepository = {
      load: vi.fn(async () => structuredClone(persisted ?? s0)),
      save: vi.fn(async (document: RecallDocument): Promise<RecallDocument> => {
        const next: RecallDocument = structuredClone({ ...document, revision: document.revision + 1 });
        persisted = next;
        return structuredClone(next);
      }),
      fetch: vi.fn(),
    };
    let leaveGuard: (() => Promise<boolean>) | null = null;

    const rendered = renderRecall(replayEpisode, s0, repository, guard => { leaveGuard = guard; });
    const chart = await screen.findByTestId("mock-replay-chart");
    expect(chart).toHaveAttribute("data-revealed-candles", "");
    expect(chart).not.toHaveAttribute("data-execution-cursor");

    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-revealed-candles", replayCandles[0].time));
    fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-execution-cursor", "fill-2"));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    fireEvent.click(screen.getByRole("button", { name: "上一根 K 线" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-revealed-candles", replayCandles[0].time));

    expect(leaveGuard).not.toBeNull();
    await act(async () => { await leaveGuard!(); });
    expect(repository.save).toHaveBeenCalled();
    const saved = persisted!;
    const savedText = [
      ...saved.working.drawings,
      ...(saved.working.editingContext?.drawings ?? []),
      ...Object.values(saved.working.phaseContexts ?? {}).flatMap(context => context.drawings),
      ...(saved.working.decisionDrafts ?? []).flatMap(context => context.drawings),
    ].find(drawing => drawing.id === "text-1");
    expect(savedText).toMatchObject({
      tool: "text",
      stage: "during-replay",
      anchors: [{ time: replayCandles[0].time, price: 10 }],
    });
    const savedContext = saved.working.editingContext!;
    const savedCutoff = {
      cursor: savedContext.cursor,
      executionCursor: savedContext.executionCursor,
      phase: saved.working.phase,
      hasSeenFuture: saved.working.hasSeenFuture,
    };

    rendered.unmount();
    renderRecall(replayEpisode, saved, repository, guard => { leaveGuard = guard; });
    const reopenedChart = await screen.findByTestId("mock-replay-chart");
    await waitFor(() => expect(reopenedChart).toHaveAttribute("data-revealed-candles", replayCandles[0].time));
    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(reopenedChart).toHaveAttribute("data-cursor", savedCutoff.cursor);
    expect(reopenedChart).toHaveAttribute("data-execution-cursor", savedCutoff.executionCursor);
    expect(reopenedChart).toHaveAttribute("data-drawing-ids", "text-1");
    const reopenedText = [
      ...saved.working.drawings,
      ...(saved.working.editingContext?.drawings ?? []),
      ...Object.values(saved.working.phaseContexts ?? {}).flatMap(context => context.drawings),
      ...(saved.working.decisionDrafts ?? []).flatMap(context => context.drawings),
    ].find(drawing => drawing.id === "text-1");
    expect(reopenedText).toMatchObject(savedText!);
    expect(saved.working.phase).toBe(savedCutoff.phase);
    expect(saved.working.hasSeenFuture).toBe(savedCutoff.hasSeenFuture);
  });

  it("keeps future decisions out of replay presentation while retaining full history disclosure", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const s0: RecallDocument = {
      ...initial,
      working: {
        ...initial.working,
        phase: "pre-entry",
        hasSeenFuture: true,
        cursor: "2025-01-02T09:59:59.000Z",
        executionCursor: NO_REVEALED_EXECUTIONS,
        selectedDecisionId: "fill-1",
      },
    };

    renderRecall(replayEpisode, s0);
    const navigation = await screen.findByRole("complementary", { name: "回合与决策导航" });
    expect(navigation).not.toHaveTextContent("3 笔决策");
    expect(navigation).not.toHaveTextContent("决策 2");
    expect(navigation).not.toHaveTextContent("决策 3");
    expect(screen.getByText("逐步 · 当前计划")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-1"));
    expect(navigation).toHaveTextContent("1 笔决策");
    expect(navigation).not.toHaveTextContent("决策 2");
    expect(navigation).not.toHaveTextContent("决策 3");

    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("已揭示成交1 / 1");

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(navigation).toHaveTextContent("3 笔决策"));
    expect(screen.getAllByRole("button", { name: /买 1 @ 10/ }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: /卖 1 @ 10/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("已揭示成交3 / 3");

    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => expect(navigation).toHaveTextContent("1 笔决策"));
    expect(navigation).not.toHaveTextContent("决策 2");
    expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("已揭示成交1 / 1");
  });

  it.each([
    ["pre-entry", "复盘补记 · 买入事实尚未揭示"],
    ["holding", "持仓过程 · 仅展示当前已知事实"],
  ] as const)("labels temporary full history and restores the %s replay prompt", async (phase, replayPrompt) => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const replayDocument: RecallDocument = {
      ...initial,
      working: {
        ...initial.working,
        phase,
        hasSeenFuture: false,
        cursor: phase === "pre-entry" ? "2025-01-02T09:59:59.000Z" : replayCandles[0].knowledgeAt!,
        executionCursor: phase === "pre-entry" ? NO_REVEALED_EXECUTIONS : "fill-1",
      },
    };

    renderRecall(replayEpisode, replayDocument);
    const provenance = () => document.querySelector(".recall-phase-provenance") as HTMLElement;
    await waitFor(() => expect(provenance()).toHaveTextContent(replayPrompt));

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(provenance()).toHaveTextContent("完整历史临时视图 · 当前回合成交全部显示"));
    expect(screen.getByText(/完整历史临时视图：当前回合成交全部显示/)).toBeInTheDocument();
    expect(provenance()).not.toHaveTextContent(replayPrompt);
    expect(document.querySelector(".recall-position-strip strong")).toHaveTextContent("完整历史");
    const temporaryCutoff = document.querySelector(".recall-replay-cutoff") as HTMLElement;
    expect(temporaryCutoff).toHaveTextContent("行情时间");
    expect(temporaryCutoff).toHaveTextContent("成交截止");
    if (phase === "pre-entry") {
      expect(document.querySelector(".recall-position-details")).toHaveTextContent("完整历史临时视图 · 当前回合成交全部显示");
      expect(document.querySelector(".recall-position-details")).not.toHaveTextContent("仅记录计划 · 成交尚未揭示");
    }

    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => expect(provenance()).toHaveTextContent(replayPrompt));
    expect(provenance()).not.toHaveTextContent("完整历史临时视图 · 当前回合成交全部显示");
    expect(document.querySelector(".recall-position-strip strong")).toHaveTextContent("逐步");
    if (phase === "pre-entry") {
      expect(document.querySelector(".recall-position-details")).toHaveTextContent("计划待记录 · 成交尚未揭示");
    }
  });

  it("hides an unrevealed execution inside a same-bar decision and keeps split unavailable", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T09:00:00.000Z");
    const sameBarDocument: RecallDocument = {
      ...initial,
      decisions: [
        { ...initial.decisions[0], executionIds: ["fill-1", "fill-2"] },
        { ...initial.decisions[2], executionIds: ["fill-3"] },
      ],
      snapshots: [
        { ...retainedSnapshot(replayEpisode, initial.decisions[0].id), id: "future-decision-snapshot", cursor: "2025-01-02T10:31:00.000Z", executionCursor: "fill-2" },
        { ...retainedSnapshot(replayEpisode, "global"), id: "future-global-snapshot", cursor: "2025-01-02T10:31:00.000Z", executionCursor: "fill-2" },
      ],
      working: {
        ...initial.working,
        phase: "holding",
        hasSeenFuture: true,
        cursor: "2025-01-02T10:15:00.000Z",
        executionCursor: "fill-1",
        selectedDecisionId: initial.decisions[0].id,
      },
    };

    renderRecall(replayEpisode, sameBarDocument);
    const navigation = await screen.findByRole("complementary", { name: "回合与决策导航" });
    expect(navigation).toHaveTextContent("1 笔决策");
    expect(navigation).toHaveTextContent("买 1 @ 10");
    expect(navigation).not.toHaveTextContent("卖 1 @ 10:31");
    expect(navigation).toHaveTextContent("尚未留存");
    expect(screen.queryByRole("button", { name: "拆分当前决策" })).not.toBeInTheDocument();
    openAllSnapshotRecords();
    expect(screen.getByText("全部记录与快照（0）")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("已揭示成交1 / 1");
  });
});

function openMoreRecords() {
  const summary = screen.getByRole("button", { name: "更多 / 记录" });
  if (summary.getAttribute("aria-expanded") !== "true") fireEvent.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
}

function openPlanSecondaryDetails() {
  const planToggle = screen.getByRole("button", { name: "计划侧栏" });
  if (planToggle.getAttribute("aria-expanded") !== "true") fireEvent.click(planToggle);
  const sidebar = screen.getByRole("complementary", { name: "阶段计划" });
  const summary = sidebar.querySelector(".recall-plan-secondary-content details > summary");
  const details = summary?.closest("details");
  if (!(details instanceof HTMLDetailsElement) || !summary) throw new Error("Plan secondary disclosure is missing");
  if (!details.open) act(() => fireEvent.click(summary));
  expect(details.open).toBe(true);
}

function openAllSnapshotRecords() {
  openMoreRecords();
  const summary = screen.getByText(/全部记录与快照/);
  const details = summary.closest("details");
  if (!(details instanceof HTMLDetailsElement)) throw new Error("Snapshot disclosure is missing");
  if (!details.open) fireEvent.click(summary);
  expect(details.open).toBe(true);
}

function openStoryboard() {
  openMoreRecords();
  const summary = screen.getByText("三阶段代表图", { exact: true });
  const details = summary.closest("details");
  if (!(details instanceof HTMLDetailsElement)) throw new Error("Storyboard disclosure is missing");
  if (!details.open) fireEvent.click(summary);
  expect(details.open).toBe(true);
}

async function waitForRecallChartReady(getGuard?: () => (() => Promise<boolean>) | null) {
  await screen.findByTestId("mock-replay-chart");
  await waitFor(() => expect(replayChartHarness.readyCount).toBeGreaterThan(0));
  if (getGuard) await waitFor(() => expect(getGuard()).not.toBeNull());
}

function retainedSnapshot(nextEpisode: TradeEpisode, decisionId = nextEpisode.executions[0].id): RecallSnapshot {
  return {
    id: "snapshot-1",
    decisionId,
    timeframe: "1D",
    cursor: replayCandles[0].knowledgeAt ?? replayCandles[0].time,
    executionCursor: nextEpisode.executions[0].id,
    candles: [replayCandles[0]],
    drawings: [],
    viewport: replayChartHarness.viewport,
    imageDataUrl: "data:image/png;base64,AA==",
    createdAt: "2025-01-02T10:01:00.000Z",
    updatedAt: "2025-01-02T10:01:00.000Z",
  };
}

beforeEach(() => {
  replayChartHarness.deferReady = false;
  replayChartHarness.pendingReady = null;
  replayChartHarness.readyCount = 0;
  replayChartHarness.plotLayout = null;
  replayChartHarness.lastProps = null;
  replayChartHarness.handle.capture.mockReset();
  replayChartHarness.handle.capture.mockResolvedValue({
    imageDataUrl: "data:image/png;base64,AA==",
    viewport: replayChartHarness.viewport,
  });
  replayChartHarness.handle.prepareTextDraft.mockReset();
  replayChartHarness.handle.prepareTextDraft.mockResolvedValue(true);
  replayChartHarness.handle.getViewport.mockClear();
  replayChartHarness.handle.getViewport.mockReturnValue(replayChartHarness.viewport);
  replayChartHarness.handle.restoreViewport.mockClear();
  replayChartHarness.handle.fitAll.mockClear();
});

afterEach(() => {
  cleanup();
  // Fake-timer tests can leave debounced autosave work queued. Clear it while
  // the fake clock is still installed so it cannot perturb the next test's
  // chart-ready/phase-restore scheduling.
  vi.clearAllTimers();
  vi.useRealTimers();
  if (originalTradereviewDbPath === undefined) delete process.env.TRADEREVIEW_DB_PATH;
  else process.env.TRADEREVIEW_DB_PATH = originalTradereviewDbPath;
});

describe("RecallWorkspace autosave reconciliation", () => {
  it("pauses playback through the real replay drawing interaction callback", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], true);
    const play = await screen.findByRole("button", { name: "播放回放" });
    fireEvent.click(play);
    await waitFor(() => expect(play).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "start drawing interaction" }));
    expect(screen.getByRole("button", { name: "播放回放" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not turn an automatic debounce of a pending Text buffer into a Text decision", async () => {
    vi.useFakeTimers();
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockResolvedValue({ ...initial, revision: initial.revision + 1 }),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const guardReasons: string[] = [];
    replayChartHarness.handle.prepareTextDraft.mockImplementation(async reason => {
      guardReasons.push(reason);
      return true;
    });

    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(guardReasons).not.toContain("save");
    vi.useRealTimers();
  });

  it("returns the Recall drawing tool to cursor after a text add callback", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "text"));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "cursor"));
    expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1");
  });

  it("deletes the selected visible Text through the guarded toolbar action", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");

    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "text-1"));

    const deleteButton = screen.getByRole("button", { name: "删除选中的批注" });
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", ""));
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("selection");
    expect(chart).toHaveAttribute("data-selected-drawing-id", "");

    fireEvent.click(screen.getByRole("button", { name: "撤销绘图" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "text-1"));
    fireEvent.click(screen.getByRole("button", { name: "重做绘图" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", ""));
  });

  it("keeps the selected Text when the selection guard rejects the delete", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1"));

    replayChartHarness.handle.prepareTextDraft.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "删除选中的批注" }));
    await waitFor(() => expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("selection"));
    expect(chart).toHaveAttribute("data-drawing-ids", "text-1");
    expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1");
  });

  it.each([
    ["locked", { locked: true, hidden: false }],
    ["hidden", { locked: false, hidden: true }],
  ] as const)("disables selected Text deletion for a %s drawing", async (_kind, flags) => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const textDrawing = { ...drawing, id: "text-1", tool: "text" as const, text: "受保护 Text", ...flags };
    initial.working.drawings = [textDrawing];
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "select Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1"));
    expect(screen.getByRole("button", { name: "删除选中的批注" })).toBeDisabled();
  });

  it("does not retarget a pending delete when selection changes during the guard", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1"));

    let releaseGuard!: (allowed: boolean) => void;
    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(() => new Promise(resolve => { releaseGuard = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "删除选中的批注" }));
    await waitFor(() => expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("selection"));
    fireEvent.click(screen.getByRole("button", { name: "add second Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-2"));
    releaseGuard(true);

    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "text-1,text-2"));
    expect(chart).toHaveAttribute("data-selected-drawing-id", "text-2");
  });

  it("keeps a newly added S2 Text editable while the historical view stays guarded", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "post-review";
    initial.working.hasSeenFuture = true;
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1"));
    expect(screen.getByRole("button", { name: "删除选中的批注" })).toBeEnabled();
  });

  it("disables selected Text deletion in temporary full history", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    fireEvent.click(screen.getByRole("button", { name: "add Text" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1"));
    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "删除选中的批注" })).toBeDisabled());
  });

  it("disables selected Text deletion while editing a retained snapshot", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const snapshot = retainedSnapshot(replayEpisode);
    snapshot.drawings = [{ ...drawing, id: "text-1", tool: "text", text: "快照 Text" }];
    initial.snapshots = [snapshot];
    initial.working = { ...initial.working, phase: "post-review", hasSeenFuture: true, selectedDecisionId: "fill-1" };
    renderRecall(replayEpisode, initial);
    await screen.findByTestId("mock-replay-chart");
    openAllSnapshotRecords();
    fireEvent.click(screen.getByRole("button", { name: /编辑.*快照/ }));
    fireEvent.click(screen.getByRole("button", { name: "select Text" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "删除选中的批注" })).toBeDisabled());
  });

  it("routes Replay's cursor request through the guarded Recall tool change", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], true);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "文字标注" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "text"));
    replayChartHarness.lastProps?.onRequestCursorTool?.();
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "cursor"));
    expect(replayChartHarness.handle.prepareTextDraft).toHaveBeenCalledWith("tool-change");
  });

  it("keeps a geometric drawing tool selected after a non-text add", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "趋势线" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "trend-line"));
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-active-tool", "trend-line"));
  });

  it("undoes the latest history after the Text guard commits before the continuation", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");

    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "drawing-1"));

    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(async reason => {
      expect(reason).toBe("undo");
      fireEvent.click(screen.getByRole("button", { name: "add Text" }));
      return true;
    });
    fireEvent.click(screen.getByRole("button", { name: "撤销绘图" }));

    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "drawing-1"));
    expect(chart).toHaveAttribute("data-selected-drawing-id", "");
    expect(chart).toHaveAttribute("data-active-tool", "cursor");

    fireEvent.click(screen.getByRole("button", { name: "重做绘图" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "drawing-1,text-1"));
    expect(chart).toHaveAttribute("data-selected-drawing-id", "text-1");
    expect(chart).toHaveAttribute("data-active-tool", "cursor");
  });

  it("clears the latest history after the Text guard commits before the continuation", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");

    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "drawing-1"));

    replayChartHarness.handle.prepareTextDraft.mockImplementationOnce(async reason => {
      expect(reason).toBe("clear");
      fireEvent.click(screen.getByRole("button", { name: "add Text" }));
      return true;
    });
    fireEvent.click(screen.getByRole("button", { name: "清空绘图" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", ""));

    fireEvent.click(screen.getByRole("button", { name: "撤销绘图" }));
    await waitFor(() => expect(chart).toHaveAttribute("data-drawing-ids", "drawing-1,text-1"));
  });

  it("keeps the replay bar compact while preserving record actions behind More", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);

    const replayBar = await waitFor(() => {
      const element = document.querySelector(".recall-replay-bar");
      expect(element).not.toBeNull();
      return element!;
    });
    const positionStrip = replayBar.querySelector(":scope > .recall-position-strip");
    expect(positionStrip).not.toBeNull();
    expect(positionStrip).toHaveTextContent("持仓");
    expect(positionStrip).not.toHaveTextContent("净盈亏");
    expect(replayBar.querySelector(":scope > .recall-controls")).not.toBeNull();
    const more = replayBar.querySelector(":scope > .recall-replay-more") as HTMLDivElement | null;
    expect(more).not.toBeNull();
    expect(more).toHaveAttribute("data-open", "false");
    const moreBody = more?.querySelector(":scope > .recall-replay-more__body");
    expect(moreBody).not.toBeNull();
    expect(moreBody).toHaveAttribute("hidden");
    const moreButton = screen.getByRole("button", { name: "更多 / 记录" });
    expect(moreButton).toHaveAttribute("aria-controls", moreBody?.getAttribute("id") ?? "");

    fireEvent.click(moreButton);
    expect(more).toHaveAttribute("data-open", "true");
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    expect(moreBody).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "完整历史" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存并完成回合复盘/ })).toBeInTheDocument();
    expect(replayBar.querySelector(".recall-replay-more__panel[aria-label=\"三阶段代表图\"]")).not.toBeNull();
    expect(replayBar.querySelector(".recall-replay-more__panel[aria-label=\"阶段快照\"]")).not.toBeNull();

    fireEvent.click(moreButton);
    expect(more).toHaveAttribute("data-open", "false");
    expect(moreButton).toHaveAttribute("aria-expanded", "false");
    expect(moreBody).toHaveAttribute("hidden");
  });

  it("maps the SDK plot center into the footer coordinate space once", async () => {
    replayChartHarness.plotLayout = { width: 600, height: 400, axisWidth: 80, plotCenterX: 250 };
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const computedStyleSpy = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const computed = originalGetComputedStyle(element);
      if (element instanceof HTMLElement && element.classList.contains("recall-replay-bar")) {
        Object.defineProperties(computed, {
          borderLeftWidth: { configurable: true, value: "1px" },
          paddingLeft: { configurable: true, value: "8px" },
          columnGap: { configurable: true, value: "6px" },
        });
      }
      return computed;
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("chart-stage")) return { left: 420, top: 120, width: 600, height: 400, right: 1020, bottom: 520, x: 420, y: 120, toJSON: () => ({}) } as DOMRect;
      if (this.classList.contains("recall-replay-bar")) return { left: 100, top: 540, width: 900, height: 48, right: 1000, bottom: 588, x: 100, y: 540, toJSON: () => ({}) } as DOMRect;
      if (this.classList.contains("recall-controls")) return { left: 0, top: 540, width: 200, height: 36, right: 200, bottom: 576, x: 0, y: 540, toJSON: () => ({}) } as DOMRect;
      return originalRect.call(this);
    });
    try {
      const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
      renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], true);
      const workspace = await screen.findByRole("region", { name: "导入交易回忆复盘工作区" });
      await waitFor(() => {
        expect(workspace.style.getPropertyValue("--replay-footer-plot-center-x")).toBe("555px");
        expect(workspace.style.getPropertyValue("--replay-footer-control-half")).toBe("100px");
      });
      expect(workspace.style.getPropertyValue("--replay-plot-center-x")).toBe("250px");
    } finally {
      rectSpy.mockRestore();
      computedStyleSpy.mockRestore();
    }
  });

  it("keeps the holding quantity in the closed replay summary slot", async () => {
    const quantityEpisode: TradeEpisode = {
      ...replayEpisode,
      openingQuantity: "1000",
      remainingQuantity: "1000",
      executions: replayEpisode.executions.map((execution) => ({ ...execution, quantity: "1000" })),
    };
    const initial = createRecallDocument(quantityEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(quantityEpisode, initial);

    const summaryValue = await waitFor(() => screen.getByText("持仓 1000", { exact: true }));
    const summary = summaryValue.closest(".recall-replay-summary");
    expect(summary).not.toBeNull();
    expect(summary).toHaveClass("recall-replay-summary");
    expect(summary).not.toHaveClass("recall-replay-cutoff");
    expect(summary).toHaveAttribute("aria-label", "持仓 1000");
  });

  it("keeps the pre-entry expected R and risk values in the closed replay summary slot", async () => {
    let initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "pre-entry";
    initial = upsertRecallPlanDraft(initial, {
      id: "summary-plan-draft",
      planId: "summary-plan",
      decisionId: initial.decisions[0].id,
      kind: "initial",
      input: {
        ...emptyRecallPlanInput("CNY"),
        sizing: undefined,
        direction: "long",
        entry: "56",
        initialStop: "52",
        targets: [{ id: "target-1", price: "68", quantity: null, ratio: null }],
        sizeInputValue: "1000",
        resolvedQuantity: "1000",
      },
      recordedPhase: "pre-entry",
      recordedAt: "2025-01-02T09:00:00.000Z",
      source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: NO_REVEALED_EXECUTIONS },
      hasSeenFuture: false,
    });
    renderRecall(replayEpisode, initial);

    const summaryValue = await waitFor(() => screen.getByText("计划 · 3R / 风险 4000 CNY", { exact: true }));
    const summary = summaryValue.closest(".recall-replay-summary");
    expect(summary).not.toBeNull();
    expect(summary).toHaveClass("recall-replay-summary");
    expect(summary).not.toHaveClass("recall-replay-cutoff");
    expect(summary).toHaveAttribute("aria-label", "计划 · 3R / 风险 4000 CNY");

    const moreButton = screen.getByRole("button", { name: "更多 / 记录" });
    fireEvent.click(moreButton);
    const moreBody = document.getElementById(moreButton.getAttribute("aria-controls") ?? "");
    expect(moreBody).not.toBeNull();
    expect(within(moreBody!).getByText("计划 · 3R / 风险 4000 CNY · 成交尚未揭示", { exact: true })).toBeVisible();
  });

  it.each([false, true])("keeps derived-number keyboard focus inside the plan sidebar (compact=%s)", async (compactControls) => {
    let initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "pre-entry";
    initial = upsertRecallPlanDraft(initial, {
      id: "keyboard-plan-draft",
      planId: "keyboard-plan",
      decisionId: initial.decisions[0].id,
      kind: "initial",
      input: {
        ...emptyRecallPlanInput("CNY"),
        sizing: undefined,
        direction: "long",
        entry: "56",
        initialStop: "51.6",
        targets: [{ id: "target-1", price: "76.6", quantity: null, ratio: null }],
        sizeInputValue: "4200",
        resolvedQuantity: "4200",
      },
      recordedPhase: "pre-entry",
      recordedAt: "2025-01-02T09:00:00.000Z",
      source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: NO_REVEALED_EXECUTIONS },
      hasSeenFuture: false,
    });
    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], compactControls);

    const chart = await waitFor(() => screen.getByTestId("mock-replay-chart"));
    const cursor = chart.getAttribute("data-cursor");
    const toggle = await waitFor(() => screen.getAllByRole("button", { name: "查看完整数值 4.6818181818181818182" }).find(button => button.textContent?.includes("R"))!);
    const planToggle = screen.getByRole("button", { name: compactControls ? "关闭计划侧栏" : "计划侧栏" });
    expect(planToggle).toHaveAttribute("aria-expanded", "true");
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });
    expect(planToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: compactControls ? "打开计划侧栏" : "计划侧栏" })).toBe(planToggle);
    expect(document.activeElement).toBe(planToggle);
    fireEvent.click(planToggle);
    const reopenedPlanToggle = await waitFor(() => screen.getByRole("button", { name: compactControls ? "关闭计划侧栏" : "计划侧栏" }));
    expect(reopenedPlanToggle).toBe(planToggle);
    await waitFor(() => expect(reopenedPlanToggle).toHaveAttribute("aria-expanded", "true"));
    const reopenedToggle = await waitFor(() => screen.getAllByRole("button", { name: "查看完整数值 4.6818181818181818182" }).find(button => button.textContent?.includes("R"))!);
    reopenedToggle.focus();
    fireEvent.keyDown(reopenedToggle, { key: " ", code: "Space" });
    fireEvent.keyDown(reopenedToggle, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(reopenedToggle, { key: "j", code: "KeyJ" });
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", cursor);
    fireEvent.click(reopenedToggle);
    expect(reopenedToggle).toHaveTextContent("4.6818181818181818182R");
  });

  it("exposes an awaitable leave guard that blocks navigation when saving fails", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockRejectedValue(new Error("network unavailable")),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    renderRecall(episode, initial, repository, (next) => { guard = next; });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await waitFor(() => expect(guard).not.toBeNull());
    await expect(guard!()).resolves.toBe(false);
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("network unavailable"));
    expect(repository.save).toHaveBeenCalled();
  });

  it("keeps navigation blocked when the chart flush fails", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockResolvedValue({ ...initial, revision: 1 }),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    renderRecall(episode, initial, repository, next => { guard = next; });
    await waitForRecallChartReady(() => guard);
    replayChartHarness.handle.flush.mockRejectedValueOnce(new Error("chart flush unavailable"));
    await expect(guard!()).resolves.toBe(false);
    expect(repository.save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("chart flush unavailable")).toBeInTheDocument());
  });

  it("keeps navigation blocked when the chart viewport read fails", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockResolvedValue({ ...initial, revision: 1 }),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    renderRecall(episode, initial, repository, next => { guard = next; });
    await waitForRecallChartReady(() => guard);
    replayChartHarness.handle.getViewport.mockImplementationOnce(() => {
      throw new Error("chart viewport unavailable");
    });
    await expect(guard!()).resolves.toBe(false);
    expect(repository.save).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("chart viewport unavailable")).toBeInTheDocument());
  });

  it("persists a chart-only pan through the leave guard and restores it on reopen", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const initialContext: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [],
      timeframe: "15m",
      cursor: initial.working.cursor,
      executionCursor: initial.working.executionCursor,
      revealedCandleCursor: initial.working.cursor,
      viewport: replayChartHarness.viewport,
    };
    const seeded: RecallDocument = {
      ...initial,
      working: {
        ...initial.working,
        phase: "holding",
        phaseContexts: { holding: initialContext },
      },
    };
    let persisted: RecallDocument | undefined;
    const repository: RecallRepository = {
      load: vi.fn(async () => structuredClone(persisted ?? seeded)),
      save: vi.fn(async (next: RecallDocument) => {
        persisted = structuredClone({ ...next, revision: next.revision + 1 });
        return structuredClone(persisted);
      }),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    const rendered = renderRecall(episode, seeded, repository, next => { guard = next; });
    await waitForRecallChartReady(() => guard);
    const pan = {
      ...replayChartHarness.viewport,
      logicalRange: { from: -15.600244498777506, to: 36.399755501222494 },
    };
    replayChartHarness.handle.getViewport.mockReturnValue(pan);

    await act(async () => { await expect(guard!()).resolves.toBe(true); });
    expect(replayChartHarness.handle.flush).toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(persisted?.working.phaseContexts?.holding?.viewport).toEqual(pan);

    rendered.unmount();
    replayChartHarness.handle.restoreViewport.mockClear();
    renderRecall(episode, persisted!, repository, next => { guard = next; });
    await screen.findByTestId("mock-replay-chart");
    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenCalledWith(pan));
  });

  it("keeps an active decision viewport in editing, phase, and decision draft contexts", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const decisionId = initial.decisions[0]!.id;
    const initialContext: RecallWorkingContext = {
      mode: "decision",
      decisionId,
      drawings: [],
      timeframe: "15m",
      cursor: initial.working.cursor,
      executionCursor: initial.working.executionCursor,
      revealedCandleCursor: initial.working.cursor,
      viewport: replayChartHarness.viewport,
    };
    const seeded: RecallDocument = {
      ...initial,
      working: {
        ...initial.working,
        phase: "holding",
        selectedDecisionId: decisionId,
        editingContext: initialContext,
        phaseContexts: { holding: initialContext },
        decisionDrafts: [initialContext],
      },
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(seeded),
      save: vi.fn(async (next: RecallDocument) => ({ ...next, revision: next.revision + 1 })),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    renderRecall(episode, seeded, repository, next => { guard = next; });
    await screen.findByTestId("mock-replay-chart");
    const pan = {
      ...replayChartHarness.viewport,
      logicalRange: { from: -15.600244498777506, to: 36.399755501222494 },
    };
    replayChartHarness.handle.getViewport.mockReturnValue(pan);

    await act(async () => { await expect(guard!()).resolves.toBe(true); });
    const saved = vi.mocked(repository.save).mock.calls[0]?.[0];
    expect(saved?.working.editingContext?.viewport).toEqual(pan);
    expect(saved?.working.phaseContexts?.holding?.viewport).toEqual(pan);
    expect(saved?.working.decisionDrafts?.find(draft => draft.decisionId === decisionId)?.viewport).toEqual(pan);
  });

  it("binds a dirty drawing save to the current viewport and skips an unchanged clean view", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const context: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [],
      timeframe: "15m",
      cursor: initial.working.cursor,
      executionCursor: initial.working.executionCursor,
      revealedCandleCursor: initial.working.cursor,
      viewport: replayChartHarness.viewport,
    };
    const seeded: RecallDocument = {
      ...initial,
      working: { ...initial.working, phase: "holding", phaseContexts: { holding: context } },
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(seeded),
      save: vi.fn(async (next: RecallDocument) => ({ ...next, revision: next.revision + 1 })),
      fetch: vi.fn(),
    };
    let guard: (() => Promise<boolean>) | null = null;
    renderRecall(episode, seeded, repository, next => { guard = next; });
    await screen.findByTestId("mock-replay-chart");
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    const pan = { ...replayChartHarness.viewport, logicalRange: { from: -15.6, to: 36.4 } };
    replayChartHarness.handle.getViewport.mockReturnValue(pan);
    await act(async () => { await expect(guard!()).resolves.toBe(true); });
    const saved = vi.mocked(repository.save).mock.calls[0]?.[0];
    expect(saved?.working.phaseContexts?.holding?.viewport).toEqual(pan);
    expect(saved?.working.drawings).toHaveLength(1);
    await act(async () => { await expect(guard!()).resolves.toBe(true); });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it("keeps the newer local draft when an older save response arrives", () => {
    const original = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const retainedSnapshot = {
      id: "snapshot-2",
      decisionId: "fill-1",
      timeframe: "15m" as const,
      cursor: "2025-01-02T10:15:00.000Z",
      executionCursor: "fill-1",
      candles: [candle],
      drawings: [drawing],
      viewport: {
        version: 1 as const,
        logicalRange: { from: 0, to: 1 },
        barSpacing: 6,
        rightOffset: 0,
        width: 600,
        height: 400,
      },
      imageDataUrl: "data:image/png;base64,AA==",
      createdAt: "2025-01-02T10:01:00.000Z",
      updatedAt: "2025-01-02T10:01:00.000Z",
    };
    const current: RecallDocument = {
      ...original,
      revision: 0,
      working: { ...original.working, drawings: [drawing] },
      snapshots: [retainedSnapshot],
    };
    const saved: RecallDocument = { ...original, revision: 1 };
    const result = reconcileRecallSaveResponse(current, saved, 1, 2);
    expect(result.dirty).toBe(true);
    expect(result.document.revision).toBe(1);
    expect(result.document.working.drawings).toEqual([drawing]);
    expect(result.document.snapshots).toEqual([retainedSnapshot]);
  });

  it("keeps a local edit dirty when the first delayed save resolves", async () => {
    vi.useFakeTimers();
    let resolveSave!: (document: RecallDocument) => void;
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(() => new Promise<RecallDocument>((resolve) => {
        resolveSave = resolve;
      })),
      fetch: vi.fn(),
    };

    render(
      <RecallWorkspace
        episode={episode}
        episodes={[episode]}
        instrument={episode.instrument}
        instruments={[{ ...episode.instrument, market: "US" }]}
        timeframeAvailability={availability}
        importedTimelineCandles={[candle]}
        candlesByTimeframe={{ "15m": [candle], "1D": [candle], "1W": [candle] }}
        settings={settings}
        repository={repository}
        onEpisodeChange={vi.fn()}
        onInstrumentChange={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await openAllSnapshotRecords();
    expect(screen.getByText("阶段快照")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(repository.save).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await act(async () => {
      resolveSave({ ...initial, revision: 1 });
      await Promise.resolve();
    });
    expect(screen.getByText(/有草稿修改/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("restores both replay cursors after visiting full history", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", replayCandles[0]!.time));
    // The first candle is the current incomplete bar; one more step reveals
    // the next completed bar and its execution boundary.
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const chart = screen.getByTestId("mock-replay-chart");
    const replayCursor = chart.getAttribute("data-cursor");
    const replayExecutionCursor = chart.getAttribute("data-execution-cursor");

    await openMoreRecords();
    fireEvent.click(screen.getAllByRole("button", { name: "完整历史" }).at(-1)!);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-3"));
    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => {
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", replayCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", replayExecutionCursor);
    });
  });

  it("leaves temporary full history when returning to the global context", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    await waitFor(() => expect(chart).toHaveAttribute("data-execution-cursor", "fill-1"));
    const workingCutoff = {
      candles: chart.getAttribute("data-revealed-candles"),
      executions: chart.getAttribute("data-execution-cursor"),
    };

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(screen.getByText(/完整历史临时视图：当前回合成交全部显示/)).toBeInTheDocument());
    const historyCutoff = document.querySelector(".recall-replay-cutoff") as HTMLElement;
    expect(historyCutoff.querySelectorAll("span")).toHaveLength(2);
    expect(chart).toHaveAttribute("data-execution-cursor", "fill-3");

    fireEvent.click(screen.getByRole("button", { name: /全局总结/ }));
    await waitFor(() => {
      expect(screen.queryByText(/完整历史临时视图：当前回合成交全部显示/)).not.toBeInTheDocument();
      expect(chart).toHaveAttribute("data-execution-cursor", workingCutoff.executions);
      expect(chart).toHaveAttribute("data-revealed-candles", workingCutoff.candles);
    });
    const restoredCutoff = screen.getByLabelText(/行情时间/);
    expect(restoredCutoff.querySelectorAll("span")).toHaveLength(2);
  });

  it("leaves temporary full history when switching decisions and restores the source graph on return", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    const chart = await screen.findByTestId("mock-replay-chart");
    const navigation = await screen.findByRole("complementary", { name: "回合与决策导航" });
    await waitFor(() => expect(chart).toHaveAttribute("data-execution-cursor", "fill-1"));

    // Establish a decision graph before entering the temporary full-history view.
    fireEvent.click(within(navigation).getByRole("button", { name: /^1买 1 @ 10/ }));
    await waitFor(() => expect(chart).toHaveAttribute("data-execution-cursor", "fill-1"));
    const sourceCandles = chart.getAttribute("data-revealed-candles");
    const sourceCutoff = chart.getAttribute("data-execution-cursor");

    openMoreRecords();
    fireEvent.click(screen.getAllByRole("button", { name: "完整历史" }).at(-1)!);
    await waitFor(() => {
      expect(screen.getByText(/完整历史临时视图：当前回合成交全部显示/)).toBeInTheDocument();
      expect(chart).toHaveAttribute("data-execution-cursor", "fill-3");
    });

    // A normal decision navigation is a context change, so it must leave the
    // reveal-all presentation and restore the destination's declared cutoff.
    fireEvent.click(within(navigation).getByRole("button", { name: /^2买 1 @ 10/ }));
    await waitFor(() => {
      expect(screen.queryByText(/完整历史临时视图：当前回合成交全部显示/)).not.toBeInTheDocument();
      expect(chart).toHaveAttribute("data-execution-cursor", "fill-2");
      expect(chart.getAttribute("data-revealed-candles")).not.toContain(replayCandles.at(-1)!.time);
    });
    expect(document.querySelector(".recall-replay-cutoff")?.querySelectorAll("span")).toHaveLength(2);
    expect(document.querySelector(".recall-phase-provenance")).toHaveTextContent("已看后续补记");

    // Returning to the source decision proves the history-entry backup was
    // retained instead of being replaced by the temporary reveal-all replay.
    fireEvent.click(within(navigation).getByRole("button", { name: /^1买 1 @ 10/ }));
    await waitFor(() => {
      expect(chart).toHaveAttribute("data-execution-cursor", sourceCutoff);
      expect(chart).toHaveAttribute("data-revealed-candles", sourceCandles);
      expect(screen.queryByText(/完整历史临时视图：当前回合成交全部显示/)).not.toBeInTheDocument();
    });
    expect(document.querySelector(".recall-phase-provenance")).toHaveTextContent("已看后续补记");

    // Re-enter and return after the destination detour; the source cutoff and
    // provenance must remain stable across the repeated history cycle.
    openMoreRecords();
    fireEvent.click(screen.getAllByRole("button", { name: "完整历史" }).at(-1)!);
    await waitFor(() => expect(chart).toHaveAttribute("data-execution-cursor", "fill-3"));
    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => {
      expect(screen.queryByText(/完整历史临时视图：当前回合成交全部显示/)).not.toBeInTheDocument();
      expect(chart).toHaveAttribute("data-execution-cursor", sourceCutoff);
      expect(chart).toHaveAttribute("data-revealed-candles", sourceCandles);
    });
    expect(document.querySelector(".recall-phase-provenance")).toHaveTextContent("已看后续补记");
  }, 60000);

  it("keeps both replay cursors when switching to a timeframe with an incomplete bar", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    render(
      <RecallWorkspace
        episode={replayEpisode}
        episodes={[replayEpisode]}
        instrument={replayEpisode.instrument}
        instruments={[{ ...replayEpisode.instrument, market: "US" }]}
        timeframeAvailability={availability}
        importedTimelineCandles={replayCandles}
        candlesByTimeframe={{ "15m": replayCandles, "1D": replayCandles, "1W": [incompleteWeeklyCandle] }}
        settings={settings}
        repository={{ load: vi.fn().mockResolvedValue(initial), save: vi.fn().mockResolvedValue({ ...initial, revision: 1 }), fetch: vi.fn() }}
        onEpisodeChange={vi.fn()}
        onInstrumentChange={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", replayCandles[0]!.time));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const chart = screen.getByTestId("mock-replay-chart");
    const marketCursor = chart.getAttribute("data-cursor");

    fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor);
    fireEvent.click(screen.getByRole("button", { name: "切换到 1D" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute(
      "data-revealed-candles",
      replayCandles.slice(0, 2).map((item) => item.time).join(","),
    ));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor);
  });

  it("restores the saved market cutoff after an empty weekly timeframe is reopened", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const candlesByTimeframe = {
      "15m": replayCandles,
      "1D": replayCandles,
      "1W": [incompleteWeeklyCandle],
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    const rendered = renderRecall(replayEpisode, initial, repository, undefined, candlesByTimeframe);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", replayCandles[0]!.time));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const marketCursor = screen.getByTestId("mock-replay-chart").getAttribute("data-cursor");

    fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
    const saved = [...vi.mocked(repository.save).mock.calls]
      .reverse()
      .map(([document]) => document)
      .find((document) => document.working.timeframe === "1W");
    expect(saved).toBeDefined();
    const savedContext = Object.values(saved?.working.phaseContexts ?? {})
      .find((context) => context.timeframe === "1W");
    expect(savedContext?.revealedCandleCursor).toBe(marketCursor);

    rendered.unmount();
    renderRecall(replayEpisode, saved!, {
      load: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue({ ...saved!, revision: saved!.revision + 1 }),
      fetch: vi.fn(),
    }, undefined, candlesByTimeframe);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor));
    fireEvent.click(screen.getByRole("button", { name: "切换到 1D" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute(
      "data-revealed-candles",
      replayCandles.slice(0, 2).map((item) => item.time).join(","),
    ));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor);
  });

  it("does not replace the daily market cutoff with an older completed weekly bar", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const olderWeeklyCandle = {
      ...incompleteWeeklyCandle,
      time: "2024-12-30T00:00:00.000Z",
      knowledgeAt: "2025-01-02T10:20:00.000Z",
    };
    renderRecall(replayEpisode, initial, {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockResolvedValue({ ...initial, revision: 1 }),
      fetch: vi.fn(),
    }, undefined, {
      "15m": replayCandles,
      "1D": replayCandles,
      "1W": [olderWeeklyCandle],
    });
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", replayCandles[0]!.time));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const marketCursor = screen.getByTestId("mock-replay-chart").getAttribute("data-cursor");

    fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", olderWeeklyCandle.time));
    fireEvent.click(screen.getByRole("button", { name: "切换到 1D" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute(
      "data-revealed-candles",
      replayCandles.slice(0, 2).map((item) => item.time).join(","),
    ));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor);
  });

  it("keeps legacy missing market cutoffs compatible while honoring explicit empty cutoffs", async () => {
    const base = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const context: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [],
      timeframe: "1D",
      cursor: replayCandles[1].knowledgeAt!,
      executionCursor: "fill-2",
    };
    const legacy: RecallDocument = {
      ...base,
      working: {
        ...base.working,
        phase: "holding",
        cursor: context.cursor,
        executionCursor: context.executionCursor,
        phaseContexts: { holding: context },
      },
    };
    const legacyRepository: RecallRepository = {
      load: vi.fn().mockResolvedValue(legacy),
      save: vi.fn().mockResolvedValue({ ...legacy, revision: 1 }),
      fetch: vi.fn(),
    };
    const rendered = renderRecall(replayEpisode, legacy, legacyRepository);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute(
      "data-revealed-candles",
      replayCandles[0].time,
    ));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
    rendered.unmount();

    const explicitEarlier: RecallWorkingContext = {
      ...context,
      revealedCandleCursor: "2025-01-02T10:00:00.000Z",
    };
    const explicitEarlierDocument: RecallDocument = {
      ...legacy,
      working: {
        ...legacy.working,
        cursor: "2025-01-02T10:45:00.000Z",
        phaseContexts: { holding: explicitEarlier },
      },
    };
    const explicitEarlierRender = renderRecall(replayEpisode, explicitEarlierDocument, {
      load: vi.fn().mockResolvedValue(explicitEarlierDocument),
      save: vi.fn().mockResolvedValue({ ...explicitEarlierDocument, revision: 1 }),
      fetch: vi.fn(),
    });
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", ""));
    // The stable fill prefix can be later than the explicit market boundary;
    // restoring the old global cursor must not override that saved context.
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
    explicitEarlierRender.unmount();

    const explicitEmpty: RecallWorkingContext = { ...context, revealedCandleCursor: null };
    const explicitDocument: RecallDocument = {
      ...legacy,
      working: { ...legacy.working, phaseContexts: { holding: explicitEmpty } },
    };
    renderRecall(replayEpisode, explicitDocument, {
      load: vi.fn().mockResolvedValue(explicitDocument),
      save: vi.fn().mockResolvedValue({ ...explicitDocument, revision: 1 }),
      fetch: vi.fn(),
    });
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", ""));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  });

  it("filters a snapshot by the revealed market cutoff when execution knowledge is later", async () => {
    const base = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const explicitEarlier: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [],
      timeframe: "1D",
      cursor: "2025-01-02T10:30:00.000Z",
      executionCursor: "fill-2",
      revealedCandleCursor: "2025-01-02T10:00:00.000Z",
    };
    const futureSnapshot: RecallSnapshot = {
      ...retainedSnapshot(replayEpisode, "global"),
      id: "future-market-snapshot",
      cursor: "2025-01-02T10:30:00.000Z",
      executionCursor: "fill-1",
    };
    const document: RecallDocument = {
      ...base,
      snapshots: [futureSnapshot],
      working: {
        ...base.working,
        phase: "holding",
        cursor: "2025-01-02T10:45:00.000Z",
        executionCursor: explicitEarlier.executionCursor,
        phaseContexts: { holding: explicitEarlier },
      },
    };

    renderRecall(replayEpisode, document);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", ""));
    openAllSnapshotRecords();
    expect(screen.getByText("全部记录与快照（0）")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /编辑全局总结快照/ })).not.toBeInTheDocument();
  });

  it("reveals exactly one cached completed candle at its knowledge boundary", async () => {
    const cachedEpisode: TradeEpisode = {
      ...episode,
      id: "cached-imported-episode",
      startedAt: "2025-01-02T02:00:00.000Z",
      endedAt: "2025-01-02T02:45:00.000Z",
      openingQuantity: "100",
      remainingQuantity: "0",
      executions: [
        { ...episode.executions[0], id: "cached-buy", executedAt: "2025-01-02T02:00:00.000Z", quantity: "100" },
        { ...episode.executions[0], id: "cached-sell", executedAt: "2025-01-02T02:45:00.000Z", side: "sell", quantity: "100", price: "36.5" },
      ],
    };
    const cachedCandles: Candle[] = [
      { ...candle, time: "2025-01-02T02:00:00.000Z", knowledgeAt: "2025-01-02T02:15:00.000Z" },
      { ...candle, time: "2025-01-02T02:15:00.000Z", knowledgeAt: "2025-01-02T02:30:00.000Z" },
      { ...candle, time: "2025-01-02T02:30:00.000Z", knowledgeAt: "2025-01-02T02:45:00.000Z" },
      { ...candle, time: "2025-01-02T02:45:00.000Z", knowledgeAt: "2025-01-02T03:00:00.000Z" },
    ];
    const hourlyCandle: Candle = {
      ...candle,
      time: "2025-01-02T02:00:00.000Z",
      knowledgeAt: "2025-01-02T03:00:00.000Z",
    };
    const initial = createRecallDocument(cachedEpisode, "2025-01-03T00:00:00.000Z");
    initial.working.phase = "holding";
    initial.working.timeframe = "15m";
    initial.working.cursor = "2025-01-02T02:45:00.000Z";
    initial.working.executionCursor = "cached-sell";
    initial.working.selectedDecisionId = "cached-sell";
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockResolvedValue({ ...initial, revision: 1 }),
      fetch: vi.fn(),
    };

    render(
      <RecallWorkspace
        episode={cachedEpisode}
        episodes={[cachedEpisode]}
        instrument={cachedEpisode.instrument}
        instruments={[{ ...cachedEpisode.instrument, market: "HK" }]}
        timeframeAvailability={{ ...availability, "1h": { enabled: true } }}
        importedTimelineCandles={cachedCandles}
        candlesByTimeframe={{ "15m": cachedCandles, "1h": [hourlyCandle], "1D": cachedCandles, "1W": cachedCandles }}
        settings={settings}
        repository={repository}
        onEpisodeChange={vi.fn()}
        onInstrumentChange={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    const chart = await waitFor(() => screen.getByTestId("mock-replay-chart"));
    const nextCandle = screen.getByRole("button", { name: "下一根 K 线" });
    expect(chart).toHaveAttribute("data-revealed-candles", cachedCandles.slice(0, 3).map(({ time }) => time).join(","));
    expect(chart).toHaveAttribute("data-execution-cursor", "cached-sell");
    expect(nextCandle).toBeEnabled();

    fireEvent.click(nextCandle);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute(
      "data-revealed-candles",
      cachedCandles.map(({ time }) => time).join(","),
    ));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", "2025-01-02T03:00:00.000Z");
    expect(nextCandle).toBeDisabled();

    const frozenCursor = screen.getByTestId("mock-replay-chart").getAttribute("data-cursor");
    fireEvent.click(screen.getByRole("button", { name: "切换到 1h" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "切换到 1h" })).toHaveClass("active"));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", frozenCursor));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", hourlyCandle.time);
  });

  it("uses replay order for the pre-entry next-decision boundary", async () => {
    const created = createRecallDocument(dateOnlyPreEntryEpisode, "2025-01-02T10:00:00.000Z");
    const initial: RecallDocument = {
      ...created,
      working: {
        ...created.working,
        phase: "pre-entry",
        cursor: "2025-01-01T23:59:59.999Z",
        executionCursor: NO_REVEALED_EXECUTIONS,
      },
    };
    renderRecall(dateOnlyPreEntryEpisode, initial);

    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "date-entry"));
  });

  it("restores a retained viewport while editing and the working viewport on exit", async () => {
    const workingViewport = { ...replayChartHarness.viewport, rightOffset: 9 };
    replayChartHarness.handle.getViewport.mockReturnValue(workingViewport);
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const snapshot = retainedSnapshot(episode);
    const withSnapshot: RecallDocument = { ...initial, snapshots: [snapshot] };
    renderRecall(episode, withSnapshot);
    await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
    await openAllSnapshotRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑决策 1快照" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenCalledWith(snapshot.viewport));
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenLastCalledWith(workingViewport));
    confirmSpy.mockRestore();
  });

  it("restores the saved phase viewport when the chart handle becomes ready asynchronously", async () => {
    const pendingFrames: Array<(timestamp: number) => void> = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    try {
      const savedViewport = { ...replayChartHarness.viewport, rightOffset: 17, logicalRange: { from: 12, to: 22 } };
      const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
      initial.working.phase = "holding";
      initial.working.phaseContexts = {
        holding: {
          mode: "global",
          decisionId: "global",
          drawings: [],
          timeframe: "1D",
          cursor: replayCandles[0].knowledgeAt!,
          executionCursor: NO_REVEALED_EXECUTIONS,
          viewport: savedViewport,
        },
      };
      replayChartHarness.deferReady = true;
      renderRecall(replayEpisode, initial);

      await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
      await waitFor(() => expect(replayChartHarness.pendingReady).not.toBeNull());
      pendingFrames.splice(0).forEach((callback) => callback(0));
      expect(replayChartHarness.handle.restoreViewport).not.toHaveBeenCalledWith(savedViewport);

      await act(async () => {
        replayChartHarness.pendingReady?.();
        await Promise.resolve();
      });
      pendingFrames.splice(0).forEach((callback) => callback(0));
      await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenCalledWith(savedViewport));
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps a saved phase viewport from being overwritten during the phase switch", async () => {
    const preEntryViewport = { ...replayChartHarness.viewport, rightOffset: 12 };
    const collapsedViewport = { ...replayChartHarness.viewport, rightOffset: 1, logicalRange: { from: 26, to: 28 } };
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "holding";
    initial.working.phaseContexts = {
      "pre-entry": {
        mode: "global",
        decisionId: "global",
        drawings: [],
        timeframe: "1D",
        cursor: replayCandles[0].knowledgeAt!,
        executionCursor: NO_REVEALED_EXECUTIONS,
        viewport: preEntryViewport,
      },
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository);
    await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toBeInTheDocument());
    replayChartHarness.handle.getViewport.mockReturnValue(collapsedViewport);
    replayChartHarness.handle.restoreViewport.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));

    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenCalledWith(preEntryViewport));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(saved.working.phaseContexts?.["pre-entry"]?.viewport).toEqual(preEntryViewport);
  });

  it("does not restore the current future viewport when a phase has no saved viewport", async () => {
    const futureViewport = { ...replayChartHarness.viewport, rightOffset: 18, logicalRange: { from: 18, to: 22 } };
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "holding";
    initial.working.phaseContexts = undefined;
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository);
    await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "买入前判断" })).toHaveAttribute("aria-pressed", "false");
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    replayChartHarness.handle.getViewport.mockReturnValue(futureViewport);
    replayChartHarness.handle.restoreViewport.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(replayChartHarness.handle.getViewport).toHaveBeenCalled());
    expect(replayChartHarness.handle.getViewport.mock.results.at(-1)?.value).toEqual(futureViewport);
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(saved.working.phaseContexts?.["pre-entry"]?.viewport).toBeUndefined();
    expect(replayChartHarness.handle.restoreViewport).not.toHaveBeenCalledWith(futureViewport);
  });

  it("ignores a phase restore callback after a newer replay reveal", async () => {
    const pendingFrames: Array<(timestamp: number) => void> = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    try {
      const savedViewport = { ...replayChartHarness.viewport, rightOffset: 12 };
      const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
      initial.working.phase = "holding";
      initial.working.phaseContexts = {
        "pre-entry": {
          mode: "global",
          decisionId: "global",
          drawings: [],
          timeframe: "1D",
          cursor: replayCandles[0].knowledgeAt!,
          executionCursor: NO_REVEALED_EXECUTIONS,
          viewport: savedViewport,
        },
      };
      const repository: RecallRepository = {
        load: vi.fn().mockResolvedValue(initial),
        save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
        fetch: vi.fn(),
      };
      renderRecall(replayEpisode, initial, repository);
      await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));
      await waitFor(() => expect(pendingFrames.length).toBeGreaterThan(0));
      const staleRestore = pendingFrames.at(-1)!;

      fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
      await act(async () => {
        staleRestore(0);
        await Promise.resolve();
      });

      expect(replayChartHarness.handle.restoreViewport).not.toHaveBeenCalledWith(savedViewport);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps a completed text draft marked as modified after autosave", async () => {
    vi.useFakeTimers();
    const base = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const completed: RecallDocument = {
      ...base,
      status: "completed",
      completedAt: "2025-01-02T10:20:00.000Z",
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(completed),
      save: vi.fn().mockImplementation((document: RecallDocument) => Promise.resolve({ ...document, revision: document.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(episode, completed, repository);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    expect(screen.getByText(/已完成.*有草稿修改/)).toBeInTheDocument();
    await openMoreRecords();
    expect(screen.getByRole("button", { name: /保存并完成回合复盘/ })).not.toBeDisabled();
    vi.useRealTimers();
  });

  it("waits for autosave and finalizes a fresh global capture with the returned revision", async () => {
    vi.useFakeTimers();
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const withDecisionSnapshot: RecallDocument = { ...initial, snapshots: [retainedSnapshot(episode)] };
    let resolveAutosave!: (document: RecallDocument) => void;
    let autosaveInput: RecallDocument | undefined;
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(withDecisionSnapshot),
      save: vi.fn().mockImplementation((document: RecallDocument, options?: { finalize?: boolean }) => {
        if (!options?.finalize) {
          autosaveInput = document;
          return new Promise<RecallDocument>((resolve) => { resolveAutosave = resolve; });
        }
        const completedAt = "2025-01-02T10:30:00.000Z";
        const formal = { ...document };
        delete formal.lastCompleted;
        delete formal.reconciliation;
        const finalized: RecallDocument = {
          ...document,
          revision: 9,
          status: "completed",
          completedAt,
          lastCompleted: { ...formal, revision: 9, status: "completed", completedAt },
        };
        return Promise.resolve(finalized);
      }),
      fetch: vi.fn(),
    };
    renderRecall(episode, withDecisionSnapshot, repository);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    await openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    expect(repository.save).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveAutosave({ ...autosaveInput!, revision: 1 });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repository.save).mock.calls[1]?.[1]).toEqual({ expectedRevision: 1, finalize: true });
    expect(replayChartHarness.handle.capture).toHaveBeenCalled();
    expect(screen.getByText(/已完成/)).toBeInTheDocument();
  });
});

describe("RecallWorkspace accounting safeguards", () => {
  it("keeps the compact position summary at the replay knowledge cutoff", async () => {
    const cutoffEpisode: TradeEpisode = {
      ...episode,
      id: "cutoff-position-episode",
      startedAt: "2025-01-01T02:00:00.000Z",
      endedAt: "2025-01-02T02:00:00.000Z",
      executions: [
        {
        ...episode.executions[0],
        id: "cutoff-buy",
        executedAt: "2025-01-01T02:00:00.000Z",
        quantity: "1000",
        price: "56",
        },
        {
          ...episode.executions[0],
          id: "cutoff-sell",
          side: "sell",
          executedAt: "2025-01-02T02:00:00.000Z",
          quantity: "600",
          price: "64",
          source: {
            ...episode.executions[0].source,
            openingPosition: { accountId: "account-1", market: "US", symbol: "TEST", phase: "closing", date: "2025-01-03", quantity: "0", source: [] },
          },
        },
      ],
    };
    const initial = createRecallDocument(cutoffEpisode);
    initial.working.cursor = "2025-01-02T23:59:59.999Z";
    initial.working.executionCursor = "cutoff-sell";

    renderRecall(cutoffEpisode, initial);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "统计" }));

    const stats = screen.getByRole("complementary", { name: "当前统计" });
    expect(stats).toHaveTextContent("持仓数量400");
    expect(stats).toHaveTextContent("平均成本56.00");
    expect(stats).toHaveTextContent("净盈亏-US$13,400.00");
  });

  it("hides cost and PnL when a revealed HK Connect fill has a mismatched settlement currency", async () => {
    const hkConnectEpisode: TradeEpisode = {
      ...episode,
      instrument: { ...episode.instrument, id: "HK:TEST", market: "HK", currency: "HKD" },
      executions: [{
        ...episode.executions[0],
        instrument: { ...episode.executions[0].instrument, id: "HK:TEST", market: "HK", currency: "HKD" },
        fee: "8",
        source: {
          ...episode.executions[0].source,
          feeStatus: "reported",
          settlement: {
            currency: "CNY",
            quantity: "1",
            grossAmount: "10",
            netAmount: "18",
            fees: { commission: "8" },
          },
        },
      }],
    };
    renderRecall(hkConnectEpisode, createRecallDocument(hkConnectEpisode, "2025-01-02T10:00:00.000Z"));

    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());
    expect(screen.getByText(/报价币种与结算币种不同/)).toBeInTheDocument();
    expect(document.querySelector(".recall-position-stats")).toHaveTextContent("持仓 1");
    expect(document.querySelector(".recall-position-stats")).toHaveTextContent("均价 币种待换算");
    expect(document.querySelector(".recall-position-stats")).toHaveTextContent("净盈亏 币种待换算");
    expect(replayChartHarness.lastProps).toMatchObject({ averageCost: 0, settings: { showAverageCost: false } });

    fireEvent.click(screen.getByRole("button", { name: "统计" }));
    expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("累计费用¥8.00");
  });

  it("keeps the TradingView notice permanent while source reports follow the revealed boundary", async () => {
    const sourceReport = {
      netPnl: "12",
      returnPercent: "4.5",
      favorableExcursion: "20",
      favorableExcursionPercent: "7.5",
      adverseExcursion: "-3",
      adverseExcursionPercent: "-1.1",
      cumulativePnl: "12",
      cumulativeReturnPercent: "4.5",
      durationBars: 6,
    };
    const simulationEpisode: TradeEpisode = {
      ...replayEpisode,
      tradeNature: "simulation",
      simulationRunId: "run-a",
      executions: replayEpisode.executions.map((execution, index) => ({
        ...execution,
        source: {
          ...execution.source,
          tradeNature: "simulation",
          simulationRunId: "run-a",
          ...(index === 1 ? { sourceReport } : {}),
        },
      })),
    };
    renderRecall(simulationEpisode, createRecallDocument(simulationEpisode, "2025-01-02T10:00:00.000Z"));

    await waitFor(() => expect(screen.getByTestId("tradingview-replay-notice")).toBeInTheDocument());
    expect(screen.getByText("TradingView · 模拟盘", { exact: true })).toBeInTheDocument();
    const notice = screen.getByTestId("tradingview-replay-notice");
    const runIdDisclosure = notice.querySelector("details");
    const runIdSummary = runIdDisclosure?.querySelector("summary");
    expect(runIdDisclosure).not.toBeNull();
    expect(runIdSummary).toHaveTextContent("运行标识");
    expect(runIdDisclosure).not.toHaveAttribute("open");
    fireEvent.click(runIdSummary!);
    expect(runIdDisclosure).toHaveAttribute("open");
    expect(notice.querySelector("code")).toHaveTextContent("run-a");
    expect(screen.queryByTestId("tradingview-source-report")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-revealed-candles", replayCandles[0]!.time));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("tradingview-source-report")).toBeInTheDocument());
    expect(screen.getByTestId("tradingview-replay-notice")).toBeInTheDocument();
    expect(screen.getByTestId("tradingview-source-report")).toHaveTextContent("报告收益率4.5%");
    expect(screen.getByTestId("tradingview-source-report")).toHaveTextContent("持仓 K 线6");
  });

  it("closes the drawing layer panel and leaves the chart frame available", async () => {
    const user = userEvent.setup();
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const drawing: NormalizedDrawing = {
      version: 2,
      id: "compact-panel-drawing",
      episodeId: replayEpisode.id,
      name: "紧凑面板绘图",
      tool: "trend-line",
      anchors: [
        { time: replayCandles[0].time, price: 10 },
        { time: replayCandles[1].time, price: 11 },
      ],
      style: { color: "#2f80ed", lineWidth: 2, opacity: 1 },
      zIndex: 0,
      hidden: false,
      locked: false,
      visibleOn: "all",
      stage: "during-replay",
      createdAtCursor: "2025-01-02T09:59:00.000Z",
    };
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async document => ({ ...document, revision: document.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository, undefined, undefined, [drawing]);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());

    const layersButton = screen.getByRole("button", { name: "图层" });
    expect(layersButton).toBeEnabled();
    await user.click(layersButton);
    const layerPanel = screen.getByRole("region", { name: "绘图图层面板" });
    expect(within(layerPanel).getByRole("textbox", { name: "重命名紧凑面板绘图" })).toBeInTheDocument();
    await user.click(within(layerPanel).getByRole("button", { name: "关闭绘图图层" }));

    expect(screen.queryByRole("region", { name: "绘图图层面板" })).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-replay-chart")).toBeVisible();
    expect(screen.getByRole("button", { name: "图层" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a hidden drawing in the eligible layer list so it can be shown again", async () => {
    const hiddenDrawing = { ...drawing, id: "hidden-layer", name: "隐藏判断", hidden: true, createdAtCursor: "2025-01-01T00:00:00.000Z" };
    const futureDrawing = { ...drawing, id: "future-layer", name: "未来判断", hidden: true, createdAtCursor: "2099-01-01T00:00:00.000Z" };
    const otherTimeframeDrawing = { ...drawing, id: "other-timeframe", name: "其他周期", hidden: true, visibleOn: ["15m"] as Timeframe[] };
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "holding";
    initial.working.drawings = [hiddenDrawing, futureDrawing, otherTimeframeDrawing];
    initial.working.cursor = "2025-01-02T10:15:00.000Z";
    initial.working.executionCursor = "fill-1";
    renderRecall(replayEpisode, initial);

    await screen.findByTestId("mock-replay-chart");
    expect(screen.getByTestId("mock-replay-chart")).not.toHaveAttribute("data-drawing-ids", "hidden-layer");
    const onCommand = vi.fn();
    render(<DrawingLayersPanel drawings={[hiddenDrawing]} onCommand={onCommand} onSelectDrawing={vi.fn()} selectedDrawingId={null} />);
    const layers = document.body;
    expect(within(layers).getByDisplayValue("隐藏判断")).toBeInTheDocument();
    fireEvent.click(within(layers).getByRole("button", { name: "显示隐藏判断" }));
    expect(onCommand).toHaveBeenCalledWith({ type: "toggle-hidden", id: "hidden-layer" });
  });

  it("restores the saved holding drawings when pre-entry replay crosses into its first fill", async () => {
    const holdingDrawing = { ...drawing, id: "holding-graph", name: "持仓图", createdAtCursor: "2025-01-02T10:15:00.000Z" };
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const holdingContext: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [holdingDrawing],
      timeframe: "1D",
      cursor: "2025-01-02T10:30:00.000Z",
      executionCursor: "fill-2",
      revealedCandleCursor: "2025-01-02T10:30:00.000Z",
    };
    const preEntryContext: RecallWorkingContext = {
      mode: "global",
      decisionId: "global",
      drawings: [],
      timeframe: "1D",
      cursor: "2025-01-01T23:59:59.999Z",
      executionCursor: NO_REVEALED_EXECUTIONS,
      revealedCandleCursor: null,
    };
    initial.working = {
      ...initial.working,
      phase: "holding",
      drawings: [holdingDrawing],
      phaseContexts: { holding: holdingContext, "pre-entry": preEntryContext },
    };
    renderRecall(replayEpisode, initial);

    await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "买入前判断" })).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));

    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-1"));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-drawing-ids", "holding-graph");
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", "2025-01-02T10:15:00.000Z");
  });
});

describe("structured plan sidebar", () => {
  it("orders the post-review sidebar as compact summary, evaluation, then folded details", async () => {
    let initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "post-review";
    initial.working.hasSeenFuture = true;
    initial = upsertRecallPlanDraft(initial, {
      id: "post-plan-draft",
      planId: "post-plan",
      decisionId: initial.decisions[0]?.id ?? "fill-1",
      kind: "initial",
      input: {
        ...emptyRecallPlanInput("USD"),
        direction: "long",
        entry: "10",
        initialStop: "9",
        targets: [{ id: "target-1", price: "13", quantity: null, ratio: null }],
        sizeInputValue: "1",
        resolvedQuantity: "1",
        sizing: undefined,
      },
      recordedPhase: "pre-entry",
      recordedAt: "2025-01-02T09:00:00.000Z",
      source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: NO_REVEALED_EXECUTIONS },
      hasSeenFuture: true,
    });
    renderRecall(replayEpisode, initial);
    const sidebar = await waitFor(() => screen.getByRole("complementary", { name: "阶段计划" }));
    expect(sidebar.querySelector(".recall-plan-compact-summary")).not.toBeNull();
    expect(sidebar.querySelectorAll(".recall-plan-compact-summary > div")).toHaveLength(2);
    expect(sidebar.querySelector(".recall-plan-primary-content")).not.toBeNull();
    expect(sidebar.querySelectorAll(".recall-actual-metrics--compact > dl > div")).toHaveLength(4);
    expect(sidebar.querySelector(".recall-actual-metrics--compact")).toHaveTextContent("尚未平仓");
    const fullDetails = sidebar.querySelector(".recall-plan-secondary-content details");
    expect(fullDetails).not.toBeNull();
    expect((fullDetails as HTMLDetailsElement).open).toBe(false);
    expect(sidebar.querySelector(".recall-exit-evaluations")).not.toBeNull();
  });

  it("uses the full-history footer semantics throughout post-review", async () => {
    const datedReplayCandles = replayCandles.map((item, index) => ({
      ...item,
      time: `2025-06-${18 + Math.min(index, 1)}T14:${index === 0 ? "00" : index === 1 ? "15" : "30"}:00.000Z`,
      knowledgeAt: `2025-06-${18 + Math.min(index, 1)}T14:${index === 0 ? "15" : index === 1 ? "30" : "45"}:00.000Z`,
    }));
    const datedReplayEpisode = {
      ...replayEpisode,
      executions: replayEpisode.executions.map((execution, index) => ({
        ...execution,
        executedAt: `2025-03-${18 + index}T14:${index === 0 ? "00" : index === 1 ? "16" : "31"}:00.000Z`,
      })),
    };
    const initial = createRecallDocument(datedReplayEpisode, "2025-03-18T14:00:00.000Z");
    initial.working = {
      ...initial.working,
      phase: "post-review",
      hasSeenFuture: true,
      cursor: datedReplayCandles.at(-1)!.knowledgeAt!,
      executionCursor: "fill-3",
      selectedDecisionId: initial.decisions[0]?.id ?? "fill-1",
    };

    renderRecall(datedReplayEpisode, initial, undefined, undefined, {
      "15m": datedReplayCandles,
      "1D": datedReplayCandles,
      "1W": datedReplayCandles,
    });
    const provenance = () => document.querySelector(".recall-phase-provenance") as HTMLElement;
    await waitFor(() => expect(provenance()).toHaveTextContent("事后复盘 · 完整历史已主动揭示"));

    const strip = document.querySelector(".recall-position-strip") as HTMLElement;
    expect(strip.querySelector("strong")).toHaveTextContent("完整历史");
    expect(strip.querySelector(".live-dot")).not.toHaveClass("playing");
    const cutoff = strip.querySelector(".recall-replay-cutoff") as HTMLElement;
    expect(cutoff).toHaveAttribute("aria-label", expect.stringContaining("行情时间"));
    expect(cutoff).toHaveAttribute("aria-label", expect.stringContaining("成交截止"));
    const cutoffParts = [...cutoff.querySelectorAll("span")].map((part) => part.textContent ?? "");
    expect(cutoffParts[0]).toBe("行情时间 06-19 10:45");
    expect(cutoffParts[1]).toBe("成交截止 03-20 10:31");
  });

  it("keeps the terminal replay reason in More while the closed footer stays single-layer", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working = {
      ...initial.working,
      phase: "post-review",
      hasSeenFuture: true,
      executionCursor: "fill-3",
      selectedDecisionId: initial.decisions[0]?.id ?? "fill-1",
    };

    renderRecall(replayEpisode, initial, undefined, undefined, undefined, [], true);
    const more = await screen.findByRole("button", { name: "更多 / 记录" });
    const strip = document.querySelector(".recall-position-strip") as HTMLElement;

    expect(strip.querySelector(".recall-replay-summary-status")).toHaveTextContent("完整历史");
    expect(document.querySelector(".recall-replay-bar > .recall-replay-bar__secondary[role='status']")).toBeNull();

    await userEvent.click(more);
    const reason = document.querySelector(".recall-replay-more__status") as HTMLElement;
    expect(reason).toHaveTextContent("事后复盘已揭示完整历史");
    expect(within(reason).getByRole("button", { name: "回到买入前判断" })).toBeInTheDocument();
    expect(reason.closest(".recall-replay-more__body")).not.toHaveAttribute("hidden");
  });

  it("keeps the execution cutoff separate from the aligned market-axis cutoff", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    await waitFor(() => screen.getByRole("button", { name: "下一根 K 线" }));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    expect(screen.getByText(/成交截止/)).toBeInTheDocument();
    expect(screen.getByText(/行情时间/)).toBeInTheDocument();
  });

  it("captures a full post-review global summary and refits an offscreen same-timeframe viewport", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const lastCandle = replayCandles.at(-1)!;
    const postContext = {
      mode: "decision" as const,
      decisionId: "fill-3",
      drawings: [],
      timeframe: "1D" as const,
      cursor: lastCandle.knowledgeAt!,
      executionCursor: "fill-3",
      viewport: replayChartHarness.viewport,
    };
    initial.working = {
      ...initial.working,
      phase: "post-review",
      hasSeenFuture: true,
      // The global graph is intentionally still at the old pre-entry cutoff.
      cursor: replayCandles[0].knowledgeAt!,
      executionCursor: NO_REVEALED_EXECUTIONS,
      selectedDecisionId: "fill-3",
      editingContext: postContext,
      phaseContexts: { "post-review": postContext },
    };
    initial.snapshots = [
      ...replayEpisode.executions.map((execution, index) => ({
        ...retainedSnapshot(replayEpisode, execution.id),
        id: `snapshot-${index + 1}`,
      })),
      { ...retainedSnapshot(replayEpisode, "global"), id: "snapshot-global", decisionId: "global" },
    ];
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository);
    await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
    const offscreenViewport = {
      ...replayChartHarness.viewport,
      logicalRange: { from: replayCandles.length, to: replayCandles.length + 1 },
    };
    const fittedViewport = {
      ...replayChartHarness.viewport,
      logicalRange: { from: 0, to: replayCandles.length - 1 },
    };
    replayChartHarness.handle.getViewport.mockReturnValue(offscreenViewport);
    replayChartHarness.handle.capture.mockReset();
    replayChartHarness.handle.capture
      .mockResolvedValueOnce({ imageDataUrl: "data:image/png;base64,decision", viewport: replayChartHarness.viewport })
      .mockResolvedValueOnce({ imageDataUrl: "data:image/png;base64,global", viewport: fittedViewport });
    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });

    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(replayChartHarness.handle.fitAll).toHaveBeenCalled();
    expect(saved.working.executionCursor).toBe("fill-3");
    expect(saved.working.cursor).toBe(lastCandle.knowledgeAt);
    expect(saved.working.phase).toBe("post-review");
    expect(saved.working.selectedDecisionId).toBe("global");
    expect(saved.working.phaseContexts?.["post-review"]).toMatchObject({ mode: "global", decisionId: "global", executionCursor: "fill-3", viewport: fittedViewport });
    const globalSnapshot = saved.snapshots.find(snapshot => snapshot.decisionId === "global");
    expect(globalSnapshot?.executionCursor).toBe("fill-3");
    expect(globalSnapshot?.cursor).toBe(lastCandle.knowledgeAt);
    expect(globalSnapshot?.viewport).toEqual(fittedViewport);
  });

  it("uses the same post-review full-history boundary when completion starts from global", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    const lastCandle = replayCandles.at(-1)!;
    const postContext = {
      mode: "decision" as const,
      decisionId: "fill-3",
      drawings: [],
      timeframe: "1D" as const,
      cursor: lastCandle.knowledgeAt!,
      executionCursor: "fill-3",
      viewport: replayChartHarness.viewport,
    };
    initial.working = {
      ...initial.working,
      phase: "post-review",
      hasSeenFuture: true,
      cursor: replayCandles[0].knowledgeAt!,
      executionCursor: NO_REVEALED_EXECUTIONS,
      selectedDecisionId: "fill-3",
      editingContext: postContext,
      phaseContexts: { "post-review": postContext },
    };
    initial.snapshots = [
      ...replayEpisode.executions.map((execution, index) => ({
        ...retainedSnapshot(replayEpisode, execution.id),
        id: `global-path-snapshot-${index + 1}`,
        executionCursor: execution.id,
        phase: "holding" as const,
      })),
    ];
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(replayEpisode, initial, repository);
    await waitFor(() => expect(screen.getByRole("button", { name: /全局总结/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /全局总结/ }));
    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });

    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(saved.working.phase).toBe("post-review");
    expect(saved.working.executionCursor).toBe("fill-3");
    expect(saved.snapshots.find(snapshot => snapshot.decisionId === "global")?.phase).toBe("post-review");
  });

  it("freezes full-history metrics and manual evidence for a decision completion while keeping Text ownership", async () => {
    const lastCandle = replayCandles.at(-1)!;
    const initialText = { ...drawing, id: "global-text", tool: "text" as const, text: "全局说明", textRevision: 1, recallOwnerId: "global" };
    const decisionText = { ...drawing, id: "decision-text", tool: "text" as const, text: "决策说明", textRevision: 1, recallOwnerId: "completion-close" };
    let initial = createRecallDocument(completionEpisode, "2025-01-02T10:00:00.000Z");
    initial = upsertRecallPlanDraft(initial, {
      id: "completion-plan-draft",
      planId: "completion-plan",
      decisionId: "completion-entry",
      kind: "initial",
      input: {
        ...emptyRecallPlanInput("USD"),
        direction: "long",
        entry: "10",
        initialStop: "8",
        targets: [{ id: "target-1", price: "16", quantity: null, ratio: null }],
        sizeInputValue: "10",
        resolvedQuantity: "10",
        sizing: undefined,
      },
      recordedPhase: "pre-entry",
      recordedAt: "2025-01-02T09:00:00.000Z",
      source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: NO_REVEALED_EXECUTIONS },
      hasSeenFuture: false,
    });
    initial.snapshots = [
      ...completionEpisode.executions.map((execution, index) => ({
        ...retainedSnapshot(completionEpisode, execution.id),
        id: `completion-snapshot-${index + 1}`,
        executionCursor: execution.id,
        phase: "holding" as const,
      })),
      { ...retainedSnapshot(completionEpisode, "global"), id: "completion-global", decisionId: "global", executionCursor: NO_REVEALED_EXECUTIONS },
    ];
    initial = upsertRecallManualEvaluationDraft(initial, {
      id: "completion-manual-draft",
      evaluationId: "completion-manual",
      target: { scope: "episode", decisionId: null },
      tags: ["analysis"],
      tagDictionaryVersion: "manual-v1",
      evidence: [{ kind: "snapshot", snapshotId: "completion-global" }],
      source: "manual-retrospective",
      recordedBy: "user",
      recordedPhase: "post-review",
      recordedAt: "2025-01-02T11:00:00.000Z",
      knowledgeCutoff: { cursor: lastCandle.knowledgeAt!, executionCursor: "completion-close" },
      hasSeenFuture: true,
    });
    const postContext = {
      mode: "decision" as const,
      decisionId: "completion-close",
      drawings: [decisionText],
      timeframe: "15m" as const,
      cursor: lastCandle.knowledgeAt!,
      executionCursor: "completion-close",
      viewport: replayChartHarness.viewport,
    };
    initial.working = {
      ...initial.working,
      phase: "post-review",
      hasSeenFuture: true,
      timeframe: "1D",
      cursor: replayCandles[0].knowledgeAt!,
      executionCursor: NO_REVEALED_EXECUTIONS,
      selectedDecisionId: "completion-close",
      drawings: [initialText],
      editingContext: postContext,
      phaseContexts: { "post-review": postContext },
    };
    let persisted: RecallDocument | null = null;
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => {
        const saved = structuredClone(value);
        retainRecallActualMetrics(undefined, saved);
        persisted = saved;
        return { ...saved, revision: saved.revision + 1 };
      }),
      fetch: vi.fn(),
    };
    renderRecall(completionEpisode, initial, repository);
    await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });

    const saved = persisted!;
    const globalSnapshot = saved.snapshots.find(snapshot => snapshot.decisionId === "global");
    const globalBundle = saved.retainedBundles?.find(bundle => bundle.snapshotId === globalSnapshot?.id);
    expect(saved.working.phase).toBe("post-review");
    expect(saved.working.drawings).toEqual([initialText]);
    expect(saved.working.decisionDrafts?.find(draft => draft.decisionId === "completion-close")?.drawings).toEqual([decisionText]);
    expect(replayChartHarness.handle.fitAll).toHaveBeenCalled();
    expect(saved.working.phaseContexts?.["post-review"]).toMatchObject({
      mode: "global",
      decisionId: "global",
      timeframe: "1D",
      executionCursor: "completion-close",
      cursor: lastCandle.knowledgeAt,
      viewport: replayChartHarness.viewport,
    });
    expect(globalSnapshot).toMatchObject({ phase: "post-review", executionCursor: "completion-close", cursor: lastCandle.knowledgeAt });
    expect(globalBundle?.captureContext).toMatchObject({ phase: "post-review", executionCursor: "completion-close", cursor: lastCandle.knowledgeAt });
    expect(globalBundle?.manualEvaluationRevisionIds).toHaveLength(1);
    expect(globalBundle?.actualMetrics?.executionIds).toEqual(completionEpisode.executions.map(execution => execution.id));
    expect(globalBundle?.actualMetrics?.metrics.netPnl.value).not.toBeNull();

    const reopened = structuredClone(saved);
    cleanup();
    renderRecall(completionEpisode, reopened, {
      load: vi.fn().mockResolvedValue(reopened),
      save: vi.fn().mockResolvedValue({ ...reopened, revision: reopened.revision + 1 }),
      fetch: vi.fn(),
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "事后复盘" })).toHaveAttribute("aria-pressed", "true"));
    expect(document.querySelector(".recall-nav-item.global")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "completion-close");
  });

  it("keeps holding secondary details folded while retaining the revision entry", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "holding";
    renderRecall(replayEpisode, initial);
    const sidebar = await waitFor(() => screen.getByRole("complementary", { name: "阶段计划" }));
    const details = sidebar.querySelector(".recall-plan-secondary-content details");
    expect(details).toBeInstanceOf(HTMLDetailsElement);
    expect((details as HTMLDetailsElement).open).toBe(false);
    expect(details).toHaveTextContent("计划修订与来源详情");
  });

  it("keeps the post-review manual tag entry available when an episode has no exits", async () => {
    const openEpisode: TradeEpisode = {
      ...episode,
      status: "open",
      endedAt: undefined,
      remainingQuantity: "1",
    };
    const initial = createRecallDocument(openEpisode, "2025-01-02T10:00:00.000Z");
    initial.working.phase = "post-review";
    initial.working.hasSeenFuture = true;
    renderRecall(openEpisode, initial);

    expect(await screen.findByRole("group", { name: "人工回合标签" })).toBeInTheDocument();
    expect(screen.getByText("暂无可确认的退出决策")).toBeInTheDocument();
    const positionTag = screen.getByRole("checkbox", { name: "仓位" });
    fireEvent.click(positionTag);
    expect(positionTag).toBeChecked();
  });

  it("adjusts holding prices without replacing the retained initial risk", async () => {
    let initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    initial = upsertRecallPlanDraft(initial, {
      id: "initial-draft", planId: "initial-plan", decisionId: initial.decisions[0].id, kind: "initial",
      input: { ...emptyRecallPlanInput("USD"), sizing: undefined, direction: "long", entry: "10", initialStop: "8", targets: [{ id: "target-1", price: "14", quantity: null, ratio: null }], sizeInputValue: "1", resolvedQuantity: "1" },
      recordedPhase: "pre-entry", recordedAt: "2025-01-02T09:00:00.000Z", source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: "__recall_before_first_execution__" }, hasSeenFuture: false,
    });
    initial.snapshots = [{ ...retainedSnapshot(episode), phase: "holding" }];
    initial = freezeRecallSnapshotBundle(initial, "snapshot-1", { bundleId: "initial-bundle", retainedAt: "2025-01-02T10:20:00.000Z", episode });
    initial.working.phase = "holding";
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(episode, initial, repository);
    await waitFor(() => screen.getByRole("complementary", { name: "阶段计划" }));
    openPlanSecondaryDetails();
    fireEvent.change(await screen.findByLabelText("修订理由"), { target: { value: "结构收紧" } });
    fireEvent.click(screen.getByRole("button", { name: "调整持仓计划" }));
    fireEvent.change(await screen.findByLabelText("初始止损"), { target: { value: "9" } });
    expect(replayChartHarness.lastProps?.planLinesEditable).toBe(true);
    act(() => replayChartHarness.lastProps?.onPlanPriceChange?.("stop", "9.5"));
    await waitFor(() => expect(screen.getByLabelText("初始止损")).toHaveValue("9.5"));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(saved.plans?.drafts[0].input.initialStop).toBe("9.5");
    expect(saved.plans?.versions[0].input.initialStop).toBe("8");
    expect(saved.plans?.riskBaselines.map(baseline => baseline.amount)).toEqual(["2"]);
  });

  it("keeps independent exit edits and blocks retention while another exit has an incomplete reason", async () => {
    const exitEpisode: TradeEpisode = {
      ...episode, executions: [
        { ...episode.executions[0], quantity: "1000", price: "56" },
        { ...episode.executions[0], id: "exit-1", side: "sell", quantity: "600", price: "64", executedAt: "2025-01-02T10:16:00.000Z" },
        { ...episode.executions[0], id: "exit-2", side: "sell", quantity: "400", price: "61", executedAt: "2025-01-02T10:31:00.000Z" },
      ],
    };
    const initial = createRecallDocument(exitEpisode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(exitEpisode, initial, repository);
    fireEvent.click(await screen.findByRole("button", { name: "事后复盘" }));
    fireEvent.click(await screen.findByRole("radio", { name: "是" }));
    fireEvent.change(screen.getByLabelText("退出原因"), { target: { value: "other" } });
    fireEvent.change(screen.getByLabelText("退出决策"), { target: { value: "exit-2" } });
    fireEvent.click(screen.getByRole("radio", { name: "否" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭计划侧栏" }));
    fireEvent.click(screen.getByRole("button", { name: "计划侧栏" }));
    fireEvent.click(screen.getByRole("button", { name: "留存当前快照" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("请先修正结构化记录"));
    expect(replayChartHarness.handle.capture).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("退出决策"), { target: { value: "exit-1" } });
    expect(screen.getByRole("radio", { name: "是" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("其他原因说明"), { target: { value: "调低风险敞口" } });
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
    const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
    expect(saved.exitEvaluations?.drafts.map(draft => [draft.decisionId, draft.earlyExit]).sort()).toEqual([["exit-1", "yes"], ["exit-2", "no"]]);
  });

  it("saves a dragged entry price through the same plan as the numeric field", async () => {
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn().mockResolvedValue(initial),
      save: vi.fn().mockImplementation(async value => ({ ...value, revision: value.revision + 1 })),
      fetch: vi.fn(),
    };
    renderRecall(episode, initial, repository);
    fireEvent.click(await screen.findByRole("button", { name: "买入前判断" }));
    fireEvent.change(await screen.findByLabelText("计划入场"), { target: { value: "10" } });
    expect(replayChartHarness.lastProps?.planLinesEditable).toBe(true);
    expect(replayChartHarness.lastProps?.onPlanPriceChange).toBeTypeOf("function");
    act(() => replayChartHarness.lastProps?.onPlanPriceChange?.("entry", "11"));
    expect(screen.getByLabelText("计划入场")).toHaveValue("11");
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ plans: expect.objectContaining({ drafts: [expect.objectContaining({ input: expect.objectContaining({ entry: "11" }) })] }) }),
      expect.anything(),
    ), { timeout: 2500 });
  });

  it("keeps invalid price text across closing and blocks capturing the stale valid draft", async () => {
    renderRecall(episode, createRecallDocument(episode, "2025-01-02T10:00:00.000Z"));
    fireEvent.click(await screen.findByRole("button", {name:"买入前判断"}));
    await screen.findByLabelText("计划入场");
    fireEvent.change(screen.getByLabelText("计划入场"), {target:{value:"10"}});
    fireEvent.change(screen.getByLabelText("计划入场"), {target:{value:"10oops"}});
    fireEvent.click(screen.getByRole("button",{name:"关闭计划侧栏"}));
    fireEvent.click(screen.getByRole("button",{name:"计划侧栏"}));
    expect(screen.getByLabelText("计划入场")).toHaveValue("10oops");
    fireEvent.click(screen.getByRole("button",{name:"留存当前快照"}));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("请先修正计划输入"));
    expect(replayChartHarness.handle.capture).not.toHaveBeenCalled();
  });

  it("carries accepted capture stamps into a newer local edit without replacing a newer capture", () => {
    const original = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    original.snapshots = [retainedSnapshot(episode)];
    const captured = freezeRecallSnapshotBundle(original, "snapshot-1", {bundleId:"bundle-1",retainedAt:"2025-01-02T10:01:00.000Z",episode});
    const saved = structuredClone(captured);
    saved.revision = 1;
    saved.retainedBundles![0].documentRevision = 1;
    const local = freezeRecallSnapshotBundle(captured, "snapshot-1", {bundleId:"bundle-2",retainedAt:"2025-01-02T10:02:00.000Z",episode});
    local.working.drawings = [drawing];
    const reconciled = reconcileRecallSaveResponse(local, saved, 1, 2);
    expect(reconciled.document.retainedBundles?.map(bundle=>bundle.documentRevision)).toEqual([1,0]);
    expect(reconciled.document.snapshots[0].retainedBundleId).toBe("bundle-2");
    expect(reconciled.document.working.drawings).toEqual([drawing]);
    expect(reconciled.dirty).toBe(true);
  });
});

it("shows the entry plan on exit selection but does not inject it into a legacy snapshot", async () => {
  let initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
  initial = upsertRecallPlanDraft(initial, {
    id: "draft-1", planId: "plan-1", decisionId: initial.decisions[0].id,
    kind: "initial", input: {...emptyRecallPlanInput("USD"),entry:"123.45"},
    source: "retrospective", recordedPhase: "pre-entry", recordedAt: "2025-01-02T10:00:00.000Z",
    knowledgeCutoff: {cursor: initial.working.cursor,executionCursor:initial.working.executionCursor},hasSeenFuture:false,
  });
  initial.snapshots=[retainedSnapshot(replayEpisode)];
  initial.working.selectedDecisionId = initial.decisions.at(-1)!.id;
  initial.working.phase = "post-review";
  renderRecall(replayEpisode, initial);
  expect(await screen.findByText("123.45")).toBeInTheDocument();
  await openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button",{name:"编辑决策 1快照"}));
  expect(await screen.findByText("原计划未记录")).toBeInTheDocument();
  expect(screen.queryByText("123.45")).not.toBeInTheDocument();
});

it("autosaves a representative stage selection through the existing repository", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.snapshots = [{...retainedSnapshot(episode),phase:"holding"}];
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async document=>({...document,revision:document.revision+1})),
    fetch:vi.fn(),
  };
  renderRecall(episode,initial,repository);
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openStoryboard();
  fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
  fireEvent.change(await screen.findByLabelText("持仓过程代表快照"),{target:{value:"snapshot-1"}});
  await waitFor(()=>expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({storyboard:{holding:{snapshotId:"snapshot-1"}}}),expect.anything()),{timeout:2500});
});

it("keeps the document unchanged on unfinished text capture and retains once after retry", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.drawings = [drawing];
  const message = "文字编辑或关联取点尚未完成，请先完成或取消编辑；草稿已保留";
  replayChartHarness.handle.capture.mockRejectedValueOnce(new Error(message));
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async (document: RecallDocument) => ({ ...document, revision: document.revision + 1 })),
    fetch: vi.fn(),
  };
  let guard: (() => Promise<boolean>) | null = null;
  renderRecall(episode, initial, repository, next => { guard = next; });
  fireEvent.click(await screen.findByRole("button", { name: "留存当前快照" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(repository.save).not.toHaveBeenCalled();
  expect(initial.snapshots).toEqual([]);
  expect(initial.working.drawings).toEqual([drawing]);
  fireEvent.click(screen.getByRole("button", { name: "留存当前快照" }));
  await openAllSnapshotRecords();
  await screen.findByRole("button", { name: "编辑决策 1快照" });
  let allowed!: boolean;
  await act(async () => { allowed = await guard!(); });
  expect(allowed).toBe(true);
  expect(replayChartHarness.handle.capture).toHaveBeenCalledTimes(2);
  expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ snapshots: expect.arrayContaining([expect.objectContaining({ imageDataUrl: "data:image/png;base64,AA==" })]) }),
    expect.anything(),
  );
  // Keep the existing eventual repository-boundary assertion as a persistence
  // check; the immediate guard assertion above owns the navigation contract.
  await waitFor(() => expect(repository.save).toHaveBeenCalledWith(
    expect.objectContaining({ snapshots: expect.arrayContaining([expect.objectContaining({ imageDataUrl: "data:image/png;base64,AA==" })]) }),
    expect.anything(),
  ), { timeout: 2500 });
  const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
  expect(saved.snapshots).toHaveLength(1);
  expect(saved.snapshots[0].imageDataUrl).toBe("data:image/png;base64,AA==");
  expect(saved.snapshots[0].drawings).toEqual([drawing]);
  expect(saved.working).toMatchObject({
    cursor: initial.working.cursor, executionCursor: initial.working.executionCursor,
    drawings: [drawing],
  });
  expect(saved.working.phase).toBe(initial.working.phase);
  expect(saved.working.hasSeenFuture).toBe(initial.working.hasSeenFuture);
});

it("does not report a clean leave guard before a retained snapshot reaches the save boundary", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.drawings = [drawing];
  let resolveCapture!: (value: {imageDataUrl: string; viewport: typeof replayChartHarness.viewport}) => void;
  replayChartHarness.handle.capture.mockReturnValueOnce(new Promise(resolve => { resolveCapture = resolve; }));
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async (document: RecallDocument) => ({...document, revision: document.revision + 1})),
    fetch: vi.fn(),
  };
  let guard: (() => Promise<boolean>) | null = null;
  renderRecall(episode, initial, repository, next => { guard = next; });
  fireEvent.click(await screen.findByRole("button", {name: "留存当前快照"}));

  let allowed!: boolean;
  await act(async () => {
    resolveCapture({imageDataUrl: "data:image/png;base64,boundary", viewport: replayChartHarness.viewport});
    await Promise.resolve();
    await Promise.resolve();
    allowed = await guard!();
  });

  const latest = vi.mocked(repository.save).mock.calls.at(-1)?.[0];
  expect(allowed).toBe(true);
  expect(latest).toBeDefined();
  expect(latest!.snapshots).toHaveLength(1);
  expect(latest!.snapshots[0].imageDataUrl).toBe("data:image/png;base64,boundary");
  await openAllSnapshotRecords();
  await screen.findByRole("button", {name: "编辑决策 1快照"});
  const flushed = vi.mocked(repository.save).mock.calls.at(-1)![0];
  expect(flushed.snapshots).toHaveLength(1);
});

it("blocks or awaits navigation while a retain capture is pending", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  let resolveCapture!: (value: {imageDataUrl: string; viewport: typeof replayChartHarness.viewport}) => void;
  replayChartHarness.handle.capture.mockReturnValueOnce(new Promise(resolve => { resolveCapture = resolve; }));
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async (document: RecallDocument) => ({...document, revision: document.revision + 1})),
    fetch: vi.fn(),
  };
  let guard: (() => Promise<boolean>) | null = null;
  renderRecall(episode, initial, repository, next => { guard = next; });
  fireEvent.click(await screen.findByRole("button", {name: "留存当前快照"}));

  let guardPromise!: Promise<boolean>;
  let settled = false;
  await act(async () => {
    guardPromise = guard!();
    void guardPromise.then(() => { settled = true; });
    await Promise.resolve();
  });
  expect(settled).toBe(false);
  resolveCapture({imageDataUrl: "data:image/png;base64,pending", viewport: replayChartHarness.viewport});
  let allowed!: boolean;
  await act(async () => { allowed = await guardPromise; });
  const latest = vi.mocked(repository.save).mock.calls.at(-1)?.[0];
  expect(allowed).toBe(true);
  expect(latest).toBeDefined();
  expect(latest!.snapshots).toHaveLength(1);
  expect(latest!.snapshots[0].imageDataUrl).toBe("data:image/png;base64,pending");
});

it("keeps a server-stamped capture when Text changes during its save", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  let resolveCapture!: (value: { imageDataUrl: string; viewport: typeof replayChartHarness.viewport }) => void;
  const pendingCapture = new Promise<{ imageDataUrl: string; viewport: typeof replayChartHarness.viewport }>(resolve => {
    resolveCapture = resolve;
  });
  replayChartHarness.handle.capture.mockReturnValueOnce(pendingCapture);
  let resolveFirst!: (document: RecallDocument) => void;
  let submitted!: RecallDocument;
  let guard: (() => Promise<boolean>) | null = null;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementationOnce((document: RecallDocument) => {
      submitted = structuredClone(document);
      return new Promise<RecallDocument>(resolve => { resolveFirst = resolve; });
    }).mockImplementation(async (document: RecallDocument) => {
      expect(document.retainedBundles?.[0].documentRevision).toBe(1);
      expect(document.revision).toBe(1);
      return {...document,revision:2};
    }),
    fetch: vi.fn(),
  };
  renderRecall(episode,initial,repository,next=>{guard=next;});
  await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-1"));
  fireEvent.click(await screen.findByRole("button",{name:"留存当前快照"}));
  await act(async () => {
    resolveCapture({ imageDataUrl: "data:image/png;base64,AA==", viewport: replayChartHarness.viewport });
    await pendingCapture;
  });
  await openAllSnapshotRecords();
  await screen.findByRole("button",{name:"编辑决策 1快照"});
  let first!: Promise<boolean>;
  act(()=>{first=guard!();});
  await waitFor(()=>expect(repository.save).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button",{name:"add drawing"}));
  let queued!: Promise<boolean>;
  act(()=>{queued=guard!();});
  await act(async()=>{
    resolveFirst({...submitted,revision:1,retainedBundles:submitted.retainedBundles?.map(bundle=>({...bundle,documentRevision:1}))});
    await first;
    await queued;
  });
  expect(await queued).toBe(true);
  const last = vi.mocked(repository.save).mock.calls.at(-1)![0];
  expect(last.working.drawings).toHaveLength(1);
  expect(last.retainedBundles?.[0].documentRevision).toBe(1);
});

it("reopens the later entry's own frozen plan instead of the first bundled entry plan", async () => {
  let initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
  for (const [index, decision] of initial.decisions.slice(0,2).entries()) {
    initial = upsertRecallPlanDraft(initial, {
      id:`draft-${index}`,planId:`plan-${index}`,decisionId:decision.id,kind:"initial",
      input:{...emptyRecallPlanInput("USD"),entry:index===0?"111.11":"222.22"},
      source:"retrospective",recordedPhase:"pre-entry",recordedAt:"2025-01-02T10:00:00.000Z",
      knowledgeCutoff:{cursor:"2025-01-02T09:00:00.000Z",executionCursor:"__recall_before_first_execution__"},hasSeenFuture:false,
    });
  }
  const owner = initial.decisions[1].id;
  initial.snapshots=[{...retainedSnapshot(replayEpisode,owner),phase:"holding",cursor:"2025-01-02T10:30:00.000Z",executionCursor:"fill-2"}];
  initial=freezeRecallSnapshotBundle(initial,"snapshot-1",{bundleId:"two-entry-bundle",retainedAt:"2025-01-02T10:30:00.000Z",episode:replayEpisode});
  expect(initial.retainedBundles![0].planVersionIds).toHaveLength(2);
  // Current associations deliberately disagree: historical owner identity wins.
  initial.planAssociations=initial.plans!.versions.map(version=>({planId:version.planId,decisionId:initial.decisions[0].id,status:"linked"}));
  renderRecall(replayEpisode,initial);
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "返回回放" }).length).toBeGreaterThan(0));
  fireEvent.click(await screen.findByRole("button",{name:"编辑决策 2快照"}));
  expect(await screen.findByText("222.22")).toBeInTheDocument();
  expect(screen.queryByText("111.11")).not.toBeInTheDocument();
});

it("coalesces queued leave saves already acknowledged by the first save", async () => {
  const initial=createRecallDocument(episode,"2025-01-02T10:00:00.000Z");
  let resolve!: (document:RecallDocument)=>void;
  let submitted!:RecallDocument;
  let guard:(()=>Promise<boolean>)|null=null;
  const repository:RecallRepository={load:vi.fn().mockResolvedValue(initial),fetch:vi.fn(),save:vi.fn().mockImplementation((document:RecallDocument)=>{submitted=document;return new Promise<RecallDocument>(done=>{resolve=done;});})};
  renderRecall(episode,initial,repository,next=>{guard=next;});
  fireEvent.click(await screen.findByRole("button",{name:"add drawing"}));
  let first!:Promise<boolean>,second!:Promise<boolean>;
  act(()=>{first=guard!();second=guard!();});
  await waitFor(()=>expect(repository.save).toHaveBeenCalledTimes(1));
  await act(async()=>{resolve({...submitted,revision:1});await first;await second;});
  expect(repository.save).toHaveBeenCalledTimes(1);
  expect(await second).toBe(true);
});

it("serializes finalization with an autosave scheduled while chart capture is pending", async () => {
  vi.useFakeTimers();
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.snapshots = [retainedSnapshot(episode)];
  let releaseCapture!: (value: {imageDataUrl: string; viewport: typeof replayChartHarness.viewport}) => void;
  replayChartHarness.handle.capture.mockImplementationOnce(() => new Promise(resolve => { releaseCapture = resolve; }));
  let revision = 0;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementation(async (document: RecallDocument, options?: {expectedRevision: number; finalize?: boolean}) => {
      if (options?.expectedRevision !== revision) throw new RecallRepositoryError(409, "revision-conflict", "Stale completion revision");
      revision += 1;
      return {...document, revision};
    }),
  };
  renderRecall(episode, initial, repository);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole("button", {name: "add drawing"}));
  await openMoreRecords();
  fireEvent.click(screen.getByRole("button", {name: /保存并完成回合复盘/}));
  await act(async () => { await Promise.resolve(); });
  expect(replayChartHarness.handle.capture).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await act(async () => {
    releaseCapture({imageDataUrl: "data:image/png;base64,AA==", viewport: replayChartHarness.viewport});
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.queryByText("Stale completion revision")).not.toBeInTheDocument();
  expect(screen.getByText(/已完成/)).toBeInTheDocument();
  expect(vi.mocked(repository.save).mock.calls.some(([, options]) => options?.finalize)).toBe(true);
  expect(repository.save).toHaveBeenCalledTimes(1);
});

it("keeps a plan edit made during the final save dirty and saves it after the frozen formal candidate", async () => {
  vi.useFakeTimers();
  let initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "holding";
  initial.snapshots = [retainedSnapshot(episode)];
  initial = upsertRecallPlanDraft(initial, {
    id: "draft-1", planId: "plan-1", decisionId: initial.decisions[0].id, kind: "initial",
    input: {...emptyRecallPlanInput("USD"), entry: "10"}, source: "retrospective", recordedPhase: "pre-entry",
    recordedAt: "2025-01-02T10:00:00.000Z", knowledgeCutoff: {cursor: initial.working.cursor, executionCursor: initial.working.executionCursor}, hasSeenFuture: false,
  });
  initial = freezeRecallPlanDraft(initial, "draft-1", {versionId: "initial-version", riskBaselineId: "initial-risk", retainedAt: "2025-01-02T10:00:00.000Z"});
  initial = createRecallPlanRevision(initial, {planId: "plan-1", kind: "adjustment", reason: "调整执行价格", id: "adjustment", recordedAt: "2025-01-02T10:00:00.000Z", recordedPhase: "holding", knowledgeCutoff: {cursor: initial.working.cursor, executionCursor: initial.working.executionCursor}, hasSeenFuture: false});
  let releaseFinalize!: () => void;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementation(async (document: RecallDocument, options?: {finalize?: boolean}) => {
      const saved = {...document, revision: document.revision + 1};
      if (options?.finalize) {
        await new Promise<void>(resolve => { releaseFinalize = resolve; });
        saved.retainedBundles = saved.retainedBundles?.map(bundle => ({...bundle, documentRevision: saved.revision}));
        const formal = {...saved};
        delete formal.lastCompleted;
        saved.lastCompleted = {...formal, status: "completed", completedAt: formal.completedAt ?? "2025-01-02T10:30:00.000Z"};
      }
      return saved;
    }),
  };
  renderRecall(episode, initial, repository);
  await act(async () => { await Promise.resolve(); });
  await openMoreRecords();
  fireEvent.click(screen.getByRole("button", {name: /保存并完成回合复盘/}));
  await act(async () => { await Promise.resolve(); });
  openPlanSecondaryDetails();
  const entryField = screen.getByLabelText("计划入场");
  fireEvent.change(entryField, {target: {value: "11"}});
  await act(async () => {
    releaseFinalize();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(screen.getByText(/有草稿修改/)).toBeInTheDocument();
  const formal = vi.mocked(repository.save).mock.calls[0][0];
  expect(formal.plans?.drafts[0].input.entry).toBe("10");
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(repository.save).toHaveBeenCalledTimes(2);
  const [draft, options] = vi.mocked(repository.save).mock.calls[1];
  expect(options?.finalize).not.toBe(true);
  expect(draft.plans?.drafts[0].input.entry).toBe("11");
  expect(draft.lastCompleted?.plans?.drafts[0].input.entry).toBe("10");
  expect(draft.retainedBundles).toHaveLength(1);
  expect(draft.retainedBundles![0].documentRevision).toBe(1);
  expect(draft.plans?.versions.map(version => version.id)).toEqual(formal.plans?.versions.map(version => version.id));
  expect(() => validateRecallDocument(draft)).not.toThrow();
  expect(() => confirmRecallRetainedState(draft.lastCompleted, draft, episode, 2)).not.toThrow();
});

it("preserves newer local edits and blocks leaving on a genuine external revision conflict", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  let guard: (() => Promise<boolean>) | null = null;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementationOnce(async (document: RecallDocument) => ({...document, revision: 1}))
      .mockRejectedValue(new RecallRepositoryError(409, "revision-conflict", "External edit")),
  };
  renderRecall(episode, initial, repository, next => { guard = next; });
  fireEvent.click(await screen.findByRole("button", {name: "add drawing"}));
  await act(async () => { expect(await guard!()).toBe(true); });
  fireEvent.click(screen.getByRole("button", {name: "留存当前快照"}));
  await openAllSnapshotRecords();
  await screen.findByRole("button", {name: "编辑决策 1快照"});
  await act(async () => { expect(await guard!()).toBe(false); });
  expect(screen.getByRole("dialog")).toHaveTextContent("复盘版本已更新；当前草稿已保留。");
  expect(screen.getByRole("button", {name: "编辑决策 1快照"})).toBeInTheDocument();
  const [submitted, options] = vi.mocked(repository.save).mock.calls.at(-1)!;
  expect(options?.expectedRevision).toBe(1);
  expect(submitted.working.drawings).toHaveLength(1);
  expect(submitted.snapshots).toHaveLength(1);
});

it("reloads server plan input after a conflict instead of reusing the stale local overlay", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "pre-entry";
  initial.plans = {
    drafts: [{
      id: "initial-draft",
      planId: "initial-plan",
      decisionId: initial.decisions[0].id,
      kind: "initial",
      input: applyRecallSizing({ ...emptyRecallPlanInput("USD"), direction: "long", entry: "10", initialStop: "8", targets: [{ id: "target-1", price: "14", quantity: null, ratio: null }], sizeInputValue: "1100" }),
      recordedPhase: "pre-entry",
      recordedAt: "2025-01-02T09:00:00.000Z",
      source: "retrospective",
      knowledgeCutoff: { cursor: "2025-01-02T09:00:00.000Z", executionCursor: NO_REVEALED_EXECUTIONS },
      hasSeenFuture: false,
    }],
    versions: [],
    riskBaselines: [],
  };
  initial.planAssociations = [{ planId: "initial-plan", decisionId: initial.decisions[0].id, status: "linked" }];
  const server = structuredClone(initial);
  server.revision = 1;
  server.plans!.drafts[0].input = applyRecallSizing({ ...server.plans!.drafts[0].input, sizeInputValue: "1200" });
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(server),
    fetch: vi.fn(),
    save: vi.fn()
      .mockRejectedValueOnce(new RecallRepositoryError(409, "revision-conflict", "External edit"))
      .mockImplementation(async (document: RecallDocument) => ({ ...document, revision: document.revision + 1 })),
  };

  renderRecall(episode, initial, repository);
  fireEvent.click(await screen.findByRole("button", { name: "买入前判断" }));
  const quantity = await screen.findByLabelText("计划数量");
  expect(quantity).toHaveValue("1100");
  fireEvent.change(quantity, { target: { value: "1300" } });
  await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2500 });
  fireEvent.click(await screen.findByRole("button", { name: "重新载入" }));

  await waitFor(() => expect(screen.getByLabelText("计划数量")).toHaveValue("1200"));
  fireEvent.change(screen.getByLabelText("计划数量"), { target: { value: "1300" } });
  fireEvent.change(screen.getByLabelText("计划入场"), { target: { value: "11" } });
  await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2), { timeout: 2500 });
  const [saved] = vi.mocked(repository.save).mock.calls.at(-1)!;
  expect(saved.plans?.drafts[0].input).toMatchObject({
    sizeInputValue: "1300",
    resolvedQuantity: "1300",
    entry: "11",
  });
  expect(screen.getByLabelText("计划数量")).toHaveValue("1300");
});

it("does not rebase a new episode onto an accepted save from another episode", async () => {
  const otherEpisode = {...episode, id: "episode-other"};
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  const other = createRecallDocument(otherEpisode, "2025-01-02T10:00:00.000Z");
  let guard: (() => Promise<boolean>) | null = null;
  const repository: RecallRepository = {
    load: vi.fn().mockImplementation(async id => id === episode.id ? initial : other),
    fetch: vi.fn(),
    save: vi.fn().mockImplementation(async (document: RecallDocument) => ({...document, revision: document.revision + 1})),
  };
  const onGuard = (next: typeof guard) => { guard = next; };
  const view = (selected: TradeEpisode) => <RecallWorkspace
    episode={selected} episodes={[episode, otherEpisode]} instrument={selected.instrument}
    instruments={[{...selected.instrument, market: "US"}]} timeframeAvailability={availability}
    importedTimelineCandles={replayCandles} candlesByTimeframe={{"15m": replayCandles, "1D": replayCandles, "1W": replayCandles}}
    settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()}
    onSettingsChange={vi.fn()} onLeaveGuardChange={onGuard}
  />;
  const rendered = render(view(episode));
  fireEvent.click(await screen.findByRole("button", {name: "add drawing"}));
  await act(async () => { expect(await guard!()).toBe(true); });
  rendered.rerender(view(otherEpisode));
  await waitFor(() => expect(repository.load).toHaveBeenCalledWith(otherEpisode.id));
  fireEvent.click(await screen.findByRole("button", {name: "add drawing"}));
  await act(async () => { expect(await guard!()).toBe(true); });
  const [submitted, options] = vi.mocked(repository.save).mock.calls.at(-1)!;
  expect(submitted.episodeId).toBe(otherEpisode.id);
  expect(submitted.revision).toBe(0);
  expect(options?.expectedRevision).toBe(0);
});

it("leaves loading when market hydration restores the current draft after a cancelled episode load", async () => {
  const otherEpisode = {...episode, id: "episode-other"};
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValueOnce(initial).mockImplementation(() => new Promise(() => {})),
    fetch: vi.fn(), save: vi.fn(),
  };
  const view = (selected: TradeEpisode, candles = replayCandles) => <RecallWorkspace
    episode={selected} episodes={[episode, otherEpisode]} instrument={selected.instrument}
    instruments={[{...selected.instrument, market: "US"}]} timeframeAvailability={availability}
    importedTimelineCandles={candles} candlesByTimeframe={{"15m": candles, "1D": candles, "1W": candles}}
    settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()}
  />;
  const rendered = render(view(episode));
  await screen.findByRole("button", {name: "add drawing"});
  rendered.rerender(view(otherEpisode));
  await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(2));
  rendered.rerender(view(episode));
  await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(3));
  expect(screen.getByText("正在读取复盘草稿…")).toBeInTheDocument();
  rendered.rerender(view(episode, [...replayCandles]));
  expect(await screen.findByRole("button", {name: "add drawing"})).toBeInTheDocument();
  expect(screen.queryByText("正在读取复盘草稿…")).not.toBeInTheDocument();
  expect(repository.load).toHaveBeenCalledTimes(3);
});

it("does not show the previous episode when a newly selected episode fails to load", async () => {
  const otherEpisode = { ...episode, id: "episode-read-fails" };
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error("storage unavailable")),
    fetch: vi.fn(),
    save: vi.fn(),
  };
  const view = (selected: TradeEpisode) => <RecallWorkspace
    episode={selected} episodes={[episode, otherEpisode]} instrument={selected.instrument}
    instruments={[{ ...selected.instrument, market: "US" }]} timeframeAvailability={availability}
    importedTimelineCandles={replayCandles} candlesByTimeframe={{ "15m": replayCandles, "1D": replayCandles, "1W": replayCandles }}
    settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()}
  />;
  const rendered = render(view(episode));
  expect(await screen.findByRole("button", { name: "add drawing" })).toBeInTheDocument();

  rendered.rerender(view(otherEpisode));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("storage unavailable"));
  expect(screen.queryByRole("button", { name: "add drawing" })).not.toBeInTheDocument();
  expect(screen.queryByText("TEST")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重新读取此回合" }));
  await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(3));
});

it("keeps an orphaned pre-entry context unrevealed and explicitly unassigned after fill replacement", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T09:59:59.999Z");
  const owner = initial.decisions[0].id;
  const originalDrawing = {...drawing, recallOwnerId: owner, stage: "pre-trade" as const};
  const context = {
    mode: "decision" as const, decisionId: owner, drawings: [originalDrawing], timeframe: "15m" as const,
    cursor: "2025-01-02T09:59:59.999Z", executionCursor: NO_REVEALED_EXECUTIONS, revealedCandleCursor: null,
  };
  initial.working = {...initial.working, phase: "pre-entry", cursor: context.cursor, executionCursor: context.executionCursor,
    drawings: [originalDrawing], editingContext: context, phaseContexts: {"pre-entry": context}};
  const replacement = {...episode, executions: [{...episode.executions[0], id: "replacement-fill"}]};
  let guard: (() => Promise<boolean>) | null = null;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementation(async (document: RecallDocument) => ({...document, revision: document.revision + 1})),
  };
  const onGuard = (next: typeof guard) => { guard = next; };
  const view = (selected: TradeEpisode) => <RecallWorkspace
    episode={selected} episodes={[selected]} instrument={selected.instrument}
    instruments={[{...selected.instrument, market: "US"}]} timeframeAvailability={availability}
    importedTimelineCandles={replayCandles} candlesByTimeframe={{"15m": replayCandles, "1D": replayCandles}}
    settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()}
    onSettingsChange={vi.fn()} onLeaveGuardChange={onGuard}
  />;
  const rendered = render(view(episode));
  await screen.findByTestId("mock-replay-chart");
  rendered.rerender(view(replacement));
  expect(await screen.findByText("导入行情已有变更")).toBeInTheDocument();
  expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", context.cursor);
  expect(screen.getByTestId("mock-replay-chart")).not.toHaveAttribute("data-execution-cursor");
  expect(screen.getByRole("button", {name: "确认已处理行情变更"})).toBeDisabled();
  await act(async () => { expect(await guard!()).toBe(true); });
  const saved = vi.mocked(repository.save).mock.calls.at(-1)![0];
  expect(saved.reconciliation?.stale).toBe(true);
  expect(saved.decisions.find(decision => decision.id === owner)?.executionIds).toEqual([]);
  expect(saved.working.phaseContexts?.["pre-entry"]?.decisionId).toBe(owner);
  expect(saved.working.phaseContexts?.["pre-entry"]?.drawings).toEqual([originalDrawing]);
});

it("cancels first initial-plan freezing if that input changes during completion capture", async () => {
  vi.useFakeTimers();
  let initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "pre-entry";
  initial.snapshots = [retainedSnapshot(episode)];
  initial = upsertRecallPlanDraft(initial, {
    id: "draft-1", planId: "plan-1", decisionId: initial.decisions[0].id, kind: "initial",
    input: {...emptyRecallPlanInput("USD"), entry: "10"}, source: "retrospective", recordedPhase: "pre-entry",
    recordedAt: "2025-01-02T10:00:00.000Z", knowledgeCutoff: {cursor: initial.working.cursor, executionCursor: initial.working.executionCursor}, hasSeenFuture: false,
  });
  let releaseCapture!: (value: {imageDataUrl: string; viewport: typeof replayChartHarness.viewport}) => void;
  replayChartHarness.handle.capture.mockImplementationOnce(() => new Promise(resolve => { releaseCapture = resolve; }));
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementation(async document => ({...document, revision: document.revision + 1})),
  };
  renderRecall(episode, initial, repository);
  await act(async () => { await Promise.resolve(); });
  await openMoreRecords();
  fireEvent.click(screen.getByRole("button", {name: /保存并完成回合复盘/}));
  await act(async () => { await Promise.resolve(); });
  fireEvent.change(screen.getByLabelText("计划入场"), {target: {value: "11"}});
  await act(async () => { releaseCapture({imageDataUrl: "data:image/png;base64,AA==", viewport: replayChartHarness.viewport}); });
  expect(within(screen.getByRole("dialog", { name: "复盘错误详情" })).getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeVisible();
  expect(repository.save).not.toHaveBeenCalled();
  expect(screen.getByLabelText("计划入场")).toHaveValue("11");
  expect(screen.getByText(/有草稿修改/)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  const [draft, options] = vi.mocked(repository.save).mock.calls[0];
  expect(options?.finalize).not.toBe(true);
  expect(draft.plans?.drafts[0].input.entry).toBe("11");
  expect(draft.lastCompleted).toBeUndefined();
});

it("rejects completion when a Text edit lands while the global flush is pending, then allows retry", async () => {
  vi.useFakeTimers();
  const lastCandle = replayCandles.at(-1)!;
  const initial = createRecallDocument(completionEpisode, "2025-01-02T10:00:00.000Z");
  initial.snapshots = initial.decisions.map((decision, index) => ({
    ...retainedSnapshot(completionEpisode, decision.id),
    id: `flush-snapshot-${index + 1}`,
    executionCursor: decision.id,
    phase: "holding" as const,
  }));
  const postContext = {
    mode: "decision" as const,
    decisionId: "completion-close",
    drawings: [],
    timeframe: "15m" as const,
    cursor: lastCandle.knowledgeAt!,
    executionCursor: "completion-close",
    viewport: replayChartHarness.viewport,
  };
  initial.working = {
    ...initial.working,
    phase: "post-review",
    hasSeenFuture: true,
    timeframe: "1D",
    cursor: lastCandle.knowledgeAt!,
    executionCursor: "completion-close",
    selectedDecisionId: "completion-close",
    editingContext: postContext,
    phaseContexts: { "post-review": postContext },
  };

  let releaseFlush!: () => void;
  const pendingFlush = new Promise<void>(resolve => { releaseFlush = resolve; });
  replayChartHarness.handle.flush.mockReset();
  replayChartHarness.handle.flush.mockImplementationOnce(() => pendingFlush).mockResolvedValue(undefined);
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn().mockImplementation(async document => ({ ...document, revision: document.revision + 1 })),
    fetch: vi.fn(),
  };
  renderRecall(completionEpisode, initial, repository);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  openMoreRecords();
  fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(replayChartHarness.handle.capture).toHaveBeenCalledTimes(1);
  expect(replayChartHarness.handle.flush).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "add Text" }));
  await act(async () => {
    releaseFlush();
    await pendingFlush;
    await Promise.resolve();
  });
  expect(within(screen.getByRole("dialog", { name: "复盘错误详情" })).getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeVisible();
  expect(repository.save).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ finalize: true }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(repository.save).toHaveBeenCalled();
  const [draft, options] = vi.mocked(repository.save).mock.calls.at(-1)!;
  expect(options?.finalize).not.toBe(true);
  expect(draft.working.drawings).toHaveLength(1);
  expect(screen.getByRole("button", { name: "add Text" })).toBeInTheDocument();

  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  expect(vi.mocked(repository.save).mock.calls.some(([, saveOptions]) => saveOptions?.finalize === true)).toBe(true);
  expect(screen.queryByRole("dialog", { name: "复盘错误详情" })).not.toBeInTheDocument();
});

it("does not install a previous episode's late completion as the current formal baseline", async () => {
  const otherEpisode = {...episode, id: "episode-other"};
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.snapshots = [retainedSnapshot(episode)];
  const other = createRecallDocument(otherEpisode, "2025-01-02T10:00:00.000Z");
  let submitted!: RecallDocument;
  let resolveSave!: (document: RecallDocument) => void;
  const repository: RecallRepository = {
    load: vi.fn().mockImplementation(async id => id === episode.id ? initial : other), fetch: vi.fn(),
    save: vi.fn().mockImplementation((document: RecallDocument) => {submitted = document; return new Promise(resolve => {resolveSave = resolve;});}),
  };
  const view = (selected: TradeEpisode) => <RecallWorkspace
    episode={selected} episodes={[episode, otherEpisode]} instrument={selected.instrument}
    instruments={[{...selected.instrument, market: "US"}]} timeframeAvailability={availability}
    importedTimelineCandles={replayCandles} candlesByTimeframe={{"15m": replayCandles, "1D": replayCandles, "1W": replayCandles}}
    settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()}
  />;
  const rendered = render(view(episode));
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openMoreRecords();
  fireEvent.click(await screen.findByRole("button", {name: /保存并完成回合复盘/}));
  await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
  rendered.rerender(view(otherEpisode));
  await screen.findByRole("button", {name: "add drawing"});
  await act(async () => {resolveSave({...submitted, revision: 1});});
  expect(screen.queryByText(/有草稿修改/)).not.toBeInTheDocument();
  expect(screen.queryByText(/已完成/)).not.toBeInTheDocument();
});

it("locks the original plan only while its first finalization request is pending and unlocks on failure", async () => {
  let initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "pre-entry";
  initial.snapshots = [retainedSnapshot(episode)];
  initial = upsertRecallPlanDraft(initial, {
    id: "draft-1", planId: "plan-1", decisionId: initial.decisions[0].id, kind: "initial",
    input: {...emptyRecallPlanInput("USD"), entry: "10"}, source: "retrospective", recordedPhase: "pre-entry",
    recordedAt: "2025-01-02T10:00:00.000Z", knowledgeCutoff: {cursor: initial.working.cursor, executionCursor: initial.working.executionCursor}, hasSeenFuture: false,
  });
  let rejectSave!: (error: Error) => void;
  const repository: RecallRepository = {
    load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(),
    save: vi.fn().mockImplementation(() => new Promise((_resolve, reject) => {rejectSave = reject;})),
  };
  renderRecall(episode, initial, repository);
  await screen.findByLabelText("计划入场");
  const oldPriceHandler = replayChartHarness.lastProps?.onPlanPriceChange;
  await openMoreRecords();
  fireEvent.click(screen.getByRole("button", {name: /保存并完成回合复盘/}));
  await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));
  expect(screen.queryByLabelText("计划入场")).not.toBeInTheDocument();
  expect(replayChartHarness.lastProps?.planLinesEditable).toBe(false);
  // A callback captured by the chart before the lock cannot bypass it.
  act(() => oldPriceHandler?.("entry", "11"));
  await act(async () => {rejectSave(new Error("finalize unavailable"));});
  expect(await screen.findByLabelText("计划入场")).toHaveValue("10");
  expect(replayChartHarness.lastProps?.planLinesEditable).toBe(true);
});

it.each(["pre-entry", "holding"] as const)("renders a retained post-review metric using its captured phase when opened from %s", async phase => {
  let initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = phase;
  initial.snapshots = [{...retainedSnapshot(episode), phase: "post-review"}];
  initial = freezeRecallSnapshotBundle(initial, "snapshot-1", {bundleId: "post-review-bundle", retainedAt: "2025-01-02T10:30:00.000Z", episode});
  const frozen = calculateRecallActualMetrics({episode, decisions: initial.decisions, planVersions: [], riskBaselines: [], context: {phase: "post-review", cursor: initial.snapshots[0].cursor, executionCursor: initial.snapshots[0].executionCursor}, source: {documentRevision: 1, evidenceDigest: "frozen", computedAt: "2025-01-02T10:30:00.000Z"}});
  frozen.metrics.netPnl = {...frozen.metrics.netPnl, value: "777", reason: null};
  initial.retainedBundles![0].actualMetrics = frozen;
  renderRecall(episode, initial);
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
  fireEvent.click(await screen.findByRole("button", {name: "编辑决策 1快照"}));
  await waitFor(() => expect(screen.getByText("回合净盈亏").parentElement).toHaveTextContent("777 USD"));
  await waitFor(() => expect(screen.getByText("实际 R")).toBeInTheDocument());
});

it("uses a safe historical metric fallback for a legacy snapshot opened before entry", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "pre-entry";
  initial.snapshots = [retainedSnapshot(episode)];
  renderRecall(episode, initial);
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
  fireEvent.click(await screen.findByRole("button", {name: "编辑决策 1快照"}));
  await waitFor(() => expect(screen.getByText(/该快照未留存统计口径/)).toBeInTheDocument());
});

it.each([
  ["retain", "drawing"], ["retain", "plan"], ["retain", "evaluation"],
  ["complete", "drawing"], ["complete", "plan"], ["complete", "evaluation"],
] as const)("cancels %s when %s changes after the chart scene was frozen", async (action, edit) => {
  vi.useFakeTimers();
  const targetEpisode = edit === "evaluation" ? {...episode, executions: [episode.executions[0], {...episode.executions[0], id: "exit", side: "sell" as const, price: "12", executedAt: "2025-01-02T10:20:00.000Z"}]} : episode;
  const initial = createRecallDocument(targetEpisode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = edit === "plan" ? "pre-entry" : "post-review";
  initial.snapshots = initial.decisions.map((decision, index) => ({...retainedSnapshot(targetEpisode, decision.id), id: `existing-${index}`}));
  let releaseCapture!: (value: {imageDataUrl: string; viewport: typeof replayChartHarness.viewport}) => void;
  replayChartHarness.handle.capture.mockImplementationOnce(() => new Promise(resolve => {releaseCapture = resolve;}));
  const repository: RecallRepository = {load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(), save: vi.fn().mockImplementation(async document => ({...document, revision: document.revision + 1}))};
  renderRecall(targetEpisode, initial, repository);
  await act(async () => {await Promise.resolve();});
  if (action === "complete") openMoreRecords();
  fireEvent.click(screen.getByRole("button", {name: action === "retain" ? "留存当前快照" : /保存并完成回合复盘/}));
  await act(async () => {await Promise.resolve();});
  if (edit === "drawing") fireEvent.click(screen.getByRole("button", {name: "add Text"}));
  if (edit === "plan" || edit === "evaluation") {
    const planToggle = screen.getByRole("button", { name: "计划侧栏" });
    if (planToggle.getAttribute("aria-expanded") !== "true") fireEvent.click(planToggle);
  }
  if (edit === "plan") fireEvent.change(screen.getByLabelText("计划入场"), {target: {value: "11"}});
  if (edit === "evaluation") fireEvent.click(screen.getByRole("radio", {name: "是"}));
  await act(async () => {releaseCapture({imageDataUrl: "data:image/png;base64,T0xE", viewport: replayChartHarness.viewport});});
  expect(within(screen.getByRole("dialog", { name: "复盘错误详情" })).getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeVisible();
  expect(repository.save).not.toHaveBeenCalled();
  await act(async () => {await vi.advanceTimersByTimeAsync(1000);});
  const [draft, options] = vi.mocked(repository.save).mock.calls[0];
  expect(options?.finalize).not.toBe(true);
  expect(draft.snapshots).toHaveLength(initial.snapshots.length);
  expect(draft.retainedBundles).toBeUndefined();
  if (edit === "drawing") expect(draft.working.drawings).toHaveLength(1);
  if (edit === "plan") expect(draft.plans?.drafts[0].input.entry).toBe("11");
  if (edit === "evaluation") expect(draft.exitEvaluations?.drafts[0].earlyExit).toBe("yes");
});

it("accepts the synchronous Text commit performed before the chart freezes its scene", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  replayChartHarness.handle.capture.mockImplementationOnce(() => {
    fireEvent.click(screen.getByRole("button", {name: "add Text"}));
    return Promise.resolve({imageDataUrl: "data:image/png;base64,committed", viewport: replayChartHarness.viewport});
  });
  let guard: (() => Promise<boolean>) | null = null;
  const repository: RecallRepository = {load: vi.fn().mockResolvedValue(initial), fetch: vi.fn(), save: vi.fn().mockImplementation(async document => ({...document, revision: document.revision + 1}))};
  renderRecall(episode, initial, repository, next => {guard = next;});
  fireEvent.click(await screen.findByRole("button", {name: "留存当前快照"}));
  await openAllSnapshotRecords();
  await screen.findByRole("button", {name: "编辑决策 1快照"});
  await act(async () => {await guard!();});
  const saved = vi.mocked(repository.save).mock.calls[0][0];
  expect(saved.snapshots[0].drawings).toHaveLength(1);
  expect(saved.snapshots[0].drawings[0]).toMatchObject({tool: "text", text: "新 Text"});
  expect(saved.working.drawings).toHaveLength(1);
  expect(saved.working.drawings[0]).toMatchObject({tool: "text", text: "新 Text"});
  expect(saved.snapshots[0].imageDataUrl).toBe("data:image/png;base64,committed");
});
