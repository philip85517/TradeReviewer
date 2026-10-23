import Decimal from "decimal.js";
import { sha256 } from "../recall/retained-digest";

import {
  hasSettlementCurrencyMismatch,
  tradeNatureOf,
  type TradeExecution,
} from "../trades/types";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";
import { isExecutionBackedIpoAllocation, replayCursorAt, replayExecutionAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import { bonusShareEvidenceKey, collectBonusShareEvidence, isBonusShareEvidence } from "../trades/bonus-share-evidence";
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

export type PositionLedgerInput = {
  executions: TradeExecution[];
  markPrice: string;
  cursor?: string;
  /** Exact execution IDs selected by a dual-cursor replay boundary. */
  visibleExecutionIds?: readonly string[];
  /** Explicit identity for statement-only inventory; used only when no executions exist. */
  inventoryIdentity?: { accountId: string; symbol: string; market: string };
  evidence?: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">[];
};
type Checkpoint = {
  quantity: Decimal; averageCost: Decimal; realizedPnl: Decimal; fees: Decimal; grossCapitalDeployed: Decimal;
  reasons: string[]; warnings: NonNullable<PositionLedgerSnapshot["warnings"]>; quantityUncertain: boolean;
};
type LedgerEntry = { at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent };
type MovementObservation = { entry: LedgerEntry; ordinal: number; before: Checkpoint; after: Checkpoint; closed: Decimal | null; opened: Decimal | null; effect: CanonicalMovementFact["effect"]; evidenceIds: string[]; beforeFeeUnavailable: boolean; afterFeeUnavailable: boolean };
type FactObserver = { context(cursor: string | null, selected: TradeExecution[]): void; movement(value: MovementObservation): void; terminal(value: Checkpoint, feeUnavailable: boolean): void };
function evaluatePositionAtPrice(input: PositionLedgerInput, observe?: (checkpoint: Checkpoint) => void, facts?: FactObserver): PositionLedgerSnapshot {
  let quantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let realizedPnl = new Decimal(0);
  let fees = new Decimal(0);
  let grossCapitalDeployed = new Decimal(0);
  const reasons = new Set<string>();
  const warnings: Array<{ code: "statement-coverage-gap"; from: string; to: string }> = [];
  const rawEvents = [
    ...(input.evidence ?? []).flatMap(e => e.events),
    ...input.executions.flatMap(e => e.source.positionEvents ?? []),
  ];
  const bonusEvidence = collectBonusShareEvidence(rawEvents);
  const duplicateBonusKeys = new Set(bonusEvidence.duplicateKeys);
  const events = [...new Map([
    ...bonusEvidence.events,
    ...rawEvents.filter(event => !isBonusShareEvidence(event)),
  ].map(event => [`${event.accountId}:${event.id}`, event])).values()];
  const matches = (item: StatementPosition | StatementEvent) => input.executions.some(e =>
    tradeNatureOf(e) !== "simulation" && e.accountId === item.accountId && item.symbol && item.market &&
    canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(item.symbol, item.market)) ||
    Boolean(input.executions.length === 0 && input.inventoryIdentity && item.symbol && item.market &&
      input.inventoryIdentity.accountId === item.accountId &&
      canonicalInstrumentId(input.inventoryIdentity.symbol, input.inventoryIdentity.market) === canonicalInstrumentId(item.symbol, item.market));
  type Entry = LedgerEntry;
  const timeline: Entry[] = input.executions.map(execution => ({ at: replayExecutionAt(execution), execution }));
  const seen = new Set<string>();
  for (const position of [...(input.evidence ?? []).flatMap(e => e.positions), ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])]) {
    if (!matches(position)) continue;
    const key = JSON.stringify([position.accountId, position.market, position.symbol, position.phase, position.date, position.quantity]);
    if (seen.has(key)) continue;
    seen.add(key);
    timeline.push({ at: statementPositionAt(position), position });
  }
  for (const event of events) {
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
  const visibleExecutionIds = input.visibleExecutionIds ? new Set(input.visibleExecutionIds) : undefined;
  const selectedExecution = (execution: TradeExecution) => visibleExecutionIds
    ? visibleExecutionIds.has(execution.id)
    : visibleAt(replayExecutionAt(execution));
  const visibleExecutions = input.executions.filter(selectedExecution);
  const actualVisibleExecutions = visibleExecutions.filter(execution => tradeNatureOf(execution) !== "simulation");
  const executionMatchesPosition = (execution: TradeExecution, position: StatementPosition) =>
    tradeNatureOf(execution) !== "simulation" &&
    execution.accountId === position.accountId &&
    canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(position.symbol, position.market);
  const evidenceCoversMarket = (evidence: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">, position: StatementPosition) =>
    evidence.accountId === position.accountId &&
    (evidence.positions.some(item => item.accountId === position.accountId && item.market === position.market) ||
      evidence.events.some(item => item.accountId === position.accountId && item.market === position.market));
  const visibleEvents = [...new Map(events
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
  const checkpoint = (): Checkpoint => ({ quantity, averageCost, realizedPnl, fees, grossCapitalDeployed,
    reasons: [...reasons], warnings: warnings.map(item => ({ ...item })), quantityUncertain: quantityUncertain || pendingTransfers.size > 0 });
  observe?.(checkpoint());
  facts?.context(cursor ?? null, timeline.flatMap(entry => entry.execution && selectedExecution(entry.execution) ? [entry.execution] : []));
  let ordinal = -1, factFeeUnavailable = false;
  for (const entry of timeline) {
    ordinal++;
    if (entry.execution && visibleExecutionIds && !visibleExecutionIds.has(entry.execution.id)) continue;
    if (cursor && Date.parse(entry.at) > Date.parse(cursor)
      && !(entry.execution && visibleExecutionIds?.has(entry.execution.id))) continue;
    const before = facts ? checkpoint() : undefined;
    const beforeFeeUnavailable = factFeeUnavailable;
    let closed: Decimal | null = null, opened: Decimal | null = null;
    let effect: CanonicalMovementFact["effect"] = "applied";
    let movementEvidence: string[] | undefined;
    try {
    if (entry.pendingTransfer) {
      effect = "unresolved";
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
      if (isExecutionBackedIpoAllocation(event, actualVisibleExecutions)) { effect = "suppressed-duplicate"; continue; }
      const isIpoAllocation = event.kind === "ipo" && event.quantity !== undefined;
      const isBonusShare = isBonusShareEvidence(event);
      if (isIpoAllocation && isZero(event.quantity)) { effect = "suppressed-duplicate"; continue; }
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
      if (isBonusShare) {
        const duplicate = duplicateBonusKeys.has(bonusShareEvidenceKey(event));
        const currencies = new Set(actualVisibleExecutions
          .filter(e => e.accountId === event.accountId && event.symbol && event.market &&
            canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(event.symbol, event.market))
          .map(e => e.instrument.currency.trim().toUpperCase()));
        const eventCurrency = event.currency?.trim().toUpperCase();
        const currencyMismatch = currencies.size > 0 && (currencies.size !== 1 || !eventCurrency || !currencies.has(eventCurrency));
        const ambiguous = sameDayExecution || sameMonthExecution;
        if (duplicate) reasons.add("duplicate-position-event");
        if (ambiguous) {
          reasons.add("ambiguous-event-order");
          quantityUncertain = true;
        }
        if (currencyMismatch) {
          reasons.add("currency-conflict");
          reasons.add("position-event");
          hasHistory = true;
          continue;
        }
        const size = new Decimal(event.quantity!);
        if (!size.isPositive()) {
          reasons.add("position-event");
          hasHistory = true;
          continue;
        }
        if (quantity.isNegative() || (quantity.isZero() && hasHistory)) {
          reasons.add("position-event");
          reasons.add("unknown-cost");
          hasHistory = true;
          continue;
        }
        const basisKnown = quantity.gt(0) &&
          !["unknown-cost", "position-event", "position-gap", "ambiguous-event-order", "currency-conflict"].some(reason => reasons.has(reason));
        const newQuantity = quantity.plus(size);
        if (basisKnown) {
          averageCost = averageCost.mul(quantity).div(newQuantity);
        } else {
          if (!hasHistory) reasons.add("initial-position");
          reasons.add("unknown-cost");
        }
        quantity = newQuantity;
      } else if (event.kind === "corporate-action") {
        // Unsupported company actions must remain evidence for review; they do
        // not become inventory or a synthetic execution.
        reasons.add("position-event");
        hasHistory = true;
        continue;
      } else if (event.kind === "transfer-in" || event.kind === "transfer-out") {
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
        if (facts) { closed = new Decimal(0); opened = size; }
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
          if (facts) factFeeUnavailable = true;
          reasons.add("position-event");
          if (!hasHistory) reasons.add("initial-position");
          reasons.add("unknown-cost");
        }
        if (cost) { fees = fees.plus(cost.feeCost); if (facts) movementEvidence = cost.evidenceIds; }
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
          if (facts) { closed = covered; opened = size.minus(covered); }
          if (allocationCost) realizedPnl = realizedPnl.plus(averageCost.minus(allocationCost).mul(covered));
          quantity = quantity.plus(size);
          if (quantity.isPositive() && allocationCost) {
            averageCost = allocationCost;
            grossCapitalDeployed = grossCapitalDeployed.plus(cashCost!);
          }
          if (quantity.isZero()) averageCost = new Decimal(0);
        }
      } else {
        effect = "contextual";
        // Cash, fee, dividend, and other statement rows are contextual
        // evidence only; they do not establish inventory history.
        continue;
      }
      hasHistory = true;
      continue;
    }
    const execution = entry.execution!;
    const executionDate = execution.source.tradingDate ?? execution.source.marketCalendarDate ?? execution.executedAt.slice(0, 10);
    const samePeriodBonusEvidence = tradeNatureOf(execution) !== "simulation" && events.some(event =>
      isBonusShareEvidence(event) &&
      ((event.date.length === 10 && event.date === executionDate) ||
        (event.date.length === 7 && executionDate.startsWith(event.date))) &&
      event.accountId === execution.accountId && event.symbol && event.market &&
      canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) === canonicalInstrumentId(event.symbol, event.market),
    );
    if (samePeriodBonusEvidence) {
      // Date-only and month-only corporate actions are known only at their
      // statement boundary. A same-period fill may therefore be before or
      // after the credit; mark the visible replay uncertain before applying
      // that fill. A future period does not match this predicate.
      reasons.add("ambiguous-event-order");
      quantityUncertain = true;
    }
    if (!hasHistory && !pendingTransfers.size && execution.side === "sell" && (execution.source.statementMonth || execution.source.templateId) && execution.source.positionEffect !== "open-short") {
      reasons.add("ambiguous-opening");
      quantityUncertain = true;
    }
    if (execution.source.feeStatus === "unknown") reasons.add("unknown-fees");
    if (hasSettlementCurrencyMismatch(execution)) {
      reasons.add("settlement-currency-mismatch");
    }
    if (execution.source.historyIncomplete?.length) {
      reasons.add("history-incomplete");
      quantityUncertain = true;
    }
    lastActivity = execution.source.tradingDate ?? execution.executedAt;
    hasHistory = true;
    const size = new Decimal(execution.quantity).abs();
    if (facts) { closed = new Decimal(0); opened = size; }
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
        if (facts) { closed = covered; opened = size.minus(covered); }
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
      const matched = Decimal.min(quantity, size);
      if (facts) { closed = matched; opened = size.minus(matched); }
      realizedPnl = realizedPnl.plus(price.minus(averageCost).mul(matched));
      quantity = quantity.minus(size);
      if (quantity.isNegative()) {
        averageCost = price;
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity.abs()));
      }
      if (quantity.isZero()) averageCost = new Decimal(0);
    }
    observe?.(checkpoint());
    } finally {
      if (facts && before) facts.movement({ entry, ordinal, before, after: checkpoint(), closed, opened, effect, evidenceIds: movementEvidence ?? [], beforeFeeUnavailable, afterFeeUnavailable: factFeeUnavailable });
    }
  }
  const terminal = checkpoint();
  facts?.terminal(terminal, factFeeUnavailable);
  return finalizePosition(terminal, input.markPrice);
}

function finalizePosition(state: Checkpoint, price: string): PositionLedgerSnapshot {
  const { quantity, averageCost, realizedPnl, fees, grossCapitalDeployed, warnings, quantityUncertain } = state;
  const reasons = new Set(state.reasons);
  const markPrice = new Decimal(price);
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
    ...(quantityUncertain ? { quantityKnown: false as const } : {}),
    quantity: quantityUncertain ? "0" : decimalString(quantity),
    averageCost: reasons.size ? "0" : decimalString(averageCost),
    realizedPnl: reasons.size ? "0" : decimalString(realizedPnl),
    unrealizedPnl: reasons.size ? "0" : decimalString(unrealizedPnl),
    netPnl: reasons.size ? "0" : decimalString(netPnl),
    fees: decimalString(fees),
    grossCapitalDeployed: decimalString(grossCapitalDeployed),
    returnPercent: reasons.size ? "0" : decimalString(returnPercent),
  };
}

/** The legacy query semantics, including explicit IDs beyond cursor, remain unchanged. */
export function replayPositionAtPrice(input: PositionLedgerInput): PositionLedgerSnapshot {
  return evaluatePositionAtPrice(input);
}

export type PreparedPositionLedger = Readonly<{
  kind: "ordinary-sweep" | "exact-context-fallback";
  diagnostics: Readonly<{ sweeps: number; transitions: number }>;
  storage: Readonly<{ checkpoints: number; checkpointEstimatedBytes: number }>;
  transitions: readonly Readonly<{ executionId: string; before: Readonly<{ quantity: string; quantityKnown: boolean }>; after: Readonly<{ quantity: string; quantityKnown: boolean }> }>[];
}>;
type PreparedLedgerState = { input: Omit<PositionLedgerInput, "markPrice" | "cursor" | "visibleExecutionIds">; ordered: TradeExecution[]; checkpoints: Checkpoint[]; index: Map<string, number> };
const preparedLedgers = new WeakMap<PreparedPositionLedger, PreparedLedgerState>();
function freezeLedgerValue<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freezeLedgerValue(item);
  }
  return value;
}
/** Captures original evidence. Only evidence-free, uniquely ordered original fills admit a prefix sweep. */
export function preparePositionLedger(input: Omit<PositionLedgerInput, "markPrice" | "cursor" | "visibleExecutionIds">): PreparedPositionLedger {
  const captured = structuredClone(input);
  const ordered = [...captured.executions].sort((a,b) => replayExecutionAt(a).localeCompare(replayExecutionAt(b)));
  const ids = new Set<string>(), times = new Set<string>();
  let ordinary = !(captured.evidence?.length);
  for (const execution of ordered) {
    const at = replayExecutionAt(execution);
    if (execution.source.positionEvents?.length || execution.source.statementPositions?.length || execution.source.openingPosition || ids.has(execution.id) || times.has(at) || !Number.isFinite(Date.parse(at))) ordinary = false;
    ids.add(execution.id); times.add(at);
  }
  const checkpoints: Checkpoint[] = [];
  if (ordinary) evaluatePositionAtPrice({ ...captured, markPrice: "0" }, state => checkpoints.push(state));
  const facts = ordered.map((execution,index) => ({executionId:execution.id,
    before:{quantity:checkpoints[index] && !checkpoints[index].quantityUncertain ? decimalString(checkpoints[index].quantity) : "0",quantityKnown:!checkpoints[index]?.quantityUncertain},
    after:{quantity:checkpoints[index+1] && !checkpoints[index+1].quantityUncertain ? decimalString(checkpoints[index+1].quantity) : "0",quantityKnown:!checkpoints[index+1]?.quantityUncertain}}));
  const handle = freezeLedgerValue({kind:ordinary ? "ordinary-sweep" as const : "exact-context-fallback" as const,
    diagnostics:{sweeps:ordinary?1:0,transitions:ordinary?ordered.length:0},
    storage:{checkpoints:checkpoints.length,checkpointEstimatedBytes:2*JSON.stringify(checkpoints.map(state=>({quantity:state.quantity.toString(),averageCost:state.averageCost.toString(),realizedPnl:state.realizedPnl.toString(),fees:state.fees.toString(),grossCapitalDeployed:state.grossCapitalDeployed.toString(),reasons:state.reasons,warnings:state.warnings,quantityUncertain:state.quantityUncertain}))).length},transitions:ordinary?facts:[]});
  preparedLedgers.set(handle,{input:captured,ordered,checkpoints,index:new Map(ordered.map((execution,index)=>[execution.id,index]))});
  return handle;
}
/** Queries private full-precision canonical checkpoints; ambiguous contexts evaluate the same original function. */
export function replayPreparedPositionBoundaries(source: PreparedPositionLedger, queries: readonly Omit<PositionLedgerInput, "executions" | "inventoryIdentity" | "evidence">[]) {
  const state = preparedLedgers.get(source);
  if (!state) throw new TypeError("Unknown prepared position ledger");
  let evaluations = 0, transitions = 0;
  const results = queries.map(query => {
    let prefix = 0, valid = source.kind === "ordinary-sweep";
    if (query.visibleExecutionIds) {
      const selected = new Set(query.visibleExecutionIds);
      // Unknown IDs are ignored by the original evaluator as well.
      prefix = [...selected].filter(id=>state.index.has(id)).length;
      for (let index=0;index<prefix;index++) if (!selected.has(state.ordered[index].id)) valid = false;
    } else {
      const cursor = query.cursor ? Date.parse(replayCursorAt(query.cursor)) : Number.POSITIVE_INFINITY;
      let low=0,high=state.ordered.length;
      while(low<high) { const middle=(low+high)>>>1; if(Date.parse(replayExecutionAt(state.ordered[middle]))<=cursor) low=middle+1; else high=middle; }
      prefix=low;
    }
    if (valid) return {snapshot:finalizePosition(state.checkpoints[prefix],query.markPrice), mode:"ordinary-sweep" as const,prefixLength:prefix};
    evaluations++;
    transitions += query.visibleExecutionIds ? state.ordered.filter(execution=>query.visibleExecutionIds!.includes(execution.id)).length : state.ordered.length;
    return {snapshot:evaluatePositionAtPrice({...state.input,...query}),mode:"exact-context-fallback" as const};
  });
  return freezeLedgerValue({results,diagnostics:{evaluations,transitions}});
}

export type PositionFactValue = Readonly<{ value: string | null; available: boolean; reasons: readonly string[] }>;
export type PositionFactCoverage = Readonly<{ available: boolean; reasons: readonly string[] }>;
export type CanonicalStateFact = Readonly<{
  quantity: PositionFactValue; averageCost: PositionFactValue; realizedPnl: PositionFactValue;
  fees: PositionFactValue; grossCapitalDeployed: PositionFactValue;
  reasons: readonly string[]; warnings: readonly NonNullable<PositionLedgerSnapshot["warnings"]>[number][];
}>;
export type CanonicalMovementFact = Readonly<{
  factId: string; contextId: string; ordinal: number;
  kind: "execution" | "ipo-allocation" | "bonus" | "transfer" | "position-reconciliation" | "evidence-status";
  effect: "applied" | "suppressed-duplicate" | "unresolved" | "contextual";
  executionId: string | null; eventId: string | null; evidenceIds: readonly string[];
  time: Readonly<{ at: string; sourceDate: string; precision: "instant" | "day" | "month" }>;
  before: CanonicalStateFact; after: CanonicalStateFact;
  matchedClosedQuantity: PositionFactValue; openedQuantity: PositionFactValue; realizedDelta: PositionFactValue;
}>;
export type PositionFactQuery = Readonly<{ cursor?: string; visibleExecutionIds?: readonly string[] }>;
export type CanonicalFactResult = Readonly<{
  contextId: string; sourceId: string; effectiveKnowledgeCursor: string | null; selectedExecutionIds: readonly string[];
  mode: "ordinary-sweep" | "exact-context-fallback"; terminal: CanonicalStateFact; facts: readonly CanonicalMovementFact[];
  coverage: Readonly<{ quantity: PositionFactCoverage; chronology: PositionFactCoverage; costAndRealized: PositionFactCoverage }>;
}>;
function factValue(value: Decimal | null, reasons: readonly string[] = []): PositionFactValue {
  return { value: reasons.length || value === null ? null : value.isZero() ? "0" : value.toFixed(), available: !reasons.length && value !== null, reasons: [...reasons] };
}
function stateFact(state: Checkpoint, feeUnavailable = false): CanonicalStateFact {
  return { quantity: factValue(state.quantity, state.quantityUncertain ? ["quantity-unavailable", ...state.reasons] : []),
    averageCost: factValue(state.averageCost, state.reasons), realizedPnl: factValue(state.realizedPnl, state.reasons),
    fees: factValue(state.fees, [...state.reasons.filter(reason => reason.includes("fee")), ...(feeUnavailable ? ["ipo-fee-allocation-unavailable"] : [])]),
    grossCapitalDeployed: factValue(state.grossCapitalDeployed, state.reasons), reasons: [...state.reasons], warnings: state.warnings.map(warning => ({ ...warning })) };
}
function observedFact(value: MovementObservation): Omit<CanonicalMovementFact, "factId" | "contextId"> {
  const { entry, before, after, ordinal, closed, opened, effect } = value;
  const event = entry.event ?? entry.pendingTransfer, execution = entry.execution, position = entry.position;
  const sourceDate = execution ? execution.source.tradingDate ?? execution.executedAt : event?.date ?? position!.date;
  const precision = execution ? execution.source.timePrecision === "date-only" || execution.executedAt.length === 10 ? "day" : "instant" : sourceDate.length === 7 ? "month" : "day";
  const quantityReasons = before.quantityUncertain || after.quantityUncertain ? ["quantity-unavailable"] : [];
  const realizedReasons = [...new Set([...before.reasons, ...after.reasons])];
  return { ordinal, kind: execution ? "execution" : position ? "position-reconciliation" : entry.pendingTransfer ? "evidence-status" : event?.kind === "ipo" && event.quantity !== undefined ? "ipo-allocation" : event && isBonusShareEvidence(event) ? "bonus" : event?.kind === "transfer-in" || event?.kind === "transfer-out" ? "transfer" : "evidence-status",
    effect, executionId: execution?.id ?? null, eventId: event?.id ?? null,
    evidenceIds: execution ? [execution.id] : event ? [...new Set([event.id, ...value.evidenceIds])] : [JSON.stringify([position!.accountId, position!.market, position!.symbol, position!.phase, position!.date, position!.quantity])],
    time: { at: entry.at, sourceDate, precision }, before: stateFact(before, value.beforeFeeUnavailable), after: stateFact(after, value.afterFeeUnavailable),
    matchedClosedQuantity: factValue(closed, quantityReasons), openedQuantity: factValue(opened, quantityReasons),
    realizedDelta: factValue(after.realizedPnl.minus(before.realizedPnl), realizedReasons) };
}
/** Explicit, transient observation of the canonical evaluator. No fact graph is retained in a prepared handle. */
export function readPreparedPositionFacts(source: PreparedPositionLedger, queries: readonly PositionFactQuery[]) {
  const prepared = preparedLedgers.get(source);
  if (!prepared) throw new TypeError("Unknown prepared position ledger");
  const sourceId = `sha256:${sha256(JSON.stringify({ input: prepared.input, policy: "canonical-movement-1" }))}`;
  let evaluations = 0, transitions = 0, indexProbes = 0;
  const evaluate = (query: PositionFactQuery) => {
    const observations: Omit<CanonicalMovementFact, "factId" | "contextId">[] = [];
    let terminal: CanonicalStateFact | undefined, cursor: string | null = null, selected: string[] = [];
    evaluations++;
    evaluatePositionAtPrice({ ...prepared.input, ...query, markPrice: "0" }, undefined, {
      context(at, executions) { cursor = at; selected = executions.map(execution => execution.id); },
      movement(value) { observations.push(observedFact(value)); transitions++; },
      terminal(value, feeUnavailable) { terminal = stateFact(value, feeUnavailable); },
    });
    return { observations, terminal: terminal!, cursor, selected };
  };
  // Resolve prefix queries through the existing index/binary search. Result materialization
  // costs only its emitted facts/IDs; empty and short queries never rescan the full source.
  let swept: ReturnType<typeof evaluate> | undefined;
  const results: CanonicalFactResult[] = queries.map(query => {
    let length = 0, prefix = source.kind === "ordinary-sweep";
    const cursor = query.cursor ? replayCursorAt(query.cursor) : null;
    if (prefix && query.visibleExecutionIds) {
      let maximum = -1;
      for (const id of new Set(query.visibleExecutionIds)) {
        indexProbes++;
        const index = prepared.index.get(id);
        if (index !== undefined) { length++; maximum = Math.max(maximum, index); }
      }
      prefix = maximum === length - 1;
    } else if (prefix) {
      let low = 0, high = prepared.ordered.length;
      while (low < high) { indexProbes++; const middle = (low + high) >>> 1; if (!cursor || replayExecutionAt(prepared.ordered[middle]) <= cursor) low = middle + 1; else high = middle; }
      length = low;
    }
    if (prefix && !swept) swept = evaluate({});
    const evaluated = prefix && swept ? { observations: swept.observations.slice(0, length), terminal: stateFact(prepared.checkpoints[length]), cursor: cursor ?? swept.cursor, selected: prepared.ordered.slice(0, length).map(execution => execution.id) } : evaluate(query);
    const contextId = `sha256:${sha256(JSON.stringify([sourceId, evaluated.cursor, evaluated.selected]))}`;
    const facts = evaluated.observations.map(fact => ({ ...fact, contextId, factId: `${contextId}:${fact.ordinal}` }));
    const terminal = evaluated.terminal;
    const chronologyReasons = [...new Set([...(!terminal.quantity.available ? terminal.quantity.reasons : []), ...terminal.reasons.filter(reason => ["position-gap", "ambiguous-event-order", "ambiguous-opening", "history-incomplete"].includes(reason)), ...(facts.some(fact => fact.kind !== "ipo-allocation" && !fact.before.reasons.includes("initial-position") && fact.after.reasons.includes("initial-position")) ? ["initial-position"] : [])])];
    return { contextId, sourceId, effectiveKnowledgeCursor: evaluated.cursor, selectedExecutionIds: evaluated.selected,
      mode: prefix ? "ordinary-sweep" : "exact-context-fallback", terminal, facts,
      coverage: { quantity: { available: terminal.quantity.available, reasons: terminal.quantity.reasons }, chronology: { available: !chronologyReasons.length, reasons: chronologyReasons }, costAndRealized: { available: terminal.realizedPnl.available, reasons: terminal.realizedPnl.reasons } } };
  });
  return freezeLedgerValue({ results, diagnostics: { evaluations, transitions, indexProbes, retainedFactBytes: 0 } });
}
