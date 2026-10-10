import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
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
import type { RecallDocument, RecallSnapshot } from "../../lib/recall/types";
import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
import { NO_REVEALED_EXECUTIONS } from "../../lib/replay/recall-replay";
import {
  RecallWorkspace,
  reconcileRecallSaveResponse,
  type RecallRepository,
} from "./recall-workspace";

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
    lastProps: null as { averageCost?: number; settings?: { showAverageCost?: boolean }; onPlanPriceChange?: (id: string, price: string) => void; planLinesEditable?: boolean; candleCount?: number } | null,
    handle: {
      capture: vi.fn().mockResolvedValue({ imageDataUrl: "data:image/png;base64,AA==", viewport }),
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
    executions,
    averageCost,
    settings,
    onPlanPriceChange,
    planLinesEditable,
    candles,
  }: {
    onCommand: (command: unknown) => void;
    onReady?: (handle: typeof replayChartHarness.handle | null) => void;
    cursor?: string;
    executions?: Array<{ id: string }>;
    averageCost?: number;
    settings?: { showAverageCost?: boolean };
    onPlanPriceChange?: (id: string, price: string) => void;
    planLinesEditable?: boolean;
    candles?: Candle[];
  }) => {
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
      onReady?.(replayChartHarness.handle);
      return () => onReady?.(null);
    }, [onReady]);
    replayChartHarness.lastProps = { averageCost, settings, onPlanPriceChange, planLinesEditable, candleCount: candles?.length };
    return <>
      <div data-testid="mock-replay-chart" data-cursor={cursor} data-candle-count={candles?.length} data-execution-cursor={executions?.at(-1)?.id} />
      <button type="button" onClick={() => onCommand({ type: "add", drawing: replayDrawing })}>add drawing</button>
      <button type="button" onClick={() => onCommand({ type: "add", drawing: {...replayDrawing, id: "text-1", tool: "text", text: "新 Text"} })}>add Text</button>
    </>;
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
) {
  return render(
    <RecallWorkspace
      episode={nextEpisode}
      episodes={[nextEpisode]}
      instrument={nextEpisode.instrument}
      instruments={[{ ...nextEpisode.instrument, market: "US" }]}
      timeframeAvailability={availability}
      importedTimelineCandles={replayCandles}
      candlesByTimeframe={{ "15m": replayCandles, "1D": replayCandles, "1W": replayCandles }}
      settings={settings}
      repository={repository}
      onEpisodeChange={vi.fn()}
      onInstrumentChange={vi.fn()}
      onSettingsChange={vi.fn()}
      onLeaveGuardChange={onLeaveGuardChange}
    />,
  );
}

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
  replayChartHarness.lastProps = null;
  replayChartHarness.handle.capture.mockReset();
  replayChartHarness.handle.capture.mockResolvedValue({
    imageDataUrl: "data:image/png;base64,AA==",
    viewport: replayChartHarness.viewport,
  });
  replayChartHarness.handle.getViewport.mockClear();
  replayChartHarness.handle.getViewport.mockReturnValue(replayChartHarness.viewport);
  replayChartHarness.handle.restoreViewport.mockClear();
  replayChartHarness.handle.fitAll.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RecallWorkspace autosave reconciliation", () => {
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

  it("keeps the holding quantity in the closed replay summary slot", async () => {
    const quantityEpisode: TradeEpisode = {
      ...replayEpisode,
      openingQuantity: "1000",
      remainingQuantity: "1000",
      executions: replayEpisode.executions.map((execution) => ({ ...execution, quantity: "1000" })),
    };
    const initial = createRecallDocument(quantityEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(quantityEpisode, initial);

    const summary = await waitFor(() => screen.getByText("持仓 1000", { exact: true }));
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

    const summary = await waitFor(() => screen.getByText("计划 · 3R / 风险 4000 CNY", { exact: true }));
    expect(summary).toHaveClass("recall-replay-summary");
    expect(summary).not.toHaveClass("recall-replay-cutoff");
    expect(summary).toHaveAttribute("aria-label", "计划 · 3R / 风险 4000 CNY");
  });

  it("keeps derived-number keyboard focus inside the plan sidebar", async () => {
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
    renderRecall(replayEpisode, initial);

    const chart = await waitFor(() => screen.getByTestId("mock-replay-chart"));
    const cursor = chart.getAttribute("data-cursor");
    const toggle = await waitFor(() => screen.getAllByRole("button", { name: "查看完整数值 4.6818181818181818182" }).find(button => button.textContent?.includes("R"))!);
    fireEvent.keyDown(toggle, { key: " ", code: "Space" });
    fireEvent.keyDown(toggle, { key: "ArrowRight", code: "ArrowRight" });
    fireEvent.keyDown(toggle, { key: "j", code: "KeyJ" });
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", cursor);
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("4.6818181818181818182R");
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
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network unavailable"));
    expect(repository.save).toHaveBeenCalled();
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

  it("does not let full history overwrite the global replay context", async () => {
    const initial = createRecallDocument(replayEpisode, "2025-01-02T10:00:00.000Z");
    renderRecall(replayEpisode, initial);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const replayChart = screen.getByTestId("mock-replay-chart");
    const replayCursor = replayChart.getAttribute("data-cursor");
    const replayExecutionCursor = replayChart.getAttribute("data-execution-cursor");
    const replayCandleCount = replayChart.getAttribute("data-candle-count");

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-3"));

    // Navigation controls remain visible while the explicit history view is
    // open. They must not capture the history cursor into the global draft.
    const secondDecision = Array.from(document.querySelectorAll<HTMLButtonElement>(".recall-nav-item")).find((button) => button.querySelector(".recall-nav-index")?.textContent === "2");
    expect(secondDecision).toBeDefined();
    expect(secondDecision).toBeDisabled();
    fireEvent.click(secondDecision!);
    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => {
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", replayCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", replayExecutionCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-candle-count", replayCandleCount);
    });

    fireEvent.click(screen.getByRole("button", { name: /全局总结/ }));
    await waitFor(() => {
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", replayCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", replayExecutionCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-candle-count", replayCandleCount);
    });
  });

  it("keeps all full-history candles and executions when changing timeframe", async () => {
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

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-3"));

    fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-3"));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-candle-count", "1");
  });

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
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    const chart = screen.getByTestId("mock-replay-chart");
    const marketCursor = chart.getAttribute("data-cursor");

    fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-2"));
    expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", marketCursor);
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
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑决策 1快照" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenCalledWith(snapshot.viewport));
    fireEvent.click(screen.getByRole("button", { name: "add drawing" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(replayChartHarness.handle.restoreViewport).toHaveBeenLastCalledWith(workingViewport));
    confirmSpy.mockRestore();
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
    expect(screen.getByTestId("tradingview-replay-notice")).toHaveTextContent("运行 run-a");
    expect(screen.queryByTestId("tradingview-source-report")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
    await waitFor(() => expect(screen.getByTestId("tradingview-source-report")).toBeInTheDocument());
    expect(screen.getByTestId("tradingview-replay-notice")).toBeInTheDocument();
    expect(screen.getByTestId("tradingview-source-report")).toHaveTextContent("报告收益率4.5%");
    expect(screen.getByTestId("tradingview-source-report")).toHaveTextContent("持仓 K 线6");
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
    await waitFor(() => expect(screen.getAllByRole("alert").some(node => node.textContent?.includes("请先修正结构化记录"))).toBe(true));
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
    await waitFor(()=>expect(screen.getAllByRole("alert").some(node=>node.textContent?.includes("请先修正计划输入"))).toBe(true));
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
  fireEvent.change(await screen.findByLabelText("持仓过程代表快照"),{target:{value:"snapshot-1"}});
  await waitFor(()=>expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({storyboard:{holding:{snapshotId:"snapshot-1"}}}),expect.anything()),{timeout:2500});
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
  expect(screen.getByText("云端草稿已有新版本；当前编辑仍保留，请重新载入或手动合并。")).toBeInTheDocument();
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
  expect(screen.getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeInTheDocument();
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
  expect(screen.getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeInTheDocument();
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
  expect(screen.queryByText("截图期间内容已修改，未留存或完成，请重试。")).not.toBeInTheDocument();
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
  fireEvent.click(await screen.findByRole("button", {name: "编辑决策 1快照"}));
  expect(screen.getByText("回合净盈亏").parentElement).toHaveTextContent("777 USD");
  expect(screen.getByText("实际 R")).toBeInTheDocument();
});

it("uses a safe historical metric fallback for a legacy snapshot opened before entry", async () => {
  const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
  initial.working.phase = "pre-entry";
  initial.snapshots = [retainedSnapshot(episode)];
  renderRecall(episode, initial);
  await waitFor(() => expect(screen.getByText("更多 / 记录", { exact: true })).toBeInTheDocument());
  await openAllSnapshotRecords();
  fireEvent.click(await screen.findByRole("button", {name: "编辑决策 1快照"}));
  expect(screen.getByText(/该快照未留存统计口径/)).toBeInTheDocument();
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
  expect(screen.getByText("截图期间内容已修改，未留存或完成，请重试。")).toBeInTheDocument();
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
  expect(saved.snapshots[0].imageDataUrl).toBe("data:image/png;base64,committed");
});
