import type { SourceBounds } from "../import/screenshot/contracts";

export type TradeSide = "buy" | "sell";
export type TradeTimePrecision = "second" | "date-only";

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
    /** Semantic identity within a statement, independent of file and page. */
    statementRowFingerprint?: string;
    formatLabel?: string;
    /** Original settlement amounts, not recomputed from rounded display prices. */
    settlement?: {
      currency: string;
      quantity: string;
      grossAmount: string;
      netAmount: string;
      fees: Record<string,string>;
    };
    tradingNature?: "simulated" | "live" | "unknown";
    simulationRunId?: string;
    simulationTradeId?: string;
    simulationRole?: "entry" | "exit";
    simulationSignal?: string;
    /** Pair-level source report, never included in the progressively revealed ledger. */
    simulationReport?: Record<string, string>;
    /** Explicitly confirmed session; absence must not imply grey-market trading. */
    tradingSession?: "grey-market";
    sheet?: string;
    page?: number;
    row: number;
    sourceOrder?: number;
    timePrecision?: TradeTimePrecision;
    fileName?: string;
    fileFingerprint?: string;
    sourceTimestampText?: string;
    sourceTimezone?: string;
    inputKind?: "statement" | "screenshot";
    batchId?: string;
    captureIndex?: number;
    sourceBounds?: SourceBounds;
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
