import Decimal from "decimal.js";

import type { TradeEpisode } from "./types";

export type TradeEpisodeMetrics = {
  buyCount: number;
  sellCount: number;
  boughtQuantity: string;
  soldQuantity: string;
  grossExposure: string;
  fees: string;
  realizedPnl: string;
  unrealizedPnl: string | null;
  netPnl: string | null;
  returnPercent: string | null;
  holdingMilliseconds: number | null;
};

export function summarizeTradeEpisode(
  episode: TradeEpisode,
  markPrice?: string,
): TradeEpisodeMetrics {
  let boughtQuantity = new Decimal(0);
  let soldQuantity = new Decimal(0);
  let remainingQuantity = new Decimal(0);
  let averageEntryPrice = new Decimal(0);
  let grossExposure = new Decimal(0);
  let fees = new Decimal(0);
  let realizedPnl = new Decimal(0);
  let signedCashFlow = new Decimal(0);
  let buyCount = 0;
  let sellCount = 0;

  for (const execution of episode.executions) {
    const quantity = new Decimal(execution.quantity).abs();
    const price = new Decimal(execution.price);
    fees = fees.plus(execution.fee || 0);
    const executionValue = quantity.times(price);
    signedCashFlow = signedCashFlow.plus(
      execution.side === "sell"
        ? executionValue
        : executionValue.negated(),
    );
    if (execution.side === "buy") {
      buyCount += 1;
      boughtQuantity = boughtQuantity.plus(quantity);
    } else {
      sellCount += 1;
      soldQuantity = soldQuantity.plus(quantity);
    }

    const opensExposure =
      (episode.direction === "long" && execution.side === "buy") ||
      (episode.direction === "short" && execution.side === "sell");
    if (opensExposure) {
      const addedExposure = quantity.times(price);
      const existingExposure =
        remainingQuantity.times(averageEntryPrice);
      remainingQuantity = remainingQuantity.plus(quantity);
      averageEntryPrice = existingExposure
        .plus(addedExposure)
        .div(remainingQuantity);
      grossExposure = grossExposure.plus(addedExposure);
      continue;
    }

    const closingQuantity = Decimal.min(
      quantity,
      remainingQuantity,
    );
    const priceDifference =
      episode.direction === "long"
        ? price.minus(averageEntryPrice)
        : averageEntryPrice.minus(price);
    realizedPnl = realizedPnl.plus(
      priceDifference.times(closingQuantity),
    );
    remainingQuantity = remainingQuantity.minus(closingQuantity);
    if (remainingQuantity.isZero()) averageEntryPrice = new Decimal(0);
  }

  const reportedRealizedPnl =
    episode.status === "closed"
      ? signedCashFlow
      : realizedPnl.toDecimalPlaces(8);
  const netPnl =
    episode.status === "closed"
      ? signedCashFlow.minus(fees)
      : markPrice === undefined || remainingQuantity.isZero()
        ? null
        : signedCashFlow
            .plus(
              remainingQuantity
                .times(markPrice)
                .times(episode.direction === "long" ? 1 : -1),
            )
            .minus(fees);
  const unrealizedPnl =
    episode.status === "closed"
      ? new Decimal(0)
      : netPnl === null
        ? null
        : netPnl.plus(fees).minus(reportedRealizedPnl);
  const returnPercent =
    netPnl === null || grossExposure.isZero()
      ? null
      : netPnl.div(grossExposure).times(100);

  return {
    buyCount,
    sellCount,
    boughtQuantity: boughtQuantity.toString(),
    soldQuantity: soldQuantity.toString(),
    grossExposure: grossExposure.toString(),
    fees: fees.toString(),
    realizedPnl: reportedRealizedPnl.toString(),
    unrealizedPnl: unrealizedPnl?.toString() ?? null,
    netPnl: netPnl?.toString() ?? null,
    returnPercent: returnPercent?.toString() ?? null,
    holdingMilliseconds: episode.endedAt
      ? new Date(episode.endedAt).getTime() -
        new Date(episode.startedAt).getTime()
      : null,
  };
}
