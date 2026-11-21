import type {TradeExecution} from '../trades/types';
import type {MonthlyStatement,StatementEvent} from '../import/monthly-statement';
import {isExecutionBackedIpoAllocation} from '../import/statement-evidence';
import {hasVerifiedIpoImportEvidence,resolvedTradeNatureOf} from '../trades/nature-resolution';
import {canonicalInstrumentId} from '../instruments/display-name';
import {decimal,validDay} from './period';
type Category='long'|'short'|'ipo';
/** Only a complete pure-allotment scope can use the single-category object. */
function pureVerifiedIpo(executions:TradeExecution[],events:StatementEvent[],hasInventory:boolean,incomplete:boolean):boolean{
 try{
  if(hasInventory||incomplete||new Set(executions.map(e=>e.id)).size!==executions.length||executions.some(e=>resolvedTradeNatureOf(e)!=='live'||e.source.historyIncomplete?.length||!decimal(e.quantity).gt(0)||e.source.positionEffect!==undefined&&e.source.positionEffect!==(e.side==='buy'?'open-long':'close-long')))return false;
  const first=executions[0];
  if(executions.some(e=>e.accountId!==first.accountId||e.instrument.id!==first.instrument.id))return false;
  const buys=executions.filter(e=>e.side==='buy');if(!buys.length||buys.some(e=>!hasVerifiedIpoImportEvidence(e)))return false;
  const unique=new Map<string,StatementEvent>();
  for(const event of events){
   const old=unique.get(event.id);
   // Copies attached to executions must agree with the retained monthly row.
   const identity=(e:StatementEvent)=>JSON.stringify([e.documentId,e.kind,e.date,e.quantity,e.amount,e.currency,e.description,e.source]);
   if(old&&identity(old)!==identity(event))return false;
   unique.set(event.id,event);
  }
  const stocks=[...unique.values()].filter(e=>e.quantity!==undefined);
  if(events.some(e=>!['ipo','fee'].includes(e.kind))||!stocks.length||stocks.some(e=>e.kind!=='ipo'||!decimal(e.quantity!).gt(0)))return false;
  const matched=new Set<string>();
  for(const event of stocks){
   const matches=buys.filter(b=>decimal(b.quantity).eq(event.quantity!)&&isExecutionBackedIpoAllocation({...event,amount:undefined},[b]));
   if(matches.length!==1||matched.has(matches[0].id))return false;
   matched.add(matches[0].id);
  }
  if(matched.size!==buys.length)return false;
  const byDay=new Map<string,{buys:ReturnType<typeof decimal>;sells:ReturnType<typeof decimal>}>();
  for(const e of executions){const day=e.source.tradingDate??e.source.marketCalendarDate??e.executedAt.slice(0,10);if(!validDay(day))return false;const row=byDay.get(day)??{buys:decimal('0'),sells:decimal('0')};row[e.side==='buy'?'buys':'sells']=row[e.side==='buy'?'buys':'sells'].plus(e.quantity);byDay.set(day,row);}
  let balance=decimal('0');
  // Accepted IPO rule: verified same-day allotment precedes its matching sale.
  for(const [,row] of [...byDay].sort(([a],[b])=>a.localeCompare(b))){balance=balance.plus(row.buys).minus(row.sells);if(balance.lt(0))return false;}
  return true;
 }catch{return false;}
}
/** Attribution is source direction, independently of whether the user confirmed a close. */
export function classifyContributionDirection(executions:TradeExecution[],monthly:MonthlyStatement[],ordinaryLongProven:boolean):{category:Category|null;reasons:string[]}{
 const unknown=(reason:string)=>({category:null,reasons:[reason]});
 const first=executions[0];if(!first)return unknown('direction-allocation-unproven');
 const matching=(row:{accountId:string;market?:string;symbol?:string})=>row.accountId===first.accountId&&!!row.market&&!!row.symbol&&canonicalInstrumentId(row.symbol,row.market)===canonicalInstrumentId(first.instrument.symbol,first.instrument.market);
 const events=[...monthly.flatMap(m=>m.events),...executions.flatMap(e=>e.source.positionEvents??[])].filter(matching);
 const positions=[...monthly.flatMap(m=>m.positions),...executions.flatMap(e=>[...(e.source.statementPositions??[]),...(e.source.openingPosition?[e.source.openingPosition]:[])])].filter(matching);
 if(events.some(e=>e.kind==='ipo')){
  const incomplete=monthly.some(m=>(m.accountId===first.accountId||m.events.some(matching)||m.positions.some(matching))&&(m.historyIncomplete||m.incompleteInstruments?.some(i=>matching({...i,accountId:first.accountId}))));
  return pureVerifiedIpo(executions,events,positions.length>0,incomplete)?{category:'ipo',reasons:[]}:unknown('mixed-or-special-source-allocation-unproven');
 }
 // A security may mix allotments and purchases. A single-category metric object
 // cannot divide that result safely; keep the actual gap until lot allocation exists.
 if(events.some(e=>e.kind==='transfer-in'||e.kind==='transfer-out'||e.kind==='other'))return unknown('mixed-or-special-source-allocation-unproven');
 const effects=executions.map(e=>e.source.positionEffect);
 const contradictory=executions.some(e=>e.source.positionEffect&&(e.source.positionEffect==='open-long'||e.source.positionEffect==='close-short')!==(e.side==='buy'));
 if(contradictory)return unknown('source-direction-conflict');
 const chinese=first.instrument.market.startsWith('CN');
 const hasShort=effects.some(e=>e==='open-short'||e==='close-short'),hasLong=effects.some(e=>e==='open-long'||e==='close-long');
 if(hasShort&&(chinese||hasLong))return unknown('mixed-direction-allocation-unproven');
 const negative=positions.some(p=>decimal(p.quantity).lt(0)),positive=positions.some(p=>decimal(p.quantity).gt(0));
 if(hasShort&&effects.every(e=>e==='open-short'||e==='close-short')&&!positive)return {category:'short',reasons:[]};
 if(!hasShort&&!negative&&(chinese||ordinaryLongProven||effects.every(e=>e==='open-long'||e==='close-long')))return {category:'long',reasons:[]};
 return unknown('direction-allocation-unproven');
}
