import type {
  CoverageSegment,
  DailyCandleRecord,
  MarketDataProviderId,
} from "../market/contracts";
import type {
  MarketDataCommit,
  MarketDataRepository,
} from "./market-data-repository";

const DATABASE_VERSION = 1;
const DAILY_CANDLES = "dailyCandles";
const COVERAGE = "coverage";
const PROVIDER_SYMBOLS = "providerSymbols";

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务已回滚"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务失败"));
  });
}

export class IndexedDbMarketDataRepository
  implements MarketDataRepository
{
  constructor(private readonly databaseName = "trade-reviewer") {}

  private open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DAILY_CANDLES)) {
          database.createObjectStore(DAILY_CANDLES, {
            keyPath: [
              "instrumentId",
              "tradingDate",
              "adjustmentMode",
            ],
          });
        }
        if (!database.objectStoreNames.contains(COVERAGE)) {
          database.createObjectStore(COVERAGE, {
            keyPath: "instrumentId",
          });
        }
        if (!database.objectStoreNames.contains(PROVIDER_SYMBOLS)) {
          database.createObjectStore(PROVIDER_SYMBOLS, {
            keyPath: ["instrumentId", "provider"],
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
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
