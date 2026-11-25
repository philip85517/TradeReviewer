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
const FULL_QUERY_COMPUTATION='window-prefix-v18-canonical-fifo-category-cents';
const FINANCIAL_ALGORITHM=FULL_QUERY_COMPUTATION+':'+HOME_FINANCIAL_PARTITION_VERSION;
const jsonHash=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const money=(value:string|null,reasons:string[]=[],valuationNotes:string[]=[]):FullMoney=>({value:value===null?null:decimal(value).toFixed(2),currency:'CNY',reasons,...(valuationNotes.length?{valuationNotes:[...new Set(valuationNotes)]}:{})});
const sum=(items:FullMoney[],extra:string[]=[]):FullMoney=>money(items.some(i=>i.value===null)||extra.length?null:items.reduce((v,i)=>v.plus(i.value!),decimal('0')).toFixed(2),[...new Set([...extra,...items.flatMap(i=>i.reasons)])],items.flatMap(i=>i.valuationNotes??[]));
const sumKnown=(items:FullMoney[],extra:string[]=[]):FullMoney=>{const known=items.filter(i=>i.value!==null),reasons=[...new Set([...extra,...items.flatMap(i=>i.reasons)])];return money(known.length?known.reduce((v,i)=>v.plus(i.value!),decimal('0')).toFixed(2):null,reasons,items.flatMap(i=>i.valuationNotes??[]));};
function page<T>(rows:T[],requested:number){const pages=Math.max(1,Math.ceil(rows.length/8)),p=Math.min(requested,pages);return {rows:rows.slice((p-1)*8,p*8),total:rows.length,page:p,pages};}
export class FullHomeStore{
 private readonly accountDirectoryMemo=new WeakMap<FullBuild,FullResultV1['accountIdsByMarket']>();
 private readonly coverageRecipes=new WeakMap<ExecutionContentRef[],number[]>();
 private readonly evidenceMemo=new WeakMap<FullBuild,Map<string,{text:string;hash:string;refs:ExecutionContentRef[]}>>();
 private readonly coverageSources=new WeakMap<FullBuild,WeakMap<Set<string>,{scopes:FullSourceCoverage[];refs:ExecutionContentRef[]}>>();
 constructor(private readonly db:DatabaseSync){}
 private resolveRequest(full:FullBuild,input:FullRequestV1):FullRequestV1{
  const request=structuredClone(input);
  if(request.historyRange.scope!=='all'){
   delete request.historyRange.scope;
   return request;
  }
  request.historyRange={...this.historyBounds(full),scope:'all'};
  return request;
 }
 private historyBounds(full:FullBuild):FullResultV1['historyBounds']{
  const row=this.db.prepare('SELECT first_business_date FROM home_release_scope r JOIN home_scope_result s USING(scope_version) WHERE r.release_id=? AND r.scope_id=?').get(full.manifest.releaseId,JSON.stringify(['all','all'])) as {first_business_date?:unknown}|undefined;
  // Published first_business_date includes the opening baseline, one day
  // before the first activity. An empty release has no earlier activity.
  const first=row?.first_business_date?nextDay(String(row.first_business_date)):full.manifest.businessDate;
  return {fromYear:Number(first.slice(0,4)),toYear:Number(full.manifest.businessDate.slice(0,4))};
 }
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
  const known=rounds.filter(r=>r.net.value!==null).length;
  const knownWins=rounds.filter(r=>r.net.value!==null&&decimal(r.net.value).gt(0)).length;
  return {universeComplete:complete,confirmedClosedCount:rounds.length,closedCount:complete?rounds.length:null,knownNetCount:known,unknownNetCount:rounds.length-known,knownWins,knownCount:known,reasons,sourceRefsKey:'',affectedSourceRefs:source.refs};
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
  // Win/loss is a native-sign fact; an unavailable FX quote makes the CNY
  // subtotal unknown but must not erase a known native positive/negative.
  const wins=(rows:FullRound[])=>rows.filter(v=>v.net.value!==null&&decimal(v.net.value).gt(0)).length;
  const rate=(rows:FullRound[],c:FullCoverage)=>!c.universeComplete||rows.some(v=>v.net.value===null)||!rows.length?null:decimal(String(wins(rows))).div(rows.length).mul(100).toFixed(2);
  const years=Array.from({length:r.historyRange.toYear-r.historyRange.fromYear+1},(_,i)=>{const year=r.historyRange.fromYear+i,rows=rounds.filter(v=>v.closeBusinessDay?.startsWith(String(year)));const c=this.coverage(full,ids,rows);if(!coverage.universeComplete){c.universeComplete=false;c.closedCount=null;c.reasons=coverage.reasons;}return {year,...financial(`${year}-01-01`,`${year}-12-31`),count:rows.length,coverage:c};});
  const monthly=r.historyRange.fromYear===r.historyRange.toYear;
  const bucketKeys=monthly?Array.from({length:12},(_,i)=>`${r.historyRange.fromYear}-${String(i+1).padStart(2,'0')}`):years.map(y=>String(y.year));
  let cumulative=money('0');const buckets=bucketKeys.map(key=>{const rows=rounds.filter(v=>v.closeBusinessDay?.startsWith(key)),c=this.coverage(full,ids,rows);if(!coverage.universeComplete){c.universeComplete=false;c.closedCount=null;c.reasons=coverage.reasons;}const t=financial(`${key}${monthly?'-01':'-01-01'}`,monthly?nextDay(`${Number(key.slice(5))===12?Number(key.slice(0,4))+1:Number(key.slice(0,4))}-${String(Number(key.slice(5))===12?1:Number(key.slice(5))+1).padStart(2,'0')}-01`,-1):`${key}-12-31`);if(!t.net.reasons.includes('no-closed-transactions'))cumulative=financial(`${r.historyRange.fromYear}-01-01`,monthly?nextDay(`${Number(key.slice(5))===12?Number(key.slice(0,4))+1:Number(key.slice(0,4))}-${String(Number(key.slice(5))===12?1:Number(key.slice(5))+1).padStart(2,'0')}-01`,-1):`${key}-12-31`).net;return {key,granularity:monthly?'month' as const:'year' as const,...t,count:rows.length,knownWins:wins(rows),winRate:rate(rows,c),cumulativeNet:cumulative,coverage:c};});
  const knownRate=coverage.knownCount?decimal(String(coverage.knownWins??0)).div(coverage.knownCount).mul(100).toFixed(2):null;
  return {coverage,...complete(rounds,coverage),confirmedNet:totals(rounds).net,confirmedFees:totals(rounds).fees,winRate:rate(rounds,coverage),confirmedWinRate:knownRate,years,buckets};
 }
 private historyEndpoints(r:FullRequestV1,full:FullBuild):string[]{
  const dates=new Set<string>([`${r.historyRange.fromYear-1}-12-31`,full.manifest.businessDate]);
  for(let year=r.historyRange.fromYear;year<=r.historyRange.toYear;year++){
   dates.add(`${year}-12-31`);
   if(r.historyRange.fromYear===r.historyRange.toYear)for(let month=1;month<=12;month++)dates.add(nextDay(`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`,-1));
  }
  return [...dates].filter(d=>d<=full.manifest.businessDate).sort();
 }
 private historicalFinancial(full:FullBuild,objects:MetricObject[],from:string,to:string,unknown:boolean,allowKnownSubtotal=false){
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
   return {net:money(net.value,net.reasons,net.valuationNotes),fees:published?money(fees.value,fees.reasons,fees.valuationNotes):money(null,['closed-fees-not-published'])};
  });
  const active=values.filter(v=>!v.net.reasons.includes('no-closed-transactions'));
  return active.length?{net:(allowKnownSubtotal?sumKnown:sum)(active.map(v=>v.net)),fees:(allowKnownSubtotal?sumKnown:sum)(active.map(v=>v.fees))}:{net:money(null,['no-closed-transactions']),fees:money(null,['no-closed-transactions'])};
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
  const rows:Record<'all'|'long'|'short'|'ipo',FullContributionRow[]>={all:[],long:[],short:[],ipo:[]};
  const currentNative=new Map<string,Record<'net'|'realized'|'unrealizedChange'|'fees',FullMoney>>();
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
    const allAmounts=values;
    currentNative.set(item.id,Object.fromEntries((['net','realized','unrealizedChange','fees'] as const).map(field=>[field,{value:allAmounts[field].value,currency:'CNY',reasons:allAmounts[field].reasons,valuationNotes:allAmounts[field].valuationNotes}])) as Record<'net'|'realized'|'unrealizedChange'|'fees',FullMoney>);
    if(entries.length||allAmounts.net.value!==null||allAmounts.net.reasons.length)rows.all.push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net:money(allAmounts.net.value,allAmounts.net.reasons,allAmounts.net.valuationNotes),realized:money(allAmounts.realized.value,allAmounts.realized.reasons,allAmounts.realized.valuationNotes),unrealizedChange:money(allAmounts.unrealizedChange.value,allAmounts.unrealizedChange.reasons,allAmounts.unrealizedChange.valuationNotes),fees:money(allAmounts.fees.value,allAmounts.fees.reasons,allAmounts.fees.valuationNotes),roundCount:null});
    for(const entry of entries){
     if(allocation?.categoryMetrics&&entry.realized.value!==null&&entry.unrealizedChange.value!==null)entry.net.value=decimal(entry.realized.value).plus(entry.unrealizedChange.value).toFixed(2);
     rows[entry.category].push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net:entry.net,realized:entry.realized,unrealizedChange:entry.unrealizedChange,fees:entry.fees,roundCount:null});
    }
   }else{
    const object=historyObjects.get(item.positionKey);
    if(!object)continue;
    const parts=allocation?.categoryMetrics?.map(m=>({category:m.category,object:m.metric}))??(allocation?.category?[{category:allocation.category,object}]:[]);
    const entries=parts.flatMap(({category,object:part})=>{
     // Historical monetary attribution is source/ledger based. Manual round
     // confirmation remains a separate history diagnostic and must not null a
     // financially knowable contribution row.
     const {net,fees}=this.historicalFinancial(full,[part],`${r.historyRange.fromYear}-01-01`,`${r.historyRange.toYear}-12-31`,false);
     if(net.reasons.includes('no-closed-transactions'))return [];
     const rounds=full.modules.closeRounds.filter(v=>v.accountId===item.accountId&&v.instrumentId===item.instrumentId&&v.closeBusinessDay&&Number(v.closeBusinessDay.slice(0,4))>=r.historyRange.fromYear&&Number(v.closeBusinessDay.slice(0,4))<=r.historyRange.toYear);
     return [{category,net,realized:net,unrealizedChange:money('0'),fees,roundCount:allocation?.categoryMetrics?null:rounds.length}];
    });
    const allValue=this.historicalFinancial(full,[object],`${r.historyRange.fromYear}-01-01`,`${r.historyRange.toYear}-12-31`,false);
    // Each category metric is independently converted and rounded to CNY cents.
    // When the persisted source partition is complete and every amount is known,
    // publish the bounded rounding residual on the deterministically last part;
    // never use this to manufacture a value for a missing/unknown part.
    if(allocation?.categoryMetrics&&entries.length===parts.length&&entries.length>0&&
       allValue.net.value!==null&&allValue.fees.value!==null&&
       entries.every(entry=>entry.net.value!==null&&entry.fees.value!==null)){
     const ordered=[...entries].sort((a,b)=>a.category.localeCompare(b.category));
     const assign=(field:'net'|'fees',target:string)=>{
      const residual=decimal(target).minus(ordered.reduce((total,entry)=>total.plus(entry[field].value!),decimal('0')));
      const boundary=decimal('0.01').times(ordered.length);
      if(residual.abs().lte(boundary)){
       const last=ordered.at(-1)!;last[field].value=decimal(last[field].value!).plus(residual).toFixed(2);
       if(field==='net')last.realized.value=last[field].value;
      }
     };
     assign('net',allValue.net.value);assign('fees',allValue.fees.value);
    }
    if(entries.length||!allValue.net.reasons.includes('no-closed-transactions'))rows.all.push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net:allValue.net,realized:allValue.net,unrealizedChange:money('0'),fees:allValue.fees,roundCount:null});
    for(const part of entries)rows[part.category].push({id:item.id,name:item.name,code:item.code,accountId:item.accountId,instrumentId:item.instrumentId,market:item.market,open:item.open,net:part.net,realized:part.realized,unrealizedChange:part.unrealizedChange,fees:part.fees,roundCount:part.roundCount});
   }
  }
  const current=r.contribution.mode==='current',coverageIds=current?activeIds:ids;
  // Unknown-nature executions may have no catalog/metric object at all. Their
  // absence from the known projection does not prove an empty current scope.
  if(current)for(const scope of full.modules.coverage)if(ids.has(JSON.stringify([scope.accountId,scope.instrumentId]))&&scope.reasons.includes('unknown-trading-nature'))coverageIds.add(JSON.stringify([scope.accountId,scope.instrumentId]));
  const coverageByKey=new Map(full.modules.coverage.map(scope=>[JSON.stringify([scope.accountId,scope.instrumentId]),scope]));
  const catalogByKey=new Map(full.modules.catalog.map(item=>[JSON.stringify([item.accountId,item.instrumentId]),item]));
  const financialCoverage=(scopeIds:Set<string>,category:FullRequestV1['contribution']['category']=r.contribution.category)=>{
   const result=this.coverage(full,scopeIds,full.modules.closeRounds.filter(v=>scopeIds.has(JSON.stringify([v.accountId,v.instrumentId]))));
   const unresolved=new Set<string>(),reasons=new Set<string>();
   for(const key of scopeIds){
    const item=catalogByKey.get(key),source=coverageByKey.get(key),allocation=item&&allocations.get(item.positionKey);
    if(source?.reasons.includes('unknown-trading-nature')){unresolved.add(key);reasons.add('unknown-trading-nature');}
    if(!item||!(current?objectsByPosition:historyObjects).has(item.positionKey)){
     unresolved.add(key);for(const reason of source?.reasons.length?source.reasons:['metric-object-unavailable'])reasons.add(reason);
    }
    // All is a financial view. Direction/IPO attribution only gates the
    // individual classified views, never an otherwise knowable ledger amount.
    if(category!=='all'&&!(allocation?.category||allocation?.categoryMetrics?.length)){
     unresolved.add(key);for(const reason of allocation?.reasons??['source-scope-not-inspected'])reasons.add(reason);
    }
   }
   for(const row of rows[category]){
    const key=JSON.stringify([row.accountId,row.instrumentId]);
    if((!current||category==='all')&&scopeIds.has(key)&&(row.net.value===null||row.fees.value===null)){
     unresolved.add(key);reasons.add('financial-amount-unknown');
     for(const reason of [...row.net.reasons,...row.fees.reasons])reasons.add(reason);
    }
   }
   result.classifiedCount=scopeIds.size-unresolved.size;result.eligibleCount=scopeIds.size;
   result.universeComplete=unresolved.size===0&&!reviewUnknown;
   result.closedCount=result.universeComplete?result.confirmedClosedCount:null;
   if(reviewUnknown)reasons.add('selection-membership-unknown');
   result.reasons=[...reasons];
   return result;
  };
  const coverage=financialCoverage(coverageIds);
  const subtotal=(values:FullMoney[],reasons:string[])=>{
   const known=values.filter(value=>value.value!==null);
   const allReasons=[...new Set([...reasons,...values.flatMap(value=>value.reasons)])];
   return money(known.length?known.reduce((total,value)=>total.plus(value.value!),decimal('0')).toFixed(2):values.length||allReasons.length?null:'0.00',allReasons,values.flatMap(value=>value.valuationNotes??[]));
  };
  const totals=(values:FullContributionRow[],scopeCoverage=coverage)=>{
   if(current){const missing=!values.length&&!scopeCoverage.universeComplete?scopeCoverage.reasons:[];return {net:sum(values.map(v=>v.net),missing),realized:sum(values.map(v=>v.realized),missing),unrealizedChange:sum(values.map(v=>v.unrealizedChange),missing),fees:sum(values.map(v=>v.fees),missing),count:values.length,coverage:scopeCoverage};}
   const financialUnknown=values.some(value=>value.net.value===null||value.realized.value===null||value.fees.value===null);
   const effectiveCoverage=financialUnknown?{...scopeCoverage,universeComplete:false,closedCount:null,reasons:[...new Set([...scopeCoverage.reasons,'financial-amount-unknown'])]}:scopeCoverage;
   const reasons=effectiveCoverage.universeComplete?[]:effectiveCoverage.reasons;
   return {net:subtotal(values.map(v=>v.net),reasons),realized:subtotal(values.map(v=>v.realized),reasons),unrealizedChange:subtotal(values.map(v=>v.unrealizedChange),reasons),fees:subtotal(values.map(v=>v.fees),reasons),count:values.length,coverage:effectiveCoverage};
  };
  if(r.contribution.localOpenOnly)for(const category of ['all','long','short','ipo'] as const)rows[category]=rows[category].filter(v=>v.open);
  const categories=(['all','long','short','ipo'] as const).map(category=>({category,...totals(rows[category],financialCoverage(coverageIds,category))}));
  const rawHistorical=(scopeIds:Set<string>,scopeCoverage:FullCoverage)=>{
   if(current)return null;
   const selectedObjects=[...historyObjects.values()].filter(object=>{const item=full.modules.catalog.find(v=>v.positionKey===object.positionKey);return item&&scopeIds.has(JSON.stringify([item.accountId,item.instrumentId]));});
   const value=this.historicalFinancial(full,selectedObjects,`${r.historyRange.fromYear}-01-01`,`${r.historyRange.toYear}-12-31`,false,true);
   const amount=(v:FullMoney)=>v.reasons.includes('no-closed-transactions')
    ?money(scopeCoverage.universeComplete?'0':null,scopeCoverage.reasons)
    :money(v.value,[...new Set([...v.reasons,...scopeCoverage.reasons])],v.valuationNotes);
   return {net:amount(value.net),realized:amount(value.net),unrealizedChange:money('0'),fees:amount(value.fees)};
  };
  const rawCurrent=(values:FullContributionRow[],scopeCoverage:FullCoverage)=>{
   if(!current)return null;
   const amounts=values.map(row=>currentNative.get(row.id)!);
   return Object.fromEntries((['net','realized','unrealizedChange','fees'] as const).map(field=>[field,sum(amounts.map(value=>value[field]),!values.length&&!scopeCoverage.universeComplete?scopeCoverage.reasons:[])])) as Record<'net'|'realized'|'unrealizedChange'|'fees',FullMoney>;
  };
  const allRaw=current?rawCurrent(rows.all,categories[0].coverage):rawHistorical(coverageIds,categories[0].coverage);
  if(allRaw)Object.assign(categories[0],allRaw);
  const selected=rows[r.contribution.category];
  const marketScopeIds=(market:'CN'|'HK'|'US')=>new Set([...coverageIds].filter(key=>{
   const scope=coverageByKey.get(key);
   const sourceMarket=scope?.market??'',instrument=JSON.parse(key)[1] as string;
   return sourceMarket===market||(market==='CN'&&sourceMarket.startsWith('CN'))||(market==='US'&&sourceMarket.startsWith('US'))||(market==='HK'&&sourceMarket.startsWith('HK'))||instrument.startsWith(`${market}:`)||(market==='CN'&&instrument.startsWith('CN-'));
  }));
  const markets=(['all','CN','HK','US'] as const).map(market=>{
   const values=selected.filter(v=>market==='all'||v.market===market);
   const scopeIds=market==='all'?coverageIds:marketScopeIds(market);
   const scoped=market==='all'?coverage:financialCoverage(scopeIds);
   const raw=r.contribution.category==='all'?(market==='all'?allRaw:current?rawCurrent(values,scoped):rawHistorical(scopeIds,scoped)):null;
   const summary=totals(values,scoped);
   return {market,...summary,...(raw??{})};
  });
  const filtered=selected.filter(v=>r.contribution.drillMarket==='all'||v.market===r.contribution.drillMarket);
  filtered.sort((a,b)=>{const av=a.net.value,bv=b.net.value;return (r.contribution.sort==='name'?a.name.localeCompare(b.name,'zh-CN'):av===null||bv===null?av===bv?0:av===null?1:-1:decimal(av).comparedTo(bv))*(r.contribution.direction==='asc'?1:-1)||a.id.localeCompare(b.id);});
  const drillIds=r.contribution.drillMarket==='all'?coverageIds:marketScopeIds(r.contribution.drillMarket);
  const drillCoverage=r.contribution.drillMarket==='all'?coverage:financialCoverage(drillIds);
  const drillSummary=totals(filtered,drillCoverage);
  const drillRaw=r.contribution.category==='all'?(r.contribution.drillMarket==='all'?allRaw:current?rawCurrent(filtered,drillCoverage):rawHistorical(drillIds,drillCoverage)):null;
  return {mode:r.contribution.mode,category:r.contribution.category,...page(filtered,r.contribution.page),...drillSummary,...(drillRaw??{}),categories,markets};
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
   for(const rawRequest of requests??defaults()){
    const request=this.resolveRequest(full,rawRequest);
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
 read(rawRequest:FullRequestV1,id?:string):FullResultV1{
  const full=this.resolve(id),releaseId=full.manifest.releaseId;
  const request=this.resolveRequest(full,rawRequest);
  const artifactKey=fullHash([FULL_SCHEMA,'release-key-v2-hash1',FULL_QUERY_COMPUTATION,request,full.manifest.fxVersion]);
  const cached=this.db.prepare('SELECT artifact_id,payload_json FROM home_full_query WHERE release_id=? AND query_key=?').get(releaseId,artifactKey);
  if(cached){const text=String(cached.payload_json);if(jsonHash(text)!==String(cached.artifact_id))throw new Error('invalid full query payload hash');const result=JSON.parse(text) as FullResultV1;if(result.releaseId!==releaseId||result.evidenceTransport!=='release-key-v2'||fullHash(result.request)!==fullHash(request))throw new Error('invalid full query identity');if(evidenceKeys(result).every(key=>this.readEvidence(full,key,false)!==null))return {...result,accountIdsByMarket:this.accountIdsByMarket(full),historyBounds:this.historyBounds(full)};}
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
  const result:FullResultV1={schema:FULL_SCHEMA,evidenceTransport:'release-key-v2',releaseId,manifest:full.manifest,request,selectionKey,queryArtifactId,core,accountIdsByMarket:this.accountIdsByMarket(full),historyBounds:this.historyBounds(full),history,contribution,capabilities:{globalOpenOnly:true,review:true,assetTypes:true,reasons:[...(selected.assetUnknown?['asset-type-membership-unknown']:[]),...(selected.reviewUnknown?['selection-membership-unknown']:[])]},catalogCount:full.modules.catalog.length};
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
