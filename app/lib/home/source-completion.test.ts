import {DatabaseSync} from 'node:sqlite';
import {expect,it,vi} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {SqliteStore} from '../storage/sqlite-store';
import {sourceCompletion} from './source-completion';
import {HomeStore} from './store';
import {release} from './test-fixtures';

it('retries an interrupted planning pass in the same clock slot',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const store=new HomeStore(db);store.stage(release('head',0));store.publish('head',null);
  const completion=sourceCompletion(db),enqueue=vi.spyOn(completion.jobs,'enqueue');enqueue.mockImplementationOnce(()=>{throw new Error('database is locked');});
  expect(()=>completion.plan(new Date('2026-01-05T10:00:00Z'))).toThrow('database is locked');
  completion.plan(new Date('2026-01-05T10:00:01Z'));
  expect(completion.jobs.summary().total).toBe(1);
 }finally{db.close();}
});

it('persists a routed provider quote and coverage through the real SQLite adapter',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:600036','600036','Stock','CN-SH','CNY')");
  const transport=vi.fn<typeof fetch>(async()=>Response.json({code:0,data:{sh600036:{day:[['2026-01-05','10','11','12','9','100']]}}}));
  const storage=new SqliteStore(db);
  storage.commitMarketData({instrumentId:'CN-SH:600036',candles:[{instrumentId:'CN-SH:600036',tradingDate:'2026-01-05',open:'10',high:'12',low:'9',close:'11',volume:'100',adjustmentMode:'raw',provider:'tencent',providerSymbol:'sh600036',currency:'USD',fetchedAt:'2026-01-05T10:00:00Z'}],coverage:[]});
  const unrelated={startDate:'2025-01-02',endDate:'2025-01-02',status:'complete' as const,missingTradingDates:[]};
  storage.commitMarketData({instrumentId:'CN-SH:600036',candles:[],coverage:[unrelated,{startDate:'2026-01-01',endDate:'2026-12-31',status:'complete',missingTradingDates:[]}]});
  const completion=sourceCompletion(db,transport);
  completion.jobs.enqueue({key:'test-quote',kind:'quote',priority:0,payload:{id:'CN-SH:600036',symbol:'600036',market:'CN-SH',currency:'CNY',from:'2026-01-05',to:'2026-01-05'}});
  await completion.runOne(new AbortController().signal);
  expect(completion.jobs.summary()).toMatchObject({done:1,failed:0,pending:0});
  const store=new SqliteStore(db);
  expect(store.getDailyCandles('CN-SH:600036')).toMatchObject([{tradingDate:'2026-01-05',close:'11',currency:'CNY',adjustmentMode:'raw'}]);
  expect(store.getCoverageSegments('CN-SH:600036')).toEqual(expect.arrayContaining([unrelated,expect.objectContaining({startDate:'2026-01-01',endDate:'2026-01-04',status:'complete'}),expect.objectContaining({startDate:'2026-01-06',endDate:'2026-12-31',status:'complete'}),expect.objectContaining({startDate:'2026-01-05',endDate:'2026-01-05',status:'complete',missingTradingDates:[]})]));
  expect(await sourceCompletion(db,transport).runOne(new AbortController().signal)).toBe(false);
  completion.jobs.enqueue({key:'valid-raw-recheck',kind:'quote',priority:0,payload:{id:'CN-SH:600036',symbol:'600036',market:'CN-SH',currency:'CNY',from:'2026-01-05',to:'2026-01-05'}});
  await completion.runOne(new AbortController().signal);
  expect(transport).toHaveBeenCalledTimes(1);
 }finally{db.close();}
});

it('plans only explicit current and historical valuation boundaries without scanning execution history',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:600036','600036','Stock','CN-SH','CNY')");
  const input=release('head',0);
  for(const scope of input.scopes)scope.holdings=scope.holdings.map(h=>({...h,instrumentId:'CN-SH:600036',row:{...h.row,exchange:'CN-SH',code:'600036'}}));
  const store=new HomeStore(db);store.stage(input);store.publish('head',null);
  const completion=sourceCompletion(db);
  const now=new Date('2026-01-05T10:00:00Z');
  const keys=completion.planCurrent(now,{dates:['2025-12-31']});
  expect(keys).toHaveLength(2);
  const rows=db.prepare("SELECT kind,payload_json FROM home_source_job ORDER BY priority,job_key").all();
  expect(rows.filter(r=>r.kind==='quote').map(r=>JSON.parse(String(r.payload_json)))).toEqual(expect.arrayContaining([
   expect.objectContaining({id:'CN-SH:600036',from:'2025-12-31',to:'2026-01-05'}),
  ]));
  completion.planCurrent(now,{dates:['2025-12-31']});expect(completion.jobs.summary().total).toBe(2);
  expect(()=>completion.planCurrent(now,{dates:['2026-01-06']})).toThrow();
  expect(completion.jobs.summary().total).toBe(2);
 }finally{db.close();}
});

it('plans historical holdings at the boundary even when they are no longer held now',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:600036','600036','Current','CN-SH','CNY'),('CN-SH:600000','600000','Historical','CN-SH','CNY'),('CN-SH:600001','600001','Closed','CN-SH','CNY')");
  const input=release('head',0);
  for(const scope of input.scopes)scope.holdings=scope.holdings.map(h=>({...h,instrumentId:'CN-SH:600036'}));
  const store=new HomeStore(db);store.stage(input);store.publish('head',null);
  for(const [id,count]of [['CN-SH:600000',1],['CN-SH:600001',0]] as const){
   const key=JSON.stringify(['a',id,'live']);
   db.prepare('INSERT INTO home_metric_object VALUES(?,?,?,?,?,?,?,?)').run(id,key,'2025-01-01','2026-01-05','{}','{}',1,1);
   db.prepare('INSERT INTO home_metric_member VALUES(?,?,?)').run('head/all/all',key,id);
   db.prepare('INSERT INTO home_metric_boundary VALUES(?,?,?)').run(id,'2025-12-30',JSON.stringify({buckets:{CNY:{count}}}));
  }
  const obsoleteJobs=sourceCompletion(db).jobs;
  obsoleteJobs.enqueue({key:'valuation-v2:closed',kind:'quote',priority:1,payload:{id:'CN-SH:600001',market:'CN-SH',symbol:'600001',currency:'CNY',from:'2025-12-31',to:'2025-12-31'}});
  db.prepare("UPDATE home_source_job SET state='failed',attempts=3,error='original provider failure'").run();
  for(const [key,priority,state]of [['valuation-v2:done',1,'done'],['quote:historical',10,'pending']] as const){
   obsoleteJobs.enqueue({key,kind:'quote',priority,payload:{id:'CN-SH:600001',market:'CN-SH',symbol:'600001',currency:'CNY',from:'2025-12-31',to:'2025-12-31'}});
   db.prepare('UPDATE home_source_job SET state=? WHERE job_key=?').run(state,key);
  }
  sourceCompletion(db).planCurrent(new Date('2026-01-05T10:00:00Z'),{dates:['2025-12-31']});
  const quotes=db.prepare("SELECT payload_json FROM home_source_job WHERE kind='quote'").all().map(r=>JSON.parse(String(r.payload_json)));
  const superseded=db.prepare("SELECT state,attempts,error,json_extract(payload_json,'$.supersededByRelease') release FROM home_source_job WHERE job_key='valuation-v2:closed'").get();
  expect(superseded).toMatchObject({state:'failed',attempts:3,error:'original provider failure',release:'head'});
  expect(obsoleteJobs.summary().failed).toBe(0);
  expect(obsoleteJobs.summary().done).toBe(1);
  expect(db.prepare("SELECT count(*) n FROM home_source_job WHERE job_key IN ('valuation-v2:done','quote:historical') AND json_extract(payload_json,'$.supersededByRelease') IS NULL").get()!.n).toBe(2);
  expect(quotes.filter(job=>!job.supersededByRelease)).toHaveLength(4);
  expect(quotes).toEqual(expect.arrayContaining([
   expect.objectContaining({id:'CN-SH:600036',from:'2026-01-05',to:'2026-01-05'}),
   expect.objectContaining({id:'CN-SH:600000',from:'2025-12-31',to:'2026-01-05'}),
  ]));
 }finally{db.close();}
});

it('skips documented prelisting sessions while retaining unknown-symbol requests',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('HK:9903','9903','Documented','HK','HKD'),('HK:UNKNOWN','UNKNOWN','Unknown','HK','HKD')");
  const input=release('head',0);
  for(const scope of input.scopes){
   scope.holdings=scope.holdings.map((holding,index)=>({...holding,instrumentId:index===0?'HK:9903':'HK:UNKNOWN'}));
  }
  const store=new HomeStore(db);store.stage(input);store.publish('head',null);
  sourceCompletion(db).planCurrent(new Date('2026-01-06T10:00:00Z'));
  const quotes=db.prepare("SELECT payload_json FROM home_source_job WHERE kind='quote'").all().map(row=>JSON.parse(String(row.payload_json)));
  expect(quotes).toEqual([expect.objectContaining({id:'HK:UNKNOWN',from:'2026-01-06',to:'2026-01-06'})]);
 }finally{db.close();}
});

it('bounds an old custom window and preserves explicit endpoints for a long window',()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('CN-SH:600036','600036','Stock','CN-SH','CNY')");
  const input=release('head',0);
  for(const scope of input.scopes)scope.holdings=scope.holdings.map(holding=>({...holding,instrumentId:'CN-SH:600036'}));
  const store=new HomeStore(db);store.stage(input);store.publish('head',null);
  const completion=sourceCompletion(db),now=new Date('2026-11-19T10:00:00Z');
  completion.planCurrent(now,{dates:['2025-03-02'],to:'2025-03-05'});
  const quotes=db.prepare("SELECT payload_json FROM home_source_job WHERE kind='quote'").all().map(row=>JSON.parse(String(row.payload_json)));
  expect(quotes).toEqual(expect.arrayContaining([expect.objectContaining({from:'2025-02-28',to:'2025-03-05'}),expect.objectContaining({from:'2026-11-19',to:'2026-11-19'})]));
  expect(quotes).toHaveLength(2);
  expect(()=>completion.planCurrent(now,{dates:['2024-01-01'],to:'2025-03-05'})).not.toThrow();
  const endpoints=db.prepare("SELECT payload_json FROM home_source_job WHERE kind='quote'").all().map(row=>JSON.parse(String(row.payload_json)));
  expect(endpoints.some(job=>job.from<='2023-12-29'&&job.to>='2023-12-29')).toBe(true);
 }finally{db.close();}
});
