import Decimal from "decimal.js";

import { tradeNatureOf, type TradeExecution } from "../trades/types";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";
import { isExecutionBackedIpoAllocation, replayCursorAt, replayExecutionAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";

export type PositionLedgerSnapshot = {
  /** With unavailable accuracy, numeric PnL/cost fields are compatibility placeholders. */
  accuracy?: { pnl: "unavailable"; reasons: string[] };
  costKnown?: false;
  /** Quantity is a compatibility placeholder until the evidence establishes inventory. */
  quantityKnown?: false;
  warnings?: Array<{ code: "statement-coverage-gap"; from: string; to: string }>;
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

function isZero(value: string | undefined): boolean {
  if (value === undefined) return false;
  try {
    return new Decimal(value).isZero();
  } catch {
    return false;
  }
}

function statementCoverageGaps(previous: string | undefined, next: string, coveredMonths: string[]): Array<{ from: string; to: string }> {
  if (!previous) return [];
  const ordinal = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const monthLabel = (value: number) => `${Math.floor(value / 12).toString().padStart(4, "0")}-${(value % 12 + 1).toString().padStart(2, "0")}`;
  const covered = new Set(coveredMonths.map(ordinal));
  const gaps: Array<{ from: string; to: string }> = [];
  let start: number | undefined;
  let end: number | undefined;
  for (let month = ordinal(previous) + 1; month < ordinal(next); month++) {
    if (!covered.has(month)) {
      start ??= month;
      end = month;
      continue;
    }
    if (start !== undefined && end !== undefined) gaps.push({ from: monthLabel(start), to: monthLabel(end) });
    start = undefined;
    end = undefined;
  }
  if (start !== undefined && end !== undefined) gaps.push({ from: monthLabel(start), to: monthLabel(end) });
  return gaps;
}

function monthEndAt(month: string): string | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return undefined;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59, 999)).toISOString();
}

function ledgerEventAt(event: StatementEvent): string {
  // A session-open marker is an ordered first candle only when the source has
  // a real date. YYYY-MM remains month-end knowledge and same-month order is
  // ambiguous.
  if (event.kind === "ipo" && event.quantity !== undefined && event.displayTimePolicy === "session-open" && event.date.length === 10) {
    return statementEventAt(event);
  }
  if (event.date.length === 7) return statementEventAt({ ...event, displayTimePolicy: undefined });
  return statementEventAt(event);
}

export function replayPositionAtPrice(input: {
  executions: TradeExecution[];
  markPrice: string;
  cursor?: string;
  evidence?: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">[];
}): PositionLedgerSnapshot {
  let quantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let realizedPnl = new Decimal(0);
  let fees = new Decimal(0);
  let grossCapitalDeployed = new Decimal(0);
  const reasons = new Set<string>();
  const warnings: Array<{ code: "statement-coverage-gap"; from: string; to: string }> = [];
  const matches = (item: StatementPosition | StatementEvent) => input.executions.some(e =>
    tradeNatureOf(e) !== "simulation" && e.accountId === item.accountId && item.symbol && item.market &&
    canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(item.symbol, item.market));
  type Entry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent };
  const timeline: Entry[] = input.executions.map(execution => ({ at: replayExecutionAt(execution), execution }));
  const seen = new Set<string>();
  for (const position of [...(input.evidence ?? []).flatMap(e => e.positions), ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])]) {
    if (!matches(position)) continue;
    const key = JSON.stringify([position.accountId, position.market, position.symbol, position.phase, position.date, position.quantity]);
    if (seen.has(key)) continue;
    seen.add(key);
    timeline.push({ at: statementPositionAt(position), position });
  }
  for (const event of [...(input.evidence ?? []).flatMap(e => e.events), ...input.executions.flatMap(e => e.source.positionEvents ?? [])]) {
    if (!matches(event) || seen.has(`${event.accountId}:${event.id}`)) continue;
    seen.add(`${event.accountId}:${event.id}`);
    // Month-only IPO results are contextual evidence, known by month end at earliest.
    const at = ledgerEventAt(event);
    if (event.date.length === 10 && (event.kind === "transfer-in" || event.kind === "transfer-out")) timeline.push({ at: `${event.date}T00:00:00.000Z`, pendingTransfer: event });
    timeline.push({ at, event });
  }
  const rank = (entry: Entry) => entry.position ? (entry.position.phase === "opening" ? 0 : 4) : entry.pendingTransfer ? 1 : entry.event ? 2 : 3;
  timeline.sort((a, b) => a.at.localeCompare(b.at) || rank(a) - rank(b));
  const cursor = input.cursor ? replayCursorAt(input.cursor) : timeline.at(-1)?.at;
  const cursorTime = cursor ? Date.parse(cursor) : Number.POSITIVE_INFINITY;
  const visibleAt = (at: string) => Date.parse(at) <= cursorTime;
  const visibleExecutions = input.executions.filter(execution => visibleAt(replayExecutionAt(execution)));
  const actualVisibleExecutions = visibleExecutions.filter(execution => tradeNatureOf(execution) !== "simulation");
  const executionMatchesPosition = (execution: TradeExecution, position: StatementPosition) =>
    tradeNatureOf(execution) !== "simulation" &&
    execution.accountId === position.accountId &&
    canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(position.symbol, position.market);
  const evidenceCoversMarket = (evidence: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">, position: StatementPosition) =>
    evidence.accountId === position.accountId &&
    (evidence.positions.some(item => item.accountId === position.accountId && item.market === position.market) ||
      evidence.events.some(item => item.accountId === position.accountId && item.market === position.market));
  const allEvents = [
    ...(input.evidence ?? []).flatMap(e => e.events),
    ...input.executions.flatMap(e => e.source.positionEvents ?? []),
  ];
  const visibleEvents = [...new Map(allEvents
    .filter(event => visibleAt(ledgerEventAt(event)))
    .map(event => [`${event.accountId}:${event.id}`, event])).values()];
  const allPositions = [
    ...(input.evidence ?? []).flatMap(e => e.positions),
    ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])]),
  ];
  const knownPositions = [...new Map(allPositions
    .filter(position => visibleAt(statementPositionAt(position)))
    .map(position => [JSON.stringify([position.accountId, position.market, position.symbol, position.phase, position.date, position.quantity]), position])).values()];
  let hasHistory = false;
  let lastActivity: string | undefined;
  let quantityUncertain = false;
  const pendingTransfers = new Set<string>();

  for (const entry of timeline) {
    if (cursor && Date.parse(entry.at) > Date.parse(cursor)) continue;
    if (entry.pendingTransfer) {
      pendingTransfers.add(`${entry.pendingTransfer.accountId}:${entry.pendingTransfer.id}`);
      reasons.add("ambiguous-event-order");
      continue;
    }
    if (entry.position) {
      quantityUncertain = false;
      const covered = [
        ...visibleExecutions.filter(e => e.source.statementMonth && executionMatchesPosition(e, entry.position!)).map(e => e.source.statementMonth!),
        ...knownPositions.filter(position => position.accountId === entry.position!.accountId && canonicalInstrumentId(position.symbol, position.market) === canonicalInstrumentId(entry.position!.symbol, entry.position!.market)).map(position => position.date.slice(0, 7)),
        ...(input.evidence ?? []).filter(e => e.month && monthEndAt(e.month) !== undefined && visibleAt(monthEndAt(e.month)!) && evidenceCoversMarket(e, entry.position!)).map(e => e.month!),
      ];
      const coverageGaps = statementCoverageGaps(lastActivity, entry.position.date, covered);
      if (new Decimal(entry.position.quantity).eq(quantity)) {
        for (const gap of coverageGaps) if (!warnings.some(item => item.from === gap.from && item.to === gap.to)) warnings.push({ code: "statement-coverage-gap", ...gap });
      } else if (coverageGaps.length) {
        reasons.add("position-gap");
      }
      lastActivity = entry.position.date;
      const next = new Decimal(entry.position.quantity);
      if (!next.eq(quantity)) {
        reasons.add(hasHistory ? "position-gap" : "initial-position");
        reasons.add("unknown-cost");
        quantity = next;
        averageCost = new Decimal(0);
      }
      hasHistory = true;
      continue;
    }
    if (entry.event) {
      const event = entry.event;
      if (isExecutionBackedIpoAllocation(event, actualVisibleExecutions)) continue;
      const isIpoAllocation = event.kind === "ipo" && event.quantity !== undefined;
      if (isIpoAllocation && isZero(event.quantity)) continue;
      const sameDayExecution = event.date.length === 10 && actualVisibleExecutions.some(e =>
        e.accountId === event.accountId &&
        canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(event.symbol ?? "", event.market ?? "") &&
        (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)) === event.date,
      );
      const sameMonthExecution = event.date.length === 7 && actualVisibleExecutions.some(e =>
        e.accountId === event.accountId &&
        canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(event.symbol ?? "", event.market ?? "") &&
        (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)).startsWith(event.date),
      );
      const ipoHasExplicitReplayOrder = isIpoAllocation && event.date.length === 10 && event.displayTimePolicy === "session-open";
      if (!ipoHasExplicitReplayOrder && (sameDayExecution || sameMonthExecution) && isIpoAllocation) reasons.add("ambiguous-event-order");
      if (event.kind === "transfer-in" || event.kind === "transfer-out") {
        const sameDay = event.date.length === 10 && actualVisibleExecutions.some(e => e.accountId === event.accountId && e.instrument.symbol === event.symbol && (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)) === event.date);
        pendingTransfers.delete(`${event.accountId}:${event.id}`);
        if (sameDay) reasons.add("ambiguous-event-order");
        if (event.quantity === undefined) {
          reasons.add("unknown-cost");
          quantityUncertain = true;
          continue;
        }
        quantity = quantity.plus(new Decimal(event.quantity).abs().times(event.kind === "transfer-in" ? 1 : -1));
        averageCost = new Decimal(0);
        reasons.add("unknown-cost");
      } else if (isIpoAllocation) {
        const quantityValue = new Decimal(event.quantity!);
        if (!quantityValue.isPositive()) {
          reasons.add("position-event");
          hasHistory = true;
          continue;
        }
        const size = quantityValue;
        const instrumentCurrencies = new Set(actualVisibleExecutions.filter(e =>
          e.accountId === event.accountId &&
          event.symbol &&
          event.market &&
          canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(event.symbol, event.market)).map(e => e.instrument.currency));
        const instrumentCurrency = instrumentCurrencies.size === 1 ? [...instrumentCurrencies][0] : undefined;
        const cost = resolveIpoAcquisitionCost(event, visibleEvents, actualVisibleExecutions, instrumentCurrency);
        const cashCost = cost ? new Decimal(cost.cashCost) : undefined;
        const allocationCost = cashCost?.div(size);
        if (!cost || !allocationCost) {
          reasons.add("position-event");
          if (!hasHistory) reasons.add("initial-position");
          reasons.add("unknown-cost");
        }
        if (cost) fees = fees.plus(cost.feeCost);
        if (quantity.gte(0)) {
          const newQuantity = quantity.plus(size);
          if (allocationCost) {
            averageCost = newQuantity.isZero()
              ? new Decimal(0)
              : averageCost.mul(quantity).plus(allocationCost.mul(size)).div(newQuantity);
            grossCapitalDeployed = grossCapitalDeployed.plus(cashCost!);
          }
          quantity = newQuantity;
        } else {
          const covered = Decimal.min(quantity.abs(), size);
          if (allocationCost) realizedPnl = realizedPnl.plus(averageCost.minus(allocationCost).mul(covered));
          quantity = quantity.plus(size);
          if (quantity.isPositive() && allocationCost) {
            averageCost = allocationCost;
            grossCapitalDeployed = grossCapitalDeployed.plus(cashCost!);
          }
          if (quantity.isZero()) averageCost = new Decimal(0);
        }
      } else {
        // Cash, fee, dividend, and other statement rows are contextual
        // evidence only; they do not establish inventory history.
        continue;
      }
      hasHistory = true;
      continue;
    }
    const execution = entry.execution!;
    if (!hasHistory && !pendingTransfers.size && execution.side === "sell" && (execution.source.statementMonth || execution.source.templateId) && execution.source.positionEffect !== "open-short") {
      reasons.add("ambiguous-opening");
      quantityUncertain = true;
    }
    if (execution.source.feeStatus === "unknown") reasons.add("unknown-fees");
    if (execution.source.historyIncomplete?.length) {
      reasons.add("history-incomplete");
      quantityUncertain = true;
    }
    lastActivity = execution.source.tradingDate ?? execution.executedAt;
    hasHistory = true;
    const size = new Decimal(execution.quantity).abs();
    const settlement = execution.source.settlement;
    const price = settlement && settlement.currency === execution.instrument.currency
      ? new Decimal(settlement.grossAmount).div(settlement.quantity)
      : new Decimal(execution.price);
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
    ...(reasons.size ? { costKnown: false as const, accuracy: { pnl: "unavailable" as const, reasons: [...reasons] } } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(quantityUncertain || pendingTransfers.size ? { quantityKnown: false as const } : {}),
    quantity: quantityUncertain || pendingTransfers.size ? "0" : decimalString(quantity),
    averageCost: reasons.size ? "0" : decimalString(averageCost),
    realizedPnl: reasons.size ? "0" : decimalString(realizedPnl),
    unrealizedPnl: reasons.size ? "0" : decimalString(unrealizedPnl),
    netPnl: reasons.size ? "0" : decimalString(netPnl),
    fees: decimalString(fees),
    grossCapitalDeployed: decimalString(grossCapitalDeployed),
    returnPercent: reasons.size ? "0" : decimalString(returnPercent),
  };
}
