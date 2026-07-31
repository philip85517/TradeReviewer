export const DATABASE_VERSION = 4;
export const DAILY_CANDLES = "dailyCandles";
export const COVERAGE = "coverage";
export const PROVIDER_SYMBOLS = "providerSymbols";
export const REVIEWS = "reviews";
export const MARKET_CANDLES = "marketCandles";
export const INTERVAL_COVERAGE = "intervalCoverage";
export const TAG_SUGGESTIONS = "tagSuggestions";
export const INSTRUMENT_METADATA = "instrumentMetadata";

export function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务已回滚"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB 事务失败"));
  });
}

export function openTradeReviewDatabase(databaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION);
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
      if (!database.objectStoreNames.contains(REVIEWS)) {
        database.createObjectStore(REVIEWS, {
          keyPath: "episodeId",
        });
      }
      if (!database.objectStoreNames.contains(MARKET_CANDLES)) {
        database.createObjectStore(MARKET_CANDLES, {
          keyPath: [
            "instrumentId",
            "interval",
            "timestamp",
            "adjustmentMode",
          ],
        });
      }
      if (!database.objectStoreNames.contains(INTERVAL_COVERAGE)) {
        database.createObjectStore(INTERVAL_COVERAGE, {
          keyPath: ["instrumentId", "interval"],
        });
      }
      if (!database.objectStoreNames.contains(TAG_SUGGESTIONS)) {
        database.createObjectStore(TAG_SUGGESTIONS, {
          keyPath: "id",
        });
      }
      if (!database.objectStoreNames.contains(INSTRUMENT_METADATA)) {
        database.createObjectStore(INSTRUMENT_METADATA, {
          keyPath: "instrumentId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
