import "fake-indexeddb/auto";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as XLSX from "xlsx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DemoReplayFrame } from "../lib/demo/replay-frame";
import type { MarketDataRead } from "../lib/storage/sqlite-http-client";
import type { StorageBootstrap } from "../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../lib/trades/types";
import type { MarketDataJob } from "../lib/storage/market-data-jobs";
import type {
  DailyCandleRecord,
  NativeIntradayInterval,
  SupportedMarket,
} from "../lib/market/contracts";
import { CalendarOutOfRangeError, expectedTradingDates } from "../lib/market/calendar";
import { marketLocalTimestampToIso } from "../lib/market/providers/errors";
import { marketTimeZone, marketTradingDate } from "../lib/market/trading-date";
import { buildTradeEpisodes } from "../lib/trades/episodes";
import { TradeReviewWorkspace } from "./trade-review-workspace";
import { createLegacySqliteClient } from "./test-support/legacy-sqlite-client";
import { ComputingHoldingsHistoryWorker } from "./test-support/computing-holdings-history-worker";

// Keep the homepage's Shanghai market-date boundary stable while preserving
// real timers and the workspace's production scheduling behavior.
const MARKET_READINESS_FIXTURE_NOW = "2026-10-11T04:00:00.000Z";
const MAX_MARKET_DATA_READBACK_TRACE = 64;

type DashboardDiagnosticSnapshot = {
  visible?: boolean;
  holdingsDataReady?: boolean;
  holdingsAsOf?: string;
  holdingsHydrationRetryInstruments?: readonly { instrumentId: string; market: string }[];
  holdingsQuotesByInstrument?: Readonly<Record<string, unknown>>;
  holdingsCandlesByInstrument?: Readonly<Record<string, unknown>>;
  marketDataDailyStatuses?: Readonly<Record<string, string | undefined>>;
  marketDataJobs?: Readonly<Record<string, unknown>>;
  qualityInput?: {
    marketDataStatuses?: Readonly<Record<string, unknown>>;
    marketDataDailyStatuses?: Readonly<Record<string, unknown>>;
    marketDataCandles?: Readonly<Record<string, unknown>>;
    marketDataLabels?: Readonly<Record<string, unknown>>;
    marketDataJobs?: Readonly<Record<string, unknown>>;
  };
};

function summarizeCandleBoundary(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const candle = value as Record<string, unknown>;
  return {
    instrumentId: candle.instrumentId,
    tradingDate: candle.tradingDate,
    timestamp: candle.timestamp,
    interval: candle.interval,
    close: candle.close,
    currency: candle.currency,
    provider: candle.provider,
    fetchedAt: candle.fetchedAt,
  };
}

function summarizeCandleCollection(value: unknown): Record<string, unknown> {
  const candles = Array.isArray(value) ? value : [];
  return {
    count: candles.length,
    first: summarizeCandleBoundary(candles[0]),
    last: summarizeCandleBoundary(candles.at(-1)),
  };
}

function summarizeQuote(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const quote = value as Record<string, unknown>;
  return {
    price: quote.price,
    currency: quote.currency,
    quoteDate: quote.quoteDate,
    fetchedAt: quote.fetchedAt,
    provider: quote.provider,
    freshness: quote.freshness,
  };
}

function summarizeCoverage(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const coverage = value as Record<string, unknown>;
  return {
    startDate: coverage.startDate,
    endDate: coverage.endDate,
    requestedStart: coverage.requestedStart,
    requestedEnd: coverage.requestedEnd,
    actualStart: coverage.actualStart,
    actualEnd: coverage.actualEnd,
    status: coverage.status,
    provider: coverage.provider,
    missingTradingDates: Array.isArray(coverage.missingTradingDates)
      ? coverage.missingTradingDates.slice(0, 8)
      : undefined,
    missingTradingDateCount: Array.isArray(coverage.missingTradingDates)
      ? coverage.missingTradingDates.length
      : undefined,
    reason: coverage.reason,
  };
}

function summarizeMarketRead(read: MarketDataRead): Record<string, unknown> {
  return {
    dailyCandles: summarizeCandleCollection(read.dailyCandles),
    candles: summarizeCandleCollection(read.candles),
    coverage: Array.isArray(read.coverage) ? read.coverage.map(summarizeCoverage) : [],
    intervalCoverage: Array.isArray(read.intervalCoverage)
      ? read.intervalCoverage.map(summarizeCoverage)
      : [],
  };
}

function summarizeDashboardJobs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([instrumentId, rawJob]) => {
    if (!rawJob || typeof rawJob !== "object") return [instrumentId, rawJob];
    const job = rawJob as Record<string, unknown>;
    const intervals = Array.isArray(job.intervals)
      ? job.intervals.map(interval => {
          if (!interval || typeof interval !== "object") return interval;
          const item = interval as Record<string, unknown>;
          return {
            interval: item.interval,
            status: item.status,
            coverageStart: item.coverageStart,
            coverageEnd: item.coverageEnd,
            message: item.message,
            error: item.error,
          };
        })
      : undefined;
    return [instrumentId, {
      requestedAt: job.requestedAt,
      status: job.status,
      message: job.message,
      error: job.error,
      intervals,
    }];
  }));
}

function summarizeDashboardProps(props: {
  visible?: boolean;
  holdingsDataReady?: boolean;
  holdingsAsOf?: string;
  holdingsHydrationRetryInstruments?: readonly { instrumentId: string; market: string }[];
  holdingsQuotesByInstrument?: Readonly<Record<string, unknown>>;
  holdingsCandlesByInstrument?: Readonly<Record<string, unknown>>;
  marketDataDailyStatuses?: Readonly<Record<string, string | undefined>>;
  marketDataJobs?: Readonly<Record<string, unknown>>;
  qualityInput?: {
    marketDataStatuses?: Readonly<Record<string, unknown>>;
    marketDataDailyStatuses?: Readonly<Record<string, unknown>>;
    marketDataCandles?: Readonly<Record<string, unknown>>;
    marketDataLabels?: Readonly<Record<string, unknown>>;
    marketDataJobs?: Readonly<Record<string, unknown>>;
  };
}): DashboardDiagnosticSnapshot {
  const summarizeQuotes = (quotes: Readonly<Record<string, unknown>> | undefined) =>
    Object.fromEntries(Object.entries(quotes ?? {}).map(([instrumentId, quote]) => [instrumentId, summarizeQuote(quote)]));
  const summarizeCandles = (candles: Readonly<Record<string, unknown>> | undefined) =>
    Object.fromEntries(Object.entries(candles ?? {}).map(([instrumentId, values]) => [instrumentId, summarizeCandleCollection(values)]));
  const quality = props.qualityInput;
  return {
    visible: props.visible,
    holdingsDataReady: props.holdingsDataReady,
    holdingsAsOf: props.holdingsAsOf,
    holdingsHydrationRetryInstruments: props.holdingsHydrationRetryInstruments?.map(value => ({ ...value })),
    holdingsQuotesByInstrument: summarizeQuotes(props.holdingsQuotesByInstrument),
    holdingsCandlesByInstrument: summarizeCandles(props.holdingsCandlesByInstrument),
    marketDataDailyStatuses: props.marketDataDailyStatuses,
    marketDataJobs: summarizeDashboardJobs(props.marketDataJobs),
    qualityInput: quality ? {
      marketDataStatuses: quality.marketDataStatuses,
      marketDataDailyStatuses: quality.marketDataDailyStatuses,
      marketDataCandles: summarizeCandles(quality.marketDataCandles),
      marketDataLabels: quality.marketDataLabels,
      marketDataJobs: summarizeDashboardJobs(quality.marketDataJobs),
    } : undefined,
  };
}

const holdingsReadinessProbe = vi.hoisted(() => ({
  latest: undefined as {
    initialDataReady?: boolean;
    onRefresh?: (instrumentIds: readonly string[], trigger?: "automatic" | "manual") => unknown;
    onCancel?: (instrumentIds?: readonly string[]) => unknown;
    instruments?: readonly { instrumentId: string; market: string }[];
    scopeInstruments?: readonly { instrumentId: string; market: string }[];
    phase?: string;
    active?: boolean;
    announcement?: string | null;
    scopeKey?: string;
    asOf?: string;
    historyInputReady?: boolean;
    holdingsDataReady?: boolean;
    holdingsHydrationRetryInstruments?: readonly { instrumentId: string; market: string }[];
    marketDataDailyStatuses?: Readonly<Record<string, string | undefined>>;
    marketDataJobs?: Readonly<Record<string, unknown>>;
  } | undefined,
  refreshes: [] as Array<{
    instrumentIds: readonly string[];
    trigger: "automatic" | "manual";
    promise: Promise<unknown>;
    settled: boolean;
    settlement?: "fulfilled" | "rejected";
  }>,
}));

const dashboardPropsProbe = vi.hoisted(() => ({
  latest: undefined as DashboardDiagnosticSnapshot | undefined,
}));

vi.mock("./dashboard/review-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dashboard/review-dashboard")>();
  return {
    ...actual,
    ReviewDashboard: (props: Parameters<typeof actual.ReviewDashboard>[0]) => {
      dashboardPropsProbe.latest = summarizeDashboardProps(props);
      return actual.ReviewDashboard(props);
    },
  };
});

vi.mock("../lib/fx/use-fx-rates", () => ({
  useFxRates: () => ({
    state: {
      id: "fx:test",
      baseCurrency: "CNY",
      source: "BOC",
      publishedAt: "2026-10-06T00:00:00.000Z",
      publishedAtByCurrency: { USD: "2026-10-06T00:00:00.000Z", HKD: "2026-10-06T00:00:00.000Z" },
      fetchedAt: "2026-10-06T00:00:00.000Z",
      rates: { USD: "7.1", HKD: "0.91" },
      lastAttemptDay: "2026-10-06",
      status: "complete",
      error: null,
    },
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(async () => undefined),
  }),
}));

// Keep the homepage's independent automatic holdings valuation idle. This is
// the same bounded hook fixture used by the existing workspace refresh suite;
// the market publication path under test remains the real workspace effect
// and the injected storage client's getMarketData boundary. The probe keeps
// the readiness handoff observable without replacing the dashboard consumer.
vi.mock("./dashboard/use-holdings-valuation-refresh", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dashboard/use-holdings-valuation-refresh")>();
  type RefreshInput = Parameters<typeof actual.useHoldingsValuationRefresh>[0];

  return {
    ...actual,
    useHoldingsValuationRefresh: (input: RefreshInput) => {
      const observedInput: RefreshInput = {
        ...input,
        // Keep the real hook's manual request/cancel/phase state, while
        // preventing its independent automatic effect from competing with
        // the explicit homepage journey in this fixture.
        visible: false,
        onRefresh: (instrumentIds, trigger) => {
          const result = input.onRefresh(instrumentIds, trigger);
          const promise = Promise.resolve(result);
          const refresh: {
            instrumentIds: readonly string[];
            trigger: "automatic" | "manual";
            promise: Promise<unknown>;
            settled: boolean;
            settlement?: "fulfilled" | "rejected";
          } = {
            instrumentIds,
            trigger: trigger ?? "manual",
            promise,
            settled: false,
          };
          promise.then(
            () => {
              refresh.settled = true;
              refresh.settlement = "fulfilled";
            },
            () => {
              refresh.settled = true;
              refresh.settlement = "rejected";
            },
          );
          holdingsReadinessProbe.refreshes.push(refresh);
          return result;
        },
      };
      holdingsReadinessProbe.latest = observedInput;
      const result = actual.useHoldingsValuationRefresh(observedInput);
      holdingsReadinessProbe.latest = {
        ...observedInput,
        phase: result.phase,
        active: result.active,
        announcement: result.announcement,
        scopeKey: input.scopeKey,
        asOf: input.asOf,
        historyInputReady: input.historyInputReady,
        holdingsDataReady: input.initialDataReady,
        marketDataDailyStatuses: input.marketDataDailyStatuses,
        marketDataJobs: summarizeDashboardJobs(input.marketDataJobs),
      };
      return result;
    },
  };
});

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
  isSettled: () => boolean;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  let settled = false;
  const promise = new Promise<T>((res, rej) => {
    resolve = value => {
      settled = true;
      res(value);
    };
    reject = error => {
      settled = true;
      rej(error);
    };
  });
  return { promise, resolve, reject, isSettled: () => settled };
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

const retryScopeInstruments = [
  {
    id: "US:QQQ",
    symbol: "QQQ",
    name: "纳斯达克100 ETF",
    market: "US",
    currency: "USD",
  },
  {
    id: "US:SPY",
    symbol: "SPY",
    name: "标普500 ETF",
    market: "US",
    currency: "USD",
  },
] as const;

type FixtureInstrument =
  | typeof instrument
  | typeof unrelatedInstrument
  | (typeof retryScopeInstruments)[number];

function execution(input: {
  id: string;
  row: number;
  executedAt: string;
  instrument?: FixtureInstrument;
  side?: "buy" | "sell";
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
    side: input.side ?? "buy",
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

function closedHistoricalImportFile(observe?: ClosedProducerObserve): File {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "成交时间", "账户名称", "账户号码", "品类", "代码名称", "交易所/市场",
      "方向", "交收日期", "币种", "数量/面值", "价格", "成交金额", "总费用", "变动金额",
    ],
    ["2025-10-06 16:30:00", "富途", "acct", "证券", "NIO 蔚来汽车", "US", "买入开仓", "20251008", "USD", "10", "10", "-100", "0", "-100"],
    ["2025-10-06 17:30:00", "富途", "acct", "证券", "NIO 蔚来汽车", "US", "卖出平仓", "20251008", "USD", "10", "10", "100", "0", "100"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "证券-交易流水");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const file = new File([buffer], "closed-nio-episode.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => {
      observe?.("before-file-array-buffer");
      const result = buffer;
      observe?.("after-file-array-buffer");
      return result;
    },
  });
  return file;
}

function dailyReadFor(
  target: typeof instrument | typeof unrelatedInstrument,
  variant: "d0" | "d1" = "d0",
  year = "2026",
): MarketDataRead {
  const d1 = variant === "d1";
  const providerSymbol = target.symbol;
  const extraDailyCandle: DailyCandleRecord = {
    instrumentId: target.id,
    tradingDate: `${year}-10-02`,
    open: "102",
    high: "102",
    low: "102",
    close: "102",
    volume: "110",
    currency: target.currency,
    provider: "yahoo",
    providerSymbol,
    adjustmentMode: "raw",
    fetchedAt: "2026-10-06T00:00:00.000Z",
  };
  // The imported closed NIO episode ends on 2025-10-06. Keep the recovery
  // fixture's final daily candle aligned with that raw execution boundary;
  // the 2026 fixtures retain their existing 2026-10-05 endpoint.
  const latestTradingDate = d1 && year === "2025" ? `${year}-10-06` : `${year}-10-05`;
  const latestDailyCandle: DailyCandleRecord = {
    instrumentId: target.id,
    tradingDate: latestTradingDate,
    open: d1 ? "101" : "100",
    high: d1 ? "101" : "100",
    low: d1 ? "101" : "100",
    close: d1 ? "101" : "100",
    volume: "100",
    currency: target.currency,
    provider: "yahoo",
    providerSymbol,
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
      startDate: d1 ? `${year}-10-02` : `${year}-10-05`,
      endDate: latestTradingDate,
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
      currency: instrument.currency,
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

function dailyRead(variant: "d0" | "d1" = "d0"): MarketDataRead {
  return dailyReadFor(instrument, variant);
}

type RecoveryMode = "manual" | "closedHistorical";
type RecoveryTransportResult = "failure" | "success";
type RecoveryTransportCall = {
  endpoint: "daily" | "intraday" | "other";
  result: RecoveryTransportResult;
  url: string;
  instrumentId?: string;
};

type RecoveryTransport = {
  calls: RecoveryTransportCall[];
  setResult: (result: RecoveryTransportResult) => void;
  onSettled: (listener: (call: RecoveryTransportCall) => void) => void;
};

type RecoveryDailyRequest = {
  instrumentId: string;
  interval: "1D" | "1h" | "15m";
  dailyOnly?: boolean;
  start?: string;
  end?: string;
};

type FixtureMarketDataRequest = {
  input: Parameters<NonNullable<ReturnType<typeof createLegacySqliteClient>["getMarketData"]>>[0];
  signal?: AbortSignal;
  source: string;
};

type MarketRefreshReceipt = {
  requestStart: number;
  providerStart: number;
  jobStart: number;
};

type RecoveryReceiptCursor = {
  requestCount: number;
  jobCount: number;
  requests: FixtureMarketDataRequest[];
};

type ClosedHistoricalImportReceipt = MarketRefreshReceipt & {
  requests: FixtureMarketDataRequest[];
  providerCalls: RecoveryTransportCall[];
  jobs: MarketDataJob[];
};

type ClosedProducerTracePhase = {
  sequence: number;
  label: string;
  details?: Record<string, unknown>;
};

type ClosedProducerTrace = {
  mark: (label: string, details?: Record<string, unknown>) => void;
  phaseCount: () => number;
  count: (label: string, predicate?: (details?: Record<string, unknown>) => boolean) => number;
  dump: (label: string, receipt: unknown, error?: unknown) => void;
  has: (label: string, predicate?: (details?: Record<string, unknown>) => boolean) => boolean;
};

type ClosedProducerObserve = (label: string, details?: Record<string, unknown>) => void;

function traceError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { value: String(error) };
}

function traceMarketDataInput(input: FixtureMarketDataRequest["input"]): Record<string, unknown> {
  return {
    instrumentId: input.instrumentId,
    interval: input.interval,
    dailyOnly: input.dailyOnly ?? false,
    start: input.start,
    end: input.end,
  };
}

function traceMarketDataJob(job: MarketDataJob): Record<string, unknown> {
  const daily = job.intervals.find(interval => interval.interval === "1D");
  return {
    instrumentId: job.instrumentId,
    symbol: job.symbol,
    market: job.market,
    requestedAt: job.requestedAt,
    status: job.status,
    dailyStatus: daily?.status,
    intervals: job.intervals.map(interval => ({
      interval: interval.interval,
      status: interval.status,
    })),
  };
}

function observeClosedProducerPromise<T>(
  trace: ClosedProducerTrace | undefined,
  label: string,
  value: T | PromiseLike<T>,
  details: Record<string, unknown> = {},
): T | PromiseLike<T> {
  if (!trace) return value;
  return Promise.resolve(value).then(
    result => {
      trace.mark(`${label}:complete`, details);
      return result;
    },
    error => {
      trace.mark(`${label}:error`, { ...details, error: traceError(error) });
      throw error;
    },
  );
}

function createClosedProducerTrace(name: string): ClosedProducerTrace {
  const phases: ClosedProducerTracePhase[] = [];
  let sequence = 0;
  const maxPhases = 400;
  const mark = (label: string, details?: Record<string, unknown>) => {
    if (phases.length >= maxPhases) return;
    phases.push({ sequence: ++sequence, label, ...(details ? { details } : {}) });
  };
  const toJson = (value: unknown) => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  return {
    mark,
    phaseCount: () => phases.length,
    count: (label, predicate) => phases.filter(phase =>
      phase.label === label && (!predicate || predicate(phase.details))).length,
    has: (label, predicate) => phases.some(phase =>
      phase.label === label && (!predicate || predicate(phase.details))),
    dump: (label, receipt, error) => {
      console.info(`[PA-I109] ${name} ${label} ${toJson({
        phases,
        ...(error ? { error: traceError(error) } : {}),
        receipt,
      })}`);
    },
  };
}

type ControlledRateWait = {
  pendingCount: () => number;
  advance: (label: string) => void;
};

const CONTROLLED_MARKET_FETCH_WAITS_MS = new Set([2_100, 4_200, 6_300]);
const CLOSED_JOURNEY_DIAGNOSTIC_DEADLINE_MS = 4_500;

/**
 * Hold only the bounded cadence waits created by the real market fetcher
 * after initial fixture hydration. The shared batch fetcher advances its
 * `nextRequestAt` cumulatively while the test clock is fixed, so a later
 * request can wait 4200ms or 6300ms even though its configured interval is
 * 2100ms. RTL and React timers, including all other delays, continue to use
 * the real clock; each advance below owns one timer the product actually
 * started instead of resolving a future provider or consumer read.
 */
function installControlledRateWait(trace: ClosedProducerTrace): ControlledRateWait {
  const originalSetTimeout = globalThis.setTimeout as unknown as (...args: unknown[]) => unknown;
  const originalClearTimeout = globalThis.clearTimeout as unknown as (handle: unknown) => void;
  const pending = new Map<number, { callback: () => void; delayMs: number }>();
  let nextTimerId = 1;

  const controlledSetTimeout = (handler: unknown, timeout?: number, ...args: unknown[]) => {
    const delayMs = Number(timeout ?? 0);
    // The same numeric delays are valid for unrelated UI/library timers. Use
    // the production fetcher's call-site as the ownership boundary instead of
    // taking over every timer with a matching duration.
    const callerStack = new Error().stack ?? "";
    const isMarketFetchCadence = callerStack.includes("market-data-fetch");
    if (!isMarketFetchCadence || !CONTROLLED_MARKET_FETCH_WAITS_MS.has(delayMs)) {
      return originalSetTimeout(handler, timeout, ...args);
    }
    const timerId = nextTimerId++;
    const callback = typeof handler === "function"
      ? () => (handler as (...callbackArgs: unknown[]) => void)(...args)
      : () => { throw new TypeError("the controlled rate wait received a non-callable timer handler"); };
    pending.set(timerId, { callback, delayMs });
    trace.mark("test.rate-wait:started", {
      timerId,
      delayMs,
      pendingCount: pending.size,
    });
    return timerId;
  };
  const controlledClearTimeout = (handle: unknown) => {
    if (typeof handle === "number" && pending.delete(handle)) {
      trace.mark("test.rate-wait:cancelled", {
        timerId: handle,
        pendingCount: pending.size,
      });
      return;
    }
    originalClearTimeout(handle);
  };
  vi.stubGlobal("setTimeout", controlledSetTimeout as typeof globalThis.setTimeout);
  vi.stubGlobal("clearTimeout", controlledClearTimeout as typeof globalThis.clearTimeout);

  return {
    pendingCount: () => pending.size,
    advance: label => {
      const next = pending.entries().next();
      if (next.done) throw new Error(`[PA-I146 ${label}] no started market-fetch cadence wait is pending`);
      const [timerId, timer] = next.value;
      pending.delete(timerId);
      const logicalBefore = Date.now();
      const logicalAfter = logicalBefore + timer.delayMs;
      trace.mark("test.rate-wait:advance:before", {
        label,
        timerId,
        delayMs: timer.delayMs,
        logicalNow: logicalBefore,
        pendingCount: pending.size + 1,
      });
      // The real fetcher computes its next cadence from Date.now(). Advance
      // only the product delay that was actually captured above; React/RTL
      // timers and all future provider/consumer promises remain real.
      vi.setSystemTime(new Date(logicalAfter));
      timer.callback();
      trace.mark("test.rate-wait:advance:after", {
        label,
        timerId,
        delayMs: timer.delayMs,
        logicalNow: Date.now(),
        pendingCount: pending.size,
      });
    },
  };
}

async function drainObservedRateWaits(
  trace: ClosedProducerTrace,
  controller: ControlledRateWait,
  label: string,
  complete: () => boolean,
  maxAdvances = 8,
) {
  let advances = 0;
  const startedAt = performance.now();
  while ((!complete() || controller.pendingCount() > 0) && advances < maxAdvances) {
    const phaseCountBeforeWait = trace.phaseCount();
    try {
      await waitFor(() => {
        // The import/retry promise can still be in its UI setup phase before
        // the real fetcher schedules a cadence wait. Continue only when the
        // real journey has advanced, the import settled, or a production
        // cadence wait was actually captured. The phase count is the trace's
        // event boundary; it does not resolve a provider, storage, job, or
        // consumer promise.
        if (complete() || controller.pendingCount() > 0 || trace.phaseCount() > phaseCountBeforeWait) return;
        throw new Error(`[PA-I170 ${label}] waiting for completion, observed phase progress, or an observed market-fetch cadence wait`);
      });
    } catch (error) {
      const elapsedMs = performance.now() - startedAt;
      if (elapsedMs >= CLOSED_JOURNEY_DIAGNOSTIC_DEADLINE_MS) {
        trace.mark("test.rate-wait:no-cadence-before-completion", {
          label,
          advances,
          elapsedMs,
          pendingRateWaitCount: controller.pendingCount(),
          complete: complete(),
          phaseCount: trace.phaseCount(),
        });
        throw error;
      }
      // Keep the existing RTL one-second assertion as a polling window, but
      // do not turn a quiet window into a failure while the real producer is
      // still allowed to publish its next observed phase. The original
      // bounded diagnostic deadline remains the outer cap.
      trace.mark("test.rate-wait:progress-window-expired", {
        label,
        advances,
        elapsedMs,
        pendingRateWaitCount: controller.pendingCount(),
        complete: complete(),
        phaseCount: trace.phaseCount(),
      });
      await Promise.resolve();
      continue;
    }
    if (complete()) break;
    if (controller.pendingCount() === 0) {
      // A producer phase was observed without a cadence timer. Give its
      // promise continuation a turn, then await the next actual phase.
      await Promise.resolve();
      continue;
    }
    advances += 1;
    await act(async () => {
      controller.advance(`${label}:${advances}`);
    });
    await Promise.resolve();
  }
  await waitFor(() => expect(complete()).toBe(true));
  await waitFor(() => expect(controller.pendingCount()).toBe(0));
  trace.mark("test.rate-wait:phase-complete", { label, advances });
}

function captureClosedProducerTraceReceipt(
  fixture: ReturnType<typeof createFixture>,
  start: MarketRefreshReceipt,
) {
  const observedSources = new Set(fixture.requests.slice(start.requestStart).map(({ source }) => source));
  const deferredState = (source: string, settled: boolean) => ({
    source,
    observed: observedSources.has(source),
    settled,
  });
  return {
    ...start,
    requests: fixture.requests.slice(start.requestStart).map(({ input, source }) => ({
      ...traceMarketDataInput(input),
      source,
    })),
    committedReadbacks: fixture.marketDataReadbacks
      .filter(readback => Number(readback.requestIndex ?? -1) >= start.requestStart)
      .slice(0, 32),
    providerCalls: fixture.recovery?.calls.slice(start.providerStart) ?? [],
    jobs: fixture.putMarketDataJob.mock.calls
      .slice(start.jobStart)
      .map(([job]) => traceMarketDataJob(job)),
    allJobs: fixture.putMarketDataJob.mock.calls.map(([job], jobIndex) => ({
      jobIndex,
      ...traceMarketDataJob(job),
    })),
    deferredReads: [
      deferredState("xpev-d1", fixture.d1.isSettled()),
      ...fixture.manualDailyReads.map((read, index) => deferredState(`xpev-manual-${index}`, read.isSettled())),
      deferredState("xpev-i1", fixture.i1.isSettled()),
      deferredState("xpev-i2", fixture.i2.isSettled()),
      deferredState("xpev-i15", fixture.i15.isSettled()),
      deferredState("nio-j0", fixture.j0.isSettled()),
      deferredState("nio-j1", fixture.j1.isSettled()),
      ...fixture.manualNioDailyReads.map((read, index) => deferredState(`nio-manual-${index}`, read.isSettled())),
    ],
    recovery: fixture.recovery && {
      producerStorageReadRequested: fixture.recovery.producerStorageReadRequested,
      producerSettled: fixture.recovery.producerSettled,
      consumerReadRequested: fixture.recovery.consumerReadRequested,
      providerFailure: fixture.recovery.hasProviderFailure(),
    },
    hook: holdingsReadinessProbe.latest && {
      phase: holdingsReadinessProbe.latest.phase,
      active: holdingsReadinessProbe.latest.active,
      initialDataReady: holdingsReadinessProbe.latest.initialDataReady,
      announcement: holdingsReadinessProbe.latest.announcement,
      instruments: holdingsReadinessProbe.latest.instruments?.map(value => value.instrumentId),
      scopeInstruments: holdingsReadinessProbe.latest.scopeInstruments?.map(value => value.instrumentId),
      scopeKey: holdingsReadinessProbe.latest.scopeKey,
      asOf: holdingsReadinessProbe.latest.asOf,
      historyInputReady: holdingsReadinessProbe.latest.historyInputReady,
      holdingsDataReady: holdingsReadinessProbe.latest.holdingsDataReady,
      holdingsHydrationRetryInstruments: holdingsReadinessProbe.latest.holdingsHydrationRetryInstruments,
      marketDataDailyStatuses: holdingsReadinessProbe.latest.marketDataDailyStatuses,
      marketDataJobs: holdingsReadinessProbe.latest.marketDataJobs,
    },
    dashboard: dashboardPropsProbe.latest,
    refreshes: holdingsReadinessProbe.refreshes.map(refresh => ({
      instrumentIds: [...refresh.instrumentIds],
      trigger: refresh.trigger,
      settled: refresh.settled,
      settlement: refresh.settlement,
    })),
  };
}

async function waitForClosedProducerTrace(
  trace: ClosedProducerTrace,
  fixture: ReturnType<typeof createFixture>,
  label: string,
  start: MarketRefreshReceipt,
  assertion: () => unknown | Promise<unknown>,
) {
  try {
    return await waitFor(assertion);
  } catch (error) {
    trace.dump(label, captureClosedProducerTraceReceipt(fixture, start), error);
    throw error;
  }
}

/**
 * Keep a real-clock snapshot available before Vitest's five-second test guard
 * cuts off a closed-only journey. The timer is armed before the market-fetch
 * cadence shim, so it cannot be mistaken for a provider wait or release a
 * product-owned promise. It only records the state already observable at the
 * deadline and is cleared by a journey that reaches its final assertion.
 */
function armClosedJourneyDeadlineTrace(
  trace: ClosedProducerTrace,
  fixture: ReturnType<typeof createFixture>,
  label: string,
): () => void {
  let expired = false;
  const timer = window.setTimeout(() => {
    expired = true;
    trace.mark("test.deadline:expired", { label });
    trace.dump(
      `test.${label}:deadline`,
      captureClosedProducerTraceReceipt(fixture, { requestStart: 0, providerStart: 0, jobStart: 0 }),
      new Error(`[PA-I166 ${label}] bounded diagnostic deadline reached`),
    );
  }, CLOSED_JOURNEY_DIAGNOSTIC_DEADLINE_MS);
  return () => {
    if (expired) return;
    window.clearTimeout(timer);
    trace.mark("test.deadline:cleared", { label });
  };
}

function hasTerminalDailyReceipt(job: MarketDataJob): boolean {
  const dailyInterval = job.intervals.find(interval => interval.interval === "1D");
  return job.status !== "syncing" &&
    dailyInterval !== undefined &&
    dailyInterval.status !== "syncing" &&
    dailyInterval.status !== "not-requested";
}

function hasTerminalHourlyReceipt(job: MarketDataJob): boolean {
  const hourlyInterval = job.intervals.find(interval => interval.interval === "1h");
  return job.status !== "syncing" &&
    hourlyInterval !== undefined &&
    hourlyInterval.status === "complete";
}

type RecoveryController = {
  mode: RecoveryMode;
  calls: RecoveryTransportCall[];
  markHydrationFailure: () => void;
  armFailedAttempt: () => void;
  beginSuccessfulImportAttempt: () => void;
  beginSuccessfulAttempt: () => void;
  markProducerTerminal: (job: MarketDataJob, jobIndex: number) => void;
  hasProviderFailure: () => boolean;
  producerStorageReadRequested: boolean;
  producerSettled: boolean;
  consumerReadRequested: boolean;
  resolveConsumerRead: (value: MarketDataRead) => void;
  rejectConsumerRead: (error: unknown) => void;
  readDaily: (request: RecoveryDailyRequest) => MarketDataRead | PromiseLike<MarketDataRead> | undefined;
};

function weekdayDates(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [start];
  const dates: string[] = [];
  for (const cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates.length > 0 ? dates : [start];
}

// Keep the closed-import success payload aligned with the production
// intraday completeness predicate.  The production session table is private,
// so this fixture mirrors those regular-session slots while using the shared
// holiday calendar and the exact requested range.  A single synthetic candle
// is intentionally retained for manual/partial and failure journeys below.
const FIXTURE_MARKET_SESSIONS: Record<
  SupportedMarket,
  ReadonlyArray<{ startMinute: number; endMinute: number }>
> = {
  US: [{ startMinute: 9 * 60 + 30, endMinute: 16 * 60 }],
  HK: [
    { startMinute: 9 * 60 + 30, endMinute: 12 * 60 },
    { startMinute: 13 * 60, endMinute: 16 * 60 },
  ],
  "CN-SH": [
    { startMinute: 9 * 60 + 30, endMinute: 11 * 60 + 30 },
    { startMinute: 13 * 60, endMinute: 15 * 60 },
  ],
  "CN-SZ": [
    { startMinute: 9 * 60 + 30, endMinute: 11 * 60 + 30 },
    { startMinute: 13 * 60, endMinute: 15 * 60 },
  ],
};

function isSupportedMarket(value: string): value is SupportedMarket {
  return value === "US" ||
    value === "HK" ||
    value === "CN-SH" ||
    value === "CN-SZ";
}

function expectedFixtureIntradayTimestamps(
  startTime: string,
  endTime: string,
  market: string,
  interval: NativeIntradayInterval,
): string[] {
  if (!isSupportedMarket(market)) return [];
  let tradingDates: string[];
  try {
    tradingDates = expectedTradingDates(
      market,
      marketTradingDate(startTime, market),
      marketTradingDate(endTime, market),
    );
  } catch (error) {
    if (error instanceof CalendarOutOfRangeError) return [];
    throw error;
  }
  const timeZone = marketTimeZone(market);
  const stepMinutes = interval === "1h" ? 60 : 15;
  return tradingDates.flatMap((date) =>
    FIXTURE_MARKET_SESSIONS[market].flatMap((session) => {
      const timestamps: string[] = [];
      for (
        let minute = session.startMinute;
        minute < session.endMinute;
        minute += stepMinutes
      ) {
        const hour = Math.floor(minute / 60);
        const minuteWithinHour = minute % 60;
        const timestamp = marketLocalTimestampToIso(
          `${date} ${String(hour).padStart(2, "0")}:${String(
            minuteWithinHour,
          ).padStart(2, "0")}:00`,
          timeZone,
        );
        if (timestamp >= startTime && timestamp <= endTime) {
          timestamps.push(timestamp);
        }
      }
      return timestamps;
    }),
  );
}

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createRecoveryTransport(mode: RecoveryMode, trace?: ClosedProducerTrace): RecoveryTransport {
  let result: RecoveryTransportResult = "failure";
  let settledListener: (call: RecoveryTransportCall) => void = () => undefined;
  const calls: RecoveryTransportCall[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://trade-review.test");
    const endpoint: RecoveryTransportCall["endpoint"] = url.pathname.endsWith("/daily")
      ? "daily"
      : url.pathname.endsWith("/intraday")
        ? "intraday"
        : "other";
    const market = url.searchParams.get("market") ?? "US";
    const symbol = url.searchParams.get("symbol") ?? (mode === "closedHistorical" ? unrelatedInstrument.symbol : instrument.symbol);
    const call = {
      endpoint,
      result,
      url: url.toString(),
      ...(endpoint === "daily" || endpoint === "intraday"
        ? { instrumentId: `${market}:${symbol}` }
        : {}),
    } satisfies RecoveryTransportCall;
    calls.push(call);
    trace?.mark("provider.fetch:entry", {
      endpoint: call.endpoint,
      instrumentId: call.instrumentId,
      result: call.result,
      url: call.url,
    });
    settledListener(call);
    trace?.mark("provider.fetch:observer-notified", {
      endpoint: call.endpoint,
      instrumentId: call.instrumentId,
      result: call.result,
    });
    try {
      const response = (value: Response) => {
        trace?.mark("provider.fetch:return", {
          endpoint: call.endpoint,
          instrumentId: call.instrumentId,
          result: call.result,
          status: value.status,
        });
        return value;
      };
      if (result === "failure" || endpoint === "other") {
        return response(responseJson({ error: { code: "source-unavailable", message: `${mode} fixture provider failure` } }, 503));
      }

      const instrumentId = `${market}:${symbol}`;
      const fetchedAt = "2026-10-06T00:00:00.000Z";
      if (endpoint === "daily") {
        const startDate = url.searchParams.get("start") ?? "2026-10-05";
        const endDate = url.searchParams.get("end") ?? startDate;
        return response(responseJson({
        provider: "yahoo",
        providerSymbol: symbol,
        fetchedAt,
        adjustmentMode: "raw",
        candles: weekdayDates(startDate, endDate).map((tradingDate, index, dates) => ({
          tradingDate,
          open: index === dates.length - 1 ? "101" : "102",
          high: index === dates.length - 1 ? "101" : "102",
          low: index === dates.length - 1 ? "101" : "102",
          close: index === dates.length - 1 ? "101" : "102",
          volume: "100",
        })),
        warnings: [],
        request: {
          instrumentId,
          symbol,
          market,
          startDate,
          endDate,
        },
        }));
      }

      const startTime = url.searchParams.get("start") ?? "2026-10-05T15:00:00.000Z";
      const endTime = url.searchParams.get("end") ?? startTime;
      const interval = (url.searchParams.get("interval") ?? "1h") as "15m" | "1h";
      const timestamps = mode === "closedHistorical" && interval === "1h"
        ? expectedFixtureIntradayTimestamps(startTime, endTime, market, interval)
        : [startTime];
      return response(responseJson({
      provider: "yahoo",
      providerSymbol: symbol,
      fetchedAt,
      interval,
      adjustmentMode: "raw",
      candles: timestamps.map(timestamp => ({
        timestamp,
        knowledgeAt: endTime,
        open: "10",
        high: "10.2",
        low: "9.8",
        close: "10.1",
        volume: "100",
      })),
      warnings: [],
      request: {
        instrumentId,
        symbol,
        market,
        interval,
        startTime,
        endTime,
      },
      }));
    } catch (error) {
      trace?.mark("provider.fetch:error", {
        endpoint: call.endpoint,
        instrumentId: call.instrumentId,
        result: call.result,
        error: traceError(error),
      });
      throw error;
    }
  });
  vi.stubGlobal("fetch", fetcher);
  return {
    calls,
    setResult: next => { result = next; },
    onSettled: listener => { settledListener = listener; },
  };
}

function recoveryProducerRead(value: MarketDataRead): MarketDataRead {
  const latest = value.dailyCandles?.at(-1);
  if (!latest) return value;
  return {
    ...value,
    dailyCandles: value.dailyCandles?.slice(0, -1),
    coverage: (value.coverage ?? []).map(segment => ({
      ...segment,
      status: "partial" as const,
      missingTradingDates: [...new Set([
        ...(segment.missingTradingDates ?? []),
        latest.tradingDate,
      ])],
      reason: "source-unavailable" as const,
    })),
  };
}

function createRecoveryController(
  mode: RecoveryMode,
  transport: RecoveryTransport,
  readReceipt: () => RecoveryReceiptCursor,
  trace?: ClosedProducerTrace,
): RecoveryController {
  let attempt: "idle" | "producer" | "consumer" | "failed" = "idle";
  let attemptResult: RecoveryTransportResult = "failure";
  let transportSettled = false;
  let consumerEnabled = false;
  let consumerRead = deferred<MarketDataRead>();
  let hydrationFailed = false;
  let attemptToken = 0;
  let activeAttempt: {
    token: number;
    requestStart: number;
    providerStart: number;
    jobStart: number;
    instrumentId: string;
    result: RecoveryTransportResult;
    syncingJob?: {
      token: number;
      jobIndex: number;
      requestedAt: string;
    };
  } | undefined;
  const relevantInstrumentId = mode === "closedHistorical" ? unrelatedInstrument.id : instrument.id;
  const readValue = mode === "closedHistorical"
    ? dailyReadFor(unrelatedInstrument, "d1", "2025")
    : dailyRead("d1");
  const producerRead = recoveryProducerRead(readValue);

  transport.onSettled(call => {
    trace?.mark("fixture.provider.onSettled:entry", {
      endpoint: call.endpoint,
      instrumentId: call.instrumentId,
      result: call.result,
    });
    const currentAttempt = activeAttempt;
    const providerIndex = transport.calls.indexOf(call);
    if (currentAttempt && providerIndex >= currentAttempt.providerStart &&
      (attempt === "producer" || (attempt === "failed" && !controller.producerSettled)) &&
      call.endpoint === "daily" && call.instrumentId === currentAttempt.instrumentId &&
      call.result === currentAttempt.result) {
      transportSettled = true;
      if (attemptResult === "failure") attempt = "failed";
    }
  });

  const begin = (next: RecoveryTransportResult, enableConsumer: boolean) => {
    const receipt = readReceipt();
    attempt = "producer";
    attemptResult = next;
    transportSettled = false;
    consumerEnabled = enableConsumer;
    consumerRead = deferred<MarketDataRead>();
    activeAttempt = {
      token: ++attemptToken,
      requestStart: receipt.requestCount,
      providerStart: transport.calls.length,
      jobStart: receipt.jobCount,
      instrumentId: relevantInstrumentId,
      result: next,
    };
    controller.producerStorageReadRequested = false;
    controller.producerSettled = false;
    controller.consumerReadRequested = false;
    transport.setResult(next);
    trace?.mark("fixture.recovery.attempt:begin", {
      mode,
      result: next,
      consumerEnabled: enableConsumer,
      token: activeAttempt.token,
      requestStart: receipt.requestCount,
      providerStart: activeAttempt.providerStart,
      jobStart: receipt.jobCount,
      instrumentId: activeAttempt.instrumentId,
    });
  };

  const controller: RecoveryController = {
    mode,
    calls: transport.calls,
    markHydrationFailure: () => {
      hydrationFailed = true;
      transport.setResult("failure");
      trace?.mark("fixture.recovery.control:hydration-failure");
    },
    armFailedAttempt: () => {
      hydrationFailed = true;
      trace?.mark("fixture.recovery.control:arm-failed-attempt");
      begin("failure", false);
    },
    beginSuccessfulImportAttempt: () => {
      // The public import follows the already failed hydration snapshot. Keep
      // the real recovery read on the producer path, but do not arm its owned
      // consumer until the visible valuation journey begins.
      hydrationFailed = true;
      trace?.mark("fixture.recovery.control:begin-successful-import");
      begin("success", false);
    },
    beginSuccessfulAttempt: () => begin("success", true),
    markProducerTerminal: (job, jobIndex) => {
      trace?.mark("fixture.putMarketDataJob:observed", {
        jobIndex,
        ...traceMarketDataJob(job),
      });
      const currentAttempt = activeAttempt;
      if (!currentAttempt || job.instrumentId !== currentAttempt.instrumentId || jobIndex < currentAttempt.jobStart) return;
      if (job.status === "syncing") {
        const dailyInterval = job.intervals?.find(interval => interval.interval === "1D");
        if (!currentAttempt.syncingJob && job.requestedAt && dailyInterval?.status === "syncing") {
          currentAttempt.syncingJob = {
            token: currentAttempt.token,
            jobIndex,
            requestedAt: job.requestedAt,
          };
        }
        return;
      }
      const syncingJob = currentAttempt.syncingJob;
      const dailyInterval = job.intervals?.find(interval => interval.interval === "1D");
      if (
        !syncingJob ||
        syncingJob.token !== currentAttempt.token ||
        jobIndex <= syncingJob.jobIndex ||
        job.requestedAt !== syncingJob.requestedAt ||
        !dailyInterval ||
        dailyInterval.status === "syncing" ||
        dailyInterval.status === "not-requested"
      ) return;
      const hasFreshProviderReceipt = transport.calls
        .slice(currentAttempt.providerStart)
        .some(call =>
          call.endpoint === "daily" &&
          call.instrumentId === currentAttempt.instrumentId &&
          call.result === currentAttempt.result,
        );
      const hasFreshStorageReceipt = readReceipt().requests
        .slice(currentAttempt.requestStart)
        .some(({ input }) =>
          input.instrumentId === currentAttempt.instrumentId &&
          input.dailyOnly &&
          input.interval === "1D",
        );
      if ((attempt === "producer" || (attempt === "failed" && !controller.producerSettled)) &&
        hasFreshProviderReceipt && hasFreshStorageReceipt) {
        transportSettled = true;
        controller.producerSettled = true;
        trace?.mark("fixture.recovery.producer-terminal:accepted", {
          jobIndex,
          ...traceMarketDataJob(job),
          hasFreshProviderReceipt,
          hasFreshStorageReceipt,
        });
      }
    },
    hasProviderFailure: () => transport.calls.some(call => call.endpoint === "daily" && call.result === "failure"),
    producerStorageReadRequested: false,
    producerSettled: false,
    consumerReadRequested: false,
    resolveConsumerRead: value => {
      trace?.mark("fixture.recovery.consumer-read:resolve");
      consumerRead.resolve(value);
    },
    rejectConsumerRead: error => {
      trace?.mark("fixture.recovery.consumer-read:reject", { error: traceError(error) });
      consumerRead.reject(error);
    },
    readDaily: request => {
      trace?.mark("fixture.recovery.readDaily:entry", {
        attempt,
        ...request,
      });
      if (!hydrationFailed || !request.dailyOnly || request.interval !== "1D" || request.instrumentId !== relevantInstrumentId) {
        trace?.mark("fixture.recovery.readDaily:skip", {
          attempt,
          ...request,
        });
        return undefined;
      }
      if (attempt === "producer") {
        controller.producerStorageReadRequested = true;
        if (!consumerEnabled || !controller.producerSettled) {
          return observeClosedProducerPromise<MarketDataRead>(
            trace,
            "fixture.recovery.readDaily:producer-read",
            Promise.resolve<MarketDataRead>(producerRead),
            { attempt, ...request },
          );
        }
        attempt = "consumer";
        controller.consumerReadRequested = true;
        return observeClosedProducerPromise<MarketDataRead>(
          trace,
          "fixture.recovery.readDaily:consumer-read",
          consumerRead.promise,
          { attempt, ...request },
        );
      }
      if (attempt === "failed") {
        return observeClosedProducerPromise<MarketDataRead>(
          trace,
          "fixture.recovery.readDaily:failed-read",
          Promise.reject<MarketDataRead>(new Error(`${mode} producer failure requires a bounded retry`)),
          { attempt, ...request },
        );
      }
      if (attempt === "consumer") {
        controller.consumerReadRequested = true;
        return observeClosedProducerPromise<MarketDataRead>(
          trace,
          "fixture.recovery.readDaily:consumer-read",
          consumerRead.promise,
          { attempt, ...request },
        );
      }
      return undefined;
    },
  };
  return controller;
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
  instruments: ReadonlyArray<FixtureInstrument> = [instrument],
  withMetadata = false,
): StorageBootstrap {
  const storedInstruments = instruments.map((item) => withMetadata
    ? {
        ...item,
        metadata: {
          market: item.market,
          symbol: item.symbol,
          name: item.name,
          assetType: "stock" as const,
          source: "statement" as const,
          confidence: "statement" as const,
          resolvedAt: "2026-10-06T00:00:00.000Z",
        },
      }
    : item);
  return {
    schemaVersion: 1,
    migration: null,
    executions,
    importHistory: [],
    instruments: storedInstruments,
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
  includeRetryScope?: boolean;
  includeClosedHistorical?: boolean;
  deferPrimaryDaily?: boolean;
  intradayFallback?: "native15m";
  recoveryMode?: RecoveryMode;
  closedProducerTrace?: ClosedProducerTrace;
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
    ...(options.includeRetryScope
      ? retryScopeInstruments.map((retryInstrument, index) => execution({
          id: `buy-${retryInstrument.symbol.toLowerCase()}-1430`,
          row: 6 + index,
          executedAt: "2026-10-05T14:30:00.000Z",
          instrument: retryInstrument,
        }))
      : []),
    ...(options.includeClosedHistorical
      ? [
          execution({
            id: "buy-nio-closed",
            row: 4,
            executedAt: "2025-10-05T14:30:00.000Z",
            instrument: unrelatedInstrument,
          }),
          execution({
            id: "sell-nio-closed",
            row: 5,
            executedAt: "2025-10-05T15:30:00.000Z",
            instrument: unrelatedInstrument,
            side: "sell",
          }),
        ]
      : []),
  ];
  const client = createLegacySqliteClient();
  const originalGetMarketData = client.getMarketData;
  const originalPutMarketData = client.putMarketData;
  let nioHourlyCommitObserved = false;
  let putMarketDataTail = Promise.resolve();
  client.putMarketData = input => {
    options.closedProducerTrace?.mark("fixture.adapter.putMarketData:entry", {
      kind: input.kind,
      instrumentId: input.result.instrumentId,
      interval: input.kind === "interval" ? input.result.interval : "1D",
      candleCount: input.result.candles.length,
      coverageCount: input.result.coverage.length,
    });
    // The production refresh starts daily and hourly commits concurrently. The
    // legacy test adapter routes both writes through fake IndexedDB, and both
    // transactions include the shared providerSymbols store. Serialize only
    // this retired adapter boundary so the test keeps the real PUT and later
    // readback while avoiding fake-IDB write scheduling contention.
    const commit = putMarketDataTail.then(async () => {
      try {
        const result = await originalPutMarketData(input);
        if (
          input.kind === "interval" &&
          input.result.instrumentId === unrelatedInstrument.id &&
          input.result.interval === "1h" &&
          input.result.candles.length > 0 &&
          input.result.coverage.length > 0
        ) {
          // The committed flag is deliberately set only after the real IndexedDB
          // transaction resolves. Before this point the closed-only read must
          // remain empty so the all-interval gate cannot see future information.
          nioHourlyCommitObserved = true;
          options.closedProducerTrace?.mark("fixture.adapter.putMarketData:committed-hourly-readback", {
            instrumentId: input.result.instrumentId,
            interval: input.result.interval,
            candleCount: input.result.candles.length,
            coverageCount: input.result.coverage.length,
            requestedStart: input.result.coverage[0]?.requestedStart,
            requestedEnd: input.result.coverage.at(-1)?.requestedEnd,
          });
        }
        options.closedProducerTrace?.mark("fixture.adapter.putMarketData:return", {
          kind: input.kind,
          instrumentId: input.result.instrumentId,
          interval: input.kind === "interval" ? input.result.interval : "1D",
          candleCount: input.result.candles.length,
          coverageCount: input.result.coverage.length,
        });
        return result;
      } catch (error) {
        options.closedProducerTrace?.mark("fixture.adapter.putMarketData:error", {
          kind: input.kind,
          instrumentId: input.result.instrumentId,
          interval: input.kind === "interval" ? input.result.interval : "1D",
          error: traceError(error),
        });
        throw error;
      }
    });
    // Keep the queue open after a failed write so a later producer attempt can
    // still exercise the same adapter. The caller still receives the original
    // rejection from `commit`.
    putMarketDataTail = commit.then(() => undefined, () => undefined);
    return commit;
  };
  const recoveryTransport = options.recoveryMode
    ? createRecoveryTransport(options.recoveryMode, options.closedProducerTrace)
    : undefined;
  let readRecoveryReceipt: () => RecoveryReceiptCursor = () => ({
    requestCount: 0,
    jobCount: 0,
    requests: [],
  });
  const recovery = options.recoveryMode
    ? createRecoveryController(options.recoveryMode, recoveryTransport!, () => readRecoveryReceipt(), options.closedProducerTrace)
    : undefined;
  const initialInstruments: FixtureInstrument[] = [
    instrument,
    ...(options.includeUnrelated || options.includeClosedHistorical ? [unrelatedInstrument] : []),
    ...(options.includeRetryScope ? [...retryScopeInstruments] : []),
  ];
  let current = bootstrap(initialExecutions, options.marketDataJobs, initialInstruments, options.includeClosedHistorical);
  const mergeInputs: Array<{ executions: TradeExecution[] }> = [];
  const requests: FixtureMarketDataRequest[] = [];
  const marketDataReadbacks: Array<Record<string, unknown>> = [];
  const recordRequest = (
    input: FixtureMarketDataRequest["input"],
    signal: AbortSignal | undefined,
    source: string,
  ) => {
    requests.push({ input, signal, source });
    options.closedProducerTrace?.mark("fixture.adapter.getMarketData:request-recorded", {
      source,
      ...traceMarketDataInput(input),
    });
  };
  let jobSequence = 0;
  const putMarketDataJob = vi.fn(async (job: Parameters<typeof client.putMarketDataJob>[0]) => {
    const jobIndex = jobSequence;
    jobSequence += 1;
    options.closedProducerTrace?.mark("fixture.adapter.putMarketDataJob:entry", {
      jobIndex,
      ...traceMarketDataJob(job),
    });
    try {
      // Keep the fixture bootstrap in step with the durable upsert. A later
      // workspace bootstrap must see this attempt's receipt instead of the
      // initial snapshot, while recovery still matches the exact call/index.
      current = {
        ...current,
        marketDataJobs: [
          ...current.marketDataJobs.filter(existing => existing.instrumentId !== job.instrumentId),
          job,
        ],
      };
      recovery?.markProducerTerminal(job, jobIndex);
      options.closedProducerTrace?.mark("fixture.adapter.putMarketDataJob:return", {
        jobIndex,
        ...traceMarketDataJob(job),
      });
      return job;
    } catch (error) {
      options.closedProducerTrace?.mark("fixture.adapter.putMarketDataJob:error", {
        jobIndex,
        ...traceMarketDataJob(job),
        error: traceError(error),
      });
      throw error;
    }
  });
  readRecoveryReceipt = () => ({
    requestCount: requests.length,
    jobCount: jobSequence,
    requests,
  });
  const d1 = deferred<MarketDataRead>();
  const d0 = deferred<MarketDataRead>();
  // Reads after the version-changing D1 request belong to explicit manual
  // recovery attempts. Keeping each read independently deferred lets the
  // consumer tests distinguish a failed manual attempt from its later
  // successful reread without changing the storage client contract.
  const manualDailyReads = [
    deferred<MarketDataRead>(),
    deferred<MarketDataRead>(),
    deferred<MarketDataRead>(),
    deferred<MarketDataRead>(),
  ];
  const xpevDailyReads = new Map<string, Deferred<MarketDataRead>>([
    ["xpev-d1", d1],
    ...manualDailyReads.map((read, index) => [`xpev-manual-${index}`, read] as const),
  ]);
  const i1 = deferred<MarketDataRead>();
  const i2 = deferred<MarketDataRead>();
  const i15 = deferred<MarketDataRead>();
  const j0 = deferred<MarketDataRead>();
  const j1 = deferred<MarketDataRead>();
  const manualNioDailyReads = [
    deferred<MarketDataRead>(),
    deferred<MarketDataRead>(),
  ];
  const initialDailyReads = new Set<string>();
  let primaryDailyReadCount = 0;
  let nioDailyReadCount = 0;
  let intradayReadCount = 0;
  client.getBootstrap = async () => {
    options.closedProducerTrace?.mark("fixture.adapter.getBootstrap:entry");
    try {
      const snapshot = current;
      options.closedProducerTrace?.mark("fixture.adapter.getBootstrap:return", {
        executionCount: snapshot.executions.length,
        instrumentCount: snapshot.instruments.length,
        marketDataJobCount: snapshot.marketDataJobs.length,
      });
      return snapshot;
    } catch (error) {
      options.closedProducerTrace?.mark("fixture.adapter.getBootstrap:error", { error: traceError(error) });
      throw error;
    }
  };
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
    if (options.includeClosedHistorical && input.instruments) {
      const merged = new Map(current.instruments.map(item => [item.id, item] as const));
      for (const item of input.instruments) {
        const previous = merged.get(item.id);
        merged.set(item.id, {
          ...previous,
          ...item,
          metadata: item.metadata ?? previous?.metadata,
        });
      }
      current = { ...current, executions: input.executions, instruments: [...merged.values()] };
    } else {
      current = { ...current, executions: input.executions, instruments: input.instruments ?? current.instruments };
    }
    return { inserted: input.executions.length, duplicate: 0, conflict: 0 };
  };
  client.getMarketData = async (input, signal) => {
    options.closedProducerTrace?.mark("fixture.adapter.getMarketData:entry", traceMarketDataInput(input));
    const returnRead = <T,>(source: string, value: T | PromiseLike<T>) => {
      const requestIndex = requests.length - 1;
      const observed = observeClosedProducerPromise(
        options.closedProducerTrace,
        "fixture.adapter.getMarketData",
        value,
        { source, ...traceMarketDataInput(input) },
      );
      void Promise.resolve(observed).then(result => {
        if (result && typeof result === "object" && "candles" in result && "intervalCoverage" in result) {
          const readback = {
            requestIndex,
            source,
            ...traceMarketDataInput(input),
            ...summarizeMarketRead(result as MarketDataRead),
          };
          if (marketDataReadbacks.length < MAX_MARKET_DATA_READBACK_TRACE) {
            marketDataReadbacks.push(readback);
            options.closedProducerTrace?.mark("fixture.adapter.getMarketData:readback", readback);
          }
        }
      }, () => undefined);
      return observed;
    };
    if (input.dailyOnly) {
      const ownedRecoveryRead = recovery?.readDaily(input);
      if (ownedRecoveryRead) {
        recordRequest(input, signal, "recovery");
        return returnRead("recovery", ownedRecoveryRead);
      }
      const retryScopeInstrument = retryScopeInstruments.find(item => item.id === input.instrumentId);
      if (options.includeRetryScope && retryScopeInstrument) {
        const source = `${retryScopeInstrument.symbol.toLowerCase()}-scope-d0`;
        recordRequest(input, signal, source);
        return returnRead(source, dailyRead("d0"));
      }
      if (options.includeRetryScope && options.includeUnrelated && input.instrumentId === unrelatedInstrument.id) {
        recordRequest(input, signal, "nio-scope-d0");
        return returnRead("nio-scope-d0", dailyRead("d0"));
      }
      if ((options.includeUnrelated || options.includeClosedHistorical) && input.instrumentId === unrelatedInstrument.id) {
        if (options.recoveryMode === "closedHistorical") {
          recordRequest(input, signal, "nio-closed-j0");
          return returnRead("nio-closed-j0", j0.promise);
        }
        if (nioDailyReadCount === 0) {
          nioDailyReadCount += 1;
          recordRequest(input, signal, "nio-j0");
          return returnRead("nio-j0", j0.promise);
        }
        if (nioDailyReadCount === 1) {
          nioDailyReadCount += 1;
          recordRequest(input, signal, "nio-j1");
          return returnRead("nio-j1", j1.promise);
        }
        const recoveryRead = manualNioDailyReads[Math.min(nioDailyReadCount - 2, manualNioDailyReads.length - 1)]!;
        const source = `nio-manual-${Math.min(nioDailyReadCount - 2, manualNioDailyReads.length - 1)}`;
        nioDailyReadCount += 1;
        recordRequest(input, signal, source);
        return returnRead(source, recoveryRead.promise);
      }
      if (!initialDailyReads.has(input.instrumentId)) {
        initialDailyReads.add(input.instrumentId);
        const source = input.instrumentId === instrument.id ? "xpev-d0" : "other-d0";
        recordRequest(input, signal, source);
        return returnRead(source, options.deferPrimaryDaily ? d0.promise : dailyRead("d0"));
      }
      if (primaryDailyReadCount === 0) {
        primaryDailyReadCount += 1;
        const source = input.instrumentId === instrument.id ? "xpev-d1" : "other-d1";
        recordRequest(input, signal, source);
        return returnRead(source, d1.promise);
      }
      const recoveryRead = manualDailyReads[Math.min(primaryDailyReadCount - 1, manualDailyReads.length - 1)]!;
      const source = input.instrumentId === instrument.id
        ? `xpev-manual-${Math.min(primaryDailyReadCount - 1, manualDailyReads.length - 1)}`
        : `other-manual-${Math.min(primaryDailyReadCount - 1, manualDailyReads.length - 1)}`;
      primaryDailyReadCount += 1;
      recordRequest(input, signal, source);
      return returnRead(source, recoveryRead.promise);
    }
    if (input.interval === "1h") {
      if (input.instrumentId === unrelatedInstrument.id) {
        if (nioHourlyCommitObserved) {
          recordRequest(input, signal, "nio-1h-committed");
          return returnRead("nio-1h-committed", originalGetMarketData(input, signal));
        }
        recordRequest(input, signal, "nio-1h-empty");
        return returnRead("nio-1h-empty", { candles: [], intervalCoverage: [] });
      }
      intradayReadCount += 1;
      const source = intradayReadCount === 1 ? "xpev-i1" : "xpev-i2";
      recordRequest(input, signal, source);
      return returnRead(source, intradayReadCount === 1 ? i1.promise : i2.promise);
    }
    if (input.interval === "15m" && options.intradayFallback === "native15m") {
      recordRequest(input, signal, "xpev-i15");
      return returnRead("xpev-i15", i15.promise);
    }
    recordRequest(input, signal, "empty");
    return returnRead("empty", { candles: [], intervalCoverage: [] });
  };
  const resolveObservedXpevReads = (requestStart = 0) => {
    const observed = new Set(requests
      .slice(requestStart)
      .filter(request => request.input.instrumentId === instrument.id)
      .map(request => request.source));
    if (observed.has("xpev-d1")) d1.resolve(dailyRead("d1"));
    manualDailyReads.forEach((read, index) => {
      if (observed.has(`xpev-manual-${index}`)) read.resolve(dailyRead("d1"));
    });
    const xpevHourlyRequests = requests.slice(requestStart).filter(request => request.input.instrumentId === instrument.id && (
      request.source === "xpev-i1" || request.source === "xpev-i2"
    ));
    const hourlyRead = (source: "xpev-i1" | "xpev-i2") => {
      const request = xpevHourlyRequests.find(candidate => candidate.source === source);
      return coverageOnlyHourlyRead(
        request?.input.start ?? "2026-10-05T15:00:00.000Z",
        request?.input.end ?? "2026-10-05T16:00:00.000Z",
      );
    };
    if (observed.has("xpev-i1")) i1.resolve(hourlyRead("xpev-i1"));
    if (observed.has("xpev-i2")) i2.resolve(hourlyRead("xpev-i2"));
    const native15mRequest = requests.slice(requestStart).find(request => request.source === "xpev-i15");
    if (native15mRequest) {
      i15.resolve(native15mRead(
        native15mRequest.input.start ?? "2026-10-05T15:00:00.000Z",
        native15mRequest.input.end ?? "2026-10-05T15:15:00.000Z",
      ));
    }
  };
  const resolveObservedXpevRead = (source: string, requestStart = 0) => {
    const observed = requests.slice(requestStart).some(request =>
      request.input.instrumentId === instrument.id &&
      request.input.dailyOnly &&
      request.input.interval === "1D" &&
      request.source === source,
    );
    const read = xpevDailyReads.get(source);
    if (!observed || !read) return false;
    read.resolve(dailyRead("d1"));
    return true;
  };
  const findObservedXpevDailySource = (requestStart: number, resolvedSources: ReadonlySet<string>) => {
    const request = requests.slice(requestStart).find(candidate =>
      candidate.input.instrumentId === instrument.id &&
      candidate.input.dailyOnly &&
      candidate.input.interval === "1D" &&
      (candidate.source === "xpev-d1" || candidate.source.startsWith("xpev-manual-")) &&
      !resolvedSources.has(candidate.source) &&
      xpevDailyReads.has(candidate.source),
    );
    return request?.source;
  };
  const captureMarketRefreshReceipt = (): MarketRefreshReceipt => ({
    requestStart: requests.length,
    providerStart: recovery?.calls.length ?? 0,
    jobStart: putMarketDataJob.mock.calls.length,
  });
  return {
    client,
    mergeInputs,
    requests,
    putMarketDataJob,
    d0,
    d1,
    manualDailyReads,
    i1,
    i2,
    i15,
    j0,
    j1,
    manualNioDailyReads,
    initialExecutions,
    marketDataReadbacks,
    recovery,
    captureMarketRefreshReceipt,
    resolveObservedXpevReads,
    resolveObservedXpevRead,
    findObservedXpevDailySource,
  };
}

function renderFixture(fixture: ReturnType<typeof createFixture>) {
  const rendered = render(<TradeReviewWorkspace initialFrame={{
    cursorIndex: 0,
    cursor: "2026-10-05T14:30:00.000Z",
    candles15m: [{ time: "2026-10-05T14:30:00.000Z", open: 10, high: 10.2, low: 9.9, close: 10.1, volume: 100 }],
    executions: [],
    canGoBack: false,
    canGoForward: false,
  } satisfies DemoReplayFrame} showDemo={false} storageClient={fixture.client} />);
  return rendered;
}

async function openMarketRepairDialog(
  fixture: ReturnType<typeof createFixture>,
  settleIntraday: "empty" | "error" = "empty",
) {
  const { page, mainNavigation } = await findPublicWorkspaceRoots();
  fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
  const dataManagement = await page.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText("1 个已导入标的");
  fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
  const tradeLibrary = await page.findByRole("region", { name: "交易库" });
  const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  const episodeButton = await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
  fireEvent.click(episodeButton);
  await waitFor(() => expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true));
  await act(async () => {
    if (settleIntraday === "empty") fixture.i1.resolve({ candles: [], intervalCoverage: [] });
    else fixture.i1.reject(new Error("hourly local read failed"));
  });
  const repairButton = await page.findByRole("button", { name: "检查/修复数据" });
  fireEvent.click(repairButton);
  const dialog = await page.findByRole("dialog", { name: "检查与修复当前股票数据" });
  fireEvent.click(page.getByRole("button", { name: "查看完整数据并暂停复盘" }));
  return dialog;
}

async function findPublicWorkspaceRoots() {
  const page = within(await screen.findByRole("main"));
  const mainNavigation = within(await page.findByRole("navigation", { name: "主导航" }));
  await waitFor(() => expect(mainNavigation.getByRole("button", { name: "数据" })).toBeInTheDocument());
  return { page, mainNavigation };
}

async function openSelectedEpisode(fixture: ReturnType<typeof createFixture>) {
  const { page, mainNavigation } = await findPublicWorkspaceRoots();
  fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
  const dataManagement = await page.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText(/个已导入标的/);
  fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
  const tradeLibrary = await page.findByRole("region", { name: "交易库" });
  const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  fireEvent.click(await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
  await waitFor(() => {
    expect(fixture.requests.some(({ input }) => input.dailyOnly && input.interval === "1D")).toBe(true);
    expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true);
  });
}

async function importMiddleAndOpenSelectedEpisode(fixture: ReturnType<typeof createFixture>) {
  const { page, mainNavigation } = await findPublicWorkspaceRoots();
  fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
  const dataManagement = await page.findByRole("region", { name: "数据管理" });
  await within(dataManagement).findByText("1 个已导入标的");
  const importData = within(dataManagement).getByRole("region", { name: "导入交易数据" });
  fireEvent.click(within(importData).getByRole("button", { name: "导入交易记录" }));
  const input = page.getByLabelText("导入交易记录", { selector: "input" });
  const file = importFile();
  fireEvent.change(input, { target: { files: [file] } });
  const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
  expect(within(importDialog).getByRole("heading", { name: "确认导入交易记录" })).toBeInTheDocument();
  fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
  await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
  fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
  const tradeLibrary = await page.findByRole("region", { name: "交易库" });
  const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
  fireEvent.click(stockRow);
  fireEvent.click(await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
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

async function importMiddle(
  fixture: ReturnType<typeof createFixture>,
  beforeConfirm?: () => void,
  observe?: ClosedProducerObserve,
) {
  observe?.("before-find-public-workspace-roots");
  const { page, mainNavigation } = await findPublicWorkspaceRoots();
  observe?.("after-find-public-workspace-roots");
  fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
  observe?.("before-find-data-region");
  const dataManagement = await page.findByRole("region", { name: "数据管理" });
  observe?.("after-find-data-region");
  observe?.("before-find-imported-count");
  await within(dataManagement).findByText("1 个已导入标的");
  observe?.("after-find-imported-count");
  const importData = within(dataManagement).getByRole("region", { name: "导入交易数据" });
  fireEvent.click(within(importData).getByRole("button", { name: "导入交易记录" }));
  const input = page.getByLabelText("导入交易记录", { selector: "input" });
  const file = importFile();
  fireEvent.change(input, { target: { files: [file] } });
  observe?.("before-find-import-dialog");
  const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
  observe?.("after-find-import-dialog");
  expect(within(importDialog).getByRole("heading", { name: "确认导入交易记录" })).toBeInTheDocument();
  beforeConfirm?.();
  fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
  observe?.("before-merge-inputs");
  await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
  observe?.("after-merge-inputs");
  observe?.("before-daily-request-count");
  await waitFor(() => expect(fixture.requests.filter(({ input: request }) => request.dailyOnly && request.interval === "1D")).toHaveLength(2));
  observe?.("after-daily-request-count");
}

async function prepareClosedHistoricalImport(
  fixture: ReturnType<typeof createFixture>,
  observe?: ClosedProducerObserve,
): Promise<{
  importDialog: HTMLElement;
  refreshRegion: HTMLElement;
  receipt: MarketRefreshReceipt;
  nioDailyRequestsBeforeImport: number;
}> {
  observe?.("before-find-public-workspace-roots");
  const { page, mainNavigation } = await findPublicWorkspaceRoots();
  observe?.("after-find-public-workspace-roots");
  fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
  observe?.("before-find-data-region");
  const dataManagement = await page.findByRole("region", { name: "数据管理" });
  observe?.("after-find-data-region");
  observe?.("before-find-imported-count");
  await within(dataManagement).findByText("2 个已导入标的");
  observe?.("after-find-imported-count");
  const refreshRegion = within(dataManagement).getByRole("region", { name: "全局行情更新" });
  const receipt = fixture.captureMarketRefreshReceipt();
  observe?.("before-click-import-records-tab");
  fireEvent.click(within(dataManagement).getByRole("tab", { name: "导入记录" }));
  observe?.("after-click-import-records-tab");
  const importData = within(dataManagement).getByRole("region", { name: "导入交易数据" });
  observe?.("before-click-import-records");
  fireEvent.click(within(importData).getByRole("button", { name: "导入交易记录" }));
  observe?.("after-click-import-records");
  const input = page.getByLabelText("导入交易记录", { selector: "input" });
  const file = closedHistoricalImportFile(observe);
  observe?.("before-file-change");
  fireEvent.change(input, { target: { files: [file] } });
  observe?.("after-file-change");
  observe?.("before-find-import-dialog");
  const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
  observe?.("after-find-import-dialog");
  observe?.("before-dialog-heading");
  expect(within(importDialog).getByRole("heading", { name: "确认导入交易记录" })).toBeInTheDocument();
  observe?.("after-dialog-heading");
  const nioDailyRequestsBeforeImport = fixture.requests.filter(({ input: request }) =>
    request.instrumentId === unrelatedInstrument.id && request.dailyOnly && request.interval === "1D",
  ).length;

  return {
    importDialog,
    refreshRegion,
    receipt,
    nioDailyRequestsBeforeImport,
  };
}

async function completeClosedHistoricalImport(
  fixture: ReturnType<typeof createFixture>,
  preparation: Awaited<ReturnType<typeof prepareClosedHistoricalImport>>,
  beforeConfirm?: () => void,
  observe?: ClosedProducerObserve,
): Promise<ClosedHistoricalImportReceipt> {
  const {
    importDialog,
    refreshRegion,
    receipt,
    nioDailyRequestsBeforeImport,
  } = preparation;
  let publicCompletionObserved = false;
  let lastPublicCompletionGateSignature: string | undefined;
  observe?.("before-confirm-seam");
  beforeConfirm?.();
  observe?.("after-confirm-seam");
  observe?.("before-confirm-click");
  fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
  observe?.("after-confirm-click");
  observe?.("before-merge-inputs");
  await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
  observe?.("after-merge-inputs");
  observe?.("before-nio-daily-request");
  await waitFor(() => expect(fixture.requests.filter(({ input: request }) =>
    request.instrumentId === unrelatedInstrument.id && request.dailyOnly && request.interval === "1D",
  ).length).toBeGreaterThan(nioDailyRequestsBeforeImport));
  observe?.("after-nio-daily-request");
  observe?.("before-public-completion");
  await waitFor(() => {
    const postImportJobs = fixture.putMarketDataJob.mock.calls
      .slice(receipt.jobStart)
      .map(([job], offset) => ({ job, jobIndex: receipt.jobStart + offset }));
    const syncingJobs = postImportJobs.filter(({ job }) =>
      job.status === "syncing" &&
      Boolean(job.requestedAt) &&
      job.intervals.some(interval => interval.interval === "1D" && interval.status === "syncing"),
    );
    const startedInstrumentIds = [...new Set(syncingJobs.map(({ job }) => job.instrumentId))];
    const hasFreshReceiptFor = (instrumentId: string) => {
      const syncingForInstrument = syncingJobs.filter(({ job }) => job.instrumentId === instrumentId);
      const hasMatchingTerminal = syncingForInstrument.some(({ job: syncingJob, jobIndex: syncingIndex }) =>
        postImportJobs.some(({ job: terminalJob, jobIndex: terminalIndex }) =>
          terminalIndex > syncingIndex &&
          terminalJob.instrumentId === instrumentId &&
          terminalJob.requestedAt === syncingJob.requestedAt &&
            hasTerminalDailyReceipt(terminalJob) &&
            hasTerminalHourlyReceipt(terminalJob),
        ),
      );
      const hasFreshDailyProvider = (fixture.recovery?.calls ?? [])
        .slice(receipt.providerStart)
        .some(call =>
          call.endpoint === "daily" &&
          call.instrumentId === instrumentId &&
          call.result === "success",
        );
      const hasFreshHourlyProvider = (fixture.recovery?.calls ?? [])
        .slice(receipt.providerStart)
        .some(call =>
          call.endpoint === "intraday" &&
          call.instrumentId === instrumentId &&
          call.result === "success",
        );
      const hasFreshDailyStorage = fixture.requests
        .slice(receipt.requestStart)
        .some(({ input }) =>
          input.instrumentId === instrumentId &&
          input.dailyOnly &&
          input.interval === "1D",
        );
      // The closed-history import is the only full D1+1h journey in this
      // fixture. Count the hourly read only after the real interval PUT has
      // committed; the pre-commit `nio-1h-empty` probe cannot satisfy this
      // receipt. Homepage valuation below remains dailyOnly by contract.
      const hasFreshHourlyReadback = fixture.requests
        .slice(receipt.requestStart)
        .some(({ input, source }) =>
          input.instrumentId === instrumentId &&
          !input.dailyOnly &&
          input.interval === "1h" &&
          source === "nio-1h-committed",
        );
      return hasMatchingTerminal &&
        hasFreshDailyProvider &&
        hasFreshHourlyProvider &&
        hasFreshDailyStorage &&
        hasFreshHourlyReadback;
    };
    const savedSummaryElement = refreshRegion.querySelector('[aria-label="已保存行情状态汇总"]');
    const resultSummaryElement = refreshRegion.querySelector('[aria-label="行情更新结果"]');
    const hasSavedSummary = Boolean(savedSummaryElement || resultSummaryElement);
    const idleButton = refreshRegion.querySelector('button[aria-label="更新全部数据"]');
    const gateDetails = {
      startedInstrumentIds,
      freshReceiptByInstrument: Object.fromEntries(
        startedInstrumentIds.map(instrumentId => [instrumentId, hasFreshReceiptFor(instrumentId)]),
      ),
      hasFreshReceiptForAll: startedInstrumentIds.length > 0 && startedInstrumentIds.every(hasFreshReceiptFor),
      hasSavedSummary,
      hasSavedSummaryLabel: Boolean(savedSummaryElement),
      hasResultSummaryLabel: Boolean(resultSummaryElement),
      hasIdleButton: Boolean(idleButton),
      refreshRegionConnected: refreshRegion.isConnected,
      refreshRegionAriaLabel: refreshRegion.getAttribute("aria-label"),
      ariaLabels: Array.from(refreshRegion.querySelectorAll("[aria-label]"))
        .map(element => element.getAttribute("aria-label"))
        .filter((label): label is string => Boolean(label))
        .slice(0, 24),
    };
    const gateSignature = JSON.stringify(gateDetails);
    if (gateSignature !== lastPublicCompletionGateSignature) {
      lastPublicCompletionGateSignature = gateSignature;
      observe?.("public-completion-gate", gateDetails);
    }
    if (
      startedInstrumentIds.length > 0 &&
      gateDetails.hasFreshReceiptForAll &&
      hasSavedSummary &&
      idleButton
    ) {
      publicCompletionObserved = true;
    }
    expect(publicCompletionObserved).toBe(true);
  });
  observe?.("after-public-completion");
  observe?.("before-next-tick");
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  observe?.("after-next-tick");
  const requests = fixture.requests.slice(receipt.requestStart);
  return {
    ...receipt,
    requests,
    providerCalls: fixture.recovery?.calls.slice(receipt.providerStart) ?? [],
    jobs: fixture.putMarketDataJob.mock.calls.slice(receipt.jobStart).map(([job]) => job),
  };
}

async function importClosedHistorical(
  fixture: ReturnType<typeof createFixture>,
  beforeConfirm?: () => void,
  observe?: ClosedProducerObserve,
): Promise<ClosedHistoricalImportReceipt> {
  const preparation = await prepareClosedHistoricalImport(fixture, observe);
  return completeClosedHistoricalImport(fixture, preparation, beforeConfirm, observe);
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
    vi.setSystemTime(MARKET_READINESS_FIXTURE_NOW);
    vi.stubGlobal("Worker", ComputingHoldingsHistoryWorker);
    cleanup();
    vi.clearAllMocks();
    holdingsReadinessProbe.latest = undefined;
    holdingsReadinessProbe.refreshes = [];
    dashboardPropsProbe.latest = undefined;
    window.localStorage.removeItem("trade-reviewer:market-data-jobs:v1");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("trade-reviewer");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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

    const { page, mainNavigation } = await findPublicWorkspaceRoots();
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const dataManagement = await page.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(within(dataManagement).getByRole("button", { name: "导入交易记录" }));
    const input = page.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile()] } });

    const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
    fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
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

    fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
    const tradeLibrary = await page.findByRole("region", { name: "交易库" });
    const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    const episodeButton = await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
    fireEvent.click(episodeButton);

    await waitFor(() => expect(fixture.requests.some(({ input }) => input.interval === "1h" && !input.dailyOnly)).toBe(true));
    expect(page.getByRole("region", { name: "交易复盘图表工作区" })).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    expect(page.getByRole("region", { name: "交易复盘图表工作区" })).toHaveAttribute("aria-busy", "true");
    expect(page.queryByRole("button", { name: "检查/修复数据" })).not.toBeInTheDocument();
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    const recallWorkspace = page.getByRole("region", { name: "导入交易回忆复盘工作区" });
    const repairButton = await within(recallWorkspace).findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).toHaveTextContent("当前行情状态");

    const dailyRequests = fixture.requests.filter(({ input }) => input.dailyOnly);
    const intradayRequests = fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly);
    expect(dailyRequests).toHaveLength(2);
    expect(intradayRequests).toHaveLength(1);
    expect(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)).size).toBe(1);
    expect(new Set(intradayRequests.map(({ input }) => `${input.start}|${input.end}`))).toEqual(new Set(dailyRequests.map(({ input }) => `${input.start}|${input.end}`)));
    expect(dailyRequests.at(-1)?.signal?.aborted).toBe(false);
    expect(intradayRequests[0]?.signal?.aborted).toBe(false);
    expect(fixture.putMarketDataJob).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("日线覆盖：2026-10-02 至 2026-10-05");
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:00:00.000Z");
  // Public entry plus the two owned reads can exceed the default test budget;
  // retain every publication assertion with a local end-to-end budget.
  });

  it("publishes D1 and I1 together when both owned reads settle in one React batch", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    const { page, mainNavigation } = await findPublicWorkspaceRoots();
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const dataManagement = await page.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(within(dataManagement).getByRole("button", { name: "导入交易记录" }));
    const input = page.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile()] } });

    const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
    fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));

    fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
    const tradeLibrary = await page.findByRole("region", { name: "交易库" });
    const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    const episodeButton = await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ });
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

    const recallWorkspace = page.getByRole("region", { name: "导入交易回忆复盘工作区" });
    const repairButton = await within(recallWorkspace).findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await screen.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).toHaveTextContent("日线覆盖：2026-10-02 至 2026-10-05");
    expect(dialog).toHaveTextContent("小时线覆盖：2026-10-05T15:00:00.000Z 至 2026-10-05T15:00:00.000Z");
  // Public entry plus the two owned reads can exceed the default test budget;
  // retain every publication assertion with a local end-to-end budget.
  });

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

  it("keeps holdings readiness pending until a closed historical instrument settles", async () => {
    const fixture = createFixture({
      includeClosedHistorical: true,
      deferPrimaryDaily: true,
    });
    renderFixture(fixture);

    await waitFor(() => {
      expect(fixture.requests.some(({ input }) =>
        input.instrumentId === instrument.id && input.dailyOnly,
      )).toBe(true);
      expect(fixture.requests.some(({ input }) =>
        input.instrumentId === unrelatedInstrument.id && input.dailyOnly,
      )).toBe(true);
      expect(holdingsReadinessProbe.latest).toBeDefined();
    });

    await act(async () => {
      fixture.d0.resolve(dailyRead("d0"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    await act(async () => {
      fixture.j0.resolve({ candles: [], dailyCandles: [], coverage: [], intervalCoverage: [] });
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));
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
  });

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

  it("keeps dashboard and replay readiness pending until the new daily identity settles", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    await waitFor(() => expect(screen.getByRole("button", { name: "数据" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    const dataManagement = await screen.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(screen.getByRole("button", { name: "导入交易记录" }));
    const input = screen.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile("2026-10-06 00:00:00")] } });
    await screen.findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(screen.getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.dailyOnly)).toHaveLength(2));
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "交易库" }));
    const stockRow = await screen.findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await screen.findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    expect(screen.getByRole("region", { name: "交易复盘图表工作区" })).toHaveAttribute("aria-busy", "true");
    expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
    });
    expect(screen.getByRole("region", { name: "交易复盘图表工作区" })).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));
  });

  it("keeps the accepted k1 holding and coherent quote/candles after k2 daily failure", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    const initialHoldings = await screen.findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(initialHoldings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100"));
    expect(initialHoldings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");

    await importMiddle(fixture);
    await act(async () => {
      fixture.d1.reject(new Error("k2 daily read failed"));
    });
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "我的交易室" }));
    const holdings = await screen.findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20"));
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).not.toHaveTextContent("30");
    // The accepted k1 bundle remains coherent while k2 is not financially
    // publishable; the dashboard must not splice k2's ledger into it.
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
  });

  it("settles a cold holding without publishing a quote when its daily read fails", async () => {
    const fixture = createFixture({ deferPrimaryDaily: true });
    renderFixture(fixture);

    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D")).toHaveLength(1));
    await act(async () => {
      fixture.d0.reject(new Error("cold daily read failed"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));

    const holdings = await screen.findByRole("region", { name: "当前持仓" });
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("暂无可用报价");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("暂无数据");
  });

  it("publishes a cold scope's known holding after another daily read fails", async () => {
    const fixture = createFixture({ includeUnrelated: true, deferPrimaryDaily: true });
    renderFixture(fixture);

    await waitFor(() => {
      expect(fixture.requests.some(({ input }) => input.instrumentId === instrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
      expect(fixture.requests.some(({ input }) => input.instrumentId === unrelatedInstrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
    });
    await act(async () => {
      fixture.d0.resolve(dailyRead("d0"));
      fixture.j0.reject(new Error("cold NIO daily read failed"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));

    const holdings = await screen.findByRole("region", { name: "当前持仓" });
    const rows = [...holdings.querySelectorAll("tbody tr")];
    const xpengRow = rows.find(row => row.textContent?.includes("小鹏汽车"));
    const nioRow = rows.find(row => row.textContent?.includes("蔚来汽车"));
    if (!xpengRow || !nioRow) throw new Error("cold partial holdings rows were not rendered");
    expect(xpengRow.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(nioRow.querySelector('td[data-label="估值价"]')).toHaveTextContent("暂无可用报价");
    expect(nioRow.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("近30日价格暂无数据");
  });

  it("promotes a current financial key only after manual daily recovery succeeds", async () => {
    const fixture = createFixture({ recoveryMode: "manual" });
    renderFixture(fixture);

    const traceManualMilestone = (
      label: string,
      receipt?: MarketRefreshReceipt,
      refreshIndex?: number,
    ) => {
      const refresh = refreshIndex === undefined
        ? undefined
        : holdingsReadinessProbe.refreshes[refreshIndex];
      const requests = fixture.requests.slice(receipt?.requestStart ?? 0).map(({ input, source }) => ({
        source,
        instrumentId: input.instrumentId,
        interval: input.interval,
        dailyOnly: input.dailyOnly,
      }));
      const providerCalls = (fixture.recovery?.calls ?? [])
        .slice(receipt?.providerStart ?? 0)
        .map(call => ({
          endpoint: call.endpoint,
          instrumentId: call.instrumentId,
          result: call.result,
        }));
      const jobs = fixture.putMarketDataJob.mock.calls
        .slice(receipt?.jobStart ?? 0)
        .map(([job], offset) => ({
          jobIndex: (receipt?.jobStart ?? 0) + offset,
          instrumentId: job.instrumentId,
          requestedAt: job.requestedAt,
          status: job.status,
          dailyStatus: job.intervals.find(interval => interval.interval === "1D")?.status,
        }));
      console.info("[PA-I106]", JSON.stringify({
        label,
        receipt,
        hook: {
          phase: holdingsReadinessProbe.latest?.phase,
          active: holdingsReadinessProbe.latest?.active,
          initialDataReady: holdingsReadinessProbe.latest?.initialDataReady,
          announcement: holdingsReadinessProbe.latest?.announcement,
          instruments: holdingsReadinessProbe.latest?.instruments?.map(value => value.instrumentId),
          scopeInstruments: holdingsReadinessProbe.latest?.scopeInstruments?.map(value => value.instrumentId),
        },
        refresh: refresh && {
          instrumentIds: refresh.instrumentIds,
          trigger: refresh.trigger,
          settled: refresh.settled,
          settlement: refresh.settlement,
        },
        recovery: fixture.recovery && {
          producerStorageReadRequested: fixture.recovery.producerStorageReadRequested,
          producerSettled: fixture.recovery.producerSettled,
          consumerReadRequested: fixture.recovery.consumerReadRequested,
          providerFailure: fixture.recovery.hasProviderFailure(),
        },
        requests,
        providerCalls,
        jobs,
      }));
    };

    traceManualMilestone("after-render");
    const page = within(screen.getByRole("main"));
    const initialWorkspace = await page.findByRole("region", { name: "持仓照看" });
    traceManualMilestone("after-initial-region");
    const initialHoldings = await within(initialWorkspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => {
      expect(initialHoldings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    });
    traceManualMilestone("after-initial-price");
    expect(initialHoldings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(initialHoldings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");

    // The in-range import changes the financial identity setup and reruns
    // hydration. Keep that new key unready when its observed D1 read fails;
    // the homepage retries below must start from the retained old bundle.
    const importRequestStart = fixture.requests.length;
    traceManualMilestone("before-import-middle");
    await importMiddle(fixture, undefined, label => traceManualMilestone(`import-middle:${label}`));
    traceManualMilestone("after-import-middle");
    let importXpevDailySource: string | undefined;
    traceManualMilestone("before-import-xpev-d1");
    await waitFor(() => {
      importXpevDailySource = fixture.findObservedXpevDailySource(importRequestStart, new Set());
      expect(importXpevDailySource).toBe("xpev-d1");
    });
    traceManualMilestone("after-import-xpev-d1");
    traceManualMilestone("before-hydration-reject");
    await act(async () => {
      fixture.recovery?.markHydrationFailure();
      fixture.d1.reject(new Error("in-range hydration daily read failed"));
    });
    traceManualMilestone("after-hydration-reject");
    traceManualMilestone("before-readiness-false");
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));
    traceManualMilestone("after-readiness-false");

    const mainNavigation = within(await page.findByRole("navigation", { name: "主导航" }));
    fireEvent.click(mainNavigation.getByRole("button", { name: "我的交易室" }));
    const workspace = await page.findByRole("region", { name: "持仓照看" });
    traceManualMilestone("after-homepage-region");
    const holdings = await within(workspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => {
      expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    });
    traceManualMilestone("after-homepage-price");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
    const refreshStatus = within(workspace).getByRole("status");
    expect(refreshStatus).toHaveAttribute("data-refresh-phase", "failed");
    expect(refreshStatus).toHaveTextContent("估值更新失败");
    const refreshButton = within(workspace).getByRole("button", { name: "重试" });

    const assertFreshProducerReceipt = (
      receipt: MarketRefreshReceipt,
      expectedResult: RecoveryTransportResult,
    ) => {
      const postAttemptJobs = fixture.putMarketDataJob.mock.calls
        .slice(receipt.jobStart)
        .map(([job], offset) => ({ job, jobIndex: receipt.jobStart + offset }))
        .filter(({ job }) => job.instrumentId === instrument.id);
      const syncingJobs = postAttemptJobs.filter(({ job }) =>
        job.status === "syncing" &&
        Boolean(job.requestedAt) &&
        job.intervals.some(interval => interval.interval === "1D" && interval.status === "syncing"),
      );
      const hasMatchingTerminal = syncingJobs.some(({ job: syncingJob, jobIndex: syncingIndex }) =>
        postAttemptJobs.some(({ job: terminalJob, jobIndex: terminalIndex }) =>
          terminalIndex > syncingIndex &&
          terminalJob.requestedAt === syncingJob.requestedAt &&
          hasTerminalDailyReceipt(terminalJob),
        ),
      );
      expect(hasMatchingTerminal).toBe(true);
      expect((fixture.recovery?.calls ?? []).slice(receipt.providerStart).some(call =>
        call.endpoint === "daily" &&
        call.instrumentId === instrument.id &&
        call.result === expectedResult,
      )).toBe(true);
      expect(fixture.requests.slice(receipt.requestStart).some(({ input }) =>
        input.instrumentId === instrument.id &&
        input.dailyOnly &&
        input.interval === "1D",
      )).toBe(true);
    };

    // Capture all cursors immediately before the visible first click. The
    // failed public attempt must settle before the second click is armed.
    const firstReceipt = fixture.captureMarketRefreshReceipt();
    const firstRefreshIndex = holdingsReadinessProbe.refreshes.length;
    traceManualMilestone("before-first-click", firstReceipt, firstRefreshIndex);
    fixture.recovery?.armFailedAttempt();
    fireEvent.click(refreshButton);
    traceManualMilestone("after-first-click", firstReceipt, firstRefreshIndex);
    traceManualMilestone("before-first-refresh-observed", firstReceipt, firstRefreshIndex);
    await waitFor(() => expect(holdingsReadinessProbe.refreshes).toHaveLength(firstRefreshIndex + 1));
    traceManualMilestone("after-first-refresh-observed", firstReceipt, firstRefreshIndex);
    const firstRefresh = holdingsReadinessProbe.refreshes[firstRefreshIndex];
    if (!firstRefresh) throw new Error("first homepage valuation refresh was not observed");
    expect(firstRefresh.trigger).toBe("manual");
    expect(firstRefresh.instrumentIds).toContain(instrument.id);
    const firstRefreshResultPromise = firstRefresh.promise;
    traceManualMilestone("before-first-producer-settled", firstReceipt, firstRefreshIndex);
    await waitFor(() => expect(fixture.recovery?.producerSettled).toBe(true));
    traceManualMilestone("after-first-producer-settled", firstReceipt, firstRefreshIndex);
    assertFreshProducerReceipt(firstReceipt, "failure");
    expect(fixture.recovery?.producerStorageReadRequested).toBe(true);
    expect(fixture.recovery?.consumerReadRequested).toBe(false);
    expect(fixture.recovery?.hasProviderFailure()).toBe(true);
    traceManualMilestone("before-first-result", firstReceipt, firstRefreshIndex);
    await act(async () => {
      const firstResult = await firstRefreshResultPromise;
      expect(firstResult).toEqual(expect.objectContaining({ ok: false }));
    });
    traceManualMilestone("after-first-result", firstReceipt, firstRefreshIndex);
    traceManualMilestone("before-first-readiness-false", firstReceipt, firstRefreshIndex);
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));
    traceManualMilestone("after-first-readiness-false", firstReceipt, firstRefreshIndex);
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");

    // Keep the fixed Shanghai market date while giving the second real
    // producer attempt a distinct ISO requestedAt from the settled failure.
    vi.setSystemTime(new Date(Date.parse(MARKET_READINESS_FIXTURE_NOW) + 1));

    // The second real homepage click owns a fresh receipt. Keep its consumer
    // deferred until the producer terminal and current-key reread are visible.
    const secondReceipt = fixture.captureMarketRefreshReceipt();
    const secondRefreshIndex = holdingsReadinessProbe.refreshes.length;
    traceManualMilestone("before-second-click", secondReceipt, secondRefreshIndex);
    fixture.recovery?.beginSuccessfulAttempt();
    const currentWorkspace = screen.getByRole("region", { name: "持仓照看" });
    const currentRefreshButton = within(currentWorkspace).getByRole("button", { name: "重试" });
    fireEvent.click(currentRefreshButton);
    traceManualMilestone("after-second-click", secondReceipt, secondRefreshIndex);
    traceManualMilestone("before-second-refresh-observed", secondReceipt, secondRefreshIndex);
    await waitFor(() => expect(holdingsReadinessProbe.refreshes).toHaveLength(secondRefreshIndex + 1));
    traceManualMilestone("after-second-refresh-observed", secondReceipt, secondRefreshIndex);
    const secondRefresh = holdingsReadinessProbe.refreshes[secondRefreshIndex];
    if (!secondRefresh) throw new Error("second homepage valuation refresh was not observed");
    expect(secondRefresh.trigger).toBe("manual");
    expect(secondRefresh.instrumentIds).toContain(instrument.id);
    const secondRefreshResultPromise = secondRefresh.promise;
    traceManualMilestone("before-second-producer-settled", secondReceipt, secondRefreshIndex);
    await waitFor(() => expect(fixture.recovery?.producerSettled).toBe(true));
    traceManualMilestone("after-second-producer-settled", secondReceipt, secondRefreshIndex);
    assertFreshProducerReceipt(secondReceipt, "success");
    expect(fixture.recovery?.producerStorageReadRequested).toBe(true);
    expect(fixture.recovery?.consumerReadRequested).toBe(true);
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);
    await waitFor(() => {
      expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    });
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
    expect(fixture.recovery?.calls.some(call => call.endpoint === "daily" && call.result === "success")).toBe(true);
    traceManualMilestone("before-second-result", secondReceipt, secondRefreshIndex);
    await act(async () => {
      fixture.recovery?.resolveConsumerRead(dailyRead("d1"));
      const secondResult = await secondRefreshResultPromise;
      expect(secondResult).toEqual(expect.objectContaining({ ok: true }));
    });
    traceManualMilestone("after-second-result", secondReceipt, secondRefreshIndex);
    traceManualMilestone("before-second-readiness-true", secondReceipt, secondRefreshIndex);
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));
    traceManualMilestone("after-second-readiness-true", secondReceipt, secondRefreshIndex);
    await waitFor(() => {
      const currentHoldings = within(screen.getByRole("region", { name: "持仓照看" }))
        .getByRole("region", { name: "当前持仓" });
      expect(currentHoldings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$101");
    });
    const finalHoldings = within(screen.getByRole("region", { name: "持仓照看" }))
      .getByRole("region", { name: "当前持仓" });
    expect(finalHoldings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("30");
    expect(finalHoldings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("2/20 日 · 价格走势");
  });

  it("routes a default-year homepage valuation retry to a retained closed-only financial key", async () => {
    const closedProducerTrace = createClosedProducerTrace("default-year-homepage");
    closedProducerTrace.mark("test.case:entry", { case: "default-year homepage valuation retry" });
    const fixture = createFixture({
      includeClosedHistorical: true,
      recoveryMode: "closedHistorical",
      closedProducerTrace,
    });
    const clearDeadlineTrace = armClosedJourneyDeadlineTrace(
      closedProducerTrace,
      fixture,
      "default-year-homepage",
    );
    // Install only at the real import dialog/confirm seam below. UI parsing
    // and dialog preparation must use their normal awaits before the bounded
    // driver starts observing production market-fetch cadence waits.
    let controlledRateWait: ControlledRateWait | undefined;
    closedProducerTrace.mark("test.stage:before-render");
    renderFixture(fixture);
    closedProducerTrace.mark("test.stage:after-render");
    const page = within(screen.getByRole("main"));
    closedProducerTrace.mark("test.stage:before-initial-requests");
    await waitFor(() => {
      expect(fixture.requests.some(({ input }) => input.instrumentId === instrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
      expect(fixture.requests.some(({ input }) => input.instrumentId === unrelatedInstrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
    });
    closedProducerTrace.mark("test.stage:after-initial-requests");
    await act(async () => {
      fixture.j0.resolve({ candles: [], dailyCandles: [], coverage: [], intervalCoverage: [] });
    });
    const initialWorkspace = await page.findByRole("region", { name: "持仓照看" });
    const initialHoldings = await within(initialWorkspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(initialHoldings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100"));
    expect(initialHoldings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(initialHoldings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");

    const importStart = fixture.captureMarketRefreshReceipt();
    let importReceipt: ClosedHistoricalImportReceipt | undefined;
    try {
      closedProducerTrace.mark("test.stage:before-import");
      closedProducerTrace.mark("test.importClosedHistorical:entry", importStart);
      const observeImportStage: ClosedProducerObserve = (label, details = {}) => {
        closedProducerTrace.mark(`test.importClosedHistorical:${label}`, {
          ...details,
          requestCount: fixture.requests.length,
          providerCallCount: fixture.recovery?.calls.length ?? 0,
          jobCount: fixture.putMarketDataJob.mock.calls.length,
          pendingRateWaitCount: controlledRateWait?.pendingCount() ?? 0,
        });
      };
      const importPreparation = await prepareClosedHistoricalImport(fixture, observeImportStage);
      closedProducerTrace.mark("test.importClosedHistorical:prepared");
      let importSettled = false;
      let importError: unknown;
      const importPromise = completeClosedHistoricalImport(
        fixture,
        importPreparation,
        () => {
          controlledRateWait = installControlledRateWait(closedProducerTrace);
          closedProducerTrace.mark("test.rate-wait:installed-before-confirm");
          // The public import is the full D1+1h producer journey. Keep its
          // owned consumer disabled until the homepage valuation retry so the
          // import receipt cannot be satisfied by a later consumer read.
          fixture.recovery?.beginSuccessfulImportAttempt();
        },
        observeImportStage,
      ).then(
        receipt => {
          importSettled = true;
          return receipt;
        },
        error => {
          importError = error;
          importSettled = true;
          // Keep the concurrently driven promise observed until the bounded
          // rate-wait drain finishes; rethrow below so the real import
          // failure remains a test failure rather than an unhandled rejection.
          return undefined;
        },
      );
      if (!controlledRateWait) {
        await importPromise;
        if (importError !== undefined) throw importError;
        throw new Error("[PA-I179 default-year:confirm] import did not install the cadence controller at the prepared dialog seam");
      }
      await drainObservedRateWaits(
        closedProducerTrace,
        controlledRateWait,
        "default-year:initial-import",
        () => importSettled || importError !== undefined,
      );
      const completedImportReceipt = await importPromise;
      if (importError !== undefined) throw importError;
      if (!completedImportReceipt) throw new Error("closed historical import promise settled without a receipt");
      importReceipt = completedImportReceipt;
      closedProducerTrace.mark("test.importClosedHistorical:complete", {
        requestCount: completedImportReceipt.requests.length,
        providerCallCount: completedImportReceipt.providerCalls.length,
        jobCount: completedImportReceipt.jobs.length,
      });
    } catch (error) {
      closedProducerTrace.dump(
        "test.importClosedHistorical:error",
        captureClosedProducerTraceReceipt(fixture, importStart),
        error,
      );
      throw error;
    }
    if (!importReceipt) throw new Error("closed historical import receipt was not observed");
    if (!controlledRateWait) throw new Error("closed historical import did not install the cadence controller");
    const rateWait = controlledRateWait;
    try {
      closedProducerTrace.mark("test.stage:before-import-producer-settled");
      expect(fixture.recovery?.producerSettled).toBe(true);
    } catch (error) {
      closedProducerTrace.dump(
        "test.import-producer-settled:error",
        captureClosedProducerTraceReceipt(fixture, importStart),
        error,
      );
      throw error;
    }
    expect(fixture.recovery?.producerStorageReadRequested).toBe(true);
    expect(fixture.recovery?.consumerReadRequested).toBe(false);
    expect(fixture.recovery?.hasProviderFailure()).toBe(false);
    expect(importReceipt.requests.some(({ input }) =>
      input.instrumentId === unrelatedInstrument.id && input.dailyOnly && input.interval === "1D",
    )).toBe(true);
    expect(importReceipt.jobs.some(job =>
      job.instrumentId === unrelatedInstrument.id && hasTerminalDailyReceipt(job),
    )).toBe(true);
    expect(importReceipt.providerCalls.some(call =>
      call.endpoint === "daily" &&
      call.instrumentId === unrelatedInstrument.id &&
      call.result === "success",
    )).toBe(true);
    expect(importReceipt.providerCalls.some(call =>
      call.endpoint === "intraday" &&
      call.instrumentId === unrelatedInstrument.id &&
      call.result === "success",
    )).toBe(true);
    expect(importReceipt.requests.some(({ input, source }) =>
      input.instrumentId === unrelatedInstrument.id &&
      !input.dailyOnly &&
      input.interval === "1h" &&
      source === "nio-1h-committed",
    )).toBe(true);
    expect(importReceipt.jobs.some(job =>
      job.instrumentId === unrelatedInstrument.id && hasTerminalHourlyReceipt(job),
    )).toBe(true);
    const importedXpevRequests = importReceipt.requests.filter(({ input }) =>
      input.instrumentId === instrument.id && (
        (input.dailyOnly && input.interval === "1D") ||
        (!input.dailyOnly && (input.interval === "1h" || input.interval === "15m"))
      ),
    );
    expect(importedXpevRequests.every(({ source }) => source.startsWith("xpev-"))).toBe(true);

    const mainNavigation = within(await page.findByRole("navigation", { name: "主导航" }));
    fireEvent.click(mainNavigation.getByRole("button", { name: "我的交易室" }));
    const workspace = await page.findByRole("region", { name: "持仓照看" });
    const holdings = await within(workspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100"));
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
    const history = page.getByRole("region", { name: "历史交易与复盘" });
    expect(history).not.toHaveTextContent("蔚来汽车");
    try {
      await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));
    } catch (error) {
      closedProducerTrace.dump(
        "test.default-year:post-import-readiness:error",
        captureClosedProducerTraceReceipt(fixture, importStart),
        error,
      );
      throw error;
    }

    const valuationCandidates = holdingsReadinessProbe.latest?.instruments ?? [];
    expect(valuationCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: unrelatedInstrument.id, market: unrelatedInstrument.market }),
    ]));
    const refreshButton = within(workspace).getByRole("button", { name: "更新估值" });
    const nioStorageReads = () => fixture.requests.filter(({ input }) =>
      input.instrumentId === unrelatedInstrument.id && input.dailyOnly && input.interval === "1D",
    );
    const nioTerminalJobs = () => fixture.putMarketDataJob.mock.calls
      .map(([job]) => job)
      .filter(job => job.instrumentId === unrelatedInstrument.id && hasTerminalDailyReceipt(job));
    const firstRequestStart = fixture.requests.length;
    const firstProviderStart = fixture.recovery?.calls.length ?? 0;
    const firstJobStart = fixture.putMarketDataJob.mock.calls.length;
    const firstAttemptReceipt: MarketRefreshReceipt = {
      requestStart: firstRequestStart,
      providerStart: firstProviderStart,
      jobStart: firstJobStart,
    };
    const firstRefreshIndex = holdingsReadinessProbe.refreshes.length;
    closedProducerTrace.mark("test.stage:before-rate-wait-control");
    const countNioDailyPutReturns = (minimumCoverageCount: number) => closedProducerTrace.count(
      "fixture.adapter.putMarketData:return",
      details => details?.instrumentId === unrelatedInstrument.id &&
        details?.kind === "daily" &&
        Number(details.coverageCount ?? 0) >= minimumCoverageCount,
    );
    const firstNioDailyPutReturnBaseline = {
      one: countNioDailyPutReturns(1),
      two: countNioDailyPutReturns(2),
    };
    const hasNioDailyPutReturn = (minimumCoverageCount: number, baselineCount: number) =>
      countNioDailyPutReturns(minimumCoverageCount) > baselineCount;
    const captureRateWaitReceipt = () => ({
      pendingCount: rateWait.pendingCount(),
      requestCount: fixture.requests.length,
      providerCount: fixture.recovery?.calls.length ?? 0,
      jobCount: fixture.putMarketDataJob.mock.calls.length,
      producerStorageReadRequested: fixture.recovery?.producerStorageReadRequested,
      producerSettled: fixture.recovery?.producerSettled,
      consumerReadRequested: fixture.recovery?.consumerReadRequested,
    });
    const advanceRateWaitUntil = async (
      label: string,
      receipt: MarketRefreshReceipt,
      predicate: () => boolean,
      onAdvance?: () => Promise<void>,
      hasObservedRead?: () => boolean,
    ) => {
      const before = captureRateWaitReceipt();
      const maxAdvances = 4;
      let advances = 0;
      try {
        const complete = () => predicate() && rateWait.pendingCount() === 0;
        while (!complete() && advances < maxAdvances) {
          // A producer may publish an observed storage read in a promise
          // continuation after the previous cadence callback returns. Give
          // that already-observed request a chance to settle before requiring
          // another rate timer; the callback remains source/attempt scoped.
          if (onAdvance) await onAdvance();
          if (complete()) break;
          await waitFor(() => {
            if (complete() || rateWait.pendingCount() > 0 || hasObservedRead?.()) return;
            expect(rateWait.pendingCount()).toBeGreaterThan(0);
          });
          if (complete()) break;
          if (rateWait.pendingCount() === 0) {
            if (hasObservedRead?.() && onAdvance) await onAdvance();
            continue;
          }
          advances += 1;
          await act(async () => {
            rateWait.advance(`${label}:${advances}`);
          });
          await Promise.resolve();
          if (onAdvance) await onAdvance();
        }
        await waitFor(() => expect(complete()).toBe(true));
        const after = captureRateWaitReceipt();
        closedProducerTrace.mark("test.rate-wait:receipt", {
          label,
          requestStart: receipt.requestStart,
          providerStart: receipt.providerStart,
          jobStart: receipt.jobStart,
          advances,
          before,
          after,
        });
      } catch (error) {
        const after = captureRateWaitReceipt();
        let predicateSatisfied: boolean | "threw" = false;
        try {
          predicateSatisfied = predicate();
        } catch {
          predicateSatisfied = "threw";
        }
        closedProducerTrace.mark("test.rate-wait:error", {
          label,
          predicateSatisfied,
          before,
          after,
          pendingCount: after.pendingCount,
        });
        closedProducerTrace.dump(
          `test.rate-wait:${label}:error`,
          captureClosedProducerTraceReceipt(fixture, receipt),
          error,
        );
        throw error;
      }
    };
    // A producer can issue its next XPEV storage read only after a rate wait
    // callback has run. Drain only sources observed for this attempt after
    // each callback, so the real producer can reach its matching terminal.
    // The fixture has one d1 deferred and four manual deferred reads. Keep
    // both the source and request budgets finite per attempt; an observed
    // source is the only thing this pump may release, and a repeated source
    // cannot turn into an unbounded retry loop.
    const maxObservedXpevDailySourcesPerAttempt = 1 + fixture.manualDailyReads.length;
    const maxObservedXpevDailyRequestsPerAttempt = maxObservedXpevDailySourcesPerAttempt;
    const drainObservedXpevDailyReads = async (
      requestStart: number,
      resolvedSources: Set<string>,
    ) => {
      while (true) {
        const observedRequests = fixture.requests.slice(requestStart).filter(({ input }) =>
          input.instrumentId === instrument.id &&
          input.dailyOnly &&
          input.interval === "1D",
        );
        if (observedRequests.length > maxObservedXpevDailyRequestsPerAttempt) {
          throw new Error(
            `[PA-I203] observed XPEV daily request bound exceeded: ` +
            `${observedRequests.length} > ${maxObservedXpevDailyRequestsPerAttempt}`,
          );
        }
        const source = fixture.findObservedXpevDailySource(requestStart, resolvedSources);
        if (!source) return;
        if (resolvedSources.size >= maxObservedXpevDailySourcesPerAttempt) {
          throw new Error(
            `[PA-I203] observed XPEV daily source bound exceeded: ` +
            `${resolvedSources.size} >= ${maxObservedXpevDailySourcesPerAttempt}`,
          );
        }
        resolvedSources.add(source);
        await act(async () => {
          expect(fixture.resolveObservedXpevRead(source, requestStart)).toBe(true);
        });
        await Promise.resolve();
      }
    };
    const hasFreshMatchingTerminal = (jobStart: number, instrumentId: string) => {
      const postAttemptJobs = fixture.putMarketDataJob.mock.calls
        .slice(jobStart)
        .map(([job], offset) => ({ job, jobIndex: jobStart + offset }))
        .filter(({ job }) => job.instrumentId === instrumentId);
      const syncingJobs = postAttemptJobs.filter(({ job }) =>
        job.status === "syncing" &&
        Boolean(job.requestedAt) &&
        job.intervals.some(interval => interval.interval === "1D" && interval.status === "syncing"),
      );
      return postAttemptJobs.some(({ job: terminalJob, jobIndex: terminalIndex }) =>
        hasTerminalDailyReceipt(terminalJob) &&
        syncingJobs.some(({ job: syncingJob, jobIndex: syncingIndex }) =>
          terminalIndex > syncingIndex && terminalJob.requestedAt === syncingJob.requestedAt,
        ),
      );
    };
    // Keep the fixed Shanghai market date while giving this first real
    // closed-only attempt a distinct requestedAt from initial hydration.
    // The bounded rate driver may already have advanced Date.now() for
    // captured production cadence waits, so advance from the current logical
    // clock instead of moving it backwards to the fixture origin.
    vi.setSystemTime(new Date(Date.now() + 1));
    fixture.recovery?.beginSuccessfulAttempt();
    expect(holdingsReadinessProbe.latest?.instruments).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: unrelatedInstrument.id, market: unrelatedInstrument.market }),
    ]));
    closedProducerTrace.mark("test.stage:before-first-click");
    fireEvent.click(refreshButton);
    closedProducerTrace.mark("test.stage:after-first-click");
    await waitFor(() => expect(holdingsReadinessProbe.refreshes).toHaveLength(firstRefreshIndex + 1));
    const firstRefresh = holdingsReadinessProbe.refreshes[firstRefreshIndex];
    if (!firstRefresh) throw new Error("first homepage valuation refresh was not observed");
    closedProducerTrace.mark("test.homepage-refresh:observed", {
      attempt: "first",
      refreshIndex: firstRefreshIndex,
      instrumentIds: [...firstRefresh.instrumentIds],
      trigger: firstRefresh.trigger,
    });
    void firstRefresh.promise.then(
      result => closedProducerTrace.mark("test.homepage-refresh:return", { attempt: "first", result }),
      error => closedProducerTrace.mark("test.homepage-refresh:error", { attempt: "first", error: traceError(error) }),
    );
    expect(firstRefresh.trigger).toBe("manual");
    expect(firstRefresh.instrumentIds).toContain(unrelatedInstrument.id);
    const firstXpevSources = new Set<string>();
    let firstRefreshSettled = false;
    const firstRefreshResultPromise = firstRefresh.promise.then(
      result => {
        firstRefreshSettled = true;
        return result;
      },
      error => {
        firstRefreshSettled = true;
        throw error;
      },
    );
    // Release only a live XPEV daily source observed after this click. The
    // import receipt and candidate list cannot authorize an old or future
    // deferred read.
    let firstProducerXpevSource: string | undefined;
    await waitFor(() => {
      firstProducerXpevSource = fixture.findObservedXpevDailySource(firstRequestStart, firstXpevSources);
      expect(firstProducerXpevSource).toBeDefined();
    });
    firstXpevSources.add(firstProducerXpevSource!);
    await act(async () => {
      expect(fixture.resolveObservedXpevRead(firstProducerXpevSource!, firstRequestStart)).toBe(true);
    });
    await advanceRateWaitUntil(
      "first-attempt:nio-first-daily-chunk",
      firstAttemptReceipt,
      () => {
        const freshNioDailyProviders = fixture.recovery?.calls
          .slice(firstProviderStart)
          .filter(call => call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success")
          .length ?? 0;
        return freshNioDailyProviders >= 1 && hasNioDailyPutReturn(1, firstNioDailyPutReturnBaseline.one);
      },
      async () => drainObservedXpevDailyReads(firstRequestStart, firstXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(firstRequestStart, firstXpevSources)),
    );
    await advanceRateWaitUntil(
      "first-attempt:nio-second-daily-chunk",
      firstAttemptReceipt,
      () => {
        const freshNioDailyProviders = fixture.recovery?.calls
          .slice(firstProviderStart)
          .filter(call => call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success")
          .length ?? 0;
        return freshNioDailyProviders >= 2 && hasNioDailyPutReturn(2, firstNioDailyPutReturnBaseline.two);
      },
      async () => drainObservedXpevDailyReads(firstRequestStart, firstXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(firstRequestStart, firstXpevSources)),
    );
    await drainObservedXpevDailyReads(firstRequestStart, firstXpevSources);
    await advanceRateWaitUntil(
      "first-attempt:xpev-daily-batch",
      firstAttemptReceipt,
      () => hasFreshMatchingTerminal(firstJobStart, instrument.id),
      async () => drainObservedXpevDailyReads(firstRequestStart, firstXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(firstRequestStart, firstXpevSources)),
    );
    await drainObservedXpevDailyReads(firstRequestStart, firstXpevSources);

    const collectClosedAttemptReceipt = (
      requestStart: number,
      providerStart: number,
      jobStart: number,
      refreshInstrumentIds: ReadonlySet<string>,
      resolvedXpevSources: ReadonlySet<string>,
      refreshSettled: boolean,
    ) => {
      const postAttemptJobs = fixture.putMarketDataJob.mock.calls
        .slice(jobStart)
        .map(([job], offset) => ({ job, jobIndex: jobStart + offset }))
        .filter(({ job }) => refreshInstrumentIds.has(job.instrumentId));
      const syncingJobs = postAttemptJobs.filter(({ job }) =>
        job.status === "syncing" &&
        Boolean(job.requestedAt) &&
        job.intervals.some(interval => interval.interval === "1D" && interval.status === "syncing"),
      );
      const terminalJobs = postAttemptJobs.filter(({ job }) => hasTerminalDailyReceipt(job));
      const matchingTerminalJobs = terminalJobs.filter(({ job: terminalJob, jobIndex: terminalIndex }) =>
        syncingJobs.some(({ job: syncingJob, jobIndex: syncingIndex }) =>
          terminalIndex > syncingIndex &&
          terminalJob.instrumentId === syncingJob.instrumentId &&
          terminalJob.requestedAt === syncingJob.requestedAt,
        ),
      );
      const postAttemptProviders = fixture.recovery?.calls.slice(providerStart) ?? [];
      const postAttemptStorage = fixture.requests.slice(requestStart).map(({ input, source }) => ({
        source,
        instrumentId: input.instrumentId,
        interval: input.interval,
        dailyOnly: input.dailyOnly,
        start: input.start,
        end: input.end,
      }));
      const observedSources = new Set(postAttemptStorage.map(({ source }) => source));
      const deferredStates = [
        { source: "xpev-d1", settled: fixture.d1.isSettled() },
        ...fixture.manualDailyReads.map((read, index) => ({ source: `xpev-manual-${index}`, settled: read.isSettled() })),
        ...fixture.manualNioDailyReads.map((read, index) => ({ source: `nio-manual-${index}`, settled: read.isSettled() })),
        { source: "nio-j0", settled: fixture.j0.isSettled() },
        { source: "nio-j1", settled: fixture.j1.isSettled() },
      ];
      return {
        requestStart,
        providerStart,
        jobStart,
        jobs: postAttemptJobs.map(({ job, jobIndex }) => ({
          jobIndex,
          instrumentId: job.instrumentId,
          status: job.status,
          requestedAt: job.requestedAt,
          intervals: job.intervals.map(interval => ({ interval: interval.interval, status: interval.status })),
        })),
        syncingJobs: syncingJobs.map(({ job, jobIndex }) => ({
          jobIndex,
          instrumentId: job.instrumentId,
          requestedAt: job.requestedAt,
        })),
        terminalJobs: terminalJobs.map(({ job, jobIndex }) => ({
          jobIndex,
          instrumentId: job.instrumentId,
          requestedAt: job.requestedAt,
          status: job.status,
          dailyStatus: job.intervals.find(interval => interval.interval === "1D")?.status,
        })),
        matchingTerminalJobs: matchingTerminalJobs.map(({ job, jobIndex }) => ({
          jobIndex,
          instrumentId: job.instrumentId,
          requestedAt: job.requestedAt,
          status: job.status,
          dailyStatus: job.intervals.find(interval => interval.interval === "1D")?.status,
        })),
        providers: postAttemptProviders.map(call => ({
          endpoint: call.endpoint,
          result: call.result,
          instrumentId: call.instrumentId,
        })),
        storage: postAttemptStorage,
        observedXpevSources: postAttemptStorage
          .filter(({ instrumentId, dailyOnly, interval }) => instrumentId === instrument.id && dailyOnly && interval === "1D")
          .map(({ source }) => ({ source, resolved: resolvedXpevSources.has(source) })),
        unsettledDeferredReads: deferredStates.filter(({ source, settled }) => observedSources.has(source) && !settled),
        recoveryReadGate: {
          producerStorageReadRequested: fixture.recovery?.producerStorageReadRequested,
          producerSettled: fixture.recovery?.producerSettled,
          consumerReadRequested: fixture.recovery?.consumerReadRequested,
          refreshSettled,
        },
        refreshInstrumentIds: [...refreshInstrumentIds],
        refreshReceipts: [...refreshInstrumentIds].map(instrumentId => ({
          instrumentId,
          syncingJobs: syncingJobs
            .filter(({ job }) => job.instrumentId === instrumentId)
            .map(({ job, jobIndex }) => ({ jobIndex, requestedAt: job.requestedAt })),
          matchingTerminalJobs: matchingTerminalJobs
            .filter(({ job }) => job.instrumentId === instrumentId)
            .map(({ job, jobIndex }) => ({ jobIndex, requestedAt: job.requestedAt })),
          storage: postAttemptStorage.filter(request => request.instrumentId === instrumentId),
          providers: postAttemptProviders.filter(call => call.instrumentId === instrumentId),
        })),
      };
    };

    closedProducerTrace.mark("test.stage:before-first-receipt");
    await waitForClosedProducerTrace(
      closedProducerTrace,
      fixture,
      "test.first-attempt-receipt:error",
      { requestStart: firstRequestStart, providerStart: firstProviderStart, jobStart: firstJobStart },
      async () => {
      await drainObservedXpevDailyReads(firstRequestStart, firstXpevSources);
      const receipt = collectClosedAttemptReceipt(
        firstRequestStart,
        firstProviderStart,
        firstJobStart,
        new Set(firstRefresh.instrumentIds),
        firstXpevSources,
        firstRefreshSettled,
      );
      const hasFreshNioProvider = receipt.providers.some(call =>
        call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success",
      );
      const hasFreshNioStorage = receipt.storage.some(request =>
        request.instrumentId === unrelatedInstrument.id && request.dailyOnly && request.interval === "1D",
      );
      const hasFreshXpevDailyRead = receipt.observedXpevSources.length > 0 &&
        receipt.observedXpevSources.every(({ resolved }) => resolved);
      const hasFreshStorageForEveryInstrument = receipt.refreshReceipts.every(instrumentReceipt =>
        instrumentReceipt.storage.some(request => request.dailyOnly && request.interval === "1D"),
      );
      const hasTerminalForEveryInstrument = receipt.refreshReceipts.every(instrumentReceipt =>
        instrumentReceipt.syncingJobs.length > 0 && instrumentReceipt.matchingTerminalJobs.length > 0,
      );
      if (
        hasFreshNioProvider &&
        hasFreshNioStorage &&
        hasFreshXpevDailyRead &&
        hasFreshStorageForEveryInstrument &&
        hasTerminalForEveryInstrument
      ) return;
      throw new Error(`[PAI40 first retry receipt blocked] ${JSON.stringify(receipt)}`);
      },
    );
    await waitFor(() => expect(fixture.recovery?.producerSettled).toBe(true));
    closedProducerTrace.mark("test.stage:before-first-consumer-read");
    await waitForClosedProducerTrace(
      closedProducerTrace,
      fixture,
      "test.default-year-consumer-read:error",
      { requestStart: firstRequestStart, providerStart: firstProviderStart, jobStart: firstJobStart },
      () => expect(fixture.recovery?.consumerReadRequested).toBe(true),
    );
    closedProducerTrace.mark("test.default-year-consumer-read:requested");
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
    await act(async () => {
      fixture.recovery?.rejectConsumerRead(new Error("owned NIO k2 daily reread failed"));
    });
    let firstRereadXpevSource: string | undefined;
    await waitFor(() => {
      firstRereadXpevSource = fixture.findObservedXpevDailySource(firstRequestStart, firstXpevSources);
      if (firstRereadXpevSource || firstRefreshSettled) return;
      throw new Error("waiting for an observed first-attempt XPEV reread or refresh completion");
    });
    if (firstRereadXpevSource) {
      firstXpevSources.add(firstRereadXpevSource);
      await act(async () => {
        expect(fixture.resolveObservedXpevRead(firstRereadXpevSource!, firstRequestStart)).toBe(true);
      });
    }
    await act(async () => {
      const firstResult = await firstRefreshResultPromise;
      expect(firstResult).toEqual(expect.objectContaining({ ok: false }));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    // A second user-triggered retry must reread the current raw key and only
    // then make the financial bundle ready. The closed NIO remains outside the
    // selected year; its success is observed through the real consumer gate.
    const previousNioTerminalJob = nioTerminalJobs().at(-1);
    const secondRequestStart = fixture.requests.length;
    const secondProviderStart = fixture.recovery?.calls.length ?? 0;
    const secondJobStart = fixture.putMarketDataJob.mock.calls.length;
    const secondAttemptReceipt: MarketRefreshReceipt = {
      requestStart: secondRequestStart,
      providerStart: secondProviderStart,
      jobStart: secondJobStart,
    };
    const secondRefreshIndex = holdingsReadinessProbe.refreshes.length;
    const secondNioDailyPutReturnBaseline = {
      one: countNioDailyPutReturns(1),
      two: countNioDailyPutReturns(2),
    };
    // Keep the fixed Shanghai market date while giving this second real
    // closed-only attempt a distinct requestedAt from both prior attempts.
    vi.setSystemTime(new Date(Date.now() + 1));
    fixture.recovery?.beginSuccessfulAttempt();
    expect(holdingsReadinessProbe.latest?.instruments).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrumentId: unrelatedInstrument.id, market: unrelatedInstrument.market }),
    ]));
    closedProducerTrace.mark("test.stage:before-second-click");
    fireEvent.click(refreshButton);
    closedProducerTrace.mark("test.stage:after-second-click");
    await waitFor(() => expect(holdingsReadinessProbe.refreshes).toHaveLength(secondRefreshIndex + 1));
    const secondRefresh = holdingsReadinessProbe.refreshes[secondRefreshIndex];
    if (!secondRefresh) throw new Error("second homepage valuation refresh was not observed");
    closedProducerTrace.mark("test.homepage-refresh:observed", {
      attempt: "second",
      refreshIndex: secondRefreshIndex,
      instrumentIds: [...secondRefresh.instrumentIds],
      trigger: secondRefresh.trigger,
    });
    void secondRefresh.promise.then(
      result => closedProducerTrace.mark("test.homepage-refresh:return", { attempt: "second", result }),
      error => closedProducerTrace.mark("test.homepage-refresh:error", { attempt: "second", error: traceError(error) }),
    );
    expect(secondRefresh.trigger).toBe("manual");
    expect(secondRefresh.instrumentIds).toContain(unrelatedInstrument.id);
    const secondXpevSources = new Set<string>();
    const secondRefreshResultPromise = secondRefresh.promise;
    // As with the first retry, resolve only the exact XPEV daily source that
    // this click has already requested; do not release an old/future deferred.
    let secondProducerXpevSource: string | undefined;
    await waitFor(() => {
      secondProducerXpevSource = fixture.findObservedXpevDailySource(secondRequestStart, secondXpevSources);
      expect(secondProducerXpevSource).toBeDefined();
    });
    secondXpevSources.add(secondProducerXpevSource!);
    await act(async () => {
      expect(fixture.resolveObservedXpevRead(secondProducerXpevSource!, secondRequestStart)).toBe(true);
    });
    await advanceRateWaitUntil(
      "second-attempt:nio-first-daily-chunk",
      secondAttemptReceipt,
      () => {
        const freshNioDailyProviders = fixture.recovery?.calls
          .slice(secondProviderStart)
          .filter(call => call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success")
          .length ?? 0;
        return freshNioDailyProviders >= 1 && hasNioDailyPutReturn(1, secondNioDailyPutReturnBaseline.one);
      },
      async () => drainObservedXpevDailyReads(secondRequestStart, secondXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(secondRequestStart, secondXpevSources)),
    );
    await advanceRateWaitUntil(
      "second-attempt:nio-second-daily-chunk",
      secondAttemptReceipt,
      () => {
        const freshNioDailyProviders = fixture.recovery?.calls
          .slice(secondProviderStart)
          .filter(call => call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success")
          .length ?? 0;
        return freshNioDailyProviders >= 2 && hasNioDailyPutReturn(2, secondNioDailyPutReturnBaseline.two);
      },
      async () => drainObservedXpevDailyReads(secondRequestStart, secondXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(secondRequestStart, secondXpevSources)),
    );
    await drainObservedXpevDailyReads(secondRequestStart, secondXpevSources);
    await advanceRateWaitUntil(
      "second-attempt:xpev-daily-batch",
      secondAttemptReceipt,
      () => hasFreshMatchingTerminal(secondJobStart, instrument.id),
      async () => drainObservedXpevDailyReads(secondRequestStart, secondXpevSources),
      () => Boolean(fixture.findObservedXpevDailySource(secondRequestStart, secondXpevSources)),
    );
    await drainObservedXpevDailyReads(secondRequestStart, secondXpevSources);
    closedProducerTrace.mark("test.stage:before-second-receipt");
    await waitForClosedProducerTrace(
      closedProducerTrace,
      fixture,
      "test.second-attempt-receipt:error",
      { requestStart: secondRequestStart, providerStart: secondProviderStart, jobStart: secondJobStart },
      async () => {
      await drainObservedXpevDailyReads(secondRequestStart, secondXpevSources);
      const receipt = collectClosedAttemptReceipt(
        secondRequestStart,
        secondProviderStart,
        secondJobStart,
        new Set(secondRefresh.instrumentIds),
        secondXpevSources,
        false,
      );
      const hasFreshNioProvider = receipt.providers.some(call =>
        call.endpoint === "daily" && call.instrumentId === unrelatedInstrument.id && call.result === "success",
      );
      const hasFreshNioStorage = receipt.storage.some(request =>
        request.instrumentId === unrelatedInstrument.id && request.dailyOnly && request.interval === "1D",
      );
      const hasFreshXpevDailyRead = receipt.observedXpevSources.length > 0 &&
        receipt.observedXpevSources.every(({ resolved }) => resolved);
      const hasFreshStorageForEveryInstrument = receipt.refreshReceipts.every(instrumentReceipt =>
        instrumentReceipt.storage.some(request => request.dailyOnly && request.interval === "1D"),
      );
      const hasTerminalForEveryInstrument = receipt.refreshReceipts.every(instrumentReceipt =>
        instrumentReceipt.syncingJobs.length > 0 && instrumentReceipt.matchingTerminalJobs.length > 0,
      );
      if (
        hasFreshNioProvider &&
        hasFreshNioStorage &&
        hasFreshXpevDailyRead &&
        hasFreshStorageForEveryInstrument &&
        hasTerminalForEveryInstrument
      ) return;
      throw new Error(`[PAI40 second retry receipt blocked] ${JSON.stringify(receipt)}`);
      },
    );
    await waitFor(() => expect(fixture.recovery?.producerSettled).toBe(true));
    const secondReceipt = collectClosedAttemptReceipt(
      secondRequestStart,
      secondProviderStart,
      secondJobStart,
      new Set(secondRefresh.instrumentIds),
      secondXpevSources,
      false,
    );
    const secondNioReceipt = secondReceipt.refreshReceipts.find(({ instrumentId }) => instrumentId === unrelatedInstrument.id);
    const secondNioProviderCall = secondNioReceipt?.providers.at(-1);
    const secondNioStorageRead = secondNioReceipt?.storage.at(-1);
    const secondNioTerminalJob = secondNioReceipt?.matchingTerminalJobs.at(-1);
    const secondNioSyncingJob = secondNioReceipt?.syncingJobs.at(-1);
    expect(secondNioProviderCall?.result).toBe("success");
    expect(secondNioStorageRead?.end).toBe("2025-10-06");
    expect(secondNioSyncingJob?.requestedAt).toBeDefined();
    expect(secondNioTerminalJob?.requestedAt).toBeDefined();
    expect(secondNioTerminalJob?.requestedAt).toBe(secondNioSyncingJob?.requestedAt);
    expect(secondNioTerminalJob?.requestedAt).not.toBe(previousNioTerminalJob?.requestedAt);
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");

    // Let only the second attempt's observed XPEV reread settle after the new
    // NIO producer/provider/storage/terminal receipt is visible. The owned NIO
    // consumer remains deferred until its own current-key request is observed.
    await waitFor(() => expect(fixture.recovery?.consumerReadRequested).toBe(true));
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);
    await act(async () => {
      fixture.recovery?.resolveConsumerRead(dailyReadFor(unrelatedInstrument, "d1", "2025"));
    });
    let secondRereadXpevSource: string | undefined;
    await waitFor(() => {
      secondRereadXpevSource = fixture.findObservedXpevDailySource(secondRequestStart, secondXpevSources);
      expect(secondRereadXpevSource).toBeDefined();
    });
    secondXpevSources.add(secondRereadXpevSource!);
    await act(async () => {
      expect(fixture.resolveObservedXpevRead(secondRereadXpevSource!, secondRequestStart)).toBe(true);
      await secondRefreshResultPromise;
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));
    expect(nioStorageReads().at(-1)?.input.end).toBe("2025-10-06");
    expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100");
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    expect(holdings.querySelector('td[data-label="近30日价格"]')).toHaveTextContent("1/20 日 · 价格走势");
    clearDeadlineTrace();
  });

  it("recovers a closed-only historical instrument through the visible data health retry", async () => {
    const closedProducerTrace = createClosedProducerTrace("data-health-retry");
    closedProducerTrace.mark("test.case:entry", { case: "visible data health retry" });
    const fixture = createFixture({
      includeClosedHistorical: true,
      recoveryMode: "closedHistorical",
      closedProducerTrace,
    });
    const clearDeadlineTrace = armClosedJourneyDeadlineTrace(
      closedProducerTrace,
      fixture,
      "data-health-retry",
    );
    // The import and the visible retry both use the real market fetcher. Keep
    // its already-requested cadence waits observable and advance only those
    // waits while this journey is waiting for its public milestones.
    const controlledRateWait = installControlledRateWait(closedProducerTrace);
    closedProducerTrace.mark("test.stage:before-render");
    renderFixture(fixture);
    closedProducerTrace.mark("test.stage:after-render");
    const page = within(screen.getByRole("main"));
    closedProducerTrace.mark("test.stage:before-initial-requests");

    await waitFor(() => {
      expect(fixture.requests.some(({ input }) => input.instrumentId === instrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
      expect(fixture.requests.some(({ input }) => input.instrumentId === unrelatedInstrument.id && input.dailyOnly && input.interval === "1D")).toBe(true);
    });
    closedProducerTrace.mark("test.stage:after-initial-requests");
    await act(async () => {
      fixture.j0.resolve(dailyReadFor(unrelatedInstrument, "d0", "2025"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));

    const mainNavigation = within(await page.findByRole("navigation", { name: "主导航" }));
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const dataManagement = await page.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("2 个已导入标的");
    fireEvent.click(within(dataManagement).getByRole("tab", { name: "导入记录" }));
    const importData = within(dataManagement).getByRole("region", { name: "导入交易数据" });
    fireEvent.click(within(importData).getByRole("button", { name: "导入交易记录" }));
    const input = page.getByLabelText("导入交易记录", { selector: "input" });
    const file = closedHistoricalImportFile();
    fireEvent.change(input, { target: { files: [file] } });
    const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
    within(importDialog).getByRole("heading", { name: "确认导入交易记录" });
    const importStart = fixture.captureMarketRefreshReceipt();
    closedProducerTrace.mark("test.stage:before-import");
    closedProducerTrace.mark("test.import:entry", importStart);
    const nioDailyRequestsBeforeImport = fixture.requests.filter(({ input: request }) =>
      request.instrumentId === unrelatedInstrument.id && request.dailyOnly,
    ).length;
    fixture.recovery?.armFailedAttempt();
    closedProducerTrace.mark("test.import:confirm");
    fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
    await waitFor(() => expect(fixture.requests.filter(({ input: request }) =>
      request.instrumentId === unrelatedInstrument.id && request.dailyOnly,
    ).length).toBeGreaterThan(nioDailyRequestsBeforeImport));

    await drainObservedRateWaits(
      closedProducerTrace,
      controlledRateWait,
      "data-health:initial-import",
      () => fixture.recovery?.producerSettled === true,
    );

    await waitForClosedProducerTrace(
      closedProducerTrace,
      fixture,
      "test.import-producer-settled:error",
      importStart,
      () => expect(fixture.recovery?.producerSettled).toBe(true),
    );
    closedProducerTrace.mark("test.import:producer-settled");
    expect(fixture.recovery?.producerStorageReadRequested).toBe(true);
    expect(fixture.recovery?.consumerReadRequested).toBe(false);
    expect(fixture.recovery?.hasProviderFailure()).toBe(true);
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    fireEvent.click(mainNavigation.getByRole("button", { name: "我的交易室" }));
    const workspace = await page.findByRole("region", { name: "持仓照看" });
    const holdings = await within(workspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(holdings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100"));
    expect(holdings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    const history = page.getByRole("region", { name: "历史交易与复盘" });
    expect(history).not.toHaveTextContent("蔚来汽车");
    fireEvent.click(within(history).getByRole("tab", { name: "全部" }));
    await waitFor(() => expect(history).toHaveTextContent("蔚来汽车"));

    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    await page.findByRole("region", { name: "数据管理" });
    const retryManagement = page.getByRole("region", { name: "数据管理" });
    fireEvent.click(within(retryManagement).getByRole("tab", { name: "数据健康" }));
    const quality = await page.findByRole("region", { name: "数据质量明细" });
    const historical = within(quality).getByRole("article", { name: "历史复盘 K 线" });
    const retry = await within(historical).findByRole("button", { name: "重试历史复盘 K 线" });
    const retryStart = fixture.captureMarketRefreshReceipt();
    closedProducerTrace.mark("test.data-health-retry:entry", retryStart);
    // Keep the fixed Shanghai market date while giving this real retry a
    // distinct requestedAt from the prior closed-only producer attempt. The
    // initial import may have advanced the logical clock through captured
    // production cadence waits, so do not reset it to the origin.
    vi.setSystemTime(new Date(Date.now() + 1));
    fixture.recovery?.beginSuccessfulAttempt();
    closedProducerTrace.mark("test.data-health-retry:click");
    fireEvent.click(retry);
    closedProducerTrace.mark("test.stage:after-health-retry-click");

    await drainObservedRateWaits(
      closedProducerTrace,
      controlledRateWait,
      "data-health:visible-retry",
      () => fixture.recovery?.consumerReadRequested === true,
    );

    await waitForClosedProducerTrace(
      closedProducerTrace,
      fixture,
      "test.data-health-retry-consumer-read:error",
      retryStart,
      () => expect(fixture.recovery?.consumerReadRequested).toBe(true),
    );
    closedProducerTrace.mark("test.data-health-retry:consumer-read-requested");
    expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false);
    await act(async () => {
      closedProducerTrace.mark("test.data-health-retry:consumer-read-resolve");
      fixture.recovery?.resolveConsumerRead(dailyReadFor(unrelatedInstrument, "d1", "2025"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(true));
    closedProducerTrace.mark("test.data-health-retry:readiness-complete");
    expect(fixture.recovery?.calls.some(call => call.endpoint === "daily" && call.result === "success")).toBe(true);

    fireEvent.click(mainNavigation.getByRole("button", { name: "我的交易室" }));
    const finalWorkspace = await page.findByRole("region", { name: "持仓照看" });
    const recoveredHoldings = await within(finalWorkspace).findByRole("region", { name: "当前持仓" });
    await waitFor(() => expect(recoveredHoldings.querySelector('td[data-label="估值价"]')).toHaveTextContent("US$100"));
    expect(recoveredHoldings.querySelector('td[data-label="持仓数量"]')).toHaveTextContent("20");
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    await page.findByRole("region", { name: "数据管理" });
    const finalManagement = page.getByRole("region", { name: "数据管理" });
    fireEvent.click(within(finalManagement).getByRole("tab", { name: "数据健康" }));
    const recoveredQuality = await page.findByRole("region", { name: "数据质量明细" });
    const recoveredHistorical = within(recoveredQuality).getByRole("article", { name: "历史复盘 K 线" });
    closedProducerTrace.mark("test.data-health-retry:before-final-quality");
    try {
      expect(recoveredHistorical).toHaveTextContent("可用");
    } catch (error) {
      closedProducerTrace.dump(
        "test.data-health-retry:final-quality:error",
        captureClosedProducerTraceReceipt(fixture, retryStart),
        error,
      );
      throw error;
    }
    closedProducerTrace.mark("test.data-health-retry:after-final-quality");
    expect(within(recoveredHistorical).queryByRole("button", { name: "重试历史复盘 K 线" })).not.toBeInTheDocument();
    clearDeadlineTrace();
  });

  it("does not promote a cancelled manual read after its deferred result arrives", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    await importMiddle(fixture);
    await act(async () => {
      fixture.d1.reject(new Error("k2 daily read failed"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    const page = within(await screen.findByRole("main"));
    fireEvent.click(page.getByRole("button", { name: "我的交易室" }));
    const holdings = await page.findByRole("region", { name: "当前持仓" });
    const workspace = page.getByRole("region", { name: "持仓照看" });
    fireEvent.click(within(workspace).getByRole("button", { name: "重试" }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D")).toHaveLength(3));
    holdingsReadinessProbe.latest?.onCancel?.([instrument.id]);
    await act(async () => {
      fixture.manualDailyReads[0]?.resolve(dailyRead("d1"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));
    expect(fixture.requests.filter(({ input }) => input.dailyOnly && input.interval === "1D")).toHaveLength(3);
  });

  it("preserves every caller scope id when retrying a failed holdings publication", async () => {
    const fixture = createFixture({ includeRetryScope: true, includeUnrelated: true });
    renderFixture(fixture);
    const { page, mainNavigation } = await findPublicWorkspaceRoots();
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const dataManagement = await page.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText(/\d+ 个已导入标的/);
    const importData = within(dataManagement).getByRole("region", { name: "导入交易数据" });
    fireEvent.click(within(importData).getByRole("button", { name: "导入交易记录" }));
    const input = page.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile()] } });
    const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
    fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));
    await waitFor(() => expect(fixture.requests.filter(({ input: request }) =>
      request.instrumentId === instrument.id && request.dailyOnly && request.interval === "1D",
    )).toHaveLength(2));

    await act(async () => {
      fixture.d1.reject(new Error("failed publication readback"));
    });
    await waitFor(() => expect(holdingsReadinessProbe.latest?.initialDataReady).toBe(false));

    const retryScope = ["US:QQQ", instrument.id, "US:SPY", "US:NIO"] as const;
    const requestStart = fixture.requests.length;
    const jobStart = fixture.putMarketDataJob.mock.calls.length;
    const retry = holdingsReadinessProbe.latest?.onRefresh?.(retryScope, "manual");
    expect(retry).toBeDefined();

    await waitFor(() => {
      const requestedIds = new Set(
        fixture.requests
          .slice(requestStart)
          .filter(({ input }) => input.dailyOnly && input.interval === "1D")
          .map(({ input }) => input.instrumentId),
      );
      expect(requestedIds).toEqual(new Set(retryScope));
    });

    await act(async () => {
      fixture.manualDailyReads[0]?.resolve(dailyRead("d1"));
    });
    await waitFor(() => {
      const settledIds = new Set(
        fixture.putMarketDataJob.mock.calls
          .slice(jobStart)
          .map(([job]) => job.instrumentId),
      );
      expect(settledIds).toEqual(new Set(retryScope));
    });
  }, 5000);

  it("retains a candle-only I cache when the next version settles with an empty optional read", async () => {
    const fixture = createFixture();
    renderFixture(fixture);

    const { page, mainNavigation } = await findPublicWorkspaceRoots();
    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const dataManagement = await page.findByRole("region", { name: "数据管理" });
    await within(dataManagement).findByText("1 个已导入标的");
    fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
    const tradeLibrary = await page.findByRole("region", { name: "交易库" });
    const stockRow = await within(tradeLibrary).findByRole("button", { name: /展开小鹏汽车交易回合/ });
    fireEvent.click(stockRow);
    fireEvent.click(await within(tradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(1));
    await act(async () => {
      fixture.i1.resolve(intradayReadWithoutCoverage());
    });

    fireEvent.click(mainNavigation.getByRole("button", { name: "数据" }));
    const importManagement = await page.findByRole("region", { name: "数据管理" });
    fireEvent.click(within(importManagement).getByRole("button", { name: "导入交易记录" }));
    const input = page.getByLabelText("导入交易记录", { selector: "input" });
    fireEvent.change(input, { target: { files: [importFile("2026-10-06 00:00:00")] } });
    const importDialog = await page.findByRole("dialog", { name: "确认导入交易记录" });
    await within(importDialog).findByRole("heading", { name: "确认导入交易记录" });
    fireEvent.click(within(importDialog).getByRole("button", { name: "确认导入并开始更新行情" }));
    await waitFor(() => expect(fixture.mergeInputs).toHaveLength(1));

    fireEvent.click(mainNavigation.getByRole("button", { name: "交易库" }));
    const mergedTradeLibrary = await page.findByRole("region", { name: "交易库" });
    const mergedStockRow = await within(mergedTradeLibrary).findByRole("button", { name: /小鹏汽车交易回合/ });
    if (mergedStockRow.getAttribute("aria-label")?.startsWith("展开")) fireEvent.click(mergedStockRow);
    fireEvent.click(await within(mergedTradeLibrary).findByRole("button", { name: /打开小鹏汽车第1次交易 富途/ }));
    await waitFor(() => expect(fixture.requests.filter(({ input }) => input.interval === "1h" && !input.dailyOnly)).toHaveLength(2));
    await act(async () => {
      fixture.d1.resolve(dailyRead("d1"));
      fixture.i2.resolve({ candles: [], intervalCoverage: [] });
    });

    const repairButton = await page.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await page.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
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

  it("keeps D0 and I1 while exposing the initial D1 read failure", async () => {
    const fixture = createFixture();
    renderFixture(fixture);
    await importMiddleAndOpenSelectedEpisode(fixture);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
      fixture.d1.reject(new Error("late daily read failed"));
    });
    const page = within(await screen.findByRole("main"));
    const repairButton = await page.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await page.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
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

  it("clears an old persisted I error on I1 success after the initial D1 read", async () => {
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
    const page = within(screen.getByRole("main"));
    await importMiddleAndOpenSelectedEpisode(fixture);
    await act(async () => {
      fixture.i1.resolve(intradayRead());
      fixture.d1.resolve(dailyRead("d1"));
    });
    const repairButton = await page.findByRole("button", { name: "检查/修复数据" });
    fireEvent.click(repairButton);
    const dialog = await page.findByRole("dialog", { name: "检查与修复当前股票数据" });
    fireEvent.click(within(dialog).getByRole("button", { name: "查看完整数据并暂停复盘" }));
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).not.toHaveTextContent(persistedMessage);
    expect(dialog).toHaveTextContent("当前行情状态：日线：行情可更新；1H：行情可更新");
    await waitFor(() => expect(dialog).toHaveTextContent("本地日线：2 根；小时线：1 根"));
    expect(dialog).not.toHaveTextContent(persistedMessage);
  }, 5000);

  it("publishes a native 15m read through Recall after the initial D1 terminal", async () => {
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
      fixture.d1.resolve(dailyRead("d1"));
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
      fixture.d1.resolve(dailyRead("d1"));
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
