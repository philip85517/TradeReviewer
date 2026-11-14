import type {DatabaseSync} from 'node:sqlite';
import {SqliteStore} from '../storage/sqlite-store';
import {resolvedTradeNatureOf} from '../trades/nature-resolution';
import {createProviderRouter} from '../market/providers/router';
import {parseDailyCandleRequest} from '../market/request-policy';
import {MarketDataProviderError} from '../market/providers/errors';
import {syncMarketData} from '../market/sync-service';
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
   const enqueue=(from:string,to:string,priority:number)=>jobs.enqueue({key:`quote:${id}:${from}:${to}`,kind:'quote',priority,payload:{id,...range,from,to}},now.getTime());
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
   getDailyCandles:async(id,from,to)=>store.getDailyCandles(id,from,to).filter(c=>c.adjustmentMode==='raw'),
   getCoverage:async id=>store.getCoverageSegments(id),getProviderSymbol:async(id,provider)=>store.getProviderSymbol(id,provider),
   commitSyncResult:async result=>{
    signal.throwIfAborted();
    // The HTTP repository omits undefined optional fields on the wire. Preserve
    // that contract when calling the strict SQLite adapter directly.
    const coverage=result.coverage.map(segment=>Object.fromEntries(Object.entries(segment).filter(([,value])=>value!==undefined)) as typeof segment);
    store.commitMarketData({...result,coverage});
   },
  }});
  signal.throwIfAborted();
  if(result.status!=='complete')throw new Error(`行情 ${p.symbol}（${p.from} 至 ${p.to}）未齐：${'error' in result?result.error?.message??result.status:result.status}`);
 };
 return {jobs,plan,runOne:(signal:AbortSignal)=>jobs.runOne(execute,signal)};
}
