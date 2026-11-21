import {nativeExecutionAt,nativeMarketBoundary} from '../replay/native-boundary';
import {executionFeeCurrency} from '../trades/types';
import {hasVerifiedIpoImportEvidence} from '../trades/nature-resolution';
import {resolveIpoAcquisitionCost,withinIpoAttributionWindow} from '../trades/ipo-cost';
import type {TradeExecution} from '../trades/types';
import {canonicalInstrumentId} from '../instruments/display-name';
import {isExecutionBackedIpoAllocation} from '../import/statement-evidence';
import type {StatementEvent} from '../import/monthly-statement';
import type {SourceSnapshot} from './source';
import type {FeeFact} from './contracts';
import {decimal,validDay,nextDay} from './period';
import {executionBusinessDay} from './finance';

function executionFee(execution:TradeExecution):string|null {
 try{
  const fee=decimal(execution.fee),settlement=execution.source.settlement;
  if(fee.lt(0)||execution.source.feeStatus==='unknown')return null;
  if(settlement&&!(execution.source as TradeExecution['source'] & {homeFeeBasis?:unknown}).homeFeeBasis){
   const quantity=decimal(settlement.quantity),gross=decimal(settlement.grossAmount),parts=Object.values(settlement.fees).map(decimal);
   if(!quantity.isPositive()||!quantity.eq(decimal(execution.quantity))||gross.lt(0)||parts.some(p=>p.lt(0))||!parts.reduce((n,p)=>n.plus(p),decimal('0')).eq(fee))return null;
   if(settlement.netAmount!==undefined&&!decimal(settlement.netAmount).eq(execution.side==='buy'?gross.negated().minus(fee):gross.minus(fee)))return null;
  }
  return fee.toFixed();
 }catch{return null;}
}

/** Incurred expenses are not the inventory ledger's allocated fee pool. */
export function collectFees(source: Pick<SourceSnapshot,'executions'|'monthly'>): FeeFact[] {
 const facts:FeeFact[]=[];
 const events=new Map<string,{event:StatementEvent;conflict:boolean}>();
 const eventKey=(e:StatementEvent)=>JSON.stringify([e.accountId,e.id]);
 for(const event of [...source.monthly.flatMap(s=>s.events),...source.executions.flatMap(e=>e.source.positionEvents??[])]){
  const key=eventKey(event),prior=events.get(key);
  if(prior){if(JSON.stringify(prior.event)!==JSON.stringify(event))prior.conflict=true;}else events.set(key,{event,conflict:false});
 }
 const attributed=new Map<string,string[]>();
 for(const execution of source.executions){
  if(!hasVerifiedIpoImportEvidence(execution)||executionFee(execution)===null)continue;
  const all=[...events.values()].filter(e=>!e.conflict).map(e=>e.event);
  const allocation=all.find(e=>isExecutionBackedIpoAllocation(e,[execution]));
  if(!allocation)continue;
  const cost=resolveIpoAcquisitionCost(allocation,all,[],execution.instrument.currency);
  if(!cost)continue;
  try {
   const feeIds=all.filter(e=>e.accountId===execution.accountId&&e.kind==='fee'&&cost.evidenceIds.includes(e.id)).map(eventKey);
   if(feeIds.length&&decimal(cost.feeCost).eq(decimal(execution.fee))&&decimal(cost.cashCost).eq(decimal(execution.source.settlement?.grossAmount??'NaN'))&&executionFeeCurrency(execution)===execution.instrument.currency)attributed.set(execution.id,feeIds);
  }catch{/* Ambiguous evidence cannot suppress an incurred fee. */}
 }
 const owners=new Map<string,number>();for(const ids of attributed.values())for(const id of ids)owners.set(id,(owners.get(id)??0)+1);
 for(const [id,ids]of attributed)if(ids.some(key=>owners.get(key)!==1))attributed.delete(id);
 const provedFees=new Set([...attributed.values()].flat());
 for(const execution of source.executions){
  if(attributed.has(execution.id))continue;
  const amount=executionFee(execution);
  const day=executionBusinessDay(execution);
  facts.push({id:`execution:${execution.id}`,accountId:execution.accountId,market:execution.instrument.market,currency:executionFeeCurrency(execution),from:day,to:day,knownAt:nativeExecutionAt(execution),amount});
 }
 for(const [id,{event,conflict}]of events){
  if(event.kind!=='fee')continue;
  const month=event.date.length===7&&validDay(`${event.date}-01`),from=month?`${event.date}-01`:event.date;
  if(!validDay(from))throw new Error('费用日期缺少有效依据，不能发布');
  const to=month?nextDay(new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),1)).toISOString().slice(0,10),-1):from;
  let amount:string|null=null;
  const ambiguous=!provedFees.has(id)&&/(?:ipo|申購|申购|新股)/i.test(event.description)&&[...events.values()].some(({event:a})=>a.kind==='ipo'&&a.quantity!==undefined&&a.accountId===event.accountId&&a.market===event.market&&a.symbol&&event.symbol&&canonicalInstrumentId(a.symbol,a.market??'')===canonicalInstrumentId(event.symbol,event.market??'')&&withinIpoAttributionWindow(a.date,event.date)&&isExecutionBackedIpoAllocation(a,source.executions));
  try{if(!conflict&&!ambiguous&&event.currency)amount=decimal(event.amount??'NaN').negated().toFixed();}catch{/* Retain the missing fee. */}
  facts.push({id:`statement:${id}`,accountId:event.accountId,market:event.market??null,currency:event.currency??'UNKNOWN',from,to,knownAt:nativeMarketBoundary(`${to}T23:59:59.999Z`,event.market),amount});
 }
 return facts;
}
export function feeBoundary(facts:FeeFact[],cursor:string){
 const result:Record<string,{known:string;missing:number}>={};
 for(const fact of facts){
  if(fact.from!==fact.to||Date.parse(fact.knownAt)>Date.parse(cursor))continue;
  const bucket=result[fact.currency]??{known:'0',missing:0};
  if(fact.amount===null)bucket.missing++;else bucket.known=decimal(bucket.known).plus(fact.amount).toFixed();
  result[fact.currency]=bucket;
 }return result;
}
export function feeWindowsAmount(facts:FeeFact[],from:string,to:string):Record<string,string|null>{
 const result:Record<string,string|null>={};
 for(const fact of facts){
  if(fact.from===fact.to||fact.to<from||fact.from>to)continue;
  if(fact.from<from||fact.to>to||fact.amount===null)result[fact.currency]=null;
  else if(result[fact.currency]!==null)result[fact.currency]=decimal(result[fact.currency]??'0').plus(fact.amount).toFixed();
 }return result;
}
