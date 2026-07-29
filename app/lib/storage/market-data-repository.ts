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
  providerSymbol: {
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

export interface MarketDataRepository {
  getCandles(
    instrumentId: string,
    interval: NativeMarketInterval,
    startTime: string,
    endTime: string,
  ): Promise<MarketCandleRecord[]>;
  getIntervalCoverage(
    instrumentId: string,
    interval: NativeMarketInterval,
  ): Promise<IntervalCoverageSegment[]>;
  getDailyCandles(
    instrumentId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyCandleRecord[]>;
  getCoverage(instrumentId: string): Promise<CoverageSegment[]>;
  getProviderSymbol(
    instrumentId: string,
    provider: MarketDataProviderId,
  ): Promise<string | undefined>;
  commitSyncResult(result: MarketDataCommit): Promise<void>;
  commitIntervalSyncResult(result: IntervalMarketDataCommit): Promise<void>;
}
