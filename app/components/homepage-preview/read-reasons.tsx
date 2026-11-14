'use client';
import {useEffect,useRef} from 'react';
import type {HomeView} from './display-contract';
import {missingDataNextStep} from './confirmed-subtotal';

/** A fixed-height summary keeps the page steady; the complete evidence stays readable. */
export function ReadReasons({reasons,view}:{reasons:readonly string[];view?:HomeView}) {
 const root=useRef<HTMLDetailsElement>(null),trigger=useRef<HTMLElement>(null),panel=useRef<HTMLElement>(null);
 const place=()=>{
  if(!root.current?.open||!trigger.current||!panel.current)return;
  const anchor=trigger.current.getBoundingClientRect(),box=panel.current.getBoundingClientRect(),margin=12;
  // Stable scrollbar gutters reserve layout width even when innerWidth/clientWidth include it.
  const viewportWidth=Math.min(window.innerWidth,document.documentElement.getBoundingClientRect().width||window.innerWidth);
  const preferred=anchor.top>=box.height+8?anchor.top-box.height-8:anchor.bottom+8;
  panel.current.style.top=`${Math.max(margin,Math.min(preferred,window.innerHeight-box.height-margin))}px`;
  panel.current.style.right=`${Math.max(margin,Math.min(viewportWidth-anchor.right,viewportWidth-box.width-margin))}px`;
 };
 const close=()=>{if(root.current)root.current.open=false;trigger.current?.focus();};
 useEffect(()=>{
  const outside=(event:MouseEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target)&&root.current)root.current.open=false;};
  document.addEventListener('click',outside);return()=>document.removeEventListener('click',outside);
 },[]);
 useEffect(()=>{
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[]);
 return <details ref={root} className="hp-read-reasons" onToggle={()=>{if(root.current?.open&&panel.current)panel.current.scrollTop=0;place();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <summary ref={trigger}>查看原因</summary>
  <section ref={panel} aria-label="数据缺失原因" className="hp-read-reasons-panel">
   <header><strong>数据缺失原因</strong><button type="button" aria-label="关闭原因说明" onClick={close}>关闭</button></header>
   <p>完整总额仍为未知。卡片中的“已确认小计”只包含可计算对象，各指标的覆盖范围可能不同。</p>
   <ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
   {view&&([['currentMarketValue','当前市值'],['net','期间净盈亏']] as const).map(([key,label])=>{
    const partial=view.metrics[key].partial;if(!partial||view.metrics[key].value!==null)return null;
    return <section key={key}><h4>{label}：{partial.coverage.available} / {partial.coverage.total} 项可计算</h4>
     {partial.missing.slice(0,3).map(item=><p key={`${item.accountId}/${item.code}`}><strong>{item.code}</strong> · {view.accounts.find(a=>a.id===item.accountId)?.name??item.accountId}<br/>{missingDataNextStep(item.reasons)}</p>)}
     <p>点击对应指标卡片，可查看小计原币、汇率与更多缺失对象。</p>
    </section>;
   })}
  </section>
 </details>;
}
