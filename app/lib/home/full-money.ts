import type {TradeExecution} from '../trades/types';
import {executionFeeCurrency} from '../trades/types';
import {decimal} from './period';
import type {FullMoney} from './full-contracts';
/** Publication-only cent boundary. Quantity/cost/fee-pool state retains decimal precision;
 * round rounding happens after summing its closes, never per source fill. This
 * fallback is limited to ordinary single-instant scopes already proven by the
 * confirmation validator. Interleaved scopes retain their independent kernel. */
export function roundedOrdinaryRounds(executions:TradeExecution[],rounds:{id:string;closingExecutionIds:string[]}[]):Map<string,{gross:FullMoney;net:FullMoney;fees:FullMoney[]}>{
 const currency=executions[0]?.instrument.currency??'UNKNOWN';
 const invalid=executions.some(e=>e.instrument.currency!==currency||e.source.executionGroup!==undefined||e.source.timePrecision==='date-only'||e.source.timeCandidates?.length||e.source.openingPosition||e.source.statementPositions?.length||e.source.positionEvents?.length||e.source.historyIncomplete?.length||e.source.positionEffect?.includes('short'));
 if(invalid)return new Map();
 let quantity=decimal('0'),cost=decimal('0');
 const pools=new Map<string,ReturnType<typeof decimal>|null>();
 const closes=new Map<string,{gross:ReturnType<typeof decimal>;fees:Map<string,ReturnType<typeof decimal>|null>}>();
 for(const e of [...executions].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id))){
  const q=decimal(e.quantity),p=decimal(e.price),feeCurrency=executionFeeCurrency(e),fee=e.source.feeStatus==='unknown'||!e.fee.trim()?null:decimal(e.fee);
  if(!q.gt(0)||p.lt(0)||fee?.lt(0))return new Map();
  if(e.side==='buy'){
   const gross=e.source.settlement?.grossAmount!==undefined?decimal(e.source.settlement.grossAmount):q.mul(p);
   cost=cost.plus(gross);quantity=quantity.plus(q);
   const old=pools.get(feeCurrency)??decimal('0');pools.set(feeCurrency,pools.has(feeCurrency)&&pools.get(feeCurrency)===null||fee===null?null:old.plus(fee));
  }else{
   if(q.gt(quantity)||quantity.isZero())return new Map();
   const soldCost=q.eq(quantity)?cost:cost.mul(q).div(quantity);
   const fees=new Map<string,ReturnType<typeof decimal>|null>();
   for(const [code,pool]of pools){const used=pool===null?null:q.eq(quantity)?pool:pool.mul(q).div(quantity);fees.set(code,used);pools.set(code,pool===null||used===null?null:pool.minus(used));}
   const entry=fees.get(feeCurrency);fees.set(feeCurrency,fees.has(feeCurrency)&&entry===null||fee===null?null:(entry??decimal('0')).plus(fee));
   const proceeds=e.source.settlement?.grossAmount!==undefined?decimal(e.source.settlement.grossAmount):q.mul(p);
   closes.set(e.id,{gross:proceeds.minus(soldCost),fees});cost=cost.minus(soldCost);quantity=quantity.minus(q);
  }
 }
 const result=new Map<string,{gross:FullMoney;net:FullMoney;fees:FullMoney[]}>();
 for(const round of rounds){const parts=round.closingExecutionIds.map(id=>closes.get(id));if(parts.some(v=>!v))continue;
  const gross=parts.reduce((v,p)=>v.plus(p!.gross),decimal('0')),fees=new Map<string,ReturnType<typeof decimal>|null>();
  for(const part of parts)for(const [code,value]of part!.fees){const old=fees.get(code);fees.set(code,fees.has(code)&&old===null||value===null?null:(old??decimal('0')).plus(value));}
  const publishedFees=[...fees].map(([currency,value])=>({currency,value:value?.toString()??null,reasons:value===null?['round-fees-unavailable']:[]}));
  // Net is based on the published two-place round fees, so displayed components reconcile exactly.
  const g=gross.toString(),unknown=publishedFees.some(f=>f.currency!==currency||f.value===null);
  const net=unknown?null:publishedFees.reduce((v,f)=>v.minus(f.value!),decimal(g)).toString();
  result.set(round.id,{gross:{currency,value:g,reasons:[]},net:{currency,value:net,reasons:unknown?['round-fees-unavailable']:[]},fees:publishedFees});
 }
 return result;
}
