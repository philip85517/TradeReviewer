import {describe,expect,it} from 'vitest';
import {initializeHomeRuntime,loadProductionEnvironment} from './start-production.mjs';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

describe('production readiness',()=>{
 it('preserves vinext environment precedence, interpolation and explicit overrides',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'home-start-env-'));
  try{
   writeFileSync(join(dir,'.env'),'CHOICE=base\nBASE=base\n');
   writeFileSync(join(dir,'.env.production'),'CHOICE=production\n');
   writeFileSync(join(dir,'.env.local'),'CHOICE=local\nREF=${CHOICE}\n');
   writeFileSync(join(dir,'.env.production.local'),'TOP=highest\n');
   const environment={TOP:'explicit'};await loadProductionEnvironment(dir,environment);
   expect(environment).toEqual({TOP:'explicit',CHOICE:'local',REF:'local',BASE:'base'});
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
 it('consumes the initial HTML stream before resolving readiness and checks the published release without producing a query result',async()=>{
  let finish,done=false;const paths=[];
  const pending=initializeHomeRuntime({fetch:async request=>{
   const url=new URL(request.url);paths.push(url.pathname+url.search);
   if(paths.length===1)return new Response(new ReadableStream({start(controller){finish=()=>controller.close();}}));
   return Response.json({state:'recovering'});
  }}).then(()=>{done=true;});
  await new Promise(r=>setTimeout(r,0));expect(done).toBe(false);expect(paths).toEqual(['/home']);
  finish();await pending;expect(paths).toEqual(['/home','/api/home/status?reader=full-home-v1&verify=publication']);
 });
 it('rejects a broken route or database instead of marking the process ready',async()=>{
  await expect(initializeHomeRuntime({fetch:async()=>new Response('failed',{status:500})})).rejects.toThrow('500');
  await expect(initializeHomeRuntime({fetch:async r=>new URL(r.url).pathname==='/home'?new Response('shell'):new Response('database unavailable',{status:503})})).rejects.toThrow('503');
 });
});
