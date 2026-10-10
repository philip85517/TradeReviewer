import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultRoomScope } from "../../lib/reviews/trading-room-scope";
import type { HoldingsHistoryWorkerInput } from "../../lib/reviews/holdings-history-worker";
import { recoverStaleMarketDataJob } from "../../lib/market/market-data-job-recovery";
import type { MarketDataJob } from "../../lib/storage/market-data-jobs";
import {
  useHoldingsValuationRefresh,
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
  };
}

function historyInput(identity: string): HoldingsHistoryWorkerInput {
  const scope = createDefaultRoomScope("2026-10-06");
  return {
    identity,
    entries: [],
    observationScope: scope,
    currentDayScope: scope,
  };
}

describe("useHoldingsValuationRefresh", () => {
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
});
