import type { Candle, Timeframe } from "../market/types";
import { mapExecutionToCandle } from "./execution-markers";
import type { TradeExecution } from "../trades/types";

/** A stable identity for one user initiated chart location request. */
export type ReviewChartLocateRequest = {
  requestId: string;
  instrumentId: string;
  episodeId: string;
  executionId: string;
};

export type ReviewChartLocateStatus =
  | "located"
  | "needs-daily"
  | "missing"
  | "unavailable";

export type ReviewChartLocateResult = ReviewChartLocateRequest & {
  status: ReviewChartLocateStatus;
  timeframe: Timeframe;
  candleTime?: string;
  reason?: string;
};

export type ExecutionChartLocation = {
  execution: TradeExecution;
  candleTime?: string;
};

/**
 * Resolve a revealed execution against the currently rendered candles.
 * Keeping this as a pure helper lets the React chart and focused tests share
 * the same date/interval semantics without mutating replay state.
 */
export function resolveExecutionChartLocation(
  candles: readonly Candle[],
  executions: readonly TradeExecution[],
  request: ReviewChartLocateRequest,
): ExecutionChartLocation | undefined {
  const execution = executions.find((item) => item.id === request.executionId);
  if (!execution || execution.instrument.id !== request.instrumentId) return undefined;
  return {
    execution,
    candleTime: mapExecutionToCandle(candles, execution),
  };
}
