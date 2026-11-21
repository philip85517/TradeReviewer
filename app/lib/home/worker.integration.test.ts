import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
import {initializeSqlite} from '../../../db/sqlite';
import {HomeStore} from './store';
import {request,release} from './test-fixtures';
import {homeHttp} from './http';
import {defaultFullRequest} from './full-contracts';
it('publishes twice in the separate worker process and keeps the first version readable',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'home-worker-')),path=join(dir,'worker.sqlite'),db=new DatabaseSync(path);initializeSqlite(db);
 // Direct entry also defaults to derived recovery only, with no source sync.
 const env:NodeJS.ProcessEnv={...process.env,TRADEREVIEW_DB_PATH:path};delete env.HOME_SOURCE_SYNC;
 const child=spawn(process.execPath,['scripts/home-worker.mjs'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>log+=chunk);
 const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(child.exitCode!==null||Date.now()-start>20000)throw new Error(log);await new Promise(r=>setTimeout(r,100));}};
 try{
  const store=new HomeStore(db);await wait(()=>!!store.head());const first=store.head()!;
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD')");
  await wait(()=>store.head()!==first);
  expect(store.readHome(request,first).stamp.version).toBe(first);
  expect(store.readHome(request).snapshot.sourceSequence).toBe(1);
  expect(log).not.toContain('计算失败');
 }finally{child.kill('SIGTERM');await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once('exit',()=>r());});db.close();rmSync(dir,{recursive:true,force:true});}
},45000);

it('continues publishing after garbage collection fails and releases the completed lease',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'home-worker-gc-')),path=join(dir,'worker.sqlite'),db=new DatabaseSync(path);initializeSqlite(db);
 const store=new HomeStore(db);
 for(let i=0;i<3;i++){store.stage(release(`old${i}`,0));store.publish(`old${i}`,i?`old${i-1}`:null);db.prepare('UPDATE home_publication SET published_at=? WHERE release_id=?').run(i+1,`old${i}`);}
 expect(await(await homeHttp(db,'status',new Request('http://localhost/api/home/status'))).json()).toMatchObject({state:'ready',fullReady:false});
 expect(await(await homeHttp(db,'status',new Request('http://localhost/api/home/status?reader=full-home-v1'))).json()).toMatchObject({state:'updating',fullReady:false});
 db.exec("CREATE TRIGGER refuse_test_cleanup BEFORE DELETE ON home_release BEGIN SELECT RAISE(ABORT,'forced-collection-failure'); END;");
 const child=spawn(process.execPath,['scripts/home-worker.mjs'],{cwd:process.cwd(),env:{...process.env,TRADEREVIEW_DB_PATH:path,HOME_SOURCE_SYNC:'0'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>log+=chunk);
 const wait=async(predicate:()=>boolean)=>{const start=Date.now();while(!predicate()){if(child.exitCode!==null||Date.now()-start>20000)throw new Error(log);await new Promise(r=>setTimeout(r,50));}};
 try{
  await wait(()=>log.includes('forced-collection-failure'));await new Promise(r=>setTimeout(r,100));
  expect(child.exitCode,log).toBeNull();
  await wait(()=>db.prepare('SELECT lease_owner FROM home_refresh').get()!.lease_owner===null);
  const first=store.head()!;expect(first).not.toBe('old2');
  const query=new URLSearchParams({request:JSON.stringify(defaultFullRequest(new Date(Date.now()+8*3600000).toISOString().slice(0,10)))});
  const full=await homeHttp(db,'full',new Request('http://localhost/api/home/full?'+query));expect(full.status).toBe(200);expect(await full.json()).toMatchObject({schema:'full-home-v1',releaseId:first});
  db.exec("INSERT INTO instruments(id,symbol,name,market,currency)VALUES('US:X','X','X','US','USD')");
  await wait(()=>store.head()!==first);
  expect(store.readHome(request,first).stamp.version).toBe(first);
 }finally{child.kill('SIGTERM');await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once('exit',()=>r());});db.close();rmSync(dir,{recursive:true,force:true});}
},45000);
