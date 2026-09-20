import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, isAbsolute, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SQLITE_MIGRATIONS } from "../../../db/sqlite-schema";
import type {
  DailyCandleRecord,
  CoverageRecord,
  MarketDataProviderId,
} from "../../../app/lib/market/contracts";
import type { MarketDataJob } from "../../../app/lib/storage/market-data-jobs";
import type { ImportHistoryEntry } from "../../../app/lib/storage/import-history";
import type {
  CoverageRecord,
  StoredInstrument,
} from "../../../app/lib/storage/sqlite-contracts";
import type {
  Instrument,
  TradeExecution,
} from "../../../app/lib/trades/types";
import {
  FX_BASE_CURRENCY,
  FX_SETTINGS_KEY,
  FX_SOURCE,
  type FxState,
} from "../../../app/lib/fx/contracts";
import { PRINCIPAL_SETTINGS_KEY } from "../../../app/lib/principal/principal-model";

/**
 * Seed data for the trading-room acceptance plan.
 *
 * This file intentionally lives under .scratch and refuses every path outside
 * that directory. It must always be called with an explicit absolute target;
 * there is no production/default database fallback.
 */

const QA_ROOT = resolve(
  process.cwd(),
  ".scratch/trading-room-implementation/qa",
);
const NOW = "2026-09-19T08:00:00.000Z";
const RESOLVED_AT = "2026-09-19T00:00:00.000Z";
const SHANGHAI_TODAY = "2026-09-19";

type AssetType = "stock" | "etf";
type Market = "US" | "HK" | "CN-SH" | "CN-SZ";
type Nature = "live" | "unknown";

type SeedOptions = {
  target: string;
  force: boolean;
  rateMode: "ready" | "stale" | "none";
  principalMode: "complete" | "missing-hk" | "none";
};

type FixtureSource = TradeExecution["source"] & {
  tradeNature?: "live" | "simulation" | "unknown";
};

function fail(message: string): never {
  throw new Error(message);
}

function parseOptions(argv: string[]): SeedOptions {
  let target: string | undefined;
  let force = false;
  let rateMode: SeedOptions["rateMode"] = "ready";
  let principalMode: SeedOptions["principalMode"] = "complete";

  for (const argument of argv) {
    if (argument === "--force") {
      force = true;
      continue;
    }
    if (argument.startsWith("--rates=")) {
      const value = argument.slice("--rates=".length);
      if (value !== "ready" && value !== "stale" && value !== "none") {
        fail("--rates must be ready, stale, or none");
      }
      rateMode = value;
      continue;
    }
    if (argument.startsWith("--principal=")) {
      const value = argument.slice("--principal=".length);
      if (value !== "complete" && value !== "missing-hk" && value !== "none") {
        fail("--principal must be complete, missing-hk, or none");
      }
      principalMode = value;
      continue;
    }
    if (argument.startsWith("-")) fail(`unknown option: ${argument}`);
    if (target !== undefined) fail("only one explicit target database is allowed");
    target = argument;
  }

  if (!target) {
    fail(
      `usage: tsx ${basename(process.argv[1] ?? "seed-homepage-fixture.ts")} ` +
        `${QA_ROOT}/qa-fixture.sqlite [--force] [--rates=ready|stale|none] ` +
        "[--principal=complete|missing-hk|none]",
    );
  }
  if (!isAbsolute(target)) fail("target database must be an absolute path");

  const resolvedTarget = resolve(target);
  if (
    resolvedTarget === QA_ROOT ||
    !resolvedTarget.startsWith(`${QA_ROOT}${sep}`) ||
    !resolvedTarget.endsWith(".sqlite")
  ) {
    fail(`target must be an explicit .sqlite file inside ${QA_ROOT}`);
  }

  return {
    target: resolvedTarget,
    force,
    rateMode,
    principalMode,
  };
}

function metadata(
  market: Market,
  symbol: string,
  name: string,
  assetType: AssetType,
): StoredInstrument["metadata"] {
  return {
    market,
    symbol,
    name,
    assetType,
    source: "statement",
    confidence: "statement",
    resolvedAt: RESOLVED_AT,
  };
}

function instrument(
  market: Market,
  symbol: string,
  name: string,
  currency: string,
  assetType: AssetType,
  id = `${market}:${symbol}`,
): StoredInstrument {
  return {
    id,
    symbol,
    name,
    market,
    currency,
    metadata: metadata(market, symbol, name, assetType),
  };
}

function plainInstrument(value: StoredInstrument): Instrument {
  const { metadata: _metadata, ...plain } = value;
  return plain;
}

function timestamp(date: string, time: string): string {
  return `${date}T${time}.000Z`;
}

function sourceFor(
  nature: Nature,
  batchId: string,
  row: number,
  date: string,
  patch: Partial<FixtureSource> = {},
): FixtureSource {
  return {
    platform: nature === "live" ? "futu" : "qa-unknown-source",
    row,
    batchId,
    tradeNature: nature,
    tradingDate: date,
    marketCalendarDate: date,
    feeStatus: "reported",
    ...patch,
  };
}

function fill(input: {
  id: string;
  accountId: string;
  accountLabel: string;
  instrument: StoredInstrument;
  side: "buy" | "sell";
  date: string;
  time?: string;
  quantity: string;
  price: string;
  batchId: string;
  nature: Nature;
  row: number;
  fee?: string;
  source?: Partial<FixtureSource>;
}): TradeExecution {
  return {
    id: input.id,
    accountId: input.accountId,
    accountLabel: input.accountLabel,
    instrument: plainInstrument(input.instrument),
    side: input.side,
    executedAt: timestamp(input.date, input.time ?? (input.side === "buy" ? "01:00:00" : "02:00:00")),
    quantity: input.quantity,
    price: input.price,
    fee: input.fee ?? "0",
    source: sourceFor(
      input.nature,
      input.batchId,
      input.row,
      input.date,
      input.source,
    ),
  };
}

function pair(input: {
  prefix: string;
  instrument: StoredInstrument;
  accountId: string;
  accountLabel: string;
  buyDate: string;
  sellDate: string;
  quantity: string;
  buyPrice: string;
  sellPrice: string;
  batchId: string;
  nature?: Nature;
  buyFee?: string;
  sellFee?: string;
  buySource?: Partial<FixtureSource>;
  sellSource?: Partial<FixtureSource>;
}): TradeExecution[] {
  const nature = input.nature ?? "live";
  return [
    fill({
      id: `${input.prefix}:buy`,
      accountId: input.accountId,
      accountLabel: input.accountLabel,
      instrument: input.instrument,
      side: "buy",
      date: input.buyDate,
      quantity: input.quantity,
      price: input.buyPrice,
      fee: input.buyFee,
      batchId: input.batchId,
      nature,
      row: 1,
      source: input.buySource,
    }),
    fill({
      id: `${input.prefix}:sell`,
      accountId: input.accountId,
      accountLabel: input.accountLabel,
      instrument: input.instrument,
      side: "sell",
      date: input.sellDate,
      quantity: input.quantity,
      price: input.sellPrice,
      fee: input.sellFee,
      batchId: input.batchId,
      nature,
      row: 2,
      source: input.sellSource,
    }),
  ];
}

function simulationPair(input: {
  prefix: string;
  runId: string;
  tradeId: string;
  instrument: StoredInstrument;
  buyDate: string;
  sellDate: string;
  buyPrice: string;
  sellPrice: string;
  batchId: string;
}): TradeExecution[] {
  const simulationSource = (
    role: "entry" | "exit",
    date: string,
  ): Partial<FixtureSource> => ({
    platform: "tradingview",
    tradeNature: "simulation",
    tradingNature: "simulated",
    simulationRunId: input.runId,
    simulationTradeId: input.tradeId,
    simulationRole: role,
    sourceTradeId: `${input.runId}-${input.tradeId}`,
    fileFingerprint: `qa-${input.runId}.csv`,
    timePrecision: "date-only",
    sourceTimezone: "Asia/Shanghai",
    tradingDate: date,
    marketCalendarDate: date,
    inputKind: "tradingview",
    simulationSignal: "qa-fixture",
    ...(role === "exit"
      ? {
          simulationReport: {
            netPnl: "10",
            returnPercent: "1",
            favorableExcursion: "12",
            favorableExcursionPercent: "1.2",
            adverseExcursion: "-2",
            adverseExcursionPercent: "-0.2",
            cumulativePnl: "10",
            cumulativeReturnPercent: "1",
            durationBars: "4",
          },
        }
      : {}),
  });

  return pair({
    prefix: input.prefix,
    instrument: input.instrument,
    accountId: `simulation-${input.runId}`,
    accountLabel: `模拟运行 ${input.runId}`,
    buyDate: input.buyDate,
    sellDate: input.sellDate,
    quantity: "1",
    buyPrice: input.buyPrice,
    sellPrice: input.sellPrice,
    batchId: input.batchId,
    nature: "live",
    buySource: simulationSource("entry", input.buyDate),
    sellSource: simulationSource("exit", input.sellDate),
  });
}

function buildInstruments(): StoredInstrument[] {
  return [
    instrument("CN-SH", "600000", "浦发银行", "CNY", "stock"),
    instrument("US", "AAPL", "苹果公司", "USD", "stock"),
    // Keep the display/provider symbol padded while storing the app's
    // canonical HK instrument id (HK:700).
    instrument("HK", "0700", "腾讯控股", "HKD", "stock", "HK:700"),
    instrument("CN-SZ", "159919", "沪深300ETF", "CNY", "etf"),
    instrument("US", "SPY", "标普500ETF", "USD", "etf"),
    instrument("HK", "2800", "盈富基金", "HKD", "etf"),
    instrument("US", "MSFT", "微软", "USD", "stock"),
    instrument("US", "GOOG", "谷歌", "USD", "stock"),
    instrument("HK", "1810", "小米集团", "HKD", "stock"),
    instrument("US", "ZZQA", "未知来源测试标的", "USD", "stock"),
  ];
}

function buildExecutions(instruments: readonly StoredInstrument[]): TradeExecution[] {
  const byId = new Map(instruments.map((value) => [value.id, value]));
  const get = (id: string): StoredInstrument => byId.get(id) ?? fail(`missing instrument ${id}`);
  const executions: TradeExecution[] = [];
  const add = (...values: Array<TradeExecution | TradeExecution[]>) => {
    executions.push(...values.flat());
  };

  // Two 10,000 CNY cost rounds, each earning 100 CNY: cost ROI = 200/20,000 = 1%.
  // The matching live principal setting is 10,000 CNY: principal ROI = 200/10,000 = 2%.
  add(pair({
    prefix: "roi-a-share-1",
    instrument: get("CN-SH:600000"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-09-03",
    sellDate: "2026-09-04",
    quantity: "1000",
    buyPrice: "10",
    sellPrice: "10.1",
    batchId: "qa-live-september",
  }));
  add(pair({
    prefix: "roi-a-share-2",
    instrument: get("CN-SH:600000"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-09-10",
    sellDate: "2026-09-11",
    quantity: "1000",
    buyPrice: "10",
    sellPrice: "10.1",
    batchId: "qa-live-september",
  }));

  // Fixed-clock boundaries: 2024 leap day, year boundary, and natural-month edges.
  add(pair({
    prefix: "boundary-leap-day",
    instrument: get("US:AAPL"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2024-02-29",
    sellDate: "2024-03-01",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-boundaries",
  }));
  add(pair({
    prefix: "boundary-year-end",
    instrument: get("US:AAPL"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2025-12-30",
    sellDate: "2025-12-31",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-boundaries",
  }));
  add(pair({
    prefix: "boundary-year-start",
    instrument: get("US:AAPL"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-01-02",
    sellDate: "2026-01-05",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-boundaries",
  }));
  add(pair({
    prefix: "boundary-july-start",
    instrument: get("US:AAPL"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-07-01",
    sellDate: "2026-07-02",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-boundaries",
  }));
  add(pair({
    prefix: "boundary-august-end",
    instrument: get("US:AAPL"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-08-31",
    sellDate: "2026-09-01",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-boundaries",
  }));

  // Unknown source: valid PnL but excluded from the default live scope.
  add(pair({
    prefix: "unknown-source",
    instrument: get("US:ZZQA"),
    accountId: "unknown-account",
    accountLabel: "来源未知账户",
    buyDate: "2026-09-06",
    sellDate: "2026-09-07",
    quantity: "10",
    buyPrice: "20",
    sellPrice: "21",
    batchId: "qa-unknown-september",
    nature: "unknown",
  }));

  // Closed but unavailable because the source fee is unknown.
  add(pair({
    prefix: "quality-unknown-fee",
    instrument: get("US:MSFT"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-09-08",
    sellDate: "2026-09-09",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "101",
    batchId: "qa-quality-september",
    buyFee: "",
    sellFee: "",
    buySource: { feeStatus: "unknown" },
    sellSource: { feeStatus: "unknown" },
  }));

  // Closed but unavailable because the history chain is incomplete.
  add(pair({
    prefix: "quality-history-gap",
    instrument: get("US:GOOG"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-09-12",
    sellDate: "2026-09-13",
    quantity: "10",
    buyPrice: "100",
    sellPrice: "102",
    batchId: "qa-quality-september",
    buySource: { historyIncomplete: ["statement-2026-08"] },
    sellSource: { historyIncomplete: ["statement-2026-08"] },
  }));

  // Quote currency is HKD while settlement evidence is CNY: do not silently
  // treat the pair as a normal HKD PnL sample.
  const mismatchSettlement = (side: "buy" | "sell"): Partial<FixtureSource> => ({
    settlement: {
      currency: "CNY",
      quantity: "10",
      grossAmount: "100",
      netAmount: side === "buy" ? "-100" : "100",
      fees: {},
    },
  });
  add(pair({
    prefix: "quality-settlement-mismatch",
    instrument: get("HK:1810"),
    accountId: "live-main",
    accountLabel: "主账户",
    buyDate: "2026-09-14",
    sellDate: "2026-09-15",
    quantity: "10",
    buyPrice: "10",
    sellPrice: "11",
    batchId: "qa-quality-september",
    buySource: mismatchSettlement("buy"),
    sellSource: mismatchSettlement("sell"),
  }));

  // An open position predating the current-month window remains visible.
  add(fill({
    id: "holding-hk-main-buy",
    accountId: "live-main",
    accountLabel: "主账户",
    instrument: get("HK:700"),
    side: "buy",
    date: "2026-08-20",
    quantity: "100",
    price: "50",
    batchId: "qa-live-holdings",
    nature: "live",
    row: 1,
  }));
  add(fill({
    id: "holding-hk-secondary-buy",
    accountId: "live-secondary",
    accountLabel: "主账户",
    instrument: get("HK:700"),
    side: "buy",
    date: "2026-09-10",
    quantity: "40",
    price: "51",
    batchId: "qa-live-holdings",
    nature: "live",
    row: 2,
  }));
  add(fill({
    id: "holding-cn-etf-buy",
    accountId: "live-main",
    accountLabel: "主账户",
    instrument: get("CN-SZ:159919"),
    side: "buy",
    date: "2026-09-02",
    quantity: "100",
    price: "3",
    batchId: "qa-live-holdings",
    nature: "live",
    row: 3,
  }));
  add(fill({
    id: "holding-us-etf-buy",
    accountId: "live-main",
    accountLabel: "主账户",
    instrument: get("US:SPY"),
    side: "buy",
    date: "2026-08-15",
    quantity: "5",
    price: "400",
    batchId: "qa-live-holdings",
    nature: "live",
    row: 4,
  }));
  add(fill({
    id: "holding-hk-etf-buy",
    accountId: "live-main",
    accountLabel: "主账户",
    instrument: get("HK:2800"),
    side: "buy",
    date: "2026-09-03",
    quantity: "20",
    price: "20",
    batchId: "qa-live-holdings",
    nature: "live",
    row: 5,
  }));

  // Two otherwise identical simulation contexts must remain separate.
  add(simulationPair({
    prefix: "simulation-run-a",
    runId: "run-a",
    tradeId: "1001",
    instrument: get("US:SPY"),
    buyDate: "2026-09-05",
    sellDate: "2026-09-06",
    buyPrice: "400",
    sellPrice: "410",
    batchId: "qa-simulation-run-a",
  }));
  add(simulationPair({
    prefix: "simulation-run-b",
    runId: "run-b",
    tradeId: "2001",
    instrument: get("US:SPY"),
    buyDate: "2026-09-12",
    sellDate: "2026-09-13",
    buyPrice: "400",
    sellPrice: "390",
    batchId: "qa-simulation-run-b",
  }));

  return executions;
}

function batch(
  id: string,
  fileName: string,
  sourceLabel: string,
  tradeCount: number,
  nature: ImportHistoryEntry["tradeNature"],
  sourceKind: ImportHistoryEntry["sourceKind"] = "statement",
  simulationRunId?: string,
): ImportHistoryEntry {
  return {
    id,
    fileName,
    sourceLabel,
    importedAt: NOW,
    tradeCount,
    instrumentCount: 1,
    excludedInstrumentCount: 0,
    excludedRecordCount: 0,
    duplicateTradeCount: 0,
    unresolvedInstrumentCount: 0,
    sourceKind,
    tradeNature: nature,
    ...(simulationRunId ? { simulationRunId } : {}),
  };
}

function buildImportHistory(executions: readonly TradeExecution[]): ImportHistoryEntry[] {
  const byBatch = new Map<string, TradeExecution[]>();
  for (const execution of executions) {
    const id = execution.source.batchId ?? "qa-unbatched";
    byBatch.set(id, [...(byBatch.get(id) ?? []), execution]);
  }
  return [...byBatch.entries()].map(([id, rows]) => {
    const first = rows[0];
    const source = first.source;
    const simulation = source.tradingNature === "simulated";
    const nature: ImportHistoryEntry["tradeNature"] = simulation
      ? "simulation"
      : source.tradeNature ?? "unknown";
    return batch(
      id,
      `${id}.csv`,
      source.platform,
      rows.length,
      nature,
      simulation ? "tradingview" : "statement",
      simulation ? source.simulationRunId : undefined,
    );
  });
}

function candle(
  instrumentId: string,
  currency: string,
  provider: MarketDataProviderId,
  providerSymbol: string,
  tradingDate: string,
  close: string,
  fetchedAt: string,
): DailyCandleRecord {
  return {
    instrumentId,
    tradingDate,
    open: close,
    high: close,
    low: close,
    close,
    volume: "100000",
    currency,
    provider,
    providerSymbol,
    adjustmentMode: "raw",
    fetchedAt,
  };
}

function buildMarketData(): {
  dailyCandles: DailyCandleRecord[];
  coverage: CoverageRecord[];
  providerSymbols: Array<{ instrumentId: string; provider: MarketDataProviderId; providerSymbol: string }>;
} {
  return {
    dailyCandles: [
      // 2026-09-19 is Saturday in Hong Kong. Keep the synthetic latest close
      // on the last completed HK session so the homepage hydration range
      // includes it when the fixture is opened on the 19th.
      candle("HK:700", "HKD", "tencent", "00700", "2026-09-18", "52", NOW),
      candle("US:SPY", "USD", "yahoo", "SPY", "2026-09-10", "405", "2026-09-10T08:00:00.000Z"),
    ],
    coverage: [
      {
        instrumentId: "HK:700",
        adjustmentMode: "raw",
        startDate: "2026-08-20",
        endDate: "2026-09-18",
        segments: [{
          startDate: "2026-08-20",
          endDate: "2026-09-18",
          status: "complete",
          provider: "tencent",
          fetchedAt: NOW,
          missingTradingDates: [],
        }],
      },
      {
        instrumentId: "US:SPY",
        adjustmentMode: "raw",
        startDate: "2026-08-15",
        endDate: "2026-09-10",
        segments: [{
          startDate: "2026-08-15",
          endDate: "2026-09-19",
          actualEndDate: "2026-09-10",
          status: "stale",
          provider: "yahoo",
          fetchedAt: "2026-09-10T08:00:00.000Z",
          missingTradingDates: ["2026-09-11", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"],
          reason: "qa-stale-tail",
        }],
      },
    ],
    providerSymbols: [
      { instrumentId: "HK:700", provider: "tencent", providerSymbol: "00700" },
      { instrumentId: "US:SPY", provider: "yahoo", providerSymbol: "SPY" },
    ],
  };
}

function buildJobs(): MarketDataJob[] {
  return [
    {
      instrumentId: "HK:700",
      symbol: "0700",
      market: "HK",
      requestedAt: NOW,
      status: "complete",
      intervals: [{ interval: "1D", status: "complete", coverageStart: "2026-08-20", coverageEnd: "2026-09-18" }],
    },
    {
      instrumentId: "US:SPY",
      symbol: "SPY",
      market: "US",
      requestedAt: NOW,
      status: "stale",
      message: "报价已过期",
      intervals: [{ interval: "1D", status: "stale", coverageStart: "2026-08-15", coverageEnd: "2026-09-10" }],
    },
    {
      instrumentId: "CN-SZ:159919",
      symbol: "159919",
      market: "CN-SZ",
      requestedAt: NOW,
      status: "needs-provider",
      message: "行情源不支持该标的",
      intervals: [{ interval: "1D", status: "needs-provider", message: "行情源不支持该标的" }],
    },
    {
      instrumentId: "US:MSFT",
      symbol: "MSFT",
      market: "US",
      requestedAt: NOW,
      status: "source-unavailable",
      error: { code: "qa-source-unavailable", message: "受控样例：行情源暂不可用" },
      intervals: [{ interval: "1D", status: "source-unavailable", error: { code: "qa-source-unavailable", message: "受控样例：行情源暂不可用" } }],
    },
  ];
}

function buildSettings(options: SeedOptions) {
  const principalEntries = {
    "a-share-stock": { amount: "10000", currency: "CNY" },
    "us-stock": { amount: "10000", currency: "USD" },
    "hk-stock": { amount: "10000", currency: "HKD" },
    etf: { amount: "10000", currency: "CNY" },
  };
  if (options.principalMode === "missing-hk") delete principalEntries["hk-stock"];

  const fxState: FxState = options.rateMode === "none"
    ? {
        id: `fx:missing:${NOW}`,
        baseCurrency: FX_BASE_CURRENCY,
        source: FX_SOURCE,
        publishedAt: null,
        publishedAtByCurrency: {},
        fetchedAt: null,
        rates: {},
        // Keep the controlled no-rate state from triggering an automatic
        // second attempt on the fixture's Shanghai calendar day.
        lastAttemptDay: SHANGHAI_TODAY,
        status: "missing",
        error: "暂无可用汇率（QA 受控样例）",
      }
    : {
        id: options.rateMode === "stale"
          ? "boc:2026-09-10T03:00:00.000Z"
          : `boc:${NOW}`,
        baseCurrency: FX_BASE_CURRENCY,
        source: FX_SOURCE,
        publishedAt: options.rateMode === "stale"
          ? "2026-09-10T02:00:00.000Z"
          : "2026-09-19T02:30:00.000Z",
        publishedAtByCurrency: options.rateMode === "stale"
          ? {
              USD: "2026-09-10T02:00:00.000Z",
              HKD: "2026-09-10T01:20:00.000Z",
            }
          : {
              USD: "2026-09-19T02:30:00.000Z",
              HKD: "2026-09-19T01:20:00.000Z",
            },
        fetchedAt: options.rateMode === "stale"
          ? "2026-09-10T03:00:00.000Z"
          : NOW,
        rates: { USD: "7.2000", HKD: "0.9200" },
        // FxState has no separate stale status. A failed daily attempt keeps
        // the last complete rates and records the failure while advancing the
        // Shanghai attempt day, matching createFxService.persistFailure().
        lastAttemptDay: SHANGHAI_TODAY,
        status: "complete",
        error: options.rateMode === "stale" ? "更新失败：qa-refresh-failed" : null,
      };

  return {
    "qa:trading-room:fixture:v1": {
      id: "homepage-full",
      generatedAt: NOW,
      fixedClock: "2026-09-19",
      notes: [
        "A股股票/美股股票/港股股票/全市场ETF metadata are explicit.",
        "Two A-share rounds are the 1% cost ROI and 2% principal ROI sample.",
        "Open holdings include pre-period activity and two accounts sharing HK:700 (display symbol 0700).",
      ],
    },
    [FX_SETTINGS_KEY]: fxState,
    [PRINCIPAL_SETTINGS_KEY]: {
      version: 1,
      scopes: {
        live: options.principalMode === "none" ? {} : principalEntries,
      },
    },
    "qa:trading-room:expected:v1": {
      currentMonth: { start: "2026-09-01", end: "2026-09-19" },
      recentThreeNaturalMonths: { start: "2026-07-01", end: "2026-09-19" },
      roiSample: {
        netPnl: "200",
        buyCost: "20000",
        costReturn: "1%",
        principal: "10000",
        principalReturn: "2%",
      },
      fxSettingsKey: FX_SETTINGS_KEY,
      exchangeRates: { USD_CNY: "7.2000", HKD_CNY: "0.9200" },
      missingFeeExecutionPrefix: "quality-unknown-fee",
      simulationRuns: ["run-a", "run-b"],
      prePeriodHolding: "holding-hk-main-buy",
    },
  };
}

function removeExistingTarget(target: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const path = `${target}${suffix}`;
    if (existsSync(path)) rmSync(path, { force: true });
  }
}

function json(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) fail("fixture value was not JSON serializable");
  return serialized;
}

function initializeDatabase(database: DatabaseSync): void {
  database.exec("pragma foreign_keys = on");
  database.exec("pragma journal_mode = wal");
  database.exec("pragma busy_timeout = 5000");
  database.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      checksum text not null,
      applied_at text not null default current_timestamp
    )
  `);
  const applied = database.prepare("select checksum from schema_migrations where version = ?");
  const record = database.prepare(
    "insert into schema_migrations (version, name, checksum) values (?, ?, ?)",
  );
  for (const migration of SQLITE_MIGRATIONS) {
    const current = applied.get(migration.version) as { checksum?: string } | undefined;
    if (current) {
      if (current.checksum !== migration.checksum) {
        fail(`SQLite migration ${migration.version} checksum mismatch`);
      }
      continue;
    }
    database.exec("begin immediate");
    try {
      database.exec(migration.sql);
      record.run(migration.version, migration.name, migration.checksum);
      database.exec("commit");
    } catch (error) {
      database.exec("rollback");
      throw error;
    }
  }
}

function writeFixture(
  database: DatabaseSync,
  options: SeedOptions,
  instruments: readonly StoredInstrument[],
  executions: readonly TradeExecution[],
  importHistory: readonly ImportHistoryEntry[],
  marketData: ReturnType<typeof buildMarketData>,
): void {
  const settings = buildSettings(options);
  database.exec("begin immediate");
  try {
    const instrumentInsert = database.prepare(`
      insert into instruments (
        id, symbol, name, market, currency, metadata_json, localized_name_json
      ) values (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const value of instruments) {
      instrumentInsert.run(
        value.id,
        value.symbol,
        value.name,
        value.market,
        value.currency,
        value.metadata ? json(value.metadata) : null,
        value.localizedName ? json(value.localizedName) : null,
      );
    }

    const historyInsert = database.prepare(`
      insert into import_batches (
        id, source_name, source_type, imported_at, record_count,
        trade_nature, simulation_run_id, reconciliation_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of importHistory) {
      historyInsert.run(
        entry.id,
        entry.fileName,
        entry.sourceKind ?? "statement",
        entry.importedAt,
        entry.tradeCount,
        entry.tradeNature ?? null,
        entry.simulationRunId ?? null,
        json(entry),
      );
    }

    const executionInsert = database.prepare(`
      insert into executions (
        id, import_batch_id, instrument_id, account, side, executed_at,
        quantity, price, fee, currency, trade_nature, simulation_run_id,
        evidence_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const execution of executions) {
      executionInsert.run(
        execution.id,
        execution.source.batchId ?? null,
        execution.instrument.id,
        execution.accountId,
        execution.side,
        execution.executedAt,
        execution.quantity,
        execution.price,
        execution.fee,
        execution.instrument.currency,
        execution.source.tradeNature ?? null,
        execution.source.simulationRunId ?? null,
        json({ source: execution.source, accountLabel: execution.accountLabel }),
      );
    }

    const candleInsert = database.prepare(`
      insert into daily_candles (
        instrument_id, date, adjustment_mode, open, high, low, close,
        volume, provider, provider_symbol, currency, fetched_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const value of marketData.dailyCandles) {
      candleInsert.run(
        value.instrumentId,
        value.tradingDate,
        value.adjustmentMode,
        value.open,
        value.high,
        value.low,
        value.close,
        value.volume,
        value.provider,
        value.providerSymbol,
        value.currency,
        value.fetchedAt,
      );
    }

    const coverageInsert = database.prepare(`
      insert into coverage (
        instrument_id, adjustment_mode, start_date, end_date, details_json
      ) values (?, ?, ?, ?, ?)
    `);
    for (const value of marketData.coverage) {
      coverageInsert.run(
        value.instrumentId,
        value.adjustmentMode,
        value.startDate ?? null,
        value.endDate ?? null,
        value.segments ? json(value.segments) : null,
      );
    }

    const providerInsert = database.prepare(`
      insert into provider_symbols (
        instrument_id, provider, provider_symbol, metadata_json
      ) values (?, ?, ?, ?)
    `);
    for (const value of marketData.providerSymbols) {
      providerInsert.run(value.instrumentId, value.provider, value.providerSymbol, null);
    }

    const jobInsert = database.prepare(`
      insert into market_data_jobs (
        id, instrument_id, provider, status, progress_json, error_json
      ) values (?, ?, ?, ?, ?, ?)
    `);
    for (const job of buildJobs()) {
      jobInsert.run(
        job.instrumentId,
        job.instrumentId,
        "qa-fixed",
        job.status,
        json(job),
        job.error ? json(job.error) : null,
      );
    }

    const settingInsert = database.prepare(`
      insert into app_settings (key, value_json)
      values (?, ?)
    `);
    for (const [key, value] of Object.entries(settings)) {
      settingInsert.run(key, json(value));
    }
    database.exec("commit");
  } catch (error) {
    database.exec("rollback");
    throw error;
  }
}

function readSummary(database: DatabaseSync, options: SeedOptions) {
  const count = (table: string): number => {
    const row = database.prepare(`select count(*) as count from ${table}`).get() as { count: number };
    return Number(row.count);
  };
  const assetRows = database.prepare(`
    select id, json_extract(metadata_json, '$.assetType') as asset_type
    from instruments order by id
  `).all() as Array<{ id: string; asset_type: string | null }>;
  return {
    target: options.target,
    fixture: "homepage-full",
    options: { rates: options.rateMode, principal: options.principalMode },
    schemaVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0,
    counts: {
      instruments: count("instruments"),
      executions: count("executions"),
      importBatches: count("import_batches"),
      settings: count("app_settings"),
      marketDataJobs: count("market_data_jobs"),
      dailyCandles: count("daily_candles"),
    },
    assetTypes: Object.fromEntries(assetRows.map((value) => [value.id, value.asset_type ?? "unknown"])),
    executionPrefixes: [
      "roi-a-share-1",
      "roi-a-share-2",
      "boundary-leap-day",
      "unknown-source",
      "quality-unknown-fee",
      "quality-history-gap",
      "quality-settlement-mismatch",
      "holding-hk-main-buy",
      "simulation-run-a",
      "simulation-run-b",
    ],
  };
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  mkdirSync(QA_ROOT, { recursive: true });
  if (existsSync(options.target)) {
    if (!options.force) {
      fail(`target already exists; choose another scratch path or pass --force: ${options.target}`);
    }
    removeExistingTarget(options.target);
  }

  mkdirSync(resolve(options.target, ".."), { recursive: true });
  const database = new DatabaseSync(options.target);
  try {
    initializeDatabase(database);
    const instruments = buildInstruments();
    const executions = buildExecutions(instruments);
    const importHistory = buildImportHistory(executions);
    const marketData = buildMarketData();

    writeFixture(database, options, instruments, executions, importHistory, marketData);
    const summary = readSummary(database, options);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    database.close();
  }
}

main();
