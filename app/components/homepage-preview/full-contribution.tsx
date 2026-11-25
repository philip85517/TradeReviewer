'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import {missingReasonText} from './missing-reasons';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Market } from './display-contract';
import type { ContributionProps } from './complete-mock/contracts';
import { contributionTotal, formatContribution, MARKET_NAMES, segmentGeometry, type ContributionMode, type ContributionRecord } from './complete-mock/contribution-data';
import './complete-mock/contribution.css';
import './full-contribution.css';
import type {FullContribution,FullRequestV1} from '../../lib/home/full-contracts';

type ModeMemory = { category: FullRequestV1['contribution']['category']; sort: 'asc' | 'desc'; openOnly: boolean; drill: Exclude<Market, 'all'> | null; page: number };
const tone = (value: number | null) => value === null || value === 0 ? 'hp-contrib-neutral' : value > 0 ? 'hp-contrib-positive' : 'hp-contrib-negative';
type Tooltip = { row: string; label: string; value: number; left: number; top: number };

export function FullContributionPanel(props: Omit<ContributionProps,'scenario'|'instruments'|'historyRange'> & {historyRange:FullRequestV1['historyRange'];data:FullContribution;selection:FullRequestV1['contribution'];onSelection:(value:FullRequestV1['contribution'])=>void;onMarketChange:(market:Market)=>void}) {
  const scope = JSON.stringify([props.request.market,props.request.accountId,props.request.filters]);
  const mode=props.selection.mode,memory={category:props.selection.category,sort:props.selection.direction,openOnly:props.selection.localOpenOnly,drill:props.selection.drillMarket==='all'?null:props.selection.drillMarket,page:props.selection.page};
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const barsRef = useRef<HTMLDivElement>(null), focusAfterPage = useRef(false);
  const patch = (value: Partial<ModeMemory>) => {setTooltip(null);const next={...memory,...value};props.onSelection({...props.selection,category:next.category,direction:next.sort,localOpenOnly:next.openOnly,drillMarket:next.drill??'all',page:next.page});};
  const switchMode = (mode:ContributionMode) => props.onSelection({...props.selection,mode});
  const num=(value:string|null)=>value===null?null:Number(value);
  const drill=props.request.market==='all'?memory.drill:null,symbolView=props.request.market!=='all'||drill!==null;
  const records:ContributionRecord[]=props.data.rows.map(r=>({key:r.id,instrumentId:r.id,name:r.name,code:r.code,exchange:r.market,market:r.market as Exclude<Market,'all'>,open:r.open,net:num(r.net.value),realized:num(r.realized.value),floating:num(r.unrealizedChange.value)}));
  const markets:ContributionRecord[]=props.data.markets.filter(r=>r.market!=='all').map(r=>({key:r.market,instrumentId:'',name:MARKET_NAMES[r.market],code:'',exchange:'',market:r.market as Exclude<Market,'all'>,open:false,net:num(r.net.value),realized:num(r.realized.value),floating:num(r.unrealizedChange.value)}));
  const rows=symbolView?records:markets,visible=rows,page=props.data.page,pageCount=props.data.pages;
  const category=props.data.categories.find(c=>c.category===memory.category);
  const fullTotal=num(category?.net.value??null),parts={realized:num(category?.realized.value??null),floating:num(category?.unrealizedChange.value??null)},localTotal=num(props.data.net.value);
  const historicalPartial=mode==='historical'&&!!category&&fullTotal!==null&&(!category.coverage.universeComplete||!!category.net.reasons.length);
  const localHistoricalPartial=mode==='historical'&&!props.data.coverage.universeComplete&&localTotal!==null;
  const marketSubtotal=(market:Market)=>mode==='historical'&&!!props.data.markets.find(item=>item.market===market)&&props.data.markets.find(item=>item.market===market)!.net.value!==null&&!props.data.markets.find(item=>item.market===market)!.coverage.universeComplete;
  const max = Math.max(0.01, ...rows.map(row => Math.max(Math.max(0, row.realized ?? 0) + Math.max(0, row.floating ?? 0), Math.abs(Math.min(0, row.realized ?? 0) + Math.min(0, row.floating ?? 0)))));
  const [retryKey, setRetryKey] = useState('');
  const failed = false;
  const empty = props.data.total===0&&props.data.coverage.universeComplete;
  const netReason = mode === 'current' && !empty && props.currentNet?.value == null ? missingReasonText(props.currentNet?.reasons??[]) || '净额所需数据缺失；已实现与浮盈变化保留各自已知结果' : '';
  const coverageReasonText = missingReasonText(props.data.coverage.reasons) || (memory.category === 'all' ? '财务依据' : '分类依据');
  useLayoutEffect(() => { if (focusAfterPage.current) { focusAfterPage.current = false; barsRef.current?.querySelector<HTMLButtonElement>('button[data-contribution-detail]')?.focus({ preventScroll: true }); } }, [page, scope, mode]);
  const changePage = (next: number) => { focusAfterPage.current = true; patch({ page: next }); };
  const showTooltip = (element: HTMLElement, row: ContributionRecord, label: string, value: number) => {
    const rect = element.getBoundingClientRect();
    setTooltip({ row: row.name, label, value, left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)), top: Math.max(8, rect.top - 88) });
  };
  const openRow = (row: ContributionRecord, trigger: HTMLElement) => {
    setTooltip(null);
    if (symbolView) props.onOpenInstrument(row.instrumentId, trigger);
    else patch({ drill: row.market, page: 1 });
  };
  const title = mode === 'current' ? '当前期间贡献' : '历史已平仓贡献';
  const yearCopy = props.historyRange.scope === 'all' ? `全部历史 · ${props.historyRange.fromYear} — ${props.historyRange.toYear}` : props.historyRange.fromYear === props.historyRange.toYear ? `${props.historyRange.fromYear}` : `${props.historyRange.fromYear} — ${props.historyRange.toYear}`;
  return <section className="hp-contribution" aria-labelledby="contribution-heading" data-contribution-mode={mode}>
    <div className="hp-contrib-heading"><div><h2 id="contribution-heading" tabIndex={-1}>{title}</h2><p>{mode === 'current' ? `当前表现日期 · ${props.request.period.from} — ${props.request.period.to} · 已实现 + 浮盈变化` : `${props.historyRange.scope === 'all' ? yearCopy : `历史统计年份 · ${yearCopy}`} · 仅已平仓`}</p></div><strong className={tone(fullTotal)} data-testid="contribution-summary" title={empty ? '—' : `${formatContribution(fullTotal, false)} CNY`}>{empty ? '—' : historicalPartial && <span className="hp-subtotal-label">小计 </span>}{!empty && formatContribution(fullTotal)}{!empty && fullTotal !== null && ' CNY'}{fullTotal !== null && !!category?.net.valuationNotes?.length && <span className="hp-estimate-label" title={category.net.valuationNotes.join('；')}>含拆股推算</span>}</strong></div>
    <div className="hp-contrib-modes" role="tablist" aria-label="贡献模式">{([['current', '当前期间'], ['historical', '历史已平仓']] as const).map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} onClick={() => switchMode(value)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'current' : event.key === 'End' ? 'historical' : mode === 'current' ? 'historical' : 'current'; switchMode(next); const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]'); tabs?.[next === 'current' ? 0 : 1]?.focus(); } }}>{label}</button>)}</div>
    <div className="hp-contrib-controls">
      <div className="hp-contrib-category"><span>分类</span><div role="group" aria-label="贡献分类">{([['all', '全部'], ['long', '做多'], ['short', '做空'], ['ipo', '打新']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={memory.category === value} onClick={() => patch({ category: value, page: 1 })}>{label}</button>)}</div></div>
      <label className="hp-contrib-sort"><span>排序</span><span><select aria-label="贡献排序" value={memory.sort} onChange={event => patch({ sort: event.target.value as 'asc' | 'desc', page: 1 })}><option value="desc">盈利最高</option><option value="asc">亏损最大</option></select></span></label>
      <label className={`hp-contrib-open ${mode === 'historical' ? 'hp-contrib-disabled' : ''}`}><input type="checkbox" aria-label="仅看未平仓" checked={mode === 'current' && memory.openOnly} disabled={mode === 'historical'} onChange={event => patch({ openOnly: event.target.checked, page: 1 })} />仅看未平仓</label>
      <label className="hp-contrib-scope hp-full-contrib-market"><span>全局市场</span><span><select aria-label="贡献全局市场" value={props.request.market} onChange={event=>{setTooltip(null);props.onMarketChange(event.target.value as Market);}}>{(['all','CN','HK','US'] as const).map(market=><option key={market} value={market}>{MARKET_NAMES[market]}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></span></label>
    </div>
    <div className="hp-contrib-position">{drill ? <div className="hp-contrib-crumb"><button type="button" aria-label="返回全部市场贡献" onClick={() => patch({ drill: null, page: 1 })}>全部市场</button><span>›</span><span>{MARKET_NAMES[drill]} · 标的明细</span></div> : symbolView ? <span>{MARKET_NAMES[props.request.market]} · 标的明细</span> : null}</div>
    <div className="hp-contrib-legend" aria-label="贡献构成图例"><i aria-hidden="true" /><span>已实现（实心）</span>{mode === 'current' && <><i className="hp-contrib-hollow" aria-hidden="true" /><span>浮盈变化（中空）</span></>}</div>
    <div className="hp-contrib-bar-head"><span>{symbolView ? '标的' : '市场'}</span><span>合计</span></div>
    <div className={`hp-contrib-bars ${symbolView ? 'hp-contrib-symbols' : 'hp-contrib-markets'}`} ref={barsRef} data-testid="contribution-bars" aria-live="polite">
      {empty ? <div className="hp-contrib-empty"><strong>暂无符合条件的贡献</strong><span>{memory.openOnly ? '当前分类中没有未平仓标的，可取消“仅看未平仓”查看。' : '当前范围没有可展示的贡献记录。'}</span></div> : visible.map(row => <div key={row.key} className="hp-contrib-row" data-contribution-row={row.key}>
        <button type="button" className="hp-contrib-name" data-contribution-detail={symbolView ? row.instrumentId : undefined} aria-label={symbolView ? `查看${row.name}贡献详情（${row.exchange}:${row.code}）` : `查看${row.name}贡献明细`} onClick={event => openRow(row, event.currentTarget)} title={symbolView ? `${row.name} · ${row.exchange}:${row.code}` : undefined}><span>{row.name}</span>{symbolView && <small>{row.exchange}:{row.code}</small>}</button>
        <div className="hp-contrib-plot">{segmentGeometry(row.realized, mode === 'current' ? row.floating : null, max).map(segment => {
          const label = segment.type === 'realized' ? '已实现（实心）' : '浮盈变化（中空）';
          return <span role="img" tabIndex={0} aria-label={`${row.name} ${label} ${formatContribution(segment.value, false)} CNY`} key={segment.type} className={`hp-contrib-segment ${segment.type === 'floating' ? 'hp-contrib-hollow' : ''} ${tone(segment.value)}`} style={{ width: `${segment.width}%`, ...(segment.side === 'positive' ? { left: `${50 + segment.offset}%` } : { right: `${50 + segment.offset}%` }) }} onMouseEnter={event => showTooltip(event.currentTarget, row, label, segment.value)} onFocus={event => showTooltip(event.currentTarget, row, label, segment.value)} onMouseLeave={() => setTooltip(null)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setTooltip(null); } if (['Enter', ' '].includes(event.key)) { event.preventDefault(); openRow(row, event.currentTarget); } }} />;
        })}</div>
        <span className={`hp-contrib-value ${tone(contributionTotal(row))}`} title={`${formatContribution(contributionTotal(row), false)} CNY`}>{!symbolView&&marketSubtotal(row.market)&&<span className="hp-subtotal-label">小计 </span>}{formatContribution(contributionTotal(row))}{!!(symbolView ? props.data.rows.find(item=>item.id===row.key)?.net.valuationNotes : props.data.markets.find(item=>item.market===row.key)?.net.valuationNotes)?.length && <span className="hp-estimate-label" title={(symbolView ? props.data.rows.find(item=>item.id===row.key)?.net.valuationNotes : props.data.markets.find(item=>item.market===row.key)?.net.valuationNotes)?.join("；")}>含拆股推算</span>}</span>
      </div>)}
      {symbolView && !empty && Array.from({ length: 8 - visible.length }, (_, index) => <div key={`blank-${index}`} className="hp-contrib-row hp-contrib-blank" aria-hidden="true"><span /><div className="hp-contrib-plot" /><span /></div>)}
    </div>
    <div className="hp-contrib-feedback" aria-live="polite">{failed ? <><span role="alert">部分贡献读取失败，保留当前范围与已知结果</span><button type="button" onClick={() => setRetryKey(scope)}>重试贡献</button></> : <span>{!props.data.coverage.universeComplete ? (mode==='current'?`${memory.category === 'all' ? '已知金额' : '已归类'} ${props.data.coverage.classifiedCount??props.data.total} / ${props.data.coverage.eligibleCount??'未知'} 项 · 待补${coverageReasonText}，显示已知小计`:`${memory.category === 'all' ? '已知金额' : '已归类'} ${props.data.coverage.classifiedCount??props.data.total} / ${props.data.coverage.eligibleCount??'未知'} 项 · 待补${coverageReasonText}，未知不计作零，金额显示为小计`) : netReason ? `净额不可计算：${netReason}` : ""}</span>}</div>
    <div className="hp-contrib-pagination">{symbolView && !empty && <><span>{page} / {pageCount} · {props.data.total} 项</span><button type="button" aria-label="贡献上一页" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="贡献下一页" disabled={page === pageCount} onClick={() => changePage(page + 1)}><ChevronRight size={16} /></button></>}</div>
    <footer className="hp-contrib-footer"><div><strong>合计</strong><p>{empty ? '暂无贡献记录' : <>已实现 {formatContribution(parts.realized)}{mode === 'current' ? ` · 浮盈变化 ${formatContribution(parts.floating)}` : ' · 历史仅统计已平仓'}</>}</p></div><div><strong className={tone(fullTotal)}>{empty ? '—' : historicalPartial && <span className="hp-subtotal-label">小计 </span>}{!empty && formatContribution(fullTotal)}{!empty && fullTotal !== null && ' CNY'}</strong><p>{drill ? `${MARKET_NAMES[drill]}${localHistoricalPartial ? '小计 ' : ''}全量 ${formatContribution(localTotal)} · 全部市场合计保持` : symbolView ? '当前市场全量合计' : '市场合计'}</p></div></footer>
    {tooltip && <div role="tooltip" className="hp-contrib-tooltip" style={{ left: tooltip.left, top: tooltip.top }}><strong>{tooltip.row}</strong><span>{tooltip.label}：{formatContribution(tooltip.value, false)} CNY</span><small>{tooltip.label.startsWith('浮盈') ? '期末浮盈 − 期初浮盈' : mode === 'historical' ? '所选年份内已平仓交易净盈亏' : '期间已实现贡献'}</small></div>}
  </section>;
}
