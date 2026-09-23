import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRecallDocument } from "../../lib/recall/document";
import type { RecallDocument, RecallSnapshot } from "../../lib/recall/types";
import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
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
    lastProps: null as { averageCost?: number; settings?: { showAverageCost?: boolean } } | null,
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
  }: {
    onCommand: (command: unknown) => void;
    onReady?: (handle: typeof replayChartHarness.handle | null) => void;
    cursor?: string;
    executions?: Array<{ id: string }>;
    averageCost?: number;
    settings?: { showAverageCost?: boolean };
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
    replayChartHarness.lastProps = { averageCost, settings };
    return <>
      <div data-testid="mock-replay-chart" data-cursor={cursor} data-execution-cursor={executions?.at(-1)?.id} />
      <button type="button" onClick={() => onCommand({ type: "add", drawing: replayDrawing })}>add drawing</button>
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
const replayEpisode: TradeEpisode = {
  ...episode,
  executions: [
    episode.executions[0],
    { ...episode.executions[0], id: "fill-2", executedAt: "2025-01-02T10:16:00.000Z", side: "buy" },
    { ...episode.executions[0], id: "fill-3", executedAt: "2025-01-02T10:31:00.000Z", side: "sell" },
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
  replayChartHarness.handle.restoreViewport.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RecallWorkspace autosave reconciliation", () => {
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
      timeframe: "1D" as const,
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

    fireEvent.click(screen.getAllByRole("button", { name: "完整历史" }).at(-1)!);
    await waitFor(() => expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", "fill-3"));
    fireEvent.click(screen.getAllByRole("button", { name: "返回回放" }).at(-1)!);
    await waitFor(() => {
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-cursor", replayCursor);
      expect(screen.getByTestId("mock-replay-chart")).toHaveAttribute("data-execution-cursor", replayExecutionCursor);
    });
  });

  it("restores a retained viewport while editing and the working viewport on exit", async () => {
    const workingViewport = { ...replayChartHarness.viewport, rightOffset: 9 };
    replayChartHarness.handle.getViewport.mockReturnValue(workingViewport);
    const initial = createRecallDocument(episode, "2025-01-02T10:00:00.000Z");
    const snapshot = retainedSnapshot(episode);
    const withSnapshot: RecallDocument = { ...initial, snapshots: [snapshot] };
    renderRecall(episode, withSnapshot);
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
