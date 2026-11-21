import {fullHttp} from './full-http';
import {validateFull} from './full-persistence';
import type {DatabaseSync} from 'node:sqlite';
import type {HomeRequest,Stamp} from '../../components/homepage-preview/display-contract';
import {HomeReadError,HomeStore} from './store';
import {HomeRefresh} from './refresh';
import {validDay,nextDay} from './period';
import {sourceCompletion} from './source-completion';
import {normalizeHomeFilters} from './request-filters';
const headers={'Cache-Control':'no-store'};
const bad=()=>new HomeReadError(400,'无效的首页请求参数');
function parse(params:URLSearchParams,key:string):unknown {
 const value=params.get(key);if(!value||value.length>8000)throw bad();
 try{return JSON.parse(value);}catch{throw bad();}
}
function text(value:unknown,max=500):string {if(typeof value!=='string'||!value||value.length>max)throw bad();return value;}
function homeRequest(value:unknown):HomeRequest {
 if(!value||typeof value!=='object')throw bad();const v=value as Record<string,unknown>;
 const p=v.period as Record<string,unknown>|undefined;
 if(!['all','CN','HK','US'].includes(String(v.market))||!['name','marketValue','unrealized'].includes(String(v.sort))||!['asc','desc'].includes(String(v.direction))||typeof v.query!=='string'||v.query.length>200||!Number.isSafeInteger(v.page)||Number(v.page)<1)throw bad();
 text(v.accountId);if(!p||!['all','ytd','month','week','custom'].includes(String(p.preset)))throw bad();
 const from=text(p.from,10),to=text(p.to,10);
 if(!validDay(from)||!validDay(to)||from<'0001-01-02'||to>'9998-12-31'||from>to)throw bad();
 if((Date.parse(to)-Date.parse(from))/86400000>36600)throw new HomeReadError(400,'单次图表范围不能超过 100 年，请缩小日期范围');
 let filters;try{filters=normalizeHomeFilters(v.filters);}catch{throw bad();}
 if(filters.assetTypes.length||filters.openOnly||filters.review!=='all')throw new HomeReadError(422,'首页附加筛选尚未支持，无法应用资产类别、仅看未平仓或复盘状态；请清除附加筛选后重试');
 return value as HomeRequest;
}
function stamp(value:unknown):Stamp {
 if(!value||typeof value!=='object')throw bad();const s=value as Record<string,unknown>;
 for(const key of ['scope','version','asOf','reportCurrency'])text(s[key],2000);
 let scope:unknown;try{scope=JSON.parse(String(s.scope));}catch{throw bad();}
 if(!Array.isArray(scope)||scope.length!==3)throw bad();
 homeRequest({market:scope[0],accountId:scope[1],period:scope[2],query:'',page:1,sort:'name',direction:'asc'});
 return value as Stamp;
}
export async function homeHttp(db:DatabaseSync,operation:string,request:Request):Promise<Response> {
 try {
  const url=new URL(request.url),params=url.searchParams,store=new HomeStore(db);
  const reader=['status','retry','repair'].includes(operation)?params.get('reader'):null;
  if(reader!==null&&reader!=='full-home-v1')throw bad();
  const refresh=new HomeRefresh(db,reader==='full-home-v1');
  if(operation==='retry'||operation==='repair'){
   if(request.method!=='POST')return Response.json({error:'请使用 POST'},{status:405,headers});
   if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'请求来源不匹配'},{status:403,headers});
   let sourceKeys:string[]|undefined,requestedSourceJobs=0,sourceRepairRange:{from:string;to:string;limited:boolean}|undefined;
   if(operation==='repair'){
    const from=params.get('from');
    if(!from||!validDay(from)||from<'0001-01-02'||from>new Date(Date.now()+8*3600000).toISOString().slice(0,10))throw bad();
    const to=params.get('to')??new Date(Date.now()+8*3600000).toISOString().slice(0,10);
    if(!validDay(to)||to<from||to>new Date(Date.now()+8*3600000).toISOString().slice(0,10))throw bad();
    const baseline=nextDay(from,-1),dailyFrom=baseline<nextDay(to,-366)?nextDay(to,-366):baseline;
    sourceRepairRange={from:dailyFrom,to,limited:dailyFrom!==baseline};
    sourceKeys=sourceCompletion(db).planCurrent(new Date(),{dates:[nextDay(from,-1)],to});requestedSourceJobs=sourceKeys.length;
   }
   refresh.retry(sourceKeys);return Response.json({...refresh.status(),...(operation==='repair'?{requestedSourceJobs,sourceRepairRange}:{})},{headers});
  }
  if(request.method!=='GET')return Response.json({error:'请使用 GET'},{status:405,headers});
  if(operation==='status'){
   const status=refresh.status();
   // Production startup checks the existing publication once on the serving
   // connection. Ordinary polling only reads scheduler state.
   if(params.get('verify')==='publication'&&status.fullReleaseId){
    try{
     if(!validateFull(db,status.fullReleaseId))return Response.json(refresh.status(),{headers});
    }
    catch(error){
     console.error('Published homepage failed startup validation',error);
     return Response.json({...status,state:'failed',fullReady:false,error:'已发布首页校验失败',canRetry:true},{headers});
    }
   }
   return Response.json(status,{headers});
  }
  if(['full','history','contribution','search','detail','full-export','evidence'].includes(operation))return fullHttp(db,operation,params);
  let result:unknown;
  if(operation==='holding'||operation==='trades'){
   const scope=stamp(parse(params,'stamp')),id=text(parse(params,'id'));
   const cursor=params.has('cursor')?parse(params,'cursor'):0;
   if(!Number.isSafeInteger(cursor)||Number(cursor)<0)throw bad();
   result=operation==='holding'?store.readHolding(scope,id):store.readTrades(scope,id,Number(cursor));
  }else{
   const input=homeRequest(parse(params,'request'));
   if(operation==='core')result=store.readHome(input,params.has('version')?text(parse(params,'version')):undefined);
   else {
    const version=text(parse(params,'version'));
    if(operation==='period')result=store.readPeriod(input,version);
    else if(operation==='holdings')result=store.readHoldings(input,version);
    else if(operation==='export')return new Response('\ufeff'+store.exportHoldings(input,version),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':"attachment; filename=holdings.csv"}});
    else throw new HomeReadError(404,'首页接口不存在');
   }
  }
  return Response.json(result,{headers});
 }catch(error){
  if(error instanceof HomeReadError)return Response.json({error:error.message},{status:error.status,headers});
  console.error('Homepage read failed',error);return Response.json({error:'首页结果暂时无法读取，请重试'},{status:503,headers});
 }
}
