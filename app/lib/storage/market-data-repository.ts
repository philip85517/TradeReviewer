import type {
  CoverageSegment,
  DailyCandleRecord,
  MarketDataProviderId,
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

export interface MarketDataRepository {
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
}
