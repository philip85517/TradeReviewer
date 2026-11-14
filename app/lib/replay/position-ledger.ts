import Decimal from "decimal.js";

import {
  hasSettlementCurrencyMismatch, executionFeeCurrency,
  tradeNatureOf,
  type TradeExecution,
} from "../trades/types";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";
import { executionHasExactTime, executionSourceOrderConflictsWithTime, statementPositionEvidenceKey, statementPositionMatchesExecution, explicitExecutionSourceOrder, executionDocumentKey, isExecutionBackedIpoAllocation, replayCursorAt, replayExecutionAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import { bonusShareEvidenceKey, collectBonusShareEvidence, isBonusShareEvidence } from "../trades/bonus-share-evidence";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";

import {nativeMarketBoundary,nativeExecutionAt,nativeExecutionDay} from './native-boundary';

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

const nativePositionAt = (position: StatementPosition) => nativeMarketBoundary(statementPositionAt(position),position.market);
const nativeEventAt = (event: StatementEvent) => event.date.length === 7 || event.date.length === 10 && event.displayTimePolicy !== 'session-open'
  ? nativeMarketBoundary(ledgerEventAt(event),event.market) : ledgerEventAt(event);
const nativeTransferAt = (event: StatementEvent) => nativeMarketBoundary(`${event.date}T00:00:00.000Z`,event.market);
const nativeMonthAt = (month: string,market?:string) => { const at = monthEndAt(month); return at ? nativeMarketBoundary(at,market) : undefined; };

/** Every time-only ledger transition also invalidates materialization caches and wakes the worker. */
export function nativeEvidenceBoundaries(executions: TradeExecution[], evidence: Pick<MonthlyStatement, 'positions'|'events'|'month'>[],market?:string): string[] {
  const positions = [...evidence.flatMap(s => s.positions), ...executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])];
  const events = [...evidence.flatMap(s => s.events), ...executions.flatMap(e => e.source.positionEvents ?? [])];
  return [...positions.map(nativePositionAt), ...events.flatMap(e => [nativeEventAt(e), ...(e.date.length === 10 && (e.kind === 'transfer-in' || e.kind === 'transfer-out') ? [nativeTransferAt(e)] : [])]), ...evidence.flatMap(s => { const at = s.month ? nativeMonthAt(s.month,market??executions[0]?.instrument.market) : undefined; return at ? [at] : []; })];
}

/** Exact native facts for background materialization; display snapshots retain their existing format. */
export type NativePositionFacts = {
  quantity: string | null; averageCost: string | null; realized: string | null;
  unrealized: string | null; fees: string | null; knownFees: string; openFees: string | null;
  reasons: string[]; closedCount: number;
  /** Monotonic prefixes isolate old missing contributions from later periods. */
  knownRealized: string; realizedMissing: number; feesMissing: number;
  realizedContributions: Record<string, {currency:string;amount:string|null}>;
  realizedByCurrency: Record<string,string>; openFeesByCurrency: Record<string,string> | null;
  lifetimeComplete: boolean; historicalReasons: string[];
};
export function replayPositionAtPrice(input: {
  executions: TradeExecution[];
  /** Native reporting uses market-local evidence boundaries and explicit short evidence. */
  nativeFacts?: (facts: NativePositionFacts) => void;
  /** Validation failures follow their execution through inventory and prefix accounting. */
  nativeErrors?: ReadonlyMap<string, readonly string[]>;
  markPrice: string;
  cursor?: string;
  /** Exact execution IDs selected by a dual-cursor replay boundary. */
  visibleExecutionIds?: readonly string[];
  /** Explicit identity for statement-only inventory; used only when no executions exist. */
  inventoryIdentity?: { accountId: string; symbol: string; market: string; currency?:string };
  evidence?: Pick<MonthlyStatement, "positions" | "events" | "month" | "accountId">[] & Partial<MonthlyStatement>[];
}): PositionLedgerSnapshot {
  // Never mutate the process-wide Decimal configuration used by legacy consumers.
  const D = input.nativeFacts ? Decimal.clone({ precision: 48 }) : Decimal;
  const getExecutionAt = (execution:TradeExecution) => input.nativeFacts ? nativeExecutionAt(execution) : replayExecutionAt(execution);
  const getPositionAt = (position: StatementPosition) => input.nativeFacts ? nativePositionAt(position) : statementPositionAt(position);
  const getEventAt = (event: StatementEvent) => input.nativeFacts ? nativeEventAt(event) : ledgerEventAt(event);
  let openFees = new D(0), closedCount = 0;
  let feePoolKnown = true;
  let knownRealized = new D(0), realizedMissing = 0, feesMissing = 0;
  const quoteCurrency = input.executions[0]?.instrument.currency ?? input.inventoryIdentity?.currency ?? 'UNKNOWN';
  const realizedContributions: NativePositionFacts['realizedContributions'] = {};
  const realizedByCurrency: Record<string,string> = {};
  const feePools: Record<string,Decimal> = {};
  const recordRealized = (key: string, value: Decimal | null, currency=quoteCurrency) => {
    realizedContributions[`${key}:${currency}`] = {currency,amount:value?.toFixed()??null};
    if (value === null) realizedMissing++;
    else {
      realizedByCurrency[currency]=new D(realizedByCurrency[currency]??0).plus(value).toFixed();
      if(currency===quoteCurrency)knownRealized=knownRealized.plus(value);
    }
  };
  let provenStart = false;
  const historicalReasons = new Set<string>();
  const allocateFees = (key: string, side: 'buy' | 'sell', size: Decimal, fee: Decimal | null, price?: Decimal, feeCurrency=quoteCurrency) => {
    const closes = side === 'sell' ? quantity.gt(0) : quantity.lt(0);
    const closed = closes ? D.min(quantity.abs(), size) : new D(0);
    if (closed.gt(0)) closedCount++;
    const basisKnown = !quantityUncertain && !pendingTransfers.size && ![...reasons].some(r=>!r.includes('fee'));
    if (!fee) feesMissing++;
    if (closed.gt(0)) {
      if (basisKnown && feePoolKnown && fee && price && size.gt(0)) {
        const amounts: Record<string,Decimal> = {[quoteCurrency]:(quantity.gt(0) ? price.minus(averageCost) : averageCost.minus(price)).mul(closed)};
        for(const [currency,pool]of Object.entries(feePools))amounts[currency]=(amounts[currency]??new D(0)).minus(pool.mul(closed).div(quantity.abs()));
        amounts[feeCurrency]=(amounts[feeCurrency]??new D(0)).minus(fee.mul(closed).div(size));
        for(const [currency,value]of Object.entries(amounts))recordRealized(key,value,currency);
      } else recordRealized(key, null);
    } else if (quantityUncertain || pendingTransfers.size) recordRealized(key, null);
    if (!fee || !size.gt(0) || quantityUncertain) { feePoolKnown = false; return; }
    for(const [currency,pool]of Object.entries(feePools))feePools[currency]=pool.minus(closed.gt(0)?pool.mul(closed).div(quantity.abs()):0);
    feePools[feeCurrency]=(feePools[feeCurrency]??new D(0)).plus(fee.mul(size.minus(closed)).div(size));
    openFees=feePools[quoteCurrency]??new D(0);
  };
  let quantity = new D(0);
  let averageCost = new D(0);
  let realizedPnl = new D(0);
  let fees = new D(0);
  let grossCapitalDeployed = new D(0);
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
  type Entry = { ambiguousOrder?:boolean; at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent; incomplete?: string };
  const timeline: Entry[] = input.executions.map(execution => ({ at: getExecutionAt(execution), execution }));
  const seen = new Set<string>();
  for (const position of [...(input.evidence ?? []).flatMap(e => e.positions), ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])]) {
    if (!matches(position)) continue;
    const key = statementPositionEvidenceKey(position);
    if (seen.has(key)) continue;
    seen.add(key);
    timeline.push({ at: getPositionAt(position), position });
  }
  for (const event of events) {
    if (!matches(event) || seen.has(`${event.accountId}:${event.id}`)) continue;
    seen.add(`${event.accountId}:${event.id}`);
    // Month-only IPO results are contextual evidence, known by month end at earliest.
    const at = getEventAt(event);
    if (event.date.length === 10 && (event.kind === "transfer-in" || event.kind === "transfer-out")) timeline.push({ at: input.nativeFacts ? nativeTransferAt(event) : `${event.date}T00:00:00.000Z`, pendingTransfer: event });
    timeline.push({ at, event });
  }
  const scopedIncomplete = new Set<string>();
  if(input.nativeFacts)for(const evidence of input.evidence??[]) {
    const identity=input.inventoryIdentity??(input.executions[0]?{accountId:input.executions[0].accountId,symbol:input.executions[0].instrument.symbol,market:input.executions[0].instrument.market}:undefined);
    if(!identity||evidence.accountId&&evidence.accountId!==identity.accountId||!evidence.documentId||!evidence.month)continue;
    const incomplete=evidence.historyIncomplete||evidence.incompleteInstruments?.some(i=>canonicalInstrumentId(i.symbol,i.market)===canonicalInstrumentId(identity.symbol,identity.market));
    if(!incomplete)continue;
    scopedIncomplete.add(evidence.documentId);
    const at=nativeMonthAt(evidence.month,identity.market);if(at)timeline.push({at,incomplete:evidence.documentId});
  }
  const ambiguousAt=new Set<string>();
  if(input.nativeFacts){
    const groups=new Map<string,TradeExecution[]>();
    for(const execution of input.executions){
      // Preserve the pre-existing, verified acquisition-before-session contract.
      // Either hint alone is insufficient; ordinary date-only fills stay unknown.
      if(!executionHasExactTime(execution)&&execution.source.displayTimePolicy==='session-open'&&execution.source.positionEffect==='open-long')continue;
      const day=nativeExecutionDay(execution),rows=groups.get(day)??[];rows.push(execution);groups.set(day,rows);
    }
    for(const [day,rows]of groups){
      if(rows.length<2||rows.every(executionHasExactTime))continue;
      const documents=new Set(rows.map(executionDocumentKey)),orders=rows.map(explicitExecutionSourceOrder);
      // Exact instants and unknown intraday instants cannot safely share a cost
      // sequence: source order alone must not move a date-only fill into the past.
      const comparable=rows.every(e=>!executionHasExactTime(e))&&documents.size===1&&!documents.has(undefined)&&orders.every(o=>o!==undefined)&&new Set(orders).size===orders.length;
      if(!comparable){
        const at=nativeMarketBoundary(`${day}T23:59:59.999Z`,rows[0].instrument.market);
        const first=rows.map(getExecutionAt).sort()[0];
        for(const boundary of new Set([first,at])){ambiguousAt.add(boundary);timeline.push({at:boundary,ambiguousOrder:true});}
      }
    }
  }
  // A separately reported closing inventory can restore quantity after unknown
  // ordering. Transaction balances cannot establish which row was last.
  for(let i=timeline.length-1;i>=0;i--)if(timeline[i].position?.phase==='closing'&&ambiguousAt.has(timeline[i].at)&&timeline[i].position!.source.some(s=>s.role==='transaction-position'))timeline.splice(i,1);
  const rank = (entry: Entry) => entry.ambiguousOrder ? 1 : entry.incomplete ? 5 : entry.position ? (entry.position.phase === "opening" ? 0 : 4) : entry.pendingTransfer ? 1 : entry.event ? 2 : 3;
  // Same-day transaction balances belong after their own fill, not after all
  // fills or before all fills. Only durable document/row + explicit source order
  // may interleave date-only rows; a storage array order is not clock evidence.
  const ordered=new Map<Entry,{document:string;order:number;after:number}>();
  if(input.nativeFacts)for(const entry of timeline){
    const matches=entry.execution?[entry.execution]:entry.position?input.executions.filter(e=>statementPositionMatchesExecution(entry.position!,e)&&getExecutionAt(e)===entry.at):[];
    if(matches.length!==1||ambiguousAt.has(entry.at))continue;
    const execution=matches[0],order=explicitExecutionSourceOrder(execution),document=executionDocumentKey(execution);
    if(order!==undefined&&document)ordered.set(entry,{document,order,after:entry.position?1:0});
  }
  timeline.sort((a,b)=>{
    const time=a.at.localeCompare(b.at);if(time)return time;
    const aa=ordered.get(a),bb=ordered.get(b);
    const phase=(aa?3:rank(a))-(bb?3:rank(b));if(phase)return phase;
    if(aa&&bb&&aa.document===bb.document)return aa.order-bb.order||aa.after-bb.after;
    return 0;
  });
  const cursor = input.cursor ? replayCursorAt(input.cursor) : timeline.at(-1)?.at;
  const cursorTime = cursor ? Date.parse(cursor) : Number.POSITIVE_INFINITY;
  const visibleAt = (at: string) => Date.parse(at) <= cursorTime;
  const visibleExecutionIds = input.visibleExecutionIds ? new Set(input.visibleExecutionIds) : undefined;
  const selectedExecution = (execution: TradeExecution) => visibleExecutionIds
    ? visibleExecutionIds.has(execution.id)
    : visibleAt(getExecutionAt(execution));
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
    .filter(event => visibleAt(getEventAt(event)))
    .map(event => [`${event.accountId}:${event.id}`, event])).values()];
  const allPositions = [
    ...(input.evidence ?? []).flatMap(e => e.positions),
    ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])]),
  ];
  const knownPositions = [...new Map(allPositions
    .filter(position => visibleAt(getPositionAt(position)))
    .map(position => [statementPositionEvidenceKey(position), position])).values()];
  let hasHistory = false;
  let lastActivity: string | undefined;
  let quantityUncertain = false;
  const pendingTransfers = new Set<string>();
  // A proven flat boundary ends the current lot, not the missing history.
  // Legacy replay keeps its existing conservative compatibility behavior.
  const recoverFlat = () => {
    if (!input.nativeFacts || !quantity.isZero() || quantityUncertain || pendingTransfers.size) return;
    for (const reason of reasons) historicalReasons.add(reason);
    reasons.clear(); averageCost = new D(0); openFees = new D(0); feePoolKnown = true;
    for(const currency of Object.keys(feePools))delete feePools[currency];
  };

  for (const entry of timeline) {
    if (entry.execution && visibleExecutionIds && !visibleExecutionIds.has(entry.execution.id)) continue;
    if (cursor && Date.parse(entry.at) > Date.parse(cursor)
      && !(entry.execution && visibleExecutionIds?.has(entry.execution.id))) continue;
    if(entry.ambiguousOrder){
      reasons.add('ambiguous-execution-order');quantityUncertain=true;
      recordRealized(`ambiguous-order:${entry.at}`,null);hasHistory=true;continue;
    }
    if(entry.incomplete){
      reasons.add('history-incomplete');quantityUncertain=true;
      recordRealized(`incomplete:${entry.incomplete}`,null);hasHistory=true;continue;
    }
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
        ...(input.evidence ?? []).filter(e => e.month && monthEndAt(e.month) !== undefined && visibleAt(input.nativeFacts ? nativeMonthAt(e.month,entry.position!.market)! : monthEndAt(e.month)!) && evidenceCoversMarket(e, entry.position!)).map(e => e.month!),
      ];
      const coverageGaps = statementCoverageGaps(lastActivity, entry.position.date, covered);
      if (new D(entry.position.quantity).eq(quantity)) {
        for (const gap of coverageGaps) if (!warnings.some(item => item.from === gap.from && item.to === gap.to)) warnings.push({ code: "statement-coverage-gap", ...gap });
      } else if (coverageGaps.length) {
        reasons.add("position-gap");
      }
      lastActivity = entry.position.date;
      const next = new D(entry.position.quantity);
      if (!hasHistory && next.isZero() && entry.position.phase === 'opening') provenStart = true;
      if (!next.eq(quantity)) {
        if (input.nativeFacts) recordRealized(`position:${JSON.stringify([entry.position.accountId,entry.position.market,entry.position.symbol,entry.position.phase,entry.position.date])}`, null);
        reasons.add(hasHistory ? "position-gap" : "initial-position");
        reasons.add("unknown-cost");
        quantity = next;
        averageCost = new D(0);
      }
      recoverFlat();
      hasHistory = true;
      continue;
    }
    if (entry.event) {
      const event = entry.event;
      if (isExecutionBackedIpoAllocation(event, actualVisibleExecutions)) continue;
      const isIpoAllocation = event.kind === "ipo" && event.quantity !== undefined;
      const isBonusShare = isBonusShareEvidence(event);
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
        const size = new D(event.quantity!);
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
        quantity = quantity.plus(new D(event.quantity).abs().times(event.kind === "transfer-in" ? 1 : -1));
        averageCost = new D(0);
        reasons.add("unknown-cost");
      } else if (isIpoAllocation) {
        const quantityValue = new D(event.quantity!);
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
        const cashCost = cost ? new D(cost.cashCost) : undefined;
        const allocationCost = cashCost?.div(size);
        if (!cost || !allocationCost) {
          reasons.add("position-event");
          if (!hasHistory) reasons.add("initial-position");
          reasons.add("unknown-cost");
        }
        allocateFees(`event:${event.accountId}:${event.id}`, 'buy', size, cost ? new D(cost.feeCost) : null, allocationCost);
        if (cost) fees = fees.plus(cost.feeCost);
        if (quantity.gte(0)) {
          const newQuantity = quantity.plus(size);
          if (allocationCost) {
            averageCost = newQuantity.isZero()
              ? new D(0)
              : averageCost.mul(quantity).plus(allocationCost.mul(size)).div(newQuantity);
            grossCapitalDeployed = grossCapitalDeployed.plus(cashCost!);
          }
          quantity = newQuantity;
        } else {
          const covered = D.min(quantity.abs(), size);
          if (allocationCost) realizedPnl = realizedPnl.plus(averageCost.minus(allocationCost).mul(covered));
          quantity = quantity.plus(size);
          if (quantity.isPositive() && allocationCost) {
            averageCost = allocationCost;
            grossCapitalDeployed = grossCapitalDeployed.plus(cashCost!);
          }
          if (quantity.isZero()) averageCost = new D(0);
        }
      } else {
        // Cash, fee, dividend, and other statement rows are contextual
        // evidence only; they do not establish inventory history.
        continue;
      }
      recoverFlat();
      hasHistory = true;
      continue;
    }
    const execution = entry.execution!;
    const executionErrors = input.nativeFacts ? input.nativeErrors?.get(execution.id) ?? [] : [];
    for (const reason of executionErrors) reasons.add(reason);
    if (executionErrors.includes('quantity-invalid')) quantityUncertain = true;
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
    if (!input.nativeFacts && hasSettlementCurrencyMismatch(execution)) {
      reasons.add("settlement-currency-mismatch");
    }
    if (execution.source.historyIncomplete?.some(id=>!input.nativeFacts||!scopedIncomplete.has(id))) {
      reasons.add("history-incomplete");
      quantityUncertain = true;
    }
    lastActivity = execution.source.tradingDate ?? execution.executedAt;
    hasHistory = true;
    const size = new D(execution.quantity).abs();
    const settlement = execution.source.settlement;
    const price = settlement && settlement.currency === execution.instrument.currency
      ? new D(settlement.grossAmount).div(settlement.quantity)
      : new D(execution.price);
    if (input.nativeFacts && execution.side === 'sell' && size.gt(D.max(quantity, 0)) && execution.source.positionEffect !== 'open-short') {
      quantityUncertain = true; reasons.add('execution-direction-unavailable');
    }
    if(input.nativeFacts){
      const effect=execution.source.positionEffect;
      if(effect==='close-short'&&(execution.side!=='buy'||quantity.gte(0)||size.gt(quantity.abs())) ||
         effect==='close-long'&&(execution.side!=='sell'||quantity.lte(0)||size.gt(quantity)) ||
         effect==='open-short'&&execution.side!=='sell' || effect==='open-long'&&execution.side!=='buy'){
        quantityUncertain=true;reasons.add('execution-direction-unavailable');
      }
    }
    allocateFees(`execution:${execution.id}`, execution.side, size, execution.source.feeStatus === 'unknown' || executionErrors.some(r=>r.includes('fee')) ? null : new D(execution.fee || 0), price, input.nativeFacts ? executionFeeCurrency(execution) : quoteCurrency);
    fees = fees.plus(execution.fee || 0);

    if (execution.side === "buy") {
      if (quantity.gte(0)) {
        const newQuantity = quantity.plus(size);
        averageCost = newQuantity.isZero()
          ? new D(0)
          : averageCost.mul(quantity).plus(price.mul(size)).div(newQuantity);
        quantity = newQuantity;
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(size));
      } else {
        const covered = D.min(quantity.abs(), size);
        realizedPnl = realizedPnl.plus(averageCost.minus(price).mul(covered));
        quantity = quantity.plus(size);
        if (quantity.isPositive()) {
          averageCost = price;
          grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity));
        }
        if (quantity.isZero()) averageCost = new D(0);
      }
    } else if (quantity.lte(0)) {
      const newAbsoluteQuantity = quantity.abs().plus(size);
      averageCost = newAbsoluteQuantity.isZero()
        ? new D(0)
        : averageCost
            .mul(quantity.abs())
            .plus(price.mul(size))
            .div(newAbsoluteQuantity);
      quantity = quantity.minus(size);
      grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(size));
    } else {
      const closed = D.min(quantity, size);
      realizedPnl = realizedPnl.plus(price.minus(averageCost).mul(closed));
      quantity = quantity.minus(size);
      if (quantity.isNegative()) {
        averageCost = price;
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity.abs()));
      }
      if (quantity.isZero()) averageCost = new D(0);
    }
    recoverFlat();
  }

  const markPrice = new D(input.markPrice);
  const unrealizedPnl = quantity.isPositive()
    ? markPrice.minus(averageCost).mul(quantity)
    : averageCost.minus(markPrice).mul(quantity.abs());
  const netPnl = realizedPnl.plus(unrealizedPnl).minus(fees);
  const returnPercent = grossCapitalDeployed.isZero()
    ? new D(0)
    : netPnl.div(grossCapitalDeployed).mul(100);

  if (input.nativeFacts) {
    const quantityKnown = !quantityUncertain && !pendingTransfers.size;
    const costReasons = [...reasons].filter(reason => !reason.includes('fee'));
    const costKnown = quantityKnown && costReasons.length === 0;
    const feesKnown = feePoolKnown && ![...reasons].some(reason => reason.includes('fee'));
    input.nativeFacts({
      quantity: quantityKnown ? quantity.toFixed() : null,
      averageCost: costKnown ? averageCost.toFixed() : null,
      realized: !quantityKnown || realizedMissing > 0 || Object.entries(realizedByCurrency).some(([c,v])=>c!==quoteCurrency&&!new D(v).isZero()) ? null : knownRealized.toFixed(),
      unrealized: quantityKnown && quantity.isZero() ? '0' : costKnown && feesKnown && !Object.entries(feePools).some(([c,v])=>c!==quoteCurrency&&!v.isZero()) ? unrealizedPnl.minus(openFees).toFixed() : null,
      fees: feesMissing === 0 ? fees.toFixed() : null, knownFees: fees.toFixed(),
      openFees: feesKnown ? openFees.toFixed() : null,
      reasons: [...reasons], closedCount, knownRealized: knownRealized.toFixed(), realizedMissing, feesMissing, realizedContributions, realizedByCurrency,
      openFeesByCurrency:feesKnown?Object.fromEntries(Object.entries(feePools).map(([c,v])=>[c,v.toFixed()])):null,
      historicalReasons: [...historicalReasons], lifetimeComplete: (!hasHistory || provenStart) && historicalReasons.size === 0 && reasons.size === 0 && realizedMissing === 0 && feesMissing === 0,
    });
  }
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
