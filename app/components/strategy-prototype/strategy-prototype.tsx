"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./strategy-prototype.css";

type Variant = "A" | "B";
type Stage = "setup" | "package" | "preview" | "replay" | "results" | "list";

const DAYS = [
  { day: 0, date: "演示日 0", value: 100000, note: "起点：只看到完整历史数据" },
  { day: 1, date: "演示日 1", value: 100920, note: "建仓执行，组合开始运行" },
  { day: 2, date: "演示日 2", value: 101480, note: "趋势继续，暂无调仓" },
  { day: 3, date: "演示日 3", value: 100860, note: "波动扩大，保持目标仓位" },
  { day: 4, date: "演示日 4", value: 102340, note: "周度复核，准备再平衡" },
  { day: 5, date: "演示日 5", value: 104680, note: "自动调仓：降低中证红利权重" },
  { day: 6, date: "演示日 6", value: 105410, note: "调整后风险回落" },
  { day: 7, date: "演示日 7", value: 106320, note: "观察期结束" },
];

const STRATEGIES = [
  { id: "quality", name: "质量与趋势", tag: "稳健", color: "#52d5b5", desc: "盈利质量 + 周线趋势，周度复核", return: "+6.32%", drawdown: "-1.8%" },
  { id: "value", name: "低波动价值", tag: "防守", color: "#7ca8ff", desc: "估值分位 + 波动率，月度复核", return: "+4.74%", drawdown: "-1.1%" },
];

const stageLabels: Record<Stage, string> = { setup: "历史设置", package: "策略包", preview: "组合预览", replay: "自动运行", results: "结果对比", list: "实验列表" };

function formatMoney(n: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(n);
}

function Chart({ day, compact = false }: { day: number; compact?: boolean }) {
  const visible = DAYS.slice(0, day + 1);
  const min = Math.min(...visible.map(d => d.value));
  const max = Math.max(...visible.map(d => d.value));
  const y = (value: number) => {
    const range = Math.max(1, max - min);
    return (compact ? 82 : 190) - ((value - min) / range) * (compact ? 56 : 135);
  };
  const points = visible.map((d, i) => `${18 + i * (compact ? 25 : 47)},${y(d.value)}`).join(" ");
  return (
    <svg className={compact ? "mini-chart" : "strategy-chart"} viewBox={compact ? "0 0 200 100" : "0 0 360 250"} role="img" aria-label={`已揭示 ${day} 天净值曲线`}>
      <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#39c5a3" stopOpacity=".25" /><stop offset="1" stopColor="#39c5a3" stopOpacity="0" /></linearGradient></defs>
      {!compact && <><line x1="18" y1="36" x2="345" y2="36" stroke="#23324b" /><line x1="18" y1="120" x2="345" y2="120" stroke="#23324b" /><line x1="18" y1="205" x2="345" y2="205" stroke="#23324b" /><text x="22" y="232" fill="#8392a8" fontSize="10">演示日 0</text><text x="307" y="232" fill="#8392a8" fontSize="10">演示日 7</text></>}
      <polygon points={`${points} ${18 + (visible.length - 1) * (compact ? 25 : 47)},${compact ? 100 : 220} 18,${compact ? 100 : 220}`} fill="url(#area)" />
      <polyline points={points} fill="none" stroke="#52d5b5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {visible.map((d, i) => <circle key={d.day} cx={18 + i * (compact ? 25 : 47)} cy={y(d.value)} r={i === visible.length - 1 ? 4 : 2.5} fill="#09131f" stroke="#52d5b5" strokeWidth="2" />)}
    </svg>
  );
}

function PrototypeNav({ stage, day, onReset, variant }: { stage: Stage; day: number; onReset: () => void; variant: Variant }) {
  return <header className="proto-topbar"><div className="proto-brand"><span className="proto-mark">↗</span><div><b>TradeReview</b><small>策略实验 · 合成预览</small></div></div><div className="proto-context"><span className="live-dot" />策略观察者 <em>·</em> {stageLabels[stage]} <em>·</em> 第 {day}/7 天</div><button className="ghost-button" onClick={onReset}>刷新重置</button><span className="proto-variant">方案 {variant}</span></header>;
}

function PrototypeSwitcher({ variant }: { variant: Variant }) {
  const router = useRouter();
  const go = useCallback((next: Variant) => { router.replace(`?prototype=strategy&variant=${next}`); }, [router]);
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName) || (event.target as HTMLElement)?.isContentEditable) return; if (event.key === "ArrowLeft") go(variant === "A" ? "B" : "A"); if (event.key === "ArrowRight") go(variant === "A" ? "B" : "A"); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [go, variant]);
  const previous = variant === "A" ? "B" : "A";
  const next = variant === "A" ? "B" : "A";
  return <div className="variant-switcher"><button aria-label="上一方案" onClick={() => go(previous)}>←</button><span><small>原型切换</small><b>{variant} · {variant === "A" ? "分步向导" : "连续工作台"}</b></span><button aria-label="下一方案" onClick={() => go(next)}>→</button></div>;
}

function SetupCard({ startDate, setStartDate, horizon, setHorizon, onNext }: { startDate: string; setStartDate: (value: string) => void; horizon: string; setHorizon: (value: string) => void; onNext: () => void }) {
  return <section className="setup-card"><div className="section-kicker">01 · 从历史时点开始</div><h2>先把当时能看到的世界固定下来</h2><p className="subtle">本实验使用已导入的示例集合。未来行情会在运行时逐日揭示。</p><div className="field-row"><label>历史起点<span>固定合成起点 · 沪深演示集</span><select value={startDate} onChange={event => setStartDate(event.target.value)}><option value="2024-03-29">合成起点 A</option></select></label><label>观察期限<span>仅展示固定 7 日合成样本</span><select value={horizon} onChange={event => setHorizon(event.target.value)}><option value="1w">1 周（合成样本 7 日）</option><option value="1m">1 个月（合成样本 7 日）</option><option value="3m">3 个月（合成样本 7 日）</option><option value="6m">6 个月（合成样本 7 日）</option><option value="1y">1 年（合成样本 7 日）</option></select></label></div><div className="data-note"><span>◉</span><div><b>历史数据检查通过</b><small>起点前 60 周预热 · 未来数据已隐藏 · 仅为固定 7 日演示数据</small></div></div><button className="primary-button" onClick={onNext}>继续选择策略 <span>→</span></button></section>;
}

function PackageCard({ selectedStrategy, setSelectedStrategy, onNext }: { selectedStrategy: string; setSelectedStrategy: (id: string) => void; onNext: () => void }) {
  return <section className="package-card"><div className="section-kicker">02 · 选择自动决策</div><h2>策略包会替你做什么？</h2><p className="subtle">你控制观察速度，策略负责选股、仓位和再平衡。</p><div className="strategy-options">{STRATEGIES.map(s => <button key={s.id} disabled={s.id === "value"} className={`strategy-option ${selectedStrategy === s.id ? "selected" : ""}`} onClick={() => setSelectedStrategy(s.id)}><span className="strategy-icon" style={{ background: s.color }}>{s.id === "quality" ? "✦" : "◒"}</span><span className="strategy-copy"><b>{s.name}</b><small>{s.desc}</small><em>{s.id === "value" ? "仅结果对照" : s.tag}</em></span><span className="radio-dot" /></button>)}</div><div className="rules-strip"><span>筛选 4 条</span><span>目标仓位 90%</span><span>周度复核</span><span>剩余现金 10%</span></div><button className="primary-button" onClick={onNext}>预览初始组合 <span>→</span></button></section>;
}

function PreviewCard({ strategy, startDate = "2024-03-29", horizon = "1w", onNext }: { strategy: typeof STRATEGIES[number]; startDate?: string; horizon?: string; onNext: () => void }) {
  const horizonLabel = { "1w": "1 周", "1m": "1 个月", "3m": "3 个月", "6m": "6 个月", "1y": "1 年" }[horizon] ?? "合成期限";
  return <section className="preview-card"><div className="section-kicker">03 · 组合预览</div><div className="preview-heading"><div><h2>这套策略准备这样开始</h2><p className="subtle">截至 {startDate} · {horizonLabel}（固定 7 日合成样本）· 初始资金 ¥100,000</p></div><span className="status-pill">待启动</span></div><div className="allocation"><div className="allocation-main"><span className="allocation-value">90<span>%</span></span><small>目标持仓</small><div className="allocation-bar"><i style={{ width: "36%", background: "#52d5b5" }} /><i style={{ width: "29%", background: "#7ca8ff" }} /><i style={{ width: "25%", background: "#d5a85c" }} /><i style={{ width: "10%", background: "#455671" }} /></div></div><div className="allocation-list"><span><i style={{ background: "#52d5b5" }} />沪深 300 · 36%</span><span><i style={{ background: "#7ca8ff" }} />中证红利 · 29%</span><span><i style={{ background: "#d5a85c" }} />科技龙头 · 25%</span><span><i style={{ background: "#455671" }} />现金 · 10%</span></div></div><div className="preview-foot"><span>策略：{strategy.name}<small>版本 1.2 · 演示规则已锁定</small></span><button className="primary-button" onClick={onNext}>开始观察 <span>↗</span></button></div></section>;
}

function Holdings({ day }: { day: number }) {
  const actual = day > 0;
  const rebalance = day >= 5;
  return <div className="holdings-strip"><div><span>组合净资产</span><b>¥{formatMoney(DAYS[day].value)}</b></div><div><span>现金</span><b>{rebalance ? "10%" : actual ? "10%" : "100%"}</b></div><div><span>持仓状态</span><b>{!actual ? "等待建仓" : rebalance ? "已调仓" : "已建仓"}</b></div><div><span>目标仓位</span><b>{rebalance ? "沪深 300 44% · 中证红利 21% · 科技龙头 25%" : actual ? "沪深 300 36% · 中证红利 29% · 科技龙头 25%" : "—"}</b></div></div>;
}

function ExperimentList({ day, onOpen, onNew }: { day: number; onOpen: () => void; onNew: () => void }) {
  return <section className="results-card experiment-list-card"><div className="section-kicker">实验列表</div><div className="results-heading"><div><h2>我的策略实验</h2><p className="subtle">内存演示会保留当前游标，刷新页面才会清空。</p></div><button className="primary-button" onClick={onNew}>+ 新建实验</button></div><button className="saved-experiment" onClick={onOpen}><span className="experiment-dot" /><span><b>春季质量观察</b><small>质量与趋势 · {day === 7 ? "已完成" : `已看到第 ${day} 天`}</small></span><em>重新打开 →</em></button></section>;
}

function ReplayCard({ day, setDay, playing, setPlaying, onResults, onList }: { day: number; setDay: (day: number) => void; playing: boolean; setPlaying: (v: boolean) => void; onResults: () => void; onList: () => void }) {
  const [showEvent, setShowEvent] = useState(true);
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setDay(Math.min(7, day + 1)), 1000); return () => window.clearInterval(timer); }, [playing, day, setDay]);
  useEffect(() => { if (day >= 7) setPlaying(false); }, [day, setPlaying]);
  const current = DAYS[day];
  return <section className="replay-card"><div className="replay-header"><div><div className="section-kicker">04 · 自动运行</div><h2>{current.date} <span>第 {day}/7 个合成日</span></h2></div><span className={`status-pill ${day === 7 ? "done" : "running"}`}>{day === 7 ? "已完成" : playing ? "播放中" : "已暂停"}</span></div><div className="replay-chart-wrap"><Chart day={day} />{day < 7 && <div className="future-mask">未来走势<br /><b>尚未揭示</b></div>}</div><Holdings day={day} /><div className="replay-controls"><button className="secondary-button" disabled={day === 7} onClick={() => setPlaying(!playing)}>{playing ? "暂停" : "播放"}</button><button className="secondary-button" disabled={day === 7} onClick={() => setDay(Math.min(7, day + 1))}>下一日 <span>→</span></button><button className="secondary-button" onClick={onList}>返回实验列表</button><span className="replay-note">{current.note}</span>{day === 7 && <button className="primary-button compact-button" onClick={onResults}>查看结果 <span>→</span></button>}</div>{day >= 5 && day < 7 && <button className="rebalance-event" aria-expanded={showEvent} onClick={() => setShowEvent(value => !value)}><span className="event-icon">↻</span><div><b>自动调仓已发生 · 演示日 5</b>{showEvent && <p>中证红利从 29% 调整至 21%，释放的仓位补入沪深 300。原因：周线趋势信号转弱，策略风险预算自动收缩。</p>}</div><span className="event-tag">{showEvent ? "收起" : "查看原因"}</span></button>}</section>;
}

function ResultsCard({ selectedStrategy, onBack }: { selectedStrategy: string; onBack: () => void }) {
  const active = STRATEGIES.find(s => s.id === selectedStrategy) ?? STRATEGIES[0];
  const other = STRATEGIES.find(s => s.id !== selectedStrategy) ?? STRATEGIES[1];
  return <section className="results-card"><div className="section-kicker">05 · 结果对比</div><div className="results-heading"><div><h2>同一个起点，两种自动决策</h2><p className="subtle">演示日 0 → 演示日 7 · 7 个合成日 · ¥100,000</p></div><span className="status-pill done">演示完成</span></div><div className="result-grid"><div className="result-primary"><div className="result-label"><span className="color-dot" style={{ background: active.color }} />{active.name}<small>本次运行</small></div><strong>{active.return}</strong><span className="result-meta">最大回撤 {active.drawdown} · 调仓 1 次</span><Chart day={7} compact /></div><div className="result-secondary"><div className="result-label"><span className="color-dot" style={{ background: other.color }} />{other.name}<small>同场景对照</small></div><strong>{other.return}</strong><span className="result-meta">最大回撤 {other.drawdown} · 调仓 0 次</span><div className="bar-compare"><i style={{ width: active.id === "quality" ? "84%" : "68%", background: active.color }} /><i style={{ width: active.id === "quality" ? "68%" : "84%", background: other.color }} /></div><small className="subtle">曲线仅用于比较，不代表真实收益</small></div></div><div className="results-footer"><span>实验暂存于内存 <small>刷新页面会重置这段演示</small></span><button className="secondary-button" onClick={onBack}>← 返回实验列表</button></div></section>;
}

function Sidebar({ stage, day, selectedStrategy }: { stage: Stage; day: number; selectedStrategy: string }) {
  return <aside className="proto-sidebar"><div className="sidebar-head"><span className="sidebar-label">我的实验</span><span className="count-badge">1</span></div><div className="experiment-card active"><span className="experiment-dot" /><div><b>春季质量观察</b><small>2024-03-29 · {day === 7 ? "已完成" : "进行中"}</small></div><span className="more">···</span></div><div className="sidebar-divider" /><span className="sidebar-label">策略库</span><div className="library-row"><span className="library-icon">✦</span><span><b>质量与趋势</b><small>选股 + 周度再平衡</small></span></div><div className="library-row"><span className="library-icon blue">◒</span><span><b>低波动价值</b><small>防守 + 月度复核</small></span></div><div className="sidebar-spacer" /><div className="demo-disclosure"><b>ⓘ 合成演示</b><p>本页面使用固定故事脚本，不读取业务数据库，不产生真实回测结果。</p></div></aside>;
}

export function StrategyPrototype({ variant }: { variant: Variant }) {
  const [stage, setStage] = useState<Stage>("setup");
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState("quality");
  const [startDate, setStartDate] = useState("2024-03-29");
  const [horizon, setHorizon] = useState("1w");
  const strategy = useMemo(() => STRATEGIES.find(s => s.id === selectedStrategy) ?? STRATEGIES[0], [selectedStrategy]);
  const reset = () => { setStage("setup"); setDay(0); setPlaying(false); setSelectedStrategy("quality"); setStartDate("2024-03-29"); setHorizon("1w"); };
  const stepTo = (next: Stage) => { setPlaying(false); setStage(next); };
  return <div className={`strategy-prototype variant-${variant}`}><PrototypeNav stage={stage} day={day} onReset={reset} variant={variant} /><div className="proto-shell"><Sidebar stage={stage} day={day} selectedStrategy={selectedStrategy} />{variant === "A" ? <main className="guided-main"><div className="guided-progress"><span className="eyebrow">新建策略实验</span><div className="progress-track">{(["setup", "package", "preview", "replay", "results"] as Stage[]).map((s, i) => <button key={s} disabled={i > ["setup", "package", "preview", "replay", "results"].indexOf(stage) || !["setup", "package", "preview"].includes(stage)} className={stage === s ? "current" : (["setup", "package", "preview", "replay", "results"] as Stage[]).indexOf(stage) > i ? "done" : ""} onClick={() => ((["setup", "package", "preview"].includes(stage) && i <= ["setup", "package", "preview", "replay", "results"].indexOf(stage)) ? stepTo(s) : undefined)}><span>{i + 1}</span>{stageLabels[s]}</button>)}</div></div>{stage === "setup" && <SetupCard startDate={startDate} setStartDate={setStartDate} horizon={horizon} setHorizon={setHorizon} onNext={() => stepTo("package")} />}{stage === "package" && <PackageCard selectedStrategy={selectedStrategy} setSelectedStrategy={setSelectedStrategy} onNext={() => stepTo("preview")} />}{stage === "preview" && <PreviewCard strategy={strategy} startDate={startDate} horizon={horizon} onNext={() => stepTo("replay")} />}{stage === "replay" && <ReplayCard day={day} setDay={setDay} playing={playing} setPlaying={setPlaying} onResults={() => stepTo("results")} onList={() => stepTo("list")} />}{stage === "results" && <ResultsCard selectedStrategy={selectedStrategy} onBack={() => stepTo("list")} />}{stage === "list" && <ExperimentList day={day} onOpen={() => stepTo(day === 7 ? "results" : "replay")} onNew={reset} />}<div className="guided-help"><span>策略观察者</span><p>你只需要决定观察哪一套策略，以及推进速度。选股、调仓和执行全部由策略自动完成。</p></div></main> : <WorkspaceMain stage={stage} day={day} playing={playing} setPlaying={setPlaying} setDay={setDay} setStage={stepTo} selectedStrategy={selectedStrategy} setSelectedStrategy={setSelectedStrategy} strategy={strategy} reset={reset} />}</div><PrototypeSwitcher variant={variant} /></div>;
}

function WorkspaceMain({ stage, day, playing, setPlaying, setDay, setStage, selectedStrategy, setSelectedStrategy, strategy, reset }: { stage: Stage; day: number; playing: boolean; setPlaying: (v: boolean) => void; setDay: (n: number) => void; setStage: (s: Stage) => void; selectedStrategy: string; setSelectedStrategy: (s: string) => void; strategy: typeof STRATEGIES[number]; reset: () => void }) {
  const [viewDay, setViewDay] = useState(day);
  useEffect(() => { if (!playing || stage !== "replay") return; const timer = window.setInterval(() => { const next = Math.min(7, day + 1); setDay(next); setViewDay(next); }, 1000); return () => window.clearInterval(timer); }, [playing, day, stage, setDay]);
  useEffect(() => { if (day >= 7) setPlaying(false); }, [day, setPlaying]);
  if (stage === "list") return <main className="workspace-main"><ExperimentList day={day} onOpen={() => setStage(day === 7 ? "results" : "replay")} onNew={reset} /></main>;
  if (stage === "results") return <main className="workspace-main"><ResultsCard selectedStrategy={selectedStrategy} onBack={() => setStage("list")} /></main>;
  if (stage === "preview") return <main className="workspace-main"><PreviewCard strategy={strategy} onNext={() => setStage("replay")} /></main>;
  const displayDay = Math.min(viewDay, day);
  return <main className="workspace-main"><div className="workspace-title"><div><span className="eyebrow">策略实验 / 春季质量观察</span><h1>自动决策工作台</h1></div><div className="workspace-actions"><span className="memory-badge">● 内存草稿</span><button className="ghost-button" onClick={reset}>重新开始</button></div></div><div className="workspace-grid"><section className="workspace-config"><div className="panel-title"><b>实验配置</b><span>{stage === "setup" ? "开始前可调整" : "运行中已锁定"}</span></div><label>历史起点<select disabled={stage !== "setup"} defaultValue="2024-03-29"><option>2024-03-29 · 收盘后</option></select></label><label>观察期限<select disabled={stage !== "setup"} defaultValue="7"><option value="7">1 周（合成样本 7 日）</option></select></label><div className="panel-title strategy-title"><b>策略包</b><span>已选 1</span></div>{STRATEGIES.map(s => <button key={s.id} disabled={stage !== "setup" || s.id === "value"} className={`workspace-strategy ${selectedStrategy === s.id ? "selected" : ""}`} onClick={() => setSelectedStrategy(s.id)}><span className="strategy-icon" style={{ background: s.color }}>{s.id === "quality" ? "✦" : "◒"}</span><span><b>{s.name}</b><small>{s.id === "value" ? "仅结果对照" : s.tag + " · 运行前可选"}</small></span></button>)}<div className="config-summary"><span>初始资金<b>¥100,000</b></span><span>目标持仓<b>90%</b></span><span>规则版本<b>v1.2</b></span></div><button className="primary-button full-button" onClick={() => setStage(stage === "setup" ? "preview" : "replay")}>{stage === "setup" ? "生成组合预览" : "回到运行"}<span>→</span></button></section><section className="workspace-center"><div className="center-header"><div><span className="eyebrow">{strategy.name} · {stageLabels[stage]}</span><h2>{DAYS[displayDay].date} <small>第 {displayDay}/7 个合成日</small></h2></div><span className={`status-pill ${day === 7 ? "done" : "running"}`}>{day === 7 ? "已完成" : viewDay < day ? "历史回看" : playing ? "播放中" : "等待推进"}</span></div><div className="workspace-chart"><Chart day={displayDay} /><div className="chart-legend"><span><i className="legend-line" />组合净值</span><span>{day === 7 ? "全部演示日已揭示" : "未来（未揭示）"}</span></div></div><Holdings day={displayDay} /><div className="center-controls">{viewDay < day && <button className="secondary-button" onClick={() => setViewDay(day)}>回到当前</button>}<button className="secondary-button" disabled={stage !== "replay" || day >= 7 || viewDay < day} onClick={() => setPlaying(!playing)}>{playing ? "暂停" : "播放"}</button><button className="primary-button" disabled={stage !== "replay" || day >= 7 || viewDay < day} onClick={() => { setStage("replay"); setViewDay(Math.min(7, day + 1)); setDay(Math.min(7, day + 1)); }}>下一日 <span>→</span></button><button className="secondary-button" onClick={() => setStage("list")}>返回实验列表</button><span className="subtle">{DAYS[displayDay].note}</span></div></section><section className="workspace-events"><div className="panel-title"><b>事件时间线</b><span>已揭示 {day}/7</span></div>{DAYS.slice(0, Math.max(1, day + 1)).slice(-4).map(d => <button key={d.day} className={`timeline-event ${d.day === displayDay ? "active" : ""}`} onClick={() => { setPlaying(false); setViewDay(d.day); }}><span className="timeline-dot" /><span><b>{d.date}</b><small>{d.day === 0 ? "历史起点" : d.day === 5 ? "自动调仓" : d.day === 7 ? "期末结果" : "每日估值"}</small></span><em>{d.day === 0 ? "—" : d.day === 5 ? "↻" : "·"}</em></button>)}{displayDay >= 5 && <div className="event-detail"><span className="event-icon">↻</span><b>策略自动调仓</b><p>风险预算变化，目标仓位已更新。无须人工批准。</p></div>}{day === 7 && <button className="result-link" onClick={() => setStage("results")}>查看结果对比 →</button>}</section></div><div className="workspace-foot"><span><b>演示数据</b> · 未来信息隐藏 · 刷新重置</span><span>运行游标 {day}/7 · {stageLabels[stage]}</span></div></main>;
}
