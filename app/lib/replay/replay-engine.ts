import { candleKnowledgeAt, type Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import type { MonthlyStatement } from "../import/monthly-statement";
import { replayCursorAt, replayExecutionAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
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
  evidence?: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">[];
  candles: Candle[];
  executions: TradeExecution[];
  cursor: string;
};

export function createReplaySnapshot({
  candles,
  executions,
  cursor,
  evidence,
}: ReplayInput): ReplaySnapshot {
  const knowledgeAt = replayCursorAt(cursor);
  const knowledgeVisibleCandles = candles
    .filter((candle) => replayCursorAt(candleKnowledgeAt(candle)) <= knowledgeAt)
    .sort((a, b) => a.time.localeCompare(b.time));
  const revealedExecutions = executions
    .filter((execution) => replayExecutionAt(execution) <= knowledgeAt)
    .sort((a, b) => replayExecutionAt(a).localeCompare(replayExecutionAt(b)))
    .map(execution => {
      const source = { ...execution.source };
      if (source.openingPosition && statementPositionAt(source.openingPosition) > knowledgeAt) delete source.openingPosition;
      if (source.statementPositions) {
        source.statementPositions = source.statementPositions.filter(p => statementPositionAt(p) <= knowledgeAt);
        if (!source.statementPositions.length) delete source.statementPositions;
      }
      if (source.positionEvents) {
        source.positionEvents = source.positionEvents.filter(e => statementEventAt(e) <= knowledgeAt);
        if (!source.positionEvents.length) delete source.positionEvents;
      }
      return { ...execution, source };
    });
  const latestClose =
    knowledgeVisibleCandles.at(-1)?.close ??
    revealedExecutions.at(-1)?.price ??
    0;

  return {
    cursor,
    candles: knowledgeVisibleCandles,
    executions: revealedExecutions,
    position: replayPositionAtPrice({
      executions,
      cursor,
      evidence,
      markPrice: String(latestClose),
    }),
  };
}
