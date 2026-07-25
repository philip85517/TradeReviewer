import Decimal from "decimal.js";

import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";

export type ReplayPosition = {
  quantity: string;
  averageCost: string;
  realizedPnl: string;
  unrealizedPnl: string;
  fees: string;
  returnPercent: string;
};

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

function decimalString(value: Decimal) {
  return value.isZero() ? "0" : value.toDecimalPlaces(8).toString();
}

function calculatePosition(
  executions: TradeExecution[],
  marketPrice: Decimal,
): ReplayPosition {
  let quantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let realizedPnl = new Decimal(0);
  let fees = new Decimal(0);

  for (const execution of executions) {
    const size = new Decimal(execution.quantity).abs();
    const price = new Decimal(execution.price);
    fees = fees.plus(execution.fee || 0);

    if (execution.side === "buy") {
      if (quantity.gte(0)) {
        const newQuantity = quantity.plus(size);
        averageCost = newQuantity.isZero()
          ? new Decimal(0)
          : averageCost.mul(quantity).plus(price.mul(size)).div(newQuantity);
        quantity = newQuantity;
      } else {
        const covered = Decimal.min(quantity.abs(), size);
        realizedPnl = realizedPnl.plus(averageCost.minus(price).mul(covered));
        quantity = quantity.plus(size);
        if (quantity.isPositive()) averageCost = price;
        if (quantity.isZero()) averageCost = new Decimal(0);
      }
    } else if (quantity.lte(0)) {
      const newAbsoluteQuantity = quantity.abs().plus(size);
      averageCost = newAbsoluteQuantity.isZero()
        ? new Decimal(0)
        : averageCost
            .mul(quantity.abs())
            .plus(price.mul(size))
            .div(newAbsoluteQuantity);
      quantity = quantity.minus(size);
    } else {
      const closed = Decimal.min(quantity, size);
      realizedPnl = realizedPnl.plus(price.minus(averageCost).mul(closed));
      quantity = quantity.minus(size);
      if (quantity.isNegative()) averageCost = price;
      if (quantity.isZero()) averageCost = new Decimal(0);
    }
  }

  const unrealizedPnl = quantity.isPositive()
    ? marketPrice.minus(averageCost).mul(quantity)
    : averageCost.minus(marketPrice).mul(quantity.abs());
  const costBasis = averageCost.mul(quantity.abs());
  const returnPercent = costBasis.isZero()
    ? new Decimal(0)
    : unrealizedPnl.div(costBasis).mul(100);

  return {
    quantity: decimalString(quantity),
    averageCost: decimalString(averageCost),
    realizedPnl: decimalString(realizedPnl),
    unrealizedPnl: decimalString(unrealizedPnl),
    fees: decimalString(fees),
    returnPercent: decimalString(returnPercent),
  };
}

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
    position: calculatePosition(
      revealedExecutions,
      new Decimal(latestClose),
    ),
  };
}
