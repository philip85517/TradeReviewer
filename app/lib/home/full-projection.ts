import {collectFees} from './fees';
import {buildContributionMetrics} from './contribution-allocation';
import {classifyContributionDirection} from './contribution-direction';
import {executionFeeCurrency} from '../trades/types';
import {roundedOrdinaryRounds} from './full-money';
import {ordinaryPairingCandidates} from './business-pairing-candidates';
import {canonicalInstrumentId} from '../instruments/display-name';
import {createHash} from 'node:crypto';
import type {SourceSnapshot} from './source';
import type {ReleaseInput} from './contracts';
import type {BusinessPairingStore,PairingInspection} from './business-pairing-store';
import {executionBusinessDay} from './finance';
import {nativePosition} from './finance';
import {convertNative,decimal} from './period';
import {FULL_SCHEMA,FULL_MODULES,type FullManifestV1,type FullRound,type FullCatalogItem,type FullSourceCoverage,type FullAllocation} from './full-contracts';
// Module hashes retain the original localeCompare key order. Cache only the
// repeated JSON key layout, never a value or a validation result.
const canonicalKeyLayouts=new Map<string,string[]>();
export function fullCanonical(v:unknown):string {
 if(Array.isArray(v))return '['+v.map(fullCanonical).join(',')+']';
 if(v&&typeof v==='object'){
  const object=v as Record<string,unknown>,keys=Object.keys(object).filter(k=>object[k]!==undefined),layout=JSON.stringify(keys);
  let ordered=canonicalKeyLayouts.get(layout);if(!ordered){ordered=keys.sort((a,b)=>a.localeCompare(b));if(canonicalKeyLayouts.size>=512)canonicalKeyLayouts.clear();canonicalKeyLayouts.set(layout,ordered);}
  // The dominant flat leaf is an execution content reference. Native JSON
  // emits these four nonnumeric keys in the same canonical order, byte for byte.
  if(ordered.length===4&&ordered[0]==='effectiveVersion'&&ordered[1]==='executionId'&&ordered[2]==='rawVersion'&&ordered[3]==='schemaVersion'&&typeof object.effectiveVersion==='string'&&typeof object.executionId==='string'&&typeof object.rawVersion==='string'&&object.schemaVersion===1)return JSON.stringify({effectiveVersion:object.effectiveVersion,executionId:object.executionId,rawVersion:object.rawVersion,schemaVersion:1});
  return '{'+ordered.map(k=>JSON.stringify(k)+':'+fullCanonical(object[k])).join(',')+'}';
 }
 return JSON.stringify(v);
}
export const fullHash=(v:unknown)=>createHash('sha256').update(fullCanonical(v)).digest('hex');
export type FullCapture={inspections:PairingInspection[];financial:ReturnType<BusinessPairingStore['readAll']>};
export type FullModules={closeRounds:FullRound[];catalog:FullCatalogItem[];coverage:FullSourceCoverage[];allocations:FullAllocation[];effectiveReview:{positionKey:string;state:'done'|'pending'|'unknown';reasons:string[]}[]};
export type FullBuild={manifest:FullManifestV1;modules:FullModules};
const market=(m:string):FullCatalogItem['market']=>m.startsWith('CN')?'CN':m==='HK'?'HK':m==='US'?'US':'all';
const cents=(v:string|null)=>v===null?null:decimal(v).toFixed(2);
const feeValue=(e:SourceSnapshot['executions'][number])=>e.source.feeStatus==='unknown'||!e.fee.trim()?null:e.fee;
const canonicalCategoryConserves=(original:NonNullable<ReleaseInput['scopes'][number]['metricObjects']>[number],parts:readonly NonNullable<ReleaseInput['scopes'][number]['categoryMetricObjects']>[number][])=>{
 if(!parts.length||parts.some(part=>!part.sourceFifo))return false;
 const money=['realized','fees','closedFees','market','unrealized'] as const;
 const equal=(left:string|null|undefined,right:string|null|undefined)=>left===null||right===null?left===right:left===undefined?right===undefined:right===undefined?false:decimal(left).minus(right!).abs().lte('0.000000000000000001');
 const dates=[...new Set([original.current.date,...original.boundaries.map(day=>day.date),...parts.flatMap(part=>[part.metric.current.date,...part.metric.boundaries.map(day=>day.date)])])].sort();
 const series=[{metric:original,index:0},...parts.map(part=>({metric:part.metric,index:0}))];
 let boundaryConflict=false;
 const at=(entry:{metric:NonNullable<ReleaseInput['scopes'][number]['metricObjects']>[number];index:number},date:string)=>{const boundaries=entry.metric.boundaries;if(entry.metric.current.date===date){const sameDate=boundaries.find(boundary=>boundary.date===date);if(sameDate&&fullHash(sameDate)!==fullHash(entry.metric.current))boundaryConflict=true;return entry.metric.current;}while(entry.index+1<boundaries.length&&boundaries[entry.index+1].date<=date)entry.index++;const candidate=boundaries[entry.index];return candidate&&candidate.date<=date?candidate:undefined;};
 for(const date of dates){
  const days=series.map(entry=>at(entry,date));
  const expected=days[0],codes=new Set(days.flatMap(day=>day?Object.keys(day.buckets):[]));
  for(const code of codes){
   const target=expected?.buckets[code],members=days.slice(1).map(day=>day?.buckets[code]).filter((bucket):bucket is NonNullable<typeof bucket>=>!!bucket);
   if(!target){if(members.some(bucket=>money.some(field=>bucket[field]!==undefined&&bucket[field]!==null&&bucket[field]!=='0')))return false;continue;}
   for(const field of money){const values=members.map(bucket=>bucket[field]===undefined?'0':bucket[field]);const total=values.some(value=>value===null)?null:values.reduce<string>((sum,value)=>decimal(sum).plus(value===null?'0':value).toFixed(),'0');if(!equal(total,target[field]===undefined?'0':target[field]))return false;}
   for(const field of ['realizedMissing','feesMissing','closedFeesMissing'] as const)if(members.reduce((sum,bucket)=>sum+(bucket[field]??0),0)!==(target[field]??0))return false;
   if((target.lifetimeComplete??true)!==members.every(bucket=>bucket.lifetimeComplete))return false;
   const reasons=new Set(members.flatMap(bucket=>bucket.reasons));if(reasons.size!==new Set(target.reasons).size||target.reasons.some(reason=>!reasons.has(reason)))return false;
  }
 }
 if(boundaryConflict)return false;
 for(const part of parts){const code=Object.keys(part.metric.current.buckets).find(value=>part.metric.current.buckets[value].closedTransactions!==undefined);if(code!==undefined){const expected=new Set(part.sourceFifo!.consumptions.filter(consumption=>consumption.category===part.category).map(consumption=>consumption.closingExecutionId)).size;if(part.metric.current.buckets[code].closedTransactions!==expected)return false;}}
 const primary=original.current.buckets[Object.keys(original.current.buckets).find(code=>original.current.buckets[code].closedTransactions!==undefined)??''];
 if(primary?.closedTransactions!==undefined){const closingIds=new Set(parts.flatMap(part=>part.sourceFifo!.consumptions.map(consumption=>consumption.closingExecutionId)));if(closingIds.size!==primary.closedTransactions)return false;}
 return parts.every(part=>part.metric.current.date===original.current.date&&part.metric.firstDay===part.metric.boundaries[0]?.date&&part.metric.lastDay===original.current.date);
};
/** Confirmed business groups remain intact; otherwise each verifiable statement close is one round. */
export function buildFullRelease(source:SourceSnapshot,core:ReleaseInput,capture:FullCapture):FullBuild{
 const canonicalCategories=new Map<string,NonNullable<ReleaseInput['scopes'][number]['categoryMetricObjects']>>();
 for(const scope of core.scopes)for(const item of scope.categoryMetricObjects??[]){const key=JSON.stringify([item.positionKey,item.category]);const rows=canonicalCategories.get(key)??[];if(!rows.some(existing=>existing.metric.version===item.metric.version))rows.push(item);canonicalCategories.set(key,rows);}
 const refs=new Map((source.executionRefs??[]).map(r=>[r.executionId,r]));
 const catalog:FullCatalogItem[]=core.trades.map(t=>{
  const e=source.executions.find(e=>t.trades.some(x=>x.id===e.id));
  const h=core.scopes.flatMap(s=>s.holdings).find(h=>h.positionKey===t.positionKey);
  const instrumentId=(JSON.parse(t.positionKey) as string[])[1];
  const evidence=source.monthly.flatMap(m=>[...m.positions,...m.events]).filter(p=>p.symbol&&p.market&&canonicalInstrumentId(p.symbol,p.market)===instrumentId);
  const currencies=[...new Set(evidence.flatMap(p=>'currency' in p&&typeof p.currency==='string'?[p.currency]:[]))];
  const proof=evidence[0];
  const metadata=source.instruments.find(i=>i.id===instrumentId)?.metadata;
  const instrument=source.instruments.find(i=>i.id===instrumentId)??e?.instrument??source.instruments.find(i=>i.id===(h?.instrumentId??instrumentId))??(proof?{id:instrumentId,symbol:proof.symbol!,market:proof.market!,name:proof.symbol!,currency:currencies.length===1?currencies[0]:'UNKNOWN'}:null);
  if(!instrument)throw new Error('catalog instrument missing '+instrumentId);
  return {id:t.positionKey,positionKey:t.positionKey,instrumentId:instrument.id,accountId:t.accountId!,market:t.market!,name:instrument.localizedName?.name??instrument.name,code:instrument.symbol,exchange:instrument.market,currency:instrument.currency,assetType:metadata?.assetType??null,tradeSetId:t.id,open:!!h};
 });
 const closeRounds:FullRound[]=[],coverage:FullSourceCoverage[]=[],allocations:FullAllocation[]=[];
 for(const inspection of capture.inspections){
  const {accountId,instrumentId}=inspection.scope;
  const executions=source.executions.filter(e=>e.accountId===accountId&&e.instrument.id===instrumentId&&executionBusinessDay(e)<=source.businessDate&&Date.parse(e.executedAt)<=Date.parse(source.asOf));
  const item=catalog.find(c=>c.accountId===accountId&&c.instrumentId===instrumentId);
  const ledgerPreview=item?nativePosition({executions,evidence:source.monthly,cursor:source.asOf,markPrice:'0',inventoryIdentity:{accountId,symbol:item.code,market:item.exchange,currency:item.currency}}):null;
  // Pairing status and the legacy long-only direction guard describe review
  // state, not whether a transaction-table close is financially observable.
  const reasons=inspection.reasons.filter(reason=>!reason.startsWith('pairing-')&&reason!=='source-dependencies-changed'&&reason!=='unsupported-inventory-or-direction');
  const attribution=classifyContributionDirection(executions,source.monthly,!inspection.reasons.length);
  const category=attribution.category;
  if(category==='short')for(let i=reasons.length-1;i>=0;i--)if(reasons[i]==='source-negative-inventory')reasons.splice(i,1);
  const candidateByDirection=(direction:'long'|'short')=>{
   const explicit=executions.filter(e=>direction==='short'?e.source.positionEffect?.includes('short'):e.source.positionEffect?.includes('long'));
   // The legacy candidate sorter requires an exact instant. Date-only rows
   // still publish as visible closes below, but must not enter that helper.
   const precise=(rows:typeof executions)=>rows.filter(e=>e.source.timePrecision!=='date-only'&&/T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(e.executedAt));
   const scoped=precise(explicit.length?explicit:category===direction?executions:[]);
   if(!scoped.length)return {reasons:[] as string[],all:[] as ReturnType<typeof ordinaryPairingCandidates>['all']};
   const normalized=scoped.map(e=>({...e,side:direction==='short'?(e.side==='buy'?'sell' as const:'buy' as const):e.side,source:{...e.source,executionGroup:undefined}}));
   return ordinaryPairingCandidates({...inspection,reasons:[]},normalized);
  };
  const candidateLong=candidateByDirection('long'),candidateShort=candidateByDirection('short');
  const candidateReasons=[...new Set([...candidateLong.reasons,...candidateShort.reasons])];
  if(candidateShort.all.length)for(let i=reasons.length-1;i>=0;i--)if(reasons[i]==='source-negative-inventory')reasons.splice(i,1);
  const candidateCloseIds=new Set([...candidateLong.all,...candidateShort.all].map(r=>r.id));
  const confirmedRounds=inspection.status==='current'&&inspection.fact?inspection.fact.rounds:[];
  const confirmed=new Set(confirmedRounds.flatMap(r=>r.closingExecutionIds));
  const unpaired=(direction:'long'|'short')=>executions.filter(e=>{
   const effect=e.source.positionEffect??'';
   const belongs=direction==='short'?effect.includes('short'):effect.includes('long');
   const closes=direction==='short'?e.side==='buy':e.side==='sell';
   const ledgerClose=ledgerPreview?.realizedContributions[`execution:${e.id}:${item?.currency??e.instrument.currency}`];
   const ledgerCloseKnown=ledgerClose?.amount!==null&&ledgerClose?.amount!==undefined;
   const inferredLong=!effect&&direction==='long'&&e.side==='sell'&&(item?.market==='CN'||category==='long'||category==='ipo'||ledgerCloseKnown);
   return (belongs&&closes||inferredLong)&&!candidateCloseIds.has(e.id)&&!confirmed.has(e.id);
  }).map(e=>({id:`auto:unpaired:${e.id}`,closingExecutionIds:[e.id],manualConfirmationRequired:true as const,pairings:[]}));
  const unpairedRounds=[...unpaired('long'),...unpaired('short')];
  const roundDirections=new Map<string,'long'|'short'|'ipo'>();
  for(const r of confirmedRounds){const closing=executions.filter(e=>r.closingExecutionIds.includes(e.id));roundDirections.set(r.id,closing.some(e=>e.source.positionEffect?.includes('short'))?'short':category==='ipo'?'ipo':'long');}
  for(const r of candidateLong.all)roundDirections.set(`auto:${r.id}`,category==='ipo'?'ipo':'long');
  for(const r of candidateShort.all)roundDirections.set(`auto:${r.id}`,'short');
  for(const r of unpairedRounds)roundDirections.set(r.id,r.id.includes(':short')?'short':executions.find(e=>r.closingExecutionIds.includes(e.id))?.source.positionEffect?.includes('short')?'short':category==='ipo'?'ipo':'long');
  const automatic=[...candidateLong.all,...candidateShort.all].filter(r=>!confirmed.has(r.id)).map(r=>({...r,id:`auto:${r.id}`}));
  automatic.push(...unpairedRounds);
  const rounds=[...confirmedRounds,...automatic];
  const ordinary=rounds.length>0&&candidateReasons.every(reason=>reason==='source-negative-inventory')&&!reasons.length;
  if(!ordinary)reasons.push(...candidateReasons);
  const original=core.scopes.flatMap(s=>s.metricObjects??[]).find(o=>o.positionKey===item?.positionKey);
  const canonicalCandidates=category===null&&item?(['long','short','ipo'] as const).flatMap(category=>canonicalCategories.get(JSON.stringify([item.positionKey,category]))??[]).filter(v=>Array.isArray((v as any).sourceFifo?.sourceQuantities)&&Array.isArray((v as any).sourceFifo?.lots)&&((v as any).sourceFifo.lots.length>0)):[];
  const canonical=original&&canonicalCategoryConserves(original,canonicalCandidates)?canonicalCandidates:[];
  const categoryMetrics=canonical.length?canonical.map(v=>({category:v.category,executionIds:[...new Set(((v as any).sourceFifo.sourceQuantities as {executionId?:string;category:string}[]).filter(x=>x.category===v.category).flatMap(x=>x.executionId?[x.executionId]:[]))],metric:v.metric})):category===null&&original?buildContributionMetrics(executions,source,original):null;
  const canonicalProof=canonical.length?{sourceFifo:{
    sourceQuantities:[...new Map(canonical.flatMap(v=>(v as any).sourceFifo.sourceQuantities??[]).map((q:any)=>[JSON.stringify([q.executionId,q.sourceKey,q.category,q.role]),q])).values()],
    consumptions:[...new Map(canonical.flatMap(v=>(v as any).sourceFifo.consumptions??[]).map((c:any)=>[JSON.stringify(c),c])).values()],
    lots:[...new Map(canonical.flatMap(v=>(v as any).sourceFifo.lots??[]).map((l:any)=>[l.sourceKey,l])).values()],
  }}:undefined;
  const coverageReasons=[...reasons,...(unpairedRounds.length?['source-negative-inventory']:[])];
  coverage.push({accountId,instrumentId,market:item?.market??market(executions[0]?.instrument.market??''),reasons:[...new Set(coverageReasons)],sourceRefs:inspection.refs,universeComplete:category!==null&&(ordinary||!executions.some(e=>e.side==='sell'))&&!coverageReasons.length,category});
  if(item)allocations.push({positionKey:item.positionKey,accountId,instrumentId,category,sourceRefs:inspection.refs,reasons:categoryMetrics?[]:attribution.reasons,...(canonicalProof?{canonicalFifo:true as const}:{}),...(categoryMetrics?{categoryMetrics}:{}),...(canonicalProof?.sourceFifo?.sourceQuantities?{sourceQuantities:canonicalProof.sourceFifo.sourceQuantities,consumptions:canonicalProof.sourceFifo.consumptions??[],sourceLots:canonicalProof.sourceFifo.lots}:{}),parts:executions.map(e=>{const short=e.source.positionEffect?.includes('short')??false;const ledgerClose=!!ledgerPreview?.realizedContributions[`execution:${e.id}:${item.currency}`];return {sourceRef:refs.get(e.id)!,quantity:e.quantity,fee:feeValue(e),feeCurrency:executionFeeCurrency(e),role:short?(e.side==='sell'?'open-short' as const:'close-short' as const):category==='long'||category==='ipo'||e.source.positionEffect?.includes('long')?(e.side==='buy'?'open-long' as const:'close-long' as const):category==='short'?(e.side==='sell'?'open-short' as const:'close-short' as const):ledgerClose?(e.side==='sell'?'close-long' as const:'close-short' as const):null};})});
  const financial=capture.financial.find(f=>f.scope.accountId===accountId&&f.scope.instrumentId===instrumentId);
  // A scope-level review/rounding reason must not erase a verifiable close.
  // Keep the row with unknown money when the ledger cannot prove its amount.
  if(!item||!rounds.length)continue;
  const longExecutions=executions.filter(e=>e.source.positionEffect?.includes('long'));
  const roundedLong=roundedOrdinaryRounds(longExecutions.length?longExecutions:category==='long'?executions:[],rounds.filter(r=>roundDirections.get(r.id)!=='short'));
  const rounding=new Map<string,ReturnType<typeof decimal>>();
  const ledger=ledgerPreview!;
  const ledgerPnl=(round:{closingExecutionIds:string[]})=>{
   const key=(id:string,currency:string)=>`execution:${id}:${currency}`;
   const aggregate=(facts:typeof ledger.realizedContributions|typeof ledger.closedFeeContributions)=>{
    const values=new Map<string,string|null>();
    for(const id of round.closingExecutionIds)for(const [entry,fact] of Object.entries(facts))if(entry.startsWith(`execution:${id}:`)){
      const currency=entry.slice(`execution:${id}:`.length),prior=values.get(currency);
      values.set(currency,prior===null||fact.amount===null?null:decimal(prior??'0').plus(fact.amount).toString());
    }
    return values;
   };
   const netByCurrency=aggregate(ledger.realizedContributions),feeByCurrency=aggregate(ledger.closedFeeContributions);
   if(!netByCurrency.has(item.currency))netByCurrency.set(item.currency,null);
   if(!feeByCurrency.has(item.currency))feeByCurrency.set(item.currency,null);
   const target=new Set([...netByCurrency.keys(),...feeByCurrency.keys()]).size>1?'CNY':item.currency,fx=core.fx??source.currentFx;
   const netAmount=convertNative(Object.fromEntries(netByCurrency),target,fx);
   const feeValues=Object.fromEntries(feeByCurrency),convertedFees=convertNative(feeValues,target,fx);
   const fees=[...feeByCurrency].map(([currency,value])=>({currency,value,reasons:value===null?['round-fees-unavailable']:[]}));
   const grossValue=netAmount.value!==null&&convertedFees.value!==null?decimal(netAmount.value).plus(convertedFees.value).toString():null;
   const financialReasons=[...new Set([...netAmount.reasons,...convertedFees.reasons])];
   return {gross:{currency:target,value:grossValue,reasons:grossValue===null?(financialReasons.length?financialReasons:['round-financial-unavailable']):[]},net:{currency:target,value:netAmount.value,reasons:netAmount.value===null?(financialReasons.length?financialReasons:['round-financial-unavailable']):[]},fees};
  };
  const publish=(value:string|null,key:string)=>{if(value===null)return null;const before=rounding.get(key)??decimal('0'),after=before.plus(value);rounding.set(key,after);return decimal(after.toFixed(2)).minus(before.toFixed(2)).toFixed(2);};
  const orderedRounds=rounds.filter(r=>r.closingExecutionIds.every(id=>executions.some(e=>e.id===id))).sort((a,b)=>{const close=(ids:string[])=>executions.filter(e=>ids.includes(e.id)).map(e=>e.executedAt).sort().at(-1)??'';return close(a.closingExecutionIds).localeCompare(close(b.closingExecutionIds))||a.id.localeCompare(b.id);});
  for(const round of orderedRounds){
   const roundAllocation=allocations.find(a=>a.positionKey===item.positionKey);
   const closing=executions.filter(e=>round.closingExecutionIds.includes(e.id));
   const proven=closing.length===round.closingExecutionIds.length&&closing.every(e=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(executionBusinessDay(e))&&Number.isFinite(Date.parse(executionBusinessDay(e)));}catch{return false;}});
   const exact=financial?.accountingPnl.rounds.find(r=>r.roundId===round.id);
   const precisionOnly=exact&&(exact.gross.value===null||exact.net.value===null)&&[...exact.gross.reasons,...exact.net.reasons].every(r=>r.includes('precision')||r==='round-fees-unavailable');
   const rounded=roundDirections.get(round.id)==='short'?null:roundedLong;
   const roundedValue=rounded?.get(round.id);
   const ledgerValue=ledgerPnl(round),fallback=roundedValue&&roundedValue.net.value!==null?roundedValue:ledgerValue;
   const exactIncomplete=exact&&(exact.net.value===null||exact.gross.value===null);
   const mixedCanonical=!!roundAllocation?.sourceQuantities&&new Set(roundAllocation.sourceQuantities.filter(q=>q.role.startsWith('close-')&&q.executionId!==undefined&&round.closingExecutionIds.includes(q.executionId)).map(q=>q.category)).size>1;
   const pnl=mixedCanonical?ledgerValue:exact?(exactIncomplete&&ledgerValue.net.value!==null?ledgerValue:roundedValue&&(precisionOnly||exact.net.value===null||exact.gross.value===null)?roundedValue:exact):fallback;
   const money=(value:typeof pnl extends undefined?never:NonNullable<typeof pnl>['net']|undefined)=>({currency:value?.currency??item.currency,value:cents(value?.value??null),reasons:value?.reasons??['round-financial-unavailable']});
   const gross={...money(pnl?.gross),value:publish(pnl?.gross.value??null,'gross')},fees=(pnl?.fees??[{currency:item.currency,value:null}]).map(f=>({currency:f.currency,value:publish(f.value,'fee:'+f.currency),reasons:f.value===null?['round-fees-unavailable']:[]}));
   const net=pnl?.net.value!==null&&pnl?.net.value!==undefined&&gross.value!==null&&fees.every(f=>f.value!==null&&f.currency===gross.currency)?{currency:gross.currency,value:fees.reduce((v,f)=>v.minus(f.value!),decimal(gross.value)).toFixed(2),reasons:[]}:money(pnl?.net);
   const roundCategory=roundDirections.get(round.id)??(category==='short'?'short':category==='ipo'?'ipo':'long');
   closeRounds.push({id:JSON.stringify([accountId,instrumentId,inspection.revision,round.id]),roundId:round.id,accountId,instrumentId,market:item.market,name:item.name,code:item.code,category:roundCategory,closeBusinessDay:proven?closing.map(executionBusinessDay).sort().at(-1)!:null,revision:inspection.revision,fingerprint:inspection.fingerprint,closingExecutionIds:round.closingExecutionIds,pairings:round.pairings,sourceRefs:inspection.refs.filter(r=>round.closingExecutionIds.includes(r.executionId)||round.pairings.some(p=>p.openingExecutionId===r.executionId)),gross,net,fees});
  }
 }
 for(const item of catalog)if(!allocations.some(a=>a.positionKey===item.positionKey)){
  const sourceRefs=core.trades.find(t=>t.positionKey===item.positionKey)?.trades.flatMap(t=>t.sourceRef?[t.sourceRef]:[])??[];
  allocations.push({positionKey:item.positionKey,accountId:item.accountId,instrumentId:item.instrumentId,category:null,sourceRefs,reasons:['source-scope-not-inspected'],parts:[]});
  coverage.push({accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,reasons:['source-scope-not-inspected'],sourceRefs,universeComplete:false,category:null});
 }
 // Unknown classification scopes remain in coverage even though core intentionally excludes them.
 for(const u of source.unclassified??[]){
  const existing=coverage.find(c=>c.accountId===u.accountId&&c.instrumentId===u.instrumentId);
  if(existing){existing.reasons=[...new Set([...existing.reasons,'unknown-trading-nature'])];existing.universeComplete=false;existing.category=null;}
  else coverage.push({accountId:u.accountId,instrumentId:u.instrumentId,market:market(u.market),reasons:['unknown-trading-nature'],sourceRefs:[],universeComplete:false,category:null});
  const allocation=allocations.find(a=>a.accountId===u.accountId&&a.instrumentId===u.instrumentId);
  if(allocation){delete allocation.categoryMetrics;allocation.category=null;allocation.reasons=[...new Set([...allocation.reasons,'unknown-trading-nature'])];for(const part of allocation.parts??[])part.role=null;}
 }
 const effectiveReview:FullModules['effectiveReview']=catalog.map(item=>{
  const rounds=closeRounds.filter(r=>r.accountId===item.accountId&&r.instrumentId===item.instrumentId);
  // Legacy/Recall identities name technical episodes. There is no approved round migration proof.
  // Keep these facts explicit rather than matching a coincidentally equal round id.
  const scopeKey=item.accountId+':'+canonicalInstrumentId(item.code,item.exchange)+':live';
  const episodeScope=(id:string)=>{try{return JSON.parse(decodeURIComponent(id.match(/^episode:(.*):[0-9]+(?:\:evidence:.*)?$/)?.[1]??''))[0] as string;}catch{return null;}};
  const relevantLegacy=source.reviewFacts.legacy.filter(f=>!f.storageIdentity.instrumentId||f.storageIdentity.instrumentId===item.instrumentId||f.instrumentId===item.instrumentId);
  const relevantRecall=source.reviewFacts.recall.filter(f=>{const scope=episodeScope(f.episodeId);return scope===null||scope===scopeKey;});
  const absent=relevantLegacy.length===0&&relevantRecall.length===0;
  return {positionKey:item.positionKey,state:rounds.length&&absent?'pending':'unknown',reasons:rounds.length&&absent?[]:[rounds.length?'business-round-review-binding-unproven':'no-confirmed-close-round']};
 });
 const modules:FullModules={closeRounds,catalog,coverage,allocations,effectiveReview};
 const accountMarkets={CN:new Set<string>(),HK:new Set<string>(),US:new Set<string>()};
 for(const item of [...catalog,...coverage,...collectFees(source).filter(f=>Date.parse(f.knownAt)<=Date.parse(source.asOf))]){
  const m=market(item.market??'');if(m!=='all'&&item.accountId!=='all')accountMarkets[m].add(item.accountId);
 }
 const accountIdsByMarket={CN:[...accountMarkets.CN].sort(),HK:[...accountMarkets.HK].sort(),US:[...accountMarkets.US].sort()};
 const fx=core.fx??source.currentFx;
 const manifest:FullManifestV1={accountIdsByMarket,schema:FULL_SCHEMA,releaseId:core.id,sourceSequence:source.sequence,asOf:source.asOf,businessDate:source.businessDate,timezone:'Asia/Shanghai',fx,fxVersion:fullHash(fx),capabilities:['core-v1',FULL_SCHEMA,'catalog-search-v1','fixed-release-detail-v1','global-open-membership-v1','effective-review-unknown-v1'],moduleComplete:true,modules:Object.fromEntries(FULL_MODULES.map(k=>[k,{hash:fullHash(modules[k]),count:modules[k].length,version:'1',complete:true}]))};
 return {manifest,modules};
}
