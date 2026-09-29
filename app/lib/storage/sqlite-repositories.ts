import { canonicalInstrumentId } from "../instruments/display-name";
import type { ResolvedInstrument } from "../instruments/metadata-contracts";
import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  NativeMarketInterval,
} from "../market/contracts";
import { normalizeEpisodeReviewRecord } from "../reviews/review-metrics";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { TagSuggestionRecord } from "../insights/types";
import type { EpisodeReviewRepository } from "./episode-review-repository";
import type { InstrumentMetadataRepository } from "./instrument-metadata-repository";
import type {
  DailyMarketDataRead,
  IntervalMarketDataCommit,
  IntervalMarketDataRead,
  MarketDataCommit,
  MarketDataRepository,
} from "./market-data-repository";
import {
  StorageHttpError,
  type SqliteHttpClient,
} from "./sqlite-http-client";
import {
  normalizeTagSuggestionRecord,
  type TagSuggestionRepository,
} from "./tag-suggestion-repository";

function marketCurrency(market: string): string {
  if (market === "HK") return "HKD";
  if (market === "CN-SH" || market === "CN-SZ") return "CNY";
  return "USD";
}

function readMarketData(
  client: SqliteHttpClient,
  input: Parameters<SqliteHttpClient["getMarketData"]>[0],
  signal?: AbortSignal,
) {
  return signal === undefined
    ? client.getMarketData(input)
    : client.getMarketData(input, signal);
}

export class ApiMarketDataRepository implements MarketDataRepository {
  constructor(private readonly client: SqliteHttpClient) {}

  async getCandles(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ): Promise<MarketCandleRecord[]> {
    return (await readMarketData(this.client, { instrumentId, interval, start: startTime, end: endTime }, signal)).candles;
  }

  async getIntervalCoverage(
    instrumentId: string,
    interval: NativeMarketInterval,
    signal?: AbortSignal,
  ): Promise<IntervalCoverageSegment[]> {
    return (await readMarketData(this.client, { instrumentId, interval }, signal)).intervalCoverage;
  }

  async getIntervalMarketData(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ): Promise<IntervalMarketDataRead> {
    const result = await readMarketData(this.client, {
      instrumentId,
      interval,
      start: startTime,
      end: endTime,
    }, signal);
    return {
      candles: result.candles,
      coverage: result.intervalCoverage,
    };
  }

  async getDailyCandles(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<DailyCandleRecord[]> {
    return (await readMarketData(this.client, {
      instrumentId,
      interval: "1D",
      start: `${startDate}T00:00:00.000Z`,
      end: `${endDate}T23:59:59.999Z`,
      dailyOnly: true,
    }, signal)).dailyCandles ?? [];
  }

  async getDailyMarketData(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<DailyMarketDataRead> {
    const result = await readMarketData(this.client, {
      instrumentId,
      interval: "1D",
      start: `${startDate}T00:00:00.000Z`,
      end: `${endDate}T23:59:59.999Z`,
      dailyOnly: true,
    }, signal);
    return {
      candles: result.dailyCandles ?? [],
      coverage: result.coverage ?? [],
    };
  }

  async getCoverage(instrumentId: string, signal?: AbortSignal): Promise<CoverageSegment[]> {
    return (await readMarketData(this.client, { instrumentId, interval: "1D" }, signal)).coverage ?? [];
  }

  async getProviderSymbol(instrumentId: string, provider: MarketDataProviderId): Promise<string | undefined> {
    return this.client.getProviderSymbol(instrumentId, provider);
  }

  async commitSyncResult(result: MarketDataCommit): Promise<void> {
    await this.client.putMarketData({ kind: "daily", result });
  }

  async commitIntervalSyncResult(result: IntervalMarketDataCommit): Promise<void> {
    await this.client.putMarketData({ kind: "interval", result });
  }
}

export class ApiEpisodeReviewRepository implements EpisodeReviewRepository {
  constructor(private readonly client: SqliteHttpClient) {}

  async getAll(): Promise<EpisodeReviewRecord[]> {
    return (await this.client.getBootstrap()).reviews;
  }

  async get(episodeId: string): Promise<EpisodeReviewRecord | undefined> {
    return (await this.getAll()).find((record) => record.episodeId === episodeId);
  }

  async put(record: EpisodeReviewRecord): Promise<boolean> {
    try {
      await this.client.putReview(normalizeEpisodeReviewRecord(record));
      return true;
    } catch (error) {
      if (error instanceof StorageHttpError && error.status === 409) return false;
      throw error;
    }
  }
}

export class ApiTagSuggestionRepository implements TagSuggestionRepository {
  constructor(private readonly client: SqliteHttpClient) {}

  async getAll(): Promise<TagSuggestionRecord[]> {
    return (await this.client.getBootstrap()).tagSuggestions;
  }

  async put(record: TagSuggestionRecord): Promise<void> {
    await this.client.putTagSuggestion(normalizeTagSuggestionRecord(record));
  }
}

export class ApiInstrumentMetadataRepository implements InstrumentMetadataRepository {
  constructor(private readonly client: SqliteHttpClient) {}

  async get(instrumentId: string): Promise<ResolvedInstrument | undefined> {
    return (await this.getMany([instrumentId])).get(instrumentId);
  }

  async getMany(instrumentIds: string[]): Promise<Map<string, ResolvedInstrument>> {
    if (instrumentIds.length === 0) return new Map();
    const instruments = this.client.getInstrumentMetadata
      ? (await this.client.getInstrumentMetadata(instrumentIds)).instruments
      : (await this.client.getBootstrap()).instruments;
    const wanted = new Set(instrumentIds);
    return new Map(
      instruments
        .filter((instrument) => wanted.has(instrument.id))
        .flatMap((instrument) => instrument.metadata ? [[instrument.id, instrument.metadata] as const] : []),
    );
  }

  async put(record: ResolvedInstrument): Promise<void> {
    if (this.client.putInstrumentMetadata) {
      await this.client.putInstrumentMetadata(record);
      return;
    }
    const existing = (await this.client.getBootstrap()).instruments.find(
      (instrument) => instrument.id === canonicalInstrumentId(record.symbol, record.market),
    );
    const effectiveLocalizedName =
      record.localizedName ??
      existing?.localizedName ??
      existing?.metadata?.localizedName;
    await this.client.mergeExecutions({
      instruments: [{
        ...existing,
        id: canonicalInstrumentId(record.symbol, record.market),
        market: record.market,
        symbol: record.symbol,
        name: existing?.name ?? record.name,
        currency: existing?.currency ?? marketCurrency(record.market),
        ...(effectiveLocalizedName
          ? { localizedName: effectiveLocalizedName }
          : {}),
        metadata: {
          ...record,
          ...(effectiveLocalizedName
            ? { localizedName: effectiveLocalizedName }
            : {}),
        },
      }],
      executions: [],
    });
  }
}
