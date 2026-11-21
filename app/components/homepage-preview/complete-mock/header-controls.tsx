'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { HomeRequest, Scenario } from '../display-contract';
import { EMPTY_FILTERS, type AdditionalFilters, type MockInstrument, type OpenInstrument } from './contracts';

function trap(event:React.KeyboardEvent<HTMLElement>) {
  if(event.key!=='Tab')return;
  const all=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]'));
  const first=all[0],last=all.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
}
export function FilterChips({request,onChange}:{request:HomeRequest;onChange:(patch:Partial<HomeRequest>)=>void}) {
  const f=request.filters??EMPTY_FILTERS;
  const chips=[...f.assetTypes.map(value=>({label:value,remove:()=>({...f,assetTypes:f.assetTypes.filter(v=>v!==value)})})),...(f.openOnly?[{label:'仅看未平仓持仓',remove:()=>({...f,openOnly:false})}]:[]),...(f.review!=='all'?[{label:f.review==='pending'?'待复盘':'已复盘',remove:()=>({...f,review:'all' as const})}]:[])];
  return chips.length?<div className="hpm-filter-chips" aria-label="已应用附加条件">{chips.map(chip=><button key={chip.label} onClick={()=>onChange({filters:chip.remove()})} aria-label={`移除${chip.label}筛选`}>{chip.label}<X size={12}/></button>)}</div>:null;
}
export function HeaderControls({request,accounts,accountOptions=accounts,instruments,pending,error,onChange,onOpenInstrument,scenario='normal',onSearchOpenChange,onSearch,capabilities,detailOpen=false,initialSearch,onSearchContextChange}:{request:HomeRequest;accounts:{id:string;name:string;fullLabel?:string}[];accountOptions?:{id:string;name:string;fullLabel?:string}[];instruments:(Pick<MockInstrument,'id'|'name'|'code'|'exchange'|'currency'|'accountId'|'open'> & {assetType:string})[];pending:boolean;error:string|null;onChange:(patch:Partial<HomeRequest>)=>void;onOpenInstrument:OpenInstrument;scenario?:Scenario;onSearchOpenChange?:(open:boolean)=>void;onSearch?:(query:string,signal:AbortSignal)=>Promise<(Pick<MockInstrument,'id'|'name'|'code'|'exchange'|'currency'|'accountId'|'open'> & {assetType:string})[]>;initialSearch?:{query:string;open:boolean;selectedId?:string};onSearchContextChange?:(value:{query:string;open:boolean})=>void;detailOpen?:boolean;capabilities?:{globalOpenOnly:boolean;review:boolean;assetTypes:boolean;assetTypeValues?:string[];reasons:string[]}}) {
  const [accountOpen,setAccountOpen]=useState(false),[filtersOpen,setFiltersOpen]=useState(false),[searchOpen,setSearchOpen]=useState(false);
  const [draft,setDraft]=useState<AdditionalFilters>(request.filters??EMPTY_FILTERS),[submitted,setSubmitted]=useState(false);
  const [query,setQuery]=useState(''),[term,setTerm]=useState(''),[composing,setComposing]=useState(false),[searchFailed,setSearchFailed]=useState(false);
  useEffect(()=>{if(initialSearch){setQuery(initialSearch.query);setTerm(initialSearch.query.trim());setSearchOpen(initialSearch.open);onSearchOpenChange?.(initialSearch.open);}},[initialSearch]);
  useEffect(()=>{onSearchContextChange?.({query,open:searchOpen});},[query,searchOpen,onSearchContextChange]);
  const filterRef=useRef<HTMLDivElement>(null),accountRef=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLDivElement>(null), searchInput=useRef<HTMLInputElement>(null);
  const searchButton=useRef<HTMLButtonElement>(null),filterButton=useRef<HTMLButtonElement>(null),accountButton=useRef<HTMLButtonElement>(null);
  const scope=`${request.market}:${request.accountId}`;
  const [applied,setApplied]=useState({scope,filters:request.filters});
  const focusAfterApply=useRef(false);
  if(applied.scope!==scope||applied.filters!==request.filters){
    setApplied({scope,filters:request.filters});setDraft(request.filters??EMPTY_FILTERS);setFiltersOpen(false);setSubmitted(false);
  }
  useEffect(()=>{if(focusAfterApply.current){focusAfterApply.current=false;filterButton.current?.focus();}},[request.filters]);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(filterRef.current&&!filterRef.current.contains(e.target as Node)){setFiltersOpen(false);}if(accountRef.current&&!accountRef.current.contains(e.target as Node))setAccountOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  useEffect(()=>{if(!searchOpen)return;searchInput.current?.focus();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[searchOpen]);
  useEffect(()=>{if(composing)return;const timer=setTimeout(()=>{setTerm(query.trim());setSearchFailed(scenario==='partial'&&!!query.trim());},300);return()=>clearTimeout(timer);},[query,composing,scenario]);
  const closeSearch=()=>{setSearchOpen(false);onSearchOpenChange?.(false);requestAnimationFrame(()=>searchButton.current?.focus({preventScroll:true}));};
  const active=request.filters??EMPTY_FILTERS,count=active.assetTypes.length+Number(active.openOnly)+Number(active.review!=='all');
  const [remoteResults,setRemoteResults]=useState<typeof instruments>([]),[searchLoading,setSearchLoading]=useState(false),[searchRetry,setSearchRetry]=useState(0);
  useEffect(()=>{if(!onSearch||!term||!searchOpen)return;const c=new AbortController();setRemoteResults([]);setSearchFailed(false);setSearchLoading(true);onSearch(term,c.signal).then(items=>{if(!c.signal.aborted)setRemoteResults(items);}).catch(()=>{if(!c.signal.aborted)setSearchFailed(true);}).finally(()=>{if(!c.signal.aborted)setSearchLoading(false);});return()=>c.abort();},[term,onSearch,searchRetry,searchOpen]);
  useEffect(()=>{if(initialSearch?.selectedId&&remoteResults.length)Array.from(searchRef.current?.querySelectorAll<HTMLElement>('[data-home-object]')??[]).find(element=>element.dataset.homeObject===initialSearch.selectedId)?.focus({preventScroll:true});},[remoteResults,initialSearch]);
  const results=onSearch?remoteResults:term?instruments.filter(row=>`${row.name} ${row.code} ${row.exchange}`.toLowerCase().includes(term.toLowerCase())):[];
  const account=accounts.find(a=>a.id===request.accountId)??accounts[0];
  return <>
    <div className="hpm-header-controls">
      <div className="hpm-account" ref={accountRef} onKeyDown={e=>{
        if(e.key==='Escape'){setAccountOpen(false);accountButton.current?.focus();}
        if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
          e.preventDefault();setAccountOpen(true);
          requestAnimationFrame(()=>{
            const options=Array.from(accountRef.current?.querySelectorAll<HTMLElement>('[role=option]')??[]),at=options.indexOf(document.activeElement as HTMLElement);
            const next=e.key==='Home'?0:e.key==='End'?options.length-1:e.key==='ArrowUp'?(at<=0?options.length-1:at-1):(at+1)%options.length;
            options[next]?.focus();
          });
        }
      }}>
        <button ref={accountButton} type="button" className="hpm-account-trigger" aria-label={account?.fullLabel?`实盘账户 · ${account.fullLabel}`:'实盘账户'} aria-haspopup="listbox" aria-expanded={accountOpen} title={account?.fullLabel??account?.name} onClick={()=>{setAccountOpen(v=>!v);setFiltersOpen(false);}}><span>{account?.name}</span><ChevronDown size={16}/></button>
        {accountOpen&&<div className="hpm-account-options" role="listbox" aria-label="选择实盘账户">{accountOptions.map(a=><button type="button" role="option" aria-selected={request.accountId===a.id} key={a.id} aria-label={a.fullLabel} title={a.fullLabel??`${a.name} · ${a.id}`} onClick={()=>{setAccountOpen(false);setFiltersOpen(false);setDraft(active);onChange({accountId:a.id});accountButton.current?.focus();}}><span>{a.name}</span>{request.accountId===a.id?<Check size={14}/>:<i/>}</button>)}</div>}
      </div>
      <button type="button" className="hpm-icon" ref={searchButton} aria-label="全局标的搜索" onClick={()=>{setSearchOpen(true);onSearchOpenChange?.(true);setFiltersOpen(false);setAccountOpen(false);}}><Search size={18}/></button>
      <div className="hpm-filter-anchor" ref={filterRef}>
        <button type="button" className="hpm-icon" ref={filterButton} aria-label="附加筛选" aria-expanded={filtersOpen} onClick={()=>{setFiltersOpen(v=>!v);setAccountOpen(false);}}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v8l-4-2v-6z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>{count>0&&<span className="hpm-filter-count">{count}</span>}</button>
        {filtersOpen&&<div className="hpm-filter-panel" role="dialog" aria-label="附加筛选" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setFiltersOpen(false);filterButton.current?.focus();}}}>
          <fieldset><legend>标的类别</legend>{['股票','ETF','基金'].map(type=><label key={type} title={capabilities?.assetTypeValues&&!capabilities.assetTypeValues.includes(type)?'该分类暂无来源定义，暂不可用':undefined}><input type="checkbox" disabled={!!capabilities&&(!capabilities.assetTypes||!!capabilities.assetTypeValues&&!capabilities.assetTypeValues.includes(type))} checked={draft.assetTypes.includes(type)} onChange={e=>setDraft({...draft,assetTypes:e.target.checked?[...draft.assetTypes,type]:draft.assetTypes.filter(v=>v!==type)})}/>{type}</label>)}</fieldset>
          {capabilities?.assetTypeValues&&!capabilities.assetTypeValues.includes('基金')&&<p>基金分类暂无来源定义，暂不可用</p>}<fieldset><legend>持仓范围</legend><label><input type="checkbox" disabled={capabilities&&!capabilities.globalOpenOnly} checked={draft.openOnly} onChange={e=>setDraft({...draft,openOnly:e.target.checked})}/>仅看未平仓持仓</label></fieldset>
          <fieldset><legend>是否待复盘</legend>{(['pending','done'] as const).map(value=><label key={value}><input type="checkbox" disabled={capabilities&&!capabilities.review} checked={draft.review==='all'||draft.review===value} onChange={e=>setDraft({...draft,review:e.target.checked?'all':value==='pending'?'done':'pending'})}/>{value==='pending'?'待复盘':'已复盘'}</label>)}</fieldset>
          {capabilities&&(!capabilities.assetTypes||!capabilities.review||!capabilities.globalOpenOnly)&&<p>{capabilities.reasons.join("；")||"部分筛选缺少来源证据，暂不可用"}</p>}{error&&submitted&&<p role="alert" className="hpm-error">筛选未应用，请重试。原结果已保留。</p>}
          <div className="hpm-filter-actions"><button type="button" className="hpm-primary" disabled={pending} aria-label="应用筛选" onClick={()=>{focusAfterApply.current=true;setSubmitted(true);onChange({filters:{...draft,assetTypes:[...draft.assetTypes]}});}}>应用</button><button type="button" onClick={()=>setDraft({...EMPTY_FILTERS,assetTypes:[]})}>清除附加条件</button></div>
          <button type="button" className="hpm-filter-reset" disabled={pending} onClick={()=>{focusAfterApply.current=true;setSubmitted(true);setDraft({...EMPTY_FILTERS,assetTypes:[]});onChange({market:'all',accountId:'all',filters:{...EMPTY_FILTERS,assetTypes:[]}});}}>恢复全部默认</button>
        </div>}
      </div>
    </div>
    {searchOpen&&createPortal(<div className="hp-preview hpm-search-backdrop" inert={detailOpen} aria-hidden={detailOpen||undefined} onPointerDown={e=>{if(e.target===e.currentTarget)closeSearch();}}><div ref={searchRef} role="dialog" aria-modal="true" aria-label="全局标的搜索" className="hpm-search-dialog" onKeyDown={e=>{
      trap(e);
      if(e.key==='Escape'){e.preventDefault();closeSearch();}
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();const options=Array.from(searchRef.current?.querySelectorAll<HTMLButtonElement>('.hpm-search-result')??[]),at=options.indexOf(document.activeElement as HTMLButtonElement);
        const next=e.key==='ArrowDown'?(at+1)%options.length:at<=0?options.length-1:at-1;options[next]?.focus();options[next]?.scrollIntoView({block:'nearest'});
      }
      if(e.key==='Enter'&&e.target===searchInput.current){e.preventDefault();searchRef.current?.querySelector<HTMLButtonElement>('.hpm-search-result')?.click();}
    }}>
      <header><h2>找到标的</h2><button type="button" className="hpm-icon" aria-label="关闭全局搜索" onClick={closeSearch}><X size={18}/></button></header>
      <label className="hpm-search-input"><Search size={18}/><input ref={searchInput} type="search" aria-label="搜索全部标的" placeholder="搜索名称、代码或交易所" value={query} onChange={e=>setQuery(e.target.value)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQuery(e.currentTarget.value);}}/>{query&&<button type="button" aria-label="清除全局搜索" onClick={()=>{setQuery('');setTerm('');searchInput.current?.focus();}}><X size={16}/></button>}</label>
      <div className="hpm-search-results" aria-live="polite">{!term?<p>输入名称或代码查找标的</p>:searchLoading?<p>正在搜索…</p>:searchFailed?<div className="hpm-search-state" role="alert">暂时无法读取标的<button type="button" onClick={()=>{setSearchFailed(false);setSearchRetry(v=>v+1);}}>重试搜索</button></div>:!results.length?<p>没有匹配的标的</p>:results.map(row=><button type="button" key={row.id} data-home-object={row.id} className="hpm-search-result" aria-label={`${row.name} ${row.code} ${row.exchange} ${row.currency} ${row.assetType} ${row.open?'未平仓':'已平仓'}${accounts.find(a=>a.id===row.accountId)?.fullLabel?' · '+accounts.find(a=>a.id===row.accountId)?.fullLabel:''}`} onClick={e=>onOpenInstrument(row.id,e.currentTarget)}><span><strong>{row.name}</strong><small>{row.exchange}:{row.code}</small></span><span>{row.currency} · {row.assetType}<small title={accounts.find(a=>a.id===row.accountId)?.fullLabel}>{row.open?'未平仓':'已平仓'} · {accounts.find(a=>a.id===row.accountId)?.name??row.accountId}</small></span></button>)}</div>
      <p className="hpm-search-hint">输入框内 × 清空查询 · 关闭退出搜索 · ↑ ↓ 选择 · Enter 查看 · Esc 关闭</p>
    </div></div>,document.body)}
  </>;
}
