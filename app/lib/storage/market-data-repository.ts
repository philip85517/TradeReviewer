import type {
  CoverageSegment,
  DailyCandleRecord,
  IntervalCoverageSegment,
  MarketCandleRecord,
  MarketDataProviderId,
  NativeMarketInterval,
} from "../market/contracts";

export type MarketDataCommit = {
  instrumentId: string;
  candles: DailyCandleRecord[];
  coverage: CoverageSegment[];
  providerSymbol?: {
    provider: MarketDataProviderId;
    symbol: string;
  };
};

export type IntervalMarketDataCommit = {
  instrumentId: string;
  interval: NativeMarketInterval;
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
  providerSymbol?: {
    provider: MarketDataProviderId;
    symbol: string;
  };
};

export type DailyMarketDataRead = {
  candles: DailyCandleRecord[];
  coverage: CoverageSegment[];
};

export type IntervalMarketDataRead = {
  candles: MarketCandleRecord[];
  coverage: IntervalCoverageSegment[];
};

export interface MarketDataRepository {
  getCandles(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ): Promise<MarketCandleRecord[]>;
  getIntervalCoverage(
    instrumentId: string,
    interval: NativeMarketInterval,
    signal?: AbortSignal,
  ): Promise<IntervalCoverageSegment[]>;
  /** Optional combined read used by replay hydration to avoid duplicate interval payloads. */
  getIntervalMarketData?(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
    signal?: AbortSignal,
  ): Promise<IntervalMarketDataRead>;
  getDailyCandles(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<DailyCandleRecord[]>;
  /** Optional combined read used by homepage hydration to avoid duplicate HTTP payloads. */
  getDailyMarketData?(
    instrumentId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<DailyMarketDataRead>;
  getCoverage(instrumentId: string, signal?: AbortSignal): Promise<CoverageSegment[]>;
  getProviderSymbol(
    instrumentId: string,
    provider: MarketDataProviderId,
  ): Promise<string | undefined>;
  commitSyncResult(result: MarketDataCommit): Promise<void>;
  commitIntervalSyncResult(result: IntervalMarketDataCommit): Promise<void>;
}
