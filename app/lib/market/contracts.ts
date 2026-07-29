export type SupportedMarket = "US" | "HK" | "CN-SH" | "CN-SZ";

export type MarketDataProviderId = "tencent" | "eastmoney" | "yahoo";

export type AdjustmentMode = "raw";

export type NativeMarketInterval = "15m" | "1D";

export type DailyCandleRecord = {
  instrumentId: string;
  tradingDate: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  currency: string;
  provider: MarketDataProviderId;
  providerSymbol: string;
  adjustmentMode: AdjustmentMode;
  fetchedAt: string;
};

export type MarketCandleRecord = {
  instrumentId: string;
  interval: NativeMarketInterval;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  currency: string;
  provider: MarketDataProviderId;
  providerSymbol: string;
  adjustmentMode: AdjustmentMode;
  fetchedAt: string;
};

export type ProviderMarketCandle = Pick<
  MarketCandleRecord,
  "timestamp" | "open" | "high" | "low" | "close" | "volume"
>;

export type ProviderDailyCandle = Omit<
  DailyCandleRecord,
  | "instrumentId"
  | "currency"
  | "provider"
  | "providerSymbol"
  | "adjustmentMode"
  | "fetchedAt"
> & {
  adjustedClose?: string;
};

export type CoverageStatus =
  | "not-requested"
  | "syncing"
  | "complete"
  | "partial"
  | "stale"
  | "source-unavailable"
  | "invalid-response"
  | "storage-error";

export type CoverageSegment = {
  startDate: string;
  endDate: string;
  status: CoverageStatus;
  provider?: MarketDataProviderId;
  fetchedAt?: string;
  missingTradingDates: string[];
  reason?: string;
};

export type IntervalCoverageSegment = {
  interval: NativeMarketInterval;
  requestedStart: string;
  requestedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: CoverageStatus;
  provider?: MarketDataProviderId;
  fetchedAt?: string;
  reason?: string;
};

export type DailyCandleRequest = {
  instrumentId: string;
  symbol: string;
  market: SupportedMarket;
  startDate: string;
  endDate: string;
};

export type ProviderResult = {
  provider: MarketDataProviderId;
  providerSymbol: string;
  fetchedAt: string;
  candles: ProviderDailyCandle[];
  warnings: string[];
};

export interface MarketDataProvider {
  readonly id: MarketDataProviderId;
  supports(market: SupportedMarket): boolean;
  fetchDaily(
    request: DailyCandleRequest,
    fetcher?: typeof fetch,
  ): Promise<ProviderResult>;
}
