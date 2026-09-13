import Decimal from "decimal.js";

import { canonicalInstrumentId } from "../instruments/display-name";
import type { StatementEvent } from "../import/monthly-statement";
import { isExecutionBackedIpoAllocation } from "../import/statement-evidence";
import type { TradeExecution } from "./types";

export type IpoAcquisitionCost = {
  cashCost: string;
  feeCost: string;
  totalCost: string;
  unitCost: string;
  evidenceIds: string[];
};

// Conservative attribution policy, not a listing-date or financing fact. A
// cash event outside this window remains unknown rather than borrowing a
// neighboring month's cash trail.
const WINDOW_DAYS = 45;

function decimal(value: string | undefined): Decimal | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function dateBounds(value: string): [number, number] | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : undefined;
  if (month < 1 || month > 12 || (day !== undefined && (day < 1 || day > 31))) return undefined;
  const start = Date.UTC(year, month - 1, day ?? 1);
  const end = day === undefined ? Date.UTC(year, month, 0) : start;
  return [start, end];
}

function withinWindow(left: string, right: string): boolean {
  const leftBounds = dateBounds(left);
  const rightBounds = dateBounds(right);
  if (!leftBounds || !rightBounds) return false;
  const window = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return leftBounds[0] <= rightBounds[1] + window && rightBounds[0] <= leftBounds[1] + window;
}

function sameScope(event: StatementEvent, allocation: StatementEvent): boolean {
  return event.accountId === allocation.accountId
    && event.market === allocation.market
    && event.symbol !== undefined
    && allocation.symbol !== undefined
    && canonicalInstrumentId(event.symbol, event.market ?? "") === canonicalInstrumentId(allocation.symbol, allocation.market ?? "");
}

function isCashApplication(event: StatementEvent, amount: Decimal): boolean {
  return event.kind === "ipo" && event.quantity === undefined && amount.isNegative() && /(?:\bapplication\b|\bapp\b|申購|申购|申請|申请)/i.test(event.description);
}

function isCashRefund(event: StatementEvent, amount: Decimal): boolean {
  return event.kind === "ipo" && event.quantity === undefined && amount.isPositive() && /(?:refund|退款|退回|退還|退还)/i.test(event.description);
}

function isIpoFee(event: StatementEvent): boolean {
  return event.kind === "fee" && /(?:ipo|申購|申购|新股)/i.test(event.description);
}

/**
 * Resolve a stock-allotment cost only when its cash trail is attributable.
 * The stock-event amount is evidence of the allotment, not assumed to be the
 * final cash cost. Cash events must name the same scoped instrument and use
 * the instrument currency; fee-only or unscoped evidence remains unknown.
 */
export function resolveIpoAcquisitionCost(
  allocation: StatementEvent,
  events: readonly StatementEvent[],
  executions: readonly TradeExecution[] = [],
  instrumentCurrency?: string,
): IpoAcquisitionCost | undefined {
  const quantity = decimal(allocation.quantity);
  if (allocation.kind !== "ipo" || quantity === undefined || !quantity.isPositive() || !allocation.symbol || !allocation.market) return undefined;
  if (isExecutionBackedIpoAllocation(allocation, executions)) return undefined;

  const scopedEvents = [...new Map(events.filter(event => sameScope(event, allocation)).map(event => [event.id, event])).values()];
  const allocations = scopedEvents.filter(event => event.kind === "ipo" && event.quantity !== undefined && decimal(event.quantity)?.isPositive());
  const candidateCurrencyValues = new Set(scopedEvents
    .filter(event => event.quantity === undefined && withinWindow(event.date, allocation.date))
    .flatMap(event => {
      const amount = decimal(event.amount);
      return amount && (isCashApplication(event, amount) || isCashRefund(event, amount) || isIpoFee(event)) && event.currency
        ? [event.currency.toUpperCase()]
        : [];
    }));
  const allocationCurrency = allocation.currency?.toUpperCase();
  const knownCurrency = instrumentCurrency?.toUpperCase();
  if (allocationCurrency && knownCurrency && allocationCurrency !== knownCurrency) return undefined;
  const currency = allocationCurrency ?? knownCurrency ?? (candidateCurrencyValues.size === 1 ? [...candidateCurrencyValues][0] : undefined);
  if (!currency) return undefined;
  // Context only: a compatible unassigned IPO fee prevents certifying zero
  // fees. It is never assigned a symbol or included in the cost sum.
  if (events.some(event => event.accountId === allocation.accountId
    && event.symbol === undefined && isIpoFee(event)
    && (!event.market || event.market === allocation.market)
    && (!event.currency || event.currency.toUpperCase() === currency)
    && withinWindow(event.date, allocation.date))) return undefined;
  const cashEvents = scopedEvents.filter(event => withinWindow(event.date, allocation.date) && event.quantity === undefined && event.currency?.toUpperCase() === currency);
  if (!allocations.length || !cashEvents.length) return undefined;

  const uniquelyAttributable = cashEvents.every(event => {
    const matches = allocations.filter(candidate => withinWindow(candidate.date, event.date));
    return matches.length === 1 && matches[0].id === allocation.id;
  });
  if (!uniquelyAttributable) return undefined;

  const selected = cashEvents.flatMap(event => {
    const amount = decimal(event.amount);
    if (!amount) return [];
    return isCashApplication(event, amount) || isCashRefund(event, amount) || isIpoFee(event)
      ? [{ event, amount }]
      : [];
  });
  const applications = selected.filter(item => isCashApplication(item.event, item.amount));
  const refunds = selected.filter(item => isCashRefund(item.event, item.amount));
  if (applications.length !== 1 || refunds.length !== 1) return undefined;
  const allocationBounds = dateBounds(allocation.date);
  if (!allocationBounds) return undefined;
  if (!dateBounds(applications[0].event.date) || !dateBounds(refunds[0].event.date)) return undefined;
  if (dateBounds(applications[0].event.date)![0] > allocationBounds[1] || dateBounds(refunds[0].event.date)![1] < allocationBounds[0]) return undefined;

  const cashCost = applications.concat(refunds).reduce((total, item) => total.minus(item.amount), new Decimal(0));
  const feeCost = selected.filter(item => isIpoFee(item.event)).reduce((total, item) => total.minus(item.amount), new Decimal(0));
  const totalCost = cashCost.plus(feeCost);
  if (!cashCost.isPositive() || !totalCost.isPositive()) return undefined;

  return {
    cashCost: cashCost.toString(),
    feeCost: feeCost.toString(),
    totalCost: totalCost.toString(),
    unitCost: totalCost.div(quantity).toString(),
    evidenceIds: selected.map(item => item.event.id),
  };
}
