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
  const completion=sourceCompletion(db,transport);
  completion.jobs.enqueue({key:'test-quote',kind:'quote',priority:0,payload:{id:'CN-SH:600036',symbol:'600036',market:'CN-SH',currency:'CNY',from:'2026-01-05',to:'2026-01-05'}});
  await completion.runOne(new AbortController().signal);
  expect(completion.jobs.summary()).toMatchObject({done:1,failed:0,pending:0});
  const store=new SqliteStore(db);
  expect(store.getDailyCandles('CN-SH:600036')).toMatchObject([{tradingDate:'2026-01-05',close:'11',currency:'CNY',adjustmentMode:'raw'}]);
  expect(store.getCoverageSegments('CN-SH:600036')).toMatchObject([{status:'complete',missingTradingDates:[]}]);
  expect(await sourceCompletion(db,transport).runOne(new AbortController().signal)).toBe(false);
  expect(transport).toHaveBeenCalledTimes(1);
 }finally{db.close();}
});
