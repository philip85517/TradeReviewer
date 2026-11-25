import { carryGiftAcquisitionEvidence, collectGiftAcquisitionEvidence, isGiftAcquisitionEvidence } from "../trades/gift-acquisition-evidence";
import type {TradeExecution} from '../trades/types';
import type {SourceSnapshot} from './source';
import type {MetricObject} from './contracts';
import {canonicalInstrumentId} from '../instruments/display-name';
import {hasVerifiedIpoImportEvidence} from '../trades/nature-resolution';
import {nativeExecutionAt,nativeExecutionDay} from '../replay/native-boundary';
import {buildRelease} from './builder';
import {decimal} from './period';
import {isExecutionBackedIpoAllocation} from '../import/statement-evidence';
import {resolveIpoAcquisitionCost} from '../trades/ipo-cost';
import {nativeEvidenceBoundaries} from '../replay/position-ledger';
import {executionDocumentKey,executionHasExactTime,explicitExecutionSourceOrder} from '../import/statement-evidence';
export type ContributionCategory='long'|'short'|'ipo';
export type ContributionMetric={category:ContributionCategory;executionIds:string[];metric:MetricObject};

const scoped=(first:TradeExecution)=>(p:{accountId:string;market?:string;symbol?:string})=>p.accountId===first.accountId&&!!p.market&&!!p.symbol&&canonicalInstrumentId(p.symbol,p.market)===canonicalInstrumentId(first.instrument.symbol,first.instrument.market);
const cashOnlyDistribution=(event:NonNullable<SourceSnapshot['monthly']>[number]['events'][number])=>event.kind==='distribution'&&(event.quantity===undefined||event.source.some(fragment=>fragment.role==='cash'));
const cashOnlyOther=(event:NonNullable<SourceSnapshot['monthly']>[number]['events'][number])=>event.kind==='other'&&event.quantity===undefined&&event.source.some(fragment=>fragment.role==='cash');
function backedMatches(event:NonNullable<SourceSnapshot['monthly']>[number]['events'][number],executions:TradeExecution[]):TradeExecution[]{return executions.filter(e=>isExecutionBackedIpoAllocation(event,[e]));}
function ipoInventory(executions:TradeExecution[],source:SourceSnapshot):{events:NonNullable<SourceSnapshot['monthly']>[number]['events'];allocations:NonNullable<SourceSnapshot['monthly']>[number]['events'];conflict:boolean} {
 const first=executions[0], match=scoped(first), events=[...source.monthly.flatMap(m=>m.events),...executions.flatMap(e=>e.source.positionEvents??[])].filter(match);
 const byId=new Map<string,string>();let conflict=false;
 for(const event of events){const identity=JSON.stringify([event.documentId??null,event.kind,event.date,event.quantity??null,event.amount??null,event.currency??null,event.symbol??null,event.market??null,event.description,event.displayTimePolicy??null,event.ipoAction??null,event.reversesEventId??null,event.source]);const previous=byId.get(event.id);if(previous!==undefined&&previous!==identity)conflict=true;byId.set(event.id,identity);}
 const all=[...new Map(events.map(e=>[e.id,e])).values()];
 const stocks=all.filter(e=>e.kind==='ipo'&&decimal(e.quantity??'0').gt(0));
 const backedOwners=new Map<string,string>();
 for(const event of stocks){const matches=backedMatches(event,executions);if(matches.length>1)conflict=true;if(matches.length===1){const owner=backedOwners.get(matches[0].id);if(owner!==undefined&&owner!==event.id)conflict=true;backedOwners.set(matches[0].id,event.id);}}
 return {events:all,allocations:stocks.filter(event=>backedMatches(event,executions).length!==1&&!!resolveIpoAcquisitionCost(event,all,executions,first.instrument.currency)),conflict};
}
const nativeEventBoundary=(event:NonNullable<SourceSnapshot['monthly']>[number]['events'][number],market:string)=>nativeEvidenceBoundaries([],[{positions:[],events:[event],month:undefined}],market)[0];
/** Missing opening labels can be proved only within this complete flat-to-flat
 * ordinary inventory chain. A closing round's fallback category is not evidence.
 */
function hasClosedLongChain(ordered:TradeExecution[],start:number):boolean{
 let quantity=decimal('0');
 for(let i=start;i<ordered.length;i++){
  const e=ordered[i],effect=e.source.positionEffect,q=decimal(e.quantity);
  if(!q.gt(0)||hasVerifiedIpoImportEvidence(e)||effect&&effect!==(e.side==='buy'?'open-long':'close-long'))return false;
  quantity=e.side==='buy'?quantity.plus(q):quantity.minus(q);
  if(quantity.lt(0))return false;
  if(quantity.isZero())return true;
 }
 return false;
}
/** A source partition, never a business round or an inferred user confirmation.
 * Source changes are admissible only at proven flat inventory boundaries. The
 * moving-average ledger cannot divide simultaneously held IPO/ordinary costs.
 */
export function partitionContribution(executions:TradeExecution[],source:SourceSnapshot):Map<ContributionCategory,TradeExecution[]>|null{
 const first=executions[0];if(!first||new Set(executions.map(e=>e.id)).size!==executions.length)return null;
 const matches=scoped(first);
 const attachedEvents=[...source.monthly.flatMap(m=>m.events),...executions.flatMap(e=>e.source.positionEvents??[])].filter(matches);
 const events=carryGiftAcquisitionEvidence(attachedEvents,attachedEvents);
 // Positions are historical guard evidence, not a second inventory source. A
 // non-zero monthly snapshot must therefore not veto an otherwise complete
 // execution/event partition; buildContributionMetrics compares it strictly
 // against the original native boundaries before publication.
 if(events.some(e=>!['ipo','fee'].includes(e.kind)&&!cashOnlyDistribution(e)&&!cashOnlyOther(e)&&!isGiftAcquisitionEvidence(e))||events.some(e=>e.kind==='distribution'&&!cashOnlyDistribution(e)||e.kind==='other'&&!cashOnlyOther(e))||executions.some(e=>e.source.historyIncomplete?.length))return null;
 const result=new Map<ContributionCategory,TradeExecution[]>();let quantity=decimal('0'),category:ContributionCategory|null=null,ipoQuantity=decimal('0');
 const ipo=ipoInventory(executions,source);
 if(ipo.conflict)return null;
 const gifts=collectGiftAcquisitionEvidence(events);if(gifts.duplicateKeys.length||gifts.events.some(e=>e.giftAcquisition!.currency!==first.instrument.currency))return null;
 const queuedGifts=new Set<string>();
 const queuedIpo=new Set<string>();
 const trustedOrders=new Map<string,number>(),byDay=new Map<string,TradeExecution[]>();
 for(const execution of executions){const day=nativeExecutionDay(execution),rows=byDay.get(day)??[];rows.push(execution);byDay.set(day,rows);}
 for(const rows of byDay.values()){
  const documents=new Set(rows.map(executionDocumentKey)),orders=rows.map(explicitExecutionSourceOrder);
  const trusted=rows.every(e=>!executionHasExactTime(e))&&documents.size===1&&!documents.has(undefined)&&orders.every(o=>o!==undefined)&&new Set(orders).size===orders.length;
  if(trusted)for(const execution of rows)trustedOrders.set(execution.id,explicitExecutionSourceOrder(execution)!);
 }
 const trustedOrder=(left:TradeExecution,right:TradeExecution)=>{const a=trustedOrders.get(left.id),b=trustedOrders.get(right.id);return a!==undefined&&b!==undefined?a-b:0;};
 const ordered=[...executions].sort((a,b)=>nativeExecutionAt(a).localeCompare(nativeExecutionAt(b))||trustedOrder(a,b)||a.id.localeCompare(b.id));
 for(let i=0;i<ordered.length;i++){
  const e=ordered[i],effect=e.source.positionEffect,q=decimal(e.quantity);if(!q.gt(0))return null;
  // A timestamp tie across opposite sides has no authoritative inventory order.
  if(i&&nativeExecutionAt(ordered[i-1])===nativeExecutionAt(e)&&ordered[i-1].side!==e.side&&(trustedOrders.has(ordered[i-1].id)===false||trustedOrders.has(e.id)===false))return null;
  for(const event of gifts.events)if(!queuedGifts.has(event.id)&&nativeEventBoundary(event,first.instrument.market)<=nativeExecutionAt(e)){if(quantity.gt(0)&&category!=='long')return null;queuedGifts.add(event.id);quantity=quantity.plus(event.quantity!);category='long';}
  for(const event of ipo.allocations)if(!queuedIpo.has(event.id)&&nativeEventBoundary(event,first.instrument.market)<=nativeExecutionAt(e)){queuedIpo.add(event.id);ipoQuantity=ipoQuantity.plus(event.quantity!);}
  if(quantity.isZero()){
   const backedIpo=hasVerifiedIpoImportEvidence(e)||ipo.events.some(event=>matches(event)&&backedMatches(event,[e]).length===1);
   category=effect==='open-short'?'short':backedIpo?'ipo':effect==='open-long'?'long':null;
   if(!category&&e.side==='sell'&&ipoQuantity.gt(0)){category='ipo';quantity=ipoQuantity;ipoQuantity=decimal('0');}
   if(!category&&!effect&&e.side==='buy'&&hasClosedLongChain(ordered,i))category='long';
   if(!category||category==='short'&&first.instrument.market.startsWith('CN'))return null;
  }
  const opening=category==='short'?e.side==='sell':e.side==='buy';
  const backedIpo=hasVerifiedIpoImportEvidence(e)||ipo.events.some(event=>matches(event)&&backedMatches(event,[e]).length===1);
  if(effect&&effect!==(category==='short'?(opening?'open-short':'close-short'):(opening?'open-long':'close-long')))return null;
  if(opening){
   if(category==='short'&&effect!=='open-short'||category!=='short'&&((category==='ipo')!==backedIpo))return null;
   quantity=quantity.plus(q);
  }else{if(q.gt(quantity)||category==='short'&&effect!=='close-short')return null;quantity=quantity.minus(q);}
  const members=result.get(category!)??[];members.push(e);result.set(category!,members);
 }
 if(result.size<1)return null;
 // Strict existing IPO event/execution identity proof, including duplicate event
 // conflicts, is reused for the IPO member rather than reinterpreting cash rows.
 if(result.has('ipo')&&!ipo.events.some(event=>decimal(event.quantity??'0').gt(0)&&(backedMatches(event,executions).length===1||!!resolveIpoAcquisitionCost(event,ipo.events,executions,first.instrument.currency))))return null;
 return result;
}
/** Reuse the production builder/cost kernel. Persist compact native boundaries so
 * arbitrary selected periods retain realized + ending U - opening U semantics. */
export function buildContributionMetrics(executions:TradeExecution[],source:SourceSnapshot,original:MetricObject):ContributionMetric[]|null{
 const partition=partitionContribution(executions,source);if(!partition)return null;
 const first=executions[0];
 const matching=(p:{accountId:string;market?:string;symbol?:string})=>p.accountId===first.accountId&&!!p.market&&!!p.symbol&&canonicalInstrumentId(p.symbol,p.market)===canonicalInstrumentId(first.instrument.symbol,first.instrument.market);
 const metrics:ContributionMetric[]=[];
 for(const [category,members] of partition){
  // Snapshot positions are strict validation evidence for the original release,
  // never candidate inventory. Replaying them would double count an otherwise
  // complete execution chain. IPO candidates retain scoped IPO/cash evidence.
  const keepEvent=(event:{accountId:string;market?:string;symbol?:string;kind:string})=>matching(event)&&(event.kind==='fee'||category==='ipo'&&event.kind==='ipo'||category==='long'&&isGiftAcquisitionEvidence(event as import('../import/monthly-statement').StatementEvent));
  const zeroOpening=(position:{accountId:string;market?:string;symbol?:string;phase?:string;quantity:string})=>matching(position)&&position.phase==='opening'&&decimal(position.quantity).isZero();
  const monthly=source.monthly.map(m=>({...m,positions:m.positions.filter(zeroOpening),events:carryGiftAcquisitionEvidence(m.events,executions.flatMap(e=>e.source.positionEvents??[])).filter(keepEvent)})).filter(m=>m.positions.length||m.events.length);
  const projectedMembers=members.map(e=>({...e,source:{...e.source,statementPositions:e.source.statementPositions?.filter(zeroOpening),openingPosition:e.source.openingPosition&&zeroOpening(e.source.openingPosition)?e.source.openingPosition:undefined,...(e.source.positionEvents?{positionEvents:carryGiftAcquisitionEvidence(e.source.positionEvents,source.monthly.flatMap(m=>m.events)).filter(keepEvent)}:{})}}));
  const snapshot={...source,executions:projectedMembers,executionRefs:source.executionRefs?.filter(r=>members.some(e=>e.id===r.executionId)),monthly,unclassified:[],classification:{live:members.length,unknown:0,simulation:0}};
  const built=buildRelease(snapshot,'contribution-partition'),metric=built.scopes.find(s=>s.market==='all'&&s.accountId==='all')?.metricObjects?.find(o=>o.positionKey===original.positionKey);
  if(!metric)return null;metrics.push({category,executionIds:members.map(e=>e.id),metric});
 }
 // Every monetary boundary must retain the original result, including missing
 // values. A source event/fee that cannot be safely partitioned fails closed.
 const at=(o:MetricObject,date:string)=>date<o.firstDay?undefined:o.boundaries.filter(d=>d.date<=date).at(-1);
 const dates=[...new Set([...original.boundaries,...metrics.flatMap(m=>m.metric.boundaries)].map(d=>d.date))].filter(d=>d>=original.firstDay&&d<=original.lastDay).sort();
 const fields=['market','realized','unrealized','fees','closedFees'] as const;
 const counts=['realizedMissing','feesMissing','closedFeesMissing','closedTransactions','count','marketKnown','unrealizedKnown'] as const;
 for(const date of dates){
  const day=at(original,date)!;
  const parts=metrics.map(m=>at(m.metric,date));
  for(const currency of new Set([...Object.keys(day.buckets),...parts.flatMap(d=>Object.keys(d?.buckets??{}))]))for(const field of fields){
   const value=day.buckets[currency]?.[field]??(day.buckets[currency]?.[field]===null?null:'0');
   const values=parts.map(d=>d?.buckets[currency]?.[field]===null?null:d?.buckets[currency]?.[field]??'0');
   if(value===null?values.every(v=>v!==null):values.some(v=>v===null)||decimal(String(value)).minus(values.reduce((a,v)=>a.plus(String(v!)),decimal('0'))).abs().gt('0.00000000000000000001'))return null;
  }
  for(const currency of new Set([...Object.keys(day.buckets),...parts.flatMap(d=>Object.keys(d?.buckets??{}))]))for(const field of counts){
   const value=Number(day.buckets[currency]?.[field]??0), values=parts.map(d=>Number(d?.buckets[currency]?.[field]??0));
   if(!Number.isSafeInteger(value)||values.some(v=>!Number.isSafeInteger(v))||value!==values.reduce((a,v)=>a+v,0))return null;
  }
  for(const currency of new Set([...Object.keys(day.buckets),...parts.flatMap(d=>Object.keys(d?.buckets??{}))])){
   const originalBucket=day.buckets[currency],partBuckets=parts.map(d=>d?.buckets[currency]).filter(Boolean);
   if(originalBucket&&originalBucket.lifetimeComplete!==partBuckets.every(b=>b!.lifetimeComplete))return null;
   const reasons=[...new Set(partBuckets.flatMap(b=>b!.reasons))].sort();
   if(JSON.stringify(reasons)!==JSON.stringify([...(originalBucket?.reasons??[])].sort()))return null;
   const notes=[...new Set(partBuckets.flatMap(b=>b!.realizedValuationNotes??[]))].sort();
   if(JSON.stringify(notes)!==JSON.stringify([...(originalBucket?.realizedValuationNotes??[])].sort()))return null;
   const noteCount=partBuckets.reduce((n,b)=>n+(b!.realizedValuationCount??0),0);
   if(noteCount!==(originalBucket?.realizedValuationCount??0))return null;
  }
 }
 return metrics;
}
