/** MIGRATION-ONLY: retired IndexedDB repository for browser-state-export/tests. */
import { canonicalInstrumentId } from "../instruments/display-name";
import { mergeInstrumentExchange, validateResolvedInstrument, type ResolvedInstrument } from "../instruments/metadata-contracts";
import {
  INSTRUMENT_METADATA,
  openTradeReviewDatabase,
  requestValue,
  transactionDone,
} from "./indexeddb-schema";
import type {
  InstrumentMetadataRepository,
  StoredInstrumentMetadata,
} from "./instrument-metadata-repository";

function resolvedInstrument(
  record: StoredInstrumentMetadata,
): ResolvedInstrument {
  return {
    ...(record.exchange ? { exchange: record.exchange } : {}),
    market: record.market,
    symbol: record.symbol,
    name: record.name,
    ...(record.localizedName ? { localizedName: record.localizedName } : {}),
    assetType: record.assetType,
    source: record.source,
    confidence: record.confidence,
    resolvedAt: record.resolvedAt,
  };
}

export class IndexedDbInstrumentMetadataRepository
  implements InstrumentMetadataRepository
{
  constructor(private readonly databaseName = "trade-reviewer") {}

  async get(instrumentId: string) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(
        INSTRUMENT_METADATA,
        "readonly",
      );
      const record = await requestValue(
        transaction.objectStore(INSTRUMENT_METADATA).get(instrumentId),
      );
      return record
        ? resolvedInstrument(record as StoredInstrumentMetadata)
        : undefined;
    } finally {
      database.close();
    }
  }

  async getMany(instrumentIds: string[]) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(
        INSTRUMENT_METADATA,
        "readonly",
      );
      const store = transaction.objectStore(INSTRUMENT_METADATA);
      const records = await Promise.all(
        instrumentIds.map((instrumentId) => requestValue(store.get(instrumentId))),
      );
      return new Map(
        records.flatMap((record) =>
          record
            ? [
                [
                  (record as StoredInstrumentMetadata).instrumentId,
                  resolvedInstrument(record as StoredInstrumentMetadata),
                ] as const,
              ]
            : [],
        ),
      );
    } finally {
      database.close();
    }
  }

  async put(record: ResolvedInstrument) {
    const database = await openTradeReviewDatabase(this.databaseName);
    try {
      const transaction = database.transaction(
        INSTRUMENT_METADATA,
        "readwrite",
      );
      const completion = transactionDone(transaction);
      const store = transaction.objectStore(INSTRUMENT_METADATA);
      const instrumentId = canonicalInstrumentId(record.symbol, record.market);
      const previous = await requestValue(store.get(instrumentId)) as StoredInstrumentMetadata | undefined;
      const normalized = validateResolvedInstrument(record, record);
      const merged = mergeInstrumentExchange(previous ? validateResolvedInstrument(previous, record) : undefined, normalized);
      store.put({
        ...merged,
        instrumentId,
      } satisfies StoredInstrumentMetadata);
      await completion;
    } finally {
      database.close();
    }
  }
}
