import type {DatabaseSync} from 'node:sqlite';
import {FullHomeStore} from './full-store';
import {HomeReadError} from './store';
import {FULL_QUERY_SCHEMA,type FullRequestV1,type FullDetailTarget} from './full-contracts';
import {validDay} from './period';
const bad=()=>new HomeReadError(400,'完整首页请求参数无效');
const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw bad();return v as Record<string,unknown>;};
const text=(v:unknown,max=2000):string=>{if(typeof v!=='string'||!v||v.length>max)throw bad();return v;};
const one=(v:unknown,values:string[])=>{if(!values.includes(String(v)))throw bad();};
const integer=(v:unknown,min=1,max=1000000)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw bad();};
export function parseFullRequest(value:unknown):FullRequestV1{
 const r=record(value),s=record(r.selection),p=record(r.currentPeriod),h=record(r.holdings),c=record(r.contribution),y=record(r.historyRange);
 if(r.schema!==FULL_QUERY_SCHEMA)throw bad();one(s.market,['all','CN','HK','US']);text(s.accountId);if(!Array.isArray(s.assetTypes)||s.assetTypes.length>30||s.assetTypes.some(v=>typeof v!=='string'||v.length>100))throw bad();if(typeof s.globalOpenOnly!=='boolean')throw bad();one(s.review,['all','pending','done']);if(s.reviewPolicy!=='effective-completion-v1')throw new HomeReadError(422,'复盘筛选版本不受支持');
 one(p.preset,['all','ytd','month','week','custom']);if(!validDay(text(p.from,10))||!validDay(text(p.to,10))||String(p.from)>String(p.to)||String(p.from)<'0001-01-02'||String(p.to)>'9998-12-31'||Date.parse(String(p.to))-Date.parse(String(p.from))>36600*86400000)throw bad();
 integer(y.fromYear,1,9998);integer(y.toYear,1,9998);if(y.scope!==undefined&&y.scope!=='all')throw bad();if(Number(y.toYear)<Number(y.fromYear)||Number(y.toYear)-Number(y.fromYear)>100)throw bad();
 if(typeof h.query!=='string'||h.query.length>200)throw bad();one(h.sort,['name','marketValue','unrealized']);one(h.direction,['asc','desc']);integer(h.page);
 one(c.mode,['current','historical']);one(c.category,['all','long','short','ipo']);one(c.drillMarket,['all','CN','HK','US']);one(c.sort,['name','net']);one(c.direction,['asc','desc']);integer(c.page);if(typeof c.localOpenOnly!=='boolean')throw bad();if(c.mode==='historical'&&c.localOpenOnly)throw new HomeReadError(422,'历史贡献不支持局部仅看未平仓');
 const normalized=structuredClone(value) as FullRequestV1;normalized.selection.assetTypes=[...new Set(normalized.selection.assetTypes)].sort();normalized.holdings.query=normalized.holdings.query.trim();return normalized;
}
export function fullHttp(db:DatabaseSync,operation:string,params:URLSearchParams):Response{
 const parse=(key:string)=>{const raw=params.get(key);if(!raw||raw.length>16000)throw bad();try{return JSON.parse(raw);}catch{throw bad();}};
 const store=new FullHomeStore(db),headers={'Cache-Control':'no-store'};
 const version=()=>text(parse('version'));
 if(operation==='evidence')return Response.json(store.evidence(version(),text(parse('key'),200)),{headers});
 if(operation==='search'){const query=parse('query');if(typeof query!=='string'||query.length>200)throw bad();return Response.json(store.search(version(),query),{headers});}
 if(operation==='detail'){
  const target=record(parse('target'));one(target.kind,['instrument','position','closeRound']);text(target.id);text(target.sourceContext);if(!Array.isArray(target.accountScope)||!target.accountScope.length||target.accountScope.length>100||target.accountScope.some(v=>typeof v!=='string'||!v||v==='all'))throw bad();const cursor=params.has('cursor')?parse('cursor'):0;integer(cursor,0);return Response.json(store.detail(version(),target as FullDetailTarget,Number(cursor)),{headers});
 }
 const request=parseFullRequest(parse('request'));
 if(operation==='full-export')return new Response('\ufeff'+store.export(request,version()),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=holdings.csv'}});
 let result=store.read(request,operation==='full'?(params.has('version')?version():undefined):version());
 if(params.get('evidence')==='inline')result=store.inline(result);
 if(operation==='full')return Response.json(result,{headers});
 return Response.json({schema:result.schema,releaseId:result.releaseId,selectionKey:result.selectionKey,queryArtifactId:result.queryArtifactId,evidenceTransport:result.evidenceTransport,...(result.sourceRefsByKey?{sourceRefsByKey:result.sourceRefsByKey}:{}),[operation]:operation==='history'?result.history:result.contribution},{headers});
}
