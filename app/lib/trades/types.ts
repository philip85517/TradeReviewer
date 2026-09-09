import type { SourceBounds } from "../import/screenshot/contracts";
import type { StatementFragment, StatementPosition, StatementEvent } from "../import/monthly-statement";
import type { TimeCandidateEvidence } from "../import/statement-rules";

export type TradeSide = "buy" | "sell";
export type TradeTimePrecision = "second" | "date-only";
export type TradeDisplayTimePolicy = "execution-time" | "session-open";

export type ExecutionGroup = {
  kind: "order";
  orderReference?: string;
  fillCount: number;
  quantity: string;
  grossAmount: string;
  reportedQuantity?: string;
  reportedPrice?: string;
  reportedGrossAmount?: string;
  fills: Array<{
    page: number;
    row: number;
    sourceTimestampText?: string;
    executedAt?: string;
    sourceTimezone?: string;
    marketCalendarDate?: string;
    timePrecision?: TradeTimePrecision;
    timeEvidence?: "row" | "document" | "user" | "inferred";
    timeConfidence?: number;
    quantity: string;
    price: string;
    grossAmount: string;
    settlementDate?: string;
    venue?: string;
  }>;
};
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
    tradingNature?: "simulated" | "live" | "unknown";
    simulationTradeId?: string;
    simulationRole?: "entry" | "exit";
    simulationSignal?: string;
    /** Pair-level source report, never included in the progressively revealed ledger. */
    simulationReport?: Record<string, string>;
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
    templateId?: string;
    formatRuleId?: string;
    /** Explicit broker direction; generic sell does not establish a short opening. */
    positionEffect?: "open-long" | "close-long" | "open-short" | "close-short";
    statementMonth?: string;
    sourceTimeKind?: "execution" | "order" | "date";
    timeEvidence?: "row" | "document" | "user" | "inferred";
    timeConfidence?: number;
    timeInferenceReason?: string;
    timeRuleId?: string;
    timeCandidates?: TimeCandidateEvidence[];
    timeRuleVersion?: string;
    marketCalendarDate?: string;
    tradingDate?: string;
    settlementDate?: string;
    grossAmount?: string;
    cashChange?: string;
    feeStatus?: "reported" | "allocated" | "unknown";
    venue?: string;
    displayTimePolicy?: TradeDisplayTimePolicy;
    /** One broker order represented by one normalized transaction and its fill evidence. */
    executionGroup?: ExecutionGroup;
    fragments?: StatementFragment[];
    openingPosition?: StatementPosition;
    /** All relevant statement boundaries, including months after this fill; apply only at the replay cursor. */
    statementPositions?: StatementPosition[];
    positionEvents?: StatementEvent[];
    /** Statement IDs with unresolved inventory evidence affecting this execution. */
    historyIncomplete?: string[];
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
  /** Direction is provisional when date-only inventory events cannot be ordered against fills. */
  directionKnown?: false;
  /** Numeric legacy PnL fields are placeholders whenever this flag is present. */
  accuracy?: { pnl: "unavailable"; reasons: string[] };
  initialPosition?: StatementPosition;
  positionEvents?: StatementEvent[];
  id: string;
  accountId: string;
  accountLabel: string;
  instrument: Instrument;
  tradeNature?: TradeNature;
  simulationRunId?: string;
  direction: "long" | "short";
  status: "open" | "closed";
  startedAt: string;
  endedAt?: string;
  openingQuantity: string;
  remainingQuantity: string;
  executions: TradeExecution[];
};

export function tradeNatureOf(execution: TradeExecution): TradeNature {
  return execution.source.tradeNature ?? (execution.source.tradingNature === "simulated" ? "simulation" : execution.source.tradingNature) ?? "unknown";
}

export function tradeScopeKey(execution: TradeExecution): string {
  const nature = tradeNatureOf(execution);
  return nature === "simulation"
    ? `${nature}:${execution.source.simulationRunId ?? "unknown"}`
    : nature;
}
