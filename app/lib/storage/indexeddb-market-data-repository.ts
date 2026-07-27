import type {
  CoverageSegment,
  DailyCandleRecord,
  MarketDataProviderId,
} from "../market/contracts";
import type {
  MarketDataCommit,
  MarketDataRepository,
} from "./market-data-repository";
import {
  COVERAGE,
  DAILY_CANDLES,
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
}
