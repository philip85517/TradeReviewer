import "fake-indexeddb/auto";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as XLSX from "xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { MarketDataRead } from "../lib/storage/sqlite-http-client";
import type { StorageBootstrap } from "../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../lib/trades/types";
import type { MarketDataJob } from "../lib/storage/market-data-jobs";
import type { DailyCandleRecord } from "../lib/market/contracts";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";

// Keep the homepage's independent automatic holdings valuation idle. This is
// the same bounded hook fixture used by the existing workspace refresh suite;
// the market publication path under test remains the real workspace effect
// and the injected storage client's getMarketData boundary.
vi.mock("./dashboard/use-holdings-valuation-refresh", () => ({
  useHoldingsValuationRefresh: () => ({
    phase: "idle",
    label: "估值待更新",
    detail: null,
    announcement: null,
    active: false,
    request: vi.fn(),
    cancel: vi.fn(),
  }),
}));

// Keep Recall's own document load on the real workspace path while making its
// storage boundary deterministic.  The market-readiness fixture owns market
// publication; this transport only supplies the empty persisted-document
// response needed for RecallWorkspace to mount its public consumers.
vi.mock("../lib/recall/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/recall/repository")>();
  return {
    ...actual,
    createRecallRepository: () => ({
      load: async () => null,
      fetch: async () => null,
      save: async () => {
        throw new Error("unexpected Recall save in market publication fixture");
      },
    }),
  };
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
} as const;

const unrelatedInstrument = {
  id: "US:NIO",
  symbol: "NIO",
  name: "蔚来汽车",
  market: "US",
  currency: "USD",
} as const;

function execution(input: {
  id: string;
  row: number;
  executedAt: string;
  instrument?: typeof instrument | typeof unrelatedInstrument;
}): TradeExecution {
  const target = input.instrument ?? instrument;
  return {
    id: input.id,
    source: {
      platform: "futu",
      row: input.row,
      fileName: "baseline.xlsx",
      sourceTimestampText: input.executedAt,
      sourceTimezone: "UTC",
    },
    accountId: "acct",
    accountLabel: "富途",
    instrument: target,
    side: "buy",
    executedAt: input.executedAt,
    quantity: "10",
    price: "10",
    fee: "0",
  };
}

function importFile(executedAt = "2026-10-05 23:00:00"): File {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "成交时间", "账户名称", "账户号码", "品类", "代码名称", "交易所/市场",
      "方向", "交收日期", "币种", "数量/面值", "价格", "成交金额", "总费用", "变动金额",
    ],
    [executedAt, "富途", "acct", "证券", "XPEV 小鹏汽车", "US", "买入开仓", "20261007", "USD", "10", "10", "-100", "0", "-100"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "证券-交易流水");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const file = new File([buffer], "middle-xpev-episode.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

function dailyRead(variant: "d0" | "d1" = "d0"): MarketDataRead {
  const d1 = variant === "d1";
  const extraDailyCandle: DailyCandleRecord = {
    instrumentId: "US:XPEV",
    tradingDate: "2026-10-02",
    open: "102",
    high: "102",
    low: "102",
    close: "102",
    volume: "110",
    currency: "USD",
    provider: "yahoo",
    providerSymbol: "XPEV",
    adjustmentMode: "raw",
    fetchedAt: "2026-10-06T00:00:00.000Z",
  };
  const latestDailyCandle: DailyCandleRecord = {
    instrumentId: "US:XPEV",
    tradingDate: "2026-10-05",
    open: d1 ? "101" : "100",
    high: d1 ? "101" : "100",
    low: d1 ? "101" : "100",
    close: d1 ? "101" : "100",
    volume: "100",
    currency: "USD",
    provider: "yahoo",
    providerSymbol: "XPEV",
    adjustmentMode: "raw",
    fetchedAt: "2026-10-06T00:00:00.000Z",
  };
  return {
    candles: [],
    dailyCandles: [
      ...(d1 ? [extraDailyCandle] : []),
      latestDailyCandle,
    ],
    coverage: [{
      startDate: d1 ? "2026-10-02" : "2026-10-05",
      endDate: "2026-10-05",
      status: "complete",
      provider: "yahoo",
      fetchedAt: "2026-10-06T00:00:00.000Z",
      missingTradingDates: [],
    }],
    intervalCoverage: [],
  };
}

function intradayRead(): MarketDataRead {
  return {
    candles: [{
      instrumentId: "US:XPEV",
      interval: "1h",
      timestamp: "2026-10-05T15:00:00.000Z",
      open: "10",
      high: "10.2",
      low: "9.8",
      close: "10.1",
      volume: "100",
      currency: "USD",
      provider: "yahoo",
      providerSymbol: "XPEV",
      adjustmentMode: "raw",
      fetchedAt: "2026-10-06T00:00:00.000Z",
    }],
    intervalCoverage: [{
      interval: "1h",
      requestedStart: "2026-10-05T00:00:00.000Z",
      requestedEnd: "2026-10-05T23:59:59.999Z",
      actualStart: "2026-10-05T15:00:00.000Z",
      actualEnd: "2026-10-05T15:00:00.000Z",
      status: "complete",
      provider: "yahoo",
      fetchedAt: "2026-10-06T00:00:00.000Z",
    }],
  };
}

function intradayReadWithoutCoverage(): MarketDataRead {
  return { ...intradayRead(), intervalCoverage: [] };
}

function intradayReadWithTwoCandles(): MarketDataRead {
  const read = intradayRead();
  const first = read.candles[0]!;
  return {
    ...read,
    candles: [
      first,
      { ...first, timestamp: "2026-10-05T16:00:00.000Z", close: "10.3" },
    ],
    intervalCoverage: read.intervalCoverage.map(segment => ({
      ...segment,
      actualEnd: "2026-10-05T16:00:00.000Z",
    })),
  };
}

function native15mRead(requestedStart: string, requestedEnd: string): MarketDataRead {
  const fetchedAt = "2026-10-06T00:15:00.000Z";
  return {
    candles: [
      {
        instrumentId: "US:XPEV",
        interval: "15m",
        timestamp: "2026-10-05T15:00:00.000Z",
        open: "10",
        high: "10.2",
        low: "9.8",
        close: "10.1",
        volume: "100",
        currency: "USD",
        provider: "yahoo",
        providerSymbol: "XPEV",
        adjustmentMode: "raw",
        fetchedAt,
      },
      {
        instrumentId: "US:XPEV",
        interval: "15m",
        timestamp: "2026-10-05T15:15:00.000Z",
        open: "10.1",
        high: "10.4",
        low: "10",
        close: "10.3",
        volume: "120",
        currency: "USD",
        provider: "yahoo",
        providerSymbol: "XPEV",
        adjustmentMode: "raw",
        fetchedAt,
      },
    ],
    intervalCoverage: [{
      interval: "15m",
      requestedStart,
      requestedEnd,
      actualStart: "2026-10-05T15:00:00.000Z",
      actualEnd: "2026-10-05T15:15:00.000Z",
      status: "partial",
      provider: "yahoo",
      fetchedAt,
    }],
  };
}

function coverageOnlyHourlyRead(requestedStart: string, requestedEnd: string): MarketDataRead {
  return {
    candles: [],
    intervalCoverage: [{
      interval: "1h",
      requestedStart,
      requestedEnd,
      status: "source-unavailable",
      reason: "source-unavailable",
      provider: "yahoo",
      fetchedAt: "2026-10-06T00:15:00.000Z",
    }],
  };
}

function bootstrap(
  executions: TradeExecution[],
  marketDataJobs: MarketDataJob[] = [],
  instruments: ReadonlyArray<typeof instrument | typeof unrelatedInstrument> = [instrument],
): StorageBootstrap {
  return {
    schemaVersion: 1,
    migration: null,
    executions,
    importHistory: [],
    instruments: [...instruments],
    reviews: [],
    reviewStates: [],
    tagSuggestions: [],
    marketDataJobs,
    settings: { version: 1, showGrid: true, showVolume: true, showExecutions: true, showAverageCost: true, colorScheme: "teal-red" },
  };
}

function createFixture(options: {
  marketDataJobs?: MarketDataJob[];
  includeUnrelated?: boolean;
  intradayFallback?: "native15m";
} = {}) {
  const initialExecutions = [
    execution({ id: "buy-1430", row: 1, executedAt: "2026-10-05T14:30:00.000Z" }),
    execution({ id: "buy-1530", row: 2, executedAt: "2026-10-05T15:30:00.000Z" }),
    ...(options.includeUnrelated
      ? [execution({
          id: "buy-nio-1430",
          row: 4,
          executedAt: "2026-10-05T14:30:00.000Z",
          instrument: unrelatedInstrument,
        })]
      : []),
  ];
  const client = createLegacySqliteClient();
  const initialInstruments = options.includeUnrelated ? [instrument, unrelatedInstrument] : [instrument];
  let current = bootstrap(initialExecutions, options.marketDataJobs, initialInstruments);
  const mergeInputs: Array<{ executions: TradeExecution[] }> = [];
  const requests: Array<{ input: Parameters<NonNullable<typeof client.getMarketData>>[0]; signal?: AbortSignal }> = [];
  const putMarketDataJob = vi.fn(async (job: Parameters<typeof client.putMarketDataJob>[0]) => job);
  const d1 = deferred<MarketDataRead>();
  const i1 = deferred<MarketDataRead>();
  const i2 = deferred<MarketDataRead>();
  const i15 = deferred<MarketDataRead>();
  const j0 = deferred<MarketDataRead>();
  const initialDailyReads = new Set<string>();
  let intradayReadCount = 0;
  client.getBootstrap = async () => current;
  client.getInstrumentMetadata = async () => ({
    instruments: initialInstruments.map(item => ({ ...item, metadata: {
      market: "US",
      symbol: item.symbol,
      name: item.name,
      assetType: "stock",
      source: "statement",
      confidence: "statement",
      resolvedAt: "2026-10-06T00:00:00.000Z",
    } })),
  });
  client.putMarketDataJob = putMarketDataJob;
  client.mergeExecutions = async (input) => {
    mergeInputs.push({ executions: input.executions });
    current = { ...current, executions: input.executions, instruments: input.instruments ?? current.instruments };
    return { inserted: input.executions.length, duplicate: 0, conflict: 0 };
  };
  client.getMarketData = async (input, signal) => {
    requests.push({ input, signal });
    if (input.dailyOnly) {
      if (options.includeUnrelated && input.instrumentId === unrelatedInstrument.id) {
        return j0.promise;
      }
      if (!initialDailyReads.has(input.instrumentId)) {
        initialDailyReads.add(input.instrumentId);
        return dailyRead("d0");
      }
      return d1.promise;
    }
    if (input.interval === "1h") {
      intradayReadCount += 1;
      return intradayReadCount === 1 ? i1.promise : i2.promise;
    }
    if (input.interval === "15m" && options.intradayFallback === "native15m") return i15.promise;
    return { candles: [], intervalCoverage: [] };
  };
  return { client, mergeInputs, requests, putMarketDataJob, d1, i1, i2, i15, j0, initialExecutions };
}

function renderFixture(fixture: ReturnType<typeof createFixture>) {
  return render(<TradeReviewWorkspace initialFrame={{
    cursorIndex: 0,
    cursor: "2026-10-05T14:30:00.000Z",
    candles15m: [{ time: "2026-10-05T14:30:00.000Z", open: 10, high: 10.2, low: 9.9, close: 10.1, volume: 100 }],
    executions: [],
    canGoBack: false,
    canGoForward: false,
  } satisfies DemoReplayFrame} showDemo={false} storageClient={fixture.client} />);
}

async function openMarketRepairDialog(
  fixture: ReturnType<typeof createFixture>,
  settleIntraday: "empty" | "error" = "empty",
) {
  await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "数据" }));
  const dataManagement = await screen.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText("1 个已导入标的");
  fireEvent.click(screen.getByRole("button", { name: "交易库" }));
  const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  const episodeButton = await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
  fireEvent.click(episodeButton);
  await waitFor(() => expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true));
  await act(async () => {
    if (settleIntraday === "empty") fixture.i1.resolve({ candles: [], intervalCoverage: [] });
    else fixture.i1.reject(new Error("hourly local read failed"));
  });
  const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
  fireEvent.click(repairButton);
  const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
  fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
  return dialog;
}

async function openSelectedEpisode(fixture: ReturnType<typeof createFixture>) {
  await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "数据" }));
  const dataManagement = await screen.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText(/个已导入标的/);
  fireEvent.click(screen.getByRole("button", { name: "交易库" }));
  const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
  await waitFor(() => {
    expect(fixture.requests.some(({ input }) => input.dailyOnly && input.interval === "1D")).toBe(true);
    expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true);
  });
}

async function importMiddleAndOpenSelectedEpisode(fixture: ReturnType<typeof createFixture>) {
  await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "数据" }));
  const dataManagement = await screen.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText("1 个已导入标的");
  fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
  const input = screen.getByLabelText("导入交易记录", { selector: "input" });
  fireEvent.change(input, { target: { files: [importFile()] } });
  await screen.findByRole("heading", { name: "确认导入交易记录" });
  fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
  await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "交易库" }));
  const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
  await waitFor(() => {
    expect(fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D")).toHaveLength(2);
    expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1);
  });
  const dailyRequests = fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D");
  const intradayRequests = fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly);
  expect(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)).size).toBe(1);
  expect(new Set(intradayRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(
    new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)),
  );
  expect(dailyRequests.at(-1)?.signal?.aborted).toBe(false);
  expect(intradayRequests[0]?.signal?.aborted).toBe(false);
}

async function reopenSelectedEpisodeAfterImport(
  fixture: ReturnType<typeof createFixture>,
  executedAt: string,
) {
  fireEvent.click(screen.getByRole("button", { name: "数据" }));
  await screen.findByRole("region", { name: "数据管理" });
  fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
  const input = screen.getByLabelText("导入交易记录", { selector: "input" });
  fireEvent.change(input, { target: { files: [importFile(executedAt)] } });
  await screen.findByRole("heading", { name: "确认导入交易记录" });
  fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
  await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
  fireEvent.click(screen.getByRole("button", { name: "交易库" }));
  const mergedStockRow = await screen.findByRole("button", { name: /小鹏汽车交易回合/ });
  if (mergedStockRow.getAttribute("aria-label")?.startsWith("展开")) fireEvent.click(mergedStockRow);
  fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
  await waitFor(() => expect(fixture.requests.filter(({ input: request }) => request.interval === "1h" && !request.dailyOnly)).toHaveLength(2));
}

describe("market publication through the public workspace path", () => {
  beforeEach(async () => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.removeItem("trade-reviewer:market-data-jobs:v1");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  afterEach(() => cleanup());

  it("keeps the merged episode identity while D1 is deferred, then publishes I1 to Recall", async () => {
    const fixture = createFixture();
    render(<TradeReviewWorkspace initialFrame={{
      cursorIndex: 0,
      cursor: "2026-10-05T14:30:00.000Z",
      candles15m: [{ time: "2026-10-05T14:30:00.000Z", open: 10, high: 10.2, low: 9.9, close: 10.1, volume: 100 }],
      executions: [],
      canGoBack: false,
      canGoForward: false,
    } satisfies DemoReplayFrame} showDemo={false} storageClient={fixture.client} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
    const input = screen.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile()] } });

    await screen.findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
    const baselineEpisodes = buildTradeEpisodes(fixture.initialExecutions);
    const mergedExecutions = fixture.mergeInputs[0]?.executions ?? [];
    const mergedEpisodes = buildTradeEpisodes(mergedExecutions);
    expect(baselineEpisodes).toHaveLength(1);
    expect(mergedEpisodes).toHaveLength(1);
    expect(mergedEpisodes[0]?.id).toBe(baselineEpisodes[0]?.id);
    expect(mergedEpisodes[0]?.status).toBe("open");
    expect(mergedEpisodes[0]?.startedAt).toBe(baselineEpisodes[0]?.startedAt);
    expect(mergedEpisodes[0]?.endedAt).toBe(baselineEpisodes[0]?.endedAt);
    expect(mergedEpisodes[0]?.executions).toHaveLength(3);
    expect(fixture.mergeInputs[0]?.executions.map(item => item.executedAt)).toEqual([
      "2026-10-05T14:30:00.000Z",
      "2026-10-05T15:00:00.000Z",
      "2026-10-05T15:30:00.000Z",
    ]);
    expect(fixture.mergeInputs[0]?.executions[1]?.accountId).toBe("acct");
    expect(fixture.mergeInputs[0]?.executions[1]?.source.sourceTimezone).toBe("Asia/Shanghai");
    expect(fixture.requests.some(({ input }) => input.dailyOnly && input.interval === "1D")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    const episodeButton = await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
    fireEvent.click(episodeButton);

    await waitFor(() => expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true));
    expect(screen.getByRole("region", { name: "交易复盘图表工作区" })).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    expect(dialog).toHaveTextContent("本地日线：1 根；小时线：1 根");
    expect(dialog).toHaveTextContent("当前行情状态");

    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    const dailyRequests = fixture.requests.filter(({ input }) => input.dailyOnly);
    const intradayRequests = fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly);
    expect(dailyRequests).toHaveLength(2);
    expect(intradayRequests).toHaveLength(1);
    expect(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)).size).toBe(1);
    expect(new Set(intradayRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)));
    expect(dailyRequests.at(-1)?.signal?.aborted).toBe(false);
    expect(intradayRequests[0]?.signal?.aborted).toBe(false);
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).toHaveTextContent("日线覆盖：2026-10-02 至 2026-10-05");
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:00:00.000Z");
  // Public entry plus the two owned reads can exceed the default test budget;
  // retain every publication assertion with a local end-to-end budget.
  }, 10000);

  it("publishes D1 and I1 together when both owned reads settle in one React batch", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
    const input = screen.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile()] } });

    await screen.findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    const episodeButton = await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
    fireEvent.click(episodeButton);
    await waitFor(() => {
      expect(fixture.requests.some(({ input: request }) => request.dailyOnly && request.interval === "1D")).toBe(true);
      expect(fixture.requests.some(({ input: request }) => request.interval === "1h" && !request.dailyOnly)).toBe(true);
    });

    const dailyRequests = fixture.requests.filter(({ input: request }) => request.dailyOnly);
    const intradayRequests = fixture.requests.filter(({ input: request }) => request.interval === "1h" && !request.dailyOnly);
    expect(dailyRequests).toHaveLength(2);
    expect(intradayRequests).toHaveLength(1);
    expect(new Set(dailyRequests.map(({ input: request }) => `${request.start}|${request.end}`)).size).toBe(1);
    expect(new Set(intradayRequests.map(({ input: request }) => `${request.start}|${request.end}`))).toEqual(
      new Set(dailyRequests.map(({ input: request }) => `${request.start}|${request.end}`)),
    );

    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
      fixture.i1.resolve(intradayRead());
    });

    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).toHaveTextContent("日线覆盖：2026-10-02 至 2026-10-05");
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:00:00.000Z");
  // Public entry plus the two owned reads can exceed the default test budget;
  // retain every publication assertion with a local end-to-end budget.
  }, 10000);

  it("keeps the selected I intraday read alive while unrelated J daily hydration completes", async () => {
    const fixture = createFixture({ includeUnrelated: true });
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("2 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    const episodeButton = await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
    fireEvent.click(episodeButton);
    await waitFor(() => {
      expect(fixture.requests.some(({ input: request }) => request.instrumentId === unrelatedInstrument.id && request.dailyOnly)).toBe(true);
      expect(fixture.requests.some(({ input: request }) => request.instrumentId === instrument.id && request.interval === "1h" && !request.dailyOnly)).toBe(true);
    });

    const selectedIntradayRequests = () => fixture.requests.filter(({ input: request }) =>
      request.instrumentId === instrument.id && request.interval === "1h" && !request.dailyOnly,
    );
    const originalIntradayRequest = selectedIntradayRequests()[0];
    expect(originalIntradayRequest?.signal?.aborted).toBe(false);

    await act(async () => {
      fixture.j0.resolve({ candles: [], intervalCoverage: [] });
    });
    const requestCountAfterUnrelatedDaily = selectedIntradayRequests().length;
    const originalSignalAfterUnrelatedDaily = originalIntradayRequest?.signal?.aborted;

    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：1 根；小时线：1 根"));
    expect(originalSignalAfterUnrelatedDaily).toBe(false);
    expect(requestCountAfterUnrelatedDaily).toBe(1);
    const selectedDailyReads = fixture.requests.filter(({ input }) => input.instrumentId === instrument.id && input.dailyOnly);
    const selectedIntradayReads = fixture.requests.filter(({ input }) => input.instrumentId === instrument.id && input.interval === "1h" && !input.dailyOnly);
    expect(selectedDailyReads).toHaveLength(1);
    expect(selectedIntradayReads).toHaveLength(1);
    expect(new Set(selectedIntradayReads.map(({ input }) => `${input.start}|${input.end}`))).toEqual(
      new Set(selectedDailyReads.map(({ input }) => `${input.start}|${input.end}`)),
    );
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
  }, 5000);

  it("cancels the selected I read when public navigation leaves replay", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1));
    const request = fixture.requests.find(({ input }) => input.interval === "1h" && !input.dailyOnly);
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    await screen.findByRole("region", { name: "数据管理" });
    expect(request?.signal?.aborted).toBe(true);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
  }, 5000);

  it("cancels the selected I read when the replay workspace unmounts", async () => {
    const fixture = createFixture();
    const view = renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1));
    const request = fixture.requests.find(({ input }) => input.interval === "1h" && !input.dailyOnly);
    view.unmount();
    expect(request?.signal?.aborted).toBe(true);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
  // Reopening the same instrument waits for the persisted version transition.
  }, 10000);

  it("publishes only the reopened I read after the same instrument trade version changes", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1));
    const request = fixture.requests.find(({ input }) => input.interval === "1h" && !input.dailyOnly);

    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    await screen.findByRole("region", { name: "数据管理" });
    fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
    const input = screen.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile("2026-10-06 00:00:00")] } });
    await screen.findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
    expect(request?.signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const mergedStockRow = await screen.findByRole("button", { name: /小鹏汽车交易回合/ });
    if (mergedStockRow.getAttribute("aria-label")?.startsWith("展开")) fireEvent.click(mergedStockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(2));
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
      fixture.i2.resolve(intradayReadWithTwoCandles());
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：2 根"));
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T16:00:00.000Z");
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：2 根"));
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T16:00:00.000Z");
    const dailyRequests = fixture.requests.filter(({ input }) => input.instrumentId === instrument.id && input.dailyOnly);
    const intradayRequests = fixture.requests.filter(({ input }) => input.instrumentId === instrument.id && input.interval === "1h" && !input.dailyOnly);
    expect(intradayRequests).toHaveLength(2);
    expect(intradayRequests[1]?.signal?.aborted).toBe(false);
    expect(new Set(intradayRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(
      new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)),
    );
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
  // The next version settles through the public workspace before assertions run.
  }, 10000);

  it("retains a candle-only I cache when the next version settles with an empty optional read", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1));
    await act(async () => {
      fixture.i1.resolve(intradayReadWithoutCoverage());
    });

    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    await screen.findByRole("region", { name: "数据管理" });
    fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
    const input = screen.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile("2026-10-06 00:00:00")] } });
    await screen.findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const mergedStockRow = await screen.findByRole("button", { name: /小鹏汽车交易回合/ });
    if (mergedStockRow.getAttribute("aria-label")?.startsWith("展开")) fireEvent.click(mergedStockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(2));
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
      fixture.i2.resolve({ candles: [], intervalCoverage: [] });
    });

    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).not.toHaveTextContent("小时线覆盖：");
  // The next version settles through the public workspace before assertions run.
  }, 10000);

  it("retains a persisted hourly failure through the daily read and an empty optional read", async () => {
    const persistedMessage = "持久化小时缓存不可用";
    const fixture = createFixture({
      marketDataJobs: [{
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        market: instrument.market,
        requestedAt: "2026-10-06T00:00:00.000Z",
        status: "partial",
        intervals: [{
          interval: "1h",
          status: "source-unavailable",
          message: persistedMessage,
          error: { code: "source-unavailable", message: persistedMessage },
        }],
      }],
    });
    renderFixture(fixture);
    const dialog = await openMarketRepairDialog(fixture, "empty");
    expect(dialog).toHaveTextContent(persistedMessage);
    expect(dialog).toHaveTextContent("本地日线：1 根；小时线：0 根");
    await waitFor(() => expect(dialog).toHaveTextContent(persistedMessage));
    expect(dialog).toHaveTextContent("当前行情状态：日线：行情可更新；1H：行情源暂不可用");
    expect(dialog).toHaveTextContent("本地日线：1 根；小时线：0 根");
  }, 5000);

  it("publishes an ordinary intraday read failure with its terminal message", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    const dialog = await openMarketRepairDialog(fixture, "error");
    await waitFor(() => expect(dialog).toHaveTextContent("hourly local read failed"));
    expect(dialog).toHaveTextContent("当前行情状态：日线：行情可更新；1H：本地存储失败");
    expect(dialog).toHaveTextContent("本地日线：1 根；小时线：0 根");
  }, 5000);

  it("keeps D0 and I1 while exposing a late D1 read failure", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    await importMiddleAndOpenSelectedEpisode(fixture);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：1 根；小时线：1 根"));
    await act(async () => {
      fixture.d1.reject(new Error("late daily read failed"));
    });
    await waitFor(() => expect(dialog).toHaveTextContent("late daily read failed"));
    expect(dialog).toHaveTextContent("本地日线：1 根；小时线：1 根");
    expect(dialog).toHaveTextContent("当前行情状态：日线：本地存储失败；1H：行情可更新");
  }, 5000);

  it("keeps the I cache when the next version's ordinary I read fails", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    await openSelectedEpisode(fixture);
    await act(async () => {
      fixture.i1.resolve(intradayReadWithoutCoverage());
    });
    await reopenSelectedEpisodeAfterImport(fixture, "2026-10-06 00:00:00");
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
      fixture.i2.reject(new Error("version hourly read failed"));
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("version hourly read failed"));
    expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根");
    expect(dialog).toHaveTextContent("version hourly read failed");
  // Preserve the full cache/error publication assertions with a local budget.
  }, 10000);

  it("clears an old persisted I error on I1 success and does not resurrect it on late D1", async () => {
    const persistedMessage = "旧持久化小时错误";
    const fixture = createFixture({
      marketDataJobs: [{
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        market: instrument.market,
        requestedAt: "2026-10-06T00:00:00.000Z",
        status: "partial",
        intervals: [{
          interval: "1h",
          status: "source-unavailable",
          message: persistedMessage,
          error: { code: "source-unavailable", message: persistedMessage },
        }],
      }],
    });
    renderFixture(fixture);
    await importMiddleAndOpenSelectedEpisode(fixture);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    const repairButton = await screen.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(screen.getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：1 根；小时线：1 根"));
    expect(dialog).not.toHaveTextContent(persistedMessage);
    expect(dialog).toHaveTextContent("当前行情状态：日线：行情可更新；1H：行情可更新");
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).not.toHaveTextContent(persistedMessage);
  }, 5000);

  it("publishes a native 15m read through Recall and retains it after late D1", async () => {
    const fixture = createFixture({ intradayFallback: "native15m" });
    renderFixture(fixture);
    await importMiddleAndOpenSelectedEpisode(fixture);

    const hourlyRequest = fixture.requests.find(({ input }) => input.interval === "1h" && !input.dailyOnly);
    if (!hourlyRequest?.input.start || !hourlyRequest.input.end) throw new Error("hourly request range was not observed");
    await act(async () => {
      fixture.i1.resolve({ candles: [], intervalCoverage: [] });
    });
    await waitFor(() => expect(fixture.requests.some(({ input }) => input.interval === "15m" && !input.dailyOnly)).toBe(true));
    const nativeRequest = fixture.requests.find(({ input }) => input.interval === "15m" && !input.dailyOnly);
    if (!nativeRequest?.input.start || !nativeRequest.input.end) throw new Error("native 15m request range was not observed");
    expect(nativeRequest.input.instrumentId).toBe(instrument.id);
    expect(nativeRequest.input.start).toBe(hourlyRequest.input.start);
    expect(nativeRequest.input.end).toBe(hourlyRequest.input.end);
    expect(nativeRequest.signal?.aborted).toBe(false);

    const loadingWorkspace = screen.getByRole("region", { name: "交易复盘图表工作区" });
    expect(loadingWorkspace).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      fixture.i15.resolve(native15mRead(nativeRequest.input.start!, nativeRequest.input.end!));
    });
    const toolbar = await screen.findByLabelText("图表工具栏");
    const fifteenMinute = within(toolbar).getByRole("button", { name: "切换到 15m" });
    expect(fifteenMinute).toBeEnabled();
    fireEvent.click(fifteenMinute);
    await waitFor(() => expect(fifteenMinute).toHaveClass("active"));

    fireEvent.click(within(toolbar).getByRole("button", { name: "行情数据详情" }));
    const popover = await screen.findByRole("dialog", { name: "行情数据详情" });
    const nativeDetails = within(popover).getByRole("region", { name: "15m 行情详情" });
    expect(nativeDetails).toBeVisible();
    expect(within(popover).queryByRole("region", { name: "1h 行情详情" })).not.toBeInTheDocument();
    expect(nativeDetails).toHaveTextContent("Yahoo Finance");
    expect(nativeDetails).toHaveTextContent("2026-10-05T15:00:00.000Z 至 2026-10-05T15:15:00.000Z");
    expect(nativeDetails).toHaveTextContent("2026年10月06日 08:15:00");
    expect(nativeDetails).toHaveTextContent("行情部分可用");
    expect(nativeDetails).toHaveTextContent("15m、1h、4h");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "行情数据详情" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "检查/修复数据" }));
    const dataDialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dataDialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    fireEvent.click(within(dataDialog).getByText(/查看行情覆盖与技术诊断/));
    const nativeCoverage = within(dataDialog).getByText("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:15:00.000Z，行情部分可用");
    expect(nativeCoverage).toBeVisible();
    expect(dataDialog).toHaveTextContent("本地日线：1 根；小时线：2 根");

    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    await waitFor(() => expect(dataDialog).toHaveTextContent("本地日线：2 根；小时线：2 根"));
    expect(within(dataDialog).getByText("日线覆盖：2026-10-02 至 2026-10-05，本地行情完整")).toBeVisible();
    expect(within(dataDialog).getByText("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:15:00.000Z，行情部分可用")).toBeVisible();
    fireEvent.click(within(dataDialog).getByRole("button", { name: "关闭数据检查" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "检查与修复当前股票数据" })).not.toBeInTheDocument());

    fireEvent.click(within(toolbar).getByRole("button", { name: "行情数据详情" }));
    const reopenedPopover = await screen.findByRole("dialog", { name: "行情数据详情" });
    const reopenedNativeDetails = within(reopenedPopover).getByRole("region", { name: "15m 行情详情" });
    expect(reopenedNativeDetails).toBeVisible();
    expect(reopenedNativeDetails).toHaveTextContent("Yahoo Finance");
    expect(reopenedNativeDetails).toHaveTextContent("2026-10-05T15:00:00.000Z 至 2026-10-05T15:15:00.000Z");
    expect(reopenedNativeDetails).toHaveTextContent("2026年10月06日 08:15:00");
    expect(reopenedNativeDetails).toHaveTextContent("行情部分可用");
    expect(reopenedNativeDetails).toHaveTextContent("15m、1h、4h");
    const reopenedFifteenMinute = within(toolbar).getByRole("button", { name: "切换到 15m" });
    expect(reopenedFifteenMinute).toBeEnabled();
    fireEvent.click(reopenedFifteenMinute);
    await waitFor(() => expect(reopenedFifteenMinute).toHaveClass("active"));

    const dailyRequests = fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D");
    const hourlyRequests = fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly);
    const nativeRequests = fixture.requests.filter(({ input }) => input.interval === "15m" && !input.dailyOnly);
    expect(dailyRequests).toHaveLength(2);
    expect(hourlyRequests).toHaveLength(1);
    expect(nativeRequests).toHaveLength(1);
    expect(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)).size).toBe(1);
    expect(new Set(hourlyRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)));
    expect(new Set(nativeRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)));
    expect(dailyRequests.every(({ signal }) => signal?.aborted === false)).toBe(true);
    expect(hourlyRequests.every(({ signal }) => signal?.aborted === false)).toBe(true);
    expect(nativeRequests.every(({ signal }) => signal?.aborted === false)).toBe(true);
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
  });

  it("keeps a coverage-only hourly read visible without requesting 15m", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    await importMiddleAndOpenSelectedEpisode(fixture);

    const hourlyRequest = fixture.requests.find(({ input }) => input.interval === "1h" && !input.dailyOnly);
    if (!hourlyRequest?.input.start || !hourlyRequest.input.end) throw new Error("hourly request range was not observed");
    const hourlyStart = hourlyRequest.input.start;
    const hourlyEnd = hourlyRequest.input.end;
    await act(async () => {
      fixture.i1.resolve(coverageOnlyHourlyRead(hourlyStart, hourlyEnd));
    });
    const toolbar = await screen.findByLabelText("图表工具栏");
    await waitFor(() => expect(within(toolbar).getByRole("button", { name: "切换到 1h" })).toBeDisabled());
    const hourlyButton = within(toolbar).getByRole("button", { name: "切换到 1h" });
    const fourHourButton = within(toolbar).getByRole("button", { name: "切换到 4h" });
    const fifteenMinuteButton = within(toolbar).getByRole("button", { name: "切换到 15m" });
    expect(hourlyButton).toHaveAttribute("title", "公开行情源暂不可用");
    expect(hourlyButton).toHaveAttribute("aria-description", "公开行情源暂不可用");
    expect(fourHourButton).toBeDisabled();
    expect(fourHourButton).toHaveAttribute("title", "公开行情源暂不可用");
    expect(fifteenMinuteButton).toBeDisabled();
    expect(fifteenMinuteButton).toHaveAttribute("title", "尚未获取该周期行情");

    fireEvent.click(within(toolbar).getByRole("button", { name: "行情数据详情" }));
    const popover = await screen.findByRole("dialog", { name: "行情数据详情" });
    const hourlyDetails = within(popover).getByRole("region", { name: "1h 行情详情" });
    expect(hourlyDetails).toBeVisible();
    expect(hourlyDetails).toHaveTextContent("未连接行情源");
    expect(hourlyDetails).toHaveTextContent("2026年10月06日 08:15:00");
    expect(hourlyDetails).toHaveTextContent("行情源暂不可用");
    expect(hourlyDetails).toHaveTextContent("暂无");
    expect(hourlyDetails).toHaveTextContent("公开行情源暂不可用");
    expect(hourlyDetails).toHaveTextContent("行情请求未能完成，暂无实际覆盖区间");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "行情数据详情" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "检查/修复数据" }));
    const dataDialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dataDialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    fireEvent.click(within(dataDialog).getByText(/查看行情覆盖与技术诊断/));
    const requestedCoverage = within(dataDialog).getByText(`小时线覆盖：${hourlyRequest.input.start} 至 ${hourlyRequest.input.end}，行情源暂不可用`);
    expect(requestedCoverage).toBeVisible();
    expect(dataDialog).toHaveTextContent("本地日线：1 根；小时线：0 根");

    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    await waitFor(() => expect(dataDialog).toHaveTextContent("本地日线：2 根；小时线：0 根"));
    expect(within(dataDialog).getByText("日线覆盖：2026-10-02 至 2026-10-05，本地行情完整")).toBeVisible();
    expect(within(dataDialog).getByText(`小时线覆盖：${hourlyRequest.input.start} 至 ${hourlyRequest.input.end}，行情源暂不可用`)).toBeVisible();
    fireEvent.click(within(dataDialog).getByRole("button", { name: "关闭数据检查" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "检查与修复当前股票数据" })).not.toBeInTheDocument());

    fireEvent.click(within(toolbar).getByRole("button", { name: "行情数据详情" }));
    const reopenedPopover = await screen.findByRole("dialog", { name: "行情数据详情" });
    const reopenedHourlyDetails = within(reopenedPopover).getByRole("region", { name: "1h 行情详情" });
    expect(reopenedHourlyDetails).toBeVisible();
    expect(reopenedHourlyDetails).toHaveTextContent("2026年10月06日 08:15:00");
    expect(reopenedHourlyDetails).toHaveTextContent("行情源暂不可用");
    expect(reopenedHourlyDetails).toHaveTextContent("暂无");
    expect(reopenedHourlyDetails).toHaveTextContent("行情请求未能完成，暂无实际覆盖区间");
    expect(reopenedHourlyDetails).toHaveTextContent("公开行情源暂不可用");
    const reopenedHourly = within(toolbar).getByRole("button", { name: "切换到 1h" });
    const reopenedFourHour = within(toolbar).getByRole("button", { name: "切换到 4h" });
    const reopenedFifteenMinute = within(toolbar).getByRole("button", { name: "切换到 15m" });
    expect(reopenedHourly).toBeDisabled();
    expect(reopenedHourly).toHaveAttribute("title", "公开行情源暂不可用");
    expect(reopenedFourHour).toBeDisabled();
    expect(reopenedFourHour).toHaveAttribute("title", "公开行情源暂不可用");
    expect(reopenedFifteenMinute).toBeDisabled();
    expect(reopenedFifteenMinute).toHaveAttribute("title", "尚未获取该周期行情");

    const dailyRequests = fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D");
    const hourlyRequests = fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly);
    const nativeRequests = fixture.requests.filter(({ input }) => input.interval === "15m" && !input.dailyOnly);
    expect(dailyRequests).toHaveLength(2);
    expect(hourlyRequests).toHaveLength(1);
    expect(nativeRequests).toHaveLength(0);
    expect(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)).size).toBe(1);
    expect(new Set(hourlyRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)));
    expect(dailyRequests.every(({ signal }) => signal?.aborted === false)).toBe(true);
    expect(hourlyRequests.every(({ signal }) => signal?.aborted === false)).toBe(true);
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
  });
});
