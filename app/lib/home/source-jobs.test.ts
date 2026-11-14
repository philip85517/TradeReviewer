import {DatabaseSync} from 'node:sqlite';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeSourceJobs} from './source-jobs';
import {HomeStore} from './store';
import {HomeRefresh} from './refresh';
import {release,request} from './test-fixtures';
it('does not exhaust retries when the worker is stopped repeatedly',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const jobs=new HomeSourceJobs(db);jobs.enqueue({key:'fx',kind:'fx',payload:{},priority:0},1000);
  let now=1000;
  for(let i=0;i<4;i++){
   const controller=new AbortController();
   await jobs.runOne(async()=>{controller.abort();throw new Error('worker stopped');},controller.signal,{now:()=>now});now+=31000;
  }
  expect(await jobs.runOne(async()=>{},new AbortController().signal,{now:()=>now})).toBe(true);
  expect(jobs.summary().done).toBe(1);
 }finally{db.close();}
});
it('persists more than two batches, preserves the old head, and bounds failed retries across restart',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const store=new HomeStore(db);store.stage(release('old',0));store.publish('old',null);
  let jobs=new HomeSourceJobs(db),now=1000;const seen:string[]=[];
  for(let i=0;i<10;i++)jobs.enqueue({key:`job-${i}`,kind:'fx',payload:{},priority:i},now);
  const signal=new AbortController().signal;
  const execute=async(job:{key:string})=>{seen.push(job.key);if(job.key==='job-5')throw new Error('provider unavailable');};
  for(let batch=0;batch<3;batch++){
   for(let i=0;i<4;i++)await jobs.runOne(execute,signal,{now:()=>now});
   jobs=new HomeSourceJobs(db);expect(store.readHome(request).stamp.version).toBe('old');
  }
  expect(jobs.summary(now)).toMatchObject({total:10,done:9,failed:1,pending:0});
  for(let i=0;i<5;i++){now+=31000;await jobs.runOne(execute,signal,{now:()=>now});}
  expect(seen.filter(key=>key==='job-5')).toHaveLength(3);
  const refresh=new HomeRefresh(db);expect(refresh.status(now)).toMatchObject({state:'failed',releaseId:'old',canRetry:true});
  expect(refresh.claim('compute',now)).toBe(false);
  refresh.retry();await jobs.runOne(async()=>{},signal,{now:()=>Date.now()});expect(jobs.summary().done).toBe(10);
 }finally{db.close();}
});
it('aborts timed-out provider work, retains failures, and recovers an expired process lease',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const jobs=new HomeSourceJobs(db);jobs.enqueue({key:'fx',kind:'fx',payload:{},priority:0},1000);
  let aborted=false;
  await jobs.runOne(async(_job,signal)=>new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true})),new AbortController().signal,{now:()=>1000,timeoutMs:10});
  expect(aborted).toBe(true);expect(jobs.summary().failed).toBe(1);
  db.prepare("UPDATE home_source_job SET state='running',lease_owner='crashed',lease_until=1001").run();
  expect(await new HomeSourceJobs(db).runOne(async()=>{},new AbortController().signal,{now:()=>1002})).toBe(true);
  expect(jobs.summary().done).toBe(1);
 }finally{db.close();}
});
it('recovers the public status when a newer FX snapshot succeeds',async()=>{
 const db=new DatabaseSync(':memory:');initializeSqlite(db);
 try{
  const jobs=new HomeSourceJobs(db);jobs.enqueue({key:'fx:old',kind:'fx',payload:{},priority:0},1000);
  let now=1000;
  for(let i=0;i<3;i++){await jobs.runOne(async()=>{throw new Error('offline');},new AbortController().signal,{now:()=>now});now+=31000;}
  jobs.enqueue({key:'fx:new',kind:'fx',payload:{},priority:0},now);
  await jobs.runOne(async()=>{},new AbortController().signal,{now:()=>now});
  expect(jobs.summary(now)).toMatchObject({failed:0,pending:0});
 }finally{db.close();}
});
