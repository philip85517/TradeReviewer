import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import type { HoldingsHistoryWorkerInput } from "../../lib/reviews/holdings-history-worker";
import { recoverStaleMarketDataJob } from "../../lib/market/market-data-job-recovery";
import type { MarketDataJob } from "../../lib/storage/market-data-jobs";
import {
  useHoldingsValuationRefresh,
  type HoldingsValuationRefreshInput,
  type HoldingsRefreshReceipt,
} from "./use-holdings-valuation-refresh";

afterEach(cleanup);

type RefreshValue = boolean | HoldingsRefreshReceipt;
type RefreshJob = {
  status: string;
  requestedAt?: string;
  error?: { code: string; message: string };
  intervals?: readonly { interval: string; status: string; error?: { code: string; message: string } }[];
};

function input(onRefresh: (ids: readonly string[]) => Promise<RefreshValue> | RefreshValue) {
  return {
    visible: true,
    scopeKey: "live|range",
    asOf: "2026-10-06T09:00:00.000Z",
    instruments: [{ instrumentId: "US:AAPL", market: "US" }],
    onRefresh,
    marketDataDailyStatuses: { "US:AAPL": "complete" },
    marketDataJobs: { "US:AAPL": { status: "complete" } },
    initialDataReady: true,
    historyInputReady: true,
  };
}

function historyInput(identity: string, fxSnapshot?: HoldingsHistoryWorkerInput["fxSnapshot"]): HoldingsHistoryWorkerInput {
  const scope = createDefaultRoomScope("2026-10-06");
  return {
    identity,
    entries: [],
    observationScope: scope,
    currentDayScope: scope,
    fxSnapshot,
  };
}

describe("useHoldingsValuationRefresh", () => {
  it("waits for the persisted cache and first exact history result before automatic refresh", async () => {
    const refresh = vi.fn(() => false);
    const hook = renderHook(({ initialDataReady, historyInputReady }: { initialDataReady: boolean; historyInputReady: boolean }) => useHoldingsValuationRefresh({
      ...input(refresh),
      initialDataReady,
      historyInputReady,
    }), { initialProps: { initialDataReady: false, historyInputReady: false } });
    await act(async () => { await Promise.resolve(); });
    expect(refresh).not.toHaveBeenCalled();

    hook.rerender({ initialDataReady: true, historyInputReady: false });
    await act(async () => { await Promise.resolve(); });
    expect(refresh).not.toHaveBeenCalled();

    hook.rerender({ initialDataReady: true, historyInputReady: true });
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledWith(["US:AAPL"], "automatic");
  });

  it("announces a manual refresh with no candidates without starting a provider request", async () => {
    const refresh = vi.fn(() => false);
    const hook = renderHook(({ scopeKey }: { scopeKey: string }) => useHoldingsValuationRefresh({
      ...input(refresh),
      scopeKey,
      instruments: [],
      scopeInstruments: [],
    }), { initialProps: { scopeKey: "live|range-a" } });
    await act(async () => { await Promise.resolve(); });

    act(() => hook.result.current.request());
    expect(refresh).not.toHaveBeenCalled();
    expect(hook.result.current.phase).toBe("idle");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.label).toBe("当前无需补齐行情");
    expect(hook.result.current.announcement).toBe("当前范围暂无需要补齐的行情。");

    hook.rerender({ scopeKey: "live|range-b" });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.announcement).toBeNull();
  });

  it("attempts once for a stable scope/session and allows a manual retry after busy", async () => {
    const refresh = vi.fn((ids: readonly string[]) => { void ids; return false; });
    const hook = renderHook(() => useHoldingsValuationRefresh(input(refresh)));
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.label).toContain("等待");

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("publishes an explicit durable failure as a finite retryable state", async () => {
    const refresh = vi.fn(() => ({ ok: false as const, reason: "failed" as const }));
    const hook = renderHook(() => useHoldingsValuationRefresh(input(refresh)));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("failed");
    expect(hook.result.current.active).toBe(false);
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not let a cancelled run overwrite its terminal state", async () => {
    let resolve!: (value: boolean) => void;
    const refresh = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const hook = renderHook(() => useHoldingsValuationRefresh(input(refresh)));
    await act(async () => { await Promise.resolve(); });
    act(() => hook.result.current.cancel());
    expect(hook.result.current.phase).toBe("cancelled");
    await act(async () => { resolve(true); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("cancelled");
  });

  it.each(["cancelled", "failed", "complete"] as const)("resets a terminal A %s state before an empty B scope can render it", async terminal => {
    const oldRequestedAt = "2026-10-06T09:00:00.000Z";
    const newRequestedAt = "2026-10-06T09:01:00.000Z";
    const before = historyInput(`terminal-before-${terminal}`);
    const after = historyInput(`terminal-after-${terminal}`);
    let resolveRefresh!: (value: boolean) => void;
    const refresh = vi.fn(() => {
      if (terminal === "cancelled") return new Promise<boolean>(resolve => { resolveRefresh = resolve; });
      if (terminal === "failed") return { ok: false as const, reason: "failed" as const };
      return {
        ok: true as const,
        requestedAtByInstrument: { "US:AAPL": newRequestedAt },
        dailyStatusByInstrument: { "US:AAPL": "complete" },
      };
    });
    const makeProps = (scopeKey: string, overrides: Partial<HoldingsValuationRefreshInput> = {}): HoldingsValuationRefreshInput => ({
      ...input(refresh),
      visible: false,
      scopeKey,
      historyCurrentInput: before,
      historyAcceptedInput: before,
      marketDataJobs: {
        "US:AAPL": {
          status: "complete",
          requestedAt: oldRequestedAt,
          intervals: [{ interval: "1D", status: "complete" }],
        },
      },
      ...overrides,
    });
    const hook = renderHook((props: HoldingsValuationRefreshInput) => useHoldingsValuationRefresh(props), {
      initialProps: makeProps("scope-a"),
    });

    act(() => hook.result.current.request());
    if (terminal === "cancelled") {
      await act(async () => { await Promise.resolve(); });
      act(() => hook.result.current.cancel());
    } else {
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      if (terminal === "complete") {
        hook.rerender(makeProps("scope-a", {
          historyCurrentInput: after,
          historyAcceptedInput: after,
          marketDataJobs: {
            "US:AAPL": {
              status: "complete",
              requestedAt: newRequestedAt,
              intervals: [{ interval: "1D", status: "complete" }],
            },
          },
        }));
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      }
    }
    expect(hook.result.current.phase).toBe(terminal);

    hook.rerender(makeProps("scope-b", {
      instruments: [],
      scopeInstruments: [],
      historyInputReady: false,
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("idle");
    expect(hook.result.current.active).toBe(false);
    if (terminal === "cancelled") {
      await act(async () => { resolveRefresh(true); await Promise.resolve(); });
      expect(hook.result.current.phase).toBe("idle");
    }
  });

  it("returns an interrupted B scope after cancelled A, ignores A late receipt, and permits an A retry after returning", async () => {
    let resolveA!: (value: RefreshValue) => void;
    let resolveRetry!: (value: RefreshValue) => void;
    let call = 0;
    const refresh = vi.fn(() => new Promise<RefreshValue>(resolve => {
      if (call++ === 0) resolveA = resolve;
      else resolveRetry = resolve;
    }));
    const onCancel = vi.fn();
    const makeProps = (scopeKey: string, overrides: Partial<HoldingsValuationRefreshInput> = {}): HoldingsValuationRefreshInput => ({
      ...input(refresh),
      visible: false,
      scopeKey,
      onCancel,
      ...overrides,
    });
    const interruptedJob = {
      status: "error",
      requestedAt: "2026-10-06T09:02:00.000Z",
      error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
      intervals: [{ interval: "1D", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } }],
    };
    const hook = renderHook((props: HoldingsValuationRefreshInput) => useHoldingsValuationRefresh(props), {
      initialProps: makeProps("scope-a"),
    });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.cancel());
    expect(hook.result.current.phase).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledWith(["US:AAPL"]);

    hook.rerender(makeProps("scope-b", {
      instruments: [{ instrumentId: "US:MSFT", market: "US" }],
      scopeInstruments: [{ instrumentId: "US:MSFT", market: "US" }],
      historyInputReady: false,
      marketDataDailyStatuses: { "US:MSFT": "error" },
      marketDataJobs: { "US:MSFT": interruptedJob },
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("interrupted");
    expect(hook.result.current.active).toBe(false);

    await act(async () => { resolveA(true); await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("interrupted");

    hook.rerender(makeProps("scope-a", {
      historyInputReady: true,
      marketDataJobs: { "US:AAPL": { status: "complete" } },
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("idle");

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(hook.result.current.phase).toBe("waiting");
    await act(async () => { resolveRetry({ ok: false, reason: "cancelled" }); await Promise.resolve(); });
  });

  it("keeps a same-instrument B request honest when it joins A's already-started cancelled task", async () => {
    let resolveA!: (value: RefreshValue) => void;
    let resolveRetry!: (value: RefreshValue) => void;
    let calls = 0;
    const refresh = vi.fn((ids: readonly string[]) => {
      void ids;
      return new Promise<RefreshValue>(resolve => {
        if (calls++ === 0) resolveA = resolve;
        else resolveRetry = resolve;
      });
    });
    const onCancel = vi.fn();
    const makeProps = (scopeKey: string): HoldingsValuationRefreshInput => ({
      ...input(refresh),
      visible: false,
      scopeKey,
      onCancel,
    });
    const hook = renderHook((props: HoldingsValuationRefreshInput) => useHoldingsValuationRefresh(props), {
      initialProps: makeProps("scope-a"),
    });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0]?.[0]).toEqual(["US:AAPL"]);
    expect(hook.result.current.phase).toBe("waiting");

    act(() => hook.result.current.cancel());
    expect(hook.result.current.phase).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(["US:AAPL"]);

    hook.rerender(makeProps("scope-b"));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("idle");
    expect(hook.result.current.announcement).toBeNull();

    // The original producer is already started, so coalescer ownership is
    // shared even though A's public cancellation has fired. B must expose that
    // shared waiting state without pretending a second provider call started.
    act(() => hook.result.current.request());
    expect(hook.result.current.phase).toBe("waiting");
    expect(hook.result.current.active).toBe(true);
    expect(hook.result.current.announcement).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => { resolveA(false); await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hook.result.current.phase).toBe("waiting");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.announcement).toBe("其他页面正在更新行情，请稍后手动重试。");

    // The public retry is the explicit recovery path after the shared task
    // reports its cancellation; it creates a fresh runner invocation.
    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh.mock.calls[1]?.[0]).toEqual(["US:AAPL"]);
    expect(hook.result.current.phase).toBe("waiting");
    expect(hook.result.current.active).toBe(true);
    await act(async () => { resolveRetry({ ok: false, reason: "cancelled" }); await Promise.resolve(); });
  });

  it("attempts a newly eligible historical candidate once after the initial current subset", async () => {
    const refresh = vi.fn((ids: readonly string[]) => { void ids; return false; });
    let candidate = [{ instrumentId: "US:AAPL", market: "US" }];
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: candidate,
      scopeInstruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
    }));
    await act(async () => { await Promise.resolve(); });
    candidate = [{ instrumentId: "US:MSFT", market: "US" }];
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL"], ["US:MSFT"]]);
  });

  it("merges candidate expansions while the current automatic run is unsettled", async () => {
    let resolveFirst!: (value: boolean) => void;
    const refresh = vi.fn((ids: readonly string[]) => {
      if (ids.includes("US:AAPL")) return new Promise<boolean>(resolve => { resolveFirst = resolve; });
      return false;
    });
    let candidates = [{ instrumentId: "US:AAPL", market: "US" }];
    const scope = [
      { instrumentId: "US:AAPL", market: "US" },
      { instrumentId: "US:MSFT", market: "US" },
      { instrumentId: "US:NVDA", market: "US" },
    ];
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: candidates,
      scopeInstruments: scope,
    }));
    await act(async () => { await Promise.resolve(); });
    candidates = [
      { instrumentId: "US:AAPL", market: "US" },
      { instrumentId: "US:MSFT", market: "US" },
    ];
    hook.rerender();
    candidates = scope;
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL"]]);

    await act(async () => {
      resolveFirst(false);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL"], ["US:MSFT", "US:NVDA"]]);
  });

  it("does not retry an automatically attempted id after cancellation, while manual retry remains available", async () => {
    let resolveFirst!: (value: boolean) => void;
    const refresh = vi.fn((ids: readonly string[]) => {
      if (ids.includes("US:AAPL")) return new Promise<boolean>(resolve => { resolveFirst = resolve; });
      return false;
    });
    let candidates = [{ instrumentId: "US:AAPL", market: "US" }];
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: candidates,
      scopeInstruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
    }));
    await act(async () => { await Promise.resolve(); });
    candidates = [
      { instrumentId: "US:AAPL", market: "US" },
      { instrumentId: "US:MSFT", market: "US" },
    ];
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    act(() => hook.result.current.cancel());
    expect(hook.result.current.phase).toBe("cancelled");
    await act(async () => {
      resolveFirst(true);
      await Promise.resolve();
    });
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL"]]);
    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL"], ["US:AAPL", "US:MSFT"]]);
  });

  it("restarts the automatic candidate set for a new scope/session key", async () => {
    const refresh = vi.fn(() => false);
    let scopeKey = "live|range-a";
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      scopeKey,
    }));
    await act(async () => { await Promise.resolve(); });
    scopeKey = "live|range-b";
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not repeat an already attempted id when the candidate set shrinks", async () => {
    const refresh = vi.fn((ids: readonly string[]) => { void ids; return false; });
    const scope = [
      { instrumentId: "US:AAPL", market: "US" },
      { instrumentId: "US:MSFT", market: "US" },
    ];
    let candidates = [
      { instrumentId: "US:AAPL", market: "US" },
      { instrumentId: "US:MSFT", market: "US" },
    ];
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: candidates,
      scopeInstruments: scope,
    }));
    await act(async () => { await Promise.resolve(); });
    candidates = [{ instrumentId: "US:AAPL", market: "US" }];
    hook.rerender();
    await act(async () => { await Promise.resolve(); });
    expect(refresh.mock.calls.map(([ids]) => ids)).toEqual([["US:AAPL", "US:MSFT"]]);
  });

  it("does not complete from the old durable job, then accepts the new job evidence", async () => {
    const refresh = vi.fn(() => true);
    const hook = renderHook((job: { status: string; requestedAt?: string }) => useHoldingsValuationRefresh({
      ...input(refresh),
      marketDataJobs: { "US:AAPL": job },
    }), { initialProps: { status: "complete", requestedAt: "2026-01-01T00:00:00.000Z" } });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("downloading");
    hook.rerender({ status: "complete", requestedAt: new Date(Date.now() + 1000).toISOString() });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("complete");
  });

  it("keeps an unknown durable outcome non-terminal", async () => {
    const refresh = vi.fn(() => true);
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      marketDataJobs: {
        "US:AAPL": { status: "unknown", requestedAt: new Date(Date.now() + 1000).toISOString() },
      },
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("downloading");
  });

  it("requires a new exact history input acknowledgement after the request starts", async () => {
    const refresh = vi.fn(() => true);
    const accepted = historyInput("before");
    const current = historyInput("before");
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput, requestedAt }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
      requestedAt: string;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      historyCurrentInput,
      historyAcceptedInput,
      marketDataJobs: { "US:AAPL": { status: "complete", requestedAt } },
    }), { initialProps: { historyCurrentInput: current, historyAcceptedInput: accepted, requestedAt: "2026-01-01T00:00:00.000Z" } });
    await act(async () => { await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: current, historyAcceptedInput: accepted, requestedAt: "2026-01-01T00:00:00.000Z" });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("downloading");
    const next = historyInput("after");
    hook.rerender({ historyCurrentInput: next, historyAcceptedInput: next, requestedAt: "2099-01-01T00:00:00.000Z" });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("complete");
  });

  it("treats a per-currency publication correction as new published data", async () => {
    const publicationSnapshot = (publishedAtByCurrency: Readonly<Record<string, string>>) => ({
      id: "fx:publication",
      baseCurrency: "CNY" as const,
      asOf: "2026-10-15",
      source: "BOC",
      status: "complete" as const,
      rates: { "USD/CNY": "7" },
      publishedAt: "2026-10-14",
      publishedAtByCurrency,
      fetchedAt: "2026-10-15T03:00:00.000Z",
    });
    const refresh = vi.fn(() => true);
    const before = historyInput("before", publicationSnapshot({ USD: "2026-10-14" }));
    const after = {
      ...before,
      identity: "after",
      fxSnapshot: publicationSnapshot({ USD: "2026-10-15" }),
    };
    expect(after.entries).toBe(before.entries);
    expect(after.candlesByInstrument).toBe(before.candlesByInstrument);
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput, requestedAt }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
      requestedAt: string;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      historyCurrentInput,
      historyAcceptedInput,
      marketDataJobs: { "US:AAPL": { status: "complete", requestedAt } },
    }), {
      initialProps: {
        historyCurrentInput: before,
        historyAcceptedInput: before,
        requestedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    hook.rerender({
      historyCurrentInput: after,
      historyAcceptedInput: after,
      requestedAt: "2099-01-01T00:00:00.000Z",
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("complete");
  });

  it("does not publish a map-order or retry-metadata-only FX change", async () => {
    const before = historyInput("before", {
      id: "fx:publication",
      baseCurrency: "CNY",
      asOf: "2026-10-15",
      source: "BOC",
      status: "complete",
      rates: { "HKD/CNY": "0.9", "USD/CNY": "7" },
      publishedAt: "2026-10-14",
      publishedAtByCurrency: { HKD: "2026-10-14", USD: "2026-10-14" },
      fetchedAt: "2026-10-15T03:00:00.000Z",
      lastAttemptDay: "2026-10-15",
      error: null,
    });
    const after = {
      ...before,
      identity: "after",
      fxSnapshot: {
        ...before.fxSnapshot!,
        rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
        publishedAtByCurrency: { USD: "2026-10-14", HKD: "2026-10-14" },
        fetchedAt: "2026-10-15T04:00:00.000Z",
        lastAttemptDay: "2026-10-16",
        error: "provider unavailable",
      },
    };
    expect(after.entries).toBe(before.entries);
    expect(after.candlesByInstrument).toBe(before.candlesByInstrument);
    expect(after.fxSnapshot?.asOf).toBe(before.fxSnapshot?.asOf);
    expect(after.fxSnapshot?.publishedAt).toBe(before.fxSnapshot?.publishedAt);

    const refresh = vi.fn(() => true);
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput, requestedAt }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
      requestedAt: string;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      historyCurrentInput,
      historyAcceptedInput,
      marketDataJobs: { "US:AAPL": { status: "complete", requestedAt } },
    }), {
      initialProps: {
        historyCurrentInput: before,
        historyAcceptedInput: before,
        requestedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    hook.rerender({
      historyCurrentInput: after,
      historyAcceptedInput: after,
      requestedAt: "2099-01-01T00:00:00.000Z",
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("failed");
    expect(hook.result.current.announcement).toContain("没有新的可用数据");
  });

  it("ends an exact as-of-only refresh as failed instead of publishing a clock-only bundle", async () => {
    const refresh = vi.fn(() => true);
    const baseline = historyInput("before");
    const next = { ...baseline, identity: "after", asOf: "2026-10-06T09:01:00.000Z" };
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput, requestedAt }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
      requestedAt?: string;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      historyCurrentInput,
      historyAcceptedInput,
      marketDataJobs: { "US:AAPL": { status: "complete", requestedAt } },
    }), {
      initialProps: {
        historyCurrentInput: baseline,
        historyAcceptedInput: baseline,
        requestedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: next, historyAcceptedInput: next, requestedAt: "2099-01-01T00:00:00.000Z" });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("failed");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.announcement).toContain("没有新的可用数据");
  });

  it("does not let an old scope receipt settle the new scope", async () => {
    let resolveA!: (value: boolean) => void;
    let resolveB!: (value: boolean) => void;
    const refresh = vi.fn((ids: readonly string[]) => new Promise<boolean>(resolve => {
      if (ids.includes("US:AAPL")) resolveA = resolve;
      else resolveB = resolve;
    }));
    const scopeInput = (scopeKey: string, instrumentId: string) => ({
      ...input(refresh),
      scopeKey,
      instruments: [{ instrumentId, market: "US" }],
      scopeInstruments: [{ instrumentId, market: "US" }],
      marketDataDailyStatuses: { [instrumentId]: "complete" },
      marketDataJobs: { [instrumentId]: { status: "complete" } },
    });
    const hook = renderHook(({ scopeKey, instrumentId }: { scopeKey: string; instrumentId: string }) => useHoldingsValuationRefresh(scopeInput(scopeKey, instrumentId)), {
      initialProps: { scopeKey: "scope-a", instrumentId: "US:AAPL" },
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledWith(["US:AAPL"], "automatic");

    hook.rerender({ scopeKey: "scope-b", instrumentId: "US:MSFT" });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("waiting");

    await act(async () => { resolveA(true); await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledWith(["US:MSFT"], "automatic");
    expect(hook.result.current.phase).toBe("waiting");

    resolveB(true);
  });

  it("accepts an active shared run receipt even when its requestedAt equals the baseline job", async () => {
    const current = historyInput("before");
    const next = historyInput("after");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": "2026-01-01T00:00:00.000Z" },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      historyCurrentInput,
      historyAcceptedInput,
      marketDataJobs: { "US:AAPL": { status: "partial", requestedAt: "2026-01-01T00:00:00.000Z", intervals: [{ interval: "1D", status: "complete" }] } },
      marketDataDailyStatuses: { "US:AAPL": "complete" },
    }), { initialProps: { historyCurrentInput: current, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });
    await act(async () => { await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: next, historyAcceptedInput: next });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("complete");
  });

  it("accepts an owned daily receipt when the aggregate job only reports an unrequested intraday interval", async () => {
    const requestedAt = "2026-10-06T09:01:00.000Z";
    const before = historyInput("before");
    const after = historyInput("after");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": "partial" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "partial" },
      marketDataJobs: {
        "US:AAPL": {
          status: "not-requested",
          requestedAt,
          intervals: [
            { interval: "1D", status: "partial" },
            { interval: "1h", status: "not-requested" },
          ],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("partial");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.label).toBe("部分行情未更新");
    expect(hook.result.current.detail).toBe("估值基于可用行情");
    expect(hook.result.current.announcement).toBeNull();
  });

  it("accepts an owned complete daily receipt when the aggregate job only reports an unrequested intraday interval", async () => {
    const requestedAt = "2026-10-06T09:02:00.000Z";
    const before = historyInput("before-complete");
    const after = historyInput("after-complete");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "not-requested",
          requestedAt,
          intervals: [
            { interval: "1D", status: "complete" },
            { interval: "1h", status: "not-requested" },
          ],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("complete");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.announcement).toBeNull();
  });

  it.each(["syncing", "not-requested"] as const)("keeps an actual 1D %s result pending even when it has no usable daily receipt", async dailyStatus => {
    const requestedAt = "2026-10-06T09:03:00.000Z";
    const before = historyInput("before-" + dailyStatus);
    const after = historyInput("after-" + dailyStatus);
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": dailyStatus },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": dailyStatus },
      marketDataJobs: {
        "US:AAPL": {
          status: dailyStatus,
          requestedAt,
          intervals: [
            { interval: "1D", status: dailyStatus },
            { interval: "1h", status: "not-requested" },
          ],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("downloading");
    expect(hook.result.current.active).toBe(true);
  });

  it("keeps an older durable job pending while waiting for its owned daily receipt", async () => {
    const receiptAt = "2026-10-06T09:04:00.000Z";
    const oldJobAt = "2026-10-06T09:03:00.000Z";
    const before = historyInput("before-older-job");
    const after = historyInput("after-older-job");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": receiptAt },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "complete",
          requestedAt: oldJobAt,
          intervals: [{ interval: "1D", status: "complete" }],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("downloading");
    expect(hook.result.current.active).toBe(true);
  });

  it.each(["syncing", "not-requested"] as const)("keeps a receipt pending when the durable 1D interval is %s", async dailyIntervalStatus => {
    const receiptAt = "2026-10-06T09:04:30.000Z";
    const before = historyInput("before-daily-interval-pending-" + dailyIntervalStatus);
    const after = historyInput("after-daily-interval-pending-" + dailyIntervalStatus);
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": receiptAt },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "not-requested",
          requestedAt: receiptAt,
          intervals: [
            { interval: "1D", status: dailyIntervalStatus },
            { interval: "1h", status: "not-requested" },
          ],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("downloading");
    expect(hook.result.current.active).toBe(true);
  });

  it("keeps an unparseable current job mismatch pending instead of treating it as superseded", async () => {
    const receiptAt = "2026-10-06T09:04:45.000Z";
    const before = historyInput("before-unparseable-job");
    const after = historyInput("after-unparseable-job");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": receiptAt },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyCurrentInput, historyAcceptedInput }: {
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "complete",
          requestedAt: "not-a-date",
          intervals: [{ interval: "1D", status: "complete" }],
        },
      },
    }), { initialProps: { historyCurrentInput: before, historyAcceptedInput: null as HoldingsHistoryWorkerInput | null } });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({ historyCurrentInput: after, historyAcceptedInput: after });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("downloading");
    expect(hook.result.current.active).toBe(true);
  });

  it("fails the batch when one job is superseded even if another newer job is still pending at 1D", async () => {
    const receiptAt = "2026-10-06T09:04:50.000Z";
    const newerJobAt = "2026-10-06T09:05:00.000Z";
    const before = historyInput("before-mixed-supersession");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": receiptAt, "US:MSFT": receiptAt },
      dailyStatusByInstrument: { "US:AAPL": "complete", "US:MSFT": "complete" },
    }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyPending: true,
      historyCurrentInput: before,
      historyAcceptedInput: null,
      instruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      scopeInstruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      marketDataDailyStatuses: { "US:AAPL": "complete", "US:MSFT": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "complete",
          requestedAt: newerJobAt,
          intervals: [{ interval: "1D", status: "complete" }],
        },
        "US:MSFT": {
          status: "syncing",
          requestedAt: newerJobAt,
          intervals: [{ interval: "1D", status: "syncing" }],
        },
      },
    }));

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("failed");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.announcement).toContain("重试");
  });

  it("fails finitely and permits manual retry when a newer terminal job supersedes the owned receipt", async () => {
    const receiptAt = "2026-10-06T09:05:00.000Z";
    const newerJobAt = "2026-10-06T09:06:00.000Z";
    const oldJobAt = "2026-10-06T09:04:00.000Z";
    const before = historyInput("before-superseded-job");
    const after = historyInput("after-superseded-job");
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": receiptAt },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(({ historyPending, historyCurrentInput, historyAcceptedInput, requestedAt }: {
      historyPending: boolean;
      historyCurrentInput: HoldingsHistoryWorkerInput;
      historyAcceptedInput: HoldingsHistoryWorkerInput | null;
      requestedAt: string;
    }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      historyPending,
      historyCurrentInput,
      historyAcceptedInput,
      marketDataDailyStatuses: { "US:AAPL": "complete" },
      marketDataJobs: {
        "US:AAPL": {
          status: "complete",
          requestedAt,
          intervals: [{ interval: "1D", status: "complete" }],
        },
      },
    }), {
      initialProps: {
        historyPending: true,
        historyCurrentInput: before,
        historyAcceptedInput: null,
        requestedAt: oldJobAt,
      },
    });

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    hook.rerender({
      historyPending: true,
      historyCurrentInput: after,
      historyAcceptedInput: null,
      requestedAt: newerJobAt,
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(hook.result.current.phase).toBe("failed");
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.announcement).toContain("重试");

    act(() => hook.result.current.request());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps the recompute phase while the producer receipt is still marked running", async () => {
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": "2026-10-06T09:01:00.000Z" },
      dailyStatusByInstrument: { "US:AAPL": "complete" },
    }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      historyPending: true,
      marketDataRefresh: { running: true, total: 1, completed: 0, processed: 0, partial: 0, failed: 0 },
    }));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("recomputing");
    expect(hook.result.current.label).toBe("正在更新估值");
    expect(hook.result.current.detail).toBe("正在重算持仓历史");
  });

  it("reopens a durable 1D interruption, then clears it for a manual retry receipt", async () => {
    let resolveRefresh!: (value: HoldingsRefreshReceipt) => void;
    const refresh = vi.fn(() => new Promise<HoldingsRefreshReceipt>(resolve => { resolveRefresh = resolve; }));
    const interruptedJob: RefreshJob = {
      status: "error",
      requestedAt: "2026-10-05T09:00:00.000Z",
      error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
      intervals: [{ interval: "1D", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } }],
    };
    const hook = renderHook(({ job }: { job: RefreshJob }) => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      marketDataJobs: { "US:AAPL": job },
    }), { initialProps: { job: interruptedJob } });

    expect(hook.result.current.phase).toBe("interrupted");
    expect(hook.result.current.label).toContain("中断");
    act(() => hook.result.current.request());
    expect(hook.result.current.phase).toBe("waiting");
    expect(hook.result.current.announcement).toContain("重新补齐");
    await act(async () => { await Promise.resolve(); });
    const requestedAt = "2026-10-06T09:01:00.000Z";
    await act(async () => {
      resolveRefresh({ ok: true, requestedAtByInstrument: { "US:AAPL": requestedAt }, dailyStatusByInstrument: { "US:AAPL": "complete" } });
      await Promise.resolve();
    });
    expect(hook.result.current.phase).toBe("downloading");
    hook.rerender({ job: { status: "complete", requestedAt, intervals: [{ interval: "1D", status: "complete" }] } });
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("complete");
    expect(hook.result.current.announcement).toBeNull();
  });

  it("automatically retries an interrupted scoped job through the live waiting phase", async () => {
    let resolveRefresh!: (value: boolean) => void;
    const refresh = vi.fn(() => new Promise<boolean>(resolve => { resolveRefresh = resolve; }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      marketDataJobs: {
        "US:AAPL": {
          status: "error",
          requestedAt: "2026-10-05T09:00:00.000Z",
          error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
          intervals: [{ interval: "1D", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } }],
        },
      },
    }));
    await act(async () => { await Promise.resolve(); });
    expect(refresh).toHaveBeenCalledWith(["US:AAPL"], "automatic");
    expect(hook.result.current.phase).toBe("waiting");
    expect(hook.result.current.announcement).toContain("重新补齐");
    await act(async () => { resolveRefresh(false); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("waiting");
  });

  it("only exposes interruption evidence for the scoped instrument's incomplete 1D interval", () => {
    const refresh = vi.fn(() => false);
    const unrelated = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      marketDataJobs: {
        "US:OTHER": {
          status: "error",
          requestedAt: "2026-10-05T09:00:00.000Z",
          error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
          intervals: [{ interval: "1D", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } }],
        },
      },
    }));
    expect(unrelated.result.current.phase).toBe("idle");

    const completeDaily = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      marketDataJobs: {
        "US:AAPL": {
          status: "error",
          requestedAt: "2026-10-05T09:00:00.000Z",
          error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
          intervals: [
            { interval: "1D", status: "complete" },
            { interval: "1h", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } },
          ],
        },
      },
    }));
    expect(completeDaily.result.current.phase).toBe("idle");

    for (const dailyStatus of ["partial", "latest-available", "stale", "ready"]) {
      const settledDaily = renderHook(() => useHoldingsValuationRefresh({
        ...input(refresh),
        visible: false,
        marketDataJobs: {
          "US:AAPL": {
            status: "error",
            requestedAt: "2026-10-05T09:00:00.000Z",
            error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
            intervals: [
              { interval: "1D", status: dailyStatus },
              { interval: "1h", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } },
            ],
          },
        },
      }));
      expect(settledDaily.result.current.phase).toBe("idle");
    }

    const genericDailyError = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      marketDataJobs: {
        "US:AAPL": {
          status: "error",
          requestedAt: "2026-10-05T09:00:00.000Z",
          error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" },
          intervals: [
            { interval: "1D", status: "error", error: { code: "source-unavailable", message: "供应商暂不可用" } },
            { interval: "1h", status: "error", error: { code: "market-data-job-interrupted", message: "上次行情更新被中断，请重试。" } },
          ],
        },
      },
    }));
    expect(genericDailyError.result.current.phase).toBe("idle");
  });

  it("does not reopen settled daily data when stale recovery interrupts only intraday", () => {
    const recovered = recoverStaleMarketDataJob({
      instrumentId: "US:AAPL",
      symbol: "AAPL",
      market: "US",
      requestedAt: "2026-10-05T09:00:00.000Z",
      status: "syncing",
      intervals: [
        { interval: "1D", status: "partial" },
        { interval: "1h", status: "syncing" },
      ],
    } satisfies MarketDataJob, new Date("2026-10-05T09:10:00.000Z"));
    expect(recovered).toMatchObject({
      status: "error",
      error: { code: "market-data-job-interrupted" },
      intervals: [
        { interval: "1D", status: "partial" },
        { interval: "1h", status: "error", error: { code: "market-data-job-interrupted" } },
      ],
    });
    const refresh = vi.fn(() => false);
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      visible: false,
      marketDataJobs: { "US:AAPL": recovered },
    }));
    expect(hook.result.current.phase).toBe("idle");
  });

  it("publishes a partial terminal state when one instrument succeeds and another fails", async () => {
    const requestedAt = "2026-10-06T09:01:00.000Z";
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt, "US:MSFT": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": "complete", "US:MSFT": "error" },
    }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      scopeInstruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      marketDataDailyStatuses: { "US:AAPL": "complete", "US:MSFT": "error" },
      marketDataJobs: {
        "US:AAPL": { status: "complete", requestedAt },
        "US:MSFT": { status: "error", requestedAt },
      },
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("partial");
  });

  it("keeps an all-failed terminal state failed so the previous accepted result can remain", async () => {
    const requestedAt = "2026-10-06T09:01:00.000Z";
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt, "US:MSFT": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": "error", "US:MSFT": "source-unavailable" },
    }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      instruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      scopeInstruments: [
        { instrumentId: "US:AAPL", market: "US" },
        { instrumentId: "US:MSFT", market: "US" },
      ],
      marketDataDailyStatuses: { "US:AAPL": "error", "US:MSFT": "source-unavailable" },
      marketDataJobs: {
        "US:AAPL": { status: "error", requestedAt },
        "US:MSFT": { status: "error", requestedAt },
      },
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("failed");
  });

  it("treats missing provider coverage as a terminal failure", async () => {
    const requestedAt = "2026-10-06T09:01:00.000Z";
    const refresh = vi.fn(() => ({
      ok: true as const,
      requestedAtByInstrument: { "US:AAPL": requestedAt },
      dailyStatusByInstrument: { "US:AAPL": "needs-provider" },
    }));
    const hook = renderHook(() => useHoldingsValuationRefresh({
      ...input(refresh),
      marketDataDailyStatuses: { "US:AAPL": "needs-provider" },
      marketDataJobs: { "US:AAPL": { status: "needs-provider", requestedAt } },
    }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.phase).toBe("failed");
  });
});
