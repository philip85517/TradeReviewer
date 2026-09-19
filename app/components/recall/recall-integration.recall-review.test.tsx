import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeRecallDocument, createRecallDocument, validateRecallDocument } from "../../lib/recall/document";
import type { RecallDocument, RecallSnapshot } from "../../lib/recall/types";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
import { NO_REVEALED_EXECUTIONS } from "../../lib/replay/recall-replay";
import {
  RecallWorkspace,
  type RecallChartHandle,
  type RecallRepository,
} from "./recall-workspace";

const chartHarness = vi.hoisted(() => {
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
    onCommand: undefined as ((command: unknown) => void) | undefined,
    nextDrawing: undefined as NormalizedDrawing | undefined,
    pending: undefined as { cursor?: string; executionCursor?: string; drawings: NormalizedDrawing[] } | undefined,
    rendered: undefined as { cursor?: string; executionCursor?: string; drawings: NormalizedDrawing[] } | undefined,
    handle: {
      capture: vi.fn(),
      flush: vi.fn(async () => {
        if (chartHarness.pending) chartHarness.rendered = chartHarness.pending;
      }),
      getViewport: vi.fn(() => viewport),
      restoreViewport: vi.fn(),
      fitAll: vi.fn(),
    },
  };
});

vi.mock("../chart/replay-chart", () => ({
  ReplayChart: ({
    drawings,
    cursor,
    executions,
    onCommand,
    onReady,
  }: {
    drawings: NormalizedDrawing[];
    cursor?: string;
    executions?: Array<{ id: string }>;
    onCommand: (command: unknown) => void;
    onReady?: (handle: RecallChartHandle | null) => void;
  }) => {
    chartHarness.onCommand = onCommand;
    chartHarness.pending = {
      cursor,
      executionCursor: executions?.at(-1)?.id,
      drawings,
    };
    if (!chartHarness.rendered) chartHarness.rendered = chartHarness.pending;
    useEffect(() => {
      onReady?.(chartHarness.handle as unknown as RecallChartHandle);
      return () => onReady?.(null);
    }, [onReady]);
    return (
      <>
        <div
          data-testid="review-chart"
          data-cursor={cursor}
          data-execution-cursor={executions?.at(-1)?.id}
          data-drawings={JSON.stringify(drawings)}
        />
        <button
          type="button"
          onClick={() => onCommand({ type: "add", drawing: chartHarness.nextDrawing ?? drawing("ui-text", "普通编辑") })}
        >
          add text
        </button>
      </>
    );
  },
}));

const candle: Candle = {
  time: "2026-01-20T10:00:00.000Z",
  knowledgeAt: "2026-01-20T10:15:00.000Z",
  open: 10,
  high: 11,
  low: 9,
  close: 10.5,
  volume: 100,
};

const secondCandle: Candle = {
  ...candle,
  time: "2026-01-20T10:15:00.000Z",
  knowledgeAt: "2026-01-20T10:30:00.000Z",
};

const availability = {
  "15m": { enabled: true },
  "1h": { enabled: false, reason: "no hourly" },
  "4h": { enabled: false, reason: "no four-hour" },
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

function execution(id: string, executedAt: string, side: "buy" | "sell" = "buy") {
  return {
    id,
    source: { platform: "review-test", row: 1 },
    accountId: "account-1",
    accountLabel: "Review account",
    instrument: {
      id: "CN:TEST",
      symbol: "TEST",
      name: "Test instrument",
      market: "CN",
      currency: "CNY",
    },
    side,
    executedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function episodeWithExecutions(id: string, count = 2): TradeEpisode {
  const executions = [
    execution("fill-1", candle.time),
    execution("fill-2", secondCandle.time),
  ].slice(0, count);
  if (executions.length > 1) executions[executions.length - 1] = { ...executions.at(-1)!, side: "sell" };
  return {
    id,
    accountId: "account-1",
    accountLabel: "Review account",
    instrument: executions[0]!.instrument,
    direction: "long",
    status: "closed",
    startedAt: candle.time,
    endedAt: "2026-01-20T10:30:00.000Z",
    openingQuantity: "1",
    remainingQuantity: "0",
    executions,
  };
}

const episode = episodeWithExecutions("episode-1", 2);

function drawing(id: string, text: string): NormalizedDrawing {
  return {
    version: 2,
    id,
    episodeId: episode.id,
    name: id,
    tool: "text",
    anchors: [{ time: candle.time, price: 10 }],
    style: { color: "#ffffff", lineWidth: 1, opacity: 1 },
    text,
    zIndex: 0,
    hidden: false,
    locked: false,
    visibleOn: "all",
    stage: "during-replay",
    createdAtCursor: candle.knowledgeAt!,
  };
}

function snapshot(id: string, decisionId: string, drawings: NormalizedDrawing[] = []): RecallSnapshot {
  return {
    id,
    decisionId,
    timeframe: "1D",
    cursor: candle.knowledgeAt!,
    executionCursor: decisionId === "fill-2" ? "fill-2" : "fill-1",
    candles: [candle, secondCandle],
    drawings,
    viewport: chartHarness.viewport,
    imageDataUrl: "data:image/png;base64,AA==",
    createdAt: "2026-01-20T10:31:00.000Z",
    updatedAt: "2026-01-20T10:31:00.000Z",
  };
}

function documentWithDecisionSnapshots(sourceEpisode = episode): RecallDocument {
  const base = createRecallDocument(sourceEpisode, "2026-01-20T10:00:00.000Z");
  return {
    ...base,
    snapshots: sourceEpisode.executions.map((item) => snapshot(`snapshot-${item.id}`, item.id)),
  };
}

function completedDocument(sourceEpisode = episode): RecallDocument {
  const withSnapshots = {
    ...documentWithDecisionSnapshots(sourceEpisode),
    snapshots: [
      ...sourceEpisode.executions.map((item) => snapshot(`snapshot-${item.id}`, item.id)),
      snapshot("snapshot-global", "global"),
    ],
  };
  return completeRecallDocument(withSnapshots, sourceEpisode, "2026-01-20T10:40:00.000Z");
}

function repositoryFor(initial: RecallDocument, save = (document: RecallDocument) => Promise.resolve({ ...document, revision: document.revision + 1 })) {
  return {
    load: vi.fn().mockResolvedValue(initial),
    save: vi.fn(save),
    fetch: vi.fn(),
  } satisfies RecallRepository;
}

function renderRecall(
  currentEpisode: TradeEpisode,
  initial: RecallDocument,
  repository: RecallRepository,
  episodes: TradeEpisode[] = [currentEpisode],
) {
  return render(
    <RecallWorkspace
      episode={currentEpisode}
      episodes={episodes}
      instrument={currentEpisode.instrument}
      instruments={[currentEpisode.instrument]}
      timeframeAvailability={availability}
      importedTimelineCandles={[candle, secondCandle]}
      candlesByTimeframe={{ "15m": [candle, secondCandle], "1D": [candle, secondCandle], "1W": [candle, secondCandle] }}
      settings={settings}
      repository={repository}
      onEpisodeChange={vi.fn()}
      onInstrumentChange={vi.fn()}
      onSettingsChange={vi.fn()}
    />,
  );
}

function decisionButton(number: number): HTMLElement {
  const button = document.querySelectorAll<HTMLElement>(".recall-decision-wrap > .recall-nav-item")[number - 1];
  if (!button) throw new Error(`decision ${number} navigation button not found`);
  return button;
}

async function settleLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  chartHarness.onCommand = undefined;
  chartHarness.nextDrawing = undefined;
  chartHarness.pending = undefined;
  chartHarness.rendered = undefined;
  chartHarness.handle.capture.mockReset();
  chartHarness.handle.capture.mockImplementation(async () => ({
    imageDataUrl: `data:image/png;base64,${chartHarness.rendered?.executionCursor === "fill-2" ? "R0xPQkFM" : "U1RBR0U="}`,
    viewport: chartHarness.viewport,
  }));
  chartHarness.handle.flush.mockClear();
  chartHarness.handle.getViewport.mockClear();
  chartHarness.handle.restoreViewport.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("independent Recall integration review", () => {
  it("autosaves an ordinary completed Text edit while preserving the frozen formal version", async () => {
    vi.useFakeTimers();
    const initial = completedDocument();
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    const saved = repository.save.mock.calls[0]![0] as RecallDocument;
    expect(saved.status).toBe("completed");
    expect(saved.working.drawings.some((item) => item.text === "普通编辑")).toBe(true);
    expect(saved.lastCompleted).toEqual(initial.lastCompleted);
    expect(screen.getByText(/已完成.*有草稿修改/)).toBeTruthy();
  });

  it("keeps a completed decision overlay marked as a formal draft after autosave", async () => {
    vi.useFakeTimers();
    const initial = completedDocument();
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    const saved = repository.save.mock.calls[0]?.[0] as RecallDocument | undefined;
    expect(saved?.working.editingContext?.decisionId).toBe("fill-1");
    expect(saved?.working.editingContext?.drawings.some((item) => item.text === "普通编辑")).toBe(true);
    expect(screen.getByText(/已完成.*有草稿修改/)).toBeTruthy();
  });

  it("includes Text committed by capture in the atomic completion payload", async () => {
    const initial = documentWithDecisionSnapshots(episode);
    const repository = repositoryFor(initial);
    chartHarness.handle.capture.mockImplementationOnce(async () => {
      chartHarness.onCommand?.({ type: "add", drawing: drawing("focused-text", "确认前提交") });
      return { imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport };
    });
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    const [saved, options] = repository.save.mock.calls[0]! as unknown as [RecallDocument, { finalize?: boolean }];
    const global = saved.snapshots.find((item) => item.decisionId === "global");
    expect(options).toEqual({ expectedRevision: initial.revision, finalize: true });
    expect(global?.drawings.some((item) => item.text === "确认前提交")).toBe(true);
    expect(saved.working.drawings.some((item) => item.text === "确认前提交")).toBe(true);
  });

  it("restores an earlier decision boundary instead of retaining a later decision's Text", async () => {
    const firstText = drawing("first-text", "买入判断");
    const laterText = drawing("later-text", "后续判断");
    const initial = {
      ...documentWithDecisionSnapshots(episode),
      working: {
        ...documentWithDecisionSnapshots(episode).working,
        drawings: [firstText],
      },
      snapshots: [
        snapshot("snapshot-fill-1", "fill-1", [firstText]),
        snapshot("snapshot-fill-2", "fill-2", [laterText]),
      ],
    } satisfies RecallDocument;
    const repository = repositoryFor(initial);
    chartHarness.nextDrawing = laterText;
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(2));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    expect(JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!).some((item: NormalizedDrawing) => item.id === "later-text")).toBe(true);

    fireEvent.click(decisionButton(1));
    await waitFor(() => {
      const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
      expect(visible.some((item) => item.id === "first-text")).toBe(true);
      expect(visible.some((item) => item.id === "later-text")).toBe(false);
    });
  });

  it("keeps next-decision Text ownership through autosave and later navigation", async () => {
    vi.useFakeTimers();
    const base = createRecallDocument(episode, "2026-01-20T10:00:00.000Z");
    const initial = {
      ...base,
      snapshots: [snapshot("snapshot-fill-1", "fill-1")],
    } satisfies RecallDocument;
    let persisted = initial;
    const repository: RecallRepository = {
      load: vi.fn(() => Promise.resolve(persisted)),
      save: vi.fn(async (next) => {
        persisted = { ...next, revision: next.revision + 1 };
        return persisted;
      }),
      fetch: vi.fn(),
    };
    chartHarness.nextDrawing = drawing("next-decision-text", "下一阶段判断");
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    const persistedDrawing = persisted.working.editingContext?.drawings.find((item) => item.id === "next-decision-text");
    expect(persisted.working.selectedDecisionId).toBe("fill-2");
    expect(persistedDrawing?.recallOwnerId).toBe("fill-2");
    expect(persisted.working.editingContext?.decisionId).toBe("fill-2");
    expect(persisted.working.editingContext?.drawings.some((item) => item.id === "next-decision-text")).toBe(true);

    vi.useRealTimers();
    cleanup();
    renderRecall(episode, persisted, repository);
    await settleLoad();
    fireEvent.click(decisionButton(1));
    fireEvent.click(decisionButton(2));
    await waitFor(() => {
      const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
      expect(visible.some((item) => item.id === "next-decision-text")).toBe(true);
    });
  });

  it("inherits the nearest earlier stage drawings when the next decision has no snapshot", async () => {
    const inherited = drawing("inherited-text", "同回合继承");
    const initial = {
      ...documentWithDecisionSnapshots(episode),
      working: {
        ...documentWithDecisionSnapshots(episode).working,
        selectedDecisionId: "fill-1",
        drawings: [inherited],
      },
      snapshots: [snapshot("snapshot-fill-1", "fill-1", [inherited])],
    } satisfies RecallDocument;
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(2));
    await waitFor(() => {
      const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
      expect(visible.some((item) => item.id === "inherited-text")).toBe(true);
    });
  });

  it("preserves unsaved global working drawings when returning from a decision", async () => {
    const globalDraft = drawing("global-draft", "全局草稿");
    const globalRetained = drawing("global-retained", "旧全局留存");
    const initial = {
      ...documentWithDecisionSnapshots(episode),
      working: {
        ...documentWithDecisionSnapshots(episode).working,
        selectedDecisionId: "global",
        drawings: [globalDraft],
      },
      snapshots: [
        snapshot("snapshot-fill-1", "fill-1"),
        snapshot("snapshot-fill-2", "fill-2"),
        snapshot("snapshot-global", "global", [globalRetained]),
      ],
    } satisfies RecallDocument;
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    fireEvent.click(document.querySelector(".recall-nav-item.global")!);
    await waitFor(() => {
      const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
      expect(visible.some((item) => item.id === "global-draft")).toBe(true);
    });
  });

  it("reloads a persisted decision overlay without replacing the global working graph", async () => {
    vi.useFakeTimers();
    const globalDraft = drawing("global-draft", "全局草稿");
    const stageDraft = drawing("stage-draft", "阶段草稿");
    const initial = {
      ...documentWithDecisionSnapshots(episode),
      working: {
        ...documentWithDecisionSnapshots(episode).working,
        selectedDecisionId: "global",
        drawings: [globalDraft],
      },
    } satisfies RecallDocument;
    let persisted = initial;
    const repository: RecallRepository = {
      load: vi.fn(() => Promise.resolve(persisted)),
      save: vi.fn(async (next) => {
        persisted = { ...next, revision: next.revision + 1 };
        return persisted;
      }),
      fetch: vi.fn(),
    };
    chartHarness.nextDrawing = stageDraft;
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    expect(persisted.working.drawings.some((item) => item.id === "global-draft")).toBe(true);
    expect(persisted.working.editingContext?.decisionId).toBe("fill-1");
    expect(persisted.working.editingContext?.drawings.some((item) => item.id === "stage-draft")).toBe(true);

    cleanup();
    renderRecall(episode, persisted, repository);
    await settleLoad();
    const restoredStage = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
    expect(restoredStage.some((item) => item.id === "stage-draft")).toBe(true);
    expect(restoredStage.some((item) => item.id === "global-draft")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /全局总结/ }));
    await act(async () => {
      await Promise.resolve();
    });
    const restoredGlobal = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
    expect(restoredGlobal.some((item) => item.id === "global-draft")).toBe(true);
    expect(restoredGlobal.some((item) => item.id === "stage-draft")).toBe(false);
  });

  it("captures the global working graph when completion starts from a decision overlay", async () => {
    const globalDraft = drawing("global-draft", "全局草稿");
    const stageDraft = drawing("stage-draft", "阶段草稿");
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        selectedDecisionId: "global",
        drawings: [globalDraft],
      },
    } satisfies RecallDocument;
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    chartHarness.handle.capture.mockImplementationOnce(async () => {
      chartHarness.onCommand?.({ type: "add", drawing: stageDraft });
      return { imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport };
    });
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    const saved = repository.save.mock.calls[0]![0] as RecallDocument;
    const global = saved.snapshots.find((item) => item.decisionId === "global");
    expect(global?.drawings.some((item) => item.id === "global-draft")).toBe(true);
  });

  it("preserves an unretained decision Text draft through completion and reload", async () => {
    const initial = completedDocument();
    let persisted = initial;
    let finalized = false;
    const save = vi.fn(async (
      next: RecallDocument,
      options?: Parameters<RecallRepository["save"]>[1],
    ) => {
      finalized = finalized || Boolean(options?.finalize);
      validateRecallDocument(next);
      persisted = { ...next, revision: next.revision + 1 };
      return persisted;
    });
    const repository: RecallRepository = {
      load: vi.fn(() => Promise.resolve(persisted)),
      save,
      fetch: vi.fn(),
    };
    const globalBefore = initial.snapshots.find((item) => item.decisionId === "global");
    const retainedBefore = initial.snapshots.find((item) => item.decisionId === "fill-1");
    chartHarness.handle.capture.mockResolvedValue({
      imageDataUrl: globalBefore!.imageDataUrl,
      viewport: chartHarness.viewport,
    });
    chartHarness.nextDrawing = drawing("unretained-stage-text", "完成前阶段判断");
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(finalized).toBe(true));

    const savedDraft = persisted.working.decisionDrafts?.find((draft) => draft.decisionId === "fill-1");
    const savedFormalDraft = persisted.lastCompleted?.working.decisionDrafts?.find((draft) => draft.decisionId === "fill-1");
    const savedGlobal = persisted.snapshots.find((item) => item.decisionId === "global");
    expect(savedDraft?.drawings.some((item) => item.id === "unretained-stage-text")).toBe(true);
    expect(savedFormalDraft?.drawings.some((item) => item.id === "unretained-stage-text")).toBe(true);
    expect(savedGlobal?.drawings.some((item) => item.id === "unretained-stage-text")).toBe(false);
    expect(savedGlobal?.decisionId).toBe(globalBefore?.decisionId);
    expect(savedGlobal?.imageDataUrl).toBe(globalBefore?.imageDataUrl);
    expect(savedGlobal?.drawings).toEqual(globalBefore?.drawings);
    expect(persisted.snapshots.find((item) => item.id === retainedBefore?.id)?.drawings).toEqual(retainedBefore?.drawings);
    expect(persisted.snapshots.find((item) => item.id === retainedBefore?.id)?.imageDataUrl).toBe(retainedBefore?.imageDataUrl);

    cleanup();
    renderRecall(episode, persisted, repository);
    await settleLoad();
    fireEvent.click(decisionButton(1));
    await waitFor(() => {
      const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
      expect(visible.some((item) => item.id === "unretained-stage-text")).toBe(true);
    });
  });

  it("flushes the rendered global chart before completion capture", async () => {
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        cursor: secondCandle.knowledgeAt!,
        executionCursor: "fill-2",
        selectedDecisionId: "global",
      },
    } satisfies RecallDocument;
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(decisionButton(1));
    await act(async () => {
      await chartHarness.handle.flush();
    });
    expect(chartHarness.rendered?.executionCursor).toBe("fill-1");

    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    const saved = repository.save.mock.calls[0]![0] as RecallDocument;
    const global = saved.snapshots.find((item) => item.decisionId === "global");
    expect(chartHarness.handle.flush).toHaveBeenCalled();
    expect(chartHarness.rendered?.executionCursor).toBe("fill-2");
    expect(global?.imageDataUrl).toBe("data:image/png;base64,R0xPQkFM");
  });

  it("waits for an explicit pending snapshot update before leaving the snapshot editor", async () => {
    vi.useFakeTimers();
    const initial = documentWithDecisionSnapshots(episode);
    const repository = repositoryFor(initial);
    let resolveCapture!: (value: { imageDataUrl: string; viewport: typeof chartHarness.viewport }) => void;
    chartHarness.handle.capture.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCapture = resolve;
    }));
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
    expect(screen.getByRole("button", { name: "更新此快照" })).toBeTruthy();

    await act(async () => {
      resolveCapture({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/1 段文字/)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    const saved = repository.save.mock.calls[0]?.[0] as RecallDocument | undefined;
    expect(saved?.snapshots.find((item) => item.id === "snapshot-fill-1")?.drawings.some((item) => item.text === "普通编辑")).toBe(true);
    confirmSpy.mockRestore();
  });

  it("warns before discarding a snapshot cursor change", async () => {
    const initial = documentWithDecisionSnapshots(episode);
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
    fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("keeps execution reconciliation visible until the user explicitly acknowledges it", async () => {
    vi.useFakeTimers();
    const previousEpisode = episodeWithExecutions("episode-1", 1);
    const currentEpisode = episodeWithExecutions("episode-1", 2);
    const initial = documentWithDecisionSnapshots(previousEpisode);
    const repository = repositoryFor(initial);
    renderRecall(currentEpisode, initial, repository);
    await settleLoad();

    expect(screen.getByText("导入行情已有变更")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认已处理行情变更" }));
    expect(screen.queryByText("导入行情已有变更")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });

    const saved = repository.save.mock.calls[0]?.[0] as RecallDocument | undefined;
    expect(saved?.reconciliation).toEqual({ addedExecutionIds: [], removedExecutionIds: [], stale: false });
  });

  it("saves and reloads a replay boundary before the first fill", async () => {
    vi.useFakeTimers();
    const source = episodeWithExecutions("episode-prefill", 1);
    const prefillEpisode: TradeEpisode = {
      ...source,
      startedAt: secondCandle.time,
      endedAt: "2026-01-20T10:30:00.000Z",
      executions: [{ ...source.executions[0]!, id: "prefill-fill", executedAt: secondCandle.time }],
    };
    let persisted = createRecallDocument(prefillEpisode, "2026-01-20T10:00:00.000Z");
    const repository: RecallRepository = {
      load: vi.fn(() => Promise.resolve(persisted)),
      save: vi.fn(async (next) => {
        validateRecallDocument(next);
        persisted = { ...next, revision: next.revision + 1 };
        return persisted;
      }),
      fetch: vi.fn(),
    };
    renderRecall(prefillEpisode, persisted, repository);
    await settleLoad();

    fireEvent.click(screen.getByRole("button", { name: "上一根 K 线" }));
    expect(screen.getByTestId("review-chart")).toHaveAttribute("data-cursor", candle.knowledgeAt);
    expect(screen.getByTestId("review-chart")).not.toHaveAttribute("data-execution-cursor");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    });
    expect(persisted.working.executionCursor).toBe(NO_REVEALED_EXECUTIONS);
    // Keep the serialized candle cursor alongside the empty execution boundary.
    expect(persisted.working.cursor).toBe(candle.knowledgeAt);

    vi.useRealTimers();
    cleanup();
    renderRecall(prefillEpisode, persisted, repository);
    await settleLoad();
    expect(screen.getByTestId("review-chart")).toHaveAttribute("data-cursor", candle.knowledgeAt);
    expect(screen.getByTestId("review-chart")).not.toHaveAttribute("data-execution-cursor");
  });
});
