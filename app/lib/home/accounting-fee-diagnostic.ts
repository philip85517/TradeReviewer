import {validateNonInterleavedExecutionGroups} from './atomic-execution-group';
import type {PairingInspection} from './business-pairing-store';
import {executionFeeCurrency,type TradeExecution} from '../trades/types';
import {executionContentVersion,type ExecutionContentRef} from './execution-content-ref';
import {validateLongPairingOrder} from './long-pairing-order';
import {allocateLongFeePool,sumFeeAmounts,type FeeAmount,type LongFeePoolResult} from './long-fee-pool';

type MoneyState={status:'known'|'unknown'|'invalid';value:string|null};
export type SourceMoney={executionId:string;contentRef:ExecutionContentRef|null;currency:string;gross:MoneyState;signedCashNet:MoneyState;fee:MoneyState;issues:string[]};
export type AccountingFeeDiagnostic={
 policy:'ordinary-long-accounting-fees-exact-v1';sourceSequence:number;revision:number;fingerprint:string;sourceRefs:ExecutionContentRef[];
 status:'ready'|'blocked'|'invalid';reasons:string[];sourceMoney:SourceMoney[];pool:LongFeePoolResult|null;
 rounds:{roundId:string;closingExecutionIds:string[];fees:FeeAmount[];netPnl:null;reasons:string[]}[];universeComplete:false;
};
// Settlement integrity needs only exact decimal addition/comparison. Pool
// allocation, rational state and serialization remain owned by long-fee-pool.
type Decimal={n:bigint;s:number};
function parse(value:unknown):Decimal|null{
 if(typeof value!=='string'||value.length>1024||! /^-?\d+(?:\.\d+)?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');
 return {n:BigInt(whole+fraction),s:fraction.length};
}
function add(a:Decimal,b:Decimal):Decimal{const s=Math.max(a.s,b.s);return {n:a.n*BigInt(10)**BigInt(s-a.s)+b.n*BigInt(10)**BigInt(s-b.s),s};}
const equal=(a:Decimal,b:Decimal)=>add(a,{n:-b.n,s:b.s}).n===BigInt(0);
const nonnegative=(v:Decimal|null):v is Decimal=>v!==null&&v.n>=BigInt(0);
const raw=(v:unknown)=>typeof v==='string'?v:null;
function sourceMoney(execution:TradeExecution,contentRef:ExecutionContentRef|null):SourceMoney{
 const currency=executionFeeCurrency(execution),settlement=execution.source.settlement,issues:string[]=[];
 const fee=parse(execution.fee),currencyValid=/^[A-Z]{3}$/.test(currency)&&currency!=='XXX';
 if(!currencyValid)issues.push('invalid-fee-currency');
 if(!nonnegative(fee))issues.push('invalid-fee');
 const gross=parse(settlement?.grossAmount),net=parse(settlement?.netAmount);
 if(settlement){
  const quantity=parse(settlement.quantity),executedQuantity=parse(execution.quantity);
  if(!quantity||quantity.n<=BigInt(0)||!executedQuantity||executedQuantity.n<=BigInt(0)||!equal(quantity,executedQuantity))issues.push('settlement-quantity-mismatch');
  if(!nonnegative(gross))issues.push('invalid-settlement-gross');
  const components=settlement.fees;
  if(!components||typeof components!=='object'||Array.isArray(components))issues.push('invalid-settlement-components');
  else{
   let total:Decimal={n:BigInt(0),s:0};let valid=true;
   for(const value of Object.values(components)){const amount=parse(value);if(!nonnegative(amount)){valid=false;break;}total=add(total,amount);}
   if(!valid)issues.push('invalid-settlement-components');
   else if(!fee||!equal(total,fee))issues.push('settlement-fee-mismatch');
  }
  if(settlement.netAmount!==undefined){
   if(!net)issues.push('invalid-settlement-net');
   else if(gross&&fee){const expected=add({n:execution.side==='buy'?-gross.n:gross.n,s:gross.s},{n:-fee.n,s:fee.s});if(!equal(expected,net))issues.push('settlement-net-mismatch');}
  }
 }
 const invalid=issues.length>0,unknown=execution.source.feeStatus==='unknown';
 if(unknown)issues.push('fee-explicitly-unknown');
 return {executionId:execution.id,contentRef,currency,
  gross:{status:!settlement?'unknown':nonnegative(gross)?'known':'invalid',value:raw(settlement?.grossAmount)},
  signedCashNet:{status:!settlement||settlement.netAmount===undefined?'unknown':invalid?'invalid':'known',value:raw(settlement?.netAmount)},
  fee:{status:invalid?'invalid':unknown?'unknown':'known',value:raw(execution.fee)},issues};
}
function compareTime(a:TradeExecution,b:TradeExecution){
 const time=(e:TradeExecution)=>{const m=/\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/i.exec(e.executedAt);return {seconds:Date.parse(e.executedAt.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/i,'')),fraction:m?.[1]??''};};
 const x=time(a),y=time(b);if(x.seconds!==y.seconds)return x.seconds-y.seconds;
 const width=Math.max(x.fraction.length,y.fraction.length);return x.fraction.padEnd(width,'0').localeCompare(y.fraction.padEnd(width,'0'));
}
/** Current scope diagnostics from exactly the supplied effective snapshot; no IO. */
export function buildAccountingFeeDiagnostic(inspection:PairingInspection,executions:readonly TradeExecution[]):AccountingFeeDiagnostic{
 const result:AccountingFeeDiagnostic={policy:'ordinary-long-accounting-fees-exact-v1',sourceSequence:inspection.sourceSequence,revision:inspection.revision,fingerprint:inspection.fingerprint,sourceRefs:inspection.refs,status:'blocked',reasons:[],sourceMoney:[],pool:null,rounds:[],universeComplete:false};
 if(inspection.fact?.policy==='ordinary-live-long-fill-lifo-v1'){result.reasons=['interleaved-round-financial-attribution-not-implemented'];return result;}
 if(inspection.status!=='current'||!inspection.fact){result.reasons=[...new Set([`pairing-${inspection.status}`,...inspection.reasons])];return result;}
 const groupIssues=validateNonInterleavedExecutionGroups(executions).issues;
 if(groupIssues.length){result.status='invalid';result.reasons=[...new Set(['aggregated-fill-time-unsupported',...groupIssues])];return result;}
 const refs=new Map(inspection.refs.map(ref=>[ref.executionId,ref]));
 const invalidRefs=refs.size!==inspection.refs.length||refs.size!==executions.length||executions.some(e=>e.accountId!==inspection.scope.accountId||e.instrument.id!==inspection.scope.instrumentId||refs.get(e.id)?.effectiveVersion!==executionContentVersion(e,'effective'));
 if(invalidRefs){result.status='invalid';result.reasons=['snapshot-content-ref-mismatch'];return result;}
 const ordered=[...executions].sort(compareTime);
 const order=validateLongPairingOrder({executions:ordered.map(e=>({executionId:e.id,side:e.side,quantity:e.quantity,executedAt:e.executedAt})),confirmedClosingExecutionIds:inspection.fact.rounds.flatMap(r=>r.closingExecutionIds),pairings:inspection.fact.rounds.flatMap(r=>r.pairings)});
 if(!order.valid){result.status='invalid';result.reasons=order.issues.map(i=>i.code);return result;}
 result.sourceMoney=ordered.map(e=>sourceMoney(e,refs.get(e.id)??null));
 result.pool=allocateLongFeePool(ordered.map((e,i)=>({executionId:e.id,side:e.side,quantity:e.quantity,fee:{currency:result.sourceMoney[i].currency,value:result.sourceMoney[i].fee.status==='known'?e.fee:null}})));
 result.reasons=[...new Set([...result.sourceMoney.flatMap(m=>m.issues),...result.pool.issues.map(i=>i.code)])];
 result.status=!result.pool.valid||result.sourceMoney.some(m=>m.fee.status==='invalid')?'invalid':'ready';
 if(result.pool.valid){
  const closes=new Map(result.pool.closes.map(close=>[close.closingExecutionId,close]));
  result.rounds=inspection.fact.rounds.map(round=>({roundId:round.id,closingExecutionIds:round.closingExecutionIds,fees:sumFeeAmounts(round.closingExecutionIds.flatMap(id=>closes.get(id)?.total??[])),netPnl:null,reasons:['round-financial-attribution-not-implemented']}));
 }
 return result;
}
