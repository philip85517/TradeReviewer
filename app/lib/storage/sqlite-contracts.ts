import type { TagSuggestionRecord } from "../insights/types";
import type { CoverageSegment, DailyCandleRecord, IntervalCoverageSegment, MarketCandleRecord } from "../market/contracts";
import type { EpisodeReviewRecord } from "../reviews/types";
import type { ResolvedInstrument } from "../instruments/metadata-contracts";
import type { Instrument, TradeExecution } from "../trades/types";
import type { ChartSettings } from "./chart-settings";
import type { ImportHistoryEntry } from "./import-history";
import type { MarketDataJob } from "./market-data-jobs";
import type { EpisodeReviewState } from "./review-storage";

export type CoverageRecord = {
  instrumentId: string;
  adjustmentMode: "raw";
  startDate?: string;
  endDate?: string;
  /** Complete legacy coverage evidence, retained during browser-to-SQLite migration. */
  segments?: CoverageSegment[];
};

export type ProviderSymbolRecord = {
  instrumentId: string;
  provider: string;
  providerSymbol: string;
  metadata?: Record<string, unknown>;
};

export type StorageMigrationStatus = MigrationReport | null;

export type StorageBootstrap = {
  schemaVersion: number;
  migration: StorageMigrationStatus;
  executions: TradeExecution[];
  importHistory: ImportHistoryEntry[];
  instruments: StoredInstrument[];
  reviews: EpisodeReviewRecord[];
  reviewStates: EpisodeReviewState[];
  tagSuggestions: TagSuggestionRecord[];
  marketDataJobs: MarketDataJob[];
  settings: Record<string, unknown>;
};

export type BrowserStatePayload = {
  version: 1;
  sourceClientId: string;
  sourceFingerprint: string;
  executions: TradeExecution[];
  importHistory: ImportHistoryEntry[];
  instruments: StoredInstrument[];
  reviews: EpisodeReviewRecord[];
  reviewStates: EpisodeReviewState[];
  tagSuggestions: TagSuggestionRecord[];
  marketDataJobs: MarketDataJob[];
  settings: ChartSettings | Record<string, unknown>;
  dailyCandles: DailyCandleRecord[];
  marketCandles: MarketCandleRecord[];
  coverage: CoverageRecord[];
  intervalCoverage: Array<IntervalCoverageSegment & {
    instrumentId: string;
    adjustmentMode?: "raw";
  }>;
  providerSymbols: ProviderSymbolRecord[];
};

export type MigrationReport = {
  sourceFingerprint: string;
  inserted: number;
  duplicate: number;
  conflict: number;
  failed: number;
  validationDigest: string;
};

export type ExecutionMergeReport = Pick<MigrationReport, "inserted" | "duplicate" | "conflict">;

export type SqliteStatus = {
  schemaVersion: number;
  migration: StorageMigrationStatus;
  counts: Record<string, number>;
};
export type StoredInstrument = Instrument & {
  metadata?: ResolvedInstrument;
};
