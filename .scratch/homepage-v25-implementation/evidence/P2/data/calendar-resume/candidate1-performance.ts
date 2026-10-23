import Decimal from "decimal.js";
import { tradeNatureOf, type Instrument, type TradeExecution, type TradeNature } from "../trades/types";
import type { TradeLibraryEntry } from "../trades/library";
import type { DailyCandleRecord, SupportedMarket } from "../market/contracts";
import type { RoomFxSnapshot, TradingRoomMetadataInput } from "./trading-room-scope";
import { replayPositionAtPrice, preparePositionLedger, replayPreparedPositionBoundaries, type PreparedPositionLedger, type PositionLedgerSnapshot } from "../replay/position-ledger";
import { isExecutionBackedIpoAllocation, replayExecutionAt, statementEventAt, statementPositionAt } from "../import/statement-evidence";
import type { StatementEvent } from "../import/monthly-statement";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";
import { canonicalInstrumentId } from "../instruments/display-name";
import { CalendarOutOfRangeError, expectedTradingDates } from "../market/calendar";
import { requiredMarketDataRange } from "../market/sync-range";
import { sha256 } from "../recall/retained-digest";

export type HomepageV25Period = { start: string; end: string };
export type HomepageV25Scope = { nature: "live" | "simulation"; simulationRunId?: string; accountIds?: readonly string[]; markets?: readonly string[] };
export type HomepageV25OpeningPosition = { accountId: string; instrumentId: string; direction: "long" | "short"; quantity: string; unitCost: string; currency: string };
export type HomepageV25Valuation = {
  date: string; accountId: string; instrumentId: string; quantity: string; price: string | null; currency: string;
  kind: "period-start" | "period-end" | "current";
  /** Legacy field. Conversion requires a complete, source-backed fxSnapshot. */
  fxRateToTarget?: string;
  reason?: string;
};
export type HomepageV25Input = {
  period: HomepageV25Period; executions: readonly TradeExecution[]; openingPositions: readonly HomepageV25OpeningPosition[];
  valuations: readonly HomepageV25Valuation[]; targetCurrency?: string; entries?: readonly TradeLibraryEntry[];
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  fxSnapshot?: RoomFxSnapshot;
  /** Required at runtime. Optional only to classify older callers without throwing. */
  asOf?: string;
  scope?: HomepageV25Scope;
  instrumentMetadata?: TradingRoomMetadataInput;
};
export type HomepageV25EntriesInput = Omit<HomepageV25Input, "executions" | "openingPositions" | "valuations" | "entries" | "asOf"> & { entries: readonly TradeLibraryEntry[]; asOf: string };
export type HomepageV25Money = {
  originalByCurrency: Readonly<Record<string, string>>;
  targetCurrency: string | null;
  conversion: "same-currency" | "complete" | "partial" | "missing";
  fx: Pick<RoomFxSnapshot, "id" | "source" | "asOf" | "status"> | null;
};
export type HomepageV25Metric = { value: string | null; available: boolean; coverage: { total: number; available: number }; reasons: string[]; money: HomepageV25Money };
type Identity = { accountId: string; instrumentId: string; nature: TradeNature | "caller-scoped"; simulationRunId: string | null };
type SnapshotEvidence = { knowledgeCursor: string; executionIds: string[]; quantity: string | null; costKnown: boolean; feesKnown: boolean; openFees: string | null; reasons: string[]; quote: { date: string; price: string | null; currency: string; source: string } | null };
export type HomepageV25InstrumentResult = {
  key: string; identity: Identity; periodRealized: HomepageV25Metric; openingUnrealized: HomepageV25Metric;
  closingUnrealized: HomepageV25Metric; net: HomepageV25Metric;
  currentMarketValue: HomepageV25Metric; currentUnrealized: HomepageV25Metric; currentOpenFees: HomepageV25Metric;
  evidence: { executionIds: string[]; opening: SnapshotEvidence; closing: SnapshotEvidence; current: SnapshotEvidence };
};
export type HomepageV25Performance = {
  periodRealized: HomepageV25Metric; openingUnrealized: HomepageV25Metric; closingUnrealized: HomepageV25Metric; net: HomepageV25Metric;
  currentMarketValue: HomepageV25Metric; instruments: HomepageV25InstrumentResult[]; reasons: string[];
  /** Independent asOf projection: net unrealized and fees retained by open exposure, not cumulative fees. */
  currentUnrealized: HomepageV25Metric; currentOpenFees: HomepageV25Metric;
  boundary: { businessTimezone: "Asia/Shanghai"; asOf: string | null; effectiveEnd: string | null; periodStart: string; requestedEnd: string };
  scope: { nature: "live" | "simulation" | "caller-scoped"; simulationRunId: string | null; includedExecutions: number; excludedExecutions: number; excludedByReason: Readonly<Record<string, number>> };
};

type Boundary = { day: string; cursor: string; instant?: number };
type Quote = { date: string; price: string | null; currency: string; source: string; quantity?: string; reason?: string };
type QuoteSelection = { quote: Quote | null; reason?: string };
type Group = { key: string; identity: Identity; instrument: Instrument; executions: TradeExecution[]; valuations: HomepageV25Valuation[]; seeds: HomepageV25OpeningPosition[]; conflicts: Set<string>; inventoryConflict: boolean };
type State = { boundary: Boundary; ledger: PositionLedgerSnapshot; quantity: Decimal | null; grossRealized: Decimal | null; openFees: Decimal | null; netRealized: Decimal | null; pnlReasons: string[]; quantityReasons: string[]; executions: TradeExecution[] };
type Amount = { currency: string; value: Decimal | null; reasons: string[]; eligible: boolean };
const D = (value: string | null | undefined): Decimal | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try { const d = new Decimal(value); return d.isFinite() ? d : null; } catch { return null; }
};
const text = (value: Decimal) => value.isZero() ? "0" : value.toDecimalPlaces(8).toString();
const unique = (items: Iterable<string>) => [...new Set(items)];
const currency = (value: string) => value.trim().toUpperCase();
const shanghai = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
// A business date bounds precise and attached knowledge in Shanghai. Source
// date-only fills retain their day-granular selection through visible IDs.
const dayBoundary = (day: string): Boundary => ({ day, cursor: `${day}T15:59:59.999Z` });
// Keep the canonical month-only knowledge rule even if a display hint exists.
const eventAt = (event: StatementEvent) => statementEventAt(event.date.length === 7 ? { ...event, displayTimePolicy: undefined } : event);
function parseAsOf(value: string | undefined): Boundary | null {
  if (!value) return null;
  if (validDay(value)) return dayBoundary(value);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return { day: shanghai.format(new Date(value)), cursor: new Date(value).toISOString(), instant: Date.parse(value) };
}
function executionDay(execution: TradeExecution): string | null {
  try {
    if (execution.source.timePrecision === "date-only" || execution.executedAt.length === 10) return replayExecutionAt(execution).slice(0, 10);
    return Number.isFinite(Date.parse(execution.executedAt)) ? shanghai.format(new Date(execution.executedAt)) : null;
  } catch { return null; }
}
function visible(execution: TradeExecution, boundary: Boundary): boolean {
  const day = executionDay(execution);
  if (!day) return false;
  if (day > boundary.day) return false;
  if (boundary.instant === undefined) return true;
  const at = execution.source.timePrecision === "date-only" || execution.executedAt.length === 10 ? replayExecutionAt(execution) : execution.executedAt;
  return Date.parse(at) <= boundary.instant;
}
function normalizedExecution(execution: TradeExecution): { execution: TradeExecution; pnl: string[]; quantity: string[] } {
  const pnl: string[] = [], quantity: string[] = [];
  const size = D(execution.quantity), price = D(execution.price), fee = D(execution.fee);
  if (!size || size.lte(0)) quantity.push("quantity-invalid");
  if (!price || price.lt(0)) pnl.push("execution-price-invalid");
  if (!fee || fee.lt(0)) pnl.push("fees-invalid");
  let settlement = execution.source.settlement;
  const normalizedFee = fee && fee.gte(0) ? fee : new Decimal(0);
  if (settlement) {
    const sq = D(settlement.quantity), gross = D(settlement.grossAmount), fees = Object.values(settlement.fees).map(D);
    if (!sq || sq.lte(0) || !gross || gross.lt(0)) { pnl.push("settlement-value-invalid"); settlement = undefined; }
    else if (fees.some(value => !value || value.lt(0))) { pnl.push("fees-invalid"); settlement = undefined; }
    else {
      const settlementFee = fees.reduce<Decimal>((sum, value) => sum.plus(value!), new Decimal(0));
      if (fee && !fee.eq(settlementFee)) pnl.push("fees-conflict");
    }
  }
  // Invalid values never reach Decimal in the canonical ledger. The explicit
  // evidence gates below retain the failure while allowing known quantity.
  return { execution: { ...execution, quantity: size?.gt(0) ? size.toString() : "0", price: price?.gte(0) ? price.toString() : "0", fee: normalizedFee.toString(), source: { ...execution.source, settlement } }, pnl, quantity };
}
function collect(input: HomepageV25Input): { groups: Group[]; scope: HomepageV25Performance["scope"] } {
  const real = input.entries !== undefined;
  const requested = input.scope ?? { nature: "live" as const };
  const scope: HomepageV25Performance["scope"] = { nature: real ? requested.nature : "caller-scoped", simulationRunId: requested.simulationRunId ?? null, includedExecutions: 0, excludedExecutions: 0, excludedByReason: {} };
  const excluded = scope.excludedByReason as Record<string, number>;
  const groups = new Map<string, Group>();
  const groupFor = (accountId: string, instrument: Instrument, nature: Identity["nature"], run: string | null) => {
    const key = `${accountId}|${instrument.id}${real ? `|${nature}|${run ?? ""}` : ""}`;
    let group = groups.get(key);
    if (!group) { group = { key, identity: { accountId, instrumentId: instrument.id, nature, simulationRunId: run }, instrument, executions: [], valuations: [], seeds: [], conflicts: new Set(), inventoryConflict: false }; groups.set(key, group); }
    return group;
  };
  const raw = real ? input.entries!.flatMap(entry => entry.executions ?? []) : [...input.executions];
  const seen = new Map<string, TradeExecution>();
  for (const execution of raw) {
    const nature = tradeNatureOf(execution), run = execution.source.simulationRunId ?? null;
    const reject = real && (nature !== requested.nature ? `nature:${nature}` : requested.nature === "simulation" && (!requested.simulationRunId || run !== requested.simulationRunId) ? "simulation-run" : requested.accountIds && !requested.accountIds.includes(execution.accountId) ? "account" : requested.markets && !requested.markets.includes(execution.instrument.market) ? "market" : null);
    if (reject) { scope.excludedExecutions++; excluded[reject] = (excluded[reject] ?? 0) + 1; continue; }
    const group = groupFor(execution.accountId, execution.instrument, real ? nature : "caller-scoped", real ? run : null);
    const identity = `${group.key}|${execution.id}`;
    const prior = seen.get(identity);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(execution)) {
        group.conflicts.add("duplicate-execution-conflict");
        const inventory = (e: TradeExecution) => JSON.stringify([D(e.quantity)?.toString() ?? e.quantity, e.side, e.executedAt, e.instrument.symbol, e.instrument.market, e.source.timePrecision, e.source.tradingDate, e.source.marketCalendarDate, e.source.positionEffect]);
        if (inventory(prior) !== inventory(execution)) group.inventoryConflict = true;
      }
      continue;
    }
    seen.set(identity, execution); group.executions.push(execution); scope.includedExecutions++;
    if (currency(group.instrument.currency) !== currency(execution.instrument.currency)) group.conflicts.add("currency-conflict");
  }
  if (real) {
    // entry.executions is the original fill lineage. Episode parts can retain
    // the whole settlement, so they must never be flattened as fresh fills.
    for (const entry of input.entries!) for (const item of entry.episodes) {
      const episode = item.episode;
      const nature = episode.tradeNature ?? (episode.executions[0] ? tradeNatureOf(episode.executions[0]) : "unknown");
      const run = episode.simulationRunId ?? null;
      if (nature !== requested.nature || requested.nature === "simulation" && run !== requested.simulationRunId || requested.accountIds && !requested.accountIds.includes(episode.accountId) || requested.markets && !requested.markets.includes(episode.instrument.market)) continue;
      const group = groupFor(episode.accountId, episode.instrument, nature, run);
      if (!entry.executions?.length) { group.conflicts.add("execution-lineage-unavailable"); continue; }
      if (!group?.executions.length) continue;
      const carrier = group.executions[0];
      const events = [...(episode.positionEvents ?? []), ...episode.executions.flatMap(e => e.source.positionEvents ?? [])];
      const positions = [...(episode.initialPosition ? [episode.initialPosition] : []), ...episode.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])];
      group.executions[0] = { ...carrier, source: { ...carrier.source, positionEvents: [...(carrier.source.positionEvents ?? []), ...events], statementPositions: [...(carrier.source.statementPositions ?? []), ...positions] } };
    }
  } else {
    const instrumentFor = (id: string, code: string): Instrument => ({ id, symbol: id.split(":").at(-1) ?? id, market: id.split(":")[0], name: id, currency: code });
    for (const p of input.openingPositions) groupFor(p.accountId, instrumentFor(p.instrumentId, p.currency), "caller-scoped", null).seeds.push(p);
    for (const v of input.valuations) groupFor(v.accountId, instrumentFor(v.instrumentId, v.currency), "caller-scoped", null).valuations.push(v);
  }
  return { groups: [...groups.values()], scope };
}
function seedExecutions(group: Group, start: string): TradeExecution[] {
  return group.seeds.map((position, index) => ({ id: `homepage-boundary:${index}`, accountId: position.accountId, accountLabel: position.accountId, instrument: { ...group.instrument, currency: position.currency }, side: position.direction === "long" ? "buy" : "sell", quantity: position.quantity, price: position.unitCost, fee: "0", executedAt: `${previousDay(start)}T00:00:00Z`, source: { platform: "homepage-boundary", row: index, positionEffect: position.direction === "long" ? "open-long" : "open-short" } }));
}
function replay(group: Group, boundary: Boundary, start: string, prepared?: PreparedKernel): State {
  const originals = [...seedExecutions(group, start), ...group.executions];
  const selected = originals.filter(e => visible(e, boundary)).sort((a, b) => replayExecutionAt(a).localeCompare(replayExecutionAt(b)) || (a.source.sourceOrder ?? a.source.row) - (b.source.sourceOrder ?? b.source.row) || a.id.localeCompare(b.id));
  const pnl = new Set<string>(group.conflicts), quantityReasons = new Set<string>([...group.conflicts].filter(reason => reason === "execution-lineage-unavailable"));
  if (group.inventoryConflict) quantityReasons.add("duplicate-execution-conflict");
  if (originals.some(e => executionDay(e) === null)) { pnl.add("execution-time-invalid"); quantityReasons.add("execution-time-invalid"); }
  const normalized = prepared?.normalized.get(group.key) ?? originals.map(normalizedExecution);
  if (prepared && !prepared.normalized.has(group.key)) prepared.normalized.set(group.key, normalized);
  const normalizedById = new Map(normalized.map(e => [e.execution.id, e]));
  for (const e of selected) {
    const errors = normalizedById.get(e.id)!;
    errors.pnl.forEach(reason => pnl.add(reason)); errors.quantity.forEach(reason => quantityReasons.add(reason));
  }
  const safe = normalized.map(e => e.execution);
  const attached = safe.some(e => e.source.positionEvents?.length || e.source.statementPositions?.length || e.source.openingPosition);
  const sourceContext = prepared ? prepared.groupDigests.get(group.key)! : "";
  const snapshot = (ids: string[], cursor: string, executions = safe): PositionLedgerSnapshot => {
    const key = prepared ? `canonical:${sourceContext}:${executions === safe ? "original" : sha256(JSON.stringify(executions))}:${attached ? cursor : "no-attached-knowledge"}:${JSON.stringify(ids)}` : "";
    const cached = prepared?.memo.get<PositionLedgerSnapshot>(key);
    if (cached) { prepared!.counts.canonicalCacheHits++; return cached; }
    try {
      if (prepared) { prepared.counts.canonicalCalls++;  }
      const result = replayPositionAtPrice({ executions, markPrice: "0", cursor, visibleExecutionIds: ids });
      prepared?.memo.set(key, result);
      return result;
    }
    catch (error) {
      // Imported evidence can contain malformed decimal fields. Classify that
      // evidence at this adapter boundary; placeholders never become money.
      if (!(error instanceof Error) || !error.message.includes("DecimalError")) throw error;
      return { quantity: "0", averageCost: "0", realizedPnl: "0", unrealizedPnl: "0", netPnl: "0", fees: "0", grossCapitalDeployed: "0", returnPercent: "0", quantityKnown: false, costKnown: false, accuracy: { pnl: "unavailable", reasons: ["evidence-invalid"] } };
    }
  };
  const actual = selected.map(e => normalizedById.get(e.id)!.execution).filter(e => tradeNatureOf(e) !== "simulation");
  const knownEvents = [...new Map(safe.flatMap(e => e.source.positionEvents ?? []).map(event => [`${event.accountId}:${event.id}`, event])).values()].filter(event => eventAt(event) <= boundary.cursor);
  const allocations = safe.some(e => tradeNatureOf(e) !== "simulation") ? knownEvents.filter(event => event.kind === "ipo" && D(event.quantity)?.gt(0) && event.accountId === group.identity.accountId && event.symbol && event.market && canonicalInstrumentId(event.symbol, event.market) === canonicalInstrumentId(group.instrument.symbol, group.instrument.market) && !isExecutionBackedIpoAllocation(event, actual)) : [];
  // The same selected fills that make canonical skip a repeated allotment
  // must also suppress that allotment in every fee movement prefix.
  const feeExecutions = knownEvents.some(event => isExecutionBackedIpoAllocation(event, actual)) ? safe.map(e => ({ ...e, source: { ...e.source, positionEvents: e.source.positionEvents?.filter(event => !isExecutionBackedIpoAllocation(event, actual)) } })) : safe;
  type Step = { at: string; rank: number; execution?: TradeExecution; allocation?: StatementEvent };
  const steps: Step[] = [
    ...selected.map(e => ({ at: replayExecutionAt(e), rank: 3, execution: normalizedById.get(e.id)!.execution })),
    ...allocations.map(allocation => ({ at: eventAt(allocation), rank: 2, allocation })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank);
  // An IPO may acquire stock before its refund is known. Project only fees,
  // using this boundary's cash knowledge and canonical inventory at each
  // movement prefix. Never reconstruct cost or realized profit here.
  const beforeStep = (ids: string[], step: Step) => {
    if (!allocations.length) return snapshot(ids, step.at > boundary.cursor ? boundary.cursor : step.at, feeExecutions);
    const precedes = (at: string, rank: number) => at < step.at || at === step.at && rank < step.rank;
    const prefix = feeExecutions.map(e => ({ ...e, source: { ...e.source,
      positionEvents: e.source.positionEvents?.filter(event => event.kind === "fee" || event.kind === "ipo" && event.quantity === undefined || precedes(eventAt(event), 2)),
      statementPositions: e.source.statementPositions?.filter(position => precedes(statementPositionAt(position), position.phase === "opening" ? 0 : 4)),
      openingPosition: e.source.openingPosition && precedes(statementPositionAt(e.source.openingPosition), e.source.openingPosition.phase === "opening" ? 0 : 4) ? e.source.openingPosition : undefined,
    } }));
    return snapshot(ids, boundary.cursor, prefix);
  };
  let ids: string[] = [], pool: Decimal | null = new Decimal(0), projectedFees = new Decimal(0);
  const prefix: string[][] = [];
  for (const step of steps) {
    prefix.push([step.execution ? "execution" : "allocation", step.execution?.id ?? step.allocation!.id]);
    // With statement evidence, the exact knowledge cursor and selected fill
    // set are part of the checkpoint: late refunds cannot alter old states.
    const checkpointKey = prepared ? `fee:${sourceContext}:${attached ? JSON.stringify([boundary.cursor, selected.map(e => e.id)]) : "no-attached-knowledge"}:${JSON.stringify(prefix)}` : "";
    const checkpoint = prepared?.memo.get<FeeCheckpoint>(checkpointKey);
    if (checkpoint) {
      pool = checkpoint.pool === null ? null : new Decimal(checkpoint.pool); projectedFees = new Decimal(checkpoint.projectedFees);
      checkpoint.pnl.forEach(reason => pnl.add(reason)); checkpoint.quantity.forEach(reason => quantityReasons.add(reason));
      if (step.execution) ids.push(step.execution.id);
      prepared!.counts.feeCheckpointHits++;
      continue;
    }
    if (prepared) prepared.counts.feeSteps++;
    const before = beforeStep(ids, step);
    if (before.quantityKnown === false) pool = null;
    const beforeQuantity = D(before.quantity)!;
    const e = step.execution;
    const cost = step.allocation ? resolveIpoAcquisitionCost(step.allocation, knownEvents, actual, group.instrument.currency) : undefined;
    const size = D(e?.quantity ?? step.allocation!.quantity)!;
    const fee = e ? D(e.fee)! : cost ? D(cost.feeCost)! : null;
    if (!fee || fee.lt(0)) { pool = null; pnl.add("ipo-fee-allocation-unavailable"); }
    else projectedFees = projectedFees.plus(fee);
    const side = e?.side ?? "buy";
    const closes = (side === "sell" && beforeQuantity.gt(0)) || (side === "buy" && beforeQuantity.lt(0));
    const closed = closes ? Decimal.min(beforeQuantity.abs(), size) : new Decimal(0);
    const opensShort = e?.side === "sell" && size.gt(Decimal.max(beforeQuantity, 0));
    if (opensShort && e?.source.positionEffect !== "open-short") { pnl.add("execution-direction-unavailable"); quantityReasons.add("execution-direction-unavailable"); }
    if (e && ((e.source.positionEffect === "close-long" && (beforeQuantity.lte(0) || size.gt(beforeQuantity))) || (e.source.positionEffect === "close-short" && (beforeQuantity.gte(0) || size.gt(beforeQuantity.abs()))))) {
      pnl.add("position-coverage-missing"); quantityReasons.add("position-coverage-missing");
    }
    if (pool && fee && size.gt(0)) {
      const allocated: Decimal = closed.gt(0) ? pool.mul(closed).div(beforeQuantity.abs()) : new Decimal(0);
      pool = pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));
    }
    if (e) ids = [...ids, e.id];
    prepared?.memo.set(checkpointKey, { pool: pool === null ? null : pool.toString(), projectedFees: projectedFees.toString(), pnl: [...pnl], quantity: [...quantityReasons] } satisfies FeeCheckpoint);
  }
  const ledger = snapshot(ids, boundary.cursor);
  return finishState(boundary, ledger, selected, pnl, quantityReasons, pool, projectedFees);
}
function finishState(boundary: Boundary, ledger: PositionLedgerSnapshot, selected: TradeExecution[], pnl: Set<string>, quantityReasons: Set<string>, pool: Decimal | null, projectedFees: Decimal): State {
  if (text(projectedFees) !== ledger.fees) { pool = null; pnl.add("fee-allocation-unavailable"); }
  ledger.accuracy?.reasons.forEach(reason => pnl.add(reason));
  if (ledger.quantityKnown === false) {
    quantityReasons.add("quantity-unavailable");
    ledger.accuracy?.reasons.forEach(reason => quantityReasons.add(reason));
  }
  if (quantityReasons.size) quantityReasons.forEach(reason => pnl.add(reason));
  const quantity = quantityReasons.size ? null : D(ledger.quantity);
  const grossRealized = pnl.size || ledger.costKnown === false ? null : D(ledger.realizedPnl);
  if ([...pnl].some(reason => reason.includes("fee"))) pool = null;
  return { boundary, ledger, quantity, grossRealized, openFees: pool, netRealized: grossRealized && pool ? grossRealized.minus(D(ledger.fees)!).plus(pool) : null,
    pnlReasons: [...pnl], quantityReasons: [...quantityReasons], executions: selected.filter(e => e.source.platform !== "homepage-boundary") };
}
function quoteFor(input: HomepageV25Input, group: Group, kind: HomepageV25Valuation["kind"], boundary: Boundary, calendar?: BatchMarketCalendar): QuoteSelection {
  if (input.entries !== undefined) {
    const market = group.instrument.market;
    if (market !== "US" && market !== "HK" && market !== "CN-SH" && market !== "CN-SZ") return { quote: null, reason: "quote-market-unsupported" };
    let completed: string;
    try {
      // Shanghai dates bound executions and reporting. Daily raw closes have
      // the exchange's independent knowledge cutoff, including DST/half days.
      completed = calendar ? calendar.completed(market, boundary.cursor) : requiredMarketDataRange(boundary.cursor, boundary.cursor, { market, open: true, now: new Date(boundary.cursor) }).endDate;
    } catch (error) {
      if (!(error instanceof CalendarOutOfRangeError)) throw error;
      return { quote: null, reason: "quote-session-unavailable" };
    }
    const candles = input.candlesByInstrument?.[group.instrument.id] ?? [];
    const candidates = candles.filter(c => c.instrumentId === group.instrument.id && c.adjustmentMode === "raw" && validDay(c.tradingDate) && c.tradingDate <= completed).sort((a, b) => b.tradingDate.localeCompare(a.tradingDate));
    let unconfirmed = false;
    for (const candidate of candidates) {
      try {
        // A stale weekend/holiday raw row can be below the cutoff, so the
        // candidate itself must also belong to the supported calendar.
        if (!(calendar ? calendar.dates(market, candidate.tradingDate, candidate.tradingDate) : expectedTradingDates(market, candidate.tradingDate, candidate.tradingDate)).length) continue;
      } catch (error) {
        if (!(error instanceof CalendarOutOfRangeError)) throw error;
        unconfirmed = true;
        continue;
      }
      return { quote: { date: candidate.tradingDate, price: candidate.close, currency: candidate.currency, source: candidate.provider } };
    }
    return { quote: null, reason: unconfirmed ? "quote-session-unavailable" : "quote-missing" };
  }
  // In the compatibility API an explicit period-start record is a supplied
  // boundary mark, not a first-day candle. Raw-candle callers use entries.
  const quotes = group.valuations.filter(v => v.kind === kind && validDay(v.date) && (v.date <= boundary.day || kind === "period-start" && v.date === input.period.start)).sort((a, b) => b.date.localeCompare(a.date));
  const quote = quotes[0];
  return { quote: quote ? { ...quote, source: "caller-boundary" } : null };
}
function amount(group: Group, state: State, quote: Quote | null, type: "unrealized" | "market", eligible = true, quoteReason?: string): Amount {
  const reasons = new Set(type === "market" ? state.quantityReasons : state.pnlReasons);
  let quantity = state.quantity;
  if (quote?.quantity !== undefined) {
    const supplied = D(quote.quantity);
    if (!supplied) reasons.add("quantity-invalid");
    else if (type === "market") quantity = supplied;
    else if (quantity && !quantity.eq(supplied)) reasons.add("valuation-quantity-mismatch");
  }
  if (!quantity) reasons.add("quantity-unavailable");
  if (quantity?.isZero() && !state.quantityReasons.length && (quote?.quantity === undefined || D(quote.quantity)?.isZero())) return { currency: currency(group.instrument.currency), value: new Decimal(0), reasons: [], eligible };
  if (!quote || !D(quote.price) || D(quote.price)!.lt(0)) reasons.add(quote?.reason ?? quoteReason ?? "quote-missing");
  if (quote && currency(quote.currency) !== currency(group.instrument.currency)) reasons.add("quote-currency-mismatch");
  if (quote?.reason) reasons.add(quote.reason);
  if (type === "unrealized" && (state.ledger.costKnown === false || !state.openFees)) reasons.add("cost-unavailable");
  const price = quote ? D(quote.price) : null;
  const value = reasons.size || !quantity || !price ? null : type === "market" ? price.mul(quantity) : price.minus(D(state.ledger.averageCost)!).mul(quantity).minus(state.openFees!);
  return { currency: currency(group.instrument.currency), value, reasons: [...reasons], eligible };
}
function metric(amounts: Amount[], input: HomepageV25Input, asOf: Boundary | null): HomepageV25Metric {
  const eligible = amounts.filter(a => a.eligible);
  const reasons = new Set(eligible.flatMap(a => a.reasons));
  const original = new Map<string, Decimal>();
  for (const a of eligible) if (a.value !== null) original.set(a.currency, (original.get(a.currency) ?? new Decimal(0)).plus(a.value));
  const target = input.targetCurrency ? currency(input.targetCurrency) : null;
  const snapshot = input.fxSnapshot;
  const provenance = snapshot ? { id: snapshot.id, source: snapshot.source, asOf: snapshot.asOf, status: snapshot.status } : null;
  const money: HomepageV25Money = { originalByCurrency: Object.fromEntries([...original].map(([code, value]) => [code, text(value)])), targetCurrency: target, conversion: "same-currency", fx: provenance };
  const rate = (code: string): Decimal | null => {
    if (code === "CNY") return new Decimal(1);
    for (const key of [`${code}/CNY`, `${code}:CNY`]) { const value = D(snapshot?.rates[key]); if (value?.gt(0)) return value; }
    return null;
  };
  const convert = (a: Amount): Decimal | null => {
    if (a.value === null) return null;
    if (!target || target === a.currency) return a.value;
    if (!snapshot) { reasons.add("fx-missing"); money.conversion = "missing"; return null; }
    if (snapshot.status !== "complete") { reasons.add("fx-incomplete"); money.conversion = "partial"; return null; }
    const fxBoundary = parseAsOf(snapshot.asOf);
    if (!fxBoundary || !asOf || Date.parse(fxBoundary.cursor) > Date.parse(asOf.cursor)) { reasons.add("fx-future"); money.conversion = "partial"; return null; }
    const sourceRate = rate(a.currency), targetRate = rate(target);
    if (!sourceRate || !targetRate) { reasons.add("fx-rate-invalid"); money.conversion = "partial"; return null; }
    if (money.conversion === "same-currency") money.conversion = "complete";
    return a.value.mul(sourceRate).div(targetRate);
  };
  const values = eligible.map(convert);
  if (!target && original.size > 1) reasons.add("target-currency-required");
  const complete = values.every(value => value !== null) && !(original.size > 1 && !target);
  if (!complete && money.conversion !== "missing") money.conversion = "partial";
  const sum = complete ? values.reduce<Decimal>((total, value) => total.plus(value!), new Decimal(0)) : null;
  return { value: sum === null ? null : text(sum), available: sum !== null, coverage: { total: eligible.length, available: values.filter(value => value !== null).length }, reasons: [...reasons], money };
}
function evidence(state: State, quote: Quote | null, quoteReason?: string): SnapshotEvidence {
  // Fee-only adapter failures do not erase cost already proved by canonical
  // inventory. Canonical unknown-cost and non-fee ambiguities remain gates.
  const costKnown = state.quantity !== null && state.ledger.costKnown !== false && state.pnlReasons.every(reason => reason.startsWith("fees-") || reason === "fee-allocation-unavailable" || reason === "ipo-fee-allocation-unavailable");
  return { knowledgeCursor: state.boundary.cursor, executionIds: state.executions.map(e => e.id), quantity: state.quantity === null ? null : text(state.quantity), costKnown, feesKnown: state.openFees !== null, openFees: state.openFees === null ? null : text(state.openFees), reasons: unique([...state.pnlReasons, ...state.quantityReasons, ...(quoteReason ? [quoteReason] : [])]), quote: quote ? { date: quote.date, price: quote.price, currency: quote.currency, source: quote.source } : null };
}
/** Preferred production API: explicit current cutoff, original library fills and live scope by default. */
export function buildHomepageV25PerformanceFromEntries(input: HomepageV25EntriesInput): HomepageV25Performance {
  return buildHomepageV25Performance({ ...input, executions: [], openingPositions: [], valuations: [] });
}
/** Pure compatibility input is caller-scoped; real entries are always scope-checked here. */
export function buildHomepageV25Performance(input: HomepageV25Input): HomepageV25Performance {
  const asOf = parseAsOf(input.asOf);
  const validPeriod = validDay(input.period.start) && validDay(input.period.end) && input.period.start <= input.period.end;
  const effectiveEnd = asOf && validPeriod ? (input.period.end < asOf.day ? input.period.end : asOf.day) : null;
  const boundary: HomepageV25Performance["boundary"] = { businessTimezone: "Asia/Shanghai", asOf: asOf ? input.asOf! : null, effectiveEnd, periodStart: input.period.start, requestedEnd: input.period.end };
  const collected = collect(input);
  const invalid = !asOf ? input.asOf ? "as-of-invalid" : "as-of-required" : !validPeriod ? "period-invalid" : input.scope?.nature === "simulation" && !input.scope.simulationRunId ? "simulation-run-required" : null;
  if (invalid) {
    const failed = metric([{ currency: input.targetCurrency ?? "", value: null, reasons: [invalid], eligible: true }], input, asOf);
    return { boundary, scope: collected.scope, periodRealized: failed, openingUnrealized: failed, closingUnrealized: failed, net: failed, currentMarketValue: failed, currentUnrealized: failed, currentOpenFees: failed, instruments: [], reasons: [invalid] };
  }
  const periodNotStarted = input.period.start > effectiveEnd!;
  const startBoundary = periodNotStarted ? asOf! : dayBoundary(previousDay(input.period.start));
  const endBoundary = effectiveEnd === asOf!.day ? asOf! : dayBoundary(effectiveEnd!);
  const realizedAmounts: Amount[] = [], openingAmounts: Amount[] = [], closingAmounts: Amount[] = [], netAmounts: Amount[] = [], currentAmounts: Amount[] = [];
  const currentUnrealizedAmounts: Amount[] = [], currentOpenFeeAmounts: Amount[] = [];
  const instruments: HomepageV25InstrumentResult[] = [];
  for (const group of collected.groups) {
    const states = new Map<string, State>();
    const atBoundary = (b: Boundary) => {
      const key = `${b.day}|${b.cursor}|${b.instant ?? "day"}`;
      let state = states.get(key);
      if (!state) { state = replay(group, b, input.period.start); states.set(key, state); }
      return state;
    };
    const start = atBoundary(startBoundary), end = atBoundary(endBoundary), current = atBoundary(asOf!);
    const { quote: startQuote, reason: startQuoteReason } = quoteFor(input, group, "period-start", startBoundary);
    const { quote: endQuote, reason: endQuoteReason } = quoteFor(input, group, "period-end", endBoundary);
    const { quote: currentQuote, reason: currentQuoteReason } = quoteFor(input, group, "current", asOf!);
    const code = currency(group.instrument.currency);
    const eligible = start.executions.length > 0 || end.executions.length > 0 || group.seeds.length > 0 || group.valuations.some(v => v.kind !== "current") || start.quantity === null || end.quantity === null || Boolean(start.quantity?.gt(0) || end.quantity?.abs().gt(0));
    const realized: Amount = { currency: code, value: start.netRealized !== null && end.netRealized !== null ? end.netRealized.minus(start.netRealized) : null, reasons: unique([...start.pnlReasons, ...end.pnlReasons]), eligible };
    const opening = amount(group, start, startQuote, "unrealized", eligible, startQuoteReason), closing = amount(group, end, endQuote, "unrealized", eligible, endQuoteReason);
    const net: Amount = { currency: code, value: realized.value !== null && opening.value !== null && closing.value !== null ? realized.value.plus(closing.value).minus(opening.value) : null, reasons: unique([...realized.reasons, ...opening.reasons, ...closing.reasons]), eligible };
    if (input.period.start > effectiveEnd!) { for (const a of [realized, opening, closing, net]) { a.value = null; a.eligible = true; a.reasons = ["period-not-started"]; } }
    const missingCurrentEvidence = input.entries === undefined && !currentQuote && group.valuations.some(v => v.kind === "period-end" && v.date <= asOf!.day && (!D(v.quantity) || !D(v.quantity)!.isZero()));
    const currentEligible = missingCurrentEvidence || current.quantity === null || !current.quantity.isZero() || Boolean(currentQuote?.quantity !== undefined && (!D(currentQuote.quantity) || !D(currentQuote.quantity)!.isZero()));
    const currentAmount = amount(group, current, currentQuote, "market", currentEligible, currentQuoteReason);
    const currentUnrealized = amount(group, current, currentQuote, "unrealized", currentEligible, currentQuoteReason);
    const currentOpenFees: Amount = { currency: code, value: current.quantity === null ? null : current.openFees, eligible: currentEligible,
      reasons: unique([...current.quantityReasons, ...(current.openFees === null ? [...current.pnlReasons.filter(reason => reason.includes("fee")), "fee-allocation-unavailable"] : [])]) };
    if (missingCurrentEvidence) { for (const a of [currentAmount, currentUnrealized]) { a.value = null; a.reasons = unique([...a.reasons, "quote-missing"]); } }
    realizedAmounts.push(realized); openingAmounts.push(opening); closingAmounts.push(closing); netAmounts.push(net); currentAmounts.push(currentAmount);
    currentUnrealizedAmounts.push(currentUnrealized); currentOpenFeeAmounts.push(currentOpenFees);
    instruments.push({ key: group.key, identity: group.identity, periodRealized: metric([realized], input, asOf), openingUnrealized: metric([opening], input, asOf), closingUnrealized: metric([closing], input, asOf), net: metric([net], input, asOf), currentMarketValue: metric([currentAmount], input, asOf), currentUnrealized: metric([currentUnrealized], input, asOf), currentOpenFees: metric([currentOpenFees], input, asOf), evidence: { executionIds: current.executions.map(e => e.id), opening: evidence(start, startQuote, startQuoteReason), closing: evidence(end, endQuote, endQuoteReason), current: evidence(current, currentQuote, currentQuoteReason) } });
  }
  // An empty input still has a meaningful time boundary. No source rows must
  // not turn a future reporting period into an available zero.
  if (periodNotStarted && collected.groups.length === 0) {
    for (const amounts of [realizedAmounts, openingAmounts, closingAmounts, netAmounts]) amounts.push({ currency: input.targetCurrency ?? "", value: null, reasons: ["period-not-started"], eligible: true });
  }
  const result = { boundary, scope: collected.scope, periodRealized: metric(realizedAmounts, input, asOf), openingUnrealized: metric(openingAmounts, input, asOf), closingUnrealized: metric(closingAmounts, input, asOf), net: metric(netAmounts, input, asOf), currentMarketValue: metric(currentAmounts, input, asOf), currentUnrealized: metric(currentUnrealizedAmounts, input, asOf), currentOpenFees: metric(currentOpenFeeAmounts, input, asOf), instruments };
  return { ...result, reasons: unique([result.periodRealized, result.openingUnrealized, result.closingUnrealized, result.net, result.currentMarketValue, result.currentUnrealized, result.currentOpenFees].flatMap(m => m.reasons)) };
}

// P2 prepared projection is additive. The F3 wrappers above keep their policy.
export type SourceRevisions = Readonly<{ trades: string; metadata: string; quotes: string; fx: string }>;
export type HistoricalFxObservation = Readonly<{ id: string; source: string; sourceRevision: string; businessDate: string; rates: Readonly<Record<string, string>>; status: "complete" | "partial" | "missing"; publishedAtByPair: Readonly<Record<string, string>>; knownAtByPair: Readonly<Record<string, string>>; fetchedAt: string; evidenceIds: readonly string[] }>;
export type CurrentFxEvidence = Readonly<{ snapshot: RoomFxSnapshot; fetchedAt: string | null; publishedAtByPair: Readonly<Record<string, string>>; sourceRevision: string; evidenceIds: readonly string[] }>;
export type LifetimeSourceCoverage = Readonly<{ accountId: string; instrumentId: string; nature: TradeNature; simulationRunId: string | null; state: "complete" | "partial" | "unknown"; coversInception: boolean; through: string | null; knownAt: string | null; evidenceIds: readonly string[]; reasons: readonly string[] }>;
export type HomepageV25FeeFact = Readonly<{
  factId: string; accountId: string; instrumentId: string | null; nature: TradeNature; simulationRunId: string | null;
  kind: "execution-fee" | "statement-fee"; currency: string | null; expense: string | null;
  incurred: { businessDate: string | null; at: string | null; precision: "instant" | "day" | "month" | "unknown" };
  knowledge: { amountKnownAt: string | null; attributionKnownAt: string | null; availableAt: string | null; evidenceIds: readonly string[] };
  lineage: { executionIds: readonly string[]; eventIds: readonly string[]; sourceRows: readonly string[] };
  coverage: "complete" | "unknown"; reasons: readonly string[];
}>;
export type EndpointMetrics = Readonly<{ periodRealized: HomepageV25Metric; openingUnrealized: HomepageV25Metric; closingUnrealized: HomepageV25Metric; unrealizedChange: HomepageV25Metric; net: HomepageV25Metric; lifetimeRealizedNet: HomepageV25Metric; lifetimeNet: HomepageV25Metric; marketValue: HomepageV25Metric; unrealizedNet: HomepageV25Metric; openFees: HomepageV25Metric; periodFees: HomepageV25Metric }>;
export type QuoteCoverage = Readonly<{ state: "complete" | "market-closed-carry" | "session-in-progress-carry" | "missing-completed-session" | "quote-missing" | "quote-invalid" | "unsupported-market" | "calendar-unavailable"; requiredCompletedSession: string | null; selectedDate: string | null; missingSessions: readonly string[]; reasons: readonly string[] }>;
export type FxCoverage = Readonly<{ state: "not-required" | "complete" | "partial" | "missing"; businessDate: string; observationIds: readonly string[]; requiredPairs: readonly string[]; pairKnowledge: Readonly<Record<string, { publishedAt: string; knownAt: string; fetchedAt: string; source: string }>>; reasons: readonly string[] }>;
export type BoundaryInstrument = EndpointMetrics & Readonly<{ key: string; identity: Identity; evidence: { opening: SnapshotEvidence; endpoint: SnapshotEvidence }; quoteCoverage: { opening: QuoteCoverage; endpoint: QuoteCoverage }; fxCoverage: FxCoverage; feeFactIds: readonly string[]; canonicalKnownFees: HomepageV25Metric; lifetimeCoverage: LifetimeSourceCoverage }>;
export type HomepageV25BoundaryPoint = EndpointMetrics & Readonly<{ key: string; requestedAt: string; businessDate: string; effectiveCursor: string | null; boundaryPrecision: "day" | "instant"; state: "value" | "source-missing" | "future"; plottable: boolean; instruments: readonly BoundaryInstrument[]; quoteCoverage: Readonly<Record<string, { opening: QuoteCoverage; endpoint: QuoteCoverage }>>; fxCoverage: FxCoverage; lifetimeCoverage: readonly LifetimeSourceCoverage[]; reasons: readonly string[] }>;
export type CurrentInstrument = Readonly<Pick<HomepageV25InstrumentResult, "key" | "identity" | "currentMarketValue" | "currentUnrealized" | "currentOpenFees">> & Readonly<{ evidence: { current: SnapshotEvidence } }>;
export type CurrentProjection = Readonly<Pick<HomepageV25Performance, "currentMarketValue" | "currentUnrealized" | "currentOpenFees">> & Readonly<{ asOf: string; instruments: readonly CurrentInstrument[]; quoteCoverage: Readonly<Record<string, QuoteCoverage>>; fxCoverage: FxCoverage }>;
const projectionPolicies = Object.freeze({ finance: "F3-2026-10-23", feePool: "F3-canonical-prefix", feeFacts: "P2-incurred-knowledge-1", calendar: "exchange-2010-2030-F3", dailyCoverage: "P2-strict-completed-1", fx: "P2-historical-pair-knowledge-1", quoteKnowledgeMode: "retrospective-completed-session" as const });
type ProjectionVersions = Readonly<{ sourceId: string; revisions: SourceRevisions; policies: typeof projectionPolicies; scope: HomepageV25Performance["scope"] }>;
type ProjectionDiagnostics = { canonicalSweeps: number; canonicalTransitions: number; batchCacheHits: number; canonicalCalls: number; distinctCanonicalContexts: number; canonicalCacheHits: number; feeSteps: number; feeCheckpointHits: number; quoteLookups: number; fxLookups: number; cacheEntries: number; cacheEstimatedBytes: number; evictions: number };
export type HomepageV25BoundaryBatch = ProjectionVersions & Readonly<{ asOf: string; periodStart: string; points: readonly HomepageV25BoundaryPoint[]; current: CurrentProjection; feeFacts: readonly HomepageV25FeeFact[]; diagnostics: ProjectionDiagnostics }>;
const preparedSourceBrand: unique symbol = Symbol("homepage-v25-prepared");
export type HomepageV25PreparedSource = Readonly<{ sourceId: string; revisions: SourceRevisions; [preparedSourceBrand]: true }>;
export type HomepageV25PrepareInput = {
  entries: readonly TradeLibraryEntry[]; scope?: HomepageV25Scope; instrumentMetadata?: TradingRoomMetadataInput;
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  fxObservations: readonly HistoricalFxObservation[]; currentFxSnapshot: CurrentFxEvidence | null;
  lifetimeSourceCoverage: readonly LifetimeSourceCoverage[]; revisions: SourceRevisions;
};
export type HomepageV25BoundaryInput = { periodStart: string; asOf: string; endpoints: readonly { key: string; at: string }[]; targetCurrency?: string };
export class HomepageV25ProjectionInputError extends Error {
  constructor(readonly code: string) { super(code); this.name = "HomepageV25ProjectionInputError"; }
}
type FeeCheckpoint = { pool: string | null; projectedFees: string; pnl: string[]; quantity: string[] };
class ProjectionMemo {
  private values = new Map<string, { value: unknown; bytes: number }>();
  private retained = new Map<object, { references: number; bytes: number; children: object[] }>();
  private permanent = new WeakSet<object>();
  private sourceStringArrays = new WeakSet<object>();
  bytes = 0;
  evictions = 0;
  private primitiveBytes(value: unknown) { return typeof value === "string" ? 40 + 2 * value.length : 16; }
  private shape(value: object) {
    const children = new Set<object>();
    let bytes = 256; // Object plus graph bookkeeping and an allocation margin.
    if(Array.isArray(value)){
      bytes+=24*value.length; // Packed array slots, not separately allocated property names.
      for(const child of value){
        if(child&&typeof child==="object"){if(!this.permanent.has(child))children.add(child);}
        else if(!(this.sourceStringArrays.has(value)&&typeof child==="string"))bytes+=this.primitiveBytes(child);
      }
      return {bytes:bytes+children.size*64,children:[...children]};
    }
    const values: [string, unknown][] = value instanceof Map ? [...value].flatMap(([k,v],i)=>[[`${i}:key`,k],[`${i}:value`,v]] as [string,unknown][]) : value instanceof Set ? [...value].map((v,i)=>[String(i),v]) : Object.entries(value);
    const sharedStrings = this.sourceStringArrays.has(value);
    for (const [key, child] of values) {
      bytes += 96 + 2 * key.length; // Property/array capacity, reference and bookkeeping.
      if (child && typeof child === "object") { if(!this.permanent.has(child))children.add(child); }
      else if (!(sharedStrings && typeof child === "string")) bytes += this.primitiveBytes(child);
    }
    return { bytes: bytes + children.size * 64, children: [...children] };
  }
  /** Already held by this handle's source/index; excluded only from memo, never from their own reported estimate. */
  accountPermanent(value: unknown): number {
    if (!value || typeof value !== "object" || this.permanent.has(value)) return 0;
    this.permanent.add(value);
    const shape=this.shape(value);
    return shape.bytes+shape.children.reduce((total,child)=>total+this.accountPermanent(child),0);
  }
  /** These arrays contain the existing source execution IDs or indexed fee fact IDs by reference. Slots still count. */
  accountSourceStrings(value: readonly string[]) { this.sourceStringArrays.add(value); }
  private retain(value: unknown, staged?: Map<object, ReturnType<ProjectionMemo["shape"]>>) {
    if (!value || typeof value !== "object" || this.permanent.has(value)) return;
    const previous=this.retained.get(value);
    if(previous){previous.references++;return;}
    const shape=staged?.get(value) ?? this.shape(value);
    this.retained.set(value,{...shape,references:1});this.bytes+=shape.bytes;
    shape.children.forEach(child=>this.retain(child,staged));
  }
  private release(value: unknown) {
    if(!value || typeof value!=="object")return;
    const previous=this.retained.get(value);if(!previous)return;
    if(--previous.references)return;
    this.retained.delete(value);this.bytes-=previous.bytes;
    previous.children.forEach(child=>this.release(child));
  }
  get<T>(key: string): T | undefined {
    const hit = this.values.get(key);
    if (!hit) return undefined;
    this.values.delete(key); this.values.set(key, hit);
    return hit.value as T;
  }
  set(key: string, value: unknown): boolean {
    const bytes = 256 + 2 * key.length + (value && typeof value === "object" ? 0 : this.primitiveBytes(value));
    const limit = 64 * 1024 * 1024;
    // Measure the complete candidate before touching the live working set.
    // Existing shared shapes are reusable, but still count in its standalone
    // size: an oversized candidate cannot fit even after every entry expires.
    const staged = new Map<object, ReturnType<ProjectionMemo["shape"]>>();
    const pending: unknown[] = [value];
    let candidateBytes = bytes;
    while (pending.length && candidateBytes <= limit) {
      const node = pending.pop();
      if (!node || typeof node !== "object" || this.permanent.has(node) || staged.has(node)) continue;
      const shape = this.retained.get(node) ?? this.shape(node);
      staged.set(node, shape); candidateBytes += shape.bytes;
      pending.push(...shape.children);
    }
    if (candidateBytes > limit) { staged.clear(); return false; }
    this.delete(key);
    this.retain(value, staged); staged.clear(); this.bytes += bytes;
    while (this.values.size >= 8192 || this.bytes > limit) {
      const first = this.values.keys().next().value;
      if (first === undefined) break;
      this.delete(first); this.evictions++;
    }
    this.values.set(key, { value, bytes });
    return true;
  }
  get size() { return this.values.size; }
  count(prefix: string) { return [...this.values.keys()].filter(key=>key.startsWith(prefix)).length; }
  delete(key: string) {
    const old = this.values.get(key);
    if (old) { this.values.delete(key); this.bytes -= old.bytes; this.release(old.value); }
  }
}
type PreparedKernel = {
  memo: ProjectionMemo; counts: Omit<ProjectionDiagnostics, "distinctCanonicalContexts" | "cacheEntries" | "cacheEstimatedBytes" | "evictions">;
  normalized: Map<string, ReturnType<typeof normalizedExecution>[]>; groupDigests: Map<string, string>;
};
type OrdinaryFeeIndex = { facts: HomepageV25FeeFact[]; knownTimes: number[]; totals: string[] };
type PreparedData = PreparedKernel & { input: HomepageV25PrepareInput; groups: Group[]; scope: HomepageV25Performance["scope"]; quotes: Map<string, DailyCandleRecord[]>; feeFacts: HomepageV25FeeFact[]; feeFactsByGroup: Map<string, HomepageV25FeeFact[]>; ordinaryFeeIndexes: Map<string, OrdinaryFeeIndex>; fxByDay: Map<string, HistoricalFxObservation[]>; fxConflictIds: Set<string>; selections: Map<string, { execution: TradeExecution; day: string | null; at: number }[]>; ordinary: Map<string, OrdinaryProjection>; sourceEstimatedBytes: number; indexEstimatedBytes: number; batches: string[] };
const preparedData = new WeakMap<HomepageV25PreparedSource, PreparedData>();
function freezeProjection<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeProjection); Object.freeze(value);
  }
  return value;
}
/** Construction-only sharing of complete public values. No table escapes
 * into the handle, source/index, memo or returned graph. */
class ProjectionSharing {
  private values = new Map<string, object>();
  private contexts: Map<string, HomepageV25Metric>[] = [];
  private exact<T extends object>(value: T): T {
    // Public projection values are plain JSON records/arrays. Ordered complete
    // content includes coverage, reason order, native subtotals and FX clocks.
    const key = JSON.stringify(value), previous = this.values.get(key);
    if (previous) return previous as T;
    freezeProjection(value); this.values.set(key, value); return value;
  }
  forBoundary(input: HomepageV25Input, boundary: Boundary) {
    const context = new Map<string, HomepageV25Metric>(); this.contexts.push(context);
    return (amounts: Amount[]): HomepageV25Metric => {
      // Reuse the unchanged policy oracle only for the exact full-precision
      // Amount input under this same target, FX snapshot and knowledge cursor.
      const key = JSON.stringify(amounts.map(a => [a.currency, a.value?.toString() ?? null, a.reasons, a.eligible]));
      const previous = context.get(key); if (previous) return previous;
      const result = metric(amounts, input, boundary);
      result.coverage = this.exact(result.coverage); result.reasons = this.exact(result.reasons);
      result.money.originalByCurrency = this.exact(result.money.originalByCurrency);
      if (result.money.fx) result.money.fx = this.exact(result.money.fx);
      result.money = this.exact(result.money);
      const shared = this.exact(result); context.set(key, shared); return shared;
    };
  }
  clear() {
    this.contexts.forEach(context => context.clear()); this.contexts.length = 0;
    this.values.clear();
  }
}
function stableProjectionJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableProjectionJson).join(",")}]`;
  if (value && typeof value === "object") return "{" + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableProjectionJson(v)}`).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
function asProjectionInput(data: PreparedData, targetCurrency?: string, fxSnapshot?: RoomFxSnapshot): HomepageV25Input {
  return { entries: data.input.entries, period: { start: "2000-01-01", end: "2000-01-01" }, executions: [], openingPositions: [], valuations: [], candlesByInstrument: data.input.candlesByInstrument, scope: data.input.scope, instrumentMetadata: data.input.instrumentMetadata, targetCurrency, fxSnapshot };
}
/** Capture original lineage once. A handle owns all indexes and bounded memo. */
export function prepareHomepageV25Source(input: HomepageV25PrepareInput): HomepageV25PreparedSource {
  if (input.scope?.nature === "simulation" && !input.scope.simulationRunId) throw new HomepageV25ProjectionInputError("simulation-run-required");
  const captured = structuredClone(input);
  const sourceId = `sha256:${sha256(stableProjectionJson({ input: captured, policies: projectionPolicies }))}`;
  const handle: HomepageV25PreparedSource = Object.freeze({ sourceId, revisions: Object.freeze({ ...captured.revisions }), [preparedSourceBrand]: true as const });
  const collection = collect({ ...captured, period: { start: "2000-01-01", end: "2000-01-01" }, executions: [], openingPositions: [], valuations: [] });
  const data: PreparedData = { input: captured, groups: collection.groups, scope: collection.scope, quotes: new Map(), feeFacts: [], feeFactsByGroup: new Map(), ordinaryFeeIndexes: new Map(), fxByDay: new Map(), fxConflictIds: new Set(), selections: new Map(), ordinary: new Map(), sourceEstimatedBytes: 0, indexEstimatedBytes: 0, memo: new ProjectionMemo(), normalized: new Map(), groupDigests: new Map(), batches: [], counts: { canonicalSweeps: 0, canonicalTransitions: 0, batchCacheHits: 0, canonicalCalls: 0, canonicalCacheHits: 0, feeSteps: 0, feeCheckpointHits: 0, quoteLookups: 0, fxLookups: 0 } };
  for (const group of data.groups) {
    data.groupDigests.set(group.key, sha256(stableProjectionJson(group.executions)));
    data.selections.set(group.key,group.executions.map(execution=>({execution,day:executionDay(execution),at:Date.parse(replayExecutionAt(execution))})).sort((a,b)=>replayExecutionAt(a.execution).localeCompare(replayExecutionAt(b.execution))));
    const normalized = group.executions.map(normalizedExecution);
    data.normalized.set(group.key, normalized);
    const canonical = preparePositionLedger({executions:normalized.map(row=>row.execution)});
    data.counts.canonicalSweeps += canonical.diagnostics.sweeps;
    data.counts.canonicalTransitions += canonical.diagnostics.transitions;
    if (canonical.kind === "ordinary-sweep") data.ordinary.set(group.key, prepareOrdinaryProjection(data, group, canonical, normalized));
    const market = group.instrument.market;
    data.quotes.set(group.key, (captured.candlesByInstrument[group.instrument.id] ?? []).filter(q => {
      if (q.instrumentId !== group.instrument.id || q.adjustmentMode !== "raw" || !validDay(q.tradingDate)) return false;
      if (market !== "US" && market !== "HK" && market !== "CN-SH" && market !== "CN-SZ") return false;
      try { return expectedTradingDates(market, q.tradingDate, q.tradingDate).length > 0; }
      catch (error) { if (error instanceof CalendarOutOfRangeError) return false; throw error; }
    }).sort((a, b) => a.tradingDate.localeCompare(b.tradingDate)));
  }
  data.feeFacts = collectFeeFacts(data);
  for (const group of data.groups) {
    const facts=data.feeFacts.filter(fact=>fact.accountId===group.identity.accountId && fact.nature===group.identity.nature && fact.simulationRunId===group.identity.simulationRunId && (!fact.instrumentId || fact.instrumentId===group.instrument.id));
    data.feeFactsByGroup.set(group.key,facts);
    const indexed=ordinaryFeeIndex(facts);if(indexed)data.ordinaryFeeIndexes.set(group.key,indexed);
  }
  const fxIds=new Map<string,string>();
  for (const observation of captured.fxObservations) {
    const content=stableProjectionJson(observation),previous=fxIds.get(observation.id);
    if(previous!==undefined){if(previous!==content)data.fxConflictIds.add(observation.id);else continue;}
    fxIds.set(observation.id,content);
    const bucket=data.fxByDay.get(observation.businessDate)??[];bucket.push(observation);data.fxByDay.set(observation.businessDate,bucket);
  }
  // Count retained object identity once, including conservative object/slot and
  // graph bookkeeping margins. Memo shares source/index references, not copies.
  data.sourceEstimatedBytes=data.memo.accountPermanent(captured);
  data.indexEstimatedBytes=data.memo.accountPermanent({groups:data.groups,quotes:data.quotes,feeFacts:data.feeFacts,feeFactsByGroup:data.feeFactsByGroup,ordinaryFeeIndexes:data.ordinaryFeeIndexes,fxByDay:data.fxByDay,selections:data.selections,ordinary:data.ordinary,normalized:data.normalized,groupDigests:data.groupDigests});
  // Canonical private Decimal checkpoints are not exposed. Reserve object and
  // numeric-array headroom in addition to eight times their serialized payload.
  data.indexEstimatedBytes+=[...data.ordinary.values()].reduce((total,p)=>total+2048*p.canonical.storage.checkpoints+8*p.canonical.storage.checkpointEstimatedBytes,0);
  preparedData.set(handle, data);
  return handle;
}
function selectedPrepared(data:PreparedData,group:Group,boundary:Boundary):TradeExecution[]{
  return data.selections.get(group.key)!.filter(item=>item.day!==null&&item.day<=boundary.day&&(boundary.instant===undefined||item.at<=boundary.instant)).map(item=>item.execution);
}
function projectedState(data: PreparedData, group: Group, boundary: Boundary): State {
  const hasEvidence = group.executions.some(e => e.source.positionEvents?.length || e.source.statementPositions?.length || e.source.openingPosition);
  const selected = selectedPrepared(data,group,boundary).map(e => e.id);
  const key = `state:${data.groupDigests.get(group.key)}:${group.key}:${hasEvidence ? boundary.cursor : "no-attached-knowledge"}:${JSON.stringify(selected)}`;
  const cached = data.memo.get<State>(key);
  if (cached) return { ...cached, boundary };
  const state = ordinaryState(data, group, boundary) ?? replay(group, boundary, "2000-01-01", data);
  data.memo.set(key, state);
  return state;
}
type OrdinaryProjection = { canonical: PreparedPositionLedger; ordered: TradeExecution[]; checkpoints: FeeCheckpoint[] };
function prepareOrdinaryProjection(data: PreparedData, group: Group, canonical: PreparedPositionLedger, normalized: ReturnType<typeof normalizedExecution>[]): OrdinaryProjection {
  const byId=new Map(normalized.map(row=>[row.execution.id,row]));
  const ordered=canonical.transitions.map(fact=>byId.get(fact.executionId)!.execution);
  const pnl=new Set(group.conflicts), quantity=new Set<string>([...group.conflicts].filter(reason=>reason==="execution-lineage-unavailable"));
  if(group.inventoryConflict) quantity.add("duplicate-execution-conflict");
  if(group.executions.some(e=>executionDay(e)===null)){pnl.add("execution-time-invalid");quantity.add("execution-time-invalid");}
  let pool: Decimal|null=new Decimal(0), projectedFees=new Decimal(0);
  const capture=():FeeCheckpoint=>({pool:pool===null?null:pool.toString(),projectedFees:projectedFees.toString(),pnl:[...pnl],quantity:[...quantity]});
  const checkpoints=[capture()];
  for(let index=0;index<ordered.length;index++){
    data.counts.feeSteps++;
    const e=ordered[index], row=byId.get(e.id)!, before=canonical.transitions[index].before;
    row.pnl.forEach(reason=>pnl.add(reason));row.quantity.forEach(reason=>quantity.add(reason));
    if(!before.quantityKnown)pool=null;
    const beforeQuantity=new Decimal(before.quantity),size=new Decimal(e.quantity),fee=new Decimal(e.fee);
    projectedFees=projectedFees.plus(fee);
    const closes=e.side==="sell"&&beforeQuantity.gt(0)||e.side==="buy"&&beforeQuantity.lt(0),closed=closes?Decimal.min(beforeQuantity.abs(),size):new Decimal(0);
    if(e.side==="sell"&&size.gt(Decimal.max(beforeQuantity,0))&&e.source.positionEffect!=="open-short"){pnl.add("execution-direction-unavailable");quantity.add("execution-direction-unavailable");}
    if(e.source.positionEffect==="close-long"&&(beforeQuantity.lte(0)||size.gt(beforeQuantity))||e.source.positionEffect==="close-short"&&(beforeQuantity.gte(0)||size.gt(beforeQuantity.abs()))){pnl.add("position-coverage-missing");quantity.add("position-coverage-missing");}
    if(pool&&size.gt(0)){
      const allocated: Decimal=closed.gt(0)?pool.mul(closed).div(beforeQuantity.abs()):new Decimal(0);
      pool=pool.minus(allocated).plus(fee.mul(size.minus(closed)).div(size));
    }
    checkpoints.push(capture());
  }
  return {canonical,ordered,checkpoints};
}
function ordinaryState(data:PreparedData,group:Group,boundary:Boundary):State|null{
  const prepared=data.ordinary.get(group.key);if(!prepared)return null;
  const selected=selectedPrepared(data,group,boundary);
  if(selected.some((e,index)=>e.id!==prepared.ordered[index]?.id))return null;
  const {snapshot:ledger}=replayPreparedPositionBoundaries(prepared.canonical,[{markPrice:"0",cursor:boundary.cursor,visibleExecutionIds:selected.map(e=>e.id)}]).results[0];
  const checkpoint=prepared.checkpoints[selected.length];
  return finishState(boundary,ledger,selected,new Set(checkpoint.pnl),new Set(checkpoint.quantity),checkpoint.pool===null?null:new Decimal(checkpoint.pool),new Decimal(checkpoint.projectedFees));
}
// Construction-only sharing: neither this object nor its maps enter a prepared
// source/index or retained memo. Instrument selection and coverage stay local.
class BatchMarketCalendar {
  private completedSessions = new Map<string, string | CalendarOutOfRangeError>();
  private tradingDates = new Map<string, string[] | CalendarOutOfRangeError>();
  private localDays = new Map<string, string>();
  private formatters = new Map<string, Intl.DateTimeFormat>();
  private read<T>(cache: Map<string, T | CalendarOutOfRangeError>, key: string, compute: () => T): T {
    const cached = cache.get(key);
    if (cached instanceof CalendarOutOfRangeError) throw cached;
    if (cached !== undefined) return cached;
    try { const value = compute(); cache.set(key, value); return value; }
    catch (error) { if (error instanceof CalendarOutOfRangeError) cache.set(key, error); throw error; }
  }
  completed(market: SupportedMarket, cursor: string): string {
    return this.read(this.completedSessions, `${market}|${cursor}`, () => requiredMarketDataRange(cursor, cursor, { market, open: true, now: new Date(cursor) }).endDate);
  }
  dates(market: SupportedMarket, start: string, end: string): string[] {
    return this.read(this.tradingDates, `${market}|${start}|${end}`, () => expectedTradingDates(market, start, end));
  }
  localDay(market: SupportedMarket, cursor: string): string {
    const key = `${market}|${cursor}`, cached = this.localDays.get(key);
    if (cached !== undefined) return cached;
    const timeZone = market === "US" ? "America/New_York" : "Asia/Shanghai";
    let formatter = this.formatters.get(timeZone);
    if (!formatter) { formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); this.formatters.set(timeZone, formatter); }
    const day = formatter.format(new Date(cursor)); this.localDays.set(key, day); return day;
  }
  clear() { this.completedSessions.clear(); this.tradingDates.clear(); this.localDays.clear(); this.formatters.clear(); }
}
function indexedQuote(data: PreparedData, group: Group, boundary: Boundary, calendar: BatchMarketCalendar): QuoteSelection & { coverage: QuoteCoverage } {
  data.counts.quoteLookups++;
  const market = group.instrument.market;
  const failed = (state: QuoteCoverage["state"], reason: string, requiredCompletedSession: string | null = null) => ({ quote: null, reason, coverage: { state, requiredCompletedSession, selectedDate: null, missingSessions: [], reasons: [reason] } });
  if (market !== "US" && market !== "HK" && market !== "CN-SH" && market !== "CN-SZ") return failed("unsupported-market", "quote-market-unsupported");
  try {
    const required = calendar.completed(market, boundary.cursor);
    const quotes = data.quotes.get(group.key) ?? [];
    let low = 0, high = quotes.length;
    while (low < high) { const mid = (low + high) >>> 1; if (quotes[mid].tradingDate <= required) low = mid + 1; else high = mid; }
    let index=low-1;
    while(index>0 && quotes[index-1].tradingDate===quotes[index].tradingDate) index--;
    const selected = quotes[index];
    if (!selected) return failed("quote-missing", "quote-missing", required);
    const quote: Quote = { date: selected.tradingDate, price: selected.close, currency: selected.currency, source: selected.provider };
    const invalid = !D(quote.price) || D(quote.price)!.lt(0) || currency(quote.currency) !== currency(group.instrument.currency);
    const localDay = calendar.localDay(market, boundary.cursor);
    const missingSessions = selected.tradingDate < required ? calendar.dates(market, new Date(Date.parse(`${selected.tradingDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10), required) : [];
    const state: QuoteCoverage["state"] = invalid ? "quote-invalid" : missingSessions.length ? "missing-completed-session" : required === localDay ? "complete" : calendar.dates(market, localDay, localDay).length ? "session-in-progress-carry" : "market-closed-carry";
    const reasons = state === "quote-invalid" ? ["quote-invalid"] : state === "missing-completed-session" ? ["quote-completed-session-missing"] : [];
    return { quote, coverage: { state, requiredCompletedSession: required, selectedDate: selected.tradingDate, missingSessions, reasons } };
  } catch (error) { if (!(error instanceof CalendarOutOfRangeError)) throw error; return failed("calendar-unavailable", "quote-session-unavailable"); }
}
function strictAmount(group: Group, state: State, quote: ReturnType<typeof indexedQuote>, type: "market" | "unrealized", eligible: boolean): Amount {
  const result = amount(group, state, quote.quote, type, eligible, quote.reason);
  if (state.quantity && !state.quantity.isZero() && quote.coverage.reasons.length) return { ...result, value: null, reasons: unique([...result.reasons, ...quote.coverage.reasons]) };
  return result;
}
function validKnowledge(value: string | null | undefined, boundary: Boundary): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(boundary.cursor));
}
function fxFor(data: PreparedData, boundary: Boundary, codes: string[], target: string | undefined, current = false): { snapshot?: RoomFxSnapshot; coverage: FxCoverage } {
  data.counts.fxLookups++;
  const targetCode = target ? currency(target) : null;
  const requiredPairs = unique(codes.flatMap(code => !targetCode || code === targetCode ? [] : [code, targetCode].filter(c => c !== "CNY").map(c => `${c}/CNY`)));
  const coverage: { state: FxCoverage["state"]; businessDate: string; observationIds: string[]; requiredPairs: string[]; pairKnowledge: Record<string, { publishedAt: string; knownAt: string; fetchedAt: string; source: string }>; reasons: string[] } = { state: requiredPairs.length ? "missing" : "not-required", businessDate: boundary.day, observationIds: [], requiredPairs, pairKnowledge: {}, reasons: [] };
  if (!requiredPairs.length) return { coverage };
  const rates: Record<string, string> = {};
  for (const pair of requiredPairs) {
    const aliases = [pair, pair.replace("/", ":")];
    if (current) {
      const evidence = data.input.currentFxSnapshot;
      const pairKey = aliases.find(key => evidence?.snapshot.rates[key] !== undefined);
      const published = pairKey && evidence?.publishedAtByPair[pairKey];
      const rate = pairKey && D(evidence?.snapshot.rates[pairKey]);
      if (evidence && evidence.snapshot.id && evidence.snapshot.source && evidence.sourceRevision && pairKey && rate && rate.gt(0) && evidence.snapshot.status === "complete" && evidence.evidenceIds.length && validKnowledge(evidence.fetchedAt, boundary) && validKnowledge(published, boundary) && parseAsOf(evidence.snapshot.asOf) && Date.parse(parseAsOf(evidence.snapshot.asOf)!.cursor) <= Date.parse(boundary.cursor)) {
        rates[pair] = rate.toString(); coverage.observationIds.push(evidence.snapshot.id); coverage.pairKnowledge[pair] = { publishedAt: published, knownAt: evidence.fetchedAt, fetchedAt: evidence.fetchedAt, source: evidence.snapshot.source };
      }
    } else {
      const observations = data.fxByDay.get(boundary.day) ?? [];
      if(observations.some(o=>data.fxConflictIds.has(o.id)&&aliases.some(key=>o.rates[key]!==undefined))){coverage.reasons.push("fx-evidence-conflict");continue;}
      const candidates = observations.filter(o => Boolean(o.id && o.source && o.sourceRevision) && o.status === "complete" && o.evidenceIds.length && validKnowledge(o.fetchedAt, boundary)).flatMap(o => {
        const pairKey = aliases.find(key => o.rates[key] !== undefined);
        if (!pairKey) return [];
        const rate = D(o.rates[pairKey]), published = o.publishedAtByPair[pairKey], known = o.knownAtByPair[pairKey];
        return rate && rate.gt(0) && validKnowledge(published, boundary) && validKnowledge(known, boundary) ? [{ o, rate, published, known }] : [];
      }).sort((a, b) => Date.parse(b.known) - Date.parse(a.known) || a.o.id.localeCompare(b.o.id));
      const candidate = candidates[0];
      if (candidate) { rates[pair] = candidate.rate.toString(); coverage.observationIds.push(candidate.o.id); coverage.pairKnowledge[pair] = { publishedAt: candidate.published, knownAt: candidate.known, fetchedAt: candidate.o.fetchedAt, source: candidate.o.source }; }
    }
  }
  coverage.observationIds = unique(coverage.observationIds);
  coverage.state = Object.keys(rates).length === requiredPairs.length ? "complete" : Object.keys(rates).length ? "partial" : "missing";
  if (coverage.state !== "complete") coverage.reasons.push(current ? "current-fx-knowledge-unavailable" : "fx-knowledge-unavailable");
  const snapshot: RoomFxSnapshot | undefined = coverage.state === "complete" && current ? data.input.currentFxSnapshot!.snapshot : coverage.state === "complete" ? { id: coverage.observationIds.join("|"), source: unique(Object.values(coverage.pairKnowledge).map(k => k.source)).join("|"), asOf: boundary.cursor, baseCurrency: "CNY", status: "complete", rates } : undefined;
  return { snapshot, coverage };
}
function collectFeeFacts(data: PreparedData): HomepageV25FeeFact[] {
  const facts: HomepageV25FeeFact[] = [];
  const events = new Map<string, { event: StatementEvent; group: Group; conflict: boolean }>();
  for (const group of data.groups) {
    for (const e of group.executions) {
      const day = executionDay(e), precise = e.source.timePrecision !== "date-only" && e.executedAt.length !== 10;
      const fee = D(e.fee), settlement = normalizedExecution(e);
      const reasons = unique([...settlement.pnl.filter(reason => reason.includes("fee")), ...(e.source.feeStatus === "unknown" ? ["unknown-fees"] : []), ...[...group.conflicts].filter(reason => reason === "duplicate-execution-conflict")]);
      if (!day) reasons.push("fee-incurred-date-unavailable");
      const at = day ? replayExecutionAt(e) : null;
      facts.push({ factId: `${group.key}|execution:${e.id}`, accountId: e.accountId, instrumentId: e.instrument.id, nature: tradeNatureOf(e), simulationRunId: e.source.simulationRunId ?? null, kind: "execution-fee", currency: currency(e.instrument.currency), expense: fee && fee.gte(0) && !reasons.length ? text(fee) : null,
        incurred: { businessDate: day, at: precise ? e.executedAt : null, precision: day ? precise ? "instant" : "day" : "unknown" }, knowledge: { amountKnownAt: at, attributionKnownAt: at, availableAt: at, evidenceIds: [e.id] }, lineage: { executionIds: [e.id], eventIds: [], sourceRows: [`${e.source.platform}:${e.source.row}`] }, coverage: reasons.length ? "unknown" : "complete", reasons });
      for (const event of e.source.positionEvents ?? []) {
        const key = `${event.accountId}|${group.identity.nature}|${group.identity.simulationRunId ?? ""}|${event.id}`;
        const previous = events.get(key);
        if (previous) { if (JSON.stringify(previous.event) !== JSON.stringify(event)) previous.conflict = true; }
        else events.set(key, { event, group, conflict: false });
      }
    }
  }
  for (const [key, { event, group, conflict }] of events) {
    if (event.kind !== "fee") continue;
    const explicitId = event.symbol && event.market ? canonicalInstrumentId(event.symbol, event.market) : null;
    const owner = explicitId ? data.groups.find(g => g.identity.accountId === event.accountId && canonicalInstrumentId(g.instrument.symbol, g.instrument.market) === explicitId && g.identity.nature === group.identity.nature && g.identity.simulationRunId === group.identity.simulationRunId) : undefined;
    const reasons: string[] = [];
    if (!owner) reasons.push("fee-attribution-unavailable");
    if (conflict) reasons.push("fee-evidence-conflict");
    const preciseDay = validDay(event.date), month = /^\d{4}-\d{2}$/.test(event.date) && validDay(`${event.date}-01`);
    if (!preciseDay && !month) reasons.push("fee-incurred-date-unavailable");
    const code = event.currency ? currency(event.currency) : null;
    if (!code || owner && code !== currency(owner.instrument.currency)) reasons.push("fee-currency-unavailable");
    const expense = D(event.amount)?.negated();
    if (!expense) reasons.push("fees-invalid");
    // Existing statement evidence has no execution-fee linkage field. A fee
    // beside an execution-backed IPO cannot safely be declared additional.
    const relevant = [...events.values()].map(v => v.event);
    if (owner && relevant.some(a => a.kind === "ipo" && a.quantity !== undefined && a.accountId === event.accountId && a.market === event.market && a.symbol === event.symbol && isExecutionBackedIpoAllocation(a, owner.executions))) reasons.push("fee-lineage-unavailable");
    const knownAt = preciseDay || month ? eventAt(event) : null;
    facts.push({ factId: `statement:${key}`, accountId: event.accountId, instrumentId: owner?.instrument.id ?? null, nature: group.identity.nature === "caller-scoped" ? "unknown" : group.identity.nature, simulationRunId: group.identity.simulationRunId, kind: "statement-fee", currency: code, expense: expense && !reasons.length ? text(expense) : null,
      incurred: { businessDate: preciseDay ? event.date : month ? event.date : null, at: null, precision: preciseDay ? "day" : month ? "month" : "unknown" }, knowledge: { amountKnownAt: knownAt, attributionKnownAt: owner ? knownAt : null, availableAt: owner ? knownAt : null, evidenceIds: [event.id] }, lineage: { executionIds: [], eventIds: [event.id], sourceRows: event.source.map(s => `${event.documentId ?? "statement"}:${s.page}:${s.row}`) }, coverage: reasons.length ? "unknown" : "complete", reasons });
  }
  return facts;
}
function visibleFeeFacts(data: PreparedData, boundary: Boundary, facts = data.feeFacts): HomepageV25FeeFact[] {
  return facts.filter(f => !f.knowledge.amountKnownAt || Date.parse(f.knowledge.amountKnownAt) <= Date.parse(boundary.cursor)).map(f => validKnowledge(f.knowledge.availableAt, boundary) ? f : { ...f, expense: null, coverage: "unknown", reasons: unique([...f.reasons, "fee-knowledge-unavailable"]) });
}
function ordinaryFeeIndex(facts: HomepageV25FeeFact[]): OrdinaryFeeIndex | null {
  const knownTimes:number[]=[],totals=["0"];let sum=new Decimal(0),previousTime=Number.NEGATIVE_INFINITY,previousDay="";
  for(const fact of facts){
    // Only the proven monotonic ordinary case gets prefix sums. Coarse dates,
    // statement fees, late knowledge and any uncertainty retain the exact path.
    const known=fact.knowledge.availableAt,at=known?Date.parse(known):Number.NaN,day=fact.incurred.businessDate,expense=D(fact.expense);
    if(fact.kind!=="execution-fee"||fact.incurred.precision!=="instant"||fact.coverage!=="complete"||fact.reasons.length||!expense||!day||!known||!Number.isFinite(at)||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(known)||fact.knowledge.amountKnownAt!==known||fact.knowledge.attributionKnownAt!==known||at<previousTime||day<previousDay)return null;
    knownTimes.push(at);sum=sum.plus(expense);totals.push(sum.toString());previousTime=at;previousDay=day;
  }
  return {facts,knownTimes,totals};
}
function feeAmount(data: PreparedData, group: Group, start: string, boundary: Boundary, eligible: boolean): { amount: Amount; ids: string[] } {
  const indexed=data.ordinaryFeeIndexes.get(group.key);
  if(indexed){
    const lower=(test:(index:number)=>boolean)=>{let low=0,high=indexed.facts.length;while(low<high){const mid=(low+high)>>>1;if(test(mid))low=mid+1;else high=mid;}return low;};
    const cursor=Date.parse(boundary.cursor),end=Math.min(lower(i=>indexed.knownTimes[i]<=cursor),lower(i=>indexed.facts[i].incurred.businessDate!<=boundary.day)),begin=Math.min(end,lower(i=>indexed.facts[i].incurred.businessDate!<start));
    const ids=indexed.facts.slice(begin,end).map(f=>f.factId);
    return {amount:{currency:currency(group.instrument.currency),value:new Decimal(indexed.totals[end]).minus(indexed.totals[begin]),reasons:[],eligible:eligible||ids.length>0},ids};
  }
  const reasons: string[] = [], ids: string[] = [];
  let sum = new Decimal(0);
  for (const fact of visibleFeeFacts(data, boundary, data.feeFactsByGroup.get(group.key))) {
    if (fact.accountId !== group.identity.accountId || fact.nature !== group.identity.nature || fact.simulationRunId !== group.identity.simulationRunId || fact.instrumentId && fact.instrumentId !== group.identity.instrumentId) continue;
    const date = fact.incurred.businessDate;
    if (date && fact.incurred.precision !== "month" && (date < start || date > boundary.day)) continue;
    if (fact.incurred.precision === "month" && date) {
      const first = `${date}-01`, last = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
      if (last < start || first > boundary.day) continue;
      if (first < start || last > boundary.day) reasons.push("fee-incurred-boundary-ambiguous");
    }
    ids.push(fact.factId);
    if (fact.coverage !== "complete" || fact.expense === null || !date || !validKnowledge(fact.knowledge.availableAt, boundary)) reasons.push(...fact.reasons, "fee-facts-incomplete");
    else sum = sum.plus(fact.expense);
  }
  return { amount: { currency: currency(group.instrument.currency), value: reasons.length ? null : sum, reasons: unique(reasons), eligible: eligible || ids.length > 0 }, ids };
}
function lifetimeFor(data: PreparedData, group: Group, boundary: Boundary): LifetimeSourceCoverage {
  const candidates = data.input.lifetimeSourceCoverage.filter(c => c.accountId === group.identity.accountId && c.instrumentId === group.identity.instrumentId && c.nature === group.identity.nature && c.simulationRunId === group.identity.simulationRunId);
  const candidate = candidates[0];
  if (candidates.length === 1 && candidate.state === "complete" && candidate.coversInception && candidate.evidenceIds.length && validKnowledge(candidate.knownAt, boundary) && candidate.through && parseAsOf(candidate.through) && Date.parse(parseAsOf(candidate.through)!.cursor) >= Date.parse(boundary.cursor)) return candidate;
  return { accountId: group.identity.accountId, instrumentId: group.identity.instrumentId, nature: group.identity.nature === "caller-scoped" ? "unknown" : group.identity.nature, simulationRunId: group.identity.simulationRunId, state: candidate ? "partial" : "unknown", coversInception: candidate?.coversInception ?? false, through: candidate?.through ?? null, knownAt: candidate?.knownAt ?? null, evidenceIds: candidate?.evidenceIds ?? [], reasons: unique([...(candidate?.reasons ?? []), candidates.length > 1 ? "lifetime-source-conflict" : "lifetime-source-incomplete"]) };
}
const endpointMetricNames = ["periodRealized", "openingUnrealized", "closingUnrealized", "unrealizedChange", "net", "lifetimeRealizedNet", "lifetimeNet", "marketValue", "unrealizedNet", "openFees", "periodFees"] as const;
type EndpointAmounts = Record<(typeof endpointMetricNames)[number], Amount>;
function eligibleCurrencies(amounts: Iterable<Amount>): string[] {
  // Unknown amounts still need their currency's evidence. In particular, a
  // fee can be eligible before its future carrier establishes any inventory.
  return unique([...amounts].filter(amount => amount.eligible).map(amount => amount.currency));
}
function projectedCurrent(data: PreparedData, boundary: Boundary, sharing: ProjectionSharing, calendar: BatchMarketCalendar, targetCurrency?: string): CurrentProjection {
  const key = `current:${boundary.cursor}:${targetCurrency ?? ""}`;
  const cached = data.memo.get<CurrentProjection>(key);
  if (cached) return cached;
  const input = asProjectionInput(data, targetCurrency);
  const markets: Amount[] = [], unrealized: Amount[] = [], fees: Amount[] = [], quoteCoverage: Record<string, QuoteCoverage> = {};
  const native = [];
  for (const group of data.groups) {
    const state = projectedState(data, group, boundary), indexed = indexedQuote(data, group, boundary, calendar), quote = quoteFor(input, group, "current", boundary, calendar), eligible = state.quantity === null || !state.quantity.isZero();
    const mv = amount(group, state, quote.quote, "market", eligible, quote.reason), uf = amount(group, state, quote.quote, "unrealized", eligible, quote.reason);
    const fee: Amount = { currency: currency(group.instrument.currency), value: state.quantity === null ? null : state.openFees, eligible, reasons: unique([...state.quantityReasons, ...(state.openFees === null ? [...state.pnlReasons.filter(r => r.includes("fee")), "fee-allocation-unavailable"] : [])]) };
    markets.push(mv); unrealized.push(uf); fees.push(fee); quoteCoverage[group.key] = indexed.coverage;
    const currentEvidence=evidence(state, quote.quote, quote.reason);data.memo.accountSourceStrings(currentEvidence.executionIds);
    native.push({ group, mv, uf, fee, currentEvidence });
  }
  const fx = fxFor(data, boundary, eligibleCurrencies([...markets, ...unrealized, ...fees]), targetCurrency, true);
  const sharedMetric = sharing.forBoundary(asProjectionInput(data, targetCurrency, fx.snapshot), boundary);
  const instruments: CurrentInstrument[] = native.map(({ group, mv, uf, fee, currentEvidence }) => ({ key: group.key, identity: group.identity, currentMarketValue: sharedMetric([mv]), currentUnrealized: sharedMetric([uf]), currentOpenFees: sharedMetric([fee]), evidence: { current: currentEvidence } }));
  const result = { asOf: boundary.cursor, currentMarketValue: sharedMetric(markets), currentUnrealized: sharedMetric(unrealized), currentOpenFees: sharedMetric(fees), instruments, quoteCoverage, fxCoverage: fx.coverage };
  freezeProjection(result);
  sharing.clear();
  data.memo.set(key, result);
  return result;
}
/** Batch endpoint facts; series/UI must consume these rather than replay F per day. */
export function projectHomepageV25Boundaries(source: HomepageV25PreparedSource, request: HomepageV25BoundaryInput): HomepageV25BoundaryBatch {
  const data = preparedData.get(source);
  if (!data) throw new HomepageV25ProjectionInputError("prepared-source-invalid");
  const asOf = parseAsOf(request.asOf);
  if (!asOf || asOf.instant === undefined) throw new HomepageV25ProjectionInputError("as-of-instant-required");
  if (!validDay(request.periodStart)) throw new HomepageV25ProjectionInputError("period-start-invalid");
  const keys = new Set<string>();
  const endpoints = request.endpoints.map(endpoint => {
    if (!endpoint.key || keys.has(endpoint.key)) throw new HomepageV25ProjectionInputError("endpoint-key-duplicate");
    keys.add(endpoint.key);
    const boundary = parseAsOf(endpoint.at);
    if (!boundary || boundary.day < request.periodStart) throw new HomepageV25ProjectionInputError("endpoint-invalid");
    return { ...endpoint, boundary };
  });
  const batchKey = `batch:${stableProjectionJson(request)}`;
  const cached = data.memo.get<HomepageV25BoundaryBatch>(batchKey);
  if (cached) {
    data.counts.batchCacheHits++;
    data.batches = data.batches.filter(key=>key!==batchKey); data.batches.push(batchKey);
    return cached;
  }
  const sharing = new ProjectionSharing(), calendar = new BatchMarketCalendar();
  const openingBoundary = dayBoundary(previousDay(request.periodStart));
  const points: HomepageV25BoundaryPoint[] = [];
  for (const endpoint of endpoints) {
    const future = endpoint.boundary.day > asOf.day || endpoint.boundary.instant !== undefined && endpoint.boundary.instant > asOf.instant;
    const boundary = endpoint.boundary.day === asOf.day && Date.parse(endpoint.boundary.cursor) > asOf.instant ? asOf : endpoint.boundary;
    const totals = Object.fromEntries(endpointMetricNames.map(name => [name, [] as Amount[]])) as Record<(typeof endpointMetricNames)[number], Amount[]>;
    const quoteCoverage: Record<string, { opening: QuoteCoverage; endpoint: QuoteCoverage }> = {};
    const native = [];
    if (!future) for (const group of data.groups) {
      const opening = projectedState(data, group, openingBoundary), end = projectedState(data, group, boundary);
      const oq = indexedQuote(data, group, openingBoundary, calendar), eq = indexedQuote(data, group, boundary, calendar);
      const eligible = Boolean(opening.executions.length || end.executions.length || opening.quantity === null || end.quantity === null || opening.quantity?.abs().gt(0) || end.quantity?.abs().gt(0));
      const code = currency(group.instrument.currency), realized: Amount = { currency: code, value: opening.netRealized !== null && end.netRealized !== null ? end.netRealized.minus(opening.netRealized) : null, reasons: unique([...opening.pnlReasons, ...end.pnlReasons]), eligible };
      const ouf = strictAmount(group, opening, oq, "unrealized", eligible), cuf = strictAmount(group, end, eq, "unrealized", eligible);
      const change: Amount = { currency: code, value: ouf.value !== null && cuf.value !== null ? cuf.value.minus(ouf.value) : null, reasons: unique([...ouf.reasons, ...cuf.reasons]), eligible };
      const net: Amount = { currency: code, value: realized.value !== null && change.value !== null ? realized.value.plus(change.value) : null, reasons: unique([...realized.reasons, ...change.reasons]), eligible };
      const life = lifetimeFor(data, group, boundary), lifetimeRealized: Amount = { currency: code, value: life.state === "complete" ? end.netRealized : null, reasons: unique([...end.pnlReasons, ...life.reasons]), eligible };
      const lifetimeNet: Amount = { currency: code, value: lifetimeRealized.value !== null && cuf.value !== null ? lifetimeRealized.value.plus(cuf.value) : null, reasons: unique([...lifetimeRealized.reasons, ...cuf.reasons]), eligible };
      const fee = feeAmount(data, group, request.periodStart, boundary, eligible);
      const amounts: EndpointAmounts = { periodRealized: realized, openingUnrealized: ouf, closingUnrealized: cuf, unrealizedChange: change, net, lifetimeRealizedNet: lifetimeRealized, lifetimeNet, marketValue: strictAmount(group, end, eq, "market", eligible), unrealizedNet: cuf,
        openFees: { currency: code, value: end.quantity === null ? null : end.openFees, reasons: unique([...end.quantityReasons, ...(end.openFees === null ? ["fee-allocation-unavailable"] : [])]), eligible }, periodFees: fee.amount };
      for (const name of endpointMetricNames) totals[name].push(amounts[name]);
      const qc = { opening: oq.coverage, endpoint: eq.coverage }; quoteCoverage[group.key] = qc;
      const openingEvidence=evidence(opening,oq.quote,oq.reason),endpointEvidence=evidence(end,eq.quote,eq.reason);
      for(const ids of [openingEvidence.executionIds,endpointEvidence.executionIds,fee.ids])data.memo.accountSourceStrings(ids);
      const canonicalKnownFees: Amount = { currency: code, value: [...(end.ledger.accuracy?.reasons ?? []), ...end.pnlReasons.filter(r => r === "fees-invalid" || r === "fees-conflict" || r === "duplicate-execution-conflict")].some(r => r.includes("fee") || r === "duplicate-execution-conflict") ? null : D(end.ledger.fees), reasons: (end.ledger.accuracy?.reasons ?? []).filter(r => r.includes("fee")), eligible };
      native.push({ group, amounts, openingEvidence, endpointEvidence, qc, fee, canonicalKnownFees, life });
    }
    // Eligibility belongs to the actual native facts at this boundary. Keep
    // every source group so early attached positions/fees remain discoverable.
    const codes = eligibleCurrencies(native.flatMap(item => [...Object.values(item.amounts), item.canonicalKnownFees]));
    const fx = future ? { coverage: { state: "missing" as const, businessDate: boundary.day, observationIds: [], requiredPairs: [], pairKnowledge: {}, reasons: ["endpoint-future"] } } : fxFor(data, boundary, codes, request.targetCurrency);
    const sharedMetric = sharing.forBoundary(asProjectionInput(data, request.targetCurrency, fx.snapshot), boundary);
    const instruments: BoundaryInstrument[] = native.map(({ group, amounts, openingEvidence, endpointEvidence, qc, fee, canonicalKnownFees, life }) => ({
      ...Object.fromEntries(endpointMetricNames.map(name => [name, sharedMetric([amounts[name]])])) as EndpointMetrics,
      key: group.key, identity: group.identity, evidence: { opening: openingEvidence, endpoint: endpointEvidence }, quoteCoverage: qc, fxCoverage: fx.coverage, feeFactIds: fee.ids, canonicalKnownFees: sharedMetric([canonicalKnownFees]), lifetimeCoverage: life,
    }));
    if (future) for (const name of endpointMetricNames) totals[name].push({ currency: request.targetCurrency ?? "", value: null, reasons: ["endpoint-future"], eligible: true });
    const values = Object.fromEntries(endpointMetricNames.map(name => [name, sharedMetric(totals[name])])) as EndpointMetrics;
    points.push({ ...values, key: endpoint.key, requestedAt: endpoint.at, businessDate: boundary.day, effectiveCursor: future ? null : boundary.cursor, boundaryPrecision: boundary.instant === undefined ? "day" : "instant", state: future ? "future" : values.net.available ? "value" : "source-missing", plottable: values.net.available, instruments, quoteCoverage, fxCoverage: fx.coverage, lifetimeCoverage: instruments.map(i => i.lifetimeCoverage), reasons: unique(endpointMetricNames.flatMap(name => values[name].reasons)) });
  }
  const current = projectedCurrent(data, asOf, sharing, calendar, request.targetCurrency);
  calendar.clear();
  const diagnostics: ProjectionDiagnostics = { ...data.counts, distinctCanonicalContexts: data.memo.count("canonical:"), cacheEntries: data.memo.size, cacheEstimatedBytes: data.memo.bytes, evictions: data.memo.evictions };
  const result = freezeProjection({ sourceId: source.sourceId, revisions: source.revisions, policies: projectionPolicies, scope: data.scope, asOf: asOf.cursor, periodStart: request.periodStart, points, current, feeFacts: visibleFeeFacts(data, asOf), diagnostics });
  sharing.clear();
  if (data.memo.set(batchKey, result)) data.batches.push(batchKey);
  // Result entries share the same global memo limits and an additional four
  // batch cap. Old entries expire naturally via bounded LRU.
  if (data.batches.length > 4) data.memo.delete(data.batches.shift()!);
  return result;
}

/** Live handle counters. Batch diagnostics are immutable facts captured at build completion, before result admission. */
export function inspectHomepageV25PreparedSource(source: HomepageV25PreparedSource) {
  const data=preparedData.get(source);
  if(!data) throw new HomepageV25ProjectionInputError("prepared-source-invalid");
  return freezeProjection({...data.counts, distinctCanonicalContexts:data.memo.count("canonical:"),cacheEntries:data.memo.size,cacheEstimatedBytes:data.memo.bytes,evictions:data.memo.evictions,batchEntries:data.memo.count("batch:"),sourceEstimatedBytes:data.sourceEstimatedBytes,indexEstimatedBytes:data.indexEstimatedBytes});
}
