import {collectFees} from './fees';
import {buildContributionMetrics} from './contribution-allocation';
import {classifyContributionDirection} from './contribution-direction';
import {executionFeeCurrency} from '../trades/types';
import {roundedOrdinaryRounds} from './full-money';
import {canonicalInstrumentId} from '../instruments/display-name';
import {createHash} from 'node:crypto';
import type {SourceSnapshot} from './source';
import type {ReleaseInput} from './contracts';
import type {BusinessPairingStore,PairingInspection} from './business-pairing-store';
import {executionBusinessDay} from './finance';
import {decimal} from './period';
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
/** Only confirmed business rounds are consumed. Technical episodes are never synthesized into rounds. */
export function buildFullRelease(source:SourceSnapshot,core:ReleaseInput,capture:FullCapture):FullBuild{
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
  const reasons=[...inspection.reasons];
  if(inspection.status!=='current'&&executions.some(e=>e.side==='sell'))reasons.push('pairing-'+inspection.status);
  const confirmed=new Set(inspection.status==='current'?inspection.fact?.rounds.flatMap(r=>r.closingExecutionIds):[]);
  if(executions.some(e=>e.side==='sell'&&!confirmed.has(e.id)))reasons.push('unconfirmed-closing-executions');
  const ordinary=inspection.status==='current'&&!inspection.reasons.length;
  const attribution=classifyContributionDirection(executions,source.monthly,!inspection.reasons.length);
  const category=attribution.category;
  const original=core.scopes.flatMap(s=>s.metricObjects??[]).find(o=>o.positionKey===item?.positionKey);
  const categoryMetrics=category===null&&original?buildContributionMetrics(executions,source,original):null;
  coverage.push({accountId,instrumentId,market:item?.market??market(executions[0]?.instrument.market??''),reasons:[...new Set(reasons)],sourceRefs:inspection.refs,universeComplete:(ordinary||!executions.some(e=>e.side==='sell'))&&!reasons.length,category});
  if(item)allocations.push({positionKey:item.positionKey,accountId,instrumentId,category,sourceRefs:inspection.refs,reasons:categoryMetrics?[]:attribution.reasons,...(categoryMetrics?{categoryMetrics}:{}),parts:executions.map(e=>({sourceRef:refs.get(e.id)!,quantity:e.quantity,fee:feeValue(e),feeCurrency:executionFeeCurrency(e),role:category==='long'?(e.side==='buy'?'open-long' as const:'close-long' as const):category==='short'?(e.side==='sell'?'open-short' as const:'close-short' as const):null}))});
  const financial=capture.financial.find(f=>f.scope.accountId===accountId&&f.scope.instrumentId===instrumentId);
  if(!ordinary||!item||!inspection.fact)continue;
  const rounded=inspection.fact.policy==='ordinary-live-long-lifo-v1'?roundedOrdinaryRounds(executions,inspection.fact.rounds):roundedOrdinaryRounds([],[]);
  const rounding=new Map<string,ReturnType<typeof decimal>>();
  const publish=(value:string|null,key:string)=>{if(value===null)return null;const before=rounding.get(key)??decimal('0'),after=before.plus(value);rounding.set(key,after);return decimal(after.toFixed(2)).minus(before.toFixed(2)).toFixed(2);};
  const orderedRounds=inspection.fact.rounds.filter(r=>r.closingExecutionIds.every(id=>executions.some(e=>e.id===id))).sort((a,b)=>{const close=(ids:string[])=>executions.filter(e=>ids.includes(e.id)).map(e=>e.executedAt).sort().at(-1)??'';return close(a.closingExecutionIds).localeCompare(close(b.closingExecutionIds))||a.id.localeCompare(b.id);});
  for(const round of orderedRounds){
   const closing=executions.filter(e=>round.closingExecutionIds.includes(e.id));
   const proven=closing.length===round.closingExecutionIds.length&&closing.every(e=>!['date-only'].includes(e.source.timePrecision??'')&&!e.source.timeCandidates?.length);
   const exact=financial?.accountingPnl.rounds.find(r=>r.roundId===round.id);
   const precisionOnly=exact&&(exact.gross.value===null||exact.net.value===null)&&[...exact.gross.reasons,...exact.net.reasons].every(r=>r.includes('precision')||r==='round-fees-unavailable');
   const pnl=precisionOnly&&rounded.has(round.id)?rounded.get(round.id):exact;
   const money=(value:typeof pnl extends undefined?never:NonNullable<typeof pnl>['net']|undefined)=>({currency:value?.currency??item.currency,value:cents(value?.value??null),reasons:value?.reasons??['round-financial-unavailable']});
   const gross={...money(pnl?.gross),value:publish(pnl?.gross.value??null,'gross')},fees=(pnl?.fees??[{currency:item.currency,value:null}]).map(f=>({currency:f.currency,value:publish(f.value,'fee:'+f.currency),reasons:f.value===null?['round-fees-unavailable']:[]}));
   const net=pnl?.net.value!==null&&pnl?.net.value!==undefined&&gross.value!==null&&fees.every(f=>f.value!==null&&f.currency===gross.currency)?{currency:gross.currency,value:fees.reduce((v,f)=>v.minus(f.value!),decimal(gross.value)).toFixed(2),reasons:[]}:money(pnl?.net);
   closeRounds.push({id:JSON.stringify([accountId,instrumentId,inspection.revision,round.id]),roundId:round.id,accountId,instrumentId,market:item.market,name:item.name,code:item.code,category:'long',closeBusinessDay:proven?closing.map(executionBusinessDay).sort().at(-1)!:null,revision:inspection.revision,fingerprint:inspection.fingerprint,closingExecutionIds:round.closingExecutionIds,pairings:round.pairings,sourceRefs:inspection.refs.filter(r=>round.closingExecutionIds.includes(r.executionId)||round.pairings.some(p=>p.openingExecutionId===r.executionId)),gross,net,fees});
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
