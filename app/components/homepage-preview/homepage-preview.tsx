'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, FlaskConical, Settings2 } from 'lucide-react';
import type { HomepageSource, Period, Scenario } from './display-contract';
import { createMockSource, DEFAULT_REQUEST, SCENARIOS, TODAY } from './mock-source';
import { parseLocation } from './location-state';
import { useHomepagePreview } from './use-homepage-preview';
import { MetricCards } from './metric-cards';
import { PerformanceChart } from './performance-chart';
import { PeriodSelector } from './period-selector';
import { Holdings } from './holdings';
import { HoldingDetailPanel } from './holding-detail';
import { ReadReasons } from './read-reasons';
import './homepage-preview.css';

// Navigation paths come directly from the approved home-1440.svg reference.
const NAV_ITEMS = [
  { label: '交易库', path: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5' },
  { label: '分析', path: 'M3 3v18h18M6 16l5-6 4 3 6-8' },
  { label: '数据', path: 'M3 6c0-4 18-4 18 0v12c0 4-18 4-18 0zM3 6c0 4 18 4 18 0M3 12c0 4 18 4 18 0' },
  { label: '策略', path: 'M6 3v18M6 7h8a4 4 0 0 1 4 4v6M15 14l3 3 3-3' },
];
function NavIcon({ path }: { path: string }) { return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export function HomepagePreview({ source: supplied, initialScenario = 'normal' }: { source?: HomepageSource; initialScenario?: Scenario }) {
  const [override, setScenario] = useState<Scenario | null>(null);
  const linkedScenario = useSyncExternalStore(callback => { const pop = () => { setScenario(null); callback(); }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, () => window.location.search.includes('scenario=') ? parseLocation(window.location.search).scenario : initialScenario, () => initialScenario);
  const scenario = override ?? linkedScenario;
  const [delay, setDelay] = useState(30), [failure, setFailure] = useState(false);
  const failOnce = useRef(false);
  const source = useMemo(() => supplied ?? createMockSource({ scenario, delayMs: delay }), [supplied, scenario, delay]);
  const controlled = useMemo<HomepageSource>(() => ({ ...source, readHome: (request, signal, version) => { if (failOnce.current) { failOnce.current = false; setFailure(false); return Promise.reject(new Error('模拟读取失败，原视图已保留')); } return source.readHome(request, signal, version); } }), [source]);
  const state = useHomepagePreview(controlled, scenario), { view, pending, showPending, error } = state;
  const change = state.change;
  const real=source.kind==='http',today=real?(source.initialRequest?.period.to??TODAY):TODAY;
  const applied = view?.request ?? source.initialRequest ?? DEFAULT_REQUEST;
  const [queryState, setQueryState] = useState({ applied: applied.query, value: applied.query }), composing = useRef(false), typed = useRef(false);
  const [compositionEnd, setCompositionEnd] = useState(0);
  const [periodOpen, setPeriodOpen] = useState(false), [draft, setDraft] = useState({ from: applied.period.from, to: applied.period.to });
  if (queryState.applied !== applied.query) { setQueryState({ applied: applied.query, value: applied.query }); }
  const query = queryState.value;
  const setQuery = (value: string) => setQueryState({ applied: applied.query, value });
  useEffect(() => {
    // A row opened before the debounce fires owns its frozen scope until return.
    if (pending || state.detail || !typed.current || composing.current || query === applied.query) return;
    const timer = setTimeout(() => { typed.current = false; change({ query }); }, 300);
    return () => clearTimeout(timer);
  }, [query, applied.query, change, compositionEnd, pending, state.detail]);
  const applyPeriod = (period: Period) => { setPeriodOpen(false); state.change({ period }); };
  return <div className="hp-preview" data-home-ready={!!view} data-home-version={view?.stamp.version} data-home-pending={pending}>
    {!real && <details inert={!!state.detail} className="hp-preview-tools"><summary aria-label="Mock 预览工具"><FlaskConical size={14} aria-hidden="true" />Mock 预览</summary><div className="hp-preview-tools-panel"><strong>前端预览 · Mock</strong><label>样例<select aria-label="Mock 场景" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>{SCENARIOS.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>读取延迟<select aria-label="读取延迟" value={delay} onChange={event => setDelay(Number(event.target.value))}><option value={30}>正常</option><option value={3000}>3秒</option><option value={16000}>16秒（超时）</option></select></label><button type="button" onClick={() => { failOnce.current = true; setFailure(true); }}>下一次切换失败{failure ? '（已设置）' : ''}</button><span>仅验证展现与模拟往返；历史、贡献、全局搜索和附加筛选留后续。</span></div></details>}
    {!!state.notices.length && <p role="status" aria-label="链接参数说明" className="hp-link-notice">链接参数已恢复有效范围：{state.notices.join('；')}。可使用范围控件更正。</p>}
    <div className="hp-canvas" inert={!!state.detail}>
      <nav className="hp-nav" aria-label="预览导航"><span className="hp-nav-brand" aria-label="TradeReview">TR</span><a className="hp-nav-item hp-nav-current" href="#performance-heading" aria-current="page" aria-label="首页"><NavIcon path="M3 10L12 3l9 7M5 9v12h5v-7h4v7h5V9" /><span>首页</span></a>{NAV_ITEMS.map(({ label, path }) => <button type="button" key={label} className="hp-nav-item" aria-label={`${label}，本轮未开放`} title={`${label}：本轮尚未开放`} disabled><NavIcon path={path} /><span>{label}</span></button>)}<button type="button" className="hp-nav-item hp-nav-settings" aria-label="设置，本轮未开放" title="设置：本轮尚未开放" disabled><Settings2 size={24} strokeWidth={1.5} aria-hidden="true" /><span>设置</span></button></nav>
      <div className="hp-workspace"><header className="hp-page-header"><h1>我的交易室</h1><div className="hp-scope" aria-label="市场范围">{([['all','全部'],['CN','A股'],['HK','港股'],['US','美股']] as const).map(([market,label]) => <button type="button" key={market} aria-pressed={applied.market === market} onClick={() => state.change({ market })}>{label}</button>)}</div><span className="hp-account"><select aria-label="实盘账户" value={applied.accountId} onChange={event => state.change({ accountId: event.target.value })}>{(view?.accounts ?? [{ id: 'all', name: '全部实盘账户' }]).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></span></header>
        <main className="hp-main"><section className="hp-performance" aria-labelledby="performance-heading"><div className="hp-section-toolbar"><h2 id="performance-heading">当前表现</h2><PeriodSelector applied={applied.period} draft={draft} open={periodOpen} pending={pending} error={null} today={today} allRange={view?.dataRange??{ from: `${today.slice(0,4)}-01-01`, to: today }} onDraftChange={setDraft} onOpenChange={open => { if (open) setDraft({ from: applied.period.from, to: applied.period.to }); setPeriodOpen(open); }} onApply={applyPeriod} /></div>
          {view ? <MetricCards view={view} status={showPending ? { kind: 'pending', reason: '更新中，仍显示上次完整结果' } : { kind: 'ready' }} /> : <MetricCards view={null} placeholderCurrency="CNY" status={{ kind: 'pending', reason: real?'正在读取首页结果':'读取模拟展示快照' }} />}
          <PerformanceChart interactionKey={JSON.stringify([applied.market,applied.accountId,applied.period])} series={view?.series ?? null} reportCurrency={view?.stamp.reportCurrency ?? 'CNY'} unavailableReason={!view ? '图表加载中…' : undefined} />
        </section>
        <div className="hp-read-status" aria-live="polite" aria-busy={pending}>{showPending && <div className="hp-read-pending"><span>{view ? '更新中，仍显示上次完整结果' : real?'正在读取首页结果':'正在读取模拟展示快照'}</span><button type="button" onClick={state.cancel}>取消读取</button></div>}{!pending && (!!error || !!view?.reasons.length) && <div role="alert" className={error ? 'hp-read-error' : 'hp-read-warning'}><span>{error ? `${view ? '新选择未应用，仍显示原范围。' : ''}${error}` : '部分指标数据不足'}</span>{!error&&!!view?.reasons.length&&<ReadReasons key={JSON.stringify(view.stamp)} reasons={view.reasons} view={view}/>}<button type="button" onClick={real?state.reload:state.repair}>{real?'重新读取':'一键修复'}</button></div>}</div>
        <Holdings view={view} query={query} onQuery={value => { typed.current = true; setQuery(value); }} onComposition={value => { composing.current = value; if (!value) setCompositionEnd(current => current + 1); }} onChange={state.change} onDetail={state.openHolding} onExport={state.exportCSV} pending={pending} />
        <p className="hp-page-note" aria-live="polite">{real?<>估值时间 {view?.stamp.asOf??'首次结果准备中'} · 人民币展示 · 按当前汇率折算{view?.fxDate?`（${view.fxDate}）`:'（汇率待更新）'}{state.refreshStatus?.state==='updating'?' · 后台正在更新':state.refreshStatus?.state==='delayed'?' · 更新超过 30 秒，仍显示上一版':state.refreshStatus?.state==='failed'?` · 更新失败：${state.refreshStatus.error}`:state.refreshStatus?.state==='recovering'?' · 正在重建首页结果':''}{(state.refreshStatus?.canRetry||state.refreshStatus?.state==='delayed')&&<button type="button" onClick={state.repair} disabled={pending}>重试更新</button>}</>:<>Mock 展示快照 · 业务时点 {view?.stamp.asOf ?? TODAY} · 真实财务结果和 1 秒性能待后续验证</>}</p>
        </main></div>
    </div>
    {state.detail && <HoldingDetailPanel real={real} accountName={view?.accounts.find(a=>a.id===state.detail?.holding.accountId)?.name} onMore={state.moreTrades} detail={state.detail} trades={state.trades} pending={pending} error={error} onCancel={state.cancel} onClose={state.close} onTrades={state.openTrades} onBack={state.backToDetail} />}
  </div>;
}
