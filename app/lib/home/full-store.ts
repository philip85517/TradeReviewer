import {HOME_FULL_SCHEMA} from '../../../db/home-full-schema';
import {createHash} from 'node:crypto';
import type {ExecutionContentRef} from './execution-content-ref';
import {compactFullEvidence,evidenceKeys,sourceRefsKey} from './full-evidence';
import type {DatabaseSync} from 'node:sqlite';
import type {Amount,Holding} from '../../components/homepage-preview/display-contract';
import {HOME_FINANCIAL_PARTITION_VERSION,type MetricObject,type NativeDay} from './contracts';
import {FULL_SCHEMA,coreRequest,initialFullRequest,type FullRequestV1,type FullResultV1,type FullMoney,type FullCoverage,type FullRound,type FullContribution,type FullContributionRow,type FullHistory,type FullSourceCoverage,type FullDetailTarget,type FullDetail} from './full-contracts';
import {validateFull} from './full-persistence';
import {fullHash,type FullBuild} from './full-projection';
import {HomeStore,HomeReadError} from './store';
import {convertNative,decimal,currentAmounts,nextDay,periodAmounts,projectPeriod,revalueAmount} from './period';
import {confirmedSubtotal} from './metric-objects';
import {NativeSeriesAccumulator} from './native-series';
import {windowNativeObjects,validateNativeOrdering} from './full-window';
const FULL_QUERY_COMPUTATION='window-prefix-v11-split-provenance';
const FINANCIAL_ALGORITHM=FULL_QUERY_COMPUTATION+':'+HOME_FINANCIAL_PARTITION_VERSION;
const jsonHash=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const money=(value:string|null,reasons:string[]=[],valuationNotes:string[]=[]):FullMoney=>({value:value===null?null:decimal(value).toFixed(2),currency:'CNY',reasons,...(valuationNotes.length?{valuationNotes:[...new Set(valuationNotes)]}:{})});
const sum=(items:FullMoney[],extra:string[]=[]):FullMoney=>money(items.some(i=>i.value===null)||extra.length?null:items.reduce((v,i)=>v.plus(i.value!),decimal('0')).toFixed(2),[...new Set([...extra,...items.flatMap(i=>i.reasons)])],items.flatMap(i=>i.valuationNotes??[]));
function page<T>(rows:T[],requested:number){const pages=Math.max(1,Math.ceil(rows.length/8)),p=Math.min(requested,pages);return {rows:rows.slice((p-1)*8,p*8),total:rows.length,page:p,pages};}
export class FullHomeStore{
 private readonly accountDirectoryMemo=new WeakMap<FullBuild,FullResultV1['accountIdsByMarket']>();
 private readonly coverageRecipes=new WeakMap<ExecutionContentRef[],number[]>();
 private readonly evidenceMemo=new WeakMap<FullBuild,Map<string,{text:string;hash:string;refs:ExecutionContentRef[]}>>();
 private readonly coverageSources=new WeakMap<FullBuild,WeakMap<Set<string>,{scopes:FullSourceCoverage[];refs:ExecutionContentRef[]}>>();
 constructor(private readonly db:DatabaseSync){}
 private resolve(id?:string):FullBuild{
  id=id??new HomeStore(this.db).head()??undefined;if(!id)throw new HomeReadError(503,'完整首页正在准备');
  if(!this.db.prepare('SELECT 1 FROM home_publication WHERE release_id=?').get(id))throw new HomeReadError(410,'结果版本已过期，请刷新');
  const full=validateFull(this.db,id);if(!full)throw new HomeReadError(503,'该版本尚不支持完整首页');return full;
 }
 // Membership comes from immutable release evidence, including closed and
 // unclassified scopes. Never derive this directory from the selected window.
 private accountIdsByMarket(full:FullBuild):FullResultV1['accountIdsByMarket']{
  if(full.manifest.accountIdsByMarket)return full.manifest.accountIdsByMarket;
  const memo=this.accountDirectoryMemo.get(full);if(memo)return memo;
  const groups={CN:new Set<string>(),HK:new Set<string>(),US:new Set<string>()};
  for(const item of [...full.modules.catalog,...full.modules.coverage]){
   if(item.accountId!=='all'&&Object.hasOwn(groups,item.market))groups[item.market as keyof typeof groups].add(item.accountId);
  }
  // Fee-only accounts are absent from the position catalog. Their published
  // all-scope ledger retains the actual market attribution (null stays unknown).
  const ledger=this.db.prepare('SELECT s.current_json FROM home_release_scope r JOIN home_scope_result s USING(scope_version) WHERE r.release_id=? AND r.scope_id=?').get(full.manifest.releaseId,JSON.stringify(['all','all']));
  if(ledger)for(const fee of (JSON.parse(String(ledger.current_json)) as NativeDay).feeWindows??[]){
   const market=fee.market?.startsWith('CN')?'CN':fee.market;
   if(fee.accountId!=='all'&&market&&Object.hasOwn(groups,market))groups[market as keyof typeof groups].add(fee.accountId);
  }
  const result={CN:[...groups.CN].sort(),HK:[...groups.HK].sort(),US:[...groups.US].sort()};this.accountDirectoryMemo.set(full,result);return result;
 }
 private convert(value:FullMoney,full:FullBuild):FullMoney{const amount=convertNative({[value.currency]:value.value},'CNY',full.manifest.fx,[...value.reasons,...(value.valuationNotes??[])]);return money(amount.value,amount.reasons,amount.valuationNotes);}
 private coverage(full:FullBuild,ids:Set<string>,rounds:FullRound[]):FullCoverage{
  let bySelection=this.coverageSources.get(full);if(!bySelection){bySelection=new WeakMap();this.coverageSources.set(full,bySelection);}
  let source=bySelection.get(ids);if(!source){const scopes=full.modules.coverage.filter(s=>ids.has(JSON.stringify([s.accountId,s.instrumentId])));source={scopes,refs:scopes.flatMap(s=>s.sourceRefs)};this.coverageRecipes.set(source.refs,full.modules.coverage.flatMap((scope,index)=>ids.has(JSON.stringify([scope.accountId,scope.instrumentId]))?[index]:[]));bySelection.set(ids,source);}const {scopes}=source;
  const reasons=[...new Set([...scopes.flatMap(s=>s.reasons),...rounds.filter(r=>!r.closeBusinessDay).map(()=>'close-business-day-unknown')])];
  const complete=scopes.every(s=>s.universeComplete)&&!rounds.some(r=>!r.closeBusinessDay);
  const known=rounds.filter(r=>this.convert(r.net,full).value!==null).length;
  return {universeComplete:complete,confirmedClosedCount:rounds.length,closedCount:complete?rounds.length:null,knownNetCount:known,unknownNetCount:rounds.length-known,reasons,sourceRefsKey:'',affectedSourceRefs:source.refs};
 }
 private selection(full:FullBuild,r:FullRequestV1){
  const s=r.selection;if(s.assetTypes.some(v=>!['stock','etf'].includes(v)))throw new HomeReadError(422,'不支持该资产类型');
  const initial=full.modules.catalog.filter(c=>(s.market==='all'||c.market===s.market)&&(s.accountId==='all'||c.accountId===s.accountId));
  const openInstruments=new Set(initial.filter(c=>c.open).map(c=>c.instrumentId));
  const opened=initial.filter(c=>!s.globalOpenOnly||openInstruments.has(c.instrumentId));
  const assetUnknown=!!s.assetTypes.length&&(opened.some(c=>c.assetType===null)||full.modules.coverage.some(c=>(s.market==='all'||c.market===s.market)&&(s.accountId==='all'||c.accountId===s.accountId)&&!initial.some(i=>i.accountId===c.accountId&&i.instrumentId===c.instrumentId)));
  const selected=opened.filter(c=>!s.assetTypes.length||c.assetType!==null&&s.assetTypes.includes(c.assetType));
  // Review is security membership within the authorized account/market scope.
  const reviews=new Map(full.modules.effectiveReview.map(v=>[v.positionKey,v.state]));
  const states=new Map<string,('done'|'pending'|'unknown')[]>();
  for(const item of selected){const rows=states.get(item.instrumentId)??[];rows.push(reviews.get(item.positionKey)??'unknown');states.set(item.instrumentId,rows);}
  const qualifies=(rows:('done'|'pending'|'unknown')[])=>s.review==='pending'?rows.includes('pending'):rows.length>0&&rows.every(v=>v==='done');
  const filtered=s.review==='all'?selected:selected.filter(c=>qualifies(states.get(c.instrumentId)!));
  const reviewUnknown=s.review!=='all'&&[...states.values()].some(rows=>!qualifies(rows)&&rows.includes('unknown'));
  const ids=new Set(filtered.map(c=>JSON.stringify([c.accountId,c.instrumentId])));
  if(!s.assetTypes.length&&!s.globalOpenOnly&&s.review==='all')for(const c of full.modules.coverage)if((s.market==='all'||c.market===s.market)&&(s.accountId==='all'||c.accountId===s.accountId))ids.add(JSON.stringify([c.accountId,c.instrumentId]));
  return {items:filtered,ids,assetUnknown,reviewUnknown:assetUnknown||reviewUnknown};
 }
 private history(full:FullBuild,r:FullRequestV1,ids:Set<string>,reviewUnknown:boolean,preloaded?:MetricObject[]):FullHistory{
  const all=full.modules.closeRounds.filter(v=>ids.has(JSON.stringify([v.accountId,v.instrumentId])));
  const rounds=all.filter(v=>v.closeBusinessDay===null||Number(v.closeBusinessDay.slice(0,4))>=r.historyRange.fromYear&&Number(v.closeBusinessDay.slice(0,4))<=r.historyRange.toYear);
  const coverage=this.coverage(full,ids,rounds);if(reviewUnknown){coverage.universeComplete=false;coverage.closedCount=null;coverage.reasons.push('selection-membership-unknown');}
  const totals=(rows:FullRound[])=>({net:sum(rows.map(v=>this.convert(v.net,full))),fees:sum(rows.flatMap(v=>v.fees.map(f=>this.convert(f,full))))});
  const keys=new Set(full.modules.catalog.filter(v=>ids.has(JSON.stringify([v.accountId,v.instrumentId]))).map(v=>v.positionKey));
  const financialObjects=preloaded??this.objects(full,keys,this.historyEndpoints(r,full));
  const unknownNature=full.modules.coverage.some(v=>ids.has(JSON.stringify([v.accountId,v.instrumentId]))&&v.reasons.includes('unknown-trading-nature'));
  const financial=(from:string,to:string)=>unknownNature?{net:money(null,['unknown-trading-nature']),fees:money(null,['unknown-trading-nature'])}:financialObjects.length<keys.size?{net:money(null,['metric-object-unavailable']),fees:money(null,['metric-object-unavailable'])}:this.historicalFinancial(full,financialObjects,from,to,reviewUnknown);
  const complete=(_rows:FullRound[],_c:FullCoverage)=>financial(`${r.historyRange.fromYear}-01-01`,`${r.historyRange.toYear}-12-31`);
  const wins=(rows:FullRound[])=>rows.filter(v=>{const n=this.convert(v.net,full).value;return n!==null&&decimal(n).gt(0);}).length;
  const rate=(rows:FullRound[],c:FullCoverage)=>!c.universeComplete||c.unknownNetCount||!rows.length?null:decimal(String(wins(rows))).div(rows.length).mul(100).toFixed(2);
  const years=Array.from({length:r.historyRange.toYear-r.historyRange.fromYear+1},(_,i)=>{const year=r.historyRange.fromYear+i,rows=rounds.filter(v=>v.closeBusinessDay?.startsWith(String(year)));const c=this.coverage(full,ids,rows);if(!coverage.universeComplete){c.universeComplete=false;c.closedCount=null;c.reasons=coverage.reasons;}return {year,...financial(`${year}-01-01`,`${year}-12-31`),count:rows.length,coverage:c};});
  const monthly=r.historyRange.fromYear===r.historyRange.toYear;
  const bucketKeys=monthly?Array.from({length:12},(_,i)=>`${r.historyRange.fromYear}-${String(i+1).padStart(2,'0')}`):years.map(y=>String(y.year));
  let cumulative=money('0');const buckets=bucketKeys.map(key=>{const rows=rounds.filter(v=>v.closeBusinessDay?.startsWith(key)),c=this.coverage(full,ids,rows);if(!coverage.universeComplete){c.universeComplete=false;c.closedCount=null;c.reasons=coverage.reasons;}const t=financial(`${key}${monthly?'-01':'-01-01'}`,monthly?nextDay(`${Number(key.slice(5))===12?Number(key.slice(0,4))+1:Number(key.slice(0,4))}-${String(Number(key.slice(5))===12?1:Number(key.slice(5))+1).padStart(2,'0')}-01`,-1):`${key}-12-31`);if(!t.net.reasons.includes('no-closed-transactions'))cumulative=financial(`${r.historyRange.fromYear}-01-01`,monthly?nextDay(`${Number(key.slice(5))===12?Number(key.slice(0,4))+1:Number(key.slice(0,4))}-${String(Number(key.slice(5))===12?1:Number(key.slice(5))+1).padStart(2,'0')}-01`,-1):`${key}-12-31`).net;return {key,granularity:monthly?'month' as const:'year' as const,...t,count:rows.length,knownWins:wins(rows),winRate:rate(rows,c),cumulativeNet:cumulative,coverage:c};});
  return {coverage,...complete(rounds,coverage),confirmedNet:totals(rounds).net,confirmedFees:totals(rounds).fees,winRate:rate(rounds,coverage),confirmedWinRate:coverage.unknownNetCount||!rounds.length?null:decimal(String(wins(rounds))).div(rounds.length).mul(100).toFixed(2),years,buckets};
 }
 private historyEndpoints(r:FullRequestV1,full:FullBuild):string[]{
  const dates=new Set<string>([`${r.historyRange.fromYear-1}-12-31`,full.manifest.businessDate]);
  for(let year=r.historyRange.fromYear;year<=r.historyRange.toYear;year++){
   dates.add(`${year}-12-31`);
   if(r.historyRange.fromYear===r.historyRange.toYear)for(let month=1;month<=12;month++)dates.add(nextDay(`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`,-1));
  }
  return [...dates].filter(d=>d<=full.manifest.businessDate).sort();
 }
 private historicalFinancial(full:FullBuild,objects:MetricObject[],from:string,to:string,unknown:boolean){
  const end=to<full.manifest.businessDate?to:full.manifest.businessDate;
  if(unknown)return {net:money(null,['selection-membership-unknown']),fees:money(null,['selection-membership-unknown'])};
  if(from>end)return {net:money(null,['future-period']),fees:money(null,['future-period'])};
  const values=objects.map(object=>{
   const start=this.endpoint(object,nextDay(from,-1),full),finish=this.endpoint(object,end,full);
   const net=periodAmounts(start,finish??undefined,from,'CNY').realized;
   if(start&&finish&&net.value!==null&&decimal(net.value).isZero()&&Object.values(finish.buckets).some(b=>!Object.hasOwn(b,'closedTransactions')))return {net:money(null,['closed-transactions-not-published']),fees:money(null,['closed-fees-not-published'])};
   const closed=(day:NativeDay|null)=>day?Object.values(day.buckets).reduce((n,b)=>n+((b as typeof b & {closedTransactions?:number}).closedTransactions??0),0):null;
   if(start&&finish&&net.value!==null&&Object.values(finish.buckets).every(b=>Object.hasOwn(b,'closedTransactions'))&&closed(start)===closed(finish))return {net:money(null,['no-closed-transactions']),fees:money(null,['no-closed-transactions'])};
   const feeDay=(day:NativeDay|null):NativeDay|null=>day&&({...day,feeWindows:[],buckets:Object.fromEntries(Object.entries(day.buckets).map(([code,b])=>[code,{...b,fees:(b as typeof b & {closedFees?:string|null}).closedFees??'0',feesMissing:(b as typeof b & {closedFeesMissing?:number}).closedFeesMissing??1}]))});
   const fees=periodAmounts(feeDay(start),feeDay(finish)??undefined,from,'CNY').fees;
   const published=[start,finish].every(d=>d&&Object.values(d.buckets).every(b=>Object.hasOwn(b,'closedFees')));
   return {net:{value:net.value,currency:'CNY' as const,reasons:net.reasons,...(net.valuationNotes?.length?{valuationNotes:net.valuationNotes}:{})},fees:published?{value:fees.value,currency:'CNY' as const,reasons:fees.reasons}:money(null,['closed-fees-not-published'])};
  });
  const active=values.filter(v=>!v.net.reasons.includes('no-closed-transactions'));
  return active.length?{net:sum(active.map(v=>v.net)),fees:sum(active.map(v=>v.fees))}:{net:money(null,['no-closed-transactions']),fees:money(null,['no-closed-transactions'])};
 }
 private objects(full:FullBuild,keys:Set<string>,endpoints?:string[],opening?:string):MetricObject[]{
  const rows=this.db.prepare(`SELECT o.* FROM (SELECT DISTINCT m.object_version FROM home_release_scope s JOIN home_metric_member m USING(scope_version) WHERE s.release_id=?) v JOIN home_metric_object o USING(object_version)`).all(full.manifest.releaseId);
  const selected=rows.filter(row=>keys.has(String(row.position_key)));if(!selected.length)return [];
  const metadata=new Map(selected.map(row=>{
   const meta=JSON.parse(String(row.metadata_json));
   if(Object.hasOwn(meta,'ordering'))validateNativeOrdering(meta.ordering,String(row.first_day),String(row.last_day));
   return [String(row.object_version),meta];
  }));
  const boundaries=new Map<string,NativeDay[]>();
  const read=(members:typeof selected,window:boolean)=>{
   if(!members.length)return;
   const versions=JSON.stringify(members.map(row=>String(row.object_version)));
   const sql=endpoints?`SELECT b.object_version,b.business_date,b.native_json FROM (SELECT DISTINCT v.value AS object_version,(SELECT MAX(business_date) FROM home_metric_boundary WHERE object_version=v.value AND business_date<=dates.value) AS business_date FROM json_each(?) v CROSS JOIN json_each(?) dates) endpoints CROSS JOIN home_metric_boundary b ON b.object_version=endpoints.object_version AND b.business_date=endpoints.business_date ORDER BY b.object_version,b.business_date`:window?`SELECT b.object_version,b.business_date,b.native_json FROM json_each(?) v JOIN home_metric_boundary b ON b.object_version=v.value AND b.business_date=(SELECT MAX(business_date) FROM home_metric_boundary WHERE object_version=v.value AND business_date<=?) UNION ALL SELECT b.object_version,b.business_date,b.native_json FROM json_each(?) v JOIN home_metric_boundary b ON b.object_version=v.value AND b.business_date>? AND b.business_date<=? ORDER BY object_version,business_date`:'SELECT object_version,native_json FROM home_metric_boundary WHERE object_version IN(SELECT value FROM json_each(?)) ORDER BY object_version,business_date';
   const query=this.db.prepare(sql);
   // Preserve native array transport for complete JSON payloads and SQL order.
   query.setReturnArrays(true);
   const rows=query.all(...(endpoints?[versions,JSON.stringify(endpoints)]:window?[versions,opening!,versions,opening!,full.manifest.businessDate]:[versions]));
   for(const row of rows){const version=String(row[0]),items=boundaries.get(version)??[];items.push(JSON.parse(String(row[endpoints||window?2:1])));boundaries.set(version,items);}
  };
  if(opening!==undefined&&!endpoints){
   read(selected.filter(row=>Object.hasOwn(metadata.get(String(row.object_version)),'ordering')),true);
   read(selected.filter(row=>!Object.hasOwn(metadata.get(String(row.object_version)),'ordering')),false);
  }else read(selected,false);
  return selected.map(row=>({version:String(row.object_version),positionKey:String(row.position_key),...metadata.get(String(row.object_version)),firstDay:String(row.first_day),lastDay:String(row.last_day),current:JSON.parse(String(row.current_json)),boundaries:boundaries.get(String(row.object_version))??[]}));
 }
 private endpoint(object:MetricObject,date:string,full:FullBuild):NativeDay|null{if(date<object.firstDay)return {date,buckets:{},fx:full.manifest.fx,reasons:[]};if(date>object.lastDay)return null;const day=object.boundaries.filter(b=>b.date<=date).at(-1);return day?{...day,date,fx:full.manifest.fx}:null;}
 private contribution(full:FullBuild,r:FullRequestV1,ids:Set<string>,objects:MetricObject[],reviewUnknown:boolean,preloadedHistory?:MetricObject[]):FullContribution{
  const rows:Record<'long'|'short'|'ipo',FullContributionRow[]>={long:[],short:[],ipo:[]};
  const historyObjects=r.contribution.mode==='current'?new Map<string,MetricObject>():new Map((preloadedHistory??this.objects(full,new Set(full.modules.catalog.filter(v=>ids.has(JSON.stringify([v.accountId,v.instrumentId]))).map(v=>v.positionKey)),this.historyEndpoints(r,full))).map(o=>[o.positionKey,o]));
  const allocations=new Map(full.modules.allocations.map(a=>[a.positionKey,a])),objectsByPosition=new Map(objects.map(o=>[o.positionKey,o]));
  const activeIds=new Set<string>();
  for(const item of full.modules.catalog){if(!ids.has(JSON.stringify([item.accountId,item.instrumentId])))continue;
   const allocation=allocations.get(item.positionKey);
   if(r.contribution.mode==='current'){
    const object=objectsByPosition.get(item.positionKey);if(!object){activeIds.add(JSON.stringify([item.accountId,item.instrumentId]));continue;}
    const from=this.endpoint(object,nextDay(r.currentPeriod.from,-1),full),to=this.endpoint(object,r.currentPeriod.to<full.manifest.businessDate?r.currentPeriod.to:full.manifest.businessDate,full);
    const values=periodAmounts(from,to??undefined,r.currentPeriod.from,'CNY');
    if(from&&to&&!Object.values(from.buckets).some(b=>b.count)&&!Object.values(to.buckets).some(b=>b.count)&&from.activity===to.activity)continue;
    activeIds.add(JSON.stringify([item.accountId,item.instrumentId]));
    const categoryObjects=allocation?.categoryMetrics?.map(m=>({category:m.category,object:m.metric}))??(allocation?.category?[{category:allocation.category,object}]:[]);
    const entries=categoryObjects.flatMap(({category,object:part})=>{
     const start=this.endpoint(part,nextDay(r.currentPeriod.from,-1),full),end=this.endpoint(part,r.currentPeriod.to<full.manifest.businessDate?r.currentPeriod.to:full.manifest.businessDate,full);
     if(start&&end&&!Object.values(start.buckets).some(b=>b.count)&&!Object.values(end.buckets).some(b=>b.count)&&(start.activity??0)===(end.activity??0))return [];
     const amounts=periodAmounts(start,end??undefined,r.currentPeriod.from,'CNY');
     return [{category,net:money(amounts.net.value,amounts.net.reasons,amounts.net.valuationNotes),realized:money(amounts.realized.value,amounts.realized.reasons,amounts.realized.valuationNotes),unrealizedChange:money(amounts.unrealizedChange.value,amounts.unrealizedChange.reasons,amounts.unrealizedChange.valuationNotes),fees:money(amounts.fees.value,amounts.fees.reasons,amounts.fees.valuationNotes)}];
    });
    // Publish cents cumulatively across categories, conserving the original
    // account/security total after conversion (including half-cent boundaries).
    for(const field of ['realized','unrealizedChange','fees'] as const){
     if(!allocation?.categoryMetrics||values[field].value===null||entries.some(e=>e[field].value===null))continue;
     const target=field==='unrealizedChange'&&values.net.value!==null&&values.realized.value!==null?decimal(values.net.value).toDecimalPlaces(2).minus(decimal(values.realized.value).toDecimalPlaces(2)):decimal(values[field].value!).toDecimalPlaces(2);
     const residual=target.minus(entries.reduce((v,e)=>v.plus(e[field].value!),decimal('0')));
     if(entries.length&&residual.abs().lte('0.02'))entries[entries.length-1][field].value=decimal(entries[entries.length-1][field].value!).plus(residual).toFixed(2);
    }
    for(const entry of entries){
     if(allocation?.categoryMetrics&&entry.realized.value!==null&&entry.unrealizedChange.value!==null)entry.net.value=decimal(entry.realized.value).plus(entry.unrealizedChange.value).toFixed(2);
     rows[entry.category].push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net:entry.net,realized:entry.realized,unrealizedChange:entry.unrealizedChange,fees:entry.fees,roundCount:null});
    }
   }else{
    const object=historyObjects.get(item.positionKey);
    if(!object)continue;
    const parts=allocation?.categoryMetrics?.map(m=>({category:m.category,object:m.metric}))??(allocation?.category?[{category:allocation.category,object}]:[]);
    for(const part of parts){
     const {net,fees}=this.historicalFinancial(full,[part.object],`${r.historyRange.fromYear}-01-01`,`${r.historyRange.toYear}-12-31`,reviewUnknown);
     if(net.reasons.includes('no-closed-transactions'))continue;
     const rounds=full.modules.closeRounds.filter(v=>v.accountId===item.accountId&&v.instrumentId===item.instrumentId&&v.closeBusinessDay&&Number(v.closeBusinessDay.slice(0,4))>=r.historyRange.fromYear&&Number(v.closeBusinessDay.slice(0,4))<=r.historyRange.toYear);
     rows[part.category].push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net,realized:net,unrealizedChange:money('0'),fees,roundCount:allocation?.categoryMetrics?null:rounds.length});
    }
   }
  }
  const current=r.contribution.mode==='current',coverageIds=current?activeIds:ids;
  // Unknown-nature executions may have no catalog/metric object at all. Their
  // absence from the known projection does not prove an empty current scope.
  if(current)for(const scope of full.modules.coverage)if(ids.has(JSON.stringify([scope.accountId,scope.instrumentId]))&&scope.reasons.includes('unknown-trading-nature'))coverageIds.add(JSON.stringify([scope.accountId,scope.instrumentId]));
  const coverage=this.coverage(full,coverageIds,full.modules.closeRounds.filter(v=>coverageIds.has(JSON.stringify([v.accountId,v.instrumentId]))));
  const selectedAllocations=full.modules.allocations.filter(a=>coverageIds.has(JSON.stringify([a.accountId,a.instrumentId])));
  const selectedByScope=new Map(selectedAllocations.map(a=>[JSON.stringify([a.accountId,a.instrumentId]),a]));
  const unallocated=full.modules.coverage.filter(c=>{const key=JSON.stringify([c.accountId,c.instrumentId]),a=selectedByScope.get(key);return coverageIds.has(key)&&(c.reasons.includes('unknown-trading-nature')||!(a?.category||a?.categoryMetrics?.length)||(current?!objectsByPosition.has(a!.positionKey):!historyObjects.has(a!.positionKey)));});
  coverage.classifiedCount=coverageIds.size-unallocated.length;coverage.eligibleCount=coverageIds.size;
  // Current attribution needs source direction, not confirmation of business closes.
  // Historical coverage still requires confirmed rounds and their complete universe.
  if(current){coverage.reasons=[...new Set(unallocated.flatMap(c=>{const a=selectedByScope.get(JSON.stringify([c.accountId,c.instrumentId]));return [...(a?.reasons??[]),...(c.reasons.includes('unknown-trading-nature')?['unknown-trading-nature']:[]),...(!a?['source-scope-not-inspected']:!objectsByPosition.has(a.positionKey)?['metric-object-unavailable']:[])];}))];coverage.universeComplete=unallocated.length===0;coverage.closedCount=coverage.universeComplete?coverage.confirmedClosedCount:null;}
  if(reviewUnknown||unallocated.length){coverage.universeComplete=false;coverage.closedCount=null;coverage.reasons.push(reviewUnknown?'selection-membership-unknown':'unallocated-source');}
  const totals=(values:FullContributionRow[])=>{const missing=(!current&&unallocated.length)||!values.length&&!coverage.universeComplete?coverage.reasons:[];return {net:sum(values.map(v=>v.net),missing),realized:sum(values.map(v=>v.realized),missing),unrealizedChange:sum(values.map(v=>v.unrealizedChange),missing),fees:sum(values.map(v=>v.fees),missing),count:values.length,coverage};};
  if(r.contribution.localOpenOnly)for(const category of ['long','short','ipo'] as const)rows[category]=rows[category].filter(v=>v.open);
  const categories=(['long','short','ipo'] as const).map(category=>({category,...totals(rows[category]),...(!coverage.universeComplete&&rows[category].length===0?{net:money(null,coverage.reasons),realized:money(null,coverage.reasons),unrealizedChange:money(null,coverage.reasons),fees:money(null,coverage.reasons)}:{})}));
  const selected=rows[r.contribution.category];
  const markets=(['all','CN','HK','US'] as const).map(market=>({market,...totals(selected.filter(v=>market==='all'||v.market===market))}));
  const filtered=selected.filter(v=>r.contribution.drillMarket==='all'||v.market===r.contribution.drillMarket);
  filtered.sort((a,b)=>{const av=a.net.value,bv=b.net.value;return (r.contribution.sort==='name'?a.name.localeCompare(b.name,'zh-CN'):av===null||bv===null?av===bv?0:av===null?1:-1:decimal(av).comparedTo(bv))*(r.contribution.direction==='asc'?1:-1)||a.id.localeCompare(b.id);});
  return {mode:r.contribution.mode,category:r.contribution.category,...page(filtered,r.contribution.page),...totals(filtered),categories,markets};
 }
 private readEvidence(full:FullBuild,key:string,required=true):ExecutionContentRef[]|null{
  const row=this.db.prepare('SELECT recipe_json,payload_hash FROM home_full_evidence WHERE release_id=? AND source_key=?').get(full.manifest.releaseId,key);
  if(!row){if(required)throw new HomeReadError(404,'证据键不存在');return null;}
  const text=String(row.recipe_json),hash=String(row.payload_hash);let memo=this.evidenceMemo.get(full);const hit=memo?.get(key);if(hit?.text===text&&hit.hash===hash)return hit.refs;
  if(fullHash(text)!==hash)throw new Error('invalid full evidence recipe hash');
  const recipe=JSON.parse(text) as {version:number;releaseId:string;key:string;count:number;indices:number[]};
  if(recipe.version!==1||recipe.releaseId!==full.manifest.releaseId||recipe.key!==key||!Number.isSafeInteger(recipe.count)||recipe.count<0||!Array.isArray(recipe.indices)||recipe.indices.some((index,i)=>!Number.isSafeInteger(index)||index<0||index>=full.modules.coverage.length||i>0&&index<=recipe.indices[i-1]))throw new Error('invalid full evidence recipe');
  const refs=recipe.indices.flatMap(index=>full.modules.coverage[index].sourceRefs);if(refs.length!==recipe.count||sourceRefsKey(refs)!==key)throw new Error('full evidence key mismatch');
  if(!memo){memo=new Map();this.evidenceMemo.set(full,memo);}if(memo.size>=64)memo.delete(memo.keys().next().value!);Object.freeze(refs);memo.set(key,{text,hash,refs});return refs;
 }
 evidence(id:string,key:string){const full=this.resolve(id),refs=this.readEvidence(full,key)!;return {schema:FULL_SCHEMA,evidenceTransport:'release-key-v2' as const,releaseId:id,sourceRefsKey:key,count:refs.length,sourceRefs:refs};}
 inline(result:FullResultV1):FullResultV1{const full=this.resolve(result.releaseId),sourceRefsByKey=Object.fromEntries(evidenceKeys(result).map(key=>[key,this.readEvidence(full,key)!]));return {...result,evidenceTransport:'inline-dictionary-v1',sourceRefsByKey};}
 private financialKey(r:FullRequestV1){return fullHash([r.selection,r.currentPeriod,r.historyRange,r.contribution]);}
 private financialPartition(full:FullBuild,r:FullRequestV1):{history:FullHistory;contribution:FullContribution}|null{
  if(!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='home_full_financial'").get())return null;
  const row=this.db.prepare('SELECT * FROM home_full_financial WHERE release_id=? AND partition_key=?').get(full.manifest.releaseId,this.financialKey(r));
  if(!row||row.algorithm!==FINANCIAL_ALGORITHM||row.manifest_hash!==fullHash(full.manifest))return null;
  const text=String(row.payload_json);if(jsonHash(text)!==row.payload_hash)throw new Error('invalid financial partition payload hash');
  const payload=JSON.parse(text);if(payload.releaseId!==full.manifest.releaseId||payload.key!==this.financialKey(r)||!payload.history||!payload.contribution)throw new Error('invalid financial partition identity');
  if(!evidenceKeys(payload).every(key=>this.readEvidence(full,key,false)!==null))return null;
  return payload;
 }
 /** Publish immutable financial partitions without reading core/holdings or creating query artifacts.
  * Staged full releases are sufficient; the atomic publication remains the caller's responsibility. */
 publishFinancialPartitions(releaseId:string,requests?:FullRequestV1[]):{count:number;keys:string[]}{
  this.db.exec(HOME_FULL_SCHEMA);const full=validateFull(this.db,releaseId);if(!full)throw new Error('full release required for financial partitions');
  const defaults=()=>this.db.prepare('SELECT scope_id FROM home_release_scope WHERE release_id=?').all(releaseId).map(row=>JSON.parse(String(row.scope_id))).filter(([market,account])=>account==='all'&&['all','CN','HK','US'].includes(market)).map(([market])=>{const r=initialFullRequest(full.manifest.businessDate);r.selection.market=market;return r;});
  const keys:string[]=[],owned=!this.db.isTransaction;if(owned)this.db.exec('BEGIN IMMEDIATE');try{
   for(const request of requests??defaults()){
    const selected=this.selection(full,request),filtered=request.selection.assetTypes.length>0||request.selection.globalOpenOnly||request.selection.review!=='all';
    if(filtered)throw new Error('financial publication requires unfiltered scope');
    const objects=this.objects(full,new Set(selected.items.map(c=>c.positionKey)),[...new Set([...this.historyEndpoints(request,full),nextDay(request.currentPeriod.from,-1),request.currentPeriod.to<full.manifest.businessDate?request.currentPeriod.to:full.manifest.businessDate])]);
    const key=this.financialKey(request),payload={releaseId,key,history:this.history(full,request,selected.ids,selected.reviewUnknown,objects),contribution:this.contribution(full,request,selected.ids,objects,selected.reviewUnknown,objects)};
    const evidence=compactFullEvidence(payload);
    for(const [sourceKey,refs]of Object.entries(evidence)){
     const indices=this.coverageRecipes.get(refs);if(!indices)throw new Error('missing financial coverage recipe');
     const text=JSON.stringify({version:1,releaseId,key:sourceKey,count:refs.length,indices});
     this.db.prepare('INSERT OR IGNORE INTO home_full_evidence VALUES(?,?,?,?)').run(releaseId,sourceKey,text,fullHash(text));
     this.readEvidence(full,sourceKey);
    }
    const text=JSON.stringify(payload);this.db.prepare('INSERT OR REPLACE INTO home_full_financial VALUES(?,?,?,?,?,?)').run(releaseId,key,FINANCIAL_ALGORITHM,fullHash(full.manifest),jsonHash(text),text);keys.push(key);
   }
   if(owned)this.db.exec('COMMIT');return {count:keys.length,keys};
  }catch(error){if(owned)this.db.exec('ROLLBACK');throw error;}
 }
 read(request:FullRequestV1,id?:string):FullResultV1{
  const full=this.resolve(id),releaseId=full.manifest.releaseId;
  const artifactKey=fullHash([FULL_SCHEMA,'release-key-v2-hash1',FULL_QUERY_COMPUTATION,request,full.manifest.fxVersion]);
  const cached=this.db.prepare('SELECT artifact_id,payload_json FROM home_full_query WHERE release_id=? AND query_key=?').get(releaseId,artifactKey);
  if(cached){const text=String(cached.payload_json);if(jsonHash(text)!==String(cached.artifact_id))throw new Error('invalid full query payload hash');const result=JSON.parse(text) as FullResultV1;if(result.releaseId!==releaseId||result.evidenceTransport!=='release-key-v2'||fullHash(result.request)!==fullHash(request))throw new Error('invalid full query identity');if(evidenceKeys(result).every(key=>this.readEvidence(full,key,false)!==null))return {...result,accountIdsByMarket:this.accountIdsByMarket(full)};}
  if(!this.db.prepare('SELECT 1 FROM home_release_scope WHERE release_id=? AND scope_id=?').get(releaseId,JSON.stringify([request.selection.market,request.selection.accountId])))throw new HomeReadError(404,'账户范围不存在');
  const selected=this.selection(full,request),partition=this.financialPartition(full,request),initial=initialFullRequest(full.manifest.businessDate);
  const historicalPartition=partition??this.financialPartition(full,{...request,currentPeriod:initial.currentPeriod,contribution:initial.contribution});
  const filtered=request.selection.assetTypes.length>0||request.selection.globalOpenOnly||request.selection.review!=='all';
  // The immutable core supplies unfiltered charts. Share the compact financial
  // endpoint batch across history and contribution instead of decoding twice.
  const sharedFinancial=partition?[]:filtered?undefined:this.objects(full,new Set(selected.items.map(c=>c.positionKey)),[...new Set([...(historicalPartition&&request.contribution.mode==='current'?[]:this.historyEndpoints(request,full)),nextDay(request.currentPeriod.from,-1),request.currentPeriod.to<full.manifest.businessDate?request.currentPeriod.to:full.manifest.businessDate])]);
  let objects=sharedFinancial??this.objects(full,new Set(selected.items.map(c=>c.positionKey)),undefined,nextDay(request.currentPeriod.from,-1));
  const windowed=filtered?windowNativeObjects(objects,nextDay(request.currentPeriod.from,-1)):null;if(windowed)objects=windowed.objects;
  const core=new HomeStore(this.db).readHome(coreRequest(request),releaseId);
  if(request.selection.assetTypes.length||request.selection.globalOpenOnly||request.selection.review!=='all'){
   const accumulator=new NativeSeriesAccumulator();for(const o of objects)accumulator.add(o.boundaries);
   const dates=new Set(objects.flatMap(o=>o.boundaries.map(b=>b.date)));dates.add(nextDay(request.currentPeriod.from,-1));dates.add(full.manifest.businessDate);
   for(let d=request.currentPeriod.from;d<=request.currentPeriod.to;d=nextDay(d))dates.add(d);
   const days=windowed!.restoreOrder(accumulator.finish([...dates].sort(),()=>full.manifest.fx));
   const period=projectPeriod(days.find(d=>d.date===nextDay(request.currentPeriod.from,-1))??null,days.filter(d=>d.date>=request.currentPeriod.from&&d.date<=full.manifest.businessDate),request.currentPeriod,'CNY',full.manifest.businessDate);
   const current=currentAmounts(days.find(d=>d.date===full.manifest.businessDate)!,'CNY');
   // Keep confirmed-only members separate from provisional values when another
   // selected member is unknown. Match the immutable core's object coverage.
   const hasPosition=(day:NativeDay|null)=>day&&Object.values(day.buckets).some(b=>b.count>0);
   const evaluated=objects.map(object=>{const baseline=this.endpoint(object,nextDay(request.currentPeriod.from,-1),full),end=this.endpoint(object,period.effectiveEnd,full);return {object,baseline,end,amounts:periodAmounts(baseline,end??undefined,request.currentPeriod.from,'CNY')};});
   const active=evaluated.filter(o=>!o.baseline||!o.end||hasPosition(o.baseline)||hasPosition(o.end)||o.end.activity!==o.baseline.activity);
   for(const field of ['net','realized','unrealizedChange'] as const)period[field].partial=confirmedSubtotal(active.map(o=>({identity:{accountId:o.object.accountId,code:o.object.code,name:o.object.name},amount:o.amounts[field],reasons:[]})),'CNY',full.manifest.fx);
   for(const field of ['marketValue','unrealized'] as const)current[field].partial=confirmedSubtotal(objects.filter(o=>hasPosition(o.current)).map(o=>({identity:{accountId:o.accountId,code:o.code,name:o.name},amount:currentAmounts({...o.current,fx:full.manifest.fx},'CNY')[field],reasons:[]})),'CNY',full.manifest.fx);
   if(selected.reviewUnknown){for(const amount of [period.net,period.realized,period.unrealizedChange,current.marketValue,current.unrealized]){amount.value=null;amount.reasons.push('selection-membership-unknown');}}
   core.metrics={net:period.net,periodRealized:period.realized,unrealizedChange:period.unrealizedChange,currentMarketValue:current.marketValue};core.currentUnrealized=current.unrealized;core.series.points=period.points;
   const rows=this.holdingRows(full,request).filter(h=>selected.items.some(c=>c.id===h.id||c.accountId===h.accountId&&c.code===h.code));
   core.holdings={...core.holdings,...page(rows,request.holdings.page),...current};
  }
  const history=historicalPartition?.history??this.history(full,request,selected.ids,selected.reviewUnknown,sharedFinancial),contribution=partition?.contribution??this.contribution(full,request,selected.ids,objects,selected.reviewUnknown,sharedFinancial);
  const selectionKey=fullHash(request.selection),queryArtifactId=fullHash([releaseId,request,full.manifest.fxVersion,FULL_SCHEMA,FULL_QUERY_COMPUTATION]);
  const result:FullResultV1={schema:FULL_SCHEMA,evidenceTransport:'release-key-v2',releaseId,manifest:full.manifest,request,selectionKey,queryArtifactId,core,accountIdsByMarket:this.accountIdsByMarket(full),history,contribution,capabilities:{globalOpenOnly:true,review:true,assetTypes:true,reasons:[...(selected.assetUnknown?['asset-type-membership-unknown']:[]),...(selected.reviewUnknown?['selection-membership-unknown']:[])]},catalogCount:full.modules.catalog.length};
  const evidence=compactFullEvidence(result);
  // The recipe survives derived-query eviction and is visible before a key can
  // escape. Publication retention and recipe persistence share this writer lock.
  this.db.exec('BEGIN IMMEDIATE');try{
   if(!this.db.prepare('SELECT 1 FROM home_publication WHERE release_id=?').get(releaseId))throw new HomeReadError(410,'结果版本已过期，请刷新');
   for(const [key,refs] of Object.entries(evidence)){
    const indices=this.coverageRecipes.get(refs);if(!indices)throw new Error('missing coverage evidence recipe');
    const text=JSON.stringify({version:1,releaseId,key,count:refs.length,indices}),hash=fullHash(text),prior=this.db.prepare('SELECT recipe_json,payload_hash FROM home_full_evidence WHERE release_id=? AND source_key=?').get(releaseId,key);
    if(prior)this.readEvidence(full,key);
    else this.db.prepare('INSERT INTO home_full_evidence VALUES(?,?,?,?)').run(releaseId,key,text,hash);
   }
   this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
  result.queryArtifactId=fullHash([queryArtifactId,'release-key-v2',evidenceKeys(result).sort()]);const payload=JSON.stringify(result);
  this.db.prepare('INSERT OR REPLACE INTO home_full_query SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM home_publication WHERE release_id=?)').run(releaseId,artifactKey,jsonHash(payload),payload,releaseId);
  return result;
 }
 private holdingRows(full:FullBuild,request:FullRequestV1):Holding[]{
  const version=this.db.prepare('SELECT scope_version FROM home_release_scope WHERE release_id=? AND scope_id=?').get(full.manifest.releaseId,JSON.stringify([request.selection.market,request.selection.accountId]))?.scope_version;
  const rows=this.db.prepare('SELECT row_json FROM home_holding WHERE scope_version=? AND instr(search_text,?)>0').all(String(version),request.holdings.query.toLocaleLowerCase()).map(v=>{const h=JSON.parse(String(v.row_json)) as Holding;return {...h,marketValue:revalueAmount(h.marketValue,'CNY',full.manifest.fx),unrealized:revalueAmount(h.unrealized,'CNY',full.manifest.fx)};});
  return rows.sort((a,b)=>{const key=request.holdings.sort;return (key==='name'?a.name.localeCompare(b.name,'zh-CN'):a[key].value===null||b[key].value===null?a[key].value===b[key].value?0:a[key].value===null?1:-1:decimal(a[key].value!).comparedTo(b[key].value!))*(request.holdings.direction==='asc'?1:-1)||a.id.localeCompare(b.id);});
 }
 search(id:string,query:string){const full=this.resolve(id),items=full.modules.catalog.filter(c=>`${c.name} ${c.code} ${c.exchange}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));return {schema:FULL_SCHEMA,releaseId:id,items,total:items.length};}
 detail(id:string,target:FullDetailTarget,cursor=0):FullDetail{
  const full=this.resolve(id);const round=full.modules.closeRounds.find(r=>r.id===target.id);
  // Holding rows have an opaque ID. Resolve it inside this release, where the
  // persisted row and the catalog share the same account-specific position key.
  const holdingKey=target.kind==='position'?this.db.prepare(
   'SELECT h.position_key FROM home_release_scope r JOIN home_holding h USING(scope_version) WHERE r.release_id=? AND r.scope_id=? AND h.holding_id=?'
  ).get(id,JSON.stringify(['all','all']),target.id)?.position_key:undefined;
  const items=full.modules.catalog.filter(c=>target.accountScope.includes(c.accountId)&&(target.kind==='position'?(c.id===target.id||c.positionKey===holdingKey):target.kind==='instrument'?c.instrumentId===target.id:round?.accountId===c.accountId&&round.instrumentId===c.instrumentId));
  if(!items.length)throw new HomeReadError(404,'该版本目录中没有这个对象');
  const trades=items.flatMap(c=>this.db.prepare('SELECT trade_json FROM home_holding_trade WHERE trade_set_id=? ORDER BY ordinal').all(c.tradeSetId).map(r=>JSON.parse(String(r.trade_json)))).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const item=items[0],raw=this.db.prepare('SELECT row_json,detail_json FROM home_holding h JOIN home_release_scope r USING(scope_version) WHERE r.release_id=? AND h.position_key=? LIMIT 1').get(id,item.positionKey);
  const unknown:Amount={value:null,currency:'CNY',reasons:['closed-position-current-price-not-applicable'],coverage:{available:0,total:1},originals:{},fxSource:''};
  const holding:Holding=raw?JSON.parse(String(raw.row_json)):{id:item.id,name:item.name,code:item.code,exchange:item.exchange,market:item.market,accountId:item.accountId,currency:item.currency,quantity:'0',cost:null,price:null,holdingDays:null,marketValue:{...unknown,value:'0',reasons:[],coverage:{available:1,total:1}},unrealized:{...unknown,value:'0',reasons:[],coverage:{available:1,total:1}}};
  holding.marketValue=revalueAmount(holding.marketValue,'CNY',full.manifest.fx);holding.unrealized=revalueAmount(holding.unrealized,'CNY',full.manifest.fx);
  return {schema:FULL_SCHEMA,releaseId:id,target,items,holding:items.length===1?holding:null,description:items.length>1?'多个账户：请按下列账户范围查看对应成交与已确认回合。':raw?JSON.parse(String(raw.detail_json)).description:'该证券目前已无持仓；以下为本发布版本的历史成交。',rounds:full.modules.closeRounds.filter(r=>items.some(c=>c.accountId===r.accountId&&c.instrumentId===r.instrumentId)),trades:trades.slice(cursor,cursor+50),nextCursor:trades.length>cursor+50?cursor+50:null};
 }
 export(request:FullRequestV1,id:string){const full=this.resolve(id),selection=this.selection(full,request),rows=this.holdingRows(full,request).filter(h=>selection.items.some(c=>c.accountId===h.accountId&&c.code===h.code));const cell=(v:unknown)=>'"'+String(v??'未知').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const notes=rows.some(h=>h.valuationNotes?.length||h.marketValue.valuationNotes?.length||h.unrealized.valuationNotes?.length);return ['名称,代码,账户,数量,原币成本,原币价格,原币,市值,未实现盈亏,报告币种,release,asOf'+(notes?',估值依据':''),...rows.map(h=>[h.name,h.code,h.accountId,h.quantity,h.cost,h.price,h.currency,h.marketValue.value,h.unrealized.value,'CNY',id,full.manifest.asOf,...(notes?[[...new Set([...(h.valuationNotes??[]),...(h.marketValue.valuationNotes??[]),...(h.unrealized.valuationNotes??[])])].join('；')]:[])].map(cell).join(','))].join('\n');}
}
