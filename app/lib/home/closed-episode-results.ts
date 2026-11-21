import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";

import { isExecutionBackedIpoAllocation } from "../import/statement-evidence";
import { nativeExecutionAt, nativeMarketBoundary } from "../replay/native-boundary";
import { summarizeTradeEpisode } from "../trades/episode-metrics";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";
import { resolvedEpisodeTradeNatureOf } from "../trades/nature-resolution";
import { executionFeeCurrency, hasSettlementCurrencyMismatch, type Instrument, type TradeEpisode, type TradeExecution, type TradeNature } from "../trades/types";
import { businessDay } from "./finance";
import { validDay } from "./period";

export type ClosedEpisodeAmount = { value: string | null; reasons: string[] };
export type ClosedEpisodeFees = ClosedEpisodeAmount & {
  currency: string;
  /** Confirmed subtotal only; value stays null if the entire fee pool is unknown. */
  knownValue: string | null;
  coverage: { known: number; total: number };
};
export type ClosedEpisodeResult = {
  /** The source episode identity, never a hash of its recalculated amount. */
  id: string;
  accountId: string;
  accountLabel: string;
  instrument: Instrument;
  tradeNature: "live";
  direction: TradeEpisode["direction"];
  directionKnown: boolean;
  startedAt: string;
  endedAt: string;
  /** Knowledge boundary used for admission, not a fabricated execution time. */
  closeKnownAt: string;
  closeTimePrecision: "second" | "date-only";
  businessDate: string;
  businessTimeZone: string;
  currency: string;
  net: ClosedEpisodeAmount;
  /** Never add these currencies together. */
  fees: ClosedEpisodeFees[];
  executionIds: string[];
  /** Financial attribution is a separate, as yet unimplemented contract. */
  contributionCategory: null;
  provenance: {
    declaredTradeNature: TradeNature | null;
    positionEventIds: string[];
    ipoCostEvidence: NonNullable<TradeEpisode["ipoCostEvidence"]>;
    accuracyReasons: string[];
    warnings: NonNullable<TradeEpisode["warnings"]>;
  };
};
export type ClosedEpisodeExclusionReason = "open" | "simulation" | "trade-nature-unknown" | "missing-ended-at" | "closure-unconfirmed" | "invalid-time" | "future-close";
export type ClosedEpisodeExcluded = {
  id: string;
  accountId: string;
  instrumentId: string;
  tradeNature: TradeNature;
  startedAt: string;
  endedAt: string | null;
  executionIds: string[];
  reasons: ClosedEpisodeExclusionReason[];
};
export type ClosedEpisodeResults = {
  asOf: string;
  cutoff: string;
  businessDate: string;
  businessTimeZone: string;
  rows: ClosedEpisodeResult[];
  excluded: ClosedEpisodeExcluded[];
  /** Counts are round counts, separate from trusted financial samples. */
  coverage: { input: number; included: number; excluded: number; netKnown: number; feesKnown: number };
};
export type ClosedEpisodeResultOptions = { asOf: string; businessTimeZone?: string };

// Validation is stricter than Date.parse: no rollover, host-local timezone, or
// RFC3339's -00:00 (unknown local offset) may become a trusted business date.
function instant(value: string): Temporal.Instant {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || value.endsWith("-00:00") || !validDay(value.slice(0, 10))) throw new RangeError("Invalid or timezone-free instant");
  return Temporal.Instant.from(value);
}
function dayAt(at: Temporal.Instant, zone: string): string {
  // Retain the existing homepage's default business-day policy.
  return zone === "Asia/Shanghai" ? businessDay(at.toString()) : at.toZonedDateTimeISO(zone).toPlainDate().toString();
}
function knownNativeMarket(market: string | undefined): boolean {
  return market !== undefined && ["US", "HK", "CN", "SH", "SZ", "CN-SH", "CN-SZ"].includes(market);
}
function executionAt(execution: TradeExecution): Temporal.Instant {
  const source = execution.source;
  if (source.timePrecision !== "date-only" && execution.executedAt.length !== 10) return instant(execution.executedAt);
  if (execution.executedAt.length === 10 ? !validDay(execution.executedAt) : !instant(execution.executedAt)) throw new RangeError("Invalid execution date");
  if (!knownNativeMarket(execution.instrument.market)) throw new RangeError("Unknown date-only market timezone");
  const sourceDay = source.sourceTimestampText?.trim();
  if (sourceDay && /^\d{4}-\d{2}-\d{2}$/.test(sourceDay) && !validDay(sourceDay)) throw new RangeError("Invalid source date");
  if (execution.executedAt.length !== 10 && !source.marketCalendarDate && !source.tradingDate && !source.sourceTimezone && !(sourceDay && validDay(sourceDay))) throw new RangeError("Date-only timestamp has no source calendar date");
  if (source.sourceTimezone) Temporal.Instant.from("2000-01-01T00:00:00Z").toZonedDateTimeISO(source.sourceTimezone);
  for (const day of [source.marketCalendarDate, source.tradingDate]) if (day !== undefined && !validDay(day)) throw new RangeError("Invalid source date");
  if (source.marketCalendarDate && source.tradingDate && source.marketCalendarDate !== source.tradingDate) throw new RangeError("Conflicting source dates");
  return instant(nativeExecutionAt(execution));
}
function finite(value: string | undefined): Decimal | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { const parsed = new Decimal(value); return parsed.isFinite() ? parsed : null; } catch { return null; }
}
function currency(value: string): string {
  const normalized = value.trim().toUpperCase();
  return ({ RMB: "CNY", 人民币: "CNY", 港币: "HKD", "HK$": "HKD", 美元: "USD", "US$": "USD" } as Record<string, string>)[normalized] ?? normalized;
}
function knownCurrency(value: string): boolean { return /^[A-Z]{3}$/.test(value) && value !== "XXX"; }
function unique(values: string[]): string[] { return [...new Set(values)]; }

/** Same settlement/fee integrity conditions as collectFees; unrelated statement
 * fees are deliberately not attributed to a round merely by being attached. */
function feeReason(execution: TradeExecution): string | null {
  if (execution.source.feeStatus === "unknown") return "unknown-fees";
  const fee = finite(execution.fee);
  if (!fee || fee.lt(0)) return "invalid-fees";
  const settlement = execution.source.settlement;
  if (!settlement) return null;
  const quantity = finite(settlement.quantity), gross = finite(settlement.grossAmount), net = finite(settlement.netAmount);
  const parts = Object.values(settlement.fees).map(finite);
  const executionQuantity = finite(execution.quantity);
  if (!quantity?.gt(0) || !executionQuantity || !quantity.eq(executionQuantity) || !gross || gross.lt(0) || settlement.netAmount !== undefined && !net || parts.some(part => !part || part.lt(0))) return "invalid-settlement";
  const amounts = [fee, gross, ...(net ? [net] : []), ...parts as Decimal[]];
  const precision = exactSumPrecision(amounts);
  if (precision > 1000) return "fee-precision-unsupported";
  const Arithmetic = Decimal.clone({ precision });
  if (!parts.reduce<Decimal>((sum, part) => sum.plus(part!), new Arithmetic(0)).eq(fee)) return "invalid-settlement";
  const expected = execution.side === "buy" ? new Arithmetic(gross).negated().minus(fee) : new Arithmetic(gross).minus(fee);
  return net === null || expected.eq(net) ? null : "invalid-settlement";
}
function arithmeticWidth(values: Decimal[]): number {
  const nonzero = values.filter(value => !value.isZero());
  if (!nonzero.length) return 1;
  const highest = Math.max(...nonzero.map(value => value.e));
  const lowest = Math.min(...nonzero.map(value => value.e - value.sd() + 1));
  return highest - lowest + 1 + String(values.length).length;
}
function exactSumPrecision(values: Decimal[]): number { return Math.max(48, arithmeticWidth(values)); }
function closureQuantityPrecisionSupported(episode: TradeEpisode): boolean {
  const quantities = episode.executions.map(execution => finite(execution.quantity)).concat(
    (episode.positionEvents ?? []).flatMap(event => event.quantity === undefined ? [] : [finite(event.quantity)]),
    episode.initialPosition ? [finite(episode.initialPosition.quantity)] : [],
  );
  // A rounded legacy inventory zero is not a proven exit. Bound all source
  // quantity additions, including the initial inventory seed and carry digits,
  // without reconstructing rounds or rejecting inventory with unknown cost.
  return quantities.every((value): value is Decimal => value !== null) && arithmeticWidth(quantities) <= Decimal.precision;
}

type FeePart = { currency: string; value: string | null; reasons: string[] };
function feesFor(episode: TradeEpisode, cutoff: Temporal.Instant): ClosedEpisodeFees[] {
  const parts: FeePart[] = episode.executions.map(execution => {
    const reason = feeReason(execution);
    return { currency: executionFeeCurrency(execution) || "UNKNOWN", value: execution.fee, reasons: reason ? [reason] : [] };
  });
  const events = episode.positionEvents ?? [];
  for (const allocation of events.filter(event => event.kind === "ipo" && event.quantity !== undefined)) {
    const quantity = finite(allocation.quantity);
    if (!quantity || quantity.isZero() || isExecutionBackedIpoAllocation(allocation, episode.executions)) continue;
    let cost: ReturnType<typeof resolveIpoAcquisitionCost>;
    try { cost = resolveIpoAcquisitionCost(allocation, events, episode.executions, episode.instrument.currency); } catch { cost = undefined; }
    const amounts = events.flatMap(event => event.amount === undefined ? [] : [finite(event.amount)]);
    const precisionSupported = amounts.every((amount): amount is Decimal => amount !== null) && arithmeticWidth(amounts) <= Decimal.precision;
    const costEvidence = events.filter(event => event.id === allocation.id || cost?.evidenceIds.includes(event.id));
    const reasons = evidenceDateReasons(costEvidence, cutoff);
    if (!cost) reasons.push("ipo-fees-unavailable");
    else if (!precisionSupported) reasons.push("ipo-fees-precision-unsupported");
    parts.push({ currency: currency(allocation.currency ?? episode.instrument.currency) || "UNKNOWN", value: cost?.feeCost ?? null, reasons });
  }
  const grouped = new Map<string, FeePart[]>();
  for (const part of parts) { const group = grouped.get(part.currency) ?? []; group.push(part); grouped.set(part.currency, group); }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, group]) => {
    const reasons = group.flatMap(part => part.reasons);
    if (!knownCurrency(code)) reasons.push("currency-unknown");
    if (episode.executions.some(execution => execution.source.historyIncomplete?.length) || episode.accuracy?.reasons.includes("history-incomplete")) reasons.push("history-incomplete");
    if (episode.ipoCostEvidence?.some(chain => !events.some(event => event.id === chain.allocationId) || chain.evidenceIds.some(id => !events.some(event => event.id === id)))) reasons.push("ipo-fees-unavailable");
    const known = group.filter(part => !part.reasons.length).map(part => finite(part.value ?? undefined)).filter((part): part is Decimal => part !== null);
    const precision = exactSumPrecision(known);
    let knownValue: string | null = null;
    if (precision > 1000) reasons.push("fee-precision-unsupported");
    else if (known.length) {
      const Arithmetic = Decimal.clone({ precision });
      knownValue = known.reduce((sum, amount) => sum.plus(amount), new Arithmetic(0)).toString();
    }
    return { currency: code, value: reasons.length ? null : knownValue, knownValue, reasons: unique(reasons), coverage: { known: known.length, total: group.length } };
  });
}

/** Only a bound on the legacy metrics' arithmetic, never a second PnL formula.
 * The existing kernel uses global Decimal precision (normally 20); a larger
 * exact cash/fee span or rounded settlement unit price cannot be certified here. */
function metricsPrecisionSupported(episode: TradeEpisode): boolean {
  const referencePrecision = 1000;
  // Constructors retain all source digits. Check them before any operation:
  // otherwise both the kernel and a finite reference can erase the same tail.
  const inputs = episode.executions.flatMap(execution => [
    execution.quantity, execution.price, execution.fee,
    ...(execution.source.settlement ? [execution.source.settlement.quantity, execution.source.settlement.grossAmount] : []),
  ]).concat((episode.positionEvents ?? []).flatMap(event => [event.amount, event.quantity].filter((value): value is string => value !== undefined))).map(value => new Decimal(value));
  if (inputs.some(value => value.sd() > Math.min(Decimal.precision, referencePrecision / 2))) return false;
  const Arithmetic = Decimal.clone({ precision: referencePrecision });
  const terms: Decimal[] = [];
  for (const execution of episode.executions) {
    const quantity = new Decimal(execution.quantity).abs();
    let price = new Decimal(execution.price);
    const settlement = execution.source.settlement;
    if (settlement) {
      const settlementQuantity = new Decimal(settlement.quantity);
      price = new Decimal(settlement.grossAmount).div(settlementQuantity);
      // Certify the kernel's quotient by an exact, bounded multiplication;
      // another finite division would not establish that it was unrounded.
      if (price.sd() + settlementQuantity.sd() > referencePrecision || !new Arithmetic(price).times(settlementQuantity).eq(settlement.grossAmount)) return false;
    }
    if (quantity.sd() + price.sd() > referencePrecision) return false;
    const value = new Arithmetic(quantity).times(price);
    if (!value.isFinite() || value.isZero() && !quantity.isZero() && !price.isZero() || !value.eq(quantity.times(price))) return false;
    terms.push(value, new Arithmetic(execution.fee));
  }
  for (const event of episode.positionEvents ?? []) {
    if (event.amount !== undefined) terms.push(new Arithmetic(event.amount));
    if (event.quantity !== undefined) terms.push(new Arithmetic(event.quantity));
  }
  return arithmeticWidth(terms) <= Decimal.precision;
}
function evidenceDateReasons(events: Readonly<NonNullable<TradeEpisode["positionEvents"]>>, cutoff: Temporal.Instant): string[] {
  const reasons: string[] = [];
  for (const event of events) {
    try {
      const date = /^\d{4}-\d{2}$/.test(event.date)
        ? validDay(`${event.date}-01`) ? Temporal.PlainDate.from(`${event.date}-01`).add({ months: 1 }).subtract({ days: 1 }).toString() : ""
        : event.date;
      if (!validDay(date) || !knownNativeMarket(event.market)) throw new RangeError("Invalid evidence date or timezone");
      const time = event.kind === "ipo" && event.displayTimePolicy === "session-open" ? "00:00:00.000" : "23:59:59.999";
      if (Temporal.Instant.compare(instant(nativeMarketBoundary(`${date}T${time}Z`, event.market)), cutoff) > 0) reasons.push("future-evidence");
    } catch { reasons.push("invalid-evidence-date"); }
  }
  return unique(reasons);
}
function netFor(episode: TradeEpisode, fees: ClosedEpisodeFees[], evidenceReasons: string[]): ClosedEpisodeAmount {
  const reasons: string[] = [];
  if (episode.executions.some(execution => execution.source.feeStatus === "unknown")) reasons.push("unknown-fees");
  if (episode.executions.some(execution => execution.source.historyIncomplete?.length)) reasons.push("history-incomplete");
  if (episode.executions.some(hasSettlementCurrencyMismatch)) reasons.push("currency-conversion");
  if (episode.executions.some(execution => execution.source.settlement && !hasSettlementCurrencyMismatch(execution) && execution.source.settlement.currency !== execution.instrument.currency)) reasons.push("settlement-currency-alias-unsupported");
  if (episode.accuracy) reasons.push(...(episode.accuracy.reasons.length ? episode.accuracy.reasons : ["accuracy"]));
  if (!knownCurrency(currency(episode.instrument.currency))) reasons.push("currency-unknown");
  if (episode.executions.some(execution => currency(execution.instrument.currency) !== currency(episode.instrument.currency))) reasons.push("currency-conflict");
  if (episode.executions.some(execution => !finite(execution.quantity)?.gt(0) || !finite(execution.price) || finite(execution.price)!.lt(0))) reasons.push("invalid-financial-input");
  if ((episode.positionEvents ?? []).some(event => event.amount !== undefined && !finite(event.amount) || event.quantity !== undefined && !finite(event.quantity))) reasons.push("invalid-financial-input");
  reasons.push(...fees.flatMap(fee => fee.reasons));
  reasons.push(...evidenceReasons);
  if (reasons.length) return { value: null, reasons: unique(reasons) };
  try {
    if (!metricsPrecisionSupported(episode)) return { value: null, reasons: ["metrics-precision-unsupported"] };
    const metrics = summarizeTradeEpisode(episode);
    if (metrics.pnlAvailable === false) return { value: null, reasons: ["pnl-unavailable"] };
    const value = finite(metrics.netPnl ?? undefined);
    return value ? { value: value.toString(), reasons: [] } : { value: null, reasons: [metrics.netPnl === null ? "missing-pnl" : "invalid-pnl"] };
  } catch { return { value: null, reasons: ["metrics-unavailable"] }; }
}

/** Background-only projection. No DB, network, release mutation, or history GET
 * integration. Consumers must publish these results atomically with their own
 * source watermark; the pure projection itself is not a published history API. */
export function buildClosedEpisodeResults(episodes: readonly TradeEpisode[], options: ClosedEpisodeResultOptions): ClosedEpisodeResults {
  const zone = options.businessTimeZone ?? "Asia/Shanghai";
  Temporal.Instant.from("2000-01-01T00:00:00Z").toZonedDateTimeISO(zone);
  const cutoff = options.asOf.length === 10
    ? validDay(options.asOf) ? Temporal.PlainDate.from(options.asOf).add({ days: 1 }).toZonedDateTime(zone).toInstant().subtract({ nanoseconds: 1 }) : (() => { throw new RangeError("Invalid asOf day"); })()
    : instant(options.asOf);
  const result: ClosedEpisodeResults = {
    asOf: options.asOf, cutoff: cutoff.toString(), businessDate: dayAt(cutoff, zone), businessTimeZone: zone,
    rows: [], excluded: [], coverage: { input: episodes.length, included: 0, excluded: 0, netKnown: 0, feesKnown: 0 },
  };
  for (const episode of episodes) {
    const nature = resolvedEpisodeTradeNatureOf(episode);
    const reasons: ClosedEpisodeExclusionReason[] = [];
    if (nature !== "live") reasons.push(nature === "simulation" ? "simulation" : "trade-nature-unknown");
    if (episode.status !== "closed") reasons.push("open");
    let closeAt: Temporal.Instant | undefined;
    let close: TradeExecution | undefined;
    if (episode.status === "closed") {
      if (!episode.endedAt) reasons.push("missing-ended-at");
      else try {
        // A snapshot or corporate event can close the legacy accumulator. Such
        // status alone does not prove an actual fully executed exit.
        const end = episode.endedAt.length === 10 ? validDay(episode.endedAt) ? null : (() => { throw new RangeError("Invalid close date"); })() : instant(episode.endedAt);
        const closingSide = episode.direction === "long" ? "sell" : "buy";
        close = [...episode.executions].reverse().find(execution => execution.side === closingSide && (execution.executedAt === episode.endedAt || end !== null && execution.executedAt.length !== 10 && Temporal.Instant.compare(instant(execution.executedAt), end) === 0));
        if (!close || !finite(episode.remainingQuantity)?.isZero() || episode.executions.some(execution => !finite(execution.quantity)?.gt(0)) || !closureQuantityPrecisionSupported(episode) || episode.directionKnown === false || episode.accuracy?.reasons.some(reason => ["position-gap", "ambiguous-event-order", "ambiguous-opening"].includes(reason))) reasons.push("closure-unconfirmed");
        if (close) {
          closeAt = executionAt(close);
          const startExecution = episode.executions.find(execution => execution.executedAt === episode.startedAt);
          const start = startExecution ? executionAt(startExecution) : instant(episode.startedAt);
          if (Temporal.Instant.compare(start, closeAt) > 0 || episode.executions.some(execution => Temporal.Instant.compare(executionAt(execution), closeAt!) > 0)) reasons.push("closure-unconfirmed");
          if (Temporal.Instant.compare(closeAt, cutoff) > 0 || dayAt(closeAt, zone) > result.businessDate) reasons.push("future-close");
        }
      } catch { reasons.push("invalid-time"); }
    }
    if (reasons.length || !closeAt || !close || !episode.endedAt) {
      result.excluded.push({ id: episode.id, accountId: episode.accountId, instrumentId: episode.instrument.id, tradeNature: nature, startedAt: episode.startedAt, endedAt: episode.endedAt ?? null, executionIds: episode.executions.map(execution => execution.id), reasons: [...new Set(reasons)] });
      continue;
    }
    const evidenceReasons = evidenceDateReasons(episode.positionEvents ?? [], cutoff);
    const fees = feesFor(episode, cutoff);
    const net = netFor(episode, fees, evidenceReasons);
    result.rows.push({
      id: episode.id, accountId: episode.accountId, accountLabel: episode.accountLabel,
      instrument: { ...episode.instrument, ...(episode.instrument.localizedName ? { localizedName: { ...episode.instrument.localizedName } } : {}) },
      tradeNature: "live", direction: episode.direction, directionKnown: episode.directionKnown !== false,
      startedAt: episode.startedAt, endedAt: episode.endedAt, closeKnownAt: closeAt.toString(), closeTimePrecision: close.source.timePrecision === "date-only" || close.executedAt.length === 10 ? "date-only" : "second",
      businessDate: dayAt(closeAt, zone), businessTimeZone: zone, currency: currency(episode.instrument.currency), net, fees,
      executionIds: episode.executions.map(execution => execution.id), contributionCategory: null,
      provenance: { declaredTradeNature: episode.tradeNature ?? null, positionEventIds: (episode.positionEvents ?? []).map(event => event.id), ipoCostEvidence: (episode.ipoCostEvidence ?? []).map(chain => ({ allocationId: chain.allocationId, evidenceIds: [...chain.evidenceIds] })), accuracyReasons: [...(episode.accuracy?.reasons ?? [])], warnings: (episode.warnings ?? []).map(warning => ({ ...warning })) },
    });
  }
  result.coverage.included = result.rows.length;
  result.coverage.excluded = result.excluded.length;
  result.coverage.netKnown = result.rows.filter(row => row.net.value !== null).length;
  result.coverage.feesKnown = result.rows.filter(row => row.fees.length && row.fees.every(fee => fee.value !== null)).length;
  return result;
}
