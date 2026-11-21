import {validateLongPairingOrder,type LongPairingQuantity} from './long-pairing-order';
import {createHash} from 'node:crypto';
import Decimal from 'decimal.js';
import {tradeNatureOf,type TradeExecution} from '../trades/types';
import {replayPositionAtPrice,type NativePositionFacts} from '../replay/position-ledger';
import type {PairingScope} from './business-pairing-store';
import {executionContentVersion,type ExecutionContentRef} from './execution-content-ref';
import {validateChronologicalExecutionGroup} from './atomic-execution-group';
import {readExecutionMoneyEvidence} from './execution-money-evidence';
import {allocateLongFeePool,sumFeeAmounts,type FeeAmount} from './long-fee-pool';
import {exactDecimalOperation,sumExactDecimals} from './exact-decimal-operations';

export type InterleavedAccountingInput={scope:PairingScope;sourceSequence:number;refs:ExecutionContentRef[];sourceIssues:string[];sourceDependencyFingerprint:string};
type Money={currency:string;value:string|null;reasons:string[]};
type ParentFeeAllocation={executionId:string;contentRef:ExecutionContentRef;currency:string;sourceValue:string|null;valueStatus:'known'|'unknown';exactConserved:boolean|null;decimalComplete:boolean;fills:{page:number;row:number;quantity:string;value:string|null;reasons:string[]}[]};
export type InterleavedAccountingDiagnostic={
 policy:'source-fill-accounting-v1';scope:PairingScope;sourceSequence:number;fingerprint:string;refs:ExecutionContentRef[];sourceDependencyFingerprint:string;
 startingInventory:'assumed-zero';universeComplete:false;feeAllocationPolicy:'parent-quantity-pro-rata-diagnostic-v1';
 status:'ready'|'blocked'|'not-applicable';reasons:string[];
 closes:{executionId:string;contentRef:ExecutionContentRef;quantity:string;cost:Money;gross:Money;net:Money;entryFees:FeeAmount[];exitFees:FeeAmount[];totalFees:FeeAmount[]}[];
 remainingFees:FeeAmount[];parentFeeAllocations:ParentFeeAllocation[];
};
// These rows never escape this module or replace persisted executions/refs.
type Projected={execution:TradeExecution;parentId:string;contentRef:ExecutionContentRef;location:{page:number;row:number}|null;time:number;fee:{currency:string;value:string|null};saleGross:string|null};
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const unique=(values:string[])=>[...new Set(values)].sort();
const decimal=(v:unknown,positive=false):v is string=>typeof v==='string'&&v.length<=1024&&/^\d+(?:\.\d+)?(?![\s\S])/.test(v)&&(!positive||/[1-9]/.test(v));
const currency=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z]{3}(?![\s\S])/.test(v)&&v!=='XXX';
const negate=(value:string)=>value.startsWith('-')?value.slice(1):`-${value}`;
function instant(value:unknown):number|null {
 if(typeof value!=='string')return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})(?![\s\S])/.exec(value);
 if(!m||/[1-9]/.test((m[7]??'').slice(3)))return null;
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1]||Number(m[4])>23||Number(m[5])>59||Number(m[6])>59)return null;
 if(m[8]!=='Z'&&(Number(m[8].slice(1,3))>23||Number(m[8].slice(4))>59))return null;
 const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
// Only quote turnover is multiplied here; inventory cost remains ledger-owned.
function quoteGross(e:TradeExecution):string|null {
 const D=Decimal.clone({precision:2048}),product=new D(e.quantity).mul(e.price).toFixed();
 return exactDecimalOperation('multiply',e.quantity,e.price,product)?sumExactDecimals([product]):null;
}
function aggregateMoney(parts:Money[],currency:string):Money {
 const reasons=unique(parts.flatMap(p=>[...p.reasons,...(p.currency!==currency?['mixed-quote-currency']:[])]));
 const value=reasons.length||parts.some(p=>p.value===null)?null:sumExactDecimals(parts.map(p=>p.value!));
 return {currency,value,reasons:value===null&&!reasons.length?['unsupported-gross-precision']:reasons};
}

type ProjectionProof={status:'ready'|'blocked'|'not-applicable';reasons:string[];projected:Projected[];allocations:ParentFeeAllocation[]};
// Complete source qualification is shared; projected executions remain private.
function proveProjection(input:InterleavedAccountingInput,executions:readonly TradeExecution[],refs:ExecutionContentRef[]):ProjectionProof {
 const fail=(issues:string[]):ProjectionProof=>({status:'blocked',reasons:unique(issues),projected:[],allocations:[]});
 try {
  if(!executions.some(e=>e.source.executionGroup!==undefined))return {status:'not-applicable',reasons:[],projected:[],allocations:[]};
  const issues=[...input.sourceIssues],ids=new Set<string>(),refIndex=new Map<string,ExecutionContentRef>();
  if(!/^[a-fA-F0-9]{64}$/.test(input.sourceDependencyFingerprint))issues.push('invalid-source-dependency-fingerprint');
  for(const ref of refs){
   if(refIndex.has(ref.executionId)||ref.schemaVersion!==1||!/^[a-fA-F0-9]{64}$/.test(ref.rawVersion)||!/^[a-fA-F0-9]{64}$/.test(ref.effectiveVersion))issues.push('snapshot-content-ref-mismatch');
   refIndex.set(ref.executionId,ref);
  }
  if(refs.length!==executions.length)issues.push('snapshot-content-ref-mismatch');
  const money=new Map<string,ReturnType<typeof readExecutionMoneyEvidence>>();
  for(const e of executions){
   if(typeof e.id!=='string'||!e.id.trim()||ids.has(e.id))issues.push('duplicate-or-invalid-execution-id');ids.add(e.id);
   if(e.accountId!==input.scope.accountId||e.instrument.id!==input.scope.instrumentId||refIndex.get(e.id)?.effectiveVersion!==executionContentVersion(e,'effective'))issues.push('snapshot-content-ref-mismatch');
   if(e.side!=='buy'&&e.side!=='sell'||!decimal(e.quantity,true)||!decimal(e.price)||!decimal(e.fee)||!currency(e.instrument.currency))issues.push('invalid-execution-number-or-side');
   const s=e.source;
   if(tradeNatureOf(e)!=='live'||s.openingPosition||s.statementPositions?.length||s.positionEvents?.length||s.historyIncomplete?.length||s.tradingSession==='grey-market'||s.positionEffect!==undefined&&s.positionEffect!==(e.side==='buy'?'open-long':'close-long'))issues.push('unsupported-execution-source');
   if(s.timeCandidates?.length||instant(e.executedAt)===null||s.timePrecision!=='second'||!['row','document','user'].includes(s.timeEvidence??'')||s.sourceTimeKind!==undefined&&s.sourceTimeKind!=='execution')issues.push('unsupported-execution-time');
   issues.push(...validateChronologicalExecutionGroup(e).issues);
   const evidence=readExecutionMoneyEvidence(e);money.set(e.id,evidence);
   for(const part of Object.values(evidence))if(part.status==='invalid')issues.push(...part.reasons);
  }
  if(issues.length)return fail(issues);
  const projected:Projected[]=[],locations=new Set<string>(),allocations:ParentFeeAllocation[]=[];
  const registerLocation=(e:TradeExecution,page:number|undefined,row:number)=>{
   const file=e.source.fileFingerprint;
   // No inferred identity/deduplication when the source lacks a file or page.
   if(!file||page===undefined)return;
   const key=JSON.stringify([file,page,row]);
   if(locations.has(key))issues.push('duplicate-source-location');locations.add(key);
  };
  for(const e of executions){
   const evidence=money.get(e.id)!,fee={currency:evidence.fee.currency,value:evidence.fee.value},contentRef=refIndex.get(e.id)!;
   const group=e.source.executionGroup;
   if(!group){
    registerLocation(e,e.source.page,e.source.row);
    const time=instant(e.executedAt)!;
    projected.push({execution:{...e,id:`interleaved:whole:${JSON.stringify([e.id])}`,executedAt:new Date(time).toISOString()},parentId:e.id,contentRef,location:null,time,fee,saleGross:evidence.settlementGross.status==='known'&&evidence.settlementGross.currency===e.instrument.currency?evidence.settlementGross.value:quoteGross(e)});
    continue;
   }
   const ordered=[...group.fills].sort((a,b)=>instant(a.executedAt)!-instant(b.executedAt)!);
   const pool=allocateLongFeePool([{executionId:'parent',side:'buy',quantity:e.quantity,fee},...ordered.map(f=>({executionId:JSON.stringify([f.page,f.row]),side:'sell' as const,quantity:f.quantity,fee:{currency:fee.currency,value:'0'}}))]);
   if(!pool.valid){issues.push(...pool.issues.map(i=>i.code));continue;}
   const conservation=pool.sourceConservation.find(s=>s.executionId==='parent')!;
   const allocation:ParentFeeAllocation={executionId:e.id,contentRef:{...contentRef},currency:fee.currency,sourceValue:evidence.fee.value,valueStatus:evidence.fee.status==='known'?'known':'unknown',exactConserved:conservation.exactConserved,decimalComplete:conservation.decimalComplete,fills:[]};
   for(const fill of ordered){
    registerLocation(e,fill.page,fill.row);
    const share=pool.entryAllocations.find(a=>a.closingExecutionId===JSON.stringify([fill.page,fill.row]))!.amount;
    allocation.fills.push({page:fill.page,row:fill.row,quantity:fill.quantity,value:share.value,reasons:[...share.reasons]});
    const source={...e.source};
    // Never inherit parent money, dates, or ambiguous time candidates into a fill.
    for(const key of ['executionGroup','settlement','grossAmount','cashChange','tradingDate','marketCalendarDate','timeCandidates','timeInferenceReason','sourceTimestampText','sourceTimezone','displayTimePolicy','settlementDate'] as const)delete source[key];
    Object.assign(source,{page:fill.page,row:fill.row,timePrecision:fill.timePrecision,timeEvidence:fill.timeEvidence,sourceTimeKind:'execution',feeStatus:share.value===null?'unknown':'allocated'});
    const time=instant(fill.executedAt)!;
    projected.push({execution:{...e,id:`interleaved:fill:${JSON.stringify([e.id,fill.page,fill.row])}`,source,executedAt:new Date(time).toISOString(),quantity:fill.quantity,price:fill.price,fee:share.value??'0'},parentId:e.id,contentRef,location:{page:fill.page,row:fill.row},time,fee:{currency:fee.currency,value:share.value},saleGross:fill.grossAmount});
   }
   allocations.push(allocation);
  }
  projected.sort((a,b)=>a.time-b.time);
  for(let i=1;i<projected.length;i++)if(projected[i].time===projected[i-1].time)issues.push('ambiguous-simultaneous-executions');
  if(issues.length)return fail(issues);
  return {status:'ready',reasons:[],projected,allocations};
 }catch{return fail(['invalid-execution-structure']);}
}

/** Final complete-scope diagnostic, with an explicit assumed-zero starting inventory.
 * Parent quantity prorating is a diagnostic policy, never broker fill fee evidence. */
export function buildInterleavedAccountingDiagnostic(input:InterleavedAccountingInput,executions:readonly TradeExecution[]):InterleavedAccountingDiagnostic {
 const refs=input.refs.map(r=>({...r})).sort((a,b)=>compare(JSON.stringify([a.executionId,a.schemaVersion,a.rawVersion,a.effectiveVersion]),JSON.stringify([b.executionId,b.schemaVersion,b.rawVersion,b.effectiveVersion])));
 const result:InterleavedAccountingDiagnostic={policy:'source-fill-accounting-v1',scope:{...input.scope},sourceSequence:input.sourceSequence,fingerprint:'',refs,sourceDependencyFingerprint:input.sourceDependencyFingerprint,startingInventory:'assumed-zero',universeComplete:false,feeAllocationPolicy:'parent-quantity-pro-rata-diagnostic-v1',status:'blocked',reasons:[],closes:[],remainingFees:[],parentFeeAllocations:[]};
 // Explicit tuples make fingerprint stable under object insertion order as well as array order.
 result.fingerprint=createHash('sha256').update(JSON.stringify([result.policy,result.feeAllocationPolicy,input.scope.accountId,input.scope.instrumentId,result.startingInventory,refs.map(r=>[r.executionId,r.schemaVersion,r.rawVersion,r.effectiveVersion]).sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b))),[...input.sourceIssues].sort(),input.sourceDependencyFingerprint])).digest('hex');
 const fail=(issues:string[])=>{result.status='blocked';result.reasons=unique(issues);result.closes=[];result.remainingFees=[];result.parentFeeAllocations=[];return result;};
 try {
  const proof=proveProjection(input,executions,refs);
  if(proof.status==='not-applicable'){result.status='not-applicable';return result;}
  if(proof.status==='blocked')return fail(proof.reasons);
  const {projected,allocations}=proof;
  const fees=allocateLongFeePool(projected.map(p=>({executionId:p.execution.id,side:p.execution.side,quantity:p.execution.quantity,fee:p.fee})));
  if(!fees.valid)return fail(fees.issues.map(i=>i.code));
  let facts:NativePositionFacts|undefined;
  replayPositionAtPrice({executions:projected.map(p=>p.execution),markPrice:'0',cursor:'9999-12-31T23:59:59.999Z',visibleExecutionIds:projected.map(p=>p.execution.id),certifyOrdinaryLongGross:true,nativeFacts:value=>{facts=value;}});
  const mixed=unique(executions.map(e=>e.instrument.currency)).length!==1;
  const cross=executions.some(e=>e.source.settlement&&e.source.settlement.currency!==e.instrument.currency);
  const feeCloses=new Map(fees.closes.map(c=>[c.closingExecutionId,c]));
  const sellers=new Map<string,Projected[]>();
  for(const p of projected)if(p.execution.side==='sell'){const rows=sellers.get(p.parentId)??[];rows.push(p);sellers.set(p.parentId,rows);}
  for(const [parentId,rows] of sellers){
   const currency=rows[0].execution.instrument.currency;
   const grossParts:Money[]=rows.map(p=>{
    const contribution=facts?.grossContributions?.[p.execution.id];
    const reasons=unique([...(mixed?['mixed-quote-currency']:[]),...(cross?['cross-currency-settlement']:[]),...(contribution?.reasons??['gross-contribution-unavailable'])]);
    return {currency,value:reasons.length?null:contribution?.amount??null,reasons};
   });
   const gross=aggregateMoney(grossParts,currency);
   const cost=aggregateMoney(rows.map((p,i)=>{const g=grossParts[i];return {currency,value:g.value===null||p.saleGross===null?null:sumExactDecimals([p.saleGross,negate(g.value)]),reasons:[...g.reasons,...(p.saleGross===null?['quote-turnover-unavailable']:[])]};}),currency);
   const parts=rows.map(p=>feeCloses.get(p.execution.id)!);
   const entryFees=sumFeeAmounts(parts.flatMap(p=>p.entry)),exitFees=sumFeeAmounts(parts.flatMap(p=>p.exit)),totalFees=sumFeeAmounts(parts.flatMap(p=>p.total));
   const netReasons=unique([...gross.reasons,...totalFees.flatMap(f=>[...f.reasons,...(f.currency!==currency?['cross-currency-fees']:[]),...(f.value===null?['unknown-fees']:[])])]);
   const netValue=gross.value===null||netReasons.length?null:sumExactDecimals([gross.value,...totalFees.map(f=>negate(f.value!))]);
   result.closes.push({executionId:parentId,contentRef:{...rows[0].contentRef},quantity:sumExactDecimals(rows.map(p=>p.execution.quantity))!,cost,gross,net:{currency,value:netValue,reasons:netValue===null&&!netReasons.length?['unsupported-net-precision']:netReasons},entryFees,exitFees,totalFees});
  }
  result.status='ready';result.remainingFees=fees.remaining;result.parentFeeAllocations=allocations.sort((a,b)=>compare(a.executionId,b.executionId));
  return result;
 }catch{return fail(['invalid-execution-structure']);}
}

export const INTERLEAVED_PAIRING_POLICY='ordinary-live-long-fill-lifo-v1';
export type InterleavedPairingDiagnostic={policy:typeof INTERLEAVED_PAIRING_POLICY;status:'ready'|'blocked'|'not-applicable';reasons:string[];refs:ExecutionContentRef[];sourceProofFingerprint:string};
/** Quantity confirmation only: command members never enter the source identity. */
export function buildInterleavedPairingDiagnostic(input:InterleavedAccountingInput,executions:readonly TradeExecution[],command:{confirmedClosingExecutionIds:readonly string[];pairings:readonly LongPairingQuantity[]}):InterleavedPairingDiagnostic {
 const refs=input.refs.map(r=>({...r})).sort((a,b)=>compare(JSON.stringify([a.executionId,a.schemaVersion,a.rawVersion,a.effectiveVersion]),JSON.stringify([b.executionId,b.schemaVersion,b.rawVersion,b.effectiveVersion])));
 const sourceProofFingerprint=createHash('sha256').update(JSON.stringify(['source-fill-quantity-proof-v1',input.scope.accountId,input.scope.instrumentId,'assumed-zero',refs.map(r=>[r.executionId,r.schemaVersion,r.rawVersion,r.effectiveVersion]),[...input.sourceIssues].sort(),input.sourceDependencyFingerprint])).digest('hex');
 const proof=proveProjection(input,executions,refs);
 const result:InterleavedPairingDiagnostic={policy:INTERLEAVED_PAIRING_POLICY,status:proof.status,reasons:proof.reasons,refs,sourceProofFingerprint};
 if(proof.status!=='ready')return result;
 const order=validateLongPairingOrder({executions:proof.projected.map(p=>({executionId:p.execution.id,parentExecutionId:p.parentId,side:p.execution.side,executedAt:p.execution.executedAt,quantity:p.execution.quantity})),...command});
 if(!order.valid){result.status='blocked';result.reasons=unique(order.issues.map(i=>i.code));}
 return result;
}
