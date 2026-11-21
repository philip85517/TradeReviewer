'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {missingReasonText} from './missing-reasons';
import { ChevronDown } from 'lucide-react';
import type { HistoryProps, HistoryRange } from './complete-mock/contracts';
import { historyAmount, historyRangeLabel, historyTicks, type HistoryMetric, type HistoryPoint } from './complete-mock/history-data';
import './complete-mock/history.css';
import type {FullHistory} from '../../lib/home/full-contracts';

const titleFor = (metric: HistoryMetric, monthly: boolean) => metric === 'net' ? monthly ? '每月净盈亏' : '每年净盈亏' : metric === 'cumulative' ? '累计净盈亏' : metric === 'win' ? '各期胜率' : '各期回合数';
const reasonFor = (point: HistoryPoint) => point.state === 'future' ? '该期间尚未到达，暂无已平仓统计' : point.state === 'empty' ? '该期间无已平仓成交' : point.state === 'source-missing' ? '该期源数据缺失，不能视为零' : '';

export function FullHistoryPanel({ request, range, onRangeChange, history, today, firstYear }: Omit<HistoryProps,'scenario'> & {history:FullHistory;today:string;firstYear:number}) {
  const [metric, setMetric] = useState<HistoryMetric>('net');
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<HistoryRange>(range), [kind, setKind] = useState('single');
  const [hover, setHover] = useState<number | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), chooser = useRef<HTMLDivElement>(null), chart = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1200);
  const scope = JSON.stringify([request.market, request.accountId, request.filters]);
  const [localScope, setLocalScope] = useState(scope);
  if (localScope !== scope) {
    setLocalScope(scope);
    setOpen(false); setHover(null);
  }
  useEffect(() => {
    const element = chart.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(520, element.clientWidth || 1200));
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!chooser.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [open]);
  const number = (v:string|null) => v === null ? null : Number(v);
  const future = String(range.fromYear) > today.slice(0,4);
  const snapshot = {state:future?'future':!history.coverage.universeComplete?'source-missing':history.coverage.closedCount===0?'empty':'ready',stats:{net:future?null:number(history.net.value),closed:future?null:history.coverage.closedCount,wins:!future&&history.coverage.universeComplete&&history.coverage.unknownNetCount===0?history.buckets.reduce((n,b)=>n+b.knownWins,0):null,fees:future?null:number(history.fees.value)}};
  let hasRealization=false;
  const points:HistoryPoint[] = history.buckets.map(b=>{
    const isFuture=b.key>today.slice(0,b.granularity==='month'?7:4), closed=b.coverage.closedCount;
    const net=number(b.net.value), cumulative=number(b.cumulativeNet.value);
    if(!isFuture&&net!==null&&!b.net.reasons.includes('no-closed-transactions'))hasRealization=true;
    const monetary=metric==='net'||metric==='cumulative';
    const amount=metric==='cumulative'?cumulative:net;
    const state=isFuture?'future':monetary?(b.net.reasons.includes('no-closed-transactions')&&(metric==='net'||!hasRealization)?'empty':amount===null?'source-missing':'value'):!b.coverage.universeComplete?'source-missing':closed===0?'empty':'value';
    return {key:b.key,label:b.granularity==='month'?`${Number(b.key.slice(5))}月`:b.key,state,net:isFuture?null:net,closed:isFuture?null:closed,wins:isFuture||!b.coverage.universeComplete||b.coverage.unknownNetCount>0?null:b.knownWins,fees:isFuture?null:number(b.fees.value),cumulative:isFuture?null:cumulative,value:state==='source-missing'||state==='future'?null:monetary?(state==='empty'?null:amount):metric==='rounds'?closed:closed===0?null:number(b.winRate)};
  });
  const currentYear=Number(today.slice(0,4)),years=Array.from({length:currentYear-firstYear+2},(_,i)=>firstYear+i);
  const monthly = range.fromYear === range.toYear;
  const unit = metric === 'win' ? '%' : metric === 'rounds' ? '回合' : 'CNY';
  const title = titleFor(metric, monthly);
  const choose = () => { if (!open) { setDraft(range); setKind(monthly ? 'single' : 'range'); } setOpen(!open); };
  const apply = (next: HistoryRange) => {
    if (next.fromYear > next.toYear) return;
    setOpen(false); setHover(null); onRangeChange(next);
  };
  const ticks = historyTicks(points.map(point => point.value), metric), low = ticks[0], high = ticks[ticks.length - 1];
  const left = 78, right = width - 20, top = 18, bottom = 230, plotWidth = right - left;
  const x = (i: number) => left + (points.length === 1 ? plotWidth / 2 : i * plotWidth / (points.length - 1));
  const y = (value: number) => top + (high - value) / (high - low || 1) * (bottom - top);
  const paths: string[] = [];
  let path: string[] = [];
  points.forEach((point, i) => { if (point.value === null) { if (path.length) paths.push(path.join(' ')); path = []; } else path.push(`${x(i)},${y(point.value)}`); });
  if (path.length) paths.push(path.join(' '));
  const closeTip = () => { setHover(null); };
  const move = (event: KeyboardEvent<SVGRectElement>, i: number) => {
    if (event.key === 'Escape') { event.preventDefault(); closeTip(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setHover(i); return; }
    const next = event.key === 'ArrowRight' ? Math.min(points.length - 1, i + 1) : event.key === 'ArrowLeft' ? Math.max(0, i - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : null;
    if (next !== null) { event.preventDefault(); svg.current?.querySelector<SVGRectElement>(`[data-history-index="${next}"]`)?.focus(); }
  };
  const valueLabel = (value: number | null, full = false) => value === null ? '—' : metric === 'win' ? `${value.toFixed(full ? 1 : 0)}%` : metric === 'rounds' ? `${value}${full ? ' 回合' : ''}` : historyAmount(value, full, !full);
  const activePoint = hover === null ? null : points[hover];
  const chartLabel = `${title}，${historyRangeLabel(range)}，${unit}`;
  return <section className="hp-history" aria-labelledby="history-heading" data-history-range={historyRangeLabel(range)}>
    <div className="hp-history-heading"><h2 id="history-heading">历史已平仓</h2><div className="hp-history-controls" ref={chooser}>
      <button type="button" ref={trigger} className="hp-history-year" aria-label={`历史年份范围：${historyRangeLabel(range)}`} aria-expanded={open} aria-haspopup="dialog" onClick={choose}>{historyRangeLabel(range)}<ChevronDown size={14} aria-hidden="true" /></button>
      <span className="hp-history-select"><select aria-label="历史图表指标" value={metric} onChange={event => { setMetric(event.target.value as HistoryMetric); closeTip(); }}><option value="net">{monthly ? '每月净盈亏' : '每年净盈亏'}</option><option value="cumulative">累计净盈亏</option><option value="win">各期胜率</option><option value="rounds">各期回合数</option></select><ChevronDown size={14} aria-hidden="true" /></span>
      {open && <div className="hp-history-range-panel" role="dialog" aria-label="历史年份范围选择"><label>范围<select aria-label="年份范围类型" value={kind} onChange={event => { const value = event.target.value; setKind(value); if (value === 'this') setDraft({ fromYear: currentYear, toYear: currentYear }); if (value === 'all') setDraft({ fromYear: firstYear, toYear: currentYear }); }}><option value="single">单年</option><option value="this">今年</option><option value="range">年份区间</option><option value="all">全部</option></select></label>
        {kind === 'single' && <label>年份<select aria-label="单年" value={draft.fromYear} onChange={event => setDraft({ fromYear: Number(event.target.value), toYear: Number(event.target.value) })}>{years.map(year => <option key={year}>{year}</option>)}</select></label>}
        {kind === 'range' && <div className="hp-history-year-inputs"><label>从<select aria-label="起始年份" value={draft.fromYear} onChange={event => setDraft({ ...draft, fromYear: Number(event.target.value) })}>{years.map(year => <option key={year}>{year}</option>)}</select></label><label>至<select aria-label="结束年份" value={draft.toYear} onChange={event => setDraft({ ...draft, toYear: Number(event.target.value) })}>{years.map(year => <option key={year}>{year}</option>)}</select></label></div>}
        {kind === 'all' && <p>{firstYear}–{currentYear}</p>}{kind === 'this' && <p>{currentYear}</p>}{draft.fromYear > draft.toYear && <p role="alert">起始年份不能晚于结束年份</p>}
        <div className="hp-history-range-actions"><button type="button" onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>取消</button><button type="button" disabled={draft.fromYear > draft.toYear} onClick={() => { apply(draft); trigger.current?.focus({ preventScroll: true }); }} aria-label="应用年份范围">应用</button></div>
      </div>}
    </div></div>
    <div className="hp-history-metrics" aria-label="历史已平仓统计">
      <div className="hp-history-card"><span>已平仓净盈亏</span><strong title={`${historyAmount(snapshot.stats.net, true)} CNY`}>{historyAmount(snapshot.stats.net, true, true)}</strong></div>
      <div className="hp-history-card"><span>已平仓回合</span><strong>{snapshot.stats.closed === null ? '—' : snapshot.stats.closed.toLocaleString('en-US')}</strong></div>
      <div className="hp-history-card hp-history-win" data-testid="history-win"><span>范围胜率</span><div><strong>{future||history.winRate===null?'—':`${history.winRate}%`}</strong><small>{snapshot.stats.wins ?? '—'} / {snapshot.stats.closed ?? '—'} <span>盈利回合</span></small></div></div>
      <div className="hp-history-card"><span>费用（已扣除）</span><strong title={`${historyAmount(snapshot.stats.fees)} CNY`}>{historyAmount(snapshot.stats.fees, true, true)}</strong></div>
    </div>
    <div className="hp-history-chart" data-testid="history-chart" aria-busy={false}>
      <div className="hp-history-chart-title"><h3>{title}</h3><span>{unit}</span></div>
      <div className="hp-history-plot" ref={chart} onMouseLeave={() => setHover(null)}>
        <svg ref={svg} viewBox={`0 0 ${width} 264`} role="group" aria-label={chartLabel} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setHover(null); }}>
          {points.map((point, i) => point.state === 'value' ? null : <rect key={`zone-${point.key}`} className={`hp-history-zone ${point.state}`} x={i === 0 ? left : (x(i - 1) + x(i)) / 2} y={top} width={(i === points.length - 1 ? right : (x(i) + x(i + 1)) / 2) - (i === 0 ? left : (x(i - 1) + x(i)) / 2)} height={bottom - top} />)}
          {ticks.map(value => <g key={`tick-${value}`}><line className={value === 0 ? 'hp-history-zero' : 'hp-history-grid'} x1={left} x2={right} y1={y(value)} y2={y(value)} /><text className="hp-history-tick" x={left - 12} y={y(value) + 4} textAnchor="end">{valueLabel(value)}</text></g>)}
          {paths.map((points, i) => <polyline key={i} className="hp-history-series" points={points} />)}
          {points.map((point, i) => <g key={point.key}><text className="hp-history-tick" x={x(i)} y={254} textAnchor="middle">{point.label}</text>{point.value !== null && <circle className={`hp-history-point${point.value === 0 ? ' true-zero' : ''}`} cx={x(i)} cy={y(point.value)} r={3} />}</g>)}
          {activePoint && hover !== null && <g aria-hidden="true" className="hp-history-crosshair"><line x1={x(hover)} x2={x(hover)} y1={top} y2={bottom} />{activePoint.value !== null && <line x1={left} x2={right} y1={y(activePoint.value)} y2={y(activePoint.value)} />}</g>}
          {points.map((point, i) => <rect key={`hit-${point.key}`} role="button" tabIndex={0} data-history-index={i} className="hp-history-hit" aria-label={`${point.key}${monthly ? '' : '年'} ${reasonFor(point) || valueLabel(point.value, true)}`} x={i === 0 ? left : (x(i - 1) + x(i)) / 2} y={top} width={(i === points.length - 1 ? right : (x(i) + x(i + 1)) / 2) - (i === 0 ? left : (x(i - 1) + x(i)) / 2)} height={bottom - top} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => { setHover(i); }} onKeyDown={event => move(event, i)} />)}
        </svg>
        {snapshot.state === 'empty' && snapshot.stats.net === null && <p className="hp-history-empty">该范围无已完成交易</p>}{snapshot.state === 'future' && <p className="hp-history-empty">该年份尚未到达</p>}
        {activePoint && hover !== null && <div role="tooltip" className="hp-history-tooltip" style={{ left: Math.min(width - 276, Math.max(0, x(hover) + (x(hover) > width * .65 ? -276 : 12))), top: 30 }}><strong>{activePoint.key} · {unit}</strong><span>{title}：{valueLabel(activePoint.value, true)}</span><span>当期净盈亏：{historyAmount(activePoint.net, true)} CNY</span><span>累计净盈亏：{historyAmount(activePoint.cumulative, true)} CNY</span><span>盈利 / 全部回合：{activePoint.wins ?? '—'} / {activePoint.closed ?? '—'}</span><span className="hp-history-tooltip-note">{reasonFor(activePoint) || (metric === 'cumulative' && activePoint.value === null ? '前期数据缺失，累计暂不可计算' : '费用已扣除')}</span></div>}
      </div>
      <div className="hp-history-feedback" aria-live="polite">{!future&&!history.coverage.universeComplete&&<span title={missingReasonText(history.coverage.reasons)}>待补{missingReasonText(history.coverage.reasons)||'平仓依据'} · 已确认 {history.coverage.confirmedClosedCount} 回合，完整回合数与胜率待确认</span>}</div>
    </div>
  </section>;
}
