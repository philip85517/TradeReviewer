import type {HomeRequest,HomepageSource,HomeView,Stamp} from './display-contract';
import type {HomeStore} from '../../lib/home/store';
import {explainReasons} from './reason-labels';
export function createHttpSource(fetcher:typeof fetch=fetch):HomepageSource {
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const initialRequest:HomeRequest={market:'all',accountId:'all',period:{preset:'ytd',from:`${today.slice(0,4)}-01-01`,to:today},page:1,sort:'name',direction:'asc',query:''};
 const read=async<T,>(operation:string,parameters:Record<string,unknown>,signal:AbortSignal,method='GET'):Promise<T>=>{
  const query=new URLSearchParams();for(const[key,value]of Object.entries(parameters))query.set(key,JSON.stringify(value));
  const response=await fetcher(`/api/home/${operation}?${query}`,{signal,method,cache:'no-store'});
  if(!response.ok){const body=await response.json() as {error?:string};throw new Error(body.error??`首页读取失败（${response.status}）`);}
  return(operation==='export'?await response.text():explainReasons(await response.json())) as T;
 };
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const verify=(stamp:Stamp,current:HomeView,request:HomeRequest)=>{
  if(stamp.version!==current.stamp.version||stamp.reportCurrency!==current.stamp.reportCurrency||stamp.asOf!==current.stamp.asOf||stamp.scope!==JSON.stringify([request.market,request.accountId,request.period]))throw new Error('首页结果版本或范围不一致，已保留原视图');
 };
 const source:HomepageSource={kind:'http',initialRequest,
  readHome:(request,signal,version)=>read('core',{request,...(version?{version}:{})},signal),
  readStatus:signal=>read('status',{},signal),
  readHolding:(stamp,id,signal)=>read('holding',{stamp,id},signal),
  readTrades:(stamp,id,signal,cursor=0)=>read('trades',{stamp,id,cursor},signal),
  exportHoldings:(request,signal,version)=>{if(!version)throw new Error('缺少导出结果版本');return read('export',{request,version},signal);},
  repair:async(_request,signal)=>{await read('retry',{},signal,'POST');return{remainingReasons:[]};},
  readChange:async(current,request,signal)=>{
   if(current.request.market!==request.market||current.request.accountId!==request.accountId)return source.readHome(request,signal);
   const periodChanged=!same(current.request.period,request.period);
   const rowsChanged=['query','sort','direction','page'].some(key=>current.request[key as keyof HomeRequest]!==request[key as keyof HomeRequest]);
   const version=current.stamp.version;
   const [period,holdings]=await Promise.all([
    periodChanged?read<ReturnType<HomeStore['readPeriod']>>('period',{request,version},signal):null,
    rowsChanged?read<ReturnType<HomeStore['readHoldings']>>('holdings',{request,version},signal):null,
   ]);
   if(period)verify(period.stamp,current,request);if(holdings)verify(holdings.stamp,current,request);
   const rows=holdings?.holdings??current.holdings;
   return {...current,stamp:period?.stamp??holdings?.stamp??current.stamp,request:{...request,page:rows.page,sort:rows.sortAvailable?request.sort:'name'},holdings:rows,
    ...(period?{metrics:{...current.metrics,net:period.period.net,periodRealized:period.period.realized,unrealizedChange:period.period.unrealizedChange},series:{version,boundary:{asOf:period.stamp.asOf,effectiveEnd:period.period.effectiveEnd},points:period.period.points}}:{})};
  },
 };
 return source;
}
