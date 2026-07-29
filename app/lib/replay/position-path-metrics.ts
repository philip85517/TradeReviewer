import Decimal from "decimal.js";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";
import {
  replayPositionAtPrice,
  type PositionLedgerSnapshot,
} from "./position-ledger";

export type PathAmount = {
  amount: string;
  percent: string | null;
};

export type PositionPathMetrics = {
  current: PositionLedgerSnapshot;
  holdingMilliseconds: number | null;
  mfe: PathAmount | null;
  mae: PathAmount | null;
  maximumDrawdown: PathAmount | null;
  profitGiveback: PathAmount | null;
  rMultiple: string | null;
  unavailableReason?: string;
};

type PositionPathInput = {
  candles: Candle[];
  executions: TradeExecution[];
  cursor: string;
  episodeStartedAt: string;
  episodeEndedAt?: string;
  plannedRiskAmount?: string;
};

function decimalString(value: Decimal) {
  return value.isZero() ? "0" : value.toDecimalPlaces(8).toString();
}

function emptyPosition(): PositionLedgerSnapshot {
  return replayPositionAtPrice({ executions: [], markPrice: "0" });
}

function pathAmount(value: Decimal, grossCapitalDeployed: Decimal): PathAmount {
  return {
    amount: decimalString(value),
    percent: grossCapitalDeployed.isZero()
      ? null
      : decimalString(value.div(grossCapitalDeployed).mul(100)),
  };
}

export function calculatePositionPathMetrics(
  input: PositionPathInput,
): PositionPathMetrics {
  const candles = input.candles
    .filter((candle) => candle.time <= input.cursor)
    .sort((a, b) => a.time.localeCompare(b.time));
  const executions = input.executions
    .filter((execution) => execution.executedAt <= input.cursor)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));
  const latestCandle = candles.at(-1);

  if (!latestCandle) {
    return {
      current: emptyPosition(),
      holdingMilliseconds: null,
      mfe: null,
      mae: null,
      maximumDrawdown: null,
      profitGiveback: null,
      rMultiple: null,
      unavailableReason: "No candle is available at or before the replay cursor.",
    };
  }

  const current = replayPositionAtPrice({
    executions,
    markPrice: String(latestCandle.close),
  });

  if (executions.length === 0) {
    return {
      current,
      holdingMilliseconds: null,
      mfe: null,
      mae: null,
      maximumDrawdown: null,
      profitGiveback: null,
      rMultiple: null,
      unavailableReason: "No execution has occurred at or before the replay cursor.",
    };
  }

  let mfe: Decimal | undefined;
  let mae: Decimal | undefined;
  let maximumDrawdown = new Decimal(0);
  let highestPreviousClose: Decimal | undefined;
  let maximumGrossCapitalDeployed = new Decimal(current.grossCapitalDeployed);

  for (const candle of candles) {
    const candleExecutions = executions.filter(
      (execution) => execution.executedAt <= candle.time,
    );
    if (candleExecutions.length === 0) continue;

    const closePosition = replayPositionAtPrice({
      executions: candleExecutions,
      markPrice: String(candle.close),
    });
    const quantity = new Decimal(closePosition.quantity);
    const closeNetPnl = new Decimal(closePosition.netPnl);
    const grossCapitalDeployed = new Decimal(
      closePosition.grossCapitalDeployed,
    );
    maximumGrossCapitalDeployed = Decimal.max(
      maximumGrossCapitalDeployed,
      grossCapitalDeployed,
    );

    if (highestPreviousClose !== undefined) {
      maximumDrawdown = Decimal.max(
        maximumDrawdown,
        highestPreviousClose.minus(closeNetPnl),
      );
    }
    highestPreviousClose = Decimal.max(
      highestPreviousClose ?? closeNetPnl,
      closeNetPnl,
    );

    if (quantity.isZero()) {
      mfe = Decimal.max(mfe ?? closeNetPnl, closeNetPnl);
      mae = Decimal.min(mae ?? closeNetPnl, closeNetPnl);
      continue;
    }

    const favorablePrice = quantity.isPositive() ? candle.high : candle.low;
    const adversePrice = quantity.isPositive() ? candle.low : candle.high;
    const favorablePnl = new Decimal(
      replayPositionAtPrice({
        executions: candleExecutions,
        markPrice: String(favorablePrice),
      }).netPnl,
    );
    const adversePnl = new Decimal(
      replayPositionAtPrice({
        executions: candleExecutions,
        markPrice: String(adversePrice),
      }).netPnl,
    );
    mfe = Decimal.max(mfe ?? favorablePnl, favorablePnl);
    mae = Decimal.min(mae ?? adversePnl, adversePnl);
  }

  const currentNetPnl = new Decimal(current.netPnl);
  const effectiveEnd = input.episodeEndedAt && input.episodeEndedAt < input.cursor
    ? input.episodeEndedAt
    : input.cursor;
  const plannedRiskAmount = input.plannedRiskAmount
    ? new Decimal(input.plannedRiskAmount)
    : undefined;

  return {
    current,
    holdingMilliseconds:
      new Date(effectiveEnd).getTime() - new Date(input.episodeStartedAt).getTime(),
    mfe: mfe ? pathAmount(mfe, maximumGrossCapitalDeployed) : null,
    mae: mae ? pathAmount(mae, maximumGrossCapitalDeployed) : null,
    maximumDrawdown: pathAmount(maximumDrawdown, maximumGrossCapitalDeployed),
    profitGiveback: mfe
      ? pathAmount(mfe.minus(currentNetPnl), maximumGrossCapitalDeployed)
      : null,
    rMultiple:
      plannedRiskAmount && !plannedRiskAmount.isZero()
        ? decimalString(currentNetPnl.div(plannedRiskAmount))
        : null,
  };
}
