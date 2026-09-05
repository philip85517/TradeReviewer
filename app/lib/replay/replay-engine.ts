import { candleKnowledgeAt, type Candle } from "../market/types";
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
  const knowledgeVisibleCandles = candles
    .filter((candle) => candleKnowledgeAt(candle) <= cursor)
    .sort((a, b) => a.time.localeCompare(b.time));
  const revealedExecutions = executions
    .filter((execution) => execution.executedAt <= cursor)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));
  const latestClose =
    knowledgeVisibleCandles.at(-1)?.close ??
    revealedExecutions.at(-1)?.price ??
    0;

  return {
    cursor,
    candles: knowledgeVisibleCandles,
    executions: revealedExecutions,
    position: replayPositionAtPrice({
      executions: revealedExecutions,
      markPrice: String(latestClose),
    }),
  };
}
