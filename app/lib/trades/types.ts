import type { SourceBounds } from "../import/screenshot/contracts";

export type TradeSide = "buy" | "sell";
export type TradeTimePrecision = "second" | "date-only";
export type TradeNature = "live" | "simulation" | "unknown";

export type TradingViewSourceReport = {
  netPnl: string;
  returnPercent: string;
  favorableExcursion: string;
  favorableExcursionPercent: string;
  adverseExcursion: string;
  adverseExcursionPercent: string;
  cumulativePnl: string;
  cumulativeReturnPercent: string;
  durationBars: number;
};

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
};

export type TradeExecution = {
  id: string;
  source: {
    platform: string;
    sheet?: string;
    page?: number;
    row: number;
    sourceOrder?: number;
    timePrecision?: TradeTimePrecision;
    fileName?: string;
    fileFingerprint?: string;
    sourceTimestampText?: string;
    sourceTimezone?: string;
    inputKind?: "statement" | "screenshot" | "tradingview";
    batchId?: string;
    captureIndex?: number;
    sourceBounds?: SourceBounds;
    tradeNature?: TradeNature;
    simulationRunId?: string;
    sourceTradeId?: string;
    sourceReport?: TradingViewSourceReport;
  };
  accountId: string;
  accountLabel: string;
  instrument: Instrument;
  side: TradeSide;
  executedAt: string;
  quantity: string;
  price: string;
  fee: string;
};

export type TradeEpisode = {
  id: string;
  accountId: string;
  accountLabel: string;
  instrument: Instrument;
  direction: "long" | "short";
  status: "open" | "closed";
  startedAt: string;
  endedAt?: string;
  openingQuantity: string;
  remainingQuantity: string;
  executions: TradeExecution[];
};
