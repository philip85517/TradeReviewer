'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {initialFullRequest,type FullRequestV1,type FullResultV1} from '../../lib/home/full-contracts';
import {readFull,fullRead,retryFull,repairFull,FullReadError,type FullRefreshStatus} from './full-client';
import type {HomeRequest} from './display-contract';
export const FULL_CONTEXT_KEY='tradereview-full-home-context-v1';
export type FullMemories=Record<'current'|'historical',FullRequestV1['contribution']>;
export function fullHomeRequest(r:FullRequestV1):HomeRequest{return {...r.holdings,market:r.selection.market,accountId:r.selection.accountId,period:r.currentPeriod,filters:{assetTypes:r.selection.assetTypes.map(value=>value==='stock'?'股票':value==='etf'?'ETF':value),openOnly:r.selection.globalOpenOnly,review:r.selection.review}};}
type AccountDirectory={core:{accounts:readonly {id:string}[]};accountIdsByMarket:Record<'CN'|'HK'|'US',string[]>};
export function compatibleAccount(result:AccountDirectory,market:FullRequestV1['selection']['market'],accountId:string){return accountId==='all'||(market==='all'?result.core.accounts.some(a=>a.id===accountId):result.accountIdsByMarket[market].includes(accountId))?accountId:'all';}
export function useFullHome(){
 const [result,setResult]=useState<FullResultV1|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
 const [marketPending,setMarketPending]=useState(false);
 const first=useRef((()=>{return initialFullRequest(new Date(Date.now()+8*3600000).toISOString().slice(0,10));})()),desired=useRef(first.current),controller=useRef<AbortController|null>(null),generation=useRef(0),current=useRef(result);
 const recoveryDelay=useRef(0),[autoRecover,setAutoRecover]=useState(false);
 const [refresh,setRefresh]=useState<FullRefreshStatus|null>(null),inFlight=useRef(false);
 const [repairing,setRepairing]=useState(false),[repairMessage,setRepairMessage]=useState<string|null>(null),repairControl=useRef<AbortController|null>(null);
 const memories=useRef<FullMemories>({current:first.current.contribution,historical:{...first.current.contribution,mode:'historical'}});
 current.current=result;
 const load=useCallback(async(request:FullRequestV1,reload=false,marketSwitch=false)=>{controller.current?.abort();const c=new AbortController(),token=++generation.current;controller.current=c;inFlight.current=true;desired.current=request;setMarketPending(marketSwitch);setPending(true);setError(null);const timeout=setTimeout(()=>c.abort('timeout'),15000);
 try{const active=()=>token===generation.current&&!c.signal.aborted;
 const resetAccount=(value:FullRequestV1):FullRequestV1=>({...value,selection:{...value.selection,accountId:'all'},holdings:{...value.holdings,page:1},contribution:{...value.contribution,drillMarket:'all',page:1}});
 const read=async()=>{
  try{return await readFull(request,c.signal,reload?undefined:current.current?.releaseId);}
  catch(e){
   // A removed saved identity cannot return the directory needed for normalisation.
   // Only recover the initial restore, never widen a failed live selection.
   if(!active()||current.current||request.selection.accountId==='all'||!(e instanceof FullReadError)||e.status!==404||e.message!=='账户范围不存在')throw e;
   request=resetAccount(request);desired.current=request;
   return readFull(request,c.signal);
  }
 };
 let next=await read();
 if(!active())return;
 const accountId=compatibleAccount(next,next.request.selection.market,next.request.selection.accountId);
 if(accountId!==next.request.selection.accountId){
  request=resetAccount(next.request);desired.current=request;
  next=await readFull(request,c.signal,next.releaseId);
 }
 if(token!==generation.current||c.signal.aborted)return;if(current.current&&JSON.stringify(current.current.request.selection)!==JSON.stringify(next.request.selection))for(const mode of ['current','historical'] as const)memories.current[mode]={...memories.current[mode],drillMarket:'all',page:1};setResult(next);desired.current=next.request;memories.current[next.request.contribution.mode]=next.request.contribution;return next.releaseId;}
 catch(e){if(token===generation.current){if(current.current)desired.current=current.current.request;setAutoRecover(!current.current&&e instanceof FullReadError&&e.status===503);if(c.signal.reason==='timeout')setError('读取超时，新选择未应用，请重新读取');else if(!c.signal.aborted)setError(e instanceof Error?e.message:'读取失败');}}
 finally{clearTimeout(timeout);if(token===generation.current){inFlight.current=false;setPending(false);}}},[]);
 useEffect(()=>{let request=first.current;try{const raw=sessionStorage.getItem(FULL_CONTEXT_KEY);if(raw){const context=JSON.parse(raw);if(context.request?.schema==='full-home-query-v1'){request=context.request;if(context.memories)memories.current=context.memories;}}const encoded=new URLSearchParams(window.location.search).get('state');if(encoded){const r=JSON.parse(encoded);if(r.schema==='full-home-query-v1')request=r;}const encodedMemories=new URLSearchParams(window.location.search).get('contributionState');if(encodedMemories){const m=JSON.parse(encodedMemories);if(m.current?.mode==='current'&&m.historical?.mode==='historical')memories.current=m;}}catch{}void load(request,true);return()=>{controller.current?.abort();++generation.current;};},[load]);
 useEffect(()=>{
  if(result||!error||!autoRecover)return;
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,active:AbortController|null=null;
  const schedule=()=>{if(!disposed&&document.visibilityState!=='hidden')timer=setTimeout(check,recoveryDelay.current);};
  const check=async()=>{
   if(disposed||active||document.visibilityState==='hidden')return;
   const control=new AbortController();active=control;
   const timeout=setTimeout(()=>control.abort(),10000);
   try{
    const status=await fullRead<FullRefreshStatus>('status',{},control.signal);
    if(disposed||control.signal.aborted)return;
    setRefresh(status);
    if(status.fullReady&&!inFlight.current){recoveryDelay.current=Math.min(15000,Math.max(2000,recoveryDelay.current*2));void load(desired.current,true);return;}
    if(status.state==='failed'){setAutoRecover(false);setError(status.error??'首页首次构建失败，请重新读取重试');return;}
   }catch{/* A temporary status failure keeps the last honest unavailable state. */}
   finally{clearTimeout(timeout);active=null;}
   recoveryDelay.current=Math.min(15000,Math.max(2000,recoveryDelay.current*2));schedule();
  };
  const visibility=()=>{if(timer)clearTimeout(timer);if(document.visibilityState==='hidden')active?.abort();else void check();};
  document.addEventListener('visibilitychange',visibility);schedule();
  return()=>{disposed=true;if(timer)clearTimeout(timer);active?.abort();document.removeEventListener('visibilitychange',visibility);};
 },[result,error,autoRecover,load]);
 const reload=useCallback(async()=>{setPending(true);setError(null);recoveryDelay.current=0;try{if(refresh?.canRetry)setRefresh(await retryFull());void load(desired.current,true);}catch(e){setPending(false);setError(e instanceof Error?e.message:'重试失败');}},[load,refresh?.canRetry]);
 const followPublication=useCallback(async(acquireSources=false)=>{
  repairControl.current?.abort();const control=new AbortController();repairControl.current=control;setRepairing(true);setRepairMessage('后台处理中，仍显示当前结果');
  let rangeNote='';
  try{
   if(acquireSources){const accepted=await repairFull(desired.current.currentPeriod.from,control.signal,desired.current.currentPeriod.to);setRefresh(accepted);if(accepted.sourceRepairRange?.limited){rangeNote=`本次补齐 ${accepted.sourceRepairRange.from} 至 ${accepted.sourceRepairRange.to} 的逐日行情及期初、当前端点；更早日期请选相应自定义期间。`;setRepairMessage(rangeNote+'后台处理中，仍显示当前结果');}}
   const started=Date.now();let lastRelease=current.current?.releaseId;
   while(!control.signal.aborted&&Date.now()-started<90000){
    const status=await fullRead<FullRefreshStatus>('status',{},control.signal);setRefresh(status);
    if(status.fullReady&&status.fullReleaseId&&status.fullReleaseId!==lastRelease&&!inFlight.current){const loaded=await load(desired.current,true);if(loaded)lastRelease=loaded;}
    const caughtUp=(status.pendingSequence??0)<=(status.publishedSequence??0);
    if(caughtUp&&!status.sourcePending&&status.fullReleaseId===lastRelease&&!inFlight.current&&(status.state==='ready'||status.state==='failed')){setRepairMessage(rangeNote+(status.state==='failed'?`部分数据仍未补齐：${status.error??'来源暂不可用'}`:'已读取最新结果；仍缺的依据见各区说明'));return;}
    await new Promise<void>(resolve=>{const timer=setTimeout(done,1500);function done(){clearTimeout(timer);control.signal.removeEventListener('abort',done);resolve();}control.signal.addEventListener('abort',done,{once:true});});
   }
   if(!control.signal.aborted)setRepairMessage(rangeNote+'后台仍在处理，可稍后重新读取');
  }catch(e){if(!control.signal.aborted)setRepairMessage(e instanceof Error?e.message:'后台状态暂不可用');}
  finally{if(repairControl.current===control)setRepairing(false);}
 },[load]);
 useEffect(()=>()=>repairControl.current?.abort(),[]);
 useEffect(()=>{if(repairing||!repairMessage?.startsWith('已读取最新结果'))return;const timer=setTimeout(()=>setRepairMessage(null),2000);return()=>clearTimeout(timer);},[repairing,repairMessage]);
 useEffect(()=>{if(!result)return;const url=new URL(window.location.href);url.searchParams.set('state',JSON.stringify(result.request));url.searchParams.set('contributionState',JSON.stringify(memories.current));window.history.replaceState(null,'',url);},[result]);
 const change=useCallback((patch:Partial<HomeRequest>)=>{const r=desired.current;const selection={...r.selection,...(patch.market?{market:patch.market}:{}),...(patch.accountId?{accountId:patch.accountId}:{}),...(patch.filters?{assetTypes:patch.filters.assetTypes.map(value=>value==='股票'?'stock':value==='ETF'?'etf':value),globalOpenOnly:patch.filters.openOnly,review:patch.filters.review}:{})};if(current.current){const candidate=patch.market&&!patch.accountId?current.current.request.selection.accountId:selection.accountId;selection.accountId=compatibleAccount(current.current,selection.market,candidate);}const holdings={...r.holdings,...Object.fromEntries(Object.entries(patch).filter(([k])=>['query','sort','direction','page'].includes(k)))};if(patch.market||patch.accountId||patch.filters||patch.query!==undefined)holdings.page=1;const global=!!(patch.market||patch.accountId||patch.filters);void load({...r,selection,currentPeriod:patch.period??r.currentPeriod,holdings,contribution:global?{...r.contribution,drillMarket:'all',page:1}:r.contribution},false,patch.market!==undefined);},[load]);
 const contribution=useCallback((next:FullRequestV1['contribution'])=>{const r=desired.current;if(next.mode!==r.contribution.mode)next=memories.current[next.mode];void load({...r,contribution:next});},[load]);
 return {result,pending,marketPending:pending&&!!result&&marketPending,error,change,contribution,memories,load,refresh,reload,repairing,repairMessage,repair:()=>followPublication(true),followPublication:()=>followPublication(false),cancel:()=>{controller.current?.abort();++generation.current;inFlight.current=false;desired.current=current.current?.request??first.current;setPending(false);},request:result?.request??first.current};
}
