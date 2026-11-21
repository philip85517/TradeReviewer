import type {FullResultV1,FullRequestV1,FullDetail,FullDetailTarget,FullCatalogItem,FullContributionRow} from '../../lib/home/full-contracts';
type FirstFullRead={key:string;createdAt:number;controller:AbortController;response:Promise<Response>;dispose:()=>void};
declare global {interface Window {__tradeReviewFirstFullRead?:FirstFullRead;}}
function takeFirstRead(operation:string,parameters:Record<string,unknown>,signal?:AbortSignal){
 if(operation!=='full'||typeof window==='undefined')return null;
 const first=window.__tradeReviewFirstFullRead;if(!first)return null;
 delete window.__tradeReviewFirstFullRead;first.dispose();
 if(parameters.version!==undefined||first.key!==JSON.stringify(parameters.request)||Date.now()-first.createdAt>15000||first.controller.signal.aborted||signal?.aborted){first.controller.abort();return null;}
 const abort=()=>first.controller.abort();signal?.addEventListener('abort',abort,{once:true});
 return {response:first.response,dispose:()=>signal?.removeEventListener('abort',abort)};
}
export class FullReadError extends Error{constructor(message:string,readonly status:number){super(message);}}
export async function fullRead<T>(operation:string,parameters:Record<string,unknown>,signal?:AbortSignal):Promise<T>{
 const query=new URLSearchParams();for(const [key,value]of Object.entries(parameters))if(value!==undefined)query.set(key,JSON.stringify(value));
 if(operation==='status')query.set('reader','full-home-v1');
 const first=takeFirstRead(operation,parameters,signal);
 try{
 const response=await (first?.response??fetch(`/api/home/${operation}?${query}`,{signal,cache:'no-store'}));
 if(!response.ok){let message=`读取失败（${response.status}）`;try{const b=await response.json() as {error?:string};message=b.error??message;}catch{}throw new FullReadError(message,response.status);}
 return (operation==='full-export'?await response.text():await response.json()) as T;
 }finally{first?.dispose();}
}
export async function readFull(request:FullRequestV1,signal:AbortSignal,version?:string){const result=await fullRead<FullResultV1>('full',{request,version},signal);if(result.schema!=='full-home-v1'||result.releaseId!==result.manifest.releaseId||(version&&result.releaseId!==version)||!result.manifest.moduleComplete)throw new Error('首页数据版本不完整，已保留原结果');return result;}
export const searchFull=(version:string,query:string,signal:AbortSignal)=>fullRead<{items:FullCatalogItem[]}>('search',{version,query},signal);
export const detailFull=(version:string,target:FullDetailTarget,signal:AbortSignal)=>fullRead<FullDetail>('detail',{version,target},signal);

/** Use the clicked row identity; catalog search is deliberately paginated. */
export function fullPositionTarget(item:Pick<FullCatalogItem|FullContributionRow,'id'|'accountId'>,request:FullRequestV1):FullDetailTarget{return {kind:'position',id:item.id,accountScope:[item.accountId],sourceContext:JSON.stringify(request)};}
export type FullRefreshStatus={sourceRepairRange?:{from:string;to:string;limited:boolean};sourcePending?:number;sourceFailed?:number;fullReady?:boolean;fullReleaseId?:string|null;releaseId?:string|null;publishedSequence?:number;pendingSequence?:number;state:string;canRetry:boolean;error:string|null};
export async function repairFull(from:string,signal?:AbortSignal,to?:string):Promise<FullRefreshStatus>{const response=await fetch('/api/home/repair?'+new URLSearchParams({reader:'full-home-v1',from,...(to?{to}:{})}),{method:'POST',signal,cache:'no-store'});if(!response.ok){let message=`修复请求失败（${response.status}）`;try{const body=await response.json() as {error?:string};message=body.error??message;}catch{}throw new Error(message);}return response.json();}
export async function retryFull(signal?:AbortSignal):Promise<FullRefreshStatus>{const response=await fetch('/api/home/retry?reader=full-home-v1',{method:'POST',signal,cache:'no-store'});if(!response.ok)throw new Error(`重试失败（${response.status}）`);return response.json();}

export function fullLibraryParameters(request:FullRequestV1,accounts:string[],item?:Pick<FullCatalogItem,'instrumentId'|'accountId'|'market'>,date?:string){
 const params=new URLSearchParams({market:item?.market??request.selection.market,accounts:JSON.stringify(item?[item.accountId]:accounts),rangeMode:date?'custom':request.currentPeriod.preset,from:date??request.currentPeriod.from,to:date??request.currentPeriod.to,returnTo:'/home'});if(item)params.set('instrument',item.instrumentId);return params;
}
