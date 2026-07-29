import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  NativeMarketInterval,
} from "../market/contracts";
import type {
  IntervalMarketDataCommit,
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

export class IndexedDbMarketDataRepository
  implements MarketDataRepository
{
  constructor(private readonly databaseName = "trade-reviewer") {}

  private open() {
    return openTradeReviewDatabase(this.databaseName);
  }

  async getCandles(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
  ) {
    const database = await this.open();
    try {
      const transaction = database.transaction(
        [MARKET_CANDLES, DAILY_CANDLES],
        "readonly",
      );
      const genericCandles = (await requestValue(
        transaction.objectStore(MARKET_CANDLES).getAll(
          IDBKeyRange.bound(
            [instrumentId, interval, startTime, "raw"],
            [instrumentId, interval, endTime, "raw"],
          ),
        ),
      )) as MarketCandleRecord[];
      if (interval !== "1D") return genericCandles;

      const dailyCandles = (await requestValue(
        transaction.objectStore(DAILY_CANDLES).getAll(
          IDBKeyRange.bound(
            [instrumentId, startTime.slice(0, 10), "raw"],
            [instrumentId, endTime.slice(0, 10), "raw"],
          ),
        ),
      )) as DailyCandleRecord[];
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
      database.close();
    }
  }

  async getIntervalCoverage(
    instrumentId: string,
    interval: NativeMarketInterval,
  ) {
    const database = await this.open();
    try {
      const transaction = database.transaction(INTERVAL_COVERAGE, "readonly");
      const value = (await requestValue(
        transaction.objectStore(INTERVAL_COVERAGE).get([instrumentId, interval]),
      )) as
        | {
            instrumentId: string;
            interval: NativeMarketInterval;
            segments: IntervalCoverageSegment[];
          }
        | undefined;
      return value?.segments ?? [];
    } finally {
      database.close();
    }
  }

  async getDailyCandles(
    instrumentId: string,
    startDate: string,
    endDate: string,
  ) {
    const database = await this.open();
    try {
      const transaction = database.transaction(DAILY_CANDLES, "readonly");
      const range = IDBKeyRange.bound(
        [instrumentId, startDate, "raw"],
        [instrumentId, endDate, "raw"],
      );
      return (await requestValue(
        transaction.objectStore(DAILY_CANDLES).getAll(range),
      )) as DailyCandleRecord[];
    } finally {
      database.close();
    }
  }

  async getCoverage(instrumentId: string) {
    const database = await this.open();
    try {
      const transaction = database.transaction(COVERAGE, "readonly");
      const value = (await requestValue(
        transaction.objectStore(COVERAGE).get(instrumentId),
      )) as
        | { instrumentId: string; segments: CoverageSegment[] }
        | undefined;
      return value?.segments ?? [];
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
      transaction.objectStore(PROVIDER_SYMBOLS).put({
        instrumentId: result.instrumentId,
        provider: result.providerSymbol.provider,
        symbol: result.providerSymbol.symbol,
      });
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
      const candles = transaction.objectStore(MARKET_CANDLES);
      for (const candle of result.candles) candles.put(candle);
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
      await completion;
    } finally {
      database.close();
    }
  }
}
