'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FlaskConical, Settings2 } from 'lucide-react';
import { createCompleteMockSource, mockInstruments } from './mock-source';
import type { HomepageSource, Period, Scenario } from '../display-contract';
import type { HistoryRange } from './contracts';
import { DEFAULT_REQUEST, SCENARIOS, TODAY } from '../mock-source';
import { parseLocation } from '../location-state';
import { useHomepagePreview } from '../use-homepage-preview';
import { MetricCards } from '../metric-cards';
import { PerformanceChart } from '../performance-chart';
import { PeriodSelector } from '../period-selector';
import { Holdings } from '../holdings';
import { HoldingDetailPanel } from '../holding-detail';
import { HeaderControls, FilterChips } from './header-controls';
import { HistoricalStatistics } from './historical-statistics';
import { ContributionPanel } from './contribution-panel';
import { MockLibrary } from './mock-library';
import '../homepage-preview.css';
import './full-mock.css';
const NAV=[['交易库','M5 3h14v18H5zM8 7h8M8 11h8M8 15h5'],['分析','M3 3v18h18M6 16l5-6 4 3 6-8'],['数据','M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0zM3 6c0 4 18 4 18 0M3 12c0 4 18 4 18 0'],['策略','M6 3v18M6 7h8a4 4 0 0 1 4 4v6M15 14l3 3 3-3']];
function Icon({path}:{path:string}){return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;}
export function FullMockHomepage() {
  const [override,setScenario]=useState<Scenario|null>(null);
  const linked=useSyncExternalStore(callback=>{const pop=()=>{setScenario(null);callback();};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},()=>parseLocation(window.location.search).scenario,()=>'normal' as Scenario);
  const scenario=override??linked;
  const [delay,setDelay]=useState(30),[willFail,setWillFail]=useState(false),[searchOpen,setSearchOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false);
  const fail=useRef(false),source=useMemo(()=>createCompleteMockSource(scenario,delay),[scenario,delay]);
  const controlled=useMemo<HomepageSource>(()=>({...source,readHome:(request,signal)=>{if(fail.current){fail.current=false;setWillFail(false);return Promise.reject(new Error('读取失败，请重试'));}return source.readHome(request,signal);}}),[source]);
  const state=useHomepagePreview(controlled,scenario),{view,pending,showPending,error,change}=state;
  const request=view?.request??DEFAULT_REQUEST,instruments=useMemo(()=>mockInstruments(scenario),[scenario]);
  const [range,setRange]=useState<HistoryRange>({fromYear:2026,toYear:2026});
  const [periodOpen,setPeriodOpen]=useState(false),[draft,setDraft]=useState({from:request.period.from,to:request.period.to});
  const [queryState,setQueryState]=useState({applied:request.query,value:request.query}),composing=useRef(false),typed=useRef(false);
  const [compositionEnd,setCompositionEnd]=useState(0);
  if(queryState.applied!==request.query)setQueryState({applied:request.query,value:request.query});
  useEffect(()=>{if(pending||state.detail||!typed.current||composing.current||queryState.value===request.query)return;const timer=setTimeout(()=>{typed.current=false;change({query:queryState.value});},300);return()=>clearTimeout(timer);},[queryState.value,request.query,pending,state.detail,change,compositionEnd]);
  const [library,setLibrary]=useState<{id?:string;date?:string;trigger:HTMLElement;scroll:number}|null>(null);
  const libraryButton=useRef<HTMLButtonElement>(null);
  const openLibrary=(trigger:HTMLElement,id?:string,date?:string)=>{setLibrary({id,date,trigger,scroll:window.scrollY});const url=new URL(window.location.href);url.searchParams.set('workspace','library');if(id)url.searchParams.set('instrument',id);if(date)url.searchParams.set('tradeDate',date);window.history.pushState(null,'',url);};
  const returnLibrary=()=>{if(!library)return;const saved=library;setLibrary(null);window.history.back();requestAnimationFrame(()=>{window.scrollTo(0,saved.scroll);if(saved.trigger.isConnected)saved.trigger.focus({preventScroll:true});});};
  useEffect(()=>{const pop=()=>{if(!new URLSearchParams(window.location.search).has('workspace'))setLibrary(null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{if(!library)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';requestAnimationFrame(()=>document.querySelector<HTMLElement>('.hpm-library button')?.focus());return()=>{document.body.style.overflow=before;};},[library]);
  const applyPeriod=(period:Period)=>{setPeriodOpen(false);state.change({period});};
  return <div className="hp-preview hpm-complete" data-home-ready={!!view} data-home-version={view?.stamp.version} data-home-pending={pending}>
    <div className="hp-canvas" inert={!!state.detail||searchOpen||!!library}>
      <nav className="hp-nav" aria-label="主导航"><button className="hpm-brand" aria-label="Mock 预览工具" onClick={()=>setToolsOpen(v=>!v)}><span>TR</span><small>Mock</small></button><a className="hp-nav-item hp-nav-current" href="#performance-heading" aria-current="page" aria-label="首页"><Icon path="M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9"/><span>首页</span></a>{NAV.map(([label,path],index)=><button type="button" key={label} ref={index===0?libraryButton:undefined} className="hp-nav-item" disabled={index!==0} aria-label={index===0?'交易库':`${label}，尚未开放`} onClick={e=>openLibrary(e.currentTarget)}><Icon path={path}/><span>{label}</span></button>)}<button className="hp-nav-item hp-nav-settings" aria-label="设置，尚未开放" disabled><Settings2 size={24} strokeWidth={1.5}/><span>设置</span></button></nav>
      <div className="hp-workspace"><header className="hp-page-header"><h1>我的交易室</h1><div className="hp-scope" aria-label="市场范围">{([['all','全部'],['CN','A股'],['HK','港股'],['US','美股']] as const).map(([market,label])=><button type="button" key={market} aria-pressed={request.market===market} onClick={()=>state.change({market})}>{label}</button>)}</div><HeaderControls request={request} accounts={view?.accounts??[{id:'all',name:'全部实盘账户'}]} instruments={instruments} pending={pending} error={error} scenario={scenario} onChange={state.change} onOpenInstrument={state.openHolding} onSearchOpenChange={setSearchOpen}/><time className="hpm-updated" dateTime="2026-10-15T16:32:00+08:00">16:32 更新</time></header>
      <main className="hp-main"><FilterChips request={request} onChange={state.change}/><section className="hp-performance" aria-labelledby="performance-heading"><div className="hp-section-toolbar"><h2 id="performance-heading">当前表现</h2><PeriodSelector applied={request.period} draft={draft} open={periodOpen} pending={pending} error={null} today={TODAY} allRange={{from:'2024-01-01',to:TODAY}} onDraftChange={setDraft} onOpenChange={open=>{if(open)setDraft({from:request.period.from,to:request.period.to});setPeriodOpen(open);}} onApply={applyPeriod}/></div>
        {view?<MetricCards view={view} status={showPending?{kind:'pending',reason:'更新中，仍显示上次完整结果'}:{kind:'ready'}}/>:<MetricCards view={null} placeholderCurrency="CNY" status={{kind:'pending',reason:'读取中'}}/>}
        <PerformanceChart interactionKey={JSON.stringify([request.market,request.accountId,request.period,request.filters])} series={view?.series??null} reportCurrency="CNY" onOpenDateTrades={(date,trigger)=>openLibrary(trigger,undefined,date)} unavailableReason={!view?'图表加载中…':undefined}/>
      </section>
      <div className="hp-read-status" aria-live="polite" aria-busy={pending}>{showPending&&<div><span>更新中，仍显示上次完整结果</span><button onClick={state.cancel}>取消读取</button></div>}{!pending&&(error||!!view?.reasons.length)&&<div className={error?'hp-read-error':'hp-read-warning'}><span>{error?'新选择未应用，仍显示原范围。读取失败，请重试。':'部分行情缺失，未知值不计作零。'}</span><button onClick={state.reload}>重新读取</button></div>}</div>
      <Holdings view={view} query={queryState.value} onQuery={value=>{typed.current=true;setQueryState({applied:request.query,value});}} onComposition={value=>{composing.current=value;if(!value)setCompositionEnd(n=>n+1);}} onChange={state.change} onDetail={state.openHolding} onExport={state.exportCSV} pending={pending}/>
      <HistoricalStatistics request={request} scenario={scenario} range={range} onRangeChange={setRange}/>
      <ContributionPanel request={request} scenario={scenario} historyRange={range} currentNet={view?.metrics.net??null} currentRealized={view?.metrics.periodRealized??null} currentFloating={view?.metrics.unrealizedChange??null} instruments={instruments} onOpenInstrument={state.openHolding}/>
      </main></div>
    </div>
    {toolsOpen&&!state.detail&&!searchOpen&&!library&&<aside className="hpm-tools" aria-label="Mock 预览设置"><header><FlaskConical size={16}/><strong>Mock 展示快照</strong><button aria-label="关闭 Mock 预览工具" onClick={()=>setToolsOpen(false)}>×</button></header><label>场景<select aria-label="Mock 场景" value={scenario} onChange={e=>setScenario(e.target.value as Scenario)}>{SCENARIOS.map(s=><option key={s}>{s}</option>)}</select></label><label>读取延迟<select aria-label="读取延迟" value={delay} onChange={e=>setDelay(Number(e.target.value))}><option value={30}>正常</option><option value={3000}>3秒</option><option value={16000}>16秒（超时）</option></select></label><button onClick={()=>{fail.current=true;setWillFail(true);}}>下一次切换失败{willFail?'（已设置）':''}</button><p>仅验证前端展现、接口边界和交互。真实数据及后端性能另行验收。</p></aside>}
    {state.detail&&<HoldingDetailPanel detail={state.detail} trades={null} pending={pending} error={error} onClose={state.close} onTrades={()=>openLibrary(document.activeElement as HTMLElement,state.detail?.holding.id)} onBack={state.backToDetail} onCancel={state.cancel} accountName={view?.accounts.find(a=>a.id===state.detail?.holding.accountId)?.name}/>}
    {library&&<MockLibrary request={request} instruments={instruments} instrumentId={library.id} tradeDate={library.date} onReturn={returnLibrary}/>}
  </div>;
}
