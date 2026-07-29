import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import {
  replayPositionAtPrice,
  type PositionLedgerSnapshot,
} from "./position-ledger";

export type ReplayPosition = PositionLedgerSnapshot;

export type ReplaySnapshot = {
  cursor: string;
  candles: Candle[];
  executions: TradeExecution[];
  position: ReplayPosition;
};

type ReplayInput = {
  candles: Candle[];
  executions: TradeExecution[];
  cursor: string;
};

export function createReplaySnapshot({
  candles,
  executions,
  cursor,
}: ReplayInput): ReplaySnapshot {
  const revealedCandles = candles
    .filter((candle) => candle.time <= cursor)
    .sort((a, b) => a.time.localeCompare(b.time));
  const revealedExecutions = executions
    .filter((execution) => execution.executedAt <= cursor)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));
  const latestClose = revealedCandles.at(-1)?.close ?? 0;

  return {
    cursor,
    candles: revealedCandles,
    executions: revealedExecutions,
    position: replayPositionAtPrice({
      executions: revealedExecutions,
      markPrice: String(latestClose),
    }),
  };
}
