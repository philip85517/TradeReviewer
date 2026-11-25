'use client';
import {useEffect,useRef,useState,useCallback,useMemo} from 'react';
import {missingReasonText} from './missing-reasons';
import {Settings2} from 'lucide-react';
import type {Period} from './display-contract';
import type {FullDetail,FullCatalogItem} from '../../lib/home/full-contracts';
import {fullRead,searchFull,detailFull,fullPositionTarget,fullLibraryParameters,type FullLibrarySource} from './full-client';
import {useFullHome,fullHomeRequest,FULL_CONTEXT_KEY} from './full-state';
import {MetricCards} from './metric-cards';
import {PerformanceChart} from './performance-chart';
import {PeriodSelector} from './period-selector';
import {Holdings} from './holdings';
import {HeaderControls,FilterChips} from './complete-mock/header-controls';
import {FullHistoryPanel} from './full-history';
import {FullContributionPanel} from './full-contribution';
import {FullDetailPanel} from './full-detail';
import './homepage-preview.css';
import './complete-mock/full-mock.css';
import './business-pairing-confirmation.css';
const NAV=[['交易库','M5 3h14v18H5zM8 7h8M8 11h8M8 15h5'],['分析','M3 3v18h18M6 16l5-6 4 3 6-8'],['数据','M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0zM3 6c0 4 18 4 18 0M3 12c0 4 18 4 18 0'],['策略','M6 3v18M6 7h8a4 4 0 0 1 4 4v6M15 14l3 3 3-3']];
function Icon({path}:{path:string}){return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
function accountDisplayLabels(source:{id:string;name:string}[]){
 return source.map(account=>{
  const same=source.filter(other=>other.name===account.name);
  if(same.length<2)return {...account,fullLabel:undefined};
  const identifier=(id:string)=>id.slice(id.indexOf(':')+1),value=identifier(account.id);
  let compact=value;
  if(value.length>8){
   const peers=same.filter(other=>other.id!==account.id).map(other=>identifier(other.id));
   const prefix=Math.max(0,...peers.map(peer=>{let n=0;while(n<value.length&&n<peer.length&&value[n]===peer[n])n++;return n;}));
   const start=Math.max(0,prefix-1);let end=Math.min(value.length,prefix+1);
   while(end<value.length&&peers.some(peer=>peer.slice(start,end)===value.slice(start,end)))end++;
   compact=peers.some(peer=>peer.slice(start,end)===value.slice(start,end))?account.id:value.slice(start,end)+(end<value.length?'…':'');
  }
  return {...account,name:`${account.name.replace(/[（(].*$/,'').trim()} · ${compact}`,fullLabel:`${account.name} · ${account.id}`};
 }).map((account,_,labels)=>labels.some(other=>other.id!==account.id&&other.name===account.name)?{...account,name:`${source.find(original=>original.id===account.id)!.name.replace(/[（(].*$/,'').trim()} · ${account.id}`}:account);
}
export function FullHomepage() {
 const state=useFullHome(),{result,pending,error,change}=state,view=result?.core??null,request=useMemo(()=>fullHomeRequest(state.request),[state.request]);
 const unavailableReason=!view&&!pending?'首页尚未就绪，暂无可用的已发布结果':undefined;
 const accounts=useMemo(()=>accountDisplayLabels(view?.accounts??[{id:'all',name:'全部实盘账户'}]),[view?.accounts]);
 const marketAccounts=accounts.filter(a=>a.id==='all'||!result||result.request.selection.market==='all'||result.accountIdsByMarket[result.request.selection.market].includes(a.id));
 const marketPending=state.marketPending;
 const [slowPending,setSlowPending]=useState(false);
 useEffect(()=>{if(!pending){setSlowPending(false);return;}const timer=setTimeout(()=>setSlowPending(true),500);return()=>clearTimeout(timer);},[pending]);
 const searchContext=useRef({query:'',open:false});const [restoredSearch,setRestoredSearch]=useState<{query:string;open:boolean;selectedId?:string}>();
 useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem(FULL_CONTEXT_KEY)??'null');if(saved?.search)setRestoredSearch(saved.search);}catch{}},[]);
 const [searchOpen,setSearchOpen]=useState(false),[periodOpen,setPeriodOpen]=useState(false),[draft,setDraft]=useState({from:request.period.from,to:request.period.to});
 const [query,setQuery]=useState(''),composing=useRef(false),typed=useRef(false),[compositionEnd,setCompositionEnd]=useState(0);
 useEffect(()=>{setQuery(request.query);},[request.query]);
 const [detail,setDetail]=useState<FullDetail|null>(null),[detailPending,setDetailPending]=useState(false),[detailError,setDetailError]=useState<string|null>(null),detailControl=useRef<AbortController|null>(null),origin=useRef<{trigger:HTMLElement;scroll:number;librarySource:FullLibrarySource}|null>(null);
 useEffect(()=>{if(!typed.current||composing.current||detail||detailPending||searchOpen||query===request.query)return;const timer=setTimeout(()=>{typed.current=false;change({query});},300);return()=>clearTimeout(timer);},[query,request.query,change,compositionEnd,detail,detailPending,searchOpen]);
 const searchItems=useRef(new Map<string,FullCatalogItem>());
 useEffect(()=>{searchItems.current.clear();},[result?.releaseId]);
 const search=useCallback(async(query:string,signal:AbortSignal)=>{if(!result)return [];const value=await searchFull(result.releaseId,query,signal);for(const item of value.items)searchItems.current.set(item.id,item);return value.items.map(item=>({...item,assetType:item.assetType==='stock'?'股票':item.assetType==='etf'?'ETF':item.assetType??'未知'}));},[result?.releaseId]);
 const openDetail=async(id:string,trigger:HTMLElement,librarySource:FullLibrarySource='current')=>{if(!result)return;detailControl.current?.abort();const c=new AbortController();detailControl.current=c;trigger.dataset.homeObject=id;origin.current={trigger,scroll:window.scrollY,librarySource};setDetailPending(true);setDetailError(null);try{const item=searchItems.current.get(id)??result.core.holdings.rows.find(item=>item.id===id)??result.contribution.rows.find(item=>item.id===id);if(!item)throw new Error('当前版本没有该对象，请重新读取首页');const d=await detailFull(result.releaseId,fullPositionTarget(item,result.request),c.signal);if(!c.signal.aborted)setDetail(d);}catch(e){if(!c.signal.aborted)setDetailError(e instanceof Error?e.message:'详情读取失败');}finally{if(!c.signal.aborted)setDetailPending(false);}};
 const closeDetail=()=>{detailControl.current?.abort();setDetail(null);setDetailPending(false);const saved=origin.current;requestAnimationFrame(()=>{if(saved){window.scrollTo(0,saved.scroll);const search=document.querySelector('.hpm-search-dialog');const target=search?Array.from(search.querySelectorAll<HTMLElement>('[data-home-object]')).find(e=>e.dataset.homeObject===saved.trigger.dataset.homeObject)??search.querySelector<HTMLElement>('input'):saved.trigger.isConnected?saved.trigger:document.querySelector<HTMLElement>(saved.trigger.closest('.hp-contribution')?'#contribution-heading':'#holdings-heading');target?.focus({preventScroll:true});}});};
 const openLibrary=(trigger:HTMLElement,id?:string,date?:string)=>{if(!result)return;const item=detail?.items.find(i=>i.id===id);const accounts=item?[item.accountId]:result.request.selection.accountId==='all'?marketAccounts.filter(a=>a.id!=='all').map(a=>a.id):[result.request.selection.accountId];sessionStorage.setItem(FULL_CONTEXT_KEY,JSON.stringify({request:result.request,memories:state.memories.current,scroll:origin.current&&detail?origin.current.scroll:window.scrollY,search:{...searchContext.current,selectedId:searchContext.current.open?id:undefined},focus:{id:(detail?origin.current?.trigger:trigger)?.dataset.homeObject,label:(detail?origin.current?.trigger:trigger)?.getAttribute('aria-label')??(detail?origin.current?.trigger:trigger)?.textContent,source:(detail?origin.current?.trigger:trigger)?.closest('.hp-contribution')?'contribution-heading':(detail?origin.current?.trigger:trigger)?.closest('.hp-holdings')?'holdings-heading':'performance-heading'}}));const params=fullLibraryParameters(result.request,accounts,item,date,detail?origin.current?.librarySource:undefined);window.location.assign(`/trades?${params}`);};
 const exported=async()=>{if(!result)return;try{const csv=await fullRead<string>('full-export',{request:result.request,version:result.releaseId});const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='holdings.csv';a.click();URL.revokeObjectURL(url);}catch(e){setDetailError(e instanceof Error?e.message:'导出失败');}};
 useEffect(()=>{if(!result)return;try{const saved=JSON.parse(sessionStorage.getItem(FULL_CONTEXT_KEY)??'null');if(saved?.scroll!==undefined){requestAnimationFrame(()=>{window.scrollTo(0,saved.scroll);const controls=Array.from(document.querySelectorAll<HTMLElement>('button,a'));const focus=saved.focus;const match=controls.find(e=>focus?.id?e.dataset.homeObject===focus.id:(e.getAttribute('aria-label')??e.textContent)===(focus?.label??focus));(match??document.getElementById(focus?.source??'performance-heading'))?.focus({preventScroll:true});});sessionStorage.removeItem(FULL_CONTEXT_KEY);}}catch{}},[result]);
 const missingReasons=result?[...result.core.reasons,...result.history.coverage.reasons,...result.contribution.coverage.reasons]:[];
 const missingText=missingReasonText(missingReasons);
 const today=result?.manifest.businessDate??request.period.to,range=state.request.historyRange;
 const applyPeriod=(period:Period)=>{setPeriodOpen(false);change({period});};
  return <div className="hp-preview hpm-complete" data-home-source="real" data-home-ready={!!view} data-home-version={result?.releaseId} data-home-pending={pending}>
    <div className="hp-canvas" inert={!!detail||searchOpen}>
      <nav className="hp-nav" aria-label="主导航"><a className="hpm-brand" href="/home" aria-label="TradeReview 首页"><span>TR</span></a><a className="hp-nav-item hp-nav-current" href="#performance-heading" aria-current="page" aria-label="首页"><Icon path="M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9"/><span>首页</span></a>{NAV.map(([label,path],index)=><button type="button" key={label}  className="hp-nav-item" disabled={index!==0} aria-label={index===0?'交易库':`${label}，尚未开放`} onClick={e=>openLibrary(e.currentTarget)}><Icon path={path}/><span>{label}</span></button>)}<button className="hp-nav-item hp-nav-settings" aria-label="设置，尚未开放" disabled><Settings2 size={24} strokeWidth={1.5}/><span>设置</span></button></nav>
      <div className="hp-workspace"><header className="hp-page-header"><h1>我的交易室</h1><div className="hp-scope" aria-label="市场范围">{([['all','全部'],['CN','A股'],['HK','港股'],['US','美股']] as const).map(([market,label])=><button type="button" key={market} aria-pressed={request.market===market} onClick={()=>state.change({market})}>{label}</button>)}</div><HeaderControls request={request} accounts={accounts} accountOptions={marketAccounts} instruments={[]} onSearch={search} detailOpen={!!detail} initialSearch={restoredSearch} onSearchContextChange={value=>{searchContext.current=value;}} capabilities={result?{...result.capabilities,assetTypeValues:['股票','ETF']}:undefined} pending={pending} error={error}  onChange={state.change} onOpenInstrument={openDetail} onSearchOpenChange={setSearchOpen}/><time className="hpm-updated" dateTime={result?.manifest.asOf}>{result?new Date(result.manifest.asOf).toLocaleTimeString("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit"})+" 更新":""}</time></header>
      <main className="hp-main"><FilterChips request={request} onChange={state.change}/><section className="hp-performance" aria-labelledby="performance-heading"><div className="hp-section-toolbar"><h2 id="performance-heading" tabIndex={-1}>当前表现</h2><PeriodSelector applied={request.period} draft={draft} open={periodOpen} pending={pending} error={null} today={today} allRange={view?.dataRange??null} onDraftChange={setDraft} onOpenChange={open=>{if(open)setDraft({from:request.period.from,to:request.period.to});setPeriodOpen(open);}} onApply={applyPeriod}/></div>
        {view?<MetricCards view={view} status={{kind:'ready'}}/>:<MetricCards view={null} placeholderCurrency="CNY" status={pending?{kind:'pending',reason:'读取中'}:{kind:'error',reason:unavailableReason!}}/>}
        <PerformanceChart interactionKey={JSON.stringify([request.market,request.accountId,request.period,request.filters])} series={view?.series??null} reportCurrency="CNY" onOpenDateTrades={(date,trigger)=>openLibrary(trigger,undefined,date)} unavailableReason={!view?(pending?'图表加载中…':'首页尚未就绪，图表暂不可用'):undefined}/>
      </section>
      <div className="hp-read-status" aria-live="polite" aria-busy={pending||state.repairing}>{pending&&(!view||slowPending)&&<div role="status" className={marketPending?'hp-performance-chart__sr-only':undefined}><span>{view?'更新中，仍显示上次完整结果':'正在读取首页完整结果…'}</span><button onClick={state.cancel}>取消读取</button></div>}{(!pending||marketPending)&&(error||!!missingText||state.repairMessage)&&<div className={error?'hp-read-error':state.repairing?'':'hp-read-warning'}><span>{error?`${view?'新选择未应用，仍显示原范围。':'首页暂不可用。'}${error}`:state.repairMessage??`仍缺${missingText}，未知值不计作零。`}</span>{view&&missingText?<button onClick={()=>void state.repair()} disabled={pending||state.repairing}>{state.repairing?'后台处理中':'一键修复'}</button>:<button onClick={state.reload}>重新读取</button>}</div>}</div>
      <Holdings view={view} query={query} onQuery={value=>{typed.current=true;setQuery(value);}} onComposition={value=>{composing.current=value;if(!value)setCompositionEnd(n=>n+1);}} onChange={state.change} onDetail={openDetail} onExport={exported} pending={pending} unavailableReason={unavailableReason}/>
      {result&&<><FullHistoryPanel request={request} range={range} history={result.history} today={today} firstYear={result.historyBounds.fromYear} onRangeChange={historyRange=>state.load({...result.request,historyRange})}/><FullContributionPanel request={request} historyRange={range} currentNet={view?.metrics.net??null} data={result.contribution} selection={result.request.contribution} onSelection={state.contribution} onMarketChange={market=>state.change({market})} onOpenInstrument={(id,trigger)=>openDetail(id,trigger,result.request.contribution.mode==='historical'?'historical-contribution':'current')}/></>}
      {!result&&<><section className="hp-history" aria-busy={pending} aria-label={pending?"历史统计加载中":"历史统计暂不可用"}><div className="hp-history-heading"><h2>历史已平仓</h2></div><div className="hp-history-metrics">{['已平仓净盈亏','已平仓回合','范围胜率','费用（已扣除）'].map(label=><div key={label} className="hp-history-card"><span>{label}</span><strong>—</strong></div>)}</div><div className="hp-history-chart">{!pending&&<p className="hp-history-empty">尚未就绪，历史统计暂不可用</p>}</div></section><section className="hp-contribution" aria-busy={pending} aria-label={pending?"贡献加载中":"贡献暂不可用"} style={{minHeight:620}}><div className="hp-contrib-heading"><h2>当前期间贡献</h2></div>{!pending&&<div className="hp-contrib-feedback">尚未就绪，贡献暂不可用</div>}</section></>}
      </main></div>
    </div>
    {(detailPending||detailError)&&<div className="hp-read-status" role="status">{detailPending?'正在读取详情…':detailError}<button onClick={()=>{detailControl.current?.abort();setDetailPending(false);setDetailError(null);}}>关闭</button></div>}
    {detail&&<FullDetailPanel detail={detail} accountName={(()=>{const a=accounts.find(a=>a.id===detail.items[0]?.accountId);return a?.fullLabel??a?.name;})()} onClose={closeDetail} onPairingSaved={()=>void state.followPublication()} onLibrary={trigger=>openLibrary(trigger,detail.items[0]?.id)}/>}
  </div>;
}
