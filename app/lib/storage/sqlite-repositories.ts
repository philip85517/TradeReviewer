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
  IntervalMarketDataCommit,
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

export class ApiMarketDataRepository implements MarketDataRepository {
  constructor(private readonly client: SqliteHttpClient) {}

  async getCandles(instrumentId: string, interval: NativeMarketInterval, startTime: string, endTime: string): Promise<MarketCandleRecord[]> {
    return (await this.client.getMarketData({ instrumentId, interval, start: startTime, end: endTime })).candles;
  }

  async getIntervalCoverage(instrumentId: string, interval: NativeMarketInterval): Promise<IntervalCoverageSegment[]> {
    return (await this.client.getMarketData({ instrumentId, interval })).intervalCoverage;
  }

  async getDailyCandles(instrumentId: string, startDate: string, endDate: string): Promise<DailyCandleRecord[]> {
    return (await this.client.getMarketData({
      instrumentId,
      interval: "1D",
      start: `${startDate}T00:00:00.000Z`,
      end: `${endDate}T23:59:59.999Z`,
      dailyOnly: true,
    })).dailyCandles ?? [];
  }

  async getCoverage(instrumentId: string): Promise<CoverageSegment[]> {
    return (await this.client.getMarketData({ instrumentId, interval: "1D" })).coverage ?? [];
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
    const instrument = (await this.client.getBootstrap()).instruments.find(
      (candidate) => candidate.id === instrumentId,
    );
    return instrument?.metadata;
  }

  async getMany(instrumentIds: string[]): Promise<Map<string, ResolvedInstrument>> {
    const instruments = (await this.client.getBootstrap()).instruments;
    const wanted = new Set(instrumentIds);
    return new Map(
      instruments
        .filter((instrument) => wanted.has(instrument.id))
        .flatMap((instrument) => instrument.metadata ? [[instrument.id, instrument.metadata] as const] : []),
    );
  }

  async put(record: ResolvedInstrument): Promise<void> {
    await this.client.mergeExecutions({
      instruments: [{
        id: canonicalInstrumentId(record.symbol, record.market),
        market: record.market,
        symbol: record.symbol,
        name: record.name,
        currency: marketCurrency(record.market),
        metadata: record,
      }],
      executions: [],
    });
  }
}
