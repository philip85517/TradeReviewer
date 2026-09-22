import "fake-indexeddb/auto";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { MarketDataJob } from "../lib/storage/market-data-jobs";
import { saveMarketDataJob } from "../lib/storage/market-data-jobs";
import type { SqliteHttpClient } from "../lib/storage/sqlite-http-client";
import { saveImportedExecutions } from "../lib/storage/import-library";
import type { TradeExecution } from "../lib/trades/types";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import { TradeReviewWorkspace } from "./trade-review-workspace";

const refreshMocks = vi.hoisted(() => ({
  daily: vi.fn(),
  intraday: vi.fn(),
}));

let restoreNavigatorLocks: (() => void) | undefined;

vi.mock("../lib/market/sync-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/market/sync-service")>();
  return {
    ...actual,
    syncMarketData: (...args: Parameters<typeof actual.syncMarketData>) =>
      refreshMocks.daily(...args),
  };
});

vi.mock("../lib/market/intraday-sync-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/market/intraday-sync-service")>();
  return {
    ...actual,
    syncIntradayMarketDataForRanges: (...args: Parameters<typeof actual.syncIntradayMarketDataForRanges>) =>
      refreshMocks.intraday(...args),
  };
});

vi.mock("../lib/instruments/resolve-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/instruments/resolve-service")>();
  return {
    ...actual,
    refreshInstrumentMetadata: vi.fn().mockResolvedValue(undefined),
  };
});

const initialFrame: DemoReplayFrame = {
  cursorIndex: 0,
  cursor: "2025-01-02T14:30:00.000Z",
  candles15m: [
    {
      time: "2025-01-02T14:30:00.000Z",
      open: 10,
      high: 10.2,
      low: 9.9,
      close: 10.1,
      volume: 1_000,
    },
  ],
  executions: [],
  canGoBack: false,
  canGoForward: false,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function refreshExecution(): TradeExecution {
  return {
    id: "refresh-fixture-buy",
    source: { platform: "futu", row: 1 },
    accountId: "refresh-account",
    accountLabel: "测试账户",
    instrument: {
      id: "US:REFRESH",
      symbol: "REFRESH",
      name: "刷新测试标的",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2025-01-02T14:30:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
  };
}

function refreshExecutionFor(symbol: string): TradeExecution {
  const base = refreshExecution();
  return {
    ...base,
    id: `refresh-fixture-${symbol}`,
    instrument: {
      ...base.instrument,
      id: `US:${symbol}`,
      symbol,
      name: `刷新测试 ${symbol}`,
    },
  };
}

function unfinishedJob(instrumentId: string, symbol: string): MarketDataJob {
  return {
    instrumentId,
    symbol,
    market: "US",
    requestedAt: "2026-09-15T00:00:00.000Z",
    status: "not-requested",
    intervals: [
      { interval: "1D", status: "not-requested" },
      { interval: "1h", status: "not-requested" },
    ],
  };
}

function validMetadataResponse(input: RequestInfo | URL) {
  if (!String(input).includes("/api/instruments/resolve")) {
    return Response.json({});
  }
  return Response.json({
    market: "US",
    symbol: "REFRESH",
    name: "刷新测试标的",
    assetType: "stock",
    source: "nasdaq",
    confidence: "official",
    resolvedAt: "2026-09-15T00:00:00.000Z",
  });
}

async function openDefaultStockRound(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "交易库" }));
  const stockToggle = await screen.findByRole("button", { name: /^(展开|收起).*交易回合$/ });
  if (stockToggle.getAttribute("aria-expanded") !== "true") await user.click(stockToggle);
  await user.click(await screen.findByRole("button", { name: /^打开.*第1次交易/ }));
}

describe("TradeReviewWorkspace global refresh seam", () => {
  beforeEach(async () => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.removeItem("trade-reviewer:market-data-jobs:v1");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    saveImportedExecutions([refreshExecution()]);
    vi.stubGlobal("fetch", vi.fn(async (input) => validMetadataResponse(input)));
  });

  afterEach(() => {
    restoreNavigatorLocks?.();
    restoreNavigatorLocks = undefined;
    cleanup();
    vi.restoreAllMocks();
  });

  async function openDataManagement() {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "数据管理" }));
    await screen.findByRole("region", { name: "数据管理" });
    return user;
  }

  it("cancels a running batch, persists a terminal job, and waits before the next batch", async () => {
    const providerGate = deferred<void>();
    const restoreGate = deferred<MarketDataJob>();
    const baseClient = createLegacySqliteClient();
    const persistedJobs: MarketDataJob[] = [];
    let holdRestore = true;
    const putMarketDataJob = vi.fn(async (job: MarketDataJob) => {
      persistedJobs.push(job);
      await baseClient.putMarketDataJob(job);
      if (holdRestore && job.status !== "syncing") {
        await restoreGate.promise;
      }
      return job;
    });
    const storageClient = {
      ...baseClient,
      putMarketDataJob,
    } as SqliteHttpClient;

    refreshMocks.daily.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        await providerGate.promise;
        if (signal?.aborted) throw signal.reason;
        return {
          source: "network" as const,
          status: "complete" as const,
          candles: [],
          requestedRanges: [],
        };
      },
    );
    refreshMocks.intraday.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        await providerGate.promise;
        if (signal?.aborted) throw signal.reason;
        return {
          source: "network" as const,
          status: "complete" as const,
          candles: [],
          coverage: [],
          requestedRanges: [],
        };
      },
    );

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={storageClient}
      />,
    );

    const user = await openDataManagement();
    const updateButton = await screen.findByRole("button", {
      name: "更新全部数据",
    });
    await user.click(updateButton);
    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledOnce();
      expect(refreshMocks.intraday).toHaveBeenCalledOnce();
    });

    await user.click(
      screen.getByRole("button", { name: "取消全部行情更新" }),
    );
    providerGate.resolve();

    await waitFor(() =>
      expect(
        persistedJobs.some((job) => job.status !== "syncing"),
      ).toBe(true),
    );
    expect(
      screen.getByRole("button", { name: "正在更新全部行情" }),
    ).toBeDisabled();
    const cancelledJob = persistedJobs.find((job) => job.status !== "syncing");
    expect(cancelledJob).toBeDefined();

    holdRestore = false;
    restoreGate.resolve(cancelledJob!);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "更新全部数据" }),
      ).toBeEnabled(),
    );
    expect(screen.getByText(/已取消/)).toBeInTheDocument();
    expect(screen.getByText("未完成 1 个标的")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "恢复未完成行情" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "更新全部数据" }));
    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledTimes(2);
      expect(refreshMocks.intraday).toHaveBeenCalledTimes(2);
    });
    await waitFor(() =>
      expect(persistedJobs.at(-1)?.status).toBe("complete"),
    );

    const terminalJobs = persistedJobs.filter((job) => job.status !== "syncing");
    expect(terminalJobs).toHaveLength(2);
    expect(terminalJobs.at(-1)?.status).toBe("complete");
    expect(
      screen.queryByRole("button", { name: "正在更新全部行情" }),
    ).not.toBeInTheDocument();
  });

  it("restores saved result and failure details without starting provider work", async () => {
    saveMarketDataJob({
      instrumentId: "US:REFRESH",
      symbol: "REFRESH",
      market: "US",
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "partial",
      intervals: [
        { interval: "1D", status: "complete" },
        {
          interval: "1h",
          status: "source-unavailable",
          message: "小时线源暂不可用",
          coverageStart: "2026-09-14T01:00:00.000Z",
          coverageEnd: "2026-09-15T01:00:00.000Z",
          error: {
            code: "source-unavailable",
            message: "小时线源暂不可用",
          },
        },
      ],
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    await openDataManagement();
    expect(await screen.findByText(/已保存行情状态/)).toBeVisible();
    expect(screen.getByText("更新完成 0 个标的")).toBeVisible();
    expect(screen.getByText("部分可用 1 个标的")).toBeVisible();
    expect(screen.getByText("更新失败 0 个标的")).toBeVisible();
    expect(screen.getByText("待重试 1 个标的")).toBeVisible();
    expect(refreshMocks.daily).not.toHaveBeenCalled();
    expect(refreshMocks.intraday).not.toHaveBeenCalled();

    await userEvent.setup().click(
      screen.getByText(/查看失败明细/),
    );
    expect(
      screen.getByText(/最近尝试：2026年09月15日 08:00:00/),
    ).toBeVisible();
    expect(
      screen.getByText(/2026-09-14T01:00:00.000Z 至 2026-09-15T01:00:00.000Z/),
    ).toBeVisible();
    expect(screen.getByText(/小时线源暂不可用/)).toBeVisible();
  });

  it("reports an unavailable refresh lock without treating the old terminal job as a new run", async () => {
    saveMarketDataJob({
      instrumentId: "US:REFRESH",
      symbol: "REFRESH",
      market: "US",
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "complete",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "complete" },
      ],
    });
    const previousLocks = Object.getOwnPropertyDescriptor(window.navigator, "locks");
    const request = vi.fn(async (_name: string, _options: unknown, callback: (lock: null) => unknown) => callback(null));
    Object.defineProperty(window.navigator, "locks", {
      configurable: true,
      value: { request },
    });
    restoreNavigatorLocks = () => {
      if (previousLocks) Object.defineProperty(window.navigator, "locks", previousLocks);
      else Reflect.deleteProperty(window.navigator, "locks");
    };

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    const user = await openDataManagement();
    await user.click(screen.getByRole("button", { name: "更新全部数据" }));

    expect(request).toHaveBeenCalledOnce();
    expect(refreshMocks.daily).not.toHaveBeenCalled();
    expect(refreshMocks.intraday).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert", { name: "数据管理提示" })).toHaveTextContent("其他页面正在更新行情，请稍后再试。");
  });

  it("refreshes the global saved summary after a single instrument update", async () => {
    const user = userEvent.setup();
    saveMarketDataJob({
      instrumentId: "US:REFRESH",
      symbol: "REFRESH",
      market: "US",
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "partial",
      intervals: [
        { interval: "1D", status: "complete" },
        {
          interval: "1h",
          status: "source-unavailable",
          message: "小时线源暂不可用",
          error: {
            code: "source-unavailable",
            message: "小时线源暂不可用",
          },
        },
      ],
    });
    refreshMocks.daily.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      requestedRanges: [],
    });
    refreshMocks.intraday.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      coverage: [],
      requestedRanges: [],
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    await openDataManagement();
    expect(await screen.findByText("部分可用 1 个标的")).toBeVisible();
    await openDefaultStockRound(user);
    await screen.findByRole("button", { name: "行情数据详情" });
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledOnce();
      expect(refreshMocks.intraday).toHaveBeenCalledOnce();
    });
    await user.click(screen.getByRole("button", { name: "数据管理" }));
    await screen.findByRole("region", { name: "数据管理" });
    await waitFor(() =>
      expect(screen.getByText("更新完成 1 个标的")).toBeVisible(),
    );
    expect(screen.getByText("部分可用 0 个标的")).toBeVisible();
    await openDefaultStockRound(user);
    await screen.findByRole("button", { name: "行情数据详情" });
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    expect(screen.getByRole("region", { name: "1h 行情详情" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "15m 行情详情" })).not.toBeInTheDocument();
    expect(screen.queryByText("待重试 0 个标的")).not.toBeInTheDocument();
  });

  it("refreshes the global failure summary and details after a single hard failure", async () => {
    const user = userEvent.setup();
    saveMarketDataJob({
      instrumentId: "US:REFRESH",
      symbol: "REFRESH",
      market: "US",
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "complete",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "complete" },
      ],
    });
    refreshMocks.daily.mockRejectedValue(new Error("日线服务不可用"));
    refreshMocks.intraday.mockResolvedValue({
      source: "network", status: "source-unavailable", candles: [], requestedRanges: [],
      coverage: [{ interval: "1h", requestedStart: "2025-01-02T00:00:00.000Z", requestedEnd: "2025-01-02T23:59:59.999Z", status: "partial", reason: "source-unavailable" }],
      error: { code: "source-unavailable", message: "小时线服务不可用" },
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    await openDataManagement();
    expect(await screen.findByText("更新完成 1 个标的")).toBeVisible();
    await openDefaultStockRound(user);
    await screen.findByRole("button", { name: "行情数据详情" });
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledOnce();
      expect(refreshMocks.intraday).toHaveBeenCalledOnce();
    });
    await user.click(screen.getByRole("button", { name: "数据管理" }));
    await screen.findByRole("region", { name: "数据管理" });
    await waitFor(() =>
      expect(screen.getByText("更新失败 1 个标的")).toBeVisible(),
    );
    expect(screen.getByText("部分可用 0 个标的")).toBeVisible();
    expect(screen.getByText(/待重试 1 个标的/)).toBeVisible();

    await user.click(screen.getByText(/查看失败明细/));
    const globalFailureDetails = screen.getByText(/查看失败明细/).closest("details");
    expect(globalFailureDetails).not.toBeNull();
    expect(within(globalFailureDetails!).getByText(/日线服务不可用/)).toBeVisible();
    expect(within(globalFailureDetails!).getByText(/小时线服务不可用/)).toBeVisible();
  });

  it("keeps a running global batch in control when a single refresh is requested", async () => {
    const user = userEvent.setup();
    const providerGate = deferred<void>();
    saveMarketDataJob({
      instrumentId: "US:REFRESH",
      symbol: "REFRESH",
      market: "US",
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "complete",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "complete" },
      ],
    });
    refreshMocks.daily.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        await providerGate.promise;
        if (signal?.aborted) throw signal.reason;
        return {
          source: "network" as const,
          status: "complete" as const,
          candles: [],
          requestedRanges: [],
        };
      },
    );
    refreshMocks.intraday.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        await providerGate.promise;
        if (signal?.aborted) throw signal.reason;
        return {
          source: "network" as const,
          status: "complete" as const,
          candles: [],
          coverage: [],
          requestedRanges: [],
        };
      },
    );

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    await openDataManagement();
    const globalRefresh = await screen.findByRole("button", {
      name: "更新全部数据",
    });
    await user.click(globalRefresh);
    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledOnce();
      expect(refreshMocks.intraday).toHaveBeenCalledOnce();
    });

    await openDefaultStockRound(user);
    await screen.findByRole("button", { name: "行情数据详情" });
    await user.click(screen.getByRole("button", { name: "行情数据详情" }));
    await user.click(screen.getByRole("button", { name: "刷新行情数据" }));

    expect(refreshMocks.daily).toHaveBeenCalledOnce();
    expect(refreshMocks.intraday).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "数据管理" }));
    await screen.findByRole("region", { name: "数据管理" });
    expect(
      screen.getByRole("button", { name: "正在更新全部行情" }),
    ).toBeDisabled();

    providerGate.resolve();
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "更新全部数据" }),
        ).toBeEnabled(),
      { timeout: 5_000 },
    );
  });

  it("offers recovery for a saved snapshot with two unfinished instruments and requests only those two", async () => {
    const complete = refreshExecutionFor("COMPLETE");
    const pendingOne = refreshExecutionFor("PENDING1");
    const pendingTwo = refreshExecutionFor("PENDING2");
    saveImportedExecutions([complete, pendingOne, pendingTwo]);
    saveMarketDataJob({
      instrumentId: complete.instrument.id,
      symbol: complete.instrument.symbol,
      market: complete.instrument.market,
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "complete",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "complete" },
      ],
    });
    saveMarketDataJob(unfinishedJob(pendingOne.instrument.id, pendingOne.instrument.symbol));
    saveMarketDataJob(unfinishedJob(pendingTwo.instrument.id, pendingTwo.instrument.symbol));
    refreshMocks.daily.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      requestedRanges: [],
    });
    refreshMocks.intraday.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      coverage: [],
      requestedRanges: [],
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    const user = await openDataManagement();
    expect(await screen.findByText("未完成 2 个标的")).toBeVisible();
    const recover = screen.getByRole("button", { name: "恢复未完成行情" });
    expect(recover).toBeEnabled();
    await user.click(recover);

    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledTimes(2);
      expect(refreshMocks.intraday).toHaveBeenCalledTimes(2);
    });
    expect(refreshMocks.daily.mock.calls.map(([input]) => input.instrumentId)).toEqual([
      pendingOne.instrument.id,
      pendingTwo.instrument.id,
    ]);
    expect(refreshMocks.intraday.mock.calls.map(([input]) => input.instrumentId)).toEqual([
      pendingOne.instrument.id,
      pendingTwo.instrument.id,
    ]);
  });

  it("shows and recovers an inventory instrument with no saved job", async () => {
    const complete = refreshExecutionFor("COMPLETE");
    const missing = refreshExecutionFor("MISSING");
    saveImportedExecutions([complete, missing]);
    saveMarketDataJob({
      instrumentId: complete.instrument.id,
      symbol: complete.instrument.symbol,
      market: complete.instrument.market,
      requestedAt: "2026-09-15T00:00:00.000Z",
      status: "complete",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "complete" },
      ],
    });
    refreshMocks.daily.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      requestedRanges: [],
    });
    refreshMocks.intraday.mockResolvedValue({
      source: "network" as const,
      status: "complete" as const,
      candles: [],
      coverage: [],
      requestedRanges: [],
    });

    render(
      <TradeReviewWorkspace
        initialFrame={initialFrame}
        showDemo={false}
        storageClient={createLegacySqliteClient()}
      />,
    );

    const user = await openDataManagement();
    expect(await screen.findByText("未完成 1 个标的")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "恢复未完成行情" }));
    await waitFor(() => {
      expect(refreshMocks.daily).toHaveBeenCalledTimes(1);
      expect(refreshMocks.intraday).toHaveBeenCalledTimes(1);
    });
    expect(refreshMocks.daily).toHaveBeenCalledWith(
      expect.objectContaining({ instrumentId: missing.instrument.id }),
    );
  });
});
