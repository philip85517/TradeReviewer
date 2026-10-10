"use client";

import { useMemo, useRef, useState, type ComponentProps, type RefObject } from "react";

import { ChartToolbar } from "../chart/chart-toolbar";
import { DrawingToolbar } from "../chart/drawing-toolbar";
import { ReplayChart } from "../chart/replay-chart";
import { useFullscreen } from "../chart/use-fullscreen";
import { ScopeChoiceGroup, ScopeSelect } from "../scope/scope-control-primitives";
import { RoomHoldingsHistory } from "../dashboard/room-holdings-history";
import { RoomPortfolioSummary } from "../dashboard/room-portfolio-summary";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import { applyDrawingCommand, createDrawingHistory, redoDrawingCommand, undoDrawingCommand, type DrawingCommand } from "../../lib/chart/drawing-commands";
import type { DrawingTool, NormalizedDrawing } from "../../lib/chart/drawings";
import type { RoomDisplayCurrency } from "../../lib/reviews/trading-room-scope";
import type { SearchableInstrument } from "../chart/instrument-search-popover";
import type { MarketDataDetails } from "../chart/market-data-popover";
import styles from "./design-system-prototype.module.css";
import {
  DESIGN_EPISODE_ID,
  DESIGN_KNOWN_WINDOW,
  DESIGN_TIMEFRAME,
  designFixture,
  filterDesignFixture,
  fullOriginalNote,
  deriveDesignHomeModels,
  phaseMeta,
  type DesignPhase,
} from "./design-system-fixture";

type View = "home" | "review";
type Variant = "baseline" | "recommended";
type ReplayProps = ComponentProps<typeof ReplayChart>;

const initialSettings: ChartSettings = {
  version: 1,
  showGrid: true,
  showVolume: true,
  showExecutions: true,
  showAverageCost: true,
  colorScheme: "teal-red",
};

const initialHome = deriveDesignHomeModels();

const timeframeAvailability = {
  "15m": { enabled: false, reason: "合成样例只提供日线行情" },
  "1h": { enabled: false, reason: "合成样例只提供日线行情" },
  "4h": { enabled: false, reason: "合成样例只提供日线行情" },
  "1D": { enabled: true },
  "1W": { enabled: false, reason: "合成样例只提供日线行情" },
} as const;

const dataDetails: MarketDataDetails[] = [{
  providerLabel: "合成 fixture",
  nativeInterval: "1D",
  coverageStart: "2026-05-04",
  coverageEnd: "2026-08-21",
  fetchedAt: "2026-10-07T00:00:00.000Z",
  status: "ready",
  limitationReason: "固定本地样板，不连接行情源",
  availableTimeframes: ["1D"],
}];

const searchableInstrument: SearchableInstrument = {
  id: designFixture.instrument.id,
  name: designFixture.instrument.name,
  symbol: designFixture.instrument.symbol,
  market: designFixture.instrument.market,
};

type DrawingStage = NormalizedDrawing["stage"];

function stageForPhase(phase: DesignPhase): DrawingStage {
  return phase === "pre-entry" ? "pre-trade" : phase === "holding" ? "during-replay" : "post-review";
}

function isCurrentStageDrawing(
  drawing: NormalizedDrawing,
  phase: DesignPhase,
  originalIds: Set<string>,
  visibleDrawings: readonly NormalizedDrawing[],
) {
  return !originalIds.has(drawing.id)
    && drawing.stage === stageForPhase(phase)
    && visibleDrawings.some((visible) => visible.id === drawing.id);
}

function safeCommand(
  command: DrawingCommand,
  phase: DesignPhase,
  originalIds: Set<string>,
  visibleDrawings: readonly NormalizedDrawing[],
) {
  const currentStageIds = new Set(
    visibleDrawings
      .filter((drawing) => isCurrentStageDrawing(drawing, phase, originalIds, visibleDrawings))
      .map((drawing) => drawing.id),
  );
  if (command.type === "add") return command;
  if (command.type === "clear-unlocked") {
    return [...currentStageIds].some((id) => visibleDrawings.find((drawing) => drawing.id === id)?.locked === false)
      ? command
      : null;
  }
  if (command.type === "set-locked") {
    const ids = command.ids.filter((id) => currentStageIds.has(id));
    return ids.length > 0 ? { ...command, ids } : null;
  }
  const id = command.type === "replace" ? command.drawing.id : command.id;
  return currentStageIds.has(id) ? command : null;
}

function commandRejectionReason(
  command: DrawingCommand,
  phase: DesignPhase,
  originalIds: Set<string>,
  visibleDrawings: readonly NormalizedDrawing[],
) {
  if (command.type === "clear-unlocked" || command.type === "set-locked") {
    return "仅当前可见且当前阶段的补记允许清空或锁定：工具动作已拒绝";
  }
  if (command.type === "add") return "新补记未被拒绝：工具动作已接受";
  const id = command.type === "replace" ? command.drawing.id : command.id;
  if (originalIds.has(id)) return "原判断只读：工具动作已拒绝";
  const target = visibleDrawings.find((drawing) => drawing.id === id);
  if (target && target.stage !== stageForPhase(phase)) {
    return "旧阶段绘图只读：已保留形成阶段、形成游标与原文内容";
  }
  return "仅当前可见且当前阶段的补记允许修改：工具动作已拒绝";
}

export function DesignSystemPrototype() {
  const [view, setView] = useState<View>("home");
  const [variant, setVariant] = useState<Variant>("recommended");
  const [phase, setPhase] = useState<DesignPhase>("holding");
  const [marketDay, setMarketDay] = useState(69);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [settings, setSettings] = useState(initialSettings);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>("holding-text");
  const [drawingHistory, setDrawingHistory] = useState(() => createDrawingHistory([...designFixture.originalDrawings, ...designFixture.supplementalDrawings]));
  const [layersOpen, setLayersOpen] = useState(false);
  const [scopeKind, setScopeKind] = useState("all");
  const [reportCurrency, setReportCurrency] = useState<RoomDisplayCurrency>("original");
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(designFixture.instrument.id);
  const [updateState, setUpdateState] = useState("样板数据已加载");
  const [focusDemo, setFocusDemo] = useState(false);
  const [hasSeenFuture, setHasSeenFuture] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const originalFocusRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(fullscreenRef as RefObject<HTMLElement | null>);
  const originalIds = useMemo(() => new Set(designFixture.originalDrawings.map((drawing) => drawing.id)), []);

  const replay = useMemo(() => {
    const boundedDay = phase === "post-review" ? 80 : Math.min(marketDay, phase === "holding" ? 73 : phaseMeta[phase].marketCutoffDay);
    return filterDesignFixture(phase, boundedDay, drawingHistory.present);
  }, [drawingHistory.present, marketDay, phase]);
  const effectiveSelectedDrawingId = selectedDrawingId && replay.drawings.some((drawing) => drawing.id === selectedDrawingId)
    ? selectedDrawingId
    : replay.drawings.at(-1)?.id ?? null;
  const visibleOriginalNote = fullOriginalNote;
  const phaseDescription = phaseMeta[phase].description;
  const stageLimit = phase === "pre-entry" ? 60 : phase === "holding" ? 73 : 80;
  const canNextBar = phase !== "post-review" && replay.day < stageLimit;

  const onCommand = (command: DrawingCommand) => {
    const safe = safeCommand(command, phase, originalIds, replay.drawings);
    if (!safe) {
      setUpdateState(commandRejectionReason(command, phase, originalIds, replay.drawings));
      return;
    }
    if (safe.type === "clear-unlocked") {
      const currentIds = new Set(replay.drawings
        .filter((drawing) => isCurrentStageDrawing(drawing, phase, originalIds, replay.drawings) && !drawing.locked)
        .map((drawing) => drawing.id));
      setDrawingHistory((history) => [...currentIds].reduce(
        (next, id) => applyDrawingCommand(next, { type: "delete", id }, replay.cursor),
        history,
      ));
      setUpdateState("已清除当前阶段未锁定补记");
      return;
    }
    const stamped = safe.type === "add" || safe.type === "replace"
      ? {
        ...safe,
        drawing: (() => {
          const existing = safe.type === "replace"
            ? drawingHistory.present.find((drawing) => drawing.id === safe.drawing.id)
            : undefined;
          const markAsSupplement = safe.drawing.tool === "text" && (phase === "post-review" || hasSeenFuture);
          return {
            ...safe.drawing,
            name: markAsSupplement && !safe.drawing.name.includes("复盘补记")
              ? `${safe.drawing.name} · 复盘补记`
              : safe.drawing.name,
            stage: existing?.stage ?? stageForPhase(phase),
            createdAtCursor: existing?.createdAtCursor ?? replay.cursor,
            recallHasSeenFuture: Boolean(existing?.recallHasSeenFuture)
              || hasSeenFuture
              || Boolean(safe.drawing.recallHasSeenFuture)
              || phase === "post-review",
          };
        })(),
      }
      : safe;
    setDrawingHistory((history) => applyDrawingCommand(
      history,
      stamped,
      stamped.type === "replace" ? undefined : replay.cursor,
    ));
  };

  const renderHome = () => <main className={styles.home}>
    <div className={styles.homeIntro}>
      <div>
        <p className={styles.eyebrow}>TradeReview · 样板校准</p>
        <h1>先看账户上下文，再进入逐步复盘</h1>
        <p className={styles.lede}>同一份固定合成数据贯穿首页摘要与图表工作区。未知字段保持未知，刷新页面即可复位。</p>
      </div>
      <button className={styles.updateButton} type="button" onClick={() => { setUpdateState("样板更新中…"); window.setTimeout(() => setUpdateState("模拟更新完成（样板）"), 700); }}>模拟更新（样板）</button>
    </div>
      <section className={styles.scopePanel} aria-label="样板范围">
      <div className={styles.panelHeader}><div><span className={styles.sectionKicker}>范围</span><h2>合成账户摘要</h2></div><span className={styles.fixtureBadge}>固定 fixture · 未写入数据</span></div>
      <div className={styles.scopeControls}>
        <ScopeChoiceGroup mode="segmented" ariaLabel="样板范围模式" value={scopeKind} onChange={setScopeKind} options={[{ value: "all", label: "全部样本" }, { value: "current", label: "当前持仓" }]} size="compact" />
        <ScopeChoiceGroup mode="segmented" ariaLabel="样式比较" value={variant} onChange={(value) => setVariant(value as Variant)} options={[{ value: "baseline", label: "同内容样式基线" }, { value: "recommended", label: "推荐规范" }]} size="compact" />
        <ScopeSelect label="报告币种" ariaLabel="报告币种" value={reportCurrency} onChange={(value) => setReportCurrency(value as RoomDisplayCurrency)} options={[{ value: "original", label: "原币" }, { value: "CNY", label: "人民币" }]} layout="inline" fieldId="currency" />
      </div>
      <div className={styles.homeSummary}><RoomPortfolioSummary model={initialHome.portfolio} reportCurrency={reportCurrency} dailyPnl={initialHome.dailyPnl} dailyPnlReason={initialHome.dailyPnlAvailable ? "由相邻同仓位估值推导" : initialHome.history.points.at(-1)?.dailyPnlReasons.join("、")} dailyReturnPercent={initialHome.dailyReturnPercent} dailyReturnPercentAvailable={initialHome.history.points.at(-1)?.dailyReturnPercentAvailable ?? false} dailyReturnPercentReasons={initialHome.history.points.at(-1)?.dailyReturnPercentReasons ?? []} /></div>
    </section>
    <section className={styles.historyPanel} aria-label="持仓历史样板"><div className={styles.panelHeader}><div><span className={styles.sectionKicker}>历史</span><h2>固定持仓历史摘录</h2></div><span className={styles.muted}>{initialHome.history.start}—{initialHome.history.end}</span></div><RoomHoldingsHistory model={initialHome.history} reportCurrency={reportCurrency} periodLabel="样板观察区间" /></section>
    <div className={styles.homeFooter}><span className={styles.liveStatus} role="status" aria-live="polite">{updateState}</span><button className={styles.primaryButton} type="button" onClick={() => setView("review")}>进入复盘工作区 <span aria-hidden="true">→</span></button></div>
  </main>;

  const renderReview = () => {
    const currentDrawings = replay.drawings;
    const planPriceLines: NonNullable<ReplayProps["planPriceLines"]> = [
      { id: "entry", price: 56, title: "入场" },
      { id: "stop", price: 52, title: "止损" },
      { id: "target", price: 68, title: "目标" },
    ];
    return <main className={styles.review} ref={fullscreenRef}>
      <div className={styles.reviewTopline}>
        <div><p className={styles.eyebrow}>图表优先复盘 · 样板</p><h1>趋势复盘合成样例 <span>SAMPLE / CN</span></h1></div>
        <div className={styles.topActions}><button type="button" className={styles.ghostButton} onClick={() => setView("home")}>← 首页摘要</button><button type="button" className={styles.ghostButton} onClick={() => { setView("review"); setVariant("recommended"); setPhase("holding"); setMarketDay(69); setResetEpoch((epoch) => epoch + 1); setSettings(initialSettings); setActiveTool("cursor"); setSelectedDrawingId("holding-text"); setDrawingHistory(createDrawingHistory([...designFixture.originalDrawings, ...designFixture.supplementalDrawings])); setLayersOpen(false); setScopeKind("all"); setReportCurrency("original"); setSelectedInstrumentId(designFixture.instrument.id); setUpdateState("样板数据已加载"); setFocusDemo(false); setHasSeenFuture(false); }}>刷新复位</button></div>
      </div>
      <div className={styles.reviewChoices}>
        <ScopeChoiceGroup mode="tabs" ariaLabel="工作区视图" value={view} onChange={(value) => setView(value as View)} options={[{ value: "home", label: "首页" }, { value: "review", label: "复盘工作区" }]} size="compact" />
        <ScopeChoiceGroup mode="segmented" ariaLabel="比较版本" value={variant} onChange={(value) => setVariant(value as Variant)} options={[{ value: "baseline", label: "同内容样式基线" }, { value: "recommended", label: "推荐规范" }]} size="compact" />
        <span className={styles.phaseReadout}>{phaseMeta[phase].label} · 行情 {replay.candles.at(-1)?.time.slice(0, 10)} 15:00 · 成交 {replay.executions.at(-1)?.executedAt.slice(0, 10) ?? "暂无"}{replay.executions.length ? " 16:00" : ""}（北京时间）</span>
      </div>
      <section className={styles.chartShell} aria-label="真实图表复盘工作区">
        <ChartToolbar key={`${DESIGN_EPISODE_ID}-${phase}-${resetEpoch}`} timeframe={DESIGN_TIMEFRAME} timeframeAvailability={timeframeAvailability} onTimeframeChange={() => setUpdateState("样板只支持日线周期")} instruments={[searchableInstrument]} onSelectInstrument={(id) => { setSelectedInstrumentId(id); setUpdateState("仍使用固定样板标的"); }} dataDetails={[{ ...dataDetails[0], coverageEnd: replay.candles.at(-1)?.time.slice(0, 10) }]} onRefreshMarketData={undefined} refreshDisabledReason="样板固定数据，不连接行情源" layersOpen={layersOpen} layersDisabledReason={undefined} onToggleLayers={() => setLayersOpen((open) => !open)} fullscreen={fullscreen} settings={settings} onSettingsChange={setSettings} symbol={selectedInstrumentId === designFixture.instrument.id ? designFixture.instrument.symbol : "SAMPLE"} instrumentName={designFixture.instrument.name} market={designFixture.instrument.market} />
        {layersOpen && <div className={styles.layersPanel} aria-label="当前可知图层"><strong>当前可知图层</strong>{currentDrawings.map((drawing) => <button type="button" key={drawing.id} className={drawing.id === effectiveSelectedDrawingId ? styles.layerSelected : styles.layerButton} onClick={() => setSelectedDrawingId(drawing.id)}><span>{drawing.name}</span><small>{drawing.recallHasSeenFuture ? "已见后续 · 复盘补记" : "当前已知"}</small></button>)}</div>}
        <div className={styles.chartContent}>
          <div className={styles.chartCanvas}><ReplayChart key={`${phase}-${resetEpoch}`} candles={replay.candles} executions={replay.executions} cursor={replay.cursor} averageCost={phase === "pre-entry" ? 0 : 56} planPriceLines={planPriceLines} drawings={currentDrawings} activeTool={activeTool} settings={settings} episodeId={DESIGN_EPISODE_ID} timeframe={DESIGN_TIMEFRAME} viewportKey={`${DESIGN_EPISODE_ID}-${phase}-${resetEpoch}`} focusRange={{ start: DESIGN_KNOWN_WINDOW.start, end: replay.candles.at(-1)?.time ?? DESIGN_KNOWN_WINDOW.start }} revealRequest={replay.day > 69 ? { id: replay.day, time: replay.candles.at(-1)?.time ?? replay.cursor } : undefined} selectedDrawingId={effectiveSelectedDrawingId} plannedRiskAmount="4000" currency="CNY" onSelectDrawing={setSelectedDrawingId} onCommand={onCommand} /></div>
          <aside className={styles.sideRail} aria-label="复盘阶段与说明">
            <div className={styles.phasePanel}><span className={styles.sectionKicker}>阶段</span><h2>阶段游标</h2><div className={styles.phaseList}>{(Object.keys(phaseMeta) as DesignPhase[]).map((candidate) => <button type="button" key={candidate} className={candidate === phase ? styles.phaseActive : styles.phaseButton} onClick={() => { if (candidate === "post-review") setHasSeenFuture(true); setDrawingHistory((history) => ({ ...history, past: [], future: [] })); setPhase(candidate); setMarketDay(phaseMeta[candidate].marketCutoffDay); }}>{phaseMeta[candidate].label}<small>{candidate === "pre-entry" ? "原稿" : candidate === "holding" ? "执行中" : "结果"}</small></button>)}</div><p className={styles.helper}>{phaseDescription}</p></div>
            <div className={styles.notePanel}><span className={styles.sectionKicker}>关联阅读</span><h2>关联原判断</h2><div ref={originalFocusRef} className={styles.readonlyNote} role="textbox" aria-readonly="true" tabIndex={0} aria-label="只读原判断">{visibleOriginalNote}</div><button type="button" className={styles.focusButton} onClick={() => { setSelectedDrawingId("original-text"); originalFocusRef.current?.focus(); setFocusDemo(typeof document !== "undefined" && document.activeElement === originalFocusRef.current); }}>聚焦只读原判断</button>{focusDemo && <span className={styles.focusHint}>已获得真实 DOM 焦点 · 图中已选中原判断</span>}{phase !== "pre-entry" && (() => { const supplementId = phase === "post-review" ? "post-review-text" : "holding-text"; const supplement = currentDrawings.find((drawing) => drawing.id === supplementId); return supplement ? <div className={styles.supplementBlock}><span className={styles.supplementLabel}>{phase === "post-review" ? "结果补记 · 已见未来" : "当前补充"}</span><p className={styles.supplementText}>{supplement.text ?? ""}</p><button type="button" className={styles.focusButton} onClick={() => setSelectedDrawingId(supplement.id)}>在图中选择此补记</button></div> : null; })()}</div>
            <div className={styles.cutoffPanel}><strong>可见范围</strong><span>行情：D{replay.day} · 知识边界：{replay.candles.at(-1)?.time.slice(0, 10)} 15:00（北京时间）</span><span>执行截止：{replay.executions.at(-1)?.executedAt.slice(0, 10) ?? "暂无"}{replay.executions.length ? " 16:00（北京时间）" : ""}</span><span>执行：{replay.executions.length ? replay.executions.map((item) => item.id === "sample-buy" ? "买入" : item.id === "sample-reduce" ? "减仓" : "退出").join("、") : "暂无已知执行"}</span><span>当前已知窗口：2026-05-04—{replay.candles.at(-1)?.time.slice(0, 10) ?? "待揭示"}</span></div>
          </aside>
        </div>
        <div className={styles.drawingRow}><DrawingToolbar key={`${phase}-${resetEpoch}`} compact activeTool={activeTool} canUndo={drawingHistory.past.length > 0} canRedo={drawingHistory.future.length > 0} allLocked={currentDrawings.filter((drawing) => isCurrentStageDrawing(drawing, phase, originalIds, currentDrawings)).length > 0 && currentDrawings.filter((drawing) => isCurrentStageDrawing(drawing, phase, originalIds, currentDrawings)).every((drawing) => drawing.locked)} onToolChange={setActiveTool} onUndo={() => setDrawingHistory(undoDrawingCommand)} onRedo={() => setDrawingHistory(redoDrawingCommand)} onClear={() => onCommand({ type: "clear-unlocked" })} onToggleLock={() => { const editable = currentDrawings.filter((drawing) => isCurrentStageDrawing(drawing, phase, originalIds, currentDrawings)); onCommand({ type: "set-locked", ids: editable.map((drawing) => drawing.id), locked: editable.length > 0 && !editable.every((drawing) => drawing.locked) }); }} /></div>
        <div className={styles.reviewControls}><button type="button" className={styles.ghostButton} disabled={!canNextBar} title={!canNextBar ? `当前阶段最多揭示到 D${stageLimit}；请切换阶段` : undefined} onClick={() => { const nextDay = Math.min(stageLimit, replay.day + 1); if (nextDay <= replay.day) return; setMarketDay(nextDay); setUpdateState(`已揭示下一根 K 线 D${nextDay}（样板）`); }}>揭示下一根 K 线</button><span className={styles.liveStatus} aria-live="polite">{updateState}</span><span className={styles.reviewLegend}>原判断只读 · 补充文本标记“复盘补记” · 未知 ≠ 0</span></div>
      </section>
    </main>;
  };

  return <div className={`${styles.root} ${variant === "recommended" ? styles.recommended : styles.baseline}`}>{view === "home" ? renderHome() : renderReview()}</div>;
}
