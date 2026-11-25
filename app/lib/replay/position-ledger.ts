import { carryGiftAcquisitionEvidence, collectGiftAcquisitionEvidence, giftEventIdentity, isGiftAcquisitionEvidence } from "../trades/gift-acquisition-evidence";
import Decimal from "decimal.js";
import {resolvedTradeNatureOf} from "../trades/nature-resolution";
import {exactDecimalOperation} from "../home/exact-decimal-operations";

import {
  hasSettlementCurrencyMismatch, executionFeeCurrency,
  tradeNatureOf,
  type TradeExecution,
} from "../trades/types";
import type { MonthlyStatement, StatementPosition, StatementEvent } from "../import/monthly-statement";
import { canonicalInstrumentId } from "../instruments/display-name";
import { executionHasExactTime, executionSourceOrderConflictsWithTime, statementPositionEvidenceKey, statementPositionMatchesExecution, explicitExecutionSourceOrder, executionDocumentKey, isExecutionBackedIpoAllocation, replayCursorAt, replayExecutionAt, statementPositionAt, statementEventAt, withCashInventoryPositions } from "../import/statement-evidence";
import { bonusShareEvidenceKey, collectBonusShareEvidence, isBonusShareEvidence } from "../trades/bonus-share-evidence";
import { resolveIpoAcquisitionCost } from "../trades/ipo-cost";

import {nativeMarketBoundary,nativeExecutionAt,nativeExecutionDay} from './native-boundary';
import {type SourceFifoCategory, type SourceFifoConsumption, type SourceFifoFacts} from './fifo-source-ledger';

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

/** Imported corporate-action quantities are credited deltas, not final balances. */
function confirmsNativeSplit(event:StatementEvent,split:{instrumentId:string;effectiveAt:string;firstSession:string;ratio:string},delta:Decimal|undefined):boolean {
  if(event.kind!=='corporate-action'||!event.symbol||!event.market||!delta||
    canonicalInstrumentId(event.symbol,event.market)!==split.instrumentId||
    ![split.firstSession,split.effectiveAt.slice(0,10)].includes(event.date)||
    !/split|拆股|拆细|拆\s*\d/iu.test(event.description))return false;
  const ratios:Decimal[]=[];
  for(const match of event.description.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*-?\s*for\s*-?\s*(\d+(?:\.\d+)?)(?![\d.])/giu)){
    if(new Decimal(match[2]).isZero())return false;
    ratios.push(new Decimal(match[1]).div(match[2]));
  }
  for(const match of event.description.matchAll(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:拆|[:：])\s*(\d+(?:\.\d+)?)(?![\d.])/gu)){
    if(new Decimal(match[1]).isZero())return false;
    ratios.push(new Decimal(match[2]).div(match[1]));
  }
  if(!ratios.length||ratios.some(r=>!r.eq(split.ratio)))return false;
  try{return event.quantity===undefined||new Decimal(event.quantity).eq(delta);}
  catch{return false;}
}

/** Every time-only ledger transition also invalidates materialization caches and wakes the worker. */
export function nativeEvidenceBoundaries(executions: TradeExecution[], evidence: Pick<MonthlyStatement, 'positions'|'events'|'month'>[],market?:string): string[] {
  const positions = [...evidence.flatMap(s => s.positions), ...executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])])];
  const events = [...evidence.flatMap(s => s.events), ...executions.flatMap(e => e.source.positionEvents ?? [])];
  return [...positions.map(nativePositionAt), ...events.flatMap(e => [nativeEventAt(e), ...(e.date.length === 10 && (e.kind === 'transfer-in' || e.kind === 'transfer-out') ? [nativeTransferAt(e)] : [])]), ...evidence.flatMap(s => { const at = s.month ? nativeMonthAt(s.month,market??executions[0]?.instrument.market) : undefined; return at ? [at] : []; })];
}

/** Exact native facts for background materialization; display snapshots retain their existing format. */
export type NativePositionFacts = {
  splitCostBasis?:true; splitEstimates?: string[]; realizedValuationNotes?: string[]; realizedValuationCount?:number;
  grossContributions?: Record<string,{currency:string;amount:string|null;reasons:string[]}>;
  quantity: string | null; averageCost: string | null; realized: string | null;
  unrealized: string | null; fees: string | null; knownFees: string; openFees: string | null;
  reasons: string[]; closedCount: number;
  /** Monotonic prefixes isolate old missing contributions from later periods. */
  knownRealized: string; realizedMissing: number; feesMissing: number;
  realizedContributions: Record<string, {currency:string;amount:string|null}>;
  closedFeeContributions: Record<string, {currency:string;amount:string|null}>;
  closedFeesByCurrency: Record<string,string>;
  realizedByCurrency: Record<string,string>; openFeesByCurrency: Record<string,string> | null;
  lifetimeComplete: boolean; historicalReasons: string[];
  /** Published only for a fully proven overlapping IPO/ordinary long episode. */
  sourceFifo?: SourceFifoFacts;
};
export function replayPositionAtPrice(input: {
  executions: TradeExecution[];
  /** Native reporting uses market-local evidence boundaries and explicit short evidence. */
  nativeFacts?: (facts: NativePositionFacts) => void;
  certifyOrdinaryLongGross?: true;
  /** Validation failures follow their execution through inventory and prefix accounting. */
  nativeErrors?: ReadonlyMap<string, readonly string[]>;
  /** Native-only verified issuer actions; no source row is synthesized. */
  nativeSplits?: readonly {instrumentId:string;effectiveAt:string;firstSession:string;ratio:string}[];
  markPrice: string;
  cursor?: string;
  /** Exact execution IDs selected by a dual-cursor replay boundary. */
  visibleExecutionIds?: readonly string[];
  /** Explicit identity for statement-only inventory; used only when no executions exist. */
  inventoryIdentity?: { accountId: string; symbol: string; market: string; currency?:string };
  evidence?: (Pick<MonthlyStatement, "positions" | "events"> & Partial<MonthlyStatement>)[];
}): PositionLedgerSnapshot {
  // Never mutate the process-wide Decimal configuration used by legacy consumers.
  const D = input.nativeFacts ? Decimal.clone({ precision: 48 }) : Decimal;
  const certify = !!input.nativeFacts && input.certifyOrdinaryLongGross === true;
  const grossContributions: NonNullable<NativePositionFacts['grossContributions']> = {};
  let precisionTainted = false;
  let quantityPrecisionTainted = false;
  const unsupportedGrossTime = certify && input.executions.some(e=>!Number.isFinite(Date.parse(e.executedAt))||/\.\d{3}\d*[1-9]\d*(?:Z|[+-]\d{2}:\d{2})$/i.test(e.executedAt));
  const exact = (operation:'add'|'subtract'|'multiply'|'divide', a:Decimal,b:Decimal,result:Decimal) => {
    if(certify && !exactDecimalOperation(operation,a.toFixed(),b.toFixed(),result.toFixed())) precisionTainted=true;
    return result;
  };
  const getExecutionAt = (execution:TradeExecution) => input.nativeFacts ? nativeExecutionAt(execution) : replayExecutionAt(execution);
  const getPositionAt = (position: StatementPosition) => input.nativeFacts ? nativePositionAt(position) : statementPositionAt(position);
  const getEventAt = (event: StatementEvent) => input.nativeFacts ? nativeEventAt(event) : ledgerEventAt(event);
  let openFees = new D(0), closedCount = 0;
  let feePoolKnown = true;
  let knownRealized = new D(0), realizedMissing = 0, feesMissing = 0;
  const quoteCurrency = input.executions[0]?.instrument.currency ?? input.inventoryIdentity?.currency ?? 'UNKNOWN';
  const realizedContributions: NativePositionFacts['realizedContributions'] = {};
  const realizedByCurrency: Record<string,string> = {};
  const closedFeeContributions: NativePositionFacts['closedFeeContributions'] = {};
  const closedFeesByCurrency: Record<string,string> = {};
  const feePools: Record<string,Decimal> = {};
  const recordRealized = (key: string, value: Decimal | null, currency=quoteCurrency, closedFee: Decimal | null=null) => {
    realizedContributions[`${key}:${currency}`] = {currency,amount:value?.toFixed()??null};
    closedFeeContributions[`${key}:${currency}`] = {currency,amount:closedFee?.toFixed()??null};
    if (closedFee!==null) closedFeesByCurrency[currency]=new D(closedFeesByCurrency[currency]??0).plus(closedFee).toFixed();
    if (value === null) realizedMissing++;
    else {
      realizedByCurrency[currency]=new D(realizedByCurrency[currency]??0).plus(value).toFixed();
      if(currency===quoteCurrency)knownRealized=knownRealized.plus(value);
    }
  };
  const splitEstimates = new Set<string>(), realizedValuationNotes = new Set<string>();
  const appliedSplits = new Set<string>();
  const splitDeltas = new Map<string,Decimal>();
  let realizedValuationCount=0;
  let splitCostBasis=false;
  const splitIdentity=input.inventoryIdentity??(input.executions[0]?{symbol:input.executions[0].instrument.symbol,market:input.executions[0].instrument.market}:undefined);
  const hasVerifiedSplit=!!input.nativeFacts&&!!splitIdentity&&(input.nativeSplits??[]).some(s=>s.instrumentId===canonicalInstrumentId(splitIdentity.symbol,splitIdentity.market));
  let provenStart = false;
  const historicalReasons = new Set<string>();
  const fifoLots: Array<{sourceKey:string;category:SourceFifoCategory;quantity:Decimal;remaining:Decimal;cashCost:Decimal;at:string}> = [];
  const fifoConsumptions: SourceFifoConsumption[] = [];
  const fifoRealized: Record<SourceFifoCategory,Decimal> = {ipo:new D(0),long:new D(0)};
  const fifoGrossByClosing: Record<string,Decimal> = {};
  const fifoCostByClosing: Record<string,Decimal> = {};
  const fifoGrossByClosingCategory: Record<string,Record<SourceFifoCategory,Decimal>> = {};
  const fifoCostByClosingCategory: Record<string,Record<SourceFifoCategory,Decimal>> = {};
  const fifoFeeByClosingCategory: Record<string,Record<SourceFifoCategory,Decimal>> = {};
  const fifoFeesByCategory:Record<SourceFifoCategory,Decimal>={ipo:new D(0),long:new D(0)};
  const fifoHistoryCategories = new Set<SourceFifoCategory>();
  const fifoCanonicalCloseIds = new Set<string>();
  let fifoCategoryUnsupportedFees = false;
  let fifoInvalid = false;
  let fifoActivationChecked = false;
  let fifoActivated = false;
  let fifoPublishedActive = false;
  const beginFifoEpisode = () => {
    // Category facts are cumulative across flat episodes.  Only the working
    // lots/activation state is reset by recoverFlat; clearing the publication
    // marker here would erase a proven IPO prefix when a later ordinary
    // episode starts.
    return;
  };
  const allocateFees = (key: string, side: 'buy' | 'sell', size: Decimal, fee: Decimal | null, price?: Decimal, feeCurrency=quoteCurrency) => {
    const closes = side === 'sell' ? quantity.gt(0) : quantity.lt(0);
    const closed = closes ? D.min(quantity.abs(), size) : new D(0);
    if (closed.gt(0)) { closedCount++; if(splitEstimates.size)realizedValuationCount++; for(const note of splitEstimates)realizedValuationNotes.add(note); }
    const basisKnown = !quantityUncertain && !pendingTransfers.size && ![...reasons].some(r=>!r.includes('fee'));
    if (!fee) feesMissing++;
    if (closed.gt(0)) {
      if (basisKnown && feePoolKnown && fee && price && size.gt(0)) {
        const gross=(quantity.gt(0) ? price.minus(averageCost) : averageCost.minus(price)).mul(closed);
        const allocated: Record<string,Decimal> = {[quoteCurrency]:new D(0)};
        for(const [currency,pool]of Object.entries(feePools))allocated[currency]=pool.mul(closed).div(quantity.abs());
        allocated[feeCurrency]=(allocated[feeCurrency]??new D(0)).plus(fee.mul(closed).div(size));
        for(const [currency,closedFee]of Object.entries(allocated)){
          recordRealized(key,(currency===quoteCurrency?gross:new D(0)).minus(closedFee),currency,closedFee);
        }
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
  const attachedEvents = [
    ...(input.evidence ?? []).flatMap(e => e.events),
    ...input.executions.flatMap(e => e.source.positionEvents ?? []),
  ];
  const rawEvents = carryGiftAcquisitionEvidence(attachedEvents, attachedEvents);
  const gifts = collectGiftAcquisitionEvidence(rawEvents);
  const bonusEvidence = collectBonusShareEvidence(rawEvents);
  const duplicateBonusKeys = new Set(bonusEvidence.duplicateKeys);
  const events = [...new Map([
    ...bonusEvidence.events,
    ...rawEvents.filter(event => !isBonusShareEvidence(event) && !isGiftAcquisitionEvidence(event)),
    ...gifts.events,
  ].map(event => [`${event.accountId}:${event.id}`, event])).values()];
  // An explicit same-day reversal cancels the quantity evidence, not a sale.
  // Keep cash rows intact: refunds retain their actual recognition dates.
  const cancelledIds = new Set<string>();
  for (const reversal of events) {
    if (reversal.ipoAction !== "ipo-cancellation" || !reversal.reversesEventId || !reversal.quantity) continue;
    if (!reversal.documentId?.trim() || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(reversal.quantity) || !new D(reversal.quantity).lt(0)) continue;
    const allocations = events.filter(allocation => allocation.id === reversal.reversesEventId &&
      allocation.kind === "ipo" && allocation.quantity !== undefined && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(allocation.quantity) &&
      allocation.accountId === reversal.accountId && allocation.documentId === reversal.documentId &&
      allocation.date === reversal.date && allocation.date.length === 10 &&
      allocation.market === reversal.market && !!allocation.market && !!allocation.symbol && !!reversal.symbol &&
      canonicalInstrumentId(allocation.symbol, allocation.market) === canonicalInstrumentId(reversal.symbol, reversal.market!) &&
      new D(allocation.quantity).gt(0) && new D(allocation.quantity).plus(reversal.quantity!).isZero());
    if (allocations.length !== 1 || events.filter(e => e.ipoAction === "ipo-cancellation" && e.accountId === reversal.accountId && e.reversesEventId === reversal.reversesEventId).length !== 1) continue;
    // Date-only cancellation evidence cannot establish its order against a fill.
    if (input.executions.some(e => e.accountId === reversal.accountId &&
      canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(reversal.symbol!, reversal.market!) &&
      (e.source.tradingDate ?? e.source.marketCalendarDate ?? e.executedAt.slice(0, 10)) === reversal.date)) continue;
    cancelledIds.add(`${reversal.accountId}:${reversal.id}`);
    cancelledIds.add(`${allocations[0].accountId}:${allocations[0].id}`);
  }
  const matches = (item: StatementPosition | StatementEvent) => input.executions.some(e =>
    tradeNatureOf(e) !== "simulation" && e.accountId === item.accountId && item.symbol && item.market &&
    canonicalInstrumentId(e.instrument.symbol, e.instrument.market) === canonicalInstrumentId(item.symbol, item.market)) ||
    Boolean(input.executions.length === 0 && input.inventoryIdentity && item.symbol && item.market &&
      input.inventoryIdentity.accountId === item.accountId &&
      canonicalInstrumentId(input.inventoryIdentity.symbol, input.inventoryIdentity.market) === canonicalInstrumentId(item.symbol, item.market));
  type Split = NonNullable<typeof input.nativeSplits>[number];
  type Entry = { split?:Split; ambiguousOrder?:boolean; at: string; execution?: TradeExecution; position?: StatementPosition; event?: StatementEvent; pendingTransfer?: StatementEvent; incomplete?: string };
  const timeline: Entry[] = input.executions.map(execution => ({ at: getExecutionAt(execution), execution }));
  if(input.nativeFacts)for(const split of input.nativeSplits??[]){
    const identity=input.inventoryIdentity??(input.executions[0]?{symbol:input.executions[0].instrument.symbol,market:input.executions[0].instrument.market}:undefined);
    if(identity&&canonicalInstrumentId(identity.symbol,identity.market)===split.instrumentId)timeline.push({at:split.effectiveAt,split});
  }
  const seen = new Set<string>();
  const evidence = input.inventoryIdentity && input.evidence ? withCashInventoryPositions(input.evidence, input.inventoryIdentity, input.executions) : input.evidence ?? [];
  const allPositions = [
    ...evidence.flatMap(e => e.positions),
    ...input.executions.flatMap(e => [...(e.source.statementPositions ?? []), ...(e.source.openingPosition ? [e.source.openingPosition] : [])]),
  ];
  for (const position of allPositions) {
    if (!matches(position)) continue;
    const key = statementPositionEvidenceKey(position);
    if (seen.has(key)) continue;
    seen.add(key);
    timeline.push({ at: getPositionAt(position), position });
  }
  for (const event of events) {
    if (!matches(event) || seen.has(`${event.accountId}:${event.id}`) || cancelledIds.has(`${event.accountId}:${event.id}`)) continue;
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
  {
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
        const at=input.nativeFacts ? nativeMarketBoundary(`${day}T23:59:59.999Z`,rows[0].instrument.market) : `${day}T23:59:59.999Z`;
        const first=rows.map(getExecutionAt).sort()[0];
        for(const boundary of new Set([first,at])){ambiguousAt.add(boundary);timeline.push({at:boundary,ambiguousOrder:true});}
      }
    }
  }
  // A separately reported closing inventory can restore quantity after unknown
  // ordering. Transaction balances cannot establish which row was last.
  for(let i=timeline.length-1;i>=0;i--)if(timeline[i].position?.phase==='closing'&&ambiguousAt.has(timeline[i].at)&&timeline[i].position!.source.some(s=>s.role==='transaction-position'))timeline.splice(i,1);
  const rank = (entry: Entry) => entry.split ? -1 : entry.ambiguousOrder ? 1 : entry.incomplete ? 5 : entry.position ? (entry.position.phase === "opening" ? 0 : 4) : entry.pendingTransfer ? 1 : entry.event ? 2 : 3;
  // Same-day transaction balances belong after their own fill, not after all
  // fills or before all fills. Only durable document/row + explicit source order
  // may interleave date-only rows; a storage array order is not clock evidence.
  // Recall and ordinary replay use the same source evidence as native facts.
  const ordered=new Map<Entry,{document:string;order:number;after:number}>();
  for(const entry of timeline){
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
  const executionBackedIpo = (execution: TradeExecution) => (execution.source.positionEvents ?? []).some(event =>
    event.kind === 'ipo' && event.quantity !== undefined && event.accountId === execution.accountId &&
    event.symbol && event.market && canonicalInstrumentId(event.symbol, event.market) === canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) &&
    isExecutionBackedIpoAllocation(event, [execution]));
  const orderedSourceExecutions = [...actualVisibleExecutions].sort((left, right) =>
    getExecutionAt(left).localeCompare(getExecutionAt(right)) || left.id.localeCompare(right.id));
  const hasProvenOrdinaryLongChain = (execution: TradeExecution) => {
    const start = orderedSourceExecutions.findIndex(item => item.id === execution.id);
    if (start < 0 || execution.side !== 'buy' || executionBackedIpo(execution)) return false;
    // Event-only allotments are inventory too, even though they have no
    // execution row to participate in the execution chain.  Seed the proof
    // with those visible, non-backed IPO quantities so a later ordinary buy
    // is not rejected merely because FIFO consumed the event lot first.
    let balance = visibleEvents
      .filter(event => event.kind === 'ipo' && event.quantity !== undefined &&
        event.accountId === execution.accountId && event.symbol && event.market &&
        canonicalInstrumentId(event.symbol, event.market) === canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) &&
        !isExecutionBackedIpoAllocation(event, actualVisibleExecutions))
      .reduce((sum, event) => sum.plus(new D(event.quantity!)), new D(0));
    // Validate the complete visible inventory chain, not an isolated
    // ordinary-only suffix.  A prior IPO buy is real inventory and must seed
    // the balance; excluding it makes a later ordinary lot appear to be an
    // over-close when FIFO legitimately consumes the IPO lot first.
    for (let i = 0; i < orderedSourceExecutions.length; i++) {
      const item = orderedSourceExecutions[i], size = new D(item.quantity).abs(), effect = item.source.positionEffect;
      if (!size.gt(0) || (effect && effect !== (item.side === 'buy' ? 'open-long' : 'close-long'))) return false;
      balance = item.side === 'buy' ? balance.plus(size) : balance.minus(size);
      if (balance.lt(0)) return false;
    }
    // A visible, internally consistent positive remainder is already a
    // proven ordinary long chain.  Requiring a later flat close made a new
    // ordinary opening disappear from the category facts at its first cursor.
    return orderedSourceExecutions.slice(start).some(item => item.id === execution.id) && balance.gte(0);
  };
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
    if(quantityPrecisionTainted)return;
    precisionTainted = false;
    splitEstimates.clear();splitCostBasis=false;
    fifoPublishedActive = fifoPublishedActive || fifoActivated;
    fifoLots.length = 0;
    fifoActivationChecked = false;
    fifoActivated = false;
    fifoInvalid = false;
    for (const reason of reasons) historicalReasons.add(reason);
    reasons.clear(); averageCost = new D(0); openFees = new D(0); feePoolKnown = true;
    for(const currency of Object.keys(feePools))delete feePools[currency];
  };

  for (const entry of timeline) {
    if (entry.execution && visibleExecutionIds && !visibleExecutionIds.has(entry.execution.id)) continue;
    if (cursor && Date.parse(entry.at) > Date.parse(cursor)
      && !(entry.execution && visibleExecutionIds?.has(entry.execution.id))) continue;
    if(entry.split){
      const split=entry.split;
      if(appliedSplits.has(split.instrumentId))continue;
      appliedSplits.add(split.instrumentId);
      if(quantity.isZero())continue;
      const ratio=new D(split.ratio);
      splitDeltas.set(split.instrumentId,quantity.mul(ratio.minus(1)));
      quantity=quantity.mul(ratio);averageCost=averageCost.div(ratio);splitCostBasis=true;
      splitEstimates.add(`拆股推算：${split.instrumentId.split(':')[1]} 按 1 拆 ${split.ratio} 换算持仓及成本，暂估，待账户凭证确认`);
      continue;
    }
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
      const position=entry.position;
      // A broker cost-bearing position replaces the provisional current lot.
      // Reported cost includes remaining acquisition fees; keep the fee pool,
      // remove it from the kernel's gross basis, and never book a fake sale.
      if(hasVerifiedSplit&&position.cost!==undefined){
        const action=(input.nativeSplits??[]).find(s=>splitIdentity&&s.instrumentId===canonicalInstrumentId(splitIdentity.symbol,splitIdentity.market));
        // A date-only statement for the last regular pre-split session can be
        // known after the legal effective instant. Its inventory is still in
        // that session's old units, so it cannot certify the account split.
        const oldSession=action&&appliedSplits.has(action.instrumentId)&&position.date<action.firstSession;
        const ratio=new D(oldSession?action.ratio:1);
        const next=new D(position.quantity).mul(ratio),cost=new D(position.cost).div(ratio);
        if(next.isFinite()&&cost.isFinite()&&cost.gte(0)&&!pendingTransfers.size){
          if(!next.eq(quantity))recordRealized(`split-reconciliation:${statementPositionEvidenceKey(position)}`,null);
          quantity=next;quantityUncertain=false;
          averageCost=next.isZero()?new D(0):cost.minus(openFees.div(next));
          for(const reason of ['initial-position','unknown-cost','position-gap','position-event','ambiguous-event-order','execution-direction-unavailable'])if(reasons.delete(reason))historicalReasons.add(reason);
          if(!oldSession)splitEstimates.clear();lastActivity=position.date;hasHistory=true;recoverFlat();continue;
        }
      }
      quantityUncertain = false;
      const covered = [
        ...visibleExecutions.filter(e => e.source.statementMonth && executionMatchesPosition(e, entry.position!)).map(e => e.source.statementMonth!),
        ...knownPositions.filter(position => position.accountId === entry.position!.accountId && canonicalInstrumentId(position.symbol, position.market) === canonicalInstrumentId(entry.position!.symbol, entry.position!.market)).map(position => position.date.slice(0, 7)),
        ...evidence.filter(e => e.month && monthEndAt(e.month) !== undefined && visibleAt(input.nativeFacts ? nativeMonthAt(e.month,entry.position!.market)! : monthEndAt(e.month)!) && evidenceCoversMarket(e, entry.position!)).map(e => e.month!),
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
      // A dated broker split confirms the already-applied issuer action.
      // Unrelated or unrecognised actions retain the conservative gap path.
      const split=(input.nativeSplits??[]).find(s=>appliedSplits.has(s.instrumentId)&&confirmsNativeSplit(event,s,splitDeltas.get(s.instrumentId)));
      if(input.nativeFacts&&split){splitEstimates.clear();hasHistory=true;continue;}

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
      } else if (isGiftAcquisitionEvidence(event)) {
        pendingTransfers.delete(`${event.accountId}:${event.id}`);
        const currency = input.inventoryIdentity?.currency ?? actualVisibleExecutions.find(e => e.accountId === event.accountId && e.instrument.market === event.market && canonicalInstrumentId(e.instrument.symbol,e.instrument.market) === canonicalInstrumentId(event.symbol!,event.market!))?.instrument.currency;
        if (currency?.trim().toUpperCase() !== event.giftAcquisition!.currency) reasons.add("currency-conflict");
        if (gifts.duplicateKeys.includes(giftEventIdentity(event))) reasons.add("duplicate-position-event");
        if (sameDayExecution || sameMonthExecution) reasons.add("ambiguous-event-order");
        if (quantity.isNegative()) reasons.add("unknown-cost");
        const knownGift = !quantityUncertain && !pendingTransfers.size && !reasons.size && !historicalReasons.size && quantity.gte(0);
        if (knownGift && !hasHistory && quantity.isZero()) provenStart = true;
        if (input.nativeFacts && knownGift) {
          beginFifoEpisode();
          fifoHistoryCategories.add('long');
          const size = new D(event.quantity!);
          fifoLots.push({sourceKey:`event:${event.accountId}:${event.id}`,category:'long',quantity:size,remaining:size,cashCost:new D(0),at:getEventAt(event)});
        }
        const next = quantity.plus(event.quantity!);
        averageCost = next.isZero() ? new D(0) : averageCost.mul(quantity).div(next);
        quantity = next;
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
        if (cost) {
          fees = fees.plus(cost.feeCost);
          if (input.nativeFacts) {
            beginFifoEpisode();
            fifoHistoryCategories.add('ipo');
            fifoLots.push({
              sourceKey:`event:${event.accountId}:${event.id}`,
              category:'ipo', quantity:size, remaining:size,
              cashCost:new D(cost.cashCost), at:getEventAt(event),
            });
            fifoFeesByCategory.ipo = fifoFeesByCategory.ipo.plus(new D(cost.feeCost));
          }
        }
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
    if (input.nativeFacts && execution.side === 'buy' && execution.source.positionEffect !== 'close-short') {
      const ipoEvent = executionBackedIpo(execution);
      const category = ipoEvent ? 'ipo' : execution.source.positionEffect === 'open-long' || hasProvenOrdinaryLongChain(execution) ? 'long' : undefined;
      if (category) {
        if (executionFeeCurrency(execution) !== quoteCurrency) fifoCategoryUnsupportedFees = true;
        beginFifoEpisode();
        fifoHistoryCategories.add(category);
        fifoLots.push({sourceKey:`execution:${execution.id}`,category,quantity:size,remaining:size,cashCost:price.mul(size),at:getExecutionAt(execution)});
        if (execution.source.feeStatus!=='unknown') fifoFeesByCategory[category]=fifoFeesByCategory[category].plus(new D(execution.fee||0));
      }
    } else if (input.nativeFacts && execution.side === 'sell' && quantity.gt(0)) {
      if (executionFeeCurrency(execution) !== quoteCurrency) fifoCategoryUnsupportedFees = true;
      let remaining = D.min(quantity,size);
      for (const lot of fifoLots) {
        if (remaining.isZero()) break;
        if (lot.remaining.isZero()) continue;
        const consumed=D.min(remaining,lot.remaining),cashCost=lot.cashCost.mul(consumed).div(lot.quantity);
        fifoConsumptions.push({closingId:execution.id,openingSourceKey:lot.sourceKey,category:lot.category,quantity:consumed.toFixed(),cashCost:cashCost.toFixed()});
        fifoRealized[lot.category]=fifoRealized[lot.category].plus(price.mul(consumed).minus(cashCost));
        fifoGrossByClosing[execution.id]=(fifoGrossByClosing[execution.id]??new D(0)).plus(price.mul(consumed));
        fifoCostByClosing[execution.id]=(fifoCostByClosing[execution.id]??new D(0)).plus(cashCost);
        (fifoGrossByClosingCategory[execution.id]??={ipo:new D(0),long:new D(0)})[lot.category]=(fifoGrossByClosingCategory[execution.id][lot.category]??new D(0)).plus(price.mul(consumed));
        (fifoCostByClosingCategory[execution.id]??={ipo:new D(0),long:new D(0)})[lot.category]=(fifoCostByClosingCategory[execution.id][lot.category]??new D(0)).plus(cashCost);
        lot.remaining=lot.remaining.minus(consumed);remaining=remaining.minus(consumed);
      }
      if (!remaining.isZero()) fifoInvalid=true;
      if (fifoActivated) fifoCanonicalCloseIds.add(execution.id);
      if (!fifoInvalid && execution.source.feeStatus!=='unknown' && size.gt(0)) for(const item of fifoConsumptions.filter(item=>item.closingId===execution.id)) {
        const fee=new D(execution.fee||0).mul(item.quantity).div(size);
        fifoFeesByCategory[item.category]=fifoFeesByCategory[item.category].plus(fee);
        (fifoFeeByClosingCategory[execution.id]??={ipo:new D(0),long:new D(0)})[item.category]=(fifoFeeByClosingCategory[execution.id][item.category]??new D(0)).plus(fee);
      }
    }
    if(certify && (resolvedTradeNatureOf(execution)!=='live'||execution.source.positionEvents?.length||execution.source.statementPositions?.length||execution.source.openingPosition||settlement&&settlement.currency!==execution.instrument.currency||execution.instrument.currency!==quoteCurrency)) reasons.add('unsupported-gross-source');
    if(certify && settlement && settlement.currency === execution.instrument.currency) exact('divide',new D(settlement.grossAmount),new D(settlement.quantity),price);
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
        const newQuantity = exact('add',quantity,size,quantity.plus(size));
        if(certify&&!exactDecimalOperation('add',quantity.toFixed(),size.toFixed(),newQuantity.toFixed()))quantityPrecisionTainted=true;
        const oldNumerator = exact('multiply',averageCost,quantity,averageCost.mul(quantity));
        const addedNumerator = exact('multiply',price,size,price.mul(size));
        const numerator = exact('add',oldNumerator,addedNumerator,oldNumerator.plus(addedNumerator));
        averageCost = newQuantity.isZero() ? new D(0) : exact('divide',numerator,newQuantity,numerator.div(newQuantity));
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
      const difference = exact('subtract',price,averageCost,price.minus(averageCost));
      const gross = exact('multiply',difference,closed,difference.mul(closed));
      const nextQuantity = exact('subtract',quantity,size,quantity.minus(size));
      if(certify&&!exactDecimalOperation('subtract',quantity.toFixed(),size.toFixed(),nextQuantity.toFixed()))quantityPrecisionTainted=true;
      if(certify){
        const grossReasons=[...reasons].filter(r=>!r.includes('fee'));
        if(unsupportedGrossTime)grossReasons.push('unsupported-execution-time');
        if(precisionTainted)grossReasons.push('unsupported-gross-precision');
        grossContributions[execution.id]={currency:quoteCurrency,amount:grossReasons.length?null:gross.toFixed(),reasons:grossReasons};
      }
      realizedPnl = realizedPnl.plus(gross);
      quantity = nextQuantity;
      if (quantity.isNegative()) {
        averageCost = price;
        grossCapitalDeployed = grossCapitalDeployed.plus(price.mul(quantity.abs()));
      }
      if (quantity.isZero()) averageCost = new D(0);
    }
    if (input.nativeFacts && !fifoActivationChecked && new Set(fifoLots.map(lot=>lot.category)).size===2) {
      const fifoCost=fifoLots.reduce((sum,lot)=>sum.plus(lot.cashCost.mul(lot.remaining).div(lot.quantity)),new D(0));
      const nativeCost=averageCost.mul(quantity);
      fifoActivationChecked=true;
      if (fifoCost.minus(nativeCost).abs().gt('0.00000000000000000001')) { fifoInvalid=true; reasons.add('mixed-source-cost-conflict'); }
      else {
        fifoActivated=true;
        for (const item of fifoConsumptions) fifoCanonicalCloseIds.add(item.closingId);
      }
    }
    recoverFlat();
  }

  const fifoCategories = new Set<SourceFifoCategory>([...fifoHistoryCategories, ...fifoLots.map(lot => lot.category)]);
  const fifoRemainingByCategory={ipo:fifoLots.filter(lot=>lot.category==='ipo').reduce((n,lot)=>n.plus(lot.remaining),new D(0)),long:fifoLots.filter(lot=>lot.category==='long').reduce((n,lot)=>n.plus(lot.remaining),new D(0))};
  const fifoRemainingCashByCategory={ipo:fifoLots.filter(lot=>lot.category==='ipo').reduce((n,lot)=>n.plus(lot.cashCost.mul(lot.remaining).div(lot.quantity)),new D(0)),long:fifoLots.filter(lot=>lot.category==='long').reduce((n,lot)=>n.plus(lot.cashCost.mul(lot.remaining).div(lot.quantity)),new D(0))};
  const fifoClosingQuantities:Record<string,Decimal>={};
  for(const item of fifoConsumptions)fifoClosingQuantities[item.closingId]=(fifoClosingQuantities[item.closingId]??new D(0)).plus(item.quantity);
  const fifoClosedFeesByCategory={ipo:new D(0),long:new D(0)};
  for(const item of fifoConsumptions){const fee=closedFeeContributions[`execution:${item.closingId}:${quoteCurrency}`]?.amount,total=fifoClosingQuantities[item.closingId];if(fee&&total?.gt(0))fifoClosedFeesByCategory[item.category]=fifoClosedFeesByCategory[item.category].plus(new D(fee).mul(item.quantity).div(total));}
  const fifoOpenFee=new D(feePools[quoteCurrency]??0),fifoRemainingTotal=fifoRemainingByCategory.ipo.plus(fifoRemainingByCategory.long);
  const fifoOpenFeesByCategory={ipo:fifoRemainingTotal.gt(0)?fifoOpenFee.mul(fifoRemainingByCategory.ipo).div(fifoRemainingTotal):new D(0),long:fifoRemainingTotal.gt(0)?fifoOpenFee.mul(fifoRemainingByCategory.long).div(fifoRemainingTotal):new D(0)};
  const fifoShadowNet=fifoRealized.ipo.plus(fifoRealized.long).minus(fifoClosedFeesByCategory.ipo).minus(fifoClosedFeesByCategory.long);
  const singleCategoryConsistent=fifoCategories.size===1 && fifoShadowNet.minus(knownRealized).abs().lte('0.00000000000000000001') &&
    (quantity.isZero() || fifoRemainingCashByCategory.ipo.plus(fifoRemainingCashByCategory.long).minus(averageCost.mul(quantity)).abs().lte('0.00000000000000000001'));
  const mixedPreActivationConsistent=fifoCategories.size===2 && fifoCanonicalCloseIds.size===0 && fifoRemainingCashByCategory.ipo.plus(fifoRemainingCashByCategory.long).minus(averageCost.mul(quantity)).abs().lte('0.00000000000000000001');
  const categoryRealized:Record<SourceFifoCategory,Decimal>={ipo:new D(0),long:new D(0)};
  for(const [closingId,items] of Object.entries(Object.groupBy(fifoConsumptions,item=>item.closingId))){
    if (!items) continue;
    const total=items.reduce((sum,item)=>sum.plus(item.quantity),new D(0));
    const known=realizedContributions[`execution:${closingId}:${quoteCurrency}`]?.amount;
    for(const category of ['ipo','long'] as const){
      const quantityPart=items.filter(item=>item.category===category).reduce((sum,item)=>sum.plus(item.quantity),new D(0));
      if(quantityPart.isZero())continue;
      if(fifoCanonicalCloseIds.has(closingId)) {
        const totalClosedFee=closedFeeContributions[`execution:${closingId}:${quoteCurrency}`]?.amount;
        const allocatedFee=totalClosedFee!==undefined&&totalClosedFee!==null&&total.gt(0)?new D(totalClosedFee).mul(quantityPart).div(total):new D(0);
        categoryRealized[category]=categoryRealized[category].plus((fifoGrossByClosingCategory[closingId]?.[category]??new D(0)).minus(fifoCostByClosingCategory[closingId]?.[category]??0).minus(allocatedFee));
      }
      else if(known!==undefined&&known!==null&&total.gt(0)) categoryRealized[category]=categoryRealized[category].plus(new D(known).mul(quantityPart).div(total));
    }
  }
  const categoryRemainingCash = (fifoActivated || mixedPreActivationConsistent)
    ? fifoRemainingCashByCategory
    : {ipo:quantity.gt(0)&&fifoRemainingByCategory.ipo.gt(0)?averageCost.mul(quantity).mul(fifoRemainingByCategory.ipo).div(fifoRemainingTotal):new D(0),long:quantity.gt(0)&&fifoRemainingByCategory.long.gt(0)?averageCost.mul(quantity).mul(fifoRemainingByCategory.long).div(fifoRemainingTotal):new D(0)};
  const sourceFifo: SourceFifoFacts | undefined = input.nativeFacts && !fifoInvalid && !fifoCategoryUnsupportedFees && fifoCategories.size>0 && (fifoCanonicalCloseIds.size>0 || singleCategoryConsistent || mixedPreActivationConsistent) && !quantityUncertain && !pendingTransfers.size && !reasons.size && !historicalReasons.size && realizedMissing===0 && feesMissing===0
    ? {
      version:1,activated:fifoActivated,consumptions:fifoConsumptions,
      remaining:fifoLots.filter(lot=>!lot.remaining.isZero()).map(lot=>({sourceKey:lot.sourceKey,category:lot.category,quantity:lot.remaining.toFixed(),cashCost:lot.cashCost.mul(lot.remaining).div(lot.quantity).toFixed()})),
      realizedByCategory:{ipo:categoryRealized.ipo.toFixed(),long:categoryRealized.long.toFixed()},
      closedFeesByCategory:{ipo:fifoClosedFeesByCategory.ipo.toFixed(),long:fifoClosedFeesByCategory.long.toFixed()},
      feesByCategory:{ipo:fifoFeesByCategory.ipo.toFixed(),long:fifoFeesByCategory.long.toFixed()},
      openFeesByCategory:{ipo:fifoOpenFeesByCategory.ipo.toFixed(),long:fifoOpenFeesByCategory.long.toFixed()},
      remainingCashCostByCategory:{ipo:categoryRemainingCash.ipo.toFixed(),long:categoryRemainingCash.long.toFixed()},
      remainingByCategory:{ipo:fifoRemainingByCategory.ipo.toFixed(),long:fifoRemainingByCategory.long.toFixed()},
    }
    : undefined;
  if (fifoCanonicalCloseIds.size) {
    // Apply only the closes proven after the mixed-source cost check.  The
    // legacy MA prefix and any later pure episode remain untouched.
    for (const closingId of fifoCanonicalCloseIds) {
      const key=`execution:${closingId}:${quoteCurrency}`;
      const fee=closedFeeContributions[key]?.amount;
      const fifoNet=(fifoGrossByClosing[closingId]??new D(0)).minus(fifoCostByClosing[closingId]??0).minus(fee??'0');
      const previous=realizedContributions[key]?.amount;
      if (previous!==undefined && previous!==null && fee!==undefined && fee!==null) {
        const delta=fifoNet.minus(previous);
        realizedPnl=realizedPnl.plus(delta);
        knownRealized=knownRealized.plus(delta);
        realizedContributions[key]={currency:quoteCurrency,amount:fifoNet.toFixed()};
      }
    }
    realizedByCurrency[quoteCurrency]=knownRealized.toFixed();
    const remainingCash=fifoLots.reduce((sum,lot)=>sum.plus(lot.cashCost.mul(lot.remaining).div(lot.quantity)),new D(0));
    if (fifoActivated && quantity.gt(0)) averageCost=remainingCash.div(quantity);
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
      ...(certify ? {grossContributions} : {}),
      ...(splitCostBasis?{splitCostBasis:true as const}:{}),
      splitEstimates:[...splitEstimates],realizedValuationNotes:[...realizedValuationNotes],realizedValuationCount,
      quantity: quantityKnown ? quantity.toFixed() : null,
      averageCost: costKnown ? averageCost.toFixed() : null,
      realized: !quantityKnown || realizedMissing > 0 || Object.entries(realizedByCurrency).some(([c,v])=>c!==quoteCurrency&&!new D(v).isZero()) ? null : knownRealized.toFixed(),
      unrealized: quantityKnown && quantity.isZero() ? '0' : costKnown && feesKnown && !Object.entries(feePools).some(([c,v])=>c!==quoteCurrency&&!v.isZero()) ? unrealizedPnl.minus(openFees).toFixed() : null,
      fees: feesMissing === 0 ? fees.toFixed() : null, knownFees: fees.toFixed(),
      openFees: feesKnown ? openFees.toFixed() : null,
      reasons: [...reasons], closedCount, knownRealized: knownRealized.toFixed(), realizedMissing, feesMissing, realizedContributions, realizedByCurrency, closedFeeContributions, closedFeesByCurrency,
      openFeesByCurrency:feesKnown?Object.fromEntries(Object.entries(feePools).map(([c,v])=>[c,v.toFixed()])):null,
      historicalReasons: [...historicalReasons], lifetimeComplete: (!hasHistory || provenStart) && historicalReasons.size === 0 && reasons.size === 0 && realizedMissing === 0 && feesMissing === 0,
      ...(sourceFifo ? {sourceFifo} : {}),
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
