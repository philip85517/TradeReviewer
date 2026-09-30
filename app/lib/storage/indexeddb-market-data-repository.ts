/** MIGRATION-ONLY: retired IndexedDB repository for browser-state-export/tests. */
import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  NativeMarketInterval,
} from "../market/contracts";
import type {
  DailyMarketDataRead,
  IntervalMarketDataCommit,
  IntervalMarketDataRead,
  MarketDataCommit,
  MarketDataRepository,
} from "./market-data-repository";
import {
  COVERAGE,
  DAILY_CANDLES,
  INTERVAL_COVERAGE,
  MARKET_CANDLES,
  openTradeReviewDatabase,
  PROVIDER_SYMBOLS,
  requestValue,
  transactionDone,
} from "./indexeddb-schema";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("行情读取已取消", "AbortError");
  }
}

function observeAbort(transaction: IDBTransaction, signal?: AbortSignal) {
  if (!signal) return () => undefined;
  const abortTransaction = () => {
    try {
      transaction.abort();
    } catch {
      // The transaction may have completed before the signal callback ran.
    }
  };
  signal.addEventListener("abort", abortTransaction, { once: true });
  if (signal.aborted) abortTransaction();
  return () => signal.removeEventListener("abort", abortTransaction);
}

export class IndexedDbMarketDataRepository
  implements MarketDataRepository
{
  constructor(
    private readonly databaseName = "trade-reviewer",
    private readonly testHooks?: {
      beforeIntervalCoverageWrite?: () => void;
    },
  ) {}

  private open() {
    return openTradeReviewDatabase(this.databaseName);
  }

  async getCandles(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ) {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [MARKET_CANDLES, DAILY_CANDLES],
        "readonly",
      );
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const genericCandles = (await requestValue(
          transaction.objectStore(MARKET_CANDLES).getAll(
            IDBKeyRange.bound(
              [instrumentId, interval, startTime, "raw"],
              [instrumentId, interval, endTime, "raw"],
            ),
          ),
        )) as MarketCandleRecord[];
        throwIfAborted(signal);
        if (interval !== "1D") return genericCandles;

        const dailyCandles = (await requestValue(
          transaction.objectStore(DAILY_CANDLES).getAll(
            IDBKeyRange.bound(
              [instrumentId, startTime.slice(0, 10), "raw"],
              [instrumentId, endTime.slice(0, 10), "raw"],
            ),
          ),
        )) as DailyCandleRecord[];
        throwIfAborted(signal);
        const candlesByTimestamp = new Map<string, MarketCandleRecord>();
        for (const candle of dailyCandles) {
          const timestamp = `${candle.tradingDate}T00:00:00.000Z`;
          if (timestamp >= startTime && timestamp <= endTime) {
            candlesByTimestamp.set(timestamp, {
              instrumentId: candle.instrumentId,
              interval: "1D",
              timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume,
              currency: candle.currency,
              provider: candle.provider,
              providerSymbol: candle.providerSymbol,
              adjustmentMode: candle.adjustmentMode,
              fetchedAt: candle.fetchedAt,
            });
          }
        }
        for (const candle of genericCandles) {
          candlesByTimestamp.set(candle.timestamp, candle);
        }
        return [...candlesByTimestamp.values()].sort((left, right) =>
          left.timestamp.localeCompare(right.timestamp),
        );
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getIntervalCoverage(
    instrumentId: string,
    interval: NativeMarketInterval,
    signal?: AbortSignal,
  ) {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(INTERVAL_COVERAGE, "readonly");
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const value = (await requestValue(
          transaction.objectStore(INTERVAL_COVERAGE).get([instrumentId, interval]),
        )) as
          | {
              instrumentId: string;
              interval: NativeMarketInterval;
              segments: IntervalCoverageSegment[];
            }
          | undefined;
        throwIfAborted(signal);
        return value?.segments ?? [];
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getIntervalMarketData(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ): Promise<IntervalMarketDataRead> {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [MARKET_CANDLES, INTERVAL_COVERAGE],
        "readonly",
      );
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const candles = (await requestValue(
          transaction.objectStore(MARKET_CANDLES).getAll(
            IDBKeyRange.bound(
              [instrumentId, interval, startTime, "raw"],
              [instrumentId, interval, endTime, "raw"],
            ),
          ),
        )) as MarketCandleRecord[];
        const value = (await requestValue(
          transaction.objectStore(INTERVAL_COVERAGE).get([instrumentId, interval]),
        )) as
          | {
              instrumentId: string;
              interval: NativeMarketInterval;
              segments: IntervalCoverageSegment[];
            }
          | undefined;
        throwIfAborted(signal);
        return {
          candles,
          coverage: value?.segments ?? [],
        };
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getDailyCandles(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ) {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(DAILY_CANDLES, "readonly");
      const range = IDBKeyRange.bound(
        [instrumentId, startDate, "raw"],
        [instrumentId, endDate, "raw"],
      );
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const candles = (await requestValue(
          transaction.objectStore(DAILY_CANDLES).getAll(range),
        )) as DailyCandleRecord[];
        throwIfAborted(signal);
        return candles;
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getDailyMarketData(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<DailyMarketDataRead> {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [DAILY_CANDLES, COVERAGE],
        "readonly",
      );
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const candles = (await requestValue(
          transaction.objectStore(DAILY_CANDLES).getAll(
            IDBKeyRange.bound(
              [instrumentId, startDate, "raw"],
              [instrumentId, endDate, "raw"],
            ),
          ),
        )) as DailyCandleRecord[];
        const value = (await requestValue(
          transaction.objectStore(COVERAGE).get(instrumentId),
        )) as
          | { instrumentId: string; segments: CoverageSegment[] }
          | undefined;
        throwIfAborted(signal);
        return {
          candles,
          coverage: value?.segments ?? [],
        };
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getCoverage(instrumentId: string, signal?: AbortSignal) {
    throwIfAborted(signal);
    const database = await this.open();
    try {
      const transaction = database.transaction(COVERAGE, "readonly");
      const removeAbortListener = observeAbort(transaction, signal);
      try {
        const value = (await requestValue(
          transaction.objectStore(COVERAGE).get(instrumentId),
        )) as
          | { instrumentId: string; segments: CoverageSegment[] }
          | undefined;
        throwIfAborted(signal);
        return value?.segments ?? [];
      } finally {
        removeAbortListener();
      }
    } finally {
      database.close();
    }
  }

  async getProviderSymbol(
    instrumentId: string,
    provider: MarketDataProviderId,
  ) {
    const database = await this.open();
    try {
      const transaction = database.transaction(PROVIDER_SYMBOLS, "readonly");
      const value = (await requestValue(
        transaction
          .objectStore(PROVIDER_SYMBOLS)
          .get([instrumentId, provider]),
      )) as
        | { instrumentId: string; provider: MarketDataProviderId; symbol: string }
        | undefined;
      return value?.symbol;
    } finally {
      database.close();
    }
  }

  async commitSyncResult(result: MarketDataCommit) {
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [DAILY_CANDLES, COVERAGE, PROVIDER_SYMBOLS],
        "readwrite",
      );
      const completion = transactionDone(transaction);
      const candles = transaction.objectStore(DAILY_CANDLES);
      for (const candle of result.candles) candles.put(candle);
      transaction.objectStore(COVERAGE).put({
        instrumentId: result.instrumentId,
        segments: result.coverage,
      });
      if (result.providerSymbol) {
        transaction.objectStore(PROVIDER_SYMBOLS).put({
          instrumentId: result.instrumentId,
          provider: result.providerSymbol.provider,
          symbol: result.providerSymbol.symbol,
        });
      }
      await completion;
    } finally {
      database.close();
    }
  }

  async commitIntervalSyncResult(result: IntervalMarketDataCommit) {
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [MARKET_CANDLES, INTERVAL_COVERAGE, PROVIDER_SYMBOLS],
        "readwrite",
      );
      const completion = transactionDone(transaction);
      try {
        const candles = transaction.objectStore(MARKET_CANDLES);
        for (const candle of result.candles) candles.put(candle);
        this.testHooks?.beforeIntervalCoverageWrite?.();
        transaction.objectStore(INTERVAL_COVERAGE).put({
          instrumentId: result.instrumentId,
          interval: result.interval,
          segments: result.coverage,
        });
        if (result.providerSymbol) {
          transaction.objectStore(PROVIDER_SYMBOLS).put({
            instrumentId: result.instrumentId,
            provider: result.providerSymbol.provider,
            symbol: result.providerSymbol.symbol,
          });
        }
      } catch (error) {
        transaction.abort();
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
    } finally {
      database.close();
    }
  }
}
