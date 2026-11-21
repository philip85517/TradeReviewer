'use client';
import { ArrowLeft } from 'lucide-react';
import type { HomeRequest } from '../display-contract';
import type { MockInstrument } from './contracts';
import { matchesScope } from './mock-source';
export function MockLibrary({request,instruments,instrumentId,tradeDate,onReturn}:{request:HomeRequest;instruments:MockInstrument[];instrumentId?:string;tradeDate?:string;onReturn:()=>void}) {
  const inRange=(date:string)=>date>=(tradeDate??request.period.from)&&date<=(tradeDate??request.period.to);
  const candidates=instrumentId?instruments.filter(row=>row.id===instrumentId):instruments.filter(row=>matchesScope(row,request));
  const rows=candidates.filter(row=>inRange('2026-03-02')||(!row.open&&inRange('2026-08-12')));
  return <section className="hpm-library" role="dialog" aria-modal="true" aria-label="Mock 实盘交易库" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onReturn();}if(e.key==='Tab'){e.preventDefault();e.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();}}}>
    <header><button type="button" className="hpm-icon" onClick={onReturn} aria-label="返回首页"><ArrowLeft size={20}/></button><h1>交易库</h1><span className="hpm-fixture-badge">Mock</span></header>
    <main><div className="hpm-library-toolbar"><span className="hpm-library-current" aria-current="page">实盘</span><span>全部回合</span></div><p className="hpm-library-scope">来源：首页 · {({all:'全部市场',CN:'A股',HK:'港股',US:'美股'} as const)[request.market]} · {request.accountId==='all'?'全部实盘账户':request.accountId==='account-1'?'招商证券 · 实盘':'海外证券 · 实盘'} · {tradeDate??request.period.from} — {tradeDate??request.period.to}{instrumentId?` · ${rows[0]?.exchange}:${rows[0]?.code}`:''}</p>
      <section className="hpm-library-table"><table><thead><tr>{['标的 / 交易所','账户','成交日期','方向','数量','价格(原币)','回合状态'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(0,50).flatMap(row=>[...(inRange('2026-03-02')?[<tr key={`${row.id}:buy`}><td><strong>{row.name}</strong><small>{row.exchange}:{row.code} · {row.assetType}</small></td><td>{row.accountId==='account-1'?'招商证券':'海外证券'}</td><td>2026-03-02</td><td>买入</td><td>{row.open?row.quantity:'100'}</td><td>{row.cost??'—'} {row.currency}</td><td>{row.open?'未平仓':'已平仓'}</td></tr>]:[]),...(!row.open&&inRange('2026-08-12')?[<tr key={`${row.id}:sell`}><td><strong>{row.name}</strong><small>{row.exchange}:{row.code}</small></td><td>{row.accountId==='account-1'?'招商证券':'海外证券'}</td><td>2026-08-12</td><td>卖出</td><td>100</td><td>{row.price??'—'} {row.currency}</td><td>已平仓</td></tr>]:[])])}</tbody></table>{!rows.length&&<p className="hpm-library-empty">当前范围没有成交记录</p>}</section>
    </main>
  </section>;
}
