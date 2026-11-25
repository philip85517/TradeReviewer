'use client';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import type { HistoryProps, HistoryRange } from './contracts';
import { historyAmount, historyRangeLabel, historySeries, historyTicks, readHistorySnapshot, type HistoryMetric, type HistoryPoint } from './history-data';
import './history.css';

const titleFor = (metric: HistoryMetric, monthly: boolean) => metric === 'net' ? monthly ? '每月净盈亏' : '每年净盈亏' : metric === 'cumulative' ? '累计净盈亏' : metric === 'win' ? '各期胜率' : '各期回合数';
const reasonFor = (point: HistoryPoint) => point.state === 'future' ? '该期间尚未到达，暂无已平仓统计' : point.state === 'empty' ? '该期间无已关闭回合' : point.state === 'source-missing' ? '该期源数据缺失，不能视为零' : '';

export function HistoricalStatistics({ request, scenario, range, onRangeChange }: HistoryProps) {
  const [metric, setMetric] = useState<HistoryMetric>('net');
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<HistoryRange>(range), [kind, setKind] = useState('single');
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const tipInput = useRef<{ keyboard: boolean; position: { x: number; y: number } | null }>({ keyboard: false, position: null });
  const trigger = useRef<HTMLButtonElement>(null), chooser = useRef<HTMLDivElement>(null), chart = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), lastAttempt = useRef(range), failedOnce = useRef(false), generation = useRef(0);
  const [width, setWidth] = useState(1200);
  const scope = JSON.stringify([request.market, request.accountId, request.filters, scenario]);
  const [localScope, setLocalScope] = useState(scope);
  if (localScope !== scope) {
    setLocalScope(scope);
    setPending(false); setError(null); setOpen(false); setHover(null);
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
    ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    failedOnce.current = false;
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [scope]);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!chooser.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [open]);
  const snapshot = useMemo(() => readHistorySnapshot(request, range, scenario), [request, range, scenario]);
  const points = useMemo(() => historySeries(snapshot.periods, metric), [snapshot, metric]);
  const monthly = range.fromYear === range.toYear;
  const unit = metric === 'win' ? '%' : metric === 'rounds' ? '回合' : 'CNY';
  const title = titleFor(metric, monthly);
  const choose = () => { if (!open) { setDraft(range); setKind(monthly ? 'single' : 'range'); } setOpen(!open); };
  const apply = (next: HistoryRange, retry = false) => {
    if (next.fromYear > next.toYear) return;
    if (timer.current) clearTimeout(timer.current);
    const token = ++generation.current;
    lastAttempt.current = next; setOpen(false); setPending(true); setError(null); setHover(null);
    const fail = scenario === 'partial' && !failedOnce.current && !retry;
    timer.current = setTimeout(() => {
      if (token !== generation.current) return;
      setPending(false);
      if (fail) { failedOnce.current = true; setError(`读取${historyRangeLabel(next)}失败，仍显示${historyRangeLabel(range)}的完整数据`); }
      else onRangeChange(next);
    }, fail ? 450 : 180);
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
  const enterTip = (event: MouseEvent<SVGRectElement>, i: number) => {
    // Scrolling a keyboard-focused point under a stationary pointer also emits mouseenter.
    if (tipInput.current.keyboard) return;
    tipInput.current.position = { x: event.clientX, y: event.clientY };
    setHover(i);
  };
  const moveTip = (event: MouseEvent<SVGRectElement>, i: number) => {
    const { keyboard, position } = tipInput.current;
    if (keyboard && position?.x === event.clientX && position.y === event.clientY) return;
    tipInput.current = { keyboard: false, position: { x: event.clientX, y: event.clientY } };
    setHover(i);
  };
  const move = (event: KeyboardEvent<SVGRectElement>, i: number) => {
    if (event.key === 'Escape') { event.preventDefault(); tipInput.current.keyboard = true; closeTip(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tipInput.current.keyboard = true; setHover(i); return; }
    const next = event.key === 'ArrowRight' ? Math.min(points.length - 1, i + 1) : event.key === 'ArrowLeft' ? Math.max(0, i - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : null;
    if (next !== null) { event.preventDefault(); tipInput.current.keyboard = true; setHover(next); svg.current?.querySelector<SVGRectElement>(`[data-history-index="${next}"]`)?.focus(); }
  };
  const valueLabel = (value: number | null, full = false) => value === null ? '—' : metric === 'win' ? `${value.toFixed(full ? 1 : 0)}%` : metric === 'rounds' ? `${value}${full ? ' 回合' : ''}` : historyAmount(value, full, !full);
  const activePoint = hover === null ? null : points[hover];
  const chartLabel = `${title}，${historyRangeLabel(range)}，${unit}`;
  return <section className="hp-history" aria-labelledby="history-heading" data-history-range={historyRangeLabel(range)}>
    <div className="hp-history-heading"><h2 id="history-heading">历史已平仓</h2><div className="hp-history-controls" ref={chooser}>
      <button type="button" ref={trigger} className="hp-history-year" aria-label={`历史年份范围：${historyRangeLabel(range)}`} aria-expanded={open} aria-haspopup="dialog" onClick={choose}>{historyRangeLabel(range)}<ChevronDown size={14} aria-hidden="true" /></button>
      <span className="hp-history-select"><select aria-label="历史图表指标" value={metric} onChange={event => { setMetric(event.target.value as HistoryMetric); closeTip(); }}><option value="net">{monthly ? '每月净盈亏' : '每年净盈亏'}</option><option value="cumulative">累计净盈亏</option><option value="win">各期胜率</option><option value="rounds">各期回合数</option></select><ChevronDown size={14} aria-hidden="true" /></span>
      {open && <div className="hp-history-range-panel" role="dialog" aria-label="历史年份范围选择"><label>范围<select aria-label="年份范围类型" value={kind} onChange={event => { const value = event.target.value; setKind(value); if (value === 'this') setDraft({ fromYear: 2026, toYear: 2026 }); if (value === 'all') setDraft({ fromYear: 2024, toYear: 2026 }); }}><option value="single">单年</option><option value="this">今年</option><option value="range">年份区间</option><option value="all">全部</option></select></label>
        {kind === 'single' && <label>年份<select aria-label="单年" value={draft.fromYear} onChange={event => setDraft({ fromYear: Number(event.target.value), toYear: Number(event.target.value) })}>{[2024, 2025, 2026, 2027].map(year => <option key={year}>{year}</option>)}</select></label>}
        {kind === 'range' && <div className="hp-history-year-inputs"><label>从<select aria-label="起始年份" value={draft.fromYear} onChange={event => setDraft({ ...draft, fromYear: Number(event.target.value) })}>{[2024, 2025, 2026, 2027].map(year => <option key={year}>{year}</option>)}</select></label><label>至<select aria-label="结束年份" value={draft.toYear} onChange={event => setDraft({ ...draft, toYear: Number(event.target.value) })}>{[2024, 2025, 2026, 2027].map(year => <option key={year}>{year}</option>)}</select></label></div>}
        {kind === 'all' && <p>2024–2026</p>}{kind === 'this' && <p>2026</p>}{draft.fromYear > draft.toYear && <p role="alert">起始年份不能晚于结束年份</p>}
        <div className="hp-history-range-actions"><button type="button" onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>取消</button><button type="button" disabled={draft.fromYear > draft.toYear} onClick={() => { apply(draft); trigger.current?.focus({ preventScroll: true }); }} aria-label="应用年份范围">应用</button></div>
      </div>}
    </div></div>
    <div className="hp-history-metrics" aria-label="历史已平仓统计">
      <div className="hp-history-card"><span>已平仓净盈亏</span><strong title={`${historyAmount(snapshot.state === 'empty' ? null : snapshot.stats.net, true)} CNY`}>{historyAmount(snapshot.state === 'empty' ? null : snapshot.stats.net, true, true)}</strong></div>
      <div className="hp-history-card"><span>已平仓回合</span><strong>{snapshot.stats.closed === null ? '—' : snapshot.stats.closed.toLocaleString('en-US')}</strong></div>
      <div className="hp-history-card hp-history-win" data-testid="history-win"><span>范围胜率</span><div><strong>{snapshot.stats.closed ? `${(snapshot.stats.wins! / snapshot.stats.closed * 100).toFixed(1)}%` : '—'}</strong><small>{snapshot.stats.wins ?? '—'} / {snapshot.stats.closed ?? '—'} <span>盈利回合</span></small></div></div>
      <div className="hp-history-card"><span>费用（已扣除）</span><strong title={`${historyAmount(snapshot.stats.fees)} CNY`}>{historyAmount(snapshot.stats.fees, false, true)}</strong></div>
    </div>
    <div className="hp-history-chart" data-testid="history-chart" aria-busy={pending}>
      <div className="hp-history-chart-title"><h3>{title}</h3><span>{unit}</span></div>
      <div className="hp-history-plot" onMouseLeave={() => { if (!tipInput.current.keyboard) setHover(null); }}>
        <div className="hp-history-chart-scroll" role="region" aria-label="历史趋势图，可横向滚动" tabIndex={0}><div className="hp-history-chart-surface" ref={chart}>
        <svg ref={svg} viewBox={`0 0 ${width} 264`} role="group" aria-label={chartLabel} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { tipInput.current.keyboard = false; setHover(null); } }}>
          {points.map((point, i) => point.state === 'value' ? null : <rect key={`zone-${point.key}`} className={`hp-history-zone ${point.state}`} x={i === 0 ? left : (x(i - 1) + x(i)) / 2} y={top} width={(i === points.length - 1 ? right : (x(i) + x(i + 1)) / 2) - (i === 0 ? left : (x(i - 1) + x(i)) / 2)} height={bottom - top} />)}
          {ticks.map(value => <g key={`tick-${value}`}><line className={value === 0 ? 'hp-history-zero' : 'hp-history-grid'} x1={left} x2={right} y1={y(value)} y2={y(value)} /><text className="hp-history-tick" x={left - 12} y={y(value) + 4} textAnchor="end">{valueLabel(value)}</text></g>)}
          {paths.map((points, i) => <polyline key={i} className="hp-history-series" points={points} />)}
          {points.map((point, i) => <g key={point.key}><text className="hp-history-tick" x={x(i)} y={254} textAnchor="middle">{point.label}</text>{point.value !== null && <circle className={`hp-history-point${point.value === 0 ? ' true-zero' : ''}`} cx={x(i)} cy={y(point.value)} r={3} />}</g>)}
          {activePoint && hover !== null && <g aria-hidden="true" className="hp-history-crosshair"><line x1={x(hover)} x2={x(hover)} y1={top} y2={bottom} />{activePoint.value !== null && <line x1={left} x2={right} y1={y(activePoint.value)} y2={y(activePoint.value)} />}</g>}
          {points.map((point, i) => <rect key={`hit-${point.key}`} role="button" tabIndex={0} data-history-index={i} className="hp-history-hit" aria-label={`${point.key}${monthly ? '' : '年'} ${reasonFor(point) || valueLabel(point.value, true)}`} x={i === 0 ? left : (x(i - 1) + x(i)) / 2} y={top} width={(i === points.length - 1 ? right : (x(i) + x(i + 1)) / 2) - (i === 0 ? left : (x(i - 1) + x(i)) / 2)} height={bottom - top} onMouseEnter={event => enterTip(event, i)} onMouseMove={event => moveTip(event, i)} onFocus={() => { tipInput.current.keyboard = true; setHover(i); }} onClick={event => { tipInput.current = { keyboard: false, position: { x: event.clientX, y: event.clientY } }; setHover(i); }} onKeyDown={event => move(event, i)} />)}
        </svg>
        </div></div>
        {snapshot.state === 'empty' && <p className="hp-history-empty">暂无已平仓回合</p>}{snapshot.state === 'future' && <p className="hp-history-empty">该年份尚未到达</p>}
        {activePoint && hover !== null && <div role="tooltip" className="hp-history-tooltip" style={{ left: Math.min(width - 276, Math.max(0, x(hover) + (x(hover) > width * .65 ? -276 : 12))), top: 30 }}><strong>{activePoint.key} · {unit}</strong><span>{title}：{valueLabel(activePoint.value, true)}</span><span>当期净盈亏：{historyAmount(activePoint.net, true)} CNY</span><span>累计净盈亏：{historyAmount(activePoint.cumulative, true)} CNY</span><span>盈利 / 全部回合：{activePoint.wins ?? '—'} / {activePoint.closed ?? '—'}</span><span className="hp-history-tooltip-note">{reasonFor(activePoint) || (metric === 'cumulative' && activePoint.value === null ? '前期数据缺失，累计暂不可计算' : '费用已扣除')}</span></div>}
      </div>
      <p className="hp-history-scroll-hint">左右滚动查看完整趋势，聚焦图点后可用方向键浏览</p>
      <div className="hp-history-feedback" aria-live="polite">{pending && <span>正在读取新年份，仍显示原范围</span>}{error && <span role="alert">{error}<button type="button" aria-label="重试历史读取" onClick={() => apply(lastAttempt.current, true)}>重试</button></span>}</div>
    </div>
  </section>;
}
