import {createHash} from 'node:crypto';
import type {CrossZeroDiagnostic,PairingScope} from './business-pairing-store';
import type {TradeExecution} from '../trades/types';
import {readExecutionMoneyEvidence} from './execution-money-evidence';
import {executionContentVersion,type ExecutionContentRef} from './execution-content-ref';
import {diagnoseCrossZeroQuantity} from './cross-zero-quantity';
import {validateLongPairingOrder} from './long-pairing-order';

export type CrossZeroMoneyAmount={
 kind:'quote-gross'|'fee'|'settlement-gross'|'settlement-net';currency:string;
 sourceValue:string|null;closeLongValue:string|null;openShortValue:string|null;
 status:'conserved'|'unknown'|'invalid';reasons:string[];
};
export type CrossZeroMoneyDiagnostic={
 policy:'source-cross-zero-money-v1';scope:PairingScope;sourceSequence:number;quantityFingerprint:string;fingerprint:string;refs:ExecutionContentRef[];
 startingInventory:'assumed-zero';universeComplete:false;costAllocation:'not-implemented';
 status:'allocated'|'blocked'|'not-applicable';reasons:string[];
 crossing:null|{executionId:string;contentRef:ExecutionContentRef;sourceQuantity:string;closeLongQuantity:string;openShortQuantity:string;amounts:CrossZeroMoneyAmount[]};
};

// Only a source amount times two quantity shares is evaluated here. Reduced
// rationals are bounded by the 1024-character inputs; no running cost/PnL pool.
type Rational={n:bigint;d:bigint};
const ZERO=BigInt(0),ONE=BigInt(1),TWO=BigInt(2),FIVE=BigInt(5),TEN=BigInt(10),MAX=1024;
function rational(n:bigint,d=ONE):Rational{
 let a=n<ZERO?-n:n,b=d;while(b!==ZERO)[a,b]=[b,a%b];return {n:n/a,d:d/a};
}
function parse(value:unknown):Rational|null{
 if(typeof value!=='string'||value.length>MAX||! /^-?\d+(?:\.\d+)?(?![\s\S])/.test(value))return null;
 const [whole,fraction='']=value.split('.');return rational(BigInt(whole+fraction),TEN**BigInt(fraction.length));
}
const add=(a:Rational,b:Rational)=>rational(a.n*b.d+b.n*a.d,a.d*b.d);
const multiply=(a:Rational,b:Rational)=>rational(a.n*b.n,a.d*b.d);
const equal=(a:Rational,b:Rational)=>a.n*b.d===b.n*a.d;
const nonnegative=(v:Rational|null):v is Rational=>v!==null&&v.n>=ZERO;
const positive=(v:Rational|null):v is Rational=>v!==null&&v.n>ZERO;
const currencyValid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z]{3}(?![\s\S])/.test(v)&&v!=='XXX';
const hashValid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}(?![\s\S])/.test(v);
function decimal(v:Rational):{value:string|null;reason?:string}{
 let d=v.d,twos=0,fives=0;while(d%TWO===ZERO){d/=TWO;twos++;}while(d%FIVE===ZERO){d/=FIVE;fives++;}
 if(d!==ONE)return {value:null,reason:'non-terminating-decimal'};
 const scale=Math.max(twos,fives);if(scale>MAX)return {value:null,reason:'decimal-length-exceeded'};
 const abs=v.n<ZERO?-v.n:v.n;
 const digits=(abs*TWO**BigInt(scale-twos)*FIVE**BigInt(scale-fives)).toString().padStart(scale+1,'0');
 const value=(v.n<ZERO?'-':'')+(scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`.replace(/0+$/,'').replace(/\.$/,''):digits);
 return value.length>MAX?{value:null,reason:'decimal-length-exceeded'}:{value};
}
function sameRef(a:ExecutionContentRef|undefined,b:ExecutionContentRef|undefined){return !!a&&!!b&&a.schemaVersion===b.schemaVersion&&a.executionId===b.executionId&&a.rawVersion===b.rawVersion&&a.effectiveVersion===b.effectiveVersion;}
function time(value:string){const m=/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/i.exec(value)!;return {second:Date.parse(m[1]+m[3]),fraction:m[2]??''};}

/** Caller owns snapshot-wide monthly/unknown/group eligibility. Recheck the
 * supplied scope and quantity proof, but never certify historical completeness. */
export function buildCrossZeroMoneyDiagnostic(quantity:CrossZeroDiagnostic,executions:readonly TradeExecution[]):CrossZeroMoneyDiagnostic{
 const invalidRefShape=!Array.isArray(quantity.refs)||quantity.refs.some(ref=>!ref||ref.schemaVersion!==1||typeof ref.executionId!=='string'||!ref.executionId.trim()||!hashValid(ref.rawVersion)||!hashValid(ref.effectiveVersion));
 const refs=invalidRefShape?[]:quantity.refs.map(ref=>({...ref})).sort((a,b)=>a.executionId.localeCompare(b.executionId)||a.effectiveVersion.localeCompare(b.effectiveVersion));
 const policy='source-cross-zero-money-v1';
 const fingerprint=createHash('sha256').update(JSON.stringify([policy,quantity.fingerprint,refs.map(r=>[r.schemaVersion,r.executionId,r.rawVersion,r.effectiveVersion])])).digest('hex');
 const result:CrossZeroMoneyDiagnostic={policy,scope:{...quantity.scope},sourceSequence:quantity.sourceSequence,quantityFingerprint:quantity.fingerprint,fingerprint,refs,startingInventory:'assumed-zero',universeComplete:false,costAllocation:'not-implemented',status:'blocked',reasons:[],crossing:null};
 const block=(reason:string)=>{result.reasons=[reason];return result;};
 if(invalidRefShape)return block('invalid-content-ref');
 if(quantity.policy!=='source-cross-zero-quantity-v1'||quantity.startingInventory!=='assumed-zero'||quantity.universeComplete!==false||quantity.financialAllocation!=='not-implemented'||!hashValid(quantity.fingerprint))return block('invalid-quantity-diagnostic');
 if(quantity.status==='not-applicable'){result.status='not-applicable';result.reasons=[...quantity.reasons];return result;}
 if(quantity.status!=='candidate'||quantity.reasons.length||!quantity.crossing)return block('quantity-not-candidate');
 const scope=quantity.scope;
 if(!scope||typeof scope.accountId!=='string'||!scope.accountId.trim()||scope.accountId==='all'||typeof scope.instrumentId!=='string'||!scope.instrumentId.trim()||scope.instrumentId==='all')return block('invalid-scope');
 const byId=new Map<string,TradeExecution>(),byRef=new Map<string,ExecutionContentRef>();
 for(const ref of refs){if(ref.schemaVersion!==1||!hashValid(ref.rawVersion)||!hashValid(ref.effectiveVersion)||byRef.has(ref.executionId))return block('invalid-content-ref');byRef.set(ref.executionId,ref);}
 if(refs.length!==executions.length)return block('incomplete-content-refs');
 for(const e of executions){
  if(!e||typeof e.id!=='string'||!e.id.trim()||byId.has(e.id)||e.accountId!==scope.accountId||e.instrument.id!==scope.instrumentId)return block('invalid-execution-scope-or-identity');
  byId.set(e.id,e);
  try{if(byRef.get(e.id)?.effectiveVersion!==executionContentVersion(e,'effective'))return block('snapshot-content-ref-mismatch');}catch{return block('invalid-execution-content');}
  if(!positive(parse(e.quantity))||!positive(parse(e.price))||!currencyValid(e.instrument.currency))return block('invalid-source-quantity-price-or-currency');
 }
 const order=validateLongPairingOrder({executions:executions.map(e=>({executionId:e.id,side:e.side,quantity:e.quantity,executedAt:e.executedAt})),confirmedClosingExecutionIds:[],pairings:[]});
 if(order.issues.some(i=>i.code!=='negative-inventory'))return block('invalid-source-order');
 const ordered=executions.map(e=>({e,t:time(e.executedAt)})).sort((a,b)=>{if(a.t.second!==b.t.second)return a.t.second-b.t.second;const w=Math.max(a.t.fraction.length,b.t.fraction.length);return a.t.fraction.padEnd(w,'0').localeCompare(b.t.fraction.padEnd(w,'0'));});
 const proof=diagnoseCrossZeroQuantity(ordered.map(({e})=>({executionId:e.id,side:e.side,quantity:e.quantity}))),crossing=quantity.crossing;
 if(proof.status!=='candidate'||!proof.crossing||proof.crossing.executionId!==crossing.executionId||!sameRef(byRef.get(crossing.executionId),crossing.contentRef))return block('crossing-proof-mismatch');
 for(const key of ['sourceQuantity','closeLongQuantity','openShortQuantity'] as const){const a=parse(crossing[key]),b=parse(proof.crossing[key]);if(!positive(a)||!positive(b)||!equal(a,b))return block('crossing-quantity-mismatch');}
 const e=byId.get(crossing.executionId)!,source=parse(e.quantity)!,close=parse(crossing.closeLongQuantity)!,open=parse(crossing.openShortQuantity)!;
 if(e.side!=='sell'||!equal(add(close,open),source))return block('crossing-quantity-mismatch');
 const quote=multiply(source,parse(e.price)!);
 if(e.source.grossAmount!==undefined){const reported=parse(e.source.grossAmount);if(!nonnegative(reported)||!equal(reported,quote))return block('source-quote-gross-mismatch');}
 const split=(kind:CrossZeroMoneyAmount['kind'],currency:string,value:Rational|null,reasons:string[]=[],invalid=false,raw?:string):CrossZeroMoneyAmount=>{
  const amount:CrossZeroMoneyAmount={kind,currency,sourceValue:null,closeLongValue:null,openShortValue:null,status:invalid?'invalid':'unknown',reasons:[...reasons]};
  if(invalid||value===null)return amount;
  const original:{value:string|null;reason?:string}=raw===undefined?decimal(value):{value:raw};amount.sourceValue=original.value;
  if(original.value===null){amount.reasons.push(original.reason??'decimal-length-exceeded');return amount;}
  const a=decimal(multiply(value,rational(close.n*source.d,close.d*source.n))),b=decimal(multiply(value,rational(open.n*source.d,open.d*source.n)));
  if(a.value===null||b.value===null){amount.reasons=[...new Set([...amount.reasons,...[a.reason,b.reason].filter((r):r is string=>!!r)])];return amount;}
  amount.status='conserved';amount.closeLongValue=a.value;amount.openShortValue=b.value;return amount;
 };
 // An unrepresentable quote cannot equal any valid bounded settlement gross.
 const evidence=readExecutionMoneyEvidence(e,{expectedQuoteGross:decimal(quote).value??''});
 const amounts=[split('quote-gross',e.instrument.currency,quote)];
 for(const [kind,amount] of [['fee',evidence.fee],['settlement-gross',evidence.settlementGross],['settlement-net',evidence.signedCashNet]] as const){
  amounts.push(split(kind,amount.currency,parse(amount.value),amount.reasons,amount.status==='invalid',amount.value??undefined));
 }
 result.crossing={executionId:e.id,contentRef:{...crossing.contentRef},sourceQuantity:crossing.sourceQuantity,closeLongQuantity:crossing.closeLongQuantity,openShortQuantity:crossing.openShortQuantity,amounts};
 result.status=amounts.some(a=>a.status==='invalid')?'blocked':'allocated';result.reasons=[...new Set(amounts.flatMap(a=>a.reasons))];return result;
}
