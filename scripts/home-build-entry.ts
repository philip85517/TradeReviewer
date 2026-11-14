import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { HOME_SCHEMA } from '../db/home-schema';
import { initializeSqlite } from '../db/sqlite';
import { readSourceSnapshot } from '../app/lib/home/source';
import { buildRelease } from '../app/lib/home/builder';
import {ProjectionCache} from '../app/lib/home/projection-cache';
import {HomeRefresh} from '../app/lib/home/refresh';
import { HomeStore } from '../app/lib/home/store';
export function buildOnce(path: string, asOf?: string, owner?:string) {
 const db = new DatabaseSync(path); const started = performance.now();
 let standalone:HomeRefresh|undefined;
 try {
  initializeSqlite(db); db.exec(HOME_SCHEMA);
  if(!owner){
   const refresh=new HomeRefresh(db),candidate=randomUUID();
   // The manual rebuild shares the worker's exclusion contract. Its bounded
   // lease is longer because this synchronous command has no heartbeat parent.
   if(!refresh.claim(candidate,Date.now(),30*60000,true))throw new Error('homepage build already leased or awaiting retry');
   owner=candidate;standalone=refresh;
  }else if(!db.prepare('SELECT 1 FROM home_refresh WHERE singleton=1 AND lease_owner=? AND lease_until>?').get(owner,Date.now()))throw new Error('publication lease expired');
  const source = readSourceSnapshot(db, asOf); const readMs=performance.now()-started;
  const store = new HomeStore(db), expected=store.head();
  const objects={reused:0,built:0},builderTimings:Record<string,number>={};
  const result=buildRelease(source,randomUUID(),{cache:new ProjectionCache(db),reusePublished:true,stats:objects,timings:builderTimings});const computeMs=performance.now()-started-readMs;
  const prepared=store.reuseUnchanged(result);
  store.stage(prepared); store.publish(result.id,expected,{owner,now:Date.now()});
  return { objects, builderTimings, sourceTimings:source.timings, reusedScopes:prepared.reuse?.length??0, release:result.id, classification:source.classification, executions:source.executions.length, instruments:source.instruments.length, candles:source.candles.length, scopes:result.scopes.length+(result.reuse?.length??0),rebuiltScopes:result.scopes.length, dailyRows:result.scopes.reduce((n,s)=>n+s.days.length,0), holdings:result.scopes.find(s=>s.market==='all'&&s.accountId==='all')?.holdings.length, readMs,computeMs,persistMs:performance.now()-started-readMs-computeMs,totalMs:performance.now()-started };
 } finally { try{if(standalone&&owner)standalone.finish(owner);}finally{db.close();} }
}

export function coordinator(path:string){const db=new DatabaseSync(path);initializeSqlite(db);return {db,refresh:new HomeRefresh(db),store:new HomeStore(db),close:()=>db.close()};}

export {sourceCompletion} from '../app/lib/home/source-completion';
