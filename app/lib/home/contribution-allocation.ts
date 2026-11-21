import type {TradeExecution} from '../trades/types';
import type {SourceSnapshot} from './source';
import type {MetricObject} from './contracts';
import {canonicalInstrumentId} from '../instruments/display-name';
import {hasVerifiedIpoImportEvidence} from '../trades/nature-resolution';
import {nativeExecutionAt} from '../replay/native-boundary';
import {buildRelease} from './builder';
import {classifyContributionDirection} from './contribution-direction';
import {decimal} from './period';
export type ContributionCategory='long'|'short'|'ipo';
export type ContributionMetric={category:ContributionCategory;executionIds:string[];metric:MetricObject};
/** A source partition, never a business round or an inferred user confirmation.
 * Source changes are admissible only at proven flat inventory boundaries. The
 * moving-average ledger cannot divide simultaneously held IPO/ordinary costs.
 */
export function partitionContribution(executions:TradeExecution[],source:SourceSnapshot):Map<ContributionCategory,TradeExecution[]>|null{
 const first=executions[0];if(!first||new Set(executions.map(e=>e.id)).size!==executions.length)return null;
 const matches=(p:{accountId:string;market?:string;symbol?:string})=>p.accountId===first.accountId&&!!p.market&&!!p.symbol&&canonicalInstrumentId(p.symbol,p.market)===canonicalInstrumentId(first.instrument.symbol,first.instrument.market);
 const positions=[...source.monthly.flatMap(m=>m.positions),...executions.flatMap(e=>[...(e.source.statementPositions??[]),...(e.source.openingPosition?[e.source.openingPosition]:[])])].filter(matches);
 const events=[...source.monthly.flatMap(m=>m.events),...executions.flatMap(e=>e.source.positionEvents??[])].filter(matches);
 if(positions.some(p=>!decimal(p.quantity).isZero())||events.some(e=>!['ipo','fee'].includes(e.kind))||executions.some(e=>e.source.historyIncomplete?.length))return null;
 const result=new Map<ContributionCategory,TradeExecution[]>();let quantity=decimal('0'),category:ContributionCategory|null=null;
 const ordered=[...executions].sort((a,b)=>nativeExecutionAt(a).localeCompare(nativeExecutionAt(b))||a.id.localeCompare(b.id));
 for(let i=0;i<ordered.length;i++){
  const e=ordered[i],effect=e.source.positionEffect,q=decimal(e.quantity);if(!q.gt(0))return null;
  // A timestamp tie across opposite sides has no authoritative inventory order.
  if(i&&nativeExecutionAt(ordered[i-1])===nativeExecutionAt(e)&&ordered[i-1].side!==e.side)return null;
  if(quantity.isZero()){
   category=effect==='open-short'?'short':hasVerifiedIpoImportEvidence(e)?'ipo':effect==='open-long'?'long':null;
   if(!category||category==='short'&&first.instrument.market.startsWith('CN'))return null;
  }
  const opening=category==='short'?e.side==='sell':e.side==='buy';
  if(effect&&effect!==(category==='short'?(opening?'open-short':'close-short'):(opening?'open-long':'close-long')))return null;
  if(opening){
   if(category==='short'&&effect!=='open-short'||category!=='short'&&((category==='ipo')!==hasVerifiedIpoImportEvidence(e)))return null;
   quantity=quantity.plus(q);
  }else{if(q.gt(quantity)||category==='short'&&effect!=='close-short')return null;quantity=quantity.minus(q);}
  const members=result.get(category!)??[];members.push(e);result.set(category!,members);
 }
 if(result.size<2)return null;
 // Strict existing IPO event/execution identity proof, including duplicate event
 // conflicts, is reused for the IPO member rather than reinterpreting cash rows.
 if(result.has('ipo')&&classifyContributionDirection(result.get('ipo')!,source.monthly,false).category!=='ipo')return null;
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
  const monthly=source.monthly.map(m=>({...m,positions:m.positions.filter(matching),events:m.events.filter(e=>matching(e)&&(category==='ipo'||e.kind!=='ipo'))})).filter(m=>m.positions.length||m.events.length);
  const projectedMembers=members.map(e=>({...e,source:{...e.source,...(e.source.positionEvents?{positionEvents:e.source.positionEvents.filter(event=>matching(event)&&(category==='ipo'||event.kind!=='ipo'))}:{})}}));
  const snapshot={...source,executions:projectedMembers,executionRefs:source.executionRefs?.filter(r=>members.some(e=>e.id===r.executionId)),monthly,unclassified:[],classification:{live:members.length,unknown:0,simulation:0}};
  const built=buildRelease(snapshot,'contribution-partition'),metric=built.scopes.find(s=>s.market==='all'&&s.accountId==='all')?.metricObjects?.find(o=>o.positionKey===original.positionKey);
  if(!metric)return null;metrics.push({category,executionIds:members.map(e=>e.id),metric});
 }
 // Every monetary boundary must retain the original result, including missing
 // values. A source event/fee that cannot be safely partitioned fails closed.
 const at=(o:MetricObject,date:string)=>date<o.firstDay?undefined:o.boundaries.filter(d=>d.date<=date).at(-1);
 const dates=[...new Set([...original.boundaries,...metrics.flatMap(m=>m.metric.boundaries)].map(d=>d.date))].filter(d=>d>=original.firstDay&&d<=original.lastDay).sort();
 for(const date of dates){
  const day=at(original,date)!;
  const parts=metrics.map(m=>at(m.metric,date));
  for(const currency of new Set([...Object.keys(day.buckets),...parts.flatMap(d=>Object.keys(d?.buckets??{}))]))for(const field of ['market','realized','unrealized','fees','realizedMissing','feesMissing'] as const){
   const value=day.buckets[currency]?.[field]??(day.buckets[currency]?.[field]===null?null:'0');
   const values=parts.map(d=>d?.buckets[currency]?.[field]===null?null:d?.buckets[currency]?.[field]??'0');
   if(value===null?values.every(v=>v!==null):values.some(v=>v===null)||decimal(String(value)).minus(values.reduce((a,v)=>a.plus(String(v!)),decimal('0'))).abs().gt('0.00000000000000000001'))return null;
  }
 }
 return metrics;
}
