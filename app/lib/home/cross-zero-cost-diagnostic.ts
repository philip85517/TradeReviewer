import {createHash} from 'node:crypto';
import type {CrossZeroDiagnostic,PairingScope} from './business-pairing-store';
import {tradeNatureOf,type TradeExecution} from '../trades/types';
import type {ExecutionContentRef} from './execution-content-ref';
import {buildCrossZeroMoneyDiagnostic} from './cross-zero-money-diagnostic';
import {readExecutionMoneyEvidence} from './execution-money-evidence';
import {allocateLongFeePool,type FeeAmount} from './long-fee-pool';
import {replayPositionAtPrice,type NativePositionFacts} from '../replay/position-ledger';
import {sumExactDecimals} from './exact-decimal-operations';

type Money={currency:string;value:string|null;reasons:string[]};
export type CrossZeroCostDiagnostic={
 policy:'source-cross-zero-cost-v1';scope:PairingScope;sourceSequence:number;
 quantityFingerprint:string;moneyFingerprint:string;fingerprint:string;refs:ExecutionContentRef[];
 startingInventory:'assumed-zero';universeComplete:false;status:'ready'|'blocked'|'not-applicable';reasons:string[];
 closeLong:null|{
  executionId:string;contentRef:ExecutionContentRef;sourceQuantity:string;quantity:string;openShortQuantity:string;
  projection:'derived-close-long-prefix';cost:Money;gross:Money;net:Money;
  entryFees:FeeAmount[];exitFees:FeeAmount[];totalFees:FeeAmount[];
 };
};
const unique=(reasons:string[])=>[...new Set(reasons)];
const negate=(value:string)=>value.startsWith('-')?value.slice(1):'-'+value;
// Called only after the money adapter has validated complete, unambiguous times.
// Date.parse alone loses the fractional ordering needed by the exact fee pool.
function time(value:string){
 const m=/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value)!;
 return {second:Date.parse(m[1]+m[3]),fraction:m[2]??''};
}

/** Accounting-only projection. The caller supplies the complete eligible source
 * scope; money revalidates its original refs and quantity proof here. No projected
 * execution, pairing fact or confirmation is returned or persisted. */
export function buildCrossZeroCostDiagnostic(quantity:CrossZeroDiagnostic,executions:readonly TradeExecution[]):CrossZeroCostDiagnostic{
 const money=buildCrossZeroMoneyDiagnostic(quantity,executions),policy='source-cross-zero-cost-v1';
 const result:CrossZeroCostDiagnostic={
  policy,scope:{...money.scope},sourceSequence:money.sourceSequence,quantityFingerprint:money.quantityFingerprint,
  moneyFingerprint:money.fingerprint,fingerprint:createHash('sha256').update(JSON.stringify([policy,money.fingerprint])).digest('hex'),
  refs:money.refs.map(r=>({...r})),startingInventory:'assumed-zero',universeComplete:false,
  status:money.status==='not-applicable'?'not-applicable':'blocked',reasons:[...money.reasons],closeLong:null,
 };
 if(money.status!=='allocated'||!money.crossing)return result;
 const crossing=money.crossing;
 const sourceIssues:string[]=[];
 for(const e of executions){
  const s=e.source;
  if(tradeNatureOf(e)!=='live'||s.openingPosition||s.statementPositions?.length||s.positionEvents?.length||s.historyIncomplete?.length||s.tradingSession==='grey-market'||s.positionEffect&&s.positionEffect!==(e.side==='buy'?'open-long':'close-long'))sourceIssues.push('unsupported-inventory-or-direction');
  if(s.executionGroup!==undefined)sourceIssues.push('aggregated-fill-time-unsupported');
  if(s.timePrecision==='date-only'||s.sourceTimeKind==='date'||s.sourceTimeKind==='order'||s.timeEvidence==='inferred'||s.timeCandidates?.length)sourceIssues.push('unproven-execution-time');
  if(e.id===crossing.executionId&&s.positionEffect==='close-long')sourceIssues.push('explicit-close-long-crossing');
 }
 if(sourceIssues.length){result.reasons=unique(sourceIssues);return result;}
 const ordered=executions.map(e=>({e,t:time(e.executedAt)})).sort((a,b)=>{
  if(a.t.second!==b.t.second)return a.t.second-b.t.second;
  const width=Math.max(a.t.fraction.length,b.t.fraction.length);
  return a.t.fraction.padEnd(width,'0').localeCompare(b.t.fraction.padEnd(width,'0'));
 }).map(({e})=>e);
 // Read every ORIGINAL settlement before stripping anything from the last sell.
 // Prefix settlement prices are authoritative, so no quote comparison is passed.
 const evidence=new Map(ordered.map(e=>[e.id,readExecutionMoneyEvidence(e)]));
 const invalid=unique([...evidence.values()].flatMap(v=>Object.values(v).flatMap(a=>a.status==='invalid'?a.reasons:[])));
 if(invalid.length){result.reasons=invalid;return result;}
 const quote=crossing.amounts.find(a=>a.kind==='quote-gross')!;
 const exit=crossing.amounts.find(a=>a.kind==='fee')!;
 const currency=quote.currency;
 const unsupported:string[]=[];
 for(const e of ordered){
  if(e.instrument.currency!==currency||e.source.settlement&&e.source.settlement.currency!==e.instrument.currency)unsupported.push('unsupported-pnl-currency');
  if(/\.\d{3}\d*[1-9]\d*(?:Z|[+-]\d{2}:\d{2})$/i.test(e.executedAt))unsupported.push('unsupported-execution-time');
 }
 const projected=ordered.map(e=>{
  if(e.id!==crossing.executionId)return e;
  const source={...e.source};
  delete source.settlement;delete source.grossAmount;delete source.cashChange;
  // This fee placeholder is private and explicitly unknown. Only gross
  // contributions are consumed from the ledger, never its realized/net/fees.
  if(exit.closeLongValue===null)source.feeStatus='unknown';
  return {...e,source,quantity:crossing.closeLongQuantity,fee:exit.closeLongValue??'0'};
 });
 const pool=allocateLongFeePool(projected.map(e=>({executionId:e.id,side:e.side,quantity:e.quantity,fee:e.id===crossing.executionId?{currency:exit.currency,value:exit.closeLongValue}:{currency:evidence.get(e.id)!.fee.currency,value:evidence.get(e.id)!.fee.value}})));
 if(!pool.valid){result.reasons=pool.issues.map(i=>i.code);return result;}
 const closeFees=pool.closes.find(c=>c.closingExecutionId===crossing.executionId)!;
 const entryReasons=unique(pool.entryAllocations.filter(a=>a.closingExecutionId===crossing.executionId&&a.amount.value===null).flatMap(a=>evidence.get(a.openingExecutionId)!.fee.reasons));
 const addReasons=(amounts:FeeAmount[],reasons:string[])=>amounts.map(a=>({...a,reasons:unique([...a.reasons,...(a.value===null?reasons:[])])}));
 const entryFees=addReasons(closeFees.entry,entryReasons),exitFees=addReasons(closeFees.exit,exit.reasons),totalFees=addReasons(closeFees.total,[...entryReasons,...exit.reasons]);
 let facts:NativePositionFacts|undefined;
 if(!unsupported.length)replayPositionAtPrice({executions:projected,markPrice:'0',cursor:'9999-12-31T23:59:59.999Z',visibleExecutionIds:projected.map(e=>e.id),certifyOrdinaryLongGross:true,nativeFacts:value=>{facts=value;}});
 const contribution=facts?.grossContributions?.[crossing.executionId];
 const grossReasons=unique([...unsupported,...(unsupported.length?[]:contribution?.reasons??['gross-contribution-unavailable'])]);
 if(contribution&&contribution.currency!==currency)grossReasons.push('unsupported-pnl-currency');
 const gross:Money={currency,value:grossReasons.length?null:contribution?.amount??null,reasons:grossReasons};
 if(gross.value===null&&!gross.reasons.length)gross.reasons.push('gross-contribution-unavailable');
 const costReasons=unique([...gross.reasons,...(quote.closeLongValue===null?quote.reasons:[])]);
 const costValue=gross.value===null||quote.closeLongValue===null?null:sumExactDecimals([quote.closeLongValue,negate(gross.value)]);
 if(costValue===null&&!costReasons.length)costReasons.push('unsupported-cost-precision');
 const cost:Money={currency,value:costValue,reasons:costReasons};
 const netReasons=[...gross.reasons];
 if(totalFees.some(a=>a.currency!==currency))netReasons.push('cross-currency-fees');
 if(totalFees.some(a=>a.value===null))netReasons.push('fees-unavailable',...totalFees.flatMap(a=>a.reasons));
 const netValue=gross.value===null||netReasons.length?null:sumExactDecimals([gross.value,...totalFees.map(a=>negate(a.value!))]);
 if(netValue===null&&!netReasons.length)netReasons.push('unsupported-net-precision');
 const net:Money={currency,value:netValue,reasons:unique(netReasons)};
 result.status='ready';result.reasons=unique([...gross.reasons,...cost.reasons,...net.reasons,...entryFees.flatMap(a=>a.reasons),...exitFees.flatMap(a=>a.reasons)]);
 result.closeLong={executionId:crossing.executionId,contentRef:{...crossing.contentRef},sourceQuantity:crossing.sourceQuantity,quantity:crossing.closeLongQuantity,openShortQuantity:crossing.openShortQuantity,projection:'derived-close-long-prefix',cost,gross,net,entryFees,exitFees,totalFees};
 return result;
}
