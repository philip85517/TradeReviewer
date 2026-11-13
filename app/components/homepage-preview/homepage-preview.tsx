'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import type { HomepageSource, Period, Scenario } from './display-contract';
import { createMockSource, DEFAULT_REQUEST, SCENARIOS, TODAY } from './mock-source';
import { parseLocation } from './location-state';
import { useHomepagePreview } from './use-homepage-preview';
import { MetricCards } from './metric-cards';
import { PerformanceChart } from './performance-chart';
import { PeriodSelector } from './period-selector';
import { Holdings } from './holdings';
import { HoldingDetailPanel } from './holding-detail';
import './homepage-preview.css';

export function HomepagePreview({ source: supplied, initialScenario = 'normal' }: { source?: HomepageSource; initialScenario?: Scenario }) {
  const [override, setScenario] = useState<Scenario | null>(null);
  const linkedScenario = useSyncExternalStore(callback => { const pop = () => { setScenario(null); callback(); }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, () => window.location.search.includes('scenario=') ? parseLocation(window.location.search).scenario : initialScenario, () => initialScenario);
  const scenario = override ?? linkedScenario;
  const [delay, setDelay] = useState(30), [failure, setFailure] = useState(false);
  const failOnce = useRef(false);
  const source = useMemo(() => supplied ?? createMockSource({ scenario, delayMs: delay }), [supplied, scenario, delay]);
  const controlled = useMemo<HomepageSource>(() => ({ ...source, readHome: (request, signal) => { if (failOnce.current) { failOnce.current = false; setFailure(false); return Promise.reject(new Error('模拟读取失败，原视图已保留')); } return source.readHome(request, signal); } }), [source]);
  const state = useHomepagePreview(controlled, scenario), { view, pending, error } = state;
  const change = state.change;
  const applied = view?.request ?? DEFAULT_REQUEST;
  const [queryState, setQueryState] = useState({ applied: applied.query, value: applied.query }), composing = useRef(false), typed = useRef(false);
  const [compositionEnd, setCompositionEnd] = useState(0);
  const [periodOpen, setPeriodOpen] = useState(false), [draft, setDraft] = useState({ from: applied.period.from, to: applied.period.to });
  if (queryState.applied !== applied.query) { setQueryState({ applied: applied.query, value: applied.query }); }
  const query = queryState.value;
  const setQuery = (value: string) => setQueryState({ applied: applied.query, value });
  useEffect(() => {
    if (!typed.current || composing.current || query === applied.query) return;
    const timer = setTimeout(() => { typed.current = false; change({ query }); }, 300);
    return () => clearTimeout(timer);
  }, [query, applied.query, change, compositionEnd]);
  const applyPeriod = (period: Period) => { setPeriodOpen(false); state.change({ period }); };
  return <div className="hp-preview">
    <aside inert={!!state.detail} className="hp-preview-tools" aria-label="Mock 预览工具"><strong>前端预览 · Mock</strong><label>样例<select aria-label="Mock 场景" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{SCENARIOS.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>读取延迟<select aria-label="读取延迟" value={delay} onChange={event => setDelay(Number(event.target.value))}><option value={30}>正常</option><option value={3000}>3秒</option><option value={16000}>16秒（超时）</option></select></label><button type="button" onClick={() => { failOnce.current = true; setFailure(true); }}>下一次切换失败{failure ? '（已设置）' : ''}</button><span>仅验证展现与模拟往返；历史、贡献、全局搜索和附加筛选留后续。</span></aside>
    {!!state.notices.length && <p role="status" aria-label="链接参数说明" className="hp-link-notice">链接参数已恢复有效范围：{state.notices.join('；')}。可使用范围控件更正。</p>}
    <div className="hp-canvas" inert={!!state.detail}>
      <nav className="hp-nav" aria-label="预览导航"><ChartNoAxesCombined size={28} aria-hidden="true" /><span className="hp-nav-current" aria-label="我的交易室">◫</span><span className="hp-nav-label">交易<br/>空间</span></nav>
      <div className="hp-workspace"><header className="hp-page-header"><h1>我的交易室</h1><div className="hp-scope" aria-label="市场范围">{([['all','全部'],['CN','A股'],['HK','港股'],['US','美股']] as const).map(([market,label]) => <button type="button" key={market} aria-pressed={applied.market === market} onClick={() => state.change({ market })}>{label}</button>)}</div><select aria-label="实盘账户" value={applied.accountId} onChange={event => state.change({ accountId: event.target.value })}>{(view?.accounts ?? [{ id: 'all', name: '全部实盘账户' }]).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></header>
        <main className="hp-main"><section className="hp-performance" aria-labelledby="performance-heading"><div className="hp-section-toolbar"><h2 id="performance-heading">当前表现</h2><PeriodSelector applied={applied.period} draft={draft} open={periodOpen} pending={pending} error={null} today={TODAY} allRange={{ from: '2026-01-01', to: TODAY }} onDraftChange={setDraft} onOpenChange={open => { if (open) setDraft({ from: applied.period.from, to: applied.period.to }); setPeriodOpen(open); }} onApply={applyPeriod} /></div>
          {view ? <MetricCards view={view} status={pending ? { kind: 'pending', reason: '更新中，仍显示上次完整结果' } : { kind: 'ready' }} /> : <MetricCards view={null} placeholderCurrency="CNY" status={{ kind: 'pending', reason: '读取模拟展示快照' }} />}
          <PerformanceChart series={view?.series ?? null} reportCurrency={view?.stamp.reportCurrency ?? 'CNY'} unavailableReason={!view ? '图表加载中…' : undefined} />
        </section>
        <div className="hp-read-status" aria-live="polite">{pending && <>读取中 <button type="button" onClick={state.cancel}>取消读取</button></>}{(!!error || !!view?.reasons.length) && <div role="alert"><span>{error ?? view?.reasons.join('；')}</span><button type="button" onClick={state.repair} disabled={pending}>一键修复</button></div>}</div>
        <Holdings view={view} query={query} onQuery={value => { typed.current = true; setQuery(value); }} onComposition={value => { composing.current = value; if (!value) setCompositionEnd(current => current + 1); }} onChange={state.change} onDetail={state.openHolding} onExport={state.exportCSV} pending={pending} />
        <p className="hp-page-note">Mock 展示快照 · 业务时点 {view?.stamp.asOf ?? TODAY} · 真实财务结果和 1 秒性能待后续验证</p>
        </main></div>
    </div>
    {state.detail && <HoldingDetailPanel detail={state.detail} trades={state.trades} pending={pending} error={error} onCancel={state.cancel} onClose={state.close} onTrades={state.openTrades} onBack={state.backToDetail} />}
  </div>;
}
