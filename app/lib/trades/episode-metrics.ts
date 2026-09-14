import Decimal from "decimal.js";

import { isExecutionBackedIpoAllocation, replayExecutionAt, statementEventAt } from "../import/statement-evidence";
import { resolveIpoAcquisitionCost } from "./ipo-cost";
import type { TradeEpisode } from "./types";

export type TradeEpisodeMetrics = {
  /** False means realizedPnl/grossExposure must not be presented as reliable metrics. */
  pnlAvailable?: false;
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
  let unavailable = Boolean(episode.accuracy) || episode.executions.some(e => e.source.feeStatus === "unknown" || e.source.historyIncomplete?.length);
  const evidenceIds = new Set((episode.positionEvents ?? []).map(event => event.id));
  if (episode.ipoCostEvidence?.some(chain => !evidenceIds.has(chain.allocationId)
    || chain.evidenceIds.some(id => !evidenceIds.has(id)))) unavailable = true;
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

  const ipoAllocations = [...new Map((episode.positionEvents ?? [])
    .filter(event => event.kind === "ipo" && event.quantity !== undefined)
    .map(event => [event.id, event])).values()];
  type MetricEntry =
    | { at: string; kind: "execution"; execution: TradeEpisode["executions"][number] }
    | { at: string; kind: "acquisition"; acquisition: { allocation: NonNullable<TradeEpisode["positionEvents"]>[number]; cost: NonNullable<ReturnType<typeof resolveIpoAcquisitionCost>> } };
  const entries: MetricEntry[] = [
    ...episode.executions.map(execution => ({ at: replayExecutionAt(execution), kind: "execution" as const, execution })),
    ...(episode.direction === "long" ? ipoAllocations.flatMap(allocation => {
      if (new Decimal(allocation.quantity!).isZero() || isExecutionBackedIpoAllocation(allocation, episode.executions)) return [];
      const cost = resolveIpoAcquisitionCost(allocation, episode.positionEvents ?? [], episode.executions, episode.instrument.currency);
      if (!cost) unavailable = true;
      return cost ? [{ at: statementEventAt(allocation), kind: "acquisition" as const, acquisition: { allocation, cost } }] : [];
    }) : []),
  ].sort((left, right) => {
    const at = left.at.localeCompare(right.at);
    if (at !== 0) return at;
    const rank = (entry: MetricEntry) => entry.kind === "acquisition" ? 0 : 1;
    return rank(left) - rank(right);
  });

  for (const entry of entries) {
    if (entry.kind === "acquisition") {
      const quantity = new Decimal(entry.acquisition.allocation.quantity!);
      const cashCost = new Decimal(entry.acquisition.cost.cashCost);
      const existingExposure = remainingQuantity.times(averageEntryPrice);
      remainingQuantity = remainingQuantity.plus(quantity);
      averageEntryPrice = existingExposure.plus(cashCost).div(remainingQuantity);
      grossExposure = grossExposure.plus(cashCost);
      signedCashFlow = signedCashFlow.minus(cashCost);
      fees = fees.plus(entry.acquisition.cost.feeCost);
      boughtQuantity = boughtQuantity.plus(quantity);
      buyCount += 1;
      continue;
    }
    const execution = entry.execution;
    const quantity = new Decimal(execution.quantity).abs();
    const settlement = execution.source.settlement;
    const price = settlement && settlement.currency === execution.instrument.currency
      ? new Decimal(settlement.grossAmount).div(settlement.quantity)
      : new Decimal(execution.price);
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
    ...(unavailable ? { pnlAvailable: false as const } : {}),
    buyCount,
    sellCount,
    boughtQuantity: boughtQuantity.toString(),
    soldQuantity: soldQuantity.toString(),
    grossExposure: grossExposure.toString(),
    fees: fees.toString(),
    realizedPnl: unavailable ? "0" : reportedRealizedPnl.toString(),
    unrealizedPnl: unavailable ? null : unrealizedPnl?.toString() ?? null,
    netPnl: unavailable ? null : netPnl?.toString() ?? null,
    returnPercent: unavailable ? null : returnPercent?.toString() ?? null,
    holdingMilliseconds: episode.endedAt && !unavailable
      ? new Date(episode.endedAt).getTime() -
        new Date(episode.startedAt).getTime()
      : null,
  };
}
