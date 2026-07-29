import Decimal from "decimal.js";

import type { TradeExecution } from "../trades/types";

export type PositionLedgerSnapshot = {
  quantity: string;
  averageCost: string;
  realizedPnl: string;
  unrealizedPnl: string;
  netPnl: string;
  fees: string;
  grossCapitalDeployed: string;
  returnPercent: string;
};

function decimalString(value: Decimal) {
  return value.isZero() ? "0" : value.toDecimalPlaces(8).toString();
}

export function replayPositionAtPrice(input: {
  executions: TradeExecution[];
  markPrice: string;
}): PositionLedgerSnapshot {
  let quantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let realizedPnl = new Decimal(0);
  let fees = new Decimal(0);
  let grossCapitalDeployed = new Decimal(0);

  for (const execution of input.executions) {
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
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(size));
      } else {
        const covered = Decimal.min(quantity.abs(), size);
        realizedPnl = realizedPnl.plus(averageCost.minus(price).mul(covered));
        quantity = quantity.plus(size);
        if (quantity.isPositive()) {
          averageCost = price;
          grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity));
        }
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
      grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(size));
    } else {
      const closed = Decimal.min(quantity, size);
      realizedPnl = realizedPnl.plus(price.minus(averageCost).mul(closed));
      quantity = quantity.minus(size);
      if (quantity.isNegative()) {
        averageCost = price;
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity.abs()));
      }
      if (quantity.isZero()) averageCost = new Decimal(0);
    }
  }

  const markPrice = new Decimal(input.markPrice);
  const unrealizedPnl = quantity.isPositive()
    ? markPrice.minus(averageCost).mul(quantity)
    : averageCost.minus(markPrice).mul(quantity.abs());
  const netPnl = realizedPnl.plus(unrealizedPnl).minus(fees);
  const returnPercent = grossCapitalDeployed.isZero()
    ? new Decimal(0)
    : netPnl.div(grossCapitalDeployed).mul(100);

  return {
    quantity: decimalString(quantity),
    averageCost: decimalString(averageCost),
    realizedPnl: decimalString(realizedPnl),
    unrealizedPnl: decimalString(unrealizedPnl),
    netPnl: decimalString(netPnl),
    fees: decimalString(fees),
    grossCapitalDeployed: decimalString(grossCapitalDeployed),
    returnPercent: decimalString(returnPercent),
  };
}
