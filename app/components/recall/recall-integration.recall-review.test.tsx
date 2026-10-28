import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmRecallRetainedState, freezeRecallSnapshotBundle } from "../../lib/recall/retained-bundles";
import { RecallRepositoryError } from "../../lib/recall/repository";
import { retainRecallActualMetrics } from "../../lib/recall/metric-retention";

import { completeRecallDocument, createRecallDocument, mergeRecallDecisions, validateRecallDocument } from "../../lib/recall/document";
import type { RecallDocument, RecallSnapshot } from "../../lib/recall/types";
import type { NormalizedDrawing } from "../../lib/chart/drawings";
import type { Candle } from "../../lib/market/types";
import type { TradeEpisode } from "../../lib/trades/types";
import { NO_REVEALED_EXECUTIONS } from "../../lib/replay/recall-replay";
import {
  RecallWorkspace,
  type RecallChartHandle,
  type RecallRepository,
  type RecallWorkspaceProps,
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
    onExecutionSelect: undefined as ((executionId: string) => void) | undefined,
    onReady: undefined as ((handle: RecallChartHandle | null) => void) | undefined,
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
    candles,
    cursor,
    executions,
    onCommand,
    onExecutionSelect,
    onReady,
  }: {
    drawings: NormalizedDrawing[];
    candles: Candle[];
    cursor?: string;
    executions?: Array<{ id: string }>;
    onCommand: (command: unknown) => void;
    onExecutionSelect?: (executionId: string) => void;
    onReady?: (handle: RecallChartHandle | null) => void;
  }) => {
    chartHarness.onReady = onReady;
    chartHarness.onCommand = onCommand;
    chartHarness.onExecutionSelect = onExecutionSelect;
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
          data-candle-count={candles.length}
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
  onFormalCompletion?: RecallWorkspaceProps["onFormalCompletion"],
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
      onFormalCompletion={onFormalCompletion}
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

function openMoreRecords() {
  const summary = screen.getByText("更多 / 记录", { exact: true });
  if (summary instanceof HTMLButtonElement) {
    if (summary.getAttribute("aria-expanded") !== "true") fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    return;
  }
  const details = summary.closest("details");
  if (!(details instanceof HTMLDetailsElement)) throw new Error("More / records disclosure is missing");
  if (!details.open) fireEvent.click(summary);
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

beforeEach(() => {
  chartHarness.onReady = undefined;
  chartHarness.onCommand = undefined;
  chartHarness.onExecutionSelect = undefined;
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
  chartHarness.handle.getViewport.mockReturnValue(chartHarness.viewport);
  chartHarness.handle.restoreViewport.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("independent Recall integration review", () => {
  it("notifies the parent only after a formal Recall completion is accepted", async () => {
    const initial = documentWithDecisionSnapshots(episode);
    const repository = repositoryFor(initial);
    const onFormalCompletion = vi.fn();
    renderRecall(episode, initial, repository, [episode], onFormalCompletion);
    await settleLoad();

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    expect(onFormalCompletion).toHaveBeenCalledOnce();
    expect(onFormalCompletion).toHaveBeenCalledWith(expect.objectContaining({ episodeId: episode.id, status: "completed" }));
  });

  it("does not notify the parent when formal Recall save is rejected", async () => {
    const initial = documentWithDecisionSnapshots(episode);
    const repository = repositoryFor(initial, async () => {
      throw new Error("formal save rejected");
    });
    const onFormalCompletion = vi.fn();
    renderRecall(episode, initial, repository, [episode], onFormalCompletion);
    await settleLoad();

    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("formal save rejected"));
    expect(onFormalCompletion).not.toHaveBeenCalled();
  });

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

    openMoreRecords();
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
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        selectedDecisionId: "global",
        drawings: [globalDraft],
        cursor: candle.knowledgeAt!,
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
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        selectedDecisionId: "global",
        drawings: [globalDraft],
        cursor: candle.knowledgeAt!,
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

  it("keeps a future global drawing hidden before its replay cursor", async () => {
    const futureDrawing = drawing("future-global", "尚未可知");
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        selectedDecisionId: "global",
        drawings: [futureDrawing],
        cursor: candle.time,
      },
    } satisfies RecallDocument;
    renderRecall(episode, initial, repositoryFor(initial));
    await settleLoad();

    const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
    expect(visible.some((item) => item.id === "future-global")).toBe(false);
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
    openMoreRecords();
    fireEvent.click(screen.getByRole("button", { name: /保存并完成回合复盘/ }));
    await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(1));

    const saved = repository.save.mock.calls[0]![0] as RecallDocument;
    const global = saved.snapshots.find((item) => item.decisionId === "global");
    expect(global?.drawings.some((item) => item.id === "global-draft")).toBe(true);
  });

  it("keeps a future global drawing hidden before its replay cursor", async () => {
    const futureDrawing = drawing("future-global", "尚未可知");
    const base = documentWithDecisionSnapshots(episode);
    const initial = {
      ...base,
      working: {
        ...base.working,
        selectedDecisionId: "global",
        drawings: [futureDrawing],
        cursor: candle.time,
      },
    } satisfies RecallDocument;
    renderRecall(episode, initial, repositoryFor(initial));
    await settleLoad();

    const visible = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!) as NormalizedDrawing[];
    expect(visible.some((item) => item.id === "future-global")).toBe(false);
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
    openMoreRecords();
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

    openMoreRecords();
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
    let initial = documentWithDecisionSnapshots(episode);
    initial = freezeRecallSnapshotBundle(initial, initial.snapshots[0].id, { episode, bundleId: "pending-update-source", retainedAt: "2026-01-20T11:00:00Z" });
    confirmRecallRetainedState(undefined, initial, episode, 6);
    retainRecallActualMetrics(undefined, initial);
    initial.revision = 6;
    const repository = repositoryFor(initial);
    let resolveCapture!: (value: { imageDataUrl: string; viewport: typeof chartHarness.viewport }) => void;
    chartHarness.handle.capture.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCapture = resolve;
    }));
    renderRecall(episode, initial, repository);
    await settleLoad();

    openAllSnapshotRecords();
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

    openAllSnapshotRecords();
    fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
    const nextDecisionButton = screen.getByRole("button", { name: "下一笔决策" });
    expect(nextDecisionButton).toBeDisabled();
    expect(nextDecisionButton).toHaveAttribute("title", expect.stringMatching(/正在编辑快照/));
    fireEvent.click(screen.getByRole("button", { name: "切换到 15m" }));
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


describe("three phase chart workspace", () => {
  it("restores early boundaries and stamps later additions after explicit future reveal", async () => {
    const episode = episodeWithExecutions("phase-round");
    const initial = createRecallDocument(episode);
    const repository = repositoryFor(initial);
    renderRecall(episode, initial, repository);
    await settleLoad();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
    expect(screen.getByTestId("review-chart").getAttribute("data-execution-cursor")).toBeNull();
    const earlyCursor = screen.getByTestId("review-chart").getAttribute("data-cursor");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "事后复盘" })));
    expect(screen.getByTestId("review-chart").getAttribute("data-execution-cursor")).toBe("fill-2");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
    expect(screen.getByTestId("review-chart").getAttribute("data-cursor")).toBe(earlyCursor);
    expect(screen.getByTestId("review-chart").getAttribute("data-execution-cursor")).toBeNull();
    chartHarness.nextDrawing = { ...drawing("phase-text", "后补判断"), createdAtCursor: earlyCursor! };
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    const drawings = JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!);
    expect(drawings[0]).toMatchObject({ stage: "pre-trade", recallHasSeenFuture: true, textRevision: 1 });
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2000 });
    const saved = repository.save.mock.calls.at(-1)![0];
    expect(saved.working).toMatchObject({ phase: "pre-entry", hasSeenFuture: true });
  });
});

describe("phase persistence and input safety", () => {
  it("freezes phase snapshots, restores edits on reload, and retains the decision owner", async () => {
    const episode = episodeWithExecutions("phase-persist");
    let persisted = createRecallDocument(episode);
    persisted.working = {
      ...persisted.working,
      phase: "pre-entry",
      cursor: new Date(Date.parse(episode.executions[0]!.executedAt) - 1).toISOString(),
      executionCursor: NO_REVEALED_EXECUTIONS,
      hasSeenFuture: false,
    };
    const repository = repositoryFor(persisted, async (value) => { persisted = { ...value, revision: value.revision + 1 }; return persisted; });
    repository.load.mockImplementation(async () => persisted);
    renderRecall(episode, persisted, repository);
    await settleLoad();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
    const cursor = screen.getByTestId("review-chart").getAttribute("data-cursor")!;
    chartHarness.nextDrawing = { ...drawing("before-entry", "初始判断"), createdAtCursor: cursor };
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "留存当前快照" })));
    await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2000 });
    expect(persisted.snapshots[0]).toMatchObject({ phase: "pre-entry", hasSeenFuture: false, executionCursor: NO_REVEALED_EXECUTIONS, decisionId: persisted.decisions[0].id });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "事后复盘" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
    chartHarness.nextDrawing = { ...drawing("later-entry", "补记"), createdAtCursor: cursor };
    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    await waitFor(() => expect(persisted.working.phaseContexts?.["pre-entry"]?.drawings).toHaveLength(2), { timeout: 2000 });
    expect(persisted.snapshots[0].drawings).toHaveLength(1);
    expect(persisted.snapshots[0].hasSeenFuture).toBe(false);
    cleanup();
    renderRecall(episode, persisted, repository);
    await settleLoad();
    expect(screen.getByRole("button", { name: "买入前判断" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("review-chart").getAttribute("data-execution-cursor")).toBeNull();
    expect(JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!)).toHaveLength(2);
  });

  it("ignores IME and input arrows and advances into holding without requiring retention", async () => {
    const episode = episodeWithExecutions("phase-input");
    const initial = createRecallDocument(episode);
    renderRecall(episode, initial, repositoryFor(initial));
    await settleLoad();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
    const workspace = screen.getByRole("region", { name: "导入交易回忆复盘工作区" });
    const cursor = screen.getByTestId("review-chart").getAttribute("data-cursor");
    fireEvent.keyDown(workspace, { key: "ArrowRight", isComposing: true });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "交易回合" }), { key: "ArrowRight" });
    expect(screen.getByTestId("review-chart").getAttribute("data-cursor")).toBe(cursor);
    await act(async () => fireEvent.keyDown(workspace, { key: "ArrowRight" }));
    expect(screen.getByRole("button", { name: "持仓过程" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("review-chart").getAttribute("data-candle-count")).toBe("1");
  });
});


it("restores the completed bar boundary independently of its last execution", async () => {
  const episode = episodeWithExecutions("phase-bars");
  const initial = createRecallDocument(episode);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "持仓过程" })));
  fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
  fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
  expect(screen.getByTestId("review-chart").getAttribute("data-candle-count")).toBe("2");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
  expect(screen.getAllByText(/已看后续补记/).length).toBeGreaterThan(0);
  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "持仓过程" })));
  expect(screen.getByTestId("review-chart").getAttribute("data-candle-count")).toBe("2");
});

it("does not persist the current future viewport as a new phase context", async () => {
  const initial = createRecallDocument(episode);
  initial.working.phase = "holding";
  initial.working.phaseContexts = undefined;
  let persisted = initial;
  const futureViewport = { ...chartHarness.viewport, rightOffset: 16, logicalRange: { from: 18, to: 22 } };
  chartHarness.handle.getViewport.mockReturnValue(futureViewport);
  const repository = repositoryFor(persisted, async next => {
    persisted = { ...next, revision: next.revision + 1 };
    return persisted;
  });
  repository.load.mockImplementation(async () => persisted);
  renderRecall(episode, persisted, repository);
  await settleLoad();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
  await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2000 });

  expect(persisted.working.phaseContexts?.["pre-entry"]?.viewport).toBeUndefined();
});

it("keeps future provenance when an existing holding cutoff returns to pre-entry", async () => {
  const initial = createRecallDocument(episode);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));

  expect(screen.getAllByText(/已看后续补记/).length).toBeGreaterThan(0);
  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
});

it("marks a legacy holding cutoff at the first buy as future when returning to pre-entry", async () => {
  const base = createRecallDocument(episode);
  let persisted: RecallDocument = {
    ...base,
    working: {
      ...base.working,
      phase: "holding",
      cursor: candle.knowledgeAt!,
      executionCursor: "fill-1",
      selectedDecisionId: base.decisions[0]?.id ?? null,
      hasSeenFuture: false,
    },
  };
  const repository = repositoryFor(persisted, async next => {
    persisted = { ...next, revision: next.revision + 1 };
    return persisted;
  });
  repository.load.mockImplementation(async () => persisted);
  renderRecall(episode, persisted, repository);
  await settleLoad();

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-1");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
  expect(screen.getByRole("button", { name: "买入前判断" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByText(/已看后续补记/).length).toBeGreaterThan(0);
  await waitFor(() => expect(persisted.working).toMatchObject({ phase: "pre-entry", hasSeenFuture: true }), { timeout: 2000 });
});

it("explains terminal replay controls and offers a non-destructive early return", async () => {
  const initial = createRecallDocument(episode);
  const repository = repositoryFor(initial);
  repository.load.mockResolvedValue(null);
  renderRecall(episode, initial, repository);
  await settleLoad();

  fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));
  fireEvent.click(screen.getByRole("button", { name: "下一根 K 线" }));

  expect(screen.getByRole("button", { name: "下一根 K 线" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
  expect(screen.getByText(/当前行情与决策末尾/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "回到买入前判断" }));
  await settleLoad();
  expect(screen.getByRole("button", { name: "买入前判断" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByText(/已看后续补记/).length).toBeGreaterThan(0);
  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
});

it("plays exactly one replay bar per second", async () => {
  vi.useFakeTimers();
  const initial = createRecallDocument(episode);
  const repository = repositoryFor(initial);
  repository.load.mockResolvedValue(null);
  renderRecall(episode, initial, repository);
  await settleLoad();

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-candle-count", "0");
  fireEvent.click(screen.getByRole("button", { name: "播放" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(999); });
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-candle-count", "0");
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-candle-count", "1");
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-candle-count", "2");
  expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "播放" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.keyDown(screen.getByRole("region", { name: "导入交易回忆复盘工作区" }), { key: " " });
  expect(screen.getByRole("button", { name: "播放" })).toHaveAttribute("aria-pressed", "false");
});

it("hides a selected future fill after rewinding to an earlier cutoff", async () => {
  const initial = createRecallDocument(episode);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  fireEvent.click(decisionButton(2));
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  fireEvent.click(screen.getByRole("button", { name: "上一根 K 线" }));

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-1");
  expect(document.querySelector(".recall-selected-fill")).toBeNull();
  chartHarness.nextDrawing = { ...drawing("rewind-text", "保留末笔归属"), createdAtCursor: candle.knowledgeAt! };
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  expect(JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!)[0]).toMatchObject({ recallOwnerId: "fill-2" });
});

it("selects a chart execution only after it is visible at the current cutoff", async () => {
  const initial = createRecallDocument(episode);
  initial.working.phase = "pre-entry";
  initial.working.cursor = new Date(Date.parse(episode.executions[0]!.executedAt) - 1).toISOString();
  initial.working.executionCursor = NO_REVEALED_EXECUTIONS;
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  await act(async () => chartHarness.onExecutionSelect?.("fill-2"));
  expect(decisionButton(2)).not.toHaveAttribute("aria-current", "true");

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "下一笔决策" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "下一笔决策" })));
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  await act(async () => chartHarness.onExecutionSelect?.("fill-2"));
  expect(decisionButton(2)).toHaveAttribute("aria-current", "true");
});

it("uses the clicked execution boundary while retaining that decision's Text draft", async () => {
  const markerEpisode: TradeEpisode = {
    ...episodeWithExecutions("marker-boundary", 2),
    executions: [
      { ...episode.executions[0]!, id: "fill-1" },
      { ...episode.executions[1]!, id: "fill-2", side: "sell" },
      { ...episode.executions[1]!, id: "fill-3", side: "sell" },
    ],
  };
  const base = createRecallDocument(markerEpisode);
  const lateText = { ...drawing("marker-late-text", "晚期阶段判断"), episodeId: markerEpisode.id };
  const initial: RecallDocument = {
    ...base,
    working: {
      ...base.working,
      phase: "holding",
      cursor: secondCandle.knowledgeAt!,
      executionCursor: "fill-3",
      selectedDecisionId: "fill-1",
      decisionDrafts: [{
        mode: "decision",
        decisionId: "fill-2",
        timeframe: "1D",
        cursor: secondCandle.knowledgeAt!,
        executionCursor: "fill-3",
        revealedCandleCursor: secondCandle.knowledgeAt!,
        drawings: [lateText],
      }],
    },
  };
  renderRecall(markerEpisode, initial, repositoryFor(initial));
  await settleLoad();

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-3");
  await act(async () => chartHarness.onExecutionSelect?.("fill-2"));

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  expect(JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!)).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "marker-late-text", text: "晚期阶段判断" }),
  ]));
});

it("ignores chart execution selection while editing a retained snapshot", async () => {
  let initial = documentWithDecisionSnapshots(episode);
  initial = freezeRecallSnapshotBundle(initial, initial.snapshots[1].id, { episode, bundleId: "marker-selection", retainedAt: "2026-01-20T11:00:00Z" });
  confirmRecallRetainedState(undefined, initial, episode, 6);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "编辑决策 2快照" }));
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");

  await act(async () => chartHarness.onExecutionSelect?.("fill-1"));

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
});

it("leaves explicit full history when a chart execution is selected", async () => {
  const initial = createRecallDocument(episode);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  openMoreRecords();
  fireEvent.click(screen.getByRole("button", { name: "完整历史" }));
  expect(screen.getByText(/完整历史：当前回合成交全部显示/)).toBeInTheDocument();

  await act(async () => chartHarness.onExecutionSelect?.("fill-1"));

  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-1");
  expect(screen.queryByText(/完整历史：当前回合成交全部显示/)).toBeNull();
});

it("marks future exposure when an early view opens a later holding snapshot", async () => {
  const episode = episodeWithExecutions("holding-exposure");
  let initial = createRecallDocument(episode);
  initial.snapshots = [{ ...snapshot("holding-later", initial.decisions[1].id), phase: "holding", hasSeenFuture: false, executionCursor: "fill-2", cursor: secondCandle.knowledgeAt! }];
  initial = freezeRecallSnapshotBundle(initial, "holding-later", { episode, bundleId: "later-holding", retainedAt: "2026-01-20T11:00:00Z" });
  confirmRecallRetainedState(undefined, initial, episode, 6);
  const repository = repositoryFor(initial);
  renderRecall(episode, initial, repository);
  await settleLoad();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "买入前判断" })));
  const earlyCursor = screen.getByTestId("review-chart").getAttribute("data-cursor")!;
  openMoreRecords();
  fireEvent.click(screen.getByText("全部记录与快照（1）"));
  fireEvent.click(screen.getByRole("button", { name: "编辑决策 2快照" }));
  expect(screen.getByTestId("review-chart").getAttribute("data-execution-cursor")).toBe("fill-2");
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
  chartHarness.nextDrawing = { ...drawing("exposed-text", "后来补充"), createdAtCursor: earlyCursor };
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  expect(JSON.parse(screen.getByTestId("review-chart").getAttribute("data-drawings")!)[0].recallHasSeenFuture).toBe(true);
});

it("keeps blind episode choices free of closed outcome labels", async () => {
  const base = createRecallDocument(episode);
  const initial = {
    ...base,
    working: {
      ...base.working,
      phase: "pre-entry" as const,
      cursor: new Date(Date.parse(episode.executions[0]!.executedAt) - 1).toISOString(),
      executionCursor: NO_REVEALED_EXECUTIONS,
      hasSeenFuture: false,
    },
  };
  renderRecall(episode, initial, repositoryFor(initial), [episode]);
  await settleLoad();

  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
});

it("starts next decision from the first fill after returning to pre-entry", async () => {
  const initial = createRecallDocument(episode);
  initial.working.phase = "pre-entry";
  initial.working.cursor = new Date(Date.parse(episode.executions[0]!.executedAt) - 1).toISOString();
  initial.working.executionCursor = NO_REVEALED_EXECUTIONS;
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
  await settleLoad();
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-1");
  fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
  await settleLoad();
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");

  fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));
  await settleLoad();
  expect(screen.getByTestId("review-chart")).not.toHaveAttribute("data-execution-cursor");
  fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
  await settleLoad();
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-1");
});

it("does not restore a date-only execution from an old session-close draft", async () => {
  const source = episodeWithExecutions("date-only-restore", 1);
  const dateOnlyExecution = {
    ...source.executions[0]!,
    id: "date-only-fill",
    executedAt: candle.knowledgeAt!,
    source: {
      ...source.executions[0]!.source,
      platform: "china-merchants",
      timePrecision: "date-only" as const,
      sourceTimestampText: "20260120",
      sourceTimezone: "Asia/Shanghai",
    },
  };
  const dateOnlyEpisode: TradeEpisode = {
    ...source,
    executions: [dateOnlyExecution],
    startedAt: candle.time,
    endedAt: secondCandle.time,
  };
  const base = createRecallDocument(dateOnlyEpisode);
  const initial: RecallDocument = {
    ...base,
    working: {
      ...base.working,
      phase: "holding",
      cursor: candle.knowledgeAt!,
      executionCursor: dateOnlyExecution.id,
      editingContext: {
        mode: "global",
        decisionId: "global",
        drawings: [],
        timeframe: "1D",
        cursor: candle.knowledgeAt!,
        executionCursor: dateOnlyExecution.id,
        revealedCandleCursor: candle.knowledgeAt!,
      },
    },
  };
  renderRecall(dateOnlyEpisode, initial, repositoryFor(initial));
  await settleLoad();

  expect(screen.getByTestId("review-chart")).not.toHaveAttribute("data-execution-cursor");
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-candle-count", "1");
});

it("keeps same-candle decisions in stable execution order", async () => {
  const sameCandleEpisode = episodeWithExecutions("same-candle");
  sameCandleEpisode.executions = [
    execution("same-fill-1", candle.time),
    { ...execution("same-fill-2", candle.time), side: "sell" },
  ];
  const base = createRecallDocument(sameCandleEpisode);
  const initial = {
    ...base,
    working: {
      ...base.working,
      phase: "pre-entry" as const,
      cursor: new Date(Date.parse(candle.time) - 1).toISOString(),
      executionCursor: NO_REVEALED_EXECUTIONS,
    },
  };
  renderRecall(sameCandleEpisode, initial, repositoryFor(initial));
  await settleLoad();

  fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "same-fill-1");
  fireEvent.click(screen.getByRole("button", { name: "下一笔决策" }));
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "same-fill-2");
});

it("keeps future provenance after direct decision navigation and returning early", async () => {
  const initial = createRecallDocument(episode);
  renderRecall(episode, initial, repositoryFor(initial));
  await settleLoad();

  if (!document.querySelector(".recall-decision-wrap")) {
    fireEvent.click(screen.getByRole("button", { name: "展开复盘导航，切换到标准布局" }));
  }
  fireEvent.click(document.querySelectorAll<HTMLElement>(".recall-decision-wrap > .recall-nav-item")[1]!);
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "fill-2");
  fireEvent.click(screen.getByRole("button", { name: "买入前判断" }));
  await settleLoad();

  expect(screen.getAllByText(/已看后续补记/).length).toBeGreaterThan(0);
  expect(screen.getByRole("combobox", { name: "交易回合" })).not.toHaveTextContent("平仓");
});

it("requires explicit reassignment of orphan phase evidence before resolving import changes", async () => {
  const previous = episodeWithExecutions("orphan-phase");
  const current = episodeWithExecutions("orphan-phase", 1);
  const initial = createRecallDocument(previous);
  const oldOwner = initial.decisions[1].id;
  initial.working.phaseContexts = { holding: {
    mode: "decision", decisionId: oldOwner, timeframe: "1D", cursor: secondCandle.knowledgeAt!, executionCursor: "fill-2",
    drawings: [{ ...drawing("orphan-note", "保留我的判断"), recallOwnerId: oldOwner }],
  } };
  const repository = repositoryFor(initial);
  renderRecall(current, initial, repository);
  await settleLoad();
  const confirm = screen.getByRole("button", { name: "确认已处理行情变更" });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "重新关联持仓过程草稿" }), { target: { value: "global" } });
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(confirm);
  expect(screen.queryByText("导入行情已有变更")).toBeNull();
  await waitFor(() => expect(repository.save).toHaveBeenCalled(), { timeout: 2000 });
  const saved = repository.save.mock.calls.at(-1)![0];
  expect(saved.working.phaseContexts?.holding).toMatchObject({ mode: "global", decisionId: "global", drawings: [{ id: "orphan-note", text: "保留我的判断", recallOwnerId: "global" }] });
});

function sourceBoundSnapshot(original = episodeWithExecutions("bound-authority"), sourceCandles = [candle], executionCursor = "fill-1") {
  let initial = documentWithDecisionSnapshots(original);
  initial.snapshots[0].phase = "holding";
  initial.snapshots[0].priceBasis = "raw";
  initial.snapshots[0].candles = sourceCandles;
  initial.snapshots[0].cursor = sourceCandles.at(-1)!.knowledgeAt!;
  initial.snapshots[0].executionCursor = executionCursor;
  initial.working = { ...initial.working, phase: "holding", cursor: initial.snapshots[0].cursor, executionCursor };
  initial = freezeRecallSnapshotBundle(initial, initial.snapshots[0].id, { episode: original, bundleId: "bound-old", retainedAt: "2026-01-20T11:00:00Z" });
  confirmRecallRetainedState(undefined, initial, original, 6);
  retainRecallActualMetrics(undefined, initial);
  initial.revision = 6;
  return { original, initial };
}

it("RS06 allows a same-source Text recapture, saves a new bundle and preserves accepted old bytes", async () => {
  const { original, initial } = sourceBoundSnapshot();
  const oldBytes = JSON.stringify(initial.retainedBundles![0]);
  let persisted = structuredClone(initial);
  const repository = repositoryFor(initial, async document => {
    const next = structuredClone(document);
    confirmRecallRetainedState(persisted, next, original, persisted.revision + 1);
    retainRecallActualMetrics(persisted, next);
    next.revision = persisted.revision + 1;
    persisted = next;
    return next;
  });
  renderRecall(original, initial, repository);
  await settleLoad(); openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  await waitFor(() => expect(persisted.retainedBundles).toHaveLength(2), { timeout: 2500 });
  expect(JSON.stringify(persisted.retainedBundles![0])).toBe(oldBytes);
  expect(persisted.snapshots[0].retainedBundleId).not.toBe("bound-old");
  expect(persisted.snapshots[0].drawings.some(item => item.text === "普通编辑")).toBe(true);
  expect(persisted.retainedBundles![1].executionEvidence).toEqual(initial.retainedBundles![0].executionEvidence);
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  cleanup(); renderRecall(original, persisted, repositoryFor(persisted)); await settleLoad(); openAllSnapshotRecords();
  expect(screen.getByText(/1 段文字/)).toBeInTheDocument();
});

it.each(["fee", "decisions"] as const)("RS06 rechecks %s authority after capture awaits and retains the pending Text", async change => {
  const sourceCandles = [candle, secondCandle].map(bar => ({ ...bar, open: 100, high: 120, low: 90, close: 110 }));
  const financialEpisode = episodeWithExecutions("financial-authority");
  financialEpisode.status = "open"; delete financialEpisode.endedAt;
  financialEpisode.openingQuantity = "2"; financialEpisode.remainingQuantity = "1";
  Object.assign(financialEpisode.executions[0], { quantity: "2", price: "100", fee: "1" });
  Object.assign(financialEpisode.executions[1], { quantity: "1", price: "120", fee: "invalid" });
  const { original, initial } = sourceBoundSnapshot(financialEpisode, sourceCandles, "fill-2");
  const oldBytes = JSON.stringify(initial.retainedBundles);
  const repository = repositoryFor(initial);
  const sourceTimeframes = { "15m": sourceCandles, "1D": sourceCandles, "1W": sourceCandles };
  const view = (selected: TradeEpisode) => <RecallWorkspace episode={selected} episodes={[selected]} instrument={selected.instrument} instruments={[selected.instrument]} timeframeAvailability={availability} importedTimelineCandles={sourceCandles} candlesByTimeframe={sourceTimeframes} settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()} />;
  const rendered = render(view(original)); await settleLoad(); openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  let release!: (result: { imageDataUrl: string; viewport: typeof chartHarness.viewport }) => void;
  chartHarness.handle.capture.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  expect(chartHarness.handle.capture).toHaveBeenCalledTimes(1);
  const corrected = structuredClone(original);
  if (change === "fee") corrected.executions[1].fee = "2";
  else corrected.executions.push({ ...corrected.executions[1], id: "new-decision", executedAt: "2026-01-20T11:00:00.000Z" });
  rendered.rerender(view(corrected)); await settleLoad();
  await act(async () => release({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }));
  expect(await screen.findByText("成交或决策已变更，请返回工作图重新留存")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(chartHarness.pending?.drawings.some(item => item.text === "普通编辑")).toBe(true);
  expect(repository.save.mock.calls.every(([saved]) => saved.snapshots[0].retainedBundleId === "bound-old")).toBe(true);
  expect(JSON.stringify(initial.retainedBundles)).toBe(oldBytes);
  fireEvent.click(screen.getByRole("button", { name: "统计" }));
  expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("净盈亏费用待核对累计费用待核对");
  const discard = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
  if (change === "fee") expect(screen.getByRole("complementary", { name: "当前统计" })).toHaveTextContent("净盈亏+¥27.00累计费用¥3.00");
  discard.mockRestore();
});

it.each(["episode", "reload"] as const)("RS06 clears the snapshot editor backup on an explicit %s boundary", async boundary => {
  vi.useFakeTimers();
  const { original, initial } = sourceBoundSnapshot();
  const other = { ...original, id: "another-episode" };
  const otherDocument = createRecallDocument(other);
  const repository: RecallRepository = {
    load: vi.fn(async (id: string) => id === other.id ? otherDocument : initial),
    fetch: vi.fn(),
    save: vi.fn().mockRejectedValue(new RecallRepositoryError(409, "revision-conflict", "External revision")),
  };
  const sourceCandles = [candle, secondCandle];
  const sourceTimeframes = { "15m": sourceCandles, "1D": sourceCandles, "1W": sourceCandles };
  const view = (selected: TradeEpisode) => <RecallWorkspace episode={selected} episodes={[original, other]} instrument={selected.instrument} instruments={[selected.instrument]} timeframeAvailability={availability} importedTimelineCandles={sourceCandles} candlesByTimeframe={sourceTimeframes} settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()} />;
  const rendered = render(view(original)); await settleLoad();
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getByRole("button", { name: "重新载入" })).toBeInTheDocument();
  openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: "编辑决策 1快照" }));
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  expect(chartHarness.pending?.drawings.some(item => item.text === "普通编辑")).toBe(true);
  if (boundary === "episode") rendered.rerender(view(other));
  else fireEvent.click(screen.getByRole("button", { name: "重新载入" }));
  await settleLoad();
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  expect(chartHarness.pending?.drawings).toEqual([]);
  // A following same-episode refresh must not resurrect the previous editor.
  rendered.rerender(view(structuredClone(boundary === "episode" ? other : original)));
  await settleLoad();
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  expect(chartHarness.pending?.drawings).toEqual([]);
});

// Retained edit sessions: these literal scenes share financial evidence but
// have independent working/retained cutoffs and Text. Never derive W from A.
function editSessionFixture(merged = false) {
  const buy = { ...execution("buy", "2025-01-02T02:00:00.000Z"), quantity: "2", price: "100", instrument: { id: "HK:TEST", symbol: "TEST", name: "Session instrument", market: "HK", currency: "HKD" } };
  const sell = { ...buy, id: "sell", side: "sell" as const, executedAt: "2025-01-03T02:00:00.000Z", quantity: "1", price: "120", fee: "2" };
  const current: TradeEpisode = { ...episode, id: "session-episode", instrument: buy.instrument, status: "open", startedAt: buy.executedAt, endedAt: undefined, openingQuantity: "2", remainingQuantity: "1", executions: [buy, sell] };
  const bars = ["02", "03", "06"].map((day, index) => ({ ...candle, time: `2025-01-${day}T08:00:00.000Z`, knowledgeAt: `2025-01-${day}T08:00:00.000Z`, open: 100, low: 90, high: 130, close: [100, 120, 115][index] }));
  const text = (id: string, label: string, owner = "global") => ({ ...drawing(id, label), episodeId: current.id, recallOwnerId: owner, recallPhase: "holding" as const, anchors: [{ time: bars[0].time, price: 100 }], createdAtCursor: bars[0].time });
  const wViewport = { ...chartHarness.viewport, logicalRange: { from: 0, to: 4 } };
  let initial = createRecallDocument(current, "2025-01-06T09:00:00.000Z");
  const [d1, d2] = initial.decisions.map(item => item.id);
  if (merged) initial = mergeRecallDecisions(initial, [d1, d2]);
  initial.working = { ...initial.working, phase: "holding", selectedDecisionId: "global", timeframe: "1D", cursor: bars[2].time, executionCursor: "sell", drawings: [text("w", "WORKING-W")] };
  initial.snapshots = [d1, merged ? d1 : d2].map((owner, index) => ({ ...snapshot(index ? "B" : "A", owner), phase: "holding", priceBasis: "raw", cursor: bars[index].time, executionCursor: index ? "sell" : "buy", candles: bars.slice(0, index + 1), drawings: [text(index ? "b" : "a", index ? "RETAINED-B" : "RETAINED-A", owner)], viewport: { ...chartHarness.viewport, logicalRange: { from: index, to: index + 1 } } }));
  for (const item of initial.snapshots) initial = freezeRecallSnapshotBundle(initial, item.id, { episode: current, bundleId: `original-${item.id}`, retainedAt: "2025-01-06T09:00:00.000Z" });
  confirmRecallRetainedState(undefined, initial, current, 6);
  retainRecallActualMetrics(undefined, initial);
  initial.revision = 6;
  const frames = { "15m": bars, "1D": bars, "1W": bars };
  const view = (repository: RecallRepository, overrides: Partial<RecallWorkspaceProps> = {}) => <RecallWorkspace episode={current} episodes={[current]} instrument={current.instrument} instruments={[current.instrument]} timeframeAvailability={availability} importedTimelineCandles={bars} candlesByTimeframe={frames} settings={settings} repository={repository} onEpisodeChange={vi.fn()} onInstrumentChange={vi.fn()} onSettingsChange={vi.fn()} {...overrides} />;
  return { current, initial, bars, text, wViewport, d1, d2, view };
}
function deferredCapture() {
  let resolve!: (value: { imageDataUrl: string; viewport: typeof chartHarness.viewport; warnings?: string[] }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ imageDataUrl: string; viewport: typeof chartHarness.viewport; warnings?: string[] }>((yes, no) => { resolve = yes; reject = no; });
  chartHarness.handle.capture.mockReturnValueOnce(promise);
  return { resolve, reject };
}
function openSessionSnapshot(number: number) {
  openAllSnapshotRecords();
  fireEvent.click(screen.getByRole("button", { name: `编辑决策 ${number}快照` }));
}
function expectWorkingSession() {
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-cursor", "2025-01-06T08:00:00.000Z");
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-execution-cursor", "sell");
  expect(screen.getByTestId("review-chart").getAttribute("data-drawings")).toContain("WORKING-W");
  expect(screen.getByTestId("review-chart").getAttribute("data-drawings")).not.toContain("RETAINED-A");
  expect(document.querySelector(".recall-position-stats")).toHaveTextContent("持仓 1");
}

it("S01 preserves the first W return point across clean A to B", async () => {
  const f = editSessionFixture(); const repository = repositoryFor(f.initial);
  render(f.view(repository)); await settleLoad();
  chartHarness.handle.getViewport.mockReturnValue(f.wViewport);
  openSessionSnapshot(1); openSessionSnapshot(2);
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
  expectWorkingSession();
  await waitFor(() => expect(chartHarness.handle.restoreViewport).toHaveBeenLastCalledWith(f.wViewport));
});

it("S02 left global navigation persists W rather than retained A", async () => {
  vi.useFakeTimers();
  const f = editSessionFixture(); const repository = repositoryFor(f.initial);
  render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  fireEvent.click(screen.getByRole("button", { name: /全局总结尚未留存/ }));
  expectWorkingSession();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(repository.save).toHaveBeenCalled();
  const saved = repository.save.mock.calls.at(-1)![0];
  expect(saved.working.drawings.map(item => item.text)).toEqual(["WORKING-W"]);
  expect(saved.working.cursor).toBe(f.bars[2].time);
  cleanup(); render(f.view(repositoryFor(saved))); await settleLoad(); expectWorkingSession();
});

it.each(["resolve", "reject"] as const)("S07 obsolete A capture cannot %s into the same-source B session", async outcome => {
  const f = editSessionFixture(); const repository = repositoryFor(f.initial);
  render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("unsaved-a", "UNSAVED-A", f.d1);
  fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const pending = deferredCapture();
  fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  vi.spyOn(window, "confirm").mockReturnValue(false);
  openSessionSnapshot(2);
  await act(async () => { if (outcome === "resolve") pending.resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); else pending.reject(new Error("obsolete capture error")); });
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(screen.getByTestId("review-chart").getAttribute("data-drawings")).toContain("RETAINED-B");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(chartHarness.handle.capture).toHaveBeenCalledTimes(1);
});

it("S03 retained left navigation saves the outgoing decision W, not A", async () => {
  vi.useFakeTimers(); const f = editSessionFixture();
  const graph = { mode: "decision" as const, decisionId: f.d1, timeframe: "1D" as const, cursor: f.bars[2].time, executionCursor: "sell", drawings: [f.text("dw", "DECISION-W", f.d1)] };
  f.initial.working.selectedDecisionId = f.d1;
  f.initial.working.editingContext = graph;
  f.initial.working.decisionDrafts = [graph];
  const repository = repositoryFor(f.initial); render(f.view(repository)); await settleLoad();
  openSessionSnapshot(1); fireEvent.click(decisionButton(2));
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  const saved = repository.save.mock.calls.at(-1)![0];
  expect(saved.working.decisionDrafts?.find(item => item.decisionId === f.d1)?.drawings.map(item => item.text)).toEqual(["DECISION-W"]);
  expect(saved.working.editingContext?.decisionId).toBe(f.d2);
});

it("S04 same A is a no-op and explicit discard to B preserves original bundles", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(); const bytes = JSON.stringify(f.initial.retainedBundles);
  const repository = repositoryFor(f.initial); render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("unsaved", "UNSAVED-A", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  openSessionSnapshot(1); expect(confirm).not.toHaveBeenCalled();
  expect(chartHarness.pending?.drawings.some(item => item.text === "UNSAVED-A")).toBe(true);
  openSessionSnapshot(2); expect(confirm).toHaveBeenCalledTimes(1);
  expect(chartHarness.pending?.drawings.map(item => item.text)).toEqual(["RETAINED-B"]);
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" })); expectWorkingSession();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(chartHarness.handle.capture).not.toHaveBeenCalled();
  expect(JSON.stringify(f.initial.retainedBundles)).toBe(bytes);
  for (const [saved] of repository.save.mock.calls) expect(JSON.stringify(saved.retainedBundles)).toBe(bytes);
});

it("S05 update A then open B retains one new bundle and survives save and reload", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(); const bytes = f.initial.retainedBundles!.map(item => JSON.stringify(item));
  let persisted = structuredClone(f.initial);
  const repository = repositoryFor(f.initial, async candidate => {
    const next = structuredClone(candidate); confirmRecallRetainedState(persisted, next, f.current, persisted.revision + 1); retainRecallActualMetrics(persisted, next); next.revision = ++persisted.revision; persisted = next; return next;
  });
  render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("new-a", "UPDATED-A", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  vi.spyOn(window, "confirm").mockReturnValue(true); openSessionSnapshot(2); await settleLoad();
  expect(chartHarness.handle.capture).toHaveBeenCalledTimes(1);
  expect(chartHarness.pending?.drawings.map(item => item.text)).toEqual(["RETAINED-B"]);
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" })); expectWorkingSession();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(persisted.retainedBundles).toHaveLength(3);
  expect(persisted.retainedBundles!.slice(0, 2).map(item => JSON.stringify(item))).toEqual(bytes);
  expect(persisted.snapshots[0].drawings.map(item => item.text)).toEqual(["RETAINED-A", "UPDATED-A"]);
  cleanup(); render(f.view(repositoryFor(persisted))); await settleLoad(); expectWorkingSession();
});

it.each(["authority", "capture", "warning"] as const)("S06 %s failure preserves A input and blocks B", async failure => {
  const f = editSessionFixture(); const repository = repositoryFor(f.initial);
  const changed = { ...f.current, executions: f.current.executions.map(item => ({ ...item, fee: "3" })) };
  render(f.view(repository, failure === "authority" ? { episode: changed } : {})); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("unsaved", "UNSAVED-A", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValue(false);
  if (failure === "capture") chartHarness.handle.capture.mockRejectedValueOnce(new Error("capture refused"));
  if (failure === "warning") chartHarness.handle.capture.mockResolvedValueOnce({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport, warnings: ["clipped"] });
  openSessionSnapshot(2); await settleLoad();
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("UNSAVED-A");
  expect(chartHarness.pending?.drawings.map(item => item.text)).not.toContain("RETAINED-B");
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(chartHarness.handle.capture).toHaveBeenCalledTimes(failure === "authority" ? 0 : 1);
});

it.each(["reload", "reload-failed", "episode", "unmount"] as const)("S08 pending A loses its lease at %s", async boundary => {
  vi.useFakeTimers(); const f = editSessionFixture();
  const other = { ...f.current, id: "other-session" };
  const repository = repositoryFor(f.initial, async () => { throw new RecallRepositoryError(409, "revision-conflict", "conflict"); });
  const rendered = render(f.view(repository)); await settleLoad();
  chartHarness.nextDrawing = f.text("working-edit", "W-EDIT"); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  openSessionSnapshot(1); chartHarness.nextDrawing = f.text("a-edit", "A-INPUT", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const pending = deferredCapture(); fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  if (boundary === "unmount") rendered.unmount();
  else if (boundary === "episode") {
    repository.load.mockResolvedValueOnce(createRecallDocument(other));
    rendered.rerender(f.view(repository, { episode: other, episodes: [other] }));
  } else {
    if (boundary === "reload-failed") repository.load.mockRejectedValueOnce(new Error("reload refused"));
    fireEvent.click(screen.getByRole("button", { name: "重新载入" }));
  }
  await settleLoad();
  await act(async () => { pending.resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); });
  if (boundary === "reload-failed") {
    expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("A-INPUT");
    expect(screen.getByRole("alert")).toHaveTextContent("reload refused");
  } else expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  expect(repository.save.mock.calls.every(([candidate]) => candidate.retainedBundles?.length === 2)).toBe(true);
});

it("S09 same-episode hydration and own save ack preserve the original W and dirty A", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(); const repository = repositoryFor(f.initial);
  const rendered = render(f.view(repository)); await settleLoad();
  chartHarness.nextDrawing = f.text("w-edit", "W-EDIT"); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  openSessionSnapshot(1); chartHarness.nextDrawing = f.text("a-edit", "A-INPUT", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  rendered.rerender(f.view(repository, { episode: structuredClone(f.current) })); await settleLoad();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("A-INPUT");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false); openSessionSnapshot(2);
  expect(confirm).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" })); expectWorkingSession();
  expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("W-EDIT");
});

it.each(["capture", "save"] as const)("S10 leave guard rejects %s failure without losing local edits", async failure => {
  const f = editSessionFixture(); let guard: (() => Promise<boolean>) | null = null;
  const repository = repositoryFor(f.initial, async () => { throw new RecallRepositoryError(409, "revision-conflict", "conflict"); });
  render(f.view(repository, { onLeaveGuardChange: value => { guard = value; } })); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("a-edit", "A-INPUT", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  if (failure === "capture") chartHarness.handle.capture.mockRejectedValueOnce(new Error("capture refused"));
  let result: boolean | undefined; await act(async () => { result = await guard!(); });
  expect(result).toBe(false);
  if (failure === "capture") {
    expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
    expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("A-INPUT");
    expect(repository.save).not.toHaveBeenCalled();
  } else {
    expect(repository.save.mock.calls.at(-1)![0].snapshots[0].drawings.map(item => item.text)).toContain("A-INPUT");
    expect(screen.getByRole("button", { name: "重新载入" })).toBeInTheDocument();
    openSessionSnapshot(1); expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("A-INPUT");
  }
});

it("S11 deleting active pending A invalidates capture; undo restores a record, not an editor", async () => {
  const f = editSessionFixture(); const repository = repositoryFor(f.initial); render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  const pending = deferredCapture(); fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  fireEvent.click(screen.getByRole("button", { name: "删除决策 1快照" })); expectWorkingSession();
  fireEvent.click(screen.getByRole("button", { name: "撤销" }));
  await act(async () => { pending.resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); });
  expectWorkingSession(); expect(screen.getByRole("button", { name: "编辑决策 1快照" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("S11 deleting B and reordering records keep active A and its dirty Text", async () => {
  const f = editSessionFixture(); render(f.view(repositoryFor(f.initial))); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("a-edit", "A-INPUT", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const rows = document.querySelectorAll(".recall-snapshot-list li");
  fireEvent.drop(rows[1], { dataTransfer: { getData: () => "A" } });
  fireEvent.click(screen.getByRole("button", { name: "删除决策 2快照" }));
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("A-INPUT");
});

it.each(["pre-entry", "holding", "post-review", "history"] as const)("S12 returns the %s working phase, mode and dual cutoffs", async mode => {
  const f = editSessionFixture();
  if (mode === "pre-entry") { f.initial.working.phase = mode; f.initial.working.cursor = "2025-01-02T01:59:59.999Z"; f.initial.working.executionCursor = NO_REVEALED_EXECUTIONS; f.initial.working.drawings = []; }
  if (mode === "post-review") f.initial.working.phase = mode;
  render(f.view(repositoryFor(f.initial))); await settleLoad();
  if (mode === "history") { openMoreRecords(); fireEvent.click(screen.getByRole("button", { name: "完整历史" })); }
  openSessionSnapshot(1); openSessionSnapshot(2); fireEvent.click(screen.getByRole("button", { name: "返回工作图" }));
  const phaseName = mode === "pre-entry" ? "买入前判断" : mode === "post-review" ? "事后复盘" : "持仓过程";
  expect(screen.getByRole("button", { name: phaseName })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "播放" })).toHaveAttribute("aria-pressed", "false");
  if (mode === "pre-entry") {
    expect(screen.getByTestId("review-chart")).toHaveAttribute("data-cursor", "2025-01-02T01:59:59.999Z");
    expect(screen.getByTestId("review-chart")).not.toHaveAttribute("data-execution-cursor");
    expect(screen.getAllByText(/成交尚未揭示/).length).toBeGreaterThan(0);
  } else { expectWorkingSession(); if (mode === "history") expect(screen.getAllByRole("button", { name: "返回回放" }).length).toBeGreaterThan(0); }
});

it("S13 synchronous focused Text belongs to capture and duplicate update reuses it", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(); const repository = repositoryFor(f.initial); render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  let resolve!: (value: { imageDataUrl: string; viewport: typeof chartHarness.viewport }) => void;
  chartHarness.handle.capture.mockImplementationOnce(() => {
    chartHarness.onCommand!({ type: "add", drawing: f.text("focused", "FOCUSED-TEXT", f.d1) });
    return new Promise(yes => { resolve = yes; });
  });
  fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  vi.spyOn(window, "confirm").mockReturnValue(true); openSessionSnapshot(2);
  await act(async () => { resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); });
  expect(chartHarness.handle.capture).toHaveBeenCalledTimes(1);
  expect(chartHarness.pending?.drawings.map(item => item.text)).toEqual(["RETAINED-B"]);
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(repository.save.mock.calls.at(-1)![0].snapshots[0].drawings.map(item => item.text)).toContain("FOCUSED-TEXT");
});

it.each(["text", "timeframe"] as const)("S13 later %s edit rejects capture while preserving A", async edit => {
  const f = editSessionFixture(); render(f.view(repositoryFor(f.initial))); await settleLoad(); openSessionSnapshot(1);
  const pending = deferredCapture(); fireEvent.click(screen.getByRole("button", { name: "更新此快照" }));
  if (edit === "text") { chartHarness.nextDrawing = f.text("later", "LATER-TEXT", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" })); }
  else fireEvent.click(screen.getByRole("button", { name: "切换到 1W" }));
  await act(async () => { pending.resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); });
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("截图期间内容已修改");
  if (edit === "text") expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("LATER-TEXT");
});

it("S14 obsolete viewport RAF callbacks cannot move B or overwrite W", async () => {
  const f = editSessionFixture(); const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callbacks.push(callback); return callbacks.length; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  render(f.view(repositoryFor(f.initial))); await settleLoad();
  chartHarness.handle.getViewport.mockReturnValue(f.wViewport);
  openSessionSnapshot(1); fireEvent.click(screen.getByRole("button", { name: "返回工作图" })); openSessionSnapshot(2);
  chartHarness.handle.restoreViewport.mockClear(); act(() => { callbacks.splice(0).forEach(callback => callback(0)); });
  expect(chartHarness.handle.restoreViewport.mock.calls).toEqual([[f.initial.snapshots[1].viewport]]);
});

it.each(["resolve", "reject"] as const)("S15 working retain %s after entering A cannot commit or report in A", async outcome => {
  const f = editSessionFixture(); render(f.view(repositoryFor(f.initial))); await settleLoad();
  const pending = deferredCapture(); fireEvent.click(screen.getByRole("button", { name: "留存当前快照" })); openSessionSnapshot(1);
  await act(async () => { if (outcome === "resolve") pending.resolve({ imageDataUrl: "data:image/png;base64,AA==", viewport: chartHarness.viewport }); else pending.reject(new Error("old working capture")); });
  expect(chartHarness.pending?.drawings.map(item => item.text)).toEqual(["RETAINED-A"]);
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText(/全部记录与快照（2）/)).toBeInTheDocument();
});

it("S16 phase flush started in W cannot change A after awaiting", async () => {
  const f = editSessionFixture(); render(f.view(repositoryFor(f.initial))); await settleLoad();
  let resolve!: () => void; chartHarness.handle.flush.mockImplementationOnce(() => new Promise<void>(yes => { resolve = yes; }));
  fireEvent.click(screen.getByRole("button", { name: "买入前判断" })); openSessionSnapshot(1);
  await act(async () => { resolve(); });
  expect(chartHarness.pending?.drawings.map(item => item.text)).toEqual(["RETAINED-A"]);
  expect(screen.getByTestId("review-chart")).toHaveAttribute("data-cursor", f.bars[0].time);
  expect(screen.getByRole("button", { name: "持仓过程" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "返回工作图" })); expectWorkingSession();
});

it("S14 a newly ready retained handle cannot seed the empty working viewport", async () => {
  const f = editSessionFixture(); chartHarness.handle.getViewport.mockReturnValue(undefined as unknown as typeof chartHarness.viewport);
  render(f.view(repositoryFor(f.initial))); await settleLoad(); openSessionSnapshot(1);
  chartHarness.handle.getViewport.mockReturnValue({ ...chartHarness.viewport, logicalRange: { from: 40, to: 50 } });
  act(() => { chartHarness.onReady?.(chartHarness.handle as unknown as RecallChartHandle); });
  fireEvent.click(screen.getByRole("button", { name: /全局总结尚未留存/ }));
  chartHarness.handle.restoreViewport.mockClear(); await act(async () => { await new Promise(resolve => window.requestAnimationFrame(resolve)); });
  expect(chartHarness.handle.restoreViewport.mock.calls.some(([value]) => value.logicalRange?.from === 40)).toBe(false);
  expectWorkingSession();
});

it("S15 retained merge uses explicit decision intent after the discard boundary", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(); const repository = repositoryFor(f.initial); render(f.view(repository)); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("dirty", "DO-NOT-PROPAGATE", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "选择决策 1 进行合并" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "选择决策 2 进行合并" }));
  fireEvent.click(screen.getByRole("button", { name: "合并所选决策" }));
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  const saved = repository.save.mock.calls.at(-1)![0];
  expect(saved.decisions).toHaveLength(1);
  expect(saved.decisions[0].executionIds).toEqual(["buy", "sell"]);
  expect(saved.working.drawings.map(item => item.text)).toEqual(["WORKING-W"]);
  expect(saved.snapshots.some(item => item.drawings.some(item => item.text === "DO-NOT-PROPAGATE"))).toBe(false);
});

it("S15 retained split uses explicit groups after the discard boundary", async () => {
  vi.useFakeTimers(); const f = editSessionFixture(true); const repository = repositoryFor(f.initial);
  render(f.view(repository)); await settleLoad();
  openAllSnapshotRecords(); fireEvent.click(screen.getAllByRole("button", { name: "编辑决策 1快照" })[0]);
  chartHarness.nextDrawing = f.text("dirty", "DO-NOT-PROPAGATE", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "拆分当前决策" }));
  fireEvent.change(screen.getByRole("textbox", { name: "第 1 组成交 ID" }), { target: { value: "buy" } });
  fireEvent.change(screen.getByRole("textbox", { name: "第 2 组决策编号" }), { target: { value: "split-sell" } });
  fireEvent.change(screen.getByRole("textbox", { name: "第 2 组成交 ID" }), { target: { value: "sell" } });
  fireEvent.click(screen.getByRole("button", { name: "确认拆分" }));
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(repository.save.mock.calls.at(-1)![0].decisions.map(item => item.executionIds)).toEqual([["buy"], ["sell"]]);
  expect(repository.save.mock.calls.at(-1)![0].working.drawings.map(item => item.text)).toEqual(["WORKING-W"]);
});

it("S15 invalid split stays in the active editor with its input", async () => {
  const f = editSessionFixture(true);
  render(f.view(repositoryFor(f.initial))); await settleLoad(); openAllSnapshotRecords();
  fireEvent.click(screen.getAllByRole("button", { name: "编辑决策 1快照" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "拆分当前决策" }));
  fireEvent.click(screen.getByRole("button", { name: "确认拆分" }));
  expect(screen.getByRole("button", { name: "更新此快照" })).toBeInTheDocument();
  expect(chartHarness.pending?.drawings.map(item => item.text)).toContain("RETAINED-A");
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

it("S15 orphan snapshot, phase and reconciliation actions cross the same retained boundary", async () => {
  vi.useFakeTimers(); const f = editSessionFixture();
  f.initial.working.phaseContexts = { "pre-entry": { mode: "decision", decisionId: f.d2, timeframe: "1D", cursor: f.bars[0].time, executionCursor: "buy", drawings: [f.text("orphan", "ORPHAN-W", f.d2)] } };
  const changed = { ...f.current, remainingQuantity: "2", executions: [f.current.executions[0]] };
  const repository = repositoryFor(f.initial); render(f.view(repository, { episode: changed })); await settleLoad(); openSessionSnapshot(1);
  chartHarness.nextDrawing = f.text("dirty", "A-DIRTY", f.d1); fireEvent.click(screen.getByRole("button", { name: "add text" }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.change(screen.getByRole("combobox", { name: "重新关联快照 B" }), { target: { value: f.d1 } });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  openAllSnapshotRecords(); fireEvent.click(screen.getAllByRole("button", { name: "编辑决策 1快照" })[0]);
  fireEvent.change(screen.getByRole("combobox", { name: "重新关联买入前判断草稿" }), { target: { value: "global" } });
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  openAllSnapshotRecords(); fireEvent.click(screen.getAllByRole("button", { name: "编辑决策 1快照" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "确认已处理行情变更" }));
  expect(screen.queryByRole("button", { name: "更新此快照" })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  const saved = repository.save.mock.calls.at(-1)![0];
  expect(saved.working.drawings.map(item => item.text)).toEqual(["WORKING-W"]);
  expect(saved.working.phaseContexts?.["pre-entry"]?.decisionId).toBe("global");
  expect(saved.reconciliation?.stale).not.toBe(true);
});
