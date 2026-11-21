import {valuationRawClose,valuationSession} from './valuation-quote';
import type {DatabaseSync} from 'node:sqlite';
import {SqliteStore} from '../storage/sqlite-store';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';
import {createProviderRouter} from '../market/providers/router';
import {parseDailyCandleRequest} from '../market/request-policy';
import {MarketDataProviderError} from '../market/providers/errors';
import {syncMarketData,retainCoveragePart,preserveCoverageOutsideGap} from '../market/sync-service';
import {confirmedPrelistingClose} from '../market/prelisting-close';
import {expectedTradingDates} from '../market/calendar';
import {requiredMarketDataRange} from '../market/sync-range';
import type {SupportedMarket} from '../market/contracts';
import {refreshFxSnapshot} from '../fx/service';
import {fetchLatestFxSnapshot} from '../fx/provider';
import {HomeSourceJobs,type SourceJob} from './source-jobs';
import {scopeId} from './contracts';
import {nextDay,validDay} from './period';
import {executionBusinessDay} from './finance';

/** Planning and acquisition are worker-only; no network work runs in application GETs. */
export function sourceCompletion(db:DatabaseSync,transport:typeof fetch=fetch){
 const store=new SqliteStore(db),jobs=new HomeSourceJobs(db);
 let planned='';
 // Explicit repair is bounded to one year of valuation days. It never launches the
 // autonomous historical backfill used by HOME_SOURCE_SYNC=1.
 const planCurrent=(now=new Date(),options:{dates?:string[];to?:string}={})=>{
  const today=new Date(now.getTime()+8*3600000).toISOString().slice(0,10),dates=[...new Set(options.dates??[])];
  const end=options.to??today;
  if(!validDay(end)||end>today||dates.some(day=>day>end))throw new Error('估值补齐结束日期无效');
  const start=dates.length?dates.reduce((a,b)=>a<b?a:b):end;
  const dailyStart=start<nextDay(end,-366)?nextDay(end,-366):start;
  if(dates.length>8||dates.some(date=>!validDay(date)||date>today))throw new Error('估值补齐日期无效或超出上限');
  if(!db.prepare('SELECT release_id FROM home_head WHERE singleton=1').get())return [];
  const current=new Set(db.prepare('SELECT h.instrument_id FROM home_head p JOIN home_release_scope s ON p.release_id=s.release_id JOIN home_holding h ON h.scope_version=s.scope_version WHERE s.scope_id=?').all(scopeId('all','all')).map(r=>String(r.instrument_id)));
  const instruments=new Map(store.getInstruments().map(i=>[i.id,i]));
  const requests:SourceJob[]=[{key:`fx:${Math.floor(now.getTime()/21600000)}`,kind:'fx',priority:0,payload:{}}];
  const inspected=new Set<string>(),obsolete=new Set<string>();
  const oldJobs=db.prepare("SELECT job_key,payload_json FROM home_source_job WHERE kind='quote' AND priority=1 AND state IN ('failed','pending') AND json_extract(payload_json,'$.supersededByRelease') IS NULL AND json_extract(payload_json,'$.from')=json_extract(payload_json,'$.to')").all().filter(row=>/^(valuation-v[23]:|quote:)/.test(String(row.job_key))).map(row=>({job_key:String(row.job_key),payload:JSON.parse(String(row.payload_json))}));
  const cutoffCache=new Map<string,string>();
  const cutoff=(market:string,at:Date)=>{
   const key=`${market}:${at.toISOString()}`;let value=cutoffCache.get(key);
   if(!value){value=valuationSession(market as SupportedMarket,at);cutoffCache.set(key,value);}
   return value;
  };
  const append=(ids:Set<string>,at:Date)=>{
   for(const id of ids){
    const i=instruments.get(id);if(!i||!['CN-SH','CN-SZ','HK','US'].includes(i.market))continue;
    const date=cutoff(i.market,at);
    const pair=`${id}:${date}`;if(inspected.has(pair))continue;inspected.add(pair);
    if(store.getDailyCandles(id,date,date).some(c=>valuationRawClose(c,id,i.currency,date)!==null)){obsolete.add(pair);continue;}
    if(confirmedPrelistingClose(id,date)){obsolete.add(pair);continue;}
    requests.push({key:`valuation-v2:${id}:${date}:${date}`,kind:'quote',priority:1,payload:{id,symbol:i.symbol,market:i.market,currency:i.currency,from:date,to:date}});
   }
  };
  append(current,now);
  // Read only the accepted all-account scope once. Account duplicates share
  // one instrument/date request, while each object's position remains separate.
  const rows=dates.length?db.prepare(`SELECT m.object_version, json_extract(m.position_key,'$[1]') instrument_id,b.business_date,b.native_json FROM home_head p JOIN home_release_scope s ON p.release_id=s.release_id JOIN home_metric_member m USING(scope_version) JOIN home_metric_boundary b ON b.object_version=m.object_version WHERE s.scope_id=? ORDER BY b.business_date`).all(scopeId('all','all')):[];
  const state=new Map<string,{id:string;held:boolean}>();let cursor=0;
  const objects=new Map<string,Set<string>>();
  for(const row of rows){const id=String(row.instrument_id),versions=objects.get(id)??new Set<string>();versions.add(String(row.object_version));objects.set(id,versions);}
  const idsAt=(day:string)=>{
   while(cursor<rows.length&&String(rows[cursor].business_date)<=day){
    const row=rows[cursor++],native=JSON.parse(String(row.native_json));
    state.set(String(row.object_version),{id:String(row.instrument_id),held:!Object.keys(native.buckets??{}).length||Object.values(native.buckets??{}).some(bucket=>!Number.isFinite((bucket as {count?:number}).count)||Number((bucket as {count?:number}).count)!==0)});
   }
   for(const {payload}of oldJobs){
    const id=String(payload.id),versions=objects.get(id);
    if(!versions||![...versions].every(version=>state.has(version)&&!state.get(version)!.held))continue;
    const instrument=instruments.get(id);if(!instrument||!['CN-SH','CN-SZ','HK','US'].includes(instrument.market))continue;
    const at=day===today?now:new Date(`${day}T15:59:59.999Z`);
    const session=cutoff(instrument.market,at);
    if(session===payload.from)obsolete.add(`${id}:${session}`);
   }
   return new Set([...state.values()].filter(value=>value.held).map(value=>value.id));
  };
  for(const day of [...new Set([...dates,...Array.from({length:Math.round((Date.parse(end)-Date.parse(dailyStart))/86400000)+1},(_,index)=>nextDay(dailyStart,index))])].sort()){
   append(rows.length?idsAt(day):current,day===today?now:new Date(`${day}T15:59:59.999Z`));
  }
  // A session can be needed by another checked valuation/account; needs win.
  for(const request of requests)if(request.kind==='quote')obsolete.delete(`${request.payload.id}:${request.payload.from}`);
  const unique:SourceJob[]=requests.filter(job=>job.kind==='fx');
  const quotes=[...new Map(requests.filter(job=>job.kind==='quote').map(job=>[job.key,job])).values()].sort((a,b)=>a.payload.id.localeCompare(b.payload.id)||a.payload.from.localeCompare(b.payload.from));
  for(const job of quotes){
   const previous=unique.at(-1);
   // Merge at most 31 calendar days, only when the intervening expected market
   // dates are also requested. Existing raw bars and position gaps split units.
   if(previous?.kind==='quote'&&previous.payload.id===job.payload.id&&Date.parse(job.payload.to)-Date.parse(previous.payload.from)<=30*86400000&&expectedTradingDates(job.payload.market as SupportedMarket,nextDay(previous.payload.to,1),job.payload.from).length===1){
    previous.payload.to=job.payload.to;previous.key=`valuation-v3:${job.payload.id}:${previous.payload.from}:${job.payload.to}`;
   }else unique.push({...job,payload:{...job.payload},key:`valuation-v3:${job.payload.id}:${job.payload.from}:${job.payload.to}`});
  }
  db.exec('BEGIN IMMEDIATE');
  try{
   const release=String(db.prepare('SELECT release_id FROM home_head WHERE singleton=1').get()!.release_id);
   for(const row of oldJobs){
    const payload=row.payload;
    if(!obsolete.has(`${payload.id}:${payload.from}`))continue;
    db.prepare("UPDATE home_source_job SET payload_json=json_set(payload_json,'$.supersededByRelease',?) WHERE job_key=? AND priority=1 AND state IN ('failed','pending')").run(release,String(row.job_key));
   }
   for(const job of unique){
   db.prepare("UPDATE home_source_job SET payload_json=json_remove(payload_json,'$.supersededByRelease'),state='pending',attempts=0,retry_after=0 WHERE job_key=? AND state<>'running' AND json_extract(payload_json,'$.supersededByRelease') IS NOT NULL").run(job.key);
   // A previous successful acquisition can subsequently lose its raw entity.
   // Reopen only done jobs; terminal no-data failures keep their retry budget.
   db.prepare("UPDATE home_source_job SET state='pending',attempts=0,retry_after=0,error=NULL WHERE job_key=? AND kind='quote' AND state='done'").run(job.key);
   jobs.enqueue(job,now.getTime());
  }db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  return unique.map(job=>job.key);
 };
 const plan=(now=new Date())=>{
  const head=db.prepare('SELECT release_id FROM home_head WHERE singleton=1').get();
  if(!head)return;
  const slot=String(Math.floor(now.getTime()/21600000)),signature=`${head.release_id}/${slot}`;
  if(signature===planned)return;
  jobs.enqueue({key:`fx:${slot}`,kind:'fx',priority:0,payload:{}},now.getTime());
  const current=new Set(db.prepare('SELECT h.instrument_id FROM home_head p JOIN home_release_scope s ON p.release_id=s.release_id JOIN home_holding h ON h.scope_version=s.scope_version WHERE s.scope_id=?').all(scopeId('all','all')).map(r=>String(r.instrument_id)));
  const ranges=new Map<string,{symbol:string;market:string;currency:string;from:string;to:string}>();
  for(const e of store.getExecutions()){
   if(resolvedTradeNatureOf(e)!=='live')continue;
   const date=executionBusinessDay(e);if(!validDay(date)||Date.parse(e.executedAt)>now.getTime())continue;
   const old=ranges.get(e.instrument.id);
   ranges.set(e.instrument.id,{symbol:e.instrument.symbol,market:e.instrument.market,currency:e.instrument.currency,from:old&&old.from<date?old.from:date,to:old&&old.to>date?old.to:date});
  }
  for(const i of store.getInstruments())if(current.has(i.id)&&!ranges.has(i.id))ranges.set(i.id,{symbol:i.symbol,market:i.market,currency:i.currency,from:nextDay(now.toISOString().slice(0,10),-31),to:now.toISOString().slice(0,10)});
  for(const [id,range]of ranges){
   if(!['CN-SH','CN-SZ','HK','US'].includes(range.market))continue;
   const cutoff=requiredMarketDataRange(now.toISOString(),now.toISOString(),{open:true,market:range.market as SupportedMarket,now}).endDate;
   const end=current.has(id)?cutoff:range.to<cutoff?range.to:cutoff;
   const enqueue=(from:string,to:string,priority:number)=>{
    const sessions=expectedTradingDates(range.market as SupportedMarket,from,to);
    if(sessions.length&&sessions.every(day=>confirmedPrelistingClose(id,day)))return;
    jobs.enqueue({key:`quote:${id}:${from}:${to}`,kind:'quote',priority,payload:{id,...range,from,to}},now.getTime());
   };
   if(current.has(id))enqueue(nextDay(cutoff,-31),cutoff,1);
   // Each persistent unit is at most one year, so cancellation/restart never
   // loses a large in-memory batch. Existing raw coverage avoids network calls.
   for(let from=range.from;from<=end;from=nextDay(from,365))enqueue(from,nextDay(from,364)<end?nextDay(from,364):end,10);
  }
  planned=signature;
 };
 const execute=async(job:SourceJob,signal:AbortSignal)=>{
  const fetcher:typeof fetch=(input,init)=>transport(input,{...init,signal:AbortSignal.any([signal,...(init?.signal?[init.signal]:[])])});
  if(job.kind==='fx'){
   const result=await refreshFxSnapshot(db,{fetchLatest:()=>fetchLatestFxSnapshot({fetcher})});
   if(result.error)throw new Error(`汇率更新失败：${result.error.message}`);
   return;
  }
  const p=job.payload;
  const sessions=expectedTradingDates(p.market as SupportedMarket,p.from,p.to);
  // Old persistent tasks can predate the documented source exclusions.
  if(sessions.length&&sessions.every(day=>confirmedPrelistingClose(p.id,day)))return;
  const routed:typeof fetch=async(input,init)=>{
   const request=parseDailyCandleRequest(new URL(String(input),'http://worker.local'));
   try{
    const result=await createProviderRouter((url,options)=>fetcher(url,{...options,signal:AbortSignal.any([signal,...(init?.signal?[init.signal]:[]),...(options?.signal?[options.signal]:[])])})).fetchDaily(request);
    return Response.json({...result,request,adjustmentMode:'raw'});
   }catch(error){
    signal.throwIfAborted();
    return Response.json({error:{code:error instanceof MarketDataProviderError?error.code:'source-unavailable',message:error instanceof Error?error.message:'行情源不可用'}},{status:502});
   }
  };
  const result=await syncMarketData({instrumentId:p.id,symbol:p.symbol,market:p.market as SupportedMarket,currency:p.currency,required:{startDate:p.from,endDate:p.to},signal,retryUnavailable:true,fetcher:routed,repository:{
   getDailyCandles:async(id,from,to)=>store.getDailyCandles(id,from,to).filter(c=>valuationRawClose(c,id,p.currency,c.tradingDate)!==null),
   getCoverage:async id=>store.getCoverageSegments(id),getProviderSymbol:async(id,provider)=>store.getProviderSymbol(id,provider),
   commitSyncResult:async result=>{
    signal.throwIfAborted();
    // The HTTP repository omits undefined optional fields on the wire. Preserve
    // that contract when calling the strict SQLite adapter directly.
    const outside=preserveCoverageOutsideGap(store.getCoverageSegments(result.instrumentId),{startDate:p.from,endDate:p.to});
    const inside=result.coverage.filter(segment=>segment.endDate>=p.from&&segment.startDate<=p.to).map(segment=>retainCoveragePart(segment,segment.startDate<p.from?p.from:segment.startDate,segment.endDate>p.to?p.to:segment.endDate));
    const merged=[...outside,...inside];
    const coverage=merged.map(segment=>Object.fromEntries(Object.entries(segment).filter(([,value])=>value!==undefined)) as typeof segment);
    store.commitMarketData({...result,coverage});
   },
  }});
  signal.throwIfAborted();
  if(result.status!=='complete')throw new Error(`行情 ${p.symbol}（${p.from} 至 ${p.to}）未齐：${'error' in result?result.error?.message??result.status:result.status}`);
 };
 return {jobs,plan,planCurrent,runOne:(signal:AbortSignal,options:{keys?:string[]}={})=>jobs.runOne(execute,signal,options)};
}
