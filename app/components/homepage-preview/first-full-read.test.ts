import {afterEach,expect,it,vi} from 'vitest';
import {initialFullRequest} from '../../lib/home/full-contracts';
import {firstFullReadScript} from '../../lib/home/first-full-read';
import {fullRead,FullReadError,readFull} from './full-client';
const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function boot(){new Function(firstFullReadScript(day))();}
afterEach(()=>{window.__tradeReviewFirstFullRead?.dispose();delete window.__tradeReviewFirstFullRead;vi.unstubAllGlobals();sessionStorage.clear();window.history.replaceState(null,'','/home');});
it('starts one real request before hydration and adopts its exact response',async()=>{
 const payload={schema:'full-home-v1',releaseId:'one',manifest:{releaseId:'one',moduleComplete:true}};const fetcher=vi.fn(async()=>Response.json(payload));vi.stubGlobal('fetch',fetcher);boot();expect(fetcher).toHaveBeenCalledTimes(1);
 expect(await readFull(initialFullRequest(day),new AbortController().signal)).toEqual(payload);expect(fetcher).toHaveBeenCalledTimes(1);expect(window.__tradeReviewFirstFullRead).toBeUndefined();
});
it('skips URL and session return contexts and discards a mismatching early request',async()=>{
 const fetcher=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',fetcher);window.history.replaceState(null,'','/home?state=x');boot();expect(fetcher).not.toHaveBeenCalled();window.history.replaceState(null,'','/home');sessionStorage.setItem('tradereview-full-home-context-v1','{}');boot();expect(fetcher).not.toHaveBeenCalled();sessionStorage.clear();boot();const early=window.__tradeReviewFirstFullRead!;const request=initialFullRequest(day);request.selection.market='CN';await fullRead('full',{request});expect(early.controller.signal.aborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);
});
it('preserves 503 errors and wires adoption cancellation to the original request',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'首次构建中'},{status:503})));boot();await expect(readFull(initialFullRequest(day),new AbortController().signal)).rejects.toMatchObject({status:503,message:'首次构建中'} satisfies Partial<FullReadError>);
 vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));boot();const early=window.__tradeReviewFirstFullRead!,control=new AbortController(),read=readFull(initialFullRequest(day),control.signal);control.abort();await expect(read).rejects.toMatchObject({name:'AbortError'});expect(early.controller.signal.aborted).toBe(true);
});
it('never reuses expired or version-pinned requests and retries after consuming a failure',async()=>{
 const fetcher=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',fetcher);boot();const expired=window.__tradeReviewFirstFullRead!;expired.createdAt-=16000;await fullRead('full',{request:initialFullRequest(day)});expect(expired.controller.signal.aborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);
 boot();const pinned=window.__tradeReviewFirstFullRead!;await fullRead('full',{request:initialFullRequest(day),version:'fixed'});expect(pinned.controller.signal.aborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(4);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'尚未发布'},{status:503})));boot();await expect(fullRead('full',{request:initialFullRequest(day)})).rejects.toMatchObject({status:503});const retry=vi.fn(async()=>Response.json({ok:true}));vi.stubGlobal('fetch',retry);await expect(fullRead('full',{request:initialFullRequest(day)})).resolves.toEqual({ok:true});expect(retry).toHaveBeenCalledTimes(1);
});
it('does not issue a stale-day request if an old HTML document is reused',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);new Function(firstFullReadScript('2000-01-01'))();expect(fetcher).not.toHaveBeenCalled();
});
it('retains release validation for an adopted response',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({schema:'full-home-v1',releaseId:'one',manifest:{releaseId:'other',moduleComplete:true}})));boot();await expect(readFull(initialFullRequest(day),new AbortController().signal)).rejects.toThrow('首页数据版本不完整');
});
