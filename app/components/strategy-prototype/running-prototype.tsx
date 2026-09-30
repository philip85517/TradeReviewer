"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { StrategyId } from "./creation-prototype";
import { ComparisonPrototype, type ComparisonMode, type ComparisonPortfolio } from "./comparison-prototype";
import { ResultsPrototype } from "./results-prototype";
import {
  RecoveryPrototype,
  type RecoveryBulkState,
  type RecoveryCheckpointState,
  type RecoveryDemoState,
  type RecoveryExecutionOutcome,
  type RecoveryFaultMode,
  type RecoveryIncidentState,
  type RecoveryLaggingState,
} from "./recovery-prototype";
import {
  buildLedger,
  DEMO_PORTFOLIO_IDS,
  nextExecutionCursor,
  STRATEGY_PORTFOLIO_IDS,
  makeCalendar,
  portfolioMetrics,
  STRATEGY_NAMES,
  SYMBOL_IDS,
  T0_CURSOR,
  type Bar,
  type ExecutionOverride,
  type PortfolioIdentity,
  type PortfolioId,
  type RunningDraft,
  type RuntimeProgress,
  type SourceExposure,
  type Snapshot,
  type SymbolId,
  type Trade,
  type TradeEvent,
} from "./running-model";
import "./running-prototype.css";

export type { RunningDraft } from "./running-model";
export type { RuntimeProgress, SourceExposure } from "./running-model";

type ChartMode = "value" | "price";
type DrawerState = { kind: "event"; event: TradeEvent; origin?: "results" | "comparison" } | { kind: "config" } | null;
type RevealSource = { date: string; source: "manual" | "playback" | "bulk" | "results" | "comparison"; time: string };
type ViewportRange = { from: number; to: number };
type RecoveryBulkPhase = "idle" | "confirming" | "expanding";
type RecoveryFaultArm = { mode: Exclude<RecoveryFaultMode, "none">; portfolioId: PortfolioId; cursor: number };
type RecoveryOutcomeArm = { kind: ExecutionOverride["kind"]; cursor: number; portfolioId: PortfolioId };
type RuntimeIncident = {
  portfolioId: PortfolioId;
  cursor: number;
  mode: Exclude<RecoveryFaultMode, "none">;
  excluded: boolean;
};
type ProcessContext = {
  portfolioId: PortfolioId;
  maxCursor: number;
  viewCursor: number;
  mode: ChartMode;
  symbol: SymbolId;
  selectedHolding: SymbolId | null;
  viewportRange: ViewportRange | null;
};
type ComparisonContext = {
  source: "process" | "results";
  process: ProcessContext;
};
type RuntimeCheckpoint = {
  cursors: { max: number; view: number };
  portfolioMaxCursors: Partial<Record<PortfolioId, number>>;
  excludedPortfolioIds: PortfolioId[];
  overridesByPortfolio: Partial<Record<PortfolioId, ExecutionOverride[]>>;
  armedFault: RecoveryFaultArm | null;
  armedOutcome: RecoveryOutcomeArm | null;
  incident: RuntimeIncident | null;
  selectedPortfolioId: PortfolioId;
  mode: ChartMode;
  symbol: SymbolId;
  selectedHolding: SymbolId | null;
  shownDemoIds: PortfolioId[];
  viewportRange: ViewportRange | null;
  revealSource: RevealSource | null;
};

function money(value: number): string {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function percent(value: number): string {
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}
function eventType(event: TradeEvent): string {
  if (event.executionStatus === "unfilled") return "未执行";
  if (event.executionStatus === "partial") return "部分成交";
  return event.cursor === T0_CURSOR + 1 ? "首次建仓" : "再平衡";
}
function eventSummary(event: TradeEvent): string {
  if (event.executionStatus === "unfilled") return "目标未成交 · 实际账本未改变";
  if (event.executionStatus === "partial") return "目标仅部分成交 · 按实际数量估值";
  return event.cursor === T0_CURSOR + 1 ? "初始目标已执行" : "策略按预设调整仓位";
}
function exposureSourceLabel(source: RevealSource["source"]): string {
  return source === "manual" ? "逐日推进"
    : source === "playback" ? "自动播放"
    : source === "bulk" ? "快速展开"
    : source === "comparison" ? "组合比较"
    : "结果回看";
}
function partialCoverageSummary(selected: readonly StrategyId[]): string {
  const usesEma = selected.includes("ema");
  const usesQuality = selected.includes("quality");
  if (usesEma && usesQuality) {
    return "C 缺财报首次披露时间，仅低波动质量包无法评估 C；D 缺历史成交额，仅 EMA20 包无法评估 D。另一包仍按自身依赖评估，缺失项不计作规则不符。";
  }
  if (usesEma) {
    return "本次 EMA20 包：D 缺历史成交额，未纳入评估；C 缺财报披露时间与此包无关，仍按 EMA20 规则评估。缺失项不计作规则不符。";
  }
  if (usesQuality) {
    return "本次低波动质量包：C 缺财报首次披露时间，未纳入评估；D 缺历史成交额与此包无关，仍按质量规则评估。缺失项不计作规则不符。";
  }
  return "C 缺财报首次披露时间（仅质量包无法评估）；D 缺历史成交额（仅 EMA20 包无法评估）。缺失项不计作规则不符。";
}
const DEMO_PORTFOLIOS: PortfolioIdentity[] = [
  { id: DEMO_PORTFOLIO_IDS.longName, name: "展示样例 · 低波动质量与现金管理长名称组合", strategy: "quality", demoOnly: true, capitalMultiplier: 0.8 },
  { id: DEMO_PORTFOLIO_IDS.extraEma, name: "展示样例 · EMA 趋势观察组合二", strategy: "ema", demoOnly: true, capitalMultiplier: 1.1 },
  { id: DEMO_PORTFOLIO_IDS.extraQuality, name: "展示样例 · 低波动质量观察组合三", strategy: "quality", demoOnly: true, capitalMultiplier: 1.25 },
  { id: DEMO_PORTFOLIO_IDS.extraBalanced, name: "展示样例 · EMA 与现金配置组合四", strategy: "ema", demoOnly: true, capitalMultiplier: 0.9 },
];
function strategyPortfolio(id: StrategyId): PortfolioIdentity {
  return {
    id: STRATEGY_PORTFOLIO_IDS[id],
    name: STRATEGY_NAMES[id],
    strategy: id,
    demoOnly: false,
    capitalMultiplier: 1,
  };
}
function initialPortfolioCursors(draft: RunningDraft): Partial<Record<PortfolioId, number>> {
  const cursors: Partial<Record<PortfolioId, number>> = {};
  for (const strategy of draft.selected) cursors[STRATEGY_PORTFOLIO_IDS[strategy]] = T0_CURSOR;
  return cursors;
}
function laterExposure(current: RevealSource | null, candidate: RevealSource | null): RevealSource | null {
  if (!current) return candidate;
  if (!candidate || current.date >= candidate.date) return current;
  return candidate;
}
function maxCursorForPortfolio(
  globalMaxCursor: number,
  portfolioMaxCursors: Partial<Record<PortfolioId, number>>,
  portfolioId: PortfolioId,
): number {
  return Math.min(globalMaxCursor, portfolioMaxCursors[portfolioId] ?? globalMaxCursor);
}
function comparisonExposure(current: RevealSource | null, requestedDate: string): RevealSource {
  return {
    date: current && current.date > requestedDate ? current.date : requestedDate,
    source: "comparison",
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }),
  };
}
function revealPortfolioTab(tabs: Map<PortfolioId, HTMLButtonElement>, id: PortfolioId, focus = false): void {
  window.requestAnimationFrame(() => {
    const tab = tabs.get(id);
    const scroller = tab?.closest<HTMLElement>(".portfolio-tabs");
    if (!tab || !scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const visibleLeft = scrollerRect.left + scroller.clientLeft;
    const visibleRight = visibleLeft + scroller.clientWidth;
    const tabRect = tab.getBoundingClientRect();
    if (tabRect.left < visibleLeft) scroller.scrollLeft += tabRect.left - visibleLeft;
    else if (tabRect.right > visibleRight) scroller.scrollLeft += tabRect.right - visibleRight;
    if (focus) tab.focus({ preventScroll: true });
  });
}
function makeRuntimeProgress(status: string, knownDate: string, viewDate: string, completed: boolean, revealSource: RevealSource | null): RuntimeProgress {
  return {
    status,
    knownDate,
    viewDate,
    completed,
    ...(revealSource ? {
      exposure: {
        date: revealSource.date,
        source: revealSource.source === "manual" ? "逐日推进"
          : revealSource.source === "playback" ? "自动播放"
          : revealSource.source === "bulk" ? "快速展开"
          : revealSource.source === "comparison" ? "组合比较"
          : "结果回看",
        time: revealSource.time,
      },
    } : {}),
  };
}
function logicalRangeFor(mode: ChartMode, count: number): ViewportRange {
  const windowSize = mode === "price" ? 72 : 36;
  return { from: Math.max(0, count - windowSize), to: count + 2 };
}
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest("input, textarea, select, [role='textbox']"));
}
function isShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  return Boolean(target.closest("button, a, [role='button'], input, textarea, select, [contenteditable='true']"));
}

function MarketChart({ bars, snapshots, cursor, mode, t0Date, focusRevision, flashCursor, initialViewport, onViewportChange, viewLabel }: {
  bars: Bar[];
  snapshots: Snapshot[];
  cursor: number;
  mode: ChartMode;
  t0Date: string;
  focusRevision: number;
  flashCursor: number | null;
  initialViewport: ViewportRange | null;
  onViewportChange: (range: ViewportRange) => void;
  viewLabel: "V" | "Mᵢ";
}) {
  const root = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const markersPlugin = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const viewport = useRef<ViewportRange | null>(null);
  const lastFocusRevision = useRef<number | null>(null);
  const lastMode = useRef<ChartMode | null>(null);
  const displayRef = useRef({ bars, snapshots, cursor, t0Date, mode, focusRevision });
  const initialViewportRef = useRef<ViewportRange | null>(initialViewport);
  const onViewportChangeRef = useRef(onViewportChange);
  const updateAnnotations = useRef<() => void>(() => undefined);
  const [ruleCoordinates, setRuleCoordinates] = useState<{ t0: number | null; view: number | null }>({ t0: null, view: null });
  const [highlightPoint, setHighlightPoint] = useState<{ cursor: number; x: number; y: number } | null>(null);
  const visibleBars = useMemo(() => bars.slice(0, cursor + 1), [bars, cursor]);
  const visibleSnapshots = useMemo(() => snapshots.slice(0, cursor - T0_CURSOR + 1), [cursor, snapshots]);
  const currentDate = visibleSnapshots.at(-1)?.date ?? t0Date;
  const visibleEvents = useMemo(() => visibleSnapshots.at(-1)?.events ?? [], [visibleSnapshots]);

  useEffect(() => {
    displayRef.current = { bars, snapshots, cursor, t0Date, mode, focusRevision };
    initialViewportRef.current = initialViewport;
    onViewportChangeRef.current = onViewportChange;
  }, [bars, cursor, focusRevision, initialViewport, mode, onViewportChange, snapshots, t0Date]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let disposed = false;
    const instance = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { color: "#111b2b" }, textColor: "#91a4bd", fontSize: 12 },
      grid: { vertLines: { color: "#20324a" }, horzLines: { color: "#20324a" } },
      rightPriceScale: { borderColor: "#2a3d58", scaleMargins: { top: 0.14, bottom: 0.14 } },
      timeScale: { borderColor: "#2a3d58", timeVisible: false, rightOffset: 2, barSpacing: 10 },
      crosshair: { vertLine: { color: "#607994", labelBackgroundColor: "#233852" }, horzLine: { color: "#607994", labelBackgroundColor: "#233852" } },
    });
    chart.current = instance;
    const chartSeries = mode === "price"
      ? instance.addSeries(CandlestickSeries, {
          upColor: "#65c9a8", downColor: "#df7e87", borderVisible: false,
          wickUpColor: "#65c9a8", wickDownColor: "#df7e87",
        })
      : instance.addSeries(LineSeries, {
          color: "#61a8ff", lineWidth: 2,
          priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
          lastValueVisible: true,
        });
    series.current = chartSeries as ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;
    markersPlugin.current = createSeriesMarkers(chartSeries as ISeriesApi<"Candlestick">, []);
    if (mode === "value") {
      chartSeries.createPriceLine({
        price: 1,
        color: "#748ca9",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "T0 = 1",
      });
    }
    const updateRuleCoordinates = () => {
      if (disposed) return;
      const display = displayRef.current;
      const scale = instance.timeScale();
      const t0 = scale.timeToCoordinate((display.mode === "price" ? display.bars[T0_CURSOR]?.date : display.snapshots[0]?.date ?? display.t0Date) as Time);
      const view = scale.timeToCoordinate((display.mode === "price" ? display.bars[display.cursor]?.date : display.snapshots[display.cursor - T0_CURSOR]?.date ?? display.t0Date) as Time);
      setRuleCoordinates(previous => previous.t0 === t0 && previous.view === view ? previous : { t0, view });
      const point = display.mode === "price" ? display.bars[display.cursor] : display.snapshots[display.cursor - T0_CURSOR];
      const price = point ? display.mode === "price" ? (point as Bar).close : (point as Snapshot).netValue : null;
      const x = point ? scale.timeToCoordinate(point.date as Time) : null;
      const y = price === null ? null : series.current?.priceToCoordinate(price) ?? null;
      setHighlightPoint(previous => previous?.cursor === display.cursor && previous.x === x && previous.y === y ? previous : x !== null && y !== null ? { cursor: display.cursor, x, y } : null);
    };
    updateAnnotations.current = updateRuleCoordinates;
    const rangeChanged = (range: LogicalRange | null) => {
      if (!disposed && range) {
        viewport.current = range;
        onViewportChangeRef.current(range);
        window.requestAnimationFrame(updateRuleCoordinates);
      }
    };
    instance.timeScale().subscribeVisibleLogicalRangeChange(rangeChanged);
    viewport.current = initialViewportRef.current;
    lastFocusRevision.current = initialViewportRef.current ? displayRef.current.focusRevision : null;
    lastMode.current = mode;
    const observer = new ResizeObserver(() => {
      if (!disposed && container.clientWidth > 0 && container.clientHeight > 0) {
        instance.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        const savedRange = viewport.current ?? initialViewportRef.current;
        if (savedRange) instance.timeScale().setVisibleLogicalRange(savedRange);
        window.requestAnimationFrame(updateRuleCoordinates);
      }
    });
    observer.observe(container);
    return () => {
      disposed = true;
      observer.disconnect();
      instance.timeScale().unsubscribeVisibleLogicalRangeChange(rangeChanged);
      updateAnnotations.current = () => undefined;
      markersPlugin.current = null;
      chart.current = null;
      series.current = null;
      instance.remove();
    };
  }, [mode]);

  useEffect(() => {
    const instance = chart.current;
    const currentSeries = series.current;
    if (!instance || !currentSeries) return;
    const data = mode === "price" ? visibleBars : visibleSnapshots.map(snapshot => ({ time: snapshot.date as Time, value: snapshot.netValue }));
    if (mode === "price") (currentSeries as ISeriesApi<"Candlestick">).setData(data as Bar[]);
    else (currentSeries as ISeriesApi<"Line">).setData(data as { time: Time; value: number }[]);

    const markers: SeriesMarker<Time>[] = [];
    const chartT0Time = (mode === "price" ? bars[T0_CURSOR]?.date : visibleSnapshots[0]?.date ?? t0Date) as Time;
    markers.push({ time: chartT0Time, position: "belowBar", shape: "circle", color: "#c5a85a", text: "T0", size: 1 });
    for (const event of visibleEvents) {
      markers.push({
        time: event.date as Time,
        position: "aboveBar",
        shape: event.cursor === T0_CURSOR + 1 ? "arrowUp" : "circle",
        color: "#8eb7e8",
        text: eventType(event),
        size: 1,
      });
    }
    markers.sort((left, right) => String(left.time).localeCompare(String(right.time)));
    markersPlugin.current?.setMarkers(markers);

    const timeScale = instance.timeScale();
    const targetIndex = mode === "price" ? cursor : cursor - T0_CURSOR;
    const focusChanged = lastFocusRevision.current !== focusRevision || lastMode.current !== mode;
    if (focusChanged) {
      const range = logicalRangeFor(mode, targetIndex + 1);
      timeScale.setVisibleLogicalRange(range);
      viewport.current = range;
      lastFocusRevision.current = focusRevision;
      lastMode.current = mode;
    } else if (viewport.current ?? initialViewport) {
      const savedRange = viewport.current ?? initialViewport;
      if (savedRange) {
        viewport.current = savedRange;
        timeScale.setVisibleLogicalRange(savedRange);
      }
    } else {
      const range = logicalRangeFor(mode, targetIndex + 1);
      timeScale.setVisibleLogicalRange(range);
      viewport.current = range;
    }
    window.requestAnimationFrame(() => updateAnnotations.current());
  }, [bars, cursor, currentDate, focusRevision, initialViewport, mode, t0Date, visibleBars, visibleEvents, visibleSnapshots]);

  return <div className="running-chart-shell" aria-label={mode === "price" ? "合成标的真实日K线" : "组合净值真实折线"}>
    <div ref={root} className="running-chart" />
    <div className="chart-rule-overlay" aria-hidden="true">
      {flashCursor === cursor && cursor > T0_CURSOR && highlightPoint?.cursor === cursor && <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <circle key={`${mode}-${flashCursor}`} cx={highlightPoint.x} cy={highlightPoint.y} r="5" fill="none" stroke="#81bdff" strokeWidth="1.6">
          <animate attributeName="r" from="5" to="14" dur="1100ms" fill="freeze" />
          <animate attributeName="opacity" from="0.9" to="0" dur="1100ms" fill="freeze" />
        </circle>
      </svg>}
      {ruleCoordinates.t0 !== null && <span className="chart-time-rule t0-rule" style={{ left: ruleCoordinates.t0 }}><i>T0</i></span>}
      {ruleCoordinates.view !== null && cursor > T0_CURSOR && <span className="chart-time-rule view-rule" style={{ left: ruleCoordinates.view }}><i>{viewLabel}</i></span>}
    </div>
  </div>;
}

export type RunningPrototypeProps = {
  draft: RunningDraft;
  visible: boolean;
  onList: () => void;
  onReady: () => void;
  onStatus: (status: string) => void;
  experimentName?: string;
  sourceExposure?: SourceExposure;
  onProgress?: (progress: RuntimeProgress) => void;
  onDerive?: (progress: RuntimeProgress) => void;
  openResultsRequest?: number;
};

export function RunningPrototype({ draft, visible, onList, onReady, onStatus, experimentName, sourceExposure, onProgress, onDerive, openResultsRequest }: RunningPrototypeProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const drawerTitleId = `${instanceId}-drawer-title`;
  const calendar = useMemo(() => makeCalendar(draft), [draft]);
  const [cursors, setCursors] = useState({ max: T0_CURSOR, view: T0_CURSOR });
  const [portfolioMaxCursors, setPortfolioMaxCursors] = useState<Partial<Record<PortfolioId, number>>>(() => initialPortfolioCursors(draft));
  const [excludedPortfolioIds, setExcludedPortfolioIds] = useState<PortfolioId[]>([]);
  const [overridesByPortfolio, setOverridesByPortfolio] = useState<Partial<Record<PortfolioId, ExecutionOverride[]>>>({});
  const [armedOutcome, setArmedOutcome] = useState<RecoveryOutcomeArm | null>(null);
  const [armedFault, setArmedFault] = useState<RecoveryFaultArm | null>(null);
  const [incident, setIncident] = useState<RuntimeIncident | null>(null);
  const [bulkPhase, setBulkPhase] = useState<RecoveryBulkPhase>("idle");
  const [bulkStartCursor, setBulkStartCursor] = useState(T0_CURSOR);
  const [checkpoint, setCheckpoint] = useState<RuntimeCheckpoint | null>(null);
  const [checkpointState, setCheckpointState] = useState<"empty" | "saved" | "saveFailed">("empty");
  const [checkpointError, setCheckpointError] = useState<string | undefined>();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState("1x");
  const [mode, setMode] = useState<ChartMode>("value");
  const [symbol, setSymbol] = useState<SymbolId>("A");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<PortfolioId>(STRATEGY_PORTFOLIO_IDS[draft.selected[0] ?? "ema"]);
  const [selectedHolding, setSelectedHolding] = useState<SymbolId | null>(null);
  const [shownDemoIds, setShownDemoIds] = useState<PortfolioId[]>([]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [pendingSourceReturn, setPendingSourceReturn] = useState<"results" | "comparison" | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const [revealSource, setRevealSource] = useState<RevealSource | null>(null);
  const [flashCursor, setFlashCursor] = useState<number | null>(null);
  const [viewportRange, setViewportRange] = useState<ViewportRange | null>(null);
  const [showingResults, setShowingResults] = useState(false);
  const [showingComparison, setShowingComparison] = useState(false);
  const showingResultsRef = useRef(false);
  const showingComparisonRef = useRef(false);
  const [resultsEntryId, setResultsEntryId] = useState(0);
  const [resultsInitialCursor, setResultsInitialCursor] = useState(T0_CURSOR);
  const [comparisonEntryId, setComparisonEntryId] = useState(0);
  const [comparisonCursor, setComparisonCursor] = useState(T0_CURSOR);
  const [comparisonSyncCursor, setComparisonSyncCursor] = useState(T0_CURSOR);
  const comparisonCursorRef = useRef(T0_CURSOR);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("synchronized");
  const [comparisonPortfolioId, setComparisonPortfolioId] = useState<PortfolioId>(STRATEGY_PORTFOLIO_IDS[draft.selected[0] ?? "ema"]);
  const drawerTrigger = useRef<HTMLElement | null>(null);
  const drawerCloseButton = useRef<HTMLButtonElement>(null);
  const processRootRef = useRef<HTMLElement>(null);
  const priceTabRef = useRef<HTMLButtonElement>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const portfolioTabRefs = useRef(new Map<PortfolioId, HTMLButtonElement>());
  const resultContextRef = useRef<ProcessContext | null>(null);
  const resultSourceContextRef = useRef<ProcessContext | null>(null);
  const comparisonContextRef = useRef<ComparisonContext | null>(null);
  const comparisonDrawerOriginRef = useRef<ComparisonContext | null>(null);
  const comparisonTriggerRef = useRef<HTMLElement | null>(null);
  const returnToComparisonOnReopenRef = useRef(false);
  const lastOpenResultsRequestRef = useRef(0);
  const flashTimer = useRef<number | null>(null);
  const basePortfolios = useMemo(() => draft.selected.map(strategyPortfolio), [draft.selected]);
  const portfolios = useMemo(() => [
    ...basePortfolios,
    ...DEMO_PORTFOLIOS.filter(portfolio => shownDemoIds.includes(portfolio.id)),
  ], [basePortfolios, shownDemoIds]);
  const selectedPortfolio = portfolios.find(portfolio => portfolio.id === selectedPortfolioId) ?? basePortfolios[0] ?? strategyPortfolio("ema");
  const selected = selectedPortfolio.strategy;
  const selectedName = selectedPortfolio.name;
  const portfolioCapital = Number(draft.capital) * selectedPortfolio.capitalMultiplier;
  const portfolioDraft: RunningDraft = useMemo(() => ({
    ...draft,
    capital: String(portfolioCapital),
    selected: [selectedPortfolio.strategy],
  }), [draft, portfolioCapital, selectedPortfolio.strategy]);
  const selectableSymbols = SYMBOL_IDS;
  const chartSymbol = selectableSymbols.includes(symbol) ? symbol : selectableSymbols[0];
  const calendarEndDate = calendar.dates[calendar.endIndex];
  const activePortfolios = portfolios.filter(portfolio => !excludedPortfolioIds.includes(portfolio.id));
  const selectedExcluded = excludedPortfolioIds.includes(selectedPortfolio.id);
  const commonMaxCursor = portfolios.length > 0
    ? Math.min(...portfolios.map(portfolio => maxCursorForPortfolio(cursors.max, portfolioMaxCursors, portfolio.id)))
    : T0_CURSOR;
  const comparisonDisabledReason = portfolios.length < 2
    ? "至少需要两个组合才能比较"
    : commonMaxCursor <= T0_CURSOR && !portfolios.some(portfolio => maxCursorForPortfolio(cursors.max, portfolioMaxCursors, portfolio.id) > T0_CURSOR)
      ? "当前所有组合仍在 T0，暂无可分析区间"
      : undefined;
  const selectedMaxCursor = Math.min(cursors.max, portfolioMaxCursors[selectedPortfolio.id] ?? cursors.max);
  const selectedMaxDate = selectedMaxCursor === T0_CURSOR ? draft.date.slice(0, 10) : calendar.dates[selectedMaxCursor];
  const nextPlannedCursor = selectedExcluded ? null : nextExecutionCursor(calendar, selectedMaxCursor, portfolioDraft, selected);
  const nextExecutionDate = nextPlannedCursor === null ? null : calendar.dates[nextPlannedCursor];
  const selectedNextOutcome: RecoveryExecutionOutcome = armedOutcome?.portfolioId === selectedPortfolio.id && armedOutcome.cursor === nextPlannedCursor ? armedOutcome.kind : "filled";
  const unavailableAtView = cursors.view > selectedMaxCursor;
  const chartCursor = Math.min(cursors.view, selectedMaxCursor);
  const ledgers = useMemo(() => new Map<PortfolioId, Snapshot[]>(portfolios.map(portfolio => {
    const portfolioMaxCursor = Math.min(cursors.max, portfolioMaxCursors[portfolio.id] ?? cursors.max);
    const portfolioRunDraft: RunningDraft = {
      ...draft,
      capital: String(Number(draft.capital) * portfolio.capitalMultiplier),
      selected: [portfolio.strategy],
    };
    return [portfolio.id, buildLedger(calendar, portfolioMaxCursor, portfolioRunDraft, portfolio.strategy, overridesByPortfolio[portfolio.id] ?? [])];
  })), [calendar, cursors.max, draft, overridesByPortfolio, portfolioMaxCursors, portfolios]);
  const comparisonPortfolios = useMemo<ComparisonPortfolio[]>(() => portfolios.map(portfolio => {
    const capital = Number(draft.capital) * portfolio.capitalMultiplier;
    const portfolioDraft: RunningDraft = { ...draft, capital: String(capital), selected: [portfolio.strategy] };
    const failed = incident?.portfolioId === portfolio.id;
    const excluded = excludedPortfolioIds.includes(portfolio.id) || Boolean(failed && incident?.excluded);
    const failureDate = failed && incident
      ? incident.cursor === T0_CURSOR ? draft.date.slice(0, 10) : calendar.dates[incident.cursor]
      : undefined;
    return {
      id: portfolio.id,
      name: portfolio.name,
      strategy: portfolio.strategy,
      capital,
      draft: portfolioDraft,
      ledger: ledgers.get(portfolio.id) ?? [],
      maxCursor: maxCursorForPortfolio(cursors.max, portfolioMaxCursors, portfolio.id),
      status: excluded ? "excluded" as const : failed ? "failed" as const : "active" as const,
      ...(failureDate ? { failureDate } : {}),
    };
  }), [calendar.dates, cursors.max, draft, excludedPortfolioIds, incident, ledgers, portfolioMaxCursors, portfolios]);
  const ledger = ledgers.get(selectedPortfolio.id) ?? buildLedger(calendar, selectedMaxCursor, portfolioDraft, selected, overridesByPortfolio[selectedPortfolio.id] ?? []);
  const viewIndex = chartCursor - T0_CURSOR;
  const latestIndex = selectedMaxCursor - T0_CURSOR;
  const current = unavailableAtView ? null : ledger[viewIndex] ?? null;
  const lastComplete = ledger[latestIndex] ?? ledger[0];
  const latest = ledger[latestIndex];
  const metrics = current ? portfolioMetrics(ledger, viewIndex) : null;
  const reviewing = cursors.view < cursors.max;
  const atEnd = cursors.max === calendar.endIndex;
  const currentDate = current?.date ?? calendar.dates[cursors.view] ?? draft.date.slice(0, 10);
  const actualT0Date = draft.date.slice(0, 10);
  const knownDate = cursors.max === T0_CURSOR ? actualT0Date : calendar.dates[cursors.max];
  const knownEvents = latest.events;
  const displayEvents = current?.events ?? lastComplete.events;
  const previousEvent = [...knownEvents].reverse().find(event => event.cursor < cursors.view) ?? null;
  const nextKnownEvent = knownEvents.find(event => event.cursor > cursors.view) ?? null;
  const unresolvedIncident = incident !== null && !incident.excluded;
  const canAdvance = activePortfolios.length > 0 && !unresolvedIncident && cursors.view === cursors.max && !atEnd;
  const bulkDisabledReason = atEnd ? "已到计划结束日" : reviewing ? "先返回最新日期" : unresolvedIncident ? "先重试或排除失败组合" : activePortfolios.length === 0 ? "所有组合均已排除" : selectedExcluded ? "当前组合已排除，请切换到仍参与的组合后展开" : undefined;
  const dateForCursor = (cursor: number) => cursor === T0_CURSOR ? actualT0Date : calendar.dates[cursor];
  const recoveryBulk: RecoveryBulkState = {
    phase: bulkPhase,
    fromDate: dateForCursor(Math.min(bulkStartCursor + 1, calendar.endIndex)),
    endDate: calendar.nominalEnd,
    completedDays: Math.max(0, cursors.max - bulkStartCursor),
    totalDays: Math.max(0, calendar.endIndex - bulkStartCursor),
    canExpand: bulkDisabledReason === undefined,
    disabledReason: bulkDisabledReason,
  };
  const recoveryIncident: RecoveryIncidentState | null = incident ? {
    portfolioId: incident.portfolioId,
    portfolioName: portfolios.find(portfolio => portfolio.id === incident.portfolioId)?.name ?? incident.portfolioId,
    failedDate: dateForCursor(incident.cursor),
    lastCompleteDate: dateForCursor(Math.max(T0_CURSOR, incident.cursor - 1)),
    reason: incident.mode === "data-interruption" ? "模拟数据中断：该日未提交任何组合的新行情、持仓或事件。" : "模拟执行失败：该日全部组合保持在上一个完整账本边界。",
    excluded: incident.excluded,
  } : null;
  const recoveryLagging: RecoveryLaggingState | null = unavailableAtView ? {
    portfolioId: selectedPortfolio.id,
    portfolioName: selectedName,
    viewDate: dateForCursor(cursors.view),
    lastCompleteDate: selectedMaxDate,
  } : null;
  const recoveryCheckpoint: RecoveryCheckpointState = {
    state: checkpointState,
    savedDate: checkpoint ? dateForCursor(checkpoint.cursors.max) : null,
    localDate: knownDate,
    error: checkpointError,
  };
  const recoveryDemo: RecoveryDemoState = {
    faultMode: armedFault?.mode ?? "none",
    faultPortfolioName: armedFault ? portfolios.find(portfolio => portfolio.id === armedFault.portfolioId)?.name : undefined,
    faultDate: armedFault ? dateForCursor(armedFault.cursor) : undefined,
    selectedPortfolioName: selectedName,
    nextOutcome: selectedNextOutcome,
    nextExecutionDate,
    outcomeArm: armedOutcome ? {
      kind: armedOutcome.kind,
      portfolioName: portfolios.find(portfolio => portfolio.id === armedOutcome.portfolioId)?.name ?? armedOutcome.portfolioId,
      date: dateForCursor(armedOutcome.cursor),
    } : null,
  };
  const recordViewport = useCallback((range: ViewportRange) => {
    setViewportRange(previous => previous && Math.abs(previous.from - range.from) < 0.01 && Math.abs(previous.to - range.to) < 0.01 ? previous : range);
  }, []);
  const setComparisonR = useCallback((cursor: number) => {
    comparisonCursorRef.current = cursor;
    setComparisonCursor(cursor);
  }, []);
  const recordComparisonExposure = useCallback((cursor: number) => {
    if (cursor <= T0_CURSOR) return;
    const date = calendar.dates[cursor];
    if (!date) return;
    setRevealSource(previous => comparisonExposure(previous, date));
  }, [calendar.dates]);
  const clearPendingComparisonSource = useCallback(() => {
    returnToComparisonOnReopenRef.current = false;
    comparisonContextRef.current = null;
    comparisonDrawerOriginRef.current = null;
    comparisonTriggerRef.current = null;
    setPendingSourceReturn(null);
  }, []);

  useEffect(() => {
    if (!visible || showingResults || showingComparison) {
      // Retained experiment instances must not resume playback after an external hide.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
      setBulkPhase("idle");
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
      setFlashCursor(null);
      return;
    }
    if (visible && !showingResults && !showingComparison) revealPortfolioTab(portfolioTabRefs.current, selectedPortfolioId);
  }, [selectedPortfolioId, showingComparison, showingResults, visible]);
  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
  }, []);
  const status = unresolvedIncident ? "运行中断" : bulkPhase === "expanding" ? "快速展开中" : cursors.max === T0_CURSOR ? "待开始" : reviewing ? "回看中" : atEnd ? "已到终点" : playing && visible ? "播放中" : "已暂停";
  useEffect(() => {
    onStatus(status);
    onProgress?.(makeRuntimeProgress(status, knownDate, currentDate, atEnd, revealSource));
  }, [atEnd, currentDate, knownDate, onProgress, onStatus, revealSource, status]);

  const clearLatestPointFlash = useCallback(() => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = null;
    setFlashCursor(null);
  }, []);
  const flashLatestPoint = useCallback((cursor: number) => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setFlashCursor(cursor);
    flashTimer.current = window.setTimeout(() => {
      setFlashCursor(current => current === cursor ? null : current);
      flashTimer.current = null;
    }, 1100);
  }, []);
  const advance = useCallback((source: "manual" | "playback" | "bulk", retry = false) => {
    if (!visible || showingResultsRef.current || showingComparisonRef.current || (bulkPhase !== "idle" && source !== "bulk") || (!retry && cursors.view !== cursors.max) || cursors.max >= calendar.endIndex) return;
    if ((!retry && unresolvedIncident) || activePortfolios.length === 0) return;
    clearPendingComparisonSource();
    resultSourceContextRef.current = null;
    const nextCursor = cursors.max + 1;
    if (armedFault && armedFault.cursor === nextCursor && activePortfolios.some(portfolio => portfolio.id === armedFault.portfolioId)) {
      setArmedFault(null);
      setPlaying(false);
      setBulkPhase("idle");
      clearLatestPointFlash();
      setIncident({ portfolioId: armedFault.portfolioId, cursor: nextCursor, mode: armedFault.mode, excluded: false });
      return;
    }
    const dueOutcome = armedOutcome && armedOutcome.cursor === nextCursor
      && activePortfolios.some(portfolio => portfolio.id === armedOutcome.portfolioId)
      ? armedOutcome
      : null;
    if (dueOutcome) {
      setOverridesByPortfolio(previous => {
        const next = { ...previous };
        const previousOverrides = previous[dueOutcome.portfolioId] ?? [];
        if (!previousOverrides.some(override => override.cursor === nextCursor)) {
          next[dueOutcome.portfolioId] = [...previousOverrides, { cursor: nextCursor, kind: dueOutcome.kind }];
        }
        return next;
      });
      setArmedOutcome(null);
    }
    setPortfolioMaxCursors(previous => {
      const next = { ...previous };
      for (const portfolio of activePortfolios) next[portfolio.id] = nextCursor;
      return next;
    });
    setCursors({ max: nextCursor, view: nextCursor });
    if (source === "playback" && nextCursor >= calendar.endIndex) setPlaying(false);
    const candidateExposure: RevealSource = {
      date: calendar.dates[nextCursor],
      source,
      time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }),
    };
    setRevealSource(previous => laterExposure(previous, candidateExposure));
    if (retry) setIncident(null);
    flashLatestPoint(nextCursor);
    setFocusRevision(value => value + 1);
  }, [activePortfolios, armedFault, armedOutcome, bulkPhase, calendar.dates, calendar.endIndex, clearLatestPointFlash, clearPendingComparisonSource, cursors.max, cursors.view, flashLatestPoint, unresolvedIncident, visible]);
  const review = useCallback((cursor: number) => {
    clearPendingComparisonSource();
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
    resultSourceContextRef.current = null;
    const target = Math.max(T0_CURSOR, Math.min(cursor, cursors.max));
    setCursors(previous => ({ ...previous, view: target }));
    setFocusRevision(value => value + 1);
  }, [clearLatestPointFlash, clearPendingComparisonSource, cursors.max]);
  const closeDrawer = useCallback(() => {
    setDrawer(null);
    window.requestAnimationFrame(() => drawerTrigger.current?.focus());
  }, []);
  const closeDrawerAndFocusPortfolio = useCallback(() => {
    setDrawer(null);
    setPendingSourceReturn(null);
    revealPortfolioTab(portfolioTabRefs.current, selectedPortfolio.id, true);
  }, [selectedPortfolio.id]);
  const openEvent = useCallback((event: TradeEvent, trigger: HTMLElement) => {
    setPlaying(false);
    setBulkPhase("idle");
    drawerTrigger.current = trigger;
    setDrawer({ kind: "event", event });
  }, []);
  const openConfig = useCallback((trigger: HTMLElement) => {
    setPlaying(false);
    setBulkPhase("idle");
    drawerTrigger.current = trigger;
    setDrawer({ kind: "config" });
  }, []);
  const leave = useCallback((action: () => void) => {
    setPlaying(false);
    setBulkPhase("idle");
    setMoreMenuOpen(false);
    clearLatestPointFlash();
    action();
  }, [clearLatestPointFlash]);
  const enterResults = useCallback(() => {
    if (selectedMaxCursor <= T0_CURSOR) return;
    clearPendingComparisonSource();
    showingComparisonRef.current = false;
    setShowingComparison(false);
    showingResultsRef.current = true;
    resultSourceContextRef.current = null;
    setPlaying(false);
    setBulkPhase("idle");
    leave(() => {
      resultContextRef.current = {
        portfolioId: selectedPortfolio.id,
        maxCursor: cursors.max,
        viewCursor: cursors.view,
        mode,
        symbol,
        selectedHolding,
        viewportRange,
      };
      setResultsInitialCursor(Math.min(cursors.view, selectedMaxCursor));
      setResultsEntryId(entryId => entryId + 1);
      setShowingResults(true);
    });
  }, [clearPendingComparisonSource, cursors.max, cursors.view, leave, mode, selectedHolding, selectedMaxCursor, selectedPortfolio.id, symbol, viewportRange]);
  const enterComparison = useCallback((sourceCursor?: number) => {
    if (comparisonDisabledReason) return;
    const fromResults = showingResultsRef.current;
    const process = fromResults && resultContextRef.current
      ? resultContextRef.current
      : {
          portfolioId: selectedPortfolio.id,
          maxCursor: cursors.max,
          viewCursor: cursors.view,
          mode,
          symbol,
          selectedHolding,
          viewportRange,
        };
    const requestedCursor = fromResults ? sourceCursor ?? resultsInitialCursor : process.viewCursor;
    const initialCursor = Math.max(T0_CURSOR, Math.min(requestedCursor, commonMaxCursor));
    comparisonContextRef.current = { source: fromResults ? "results" : "process", process: { ...process } };
    comparisonDrawerOriginRef.current = null;
    comparisonTriggerRef.current = null;
    resultSourceContextRef.current = null;
    returnToComparisonOnReopenRef.current = true;
    showingComparisonRef.current = true;
    showingResultsRef.current = false;
    setPendingSourceReturn(null);
    setPlaying(false);
    setBulkPhase("idle");
    setMoreMenuOpen(false);
    setDrawer(null);
    clearLatestPointFlash();
    setComparisonR(initialCursor);
    setComparisonSyncCursor(initialCursor);
    setComparisonMode("synchronized");
    setComparisonPortfolioId(process.portfolioId);
    setComparisonEntryId(entryId => entryId + 1);
    setShowingResults(false);
    setShowingComparison(true);
  }, [clearLatestPointFlash, commonMaxCursor, comparisonDisabledReason, cursors.max, cursors.view, mode, selectedHolding, selectedPortfolio.id, setComparisonR, symbol, viewportRange, resultsInitialCursor]);
  const restoreSpecificProcessContext = useCallback((context: ProcessContext | null) => {
    if (!context) return;
    setPlaying(false);
    clearLatestPointFlash();
    setSelectedPortfolioId(context.portfolioId);
    setCursors(previous => ({ max: Math.max(previous.max, context.maxCursor), view: context.viewCursor }));
    setMode(context.mode);
    setSymbol(context.symbol);
    setSelectedHolding(context.selectedHolding);
    setViewportRange(context.viewportRange);
  }, [clearLatestPointFlash]);
  const returnFromComparison = useCallback(() => {
    const context = comparisonContextRef.current;
    showingComparisonRef.current = false;
    setShowingComparison(false);
    returnToComparisonOnReopenRef.current = true;
    comparisonDrawerOriginRef.current = null;
    setPendingSourceReturn(null);
    restoreSpecificProcessContext(context?.process ?? null);
    showingResultsRef.current = false;
    setShowingResults(false);
  }, [restoreSpecificProcessContext]);
  const returnToSourceComparison = useCallback(() => {
    const context = comparisonDrawerOriginRef.current ?? comparisonContextRef.current;
    restoreSpecificProcessContext(context?.process ?? null);
    comparisonDrawerOriginRef.current = null;
    setPendingSourceReturn(null);
    returnToComparisonOnReopenRef.current = true;
    showingResultsRef.current = false;
    setShowingResults(false);
    setDrawer(null);
    showingComparisonRef.current = true;
    setShowingComparison(true);
    window.requestAnimationFrame(() => comparisonTriggerRef.current?.focus({ preventScroll: true }));
  }, [restoreSpecificProcessContext]);
  const restoreProcessContext = useCallback(() => {
    const context = resultContextRef.current;
    if (!context) return;
    setPlaying(false);
    clearLatestPointFlash();
    setSelectedPortfolioId(context.portfolioId);
    setCursors({ max: context.maxCursor, view: context.viewCursor });
    setMode(context.mode);
    setSymbol(context.symbol);
    setSelectedHolding(context.selectedHolding);
    setViewportRange(context.viewportRange);
  }, [clearLatestPointFlash]);
  const returnToProcess = useCallback(() => {
    showingResultsRef.current = false;
    resultSourceContextRef.current = null;
    setPendingSourceReturn(null);
    restoreProcessContext();
    setShowingResults(false);
  }, [restoreProcessContext]);
  const returnToSourceResults = useCallback(() => {
    showingResultsRef.current = true;
    restoreProcessContext();
    setPendingSourceReturn(null);
    setDrawer(null);
    setShowingResults(true);
  }, [restoreProcessContext]);
  const openResultEvent = useCallback((event: TradeEvent, tradeSymbol?: SymbolId) => {
    const context = resultContextRef.current;
    if (!context) return;
    resultSourceContextRef.current = context;
    setPendingSourceReturn("results");
    showingResultsRef.current = false;
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
    setShowingResults(false);
    setSelectedPortfolioId(context.portfolioId);
    const eventSymbol = tradeSymbol ?? event.trades[0]?.symbol ?? event.plannedTrades?.[0]?.symbol;
    if (eventSymbol) {
      setMode("price");
      setSymbol(eventSymbol);
      setSelectedHolding(null);
    } else {
      setMode(context.mode);
      setSymbol(context.symbol);
      setSelectedHolding(null);
    }
    setCursors({ max: context.maxCursor, view: Math.max(T0_CURSOR, Math.min(event.cursor, context.maxCursor)) });
    setFocusRevision(value => value + 1);
    drawerTrigger.current = priceTabRef.current;
    setDrawer({ kind: "event", event, origin: "results" });
  }, [clearLatestPointFlash]);
  const openComparisonEvent = useCallback((portfolioId: PortfolioId, event: TradeEvent, tradeSymbol?: SymbolId) => {
    const context = comparisonContextRef.current;
    if (!context) return;
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    const trigger = activeElement instanceof HTMLElement ? activeElement : null;
    comparisonDrawerOriginRef.current = { source: context.source, process: { ...context.process } };
    setPendingSourceReturn("comparison");
    comparisonTriggerRef.current = trigger;
    drawerTrigger.current = priceTabRef.current;
    returnToComparisonOnReopenRef.current = true;
    resultSourceContextRef.current = null;
    showingComparisonRef.current = false;
    showingResultsRef.current = false;
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
    setShowingComparison(false);
    setShowingResults(false);
    const eventSymbol = tradeSymbol ?? event.trades[0]?.symbol ?? event.plannedTrades?.[0]?.symbol;
    setSelectedPortfolioId(portfolioId);
    setCursors(previous => ({
      ...previous,
      view: Math.max(T0_CURSOR, Math.min(event.cursor, maxCursorForPortfolio(previous.max, portfolioMaxCursors, portfolioId))),
    }));
    setMode(eventSymbol ? "price" : context.process.mode);
    setSymbol(eventSymbol ?? context.process.symbol);
    setSelectedHolding(null);
    setViewportRange(context.process.viewportRange);
    setFocusRevision(value => value + 1);
    setDrawer({ kind: "event", event, origin: "comparison" });
  }, [clearLatestPointFlash, portfolioMaxCursors]);
  const changeComparisonCursor = useCallback((requestedCursor: number) => {
    const selectedMax = comparisonMode === "single" && comparisonPortfolioId
      ? maxCursorForPortfolio(cursors.max, portfolioMaxCursors, comparisonPortfolioId)
      : commonMaxCursor;
    const target = Math.max(T0_CURSOR, Math.min(Number.isFinite(requestedCursor) ? Math.floor(requestedCursor) : T0_CURSOR, selectedMax));
    if (comparisonMode === "synchronized") setComparisonSyncCursor(target);
    if (target > comparisonCursorRef.current) recordComparisonExposure(target);
    setComparisonR(target);
  }, [commonMaxCursor, comparisonMode, comparisonPortfolioId, portfolioMaxCursors, cursors.max, recordComparisonExposure, setComparisonR]);
  const revealCommonComparison = useCallback(() => {
    const target = commonMaxCursor;
    if (target > comparisonCursorRef.current) recordComparisonExposure(target);
    setComparisonMode("synchronized");
    setComparisonSyncCursor(target);
    setComparisonR(target);
  }, [commonMaxCursor, recordComparisonExposure, setComparisonR]);
  const revealSingleComparison = useCallback((portfolioId: PortfolioId) => {
    const target = maxCursorForPortfolio(cursors.max, portfolioMaxCursors, portfolioId);
    if (target <= commonMaxCursor) return;
    if (target > comparisonCursorRef.current) recordComparisonExposure(target);
    setComparisonMode("single");
    setComparisonPortfolioId(portfolioId);
    setComparisonR(target);
  }, [commonMaxCursor, portfolioMaxCursors, cursors.max, recordComparisonExposure, setComparisonR]);
  const changeComparisonMode = useCallback((nextMode: ComparisonMode, selectedId?: PortfolioId) => {
    if (nextMode === "synchronized") {
      const target = Math.max(T0_CURSOR, Math.min(comparisonSyncCursor, commonMaxCursor));
      setComparisonMode("synchronized");
      setComparisonR(target);
      return;
    }
    const portfolioId = selectedId ?? comparisonPortfolioId ?? portfolios[0]?.id ?? null;
    if (!portfolioId) return;
    const target = Math.max(T0_CURSOR, Math.min(comparisonCursorRef.current, maxCursorForPortfolio(cursors.max, portfolioMaxCursors, portfolioId)));
    if (target > comparisonCursorRef.current) recordComparisonExposure(target);
    setComparisonMode("single");
    setComparisonPortfolioId(portfolioId);
    setComparisonR(target);
  }, [commonMaxCursor, comparisonPortfolioId, comparisonSyncCursor, portfolios, portfolioMaxCursors, cursors.max, recordComparisonExposure, setComparisonR]);
  const revealResult = useCallback((cursor: number) => {
    const context = resultContextRef.current;
    if (!context || cursor <= context.viewCursor) return;
    const resultMaxCursor = Math.min(context.maxCursor, portfolioMaxCursors[context.portfolioId] ?? context.maxCursor);
    const targetCursor = Math.max(T0_CURSOR, Math.min(cursor, resultMaxCursor));
    const resultDate = calendar.dates[targetCursor];
    const previousDate = [
      context.maxCursor === T0_CURSOR ? draft.date.slice(0, 10) : calendar.dates[context.maxCursor],
      revealSource?.date ?? (context.viewCursor === T0_CURSOR ? draft.date.slice(0, 10) : calendar.dates[context.viewCursor]),
    ].sort().at(-1) ?? resultDate;
    const farthestDate = previousDate > resultDate ? previousDate : resultDate;
    setRevealSource({
      date: farthestDate,
      source: "results",
      time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }),
    });
  }, [calendar.dates, draft.date, portfolioMaxCursors, revealSource]);
  useEffect(() => {
    if (!visible || openResultsRequest === undefined || openResultsRequest === lastOpenResultsRequestRef.current) return;
    lastOpenResultsRequestRef.current = openResultsRequest;
    setPlaying(false);
    clearLatestPointFlash();
    const pendingComparison = comparisonContextRef.current;
    if (comparisonEntryId > 0 && pendingComparison && returnToComparisonOnReopenRef.current) {
      restoreSpecificProcessContext(pendingComparison.process);
      comparisonDrawerOriginRef.current = null;
      setPendingSourceReturn(null);
      setDrawer(null);
      showingResultsRef.current = false;
      setShowingResults(false);
      showingComparisonRef.current = true;
      setShowingComparison(true);
      return;
    }
    const saved = resultContextRef.current;
    const pendingSource = resultSourceContextRef.current;
    const sameExistingResult = resultsEntryId > 0 && saved?.portfolioId === selectedPortfolio.id
      && saved.maxCursor === cursors.max && saved.viewCursor === cursors.view;
    const returningFromResultEvent = resultsEntryId > 0 && pendingSource?.portfolioId === selectedPortfolio.id
      && pendingSource.maxCursor === cursors.max;
    if (sameExistingResult || returningFromResultEvent) {
      showingResultsRef.current = true;
      setShowingResults(true);
    }
    else enterResults();
  }, [clearLatestPointFlash, comparisonEntryId, cursors.max, cursors.view, enterResults, openResultsRequest, restoreSpecificProcessContext, resultsEntryId, selectedPortfolio.id, visible]);

  const selectPortfolio = useCallback((id: PortfolioId) => {
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
    resultSourceContextRef.current = null;
    setPendingSourceReturn(null);
    setSelectedHolding(null);
    setDrawer(null);
    setMoreMenuOpen(false);
    setSelectedPortfolioId(id);
  }, [clearLatestPointFlash]);
  const chooseDemoPortfolio = useCallback((portfolio: PortfolioIdentity) => {
    setShownDemoIds(previous => previous.includes(portfolio.id) ? previous : [...previous, portfolio.id]);
    selectPortfolio(portfolio.id);
    revealPortfolioTab(portfolioTabRefs.current, portfolio.id, true);
  }, [selectPortfolio]);
  const handlePortfolioKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>, index: number) => {
    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") targetIndex = (index + 1) % portfolios.length;
    else if (event.key === "ArrowLeft") targetIndex = (index - 1 + portfolios.length) % portfolios.length;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = portfolios.length - 1;
    if (targetIndex === null) return;
    event.preventDefault();
    const target = portfolios[targetIndex];
    selectPortfolio(target.id);
    revealPortfolioTab(portfolioTabRefs.current, target.id, true);
  }, [portfolios, selectPortfolio]);
  const handleMoreMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']")];
    const focusedIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setMoreMenuOpen(false);
      moreMenuButtonRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(focusedIndex + step + options.length) % options.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      options[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      options.at(-1)?.focus();
    }
  }, []);

  const pauseForRecoveryTool = () => {
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
  };
  const requestBulk = () => {
    pauseForRecoveryTool();
    setBulkStartCursor(cursors.max);
    setBulkPhase("confirming");
  };
  const confirmBulk = () => {
    if (bulkDisabledReason) return;
    setBulkStartCursor(cursors.max);
    setBulkPhase("expanding");
  };
  const changeFaultMode = (nextMode: RecoveryFaultMode) => {
    pauseForRecoveryTool();
    setArmedFault(nextMode === "none" || cursors.max >= calendar.endIndex
      ? null
      : { mode: nextMode, portfolioId: selectedPortfolio.id, cursor: cursors.max + 1 });
  };
  const changeNextOutcome = (outcome: RecoveryExecutionOutcome) => {
    pauseForRecoveryTool();
    setArmedOutcome(outcome === "filled" || nextPlannedCursor === null
      ? null
      : { kind: outcome, portfolioId: selectedPortfolio.id, cursor: nextPlannedCursor });
  };
  const captureCheckpoint = (): RuntimeCheckpoint => ({
    cursors: { ...cursors },
    portfolioMaxCursors: { ...portfolioMaxCursors },
    excludedPortfolioIds: [...excludedPortfolioIds],
    overridesByPortfolio: Object.fromEntries(Object.entries(overridesByPortfolio).map(([id, overrides]) => [id, [...(overrides ?? [])]])),
    armedFault: armedFault ? { ...armedFault } : null,
    armedOutcome: armedOutcome ? { ...armedOutcome } : null,
    incident: incident ? { ...incident } : null,
    selectedPortfolioId: selectedPortfolio.id,
    mode,
    symbol,
    selectedHolding,
    shownDemoIds: [...shownDemoIds],
    viewportRange: viewportRange ? { ...viewportRange } : null,
    revealSource: revealSource ? { ...revealSource } : null,
  });
  const createCheckpoint = () => {
    pauseForRecoveryTool();
    setCheckpoint(captureCheckpoint());
    setCheckpointState("saved");
    setCheckpointError(undefined);
  };
  const simulateCheckpointFailure = () => {
    pauseForRecoveryTool();
    setCheckpointState("saveFailed");
    setCheckpointError("最近一次已保存检查点未改变；当前账本状态仍保留在页面内存。");
  };
  const reloadCheckpoint = () => {
    if (!checkpoint) return;
    pauseForRecoveryTool();
    showingComparisonRef.current = false;
    setShowingComparison(false);
    showingResultsRef.current = false;
    returnToComparisonOnReopenRef.current = false;
    comparisonContextRef.current = null;
    comparisonDrawerOriginRef.current = null;
    comparisonTriggerRef.current = null;
    resultContextRef.current = null;
    resultSourceContextRef.current = null;
    setPendingSourceReturn(null);
    setShowingResults(false);
    setCursors({ ...checkpoint.cursors });
    setPortfolioMaxCursors({ ...checkpoint.portfolioMaxCursors });
    setExcludedPortfolioIds([...checkpoint.excludedPortfolioIds]);
    setOverridesByPortfolio(Object.fromEntries(Object.entries(checkpoint.overridesByPortfolio).map(([id, overrides]) => [id, [...(overrides ?? [])]])));
    setArmedFault(checkpoint.armedFault ? { ...checkpoint.armedFault } : null);
    setArmedOutcome(checkpoint.armedOutcome ? { ...checkpoint.armedOutcome } : null);
    setIncident(checkpoint.incident ? { ...checkpoint.incident } : null);
    setSelectedPortfolioId(checkpoint.selectedPortfolioId);
    setMode(checkpoint.mode);
    setSymbol(checkpoint.symbol);
    setSelectedHolding(checkpoint.selectedHolding);
    setShownDemoIds([...checkpoint.shownDemoIds]);
    setViewportRange(checkpoint.viewportRange ? { ...checkpoint.viewportRange } : null);
    setRevealSource(previous => laterExposure(previous, checkpoint.revealSource));
    setCheckpointState("saved");
    setCheckpointError(undefined);
    setFocusRevision(value => value + 1);
  };
  const retryIncident = () => {
    pauseForRecoveryTool();
    advance("manual", true);
  };
  const excludeIncident = () => {
    if (!incident || incident.excluded) return;
    pauseForRecoveryTool();
    setExcludedPortfolioIds(previous => previous.includes(incident.portfolioId) ? previous : [...previous, incident.portfolioId]);
    setIncident(previous => previous ? { ...previous, excluded: true } : previous);
    setArmedOutcome(previous => previous?.portfolioId === incident.portfolioId ? null : previous);
    setArmedFault(previous => previous?.portfolioId === incident.portfolioId ? null : previous);
  };

  useEffect(() => {
    if (!playing || !visible || showingResults || showingComparison || reviewing || atEnd || !canAdvance || bulkPhase !== "idle" || unresolvedIncident) return;
    const timer = window.setTimeout(() => advance("playback"), speed === "2x" ? 450 : speed === "0.5x" ? 1800 : 900);
    return () => window.clearTimeout(timer);
  }, [advance, atEnd, bulkPhase, canAdvance, playing, reviewing, showingComparison, showingResults, speed, unresolvedIncident, visible]);

  useEffect(() => {
    if (!visible || showingResults || showingComparison || bulkPhase !== "expanding" || unresolvedIncident) return;
    const timer = window.setTimeout(() => {
      if (cursors.max >= calendar.endIndex) {
        setBulkPhase("idle");
        if (selectedMaxCursor > T0_CURSOR) enterResults();
      } else advance("bulk");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [advance, bulkPhase, calendar.endIndex, cursors.max, enterResults, selectedMaxCursor, showingComparison, showingResults, unresolvedIncident, visible]);

  useEffect(() => {
    if (!drawer || !visible) return;
    drawerCloseButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      } else if (event.key === "Tab") {
        const dialog = drawerCloseButton.current?.closest<HTMLElement>(".running-drawer") ?? null;
        const focusable = dialog ? [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")] : [];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) event.preventDefault();
        else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (dialog && !dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, drawer, visible]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!visible || showingResultsRef.current || showingComparisonRef.current || processRootRef.current?.hidden || drawer || bulkPhase !== "idle" || unresolvedIncident || event.isComposing || event.keyCode === 229 || isTextEntryTarget(event.target)) return;
      if (isShortcutTarget(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        if (canAdvance) setPlaying(value => !value);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!playing && canAdvance) advance("manual");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [advance, bulkPhase, canAdvance, drawer, playing, showingResults, unresolvedIncident, visible]);

  const t0Text = draft.date.replace("T", " ");
  const activePreset = draft.presets[selected];
  const chartSymbolHeld = current?.holdings.some(holding => holding.symbol === chartSymbol) ?? false;
  const changeMode = (nextMode: ChartMode) => {
    if (mode === nextMode) return;
    setPlaying(false);
    setBulkPhase("idle");
    clearLatestPointFlash();
    setViewportRange(null);
    setMode(nextMode);
    setFocusRevision(value => value + 1);
  };
  const eventClick = (event: TradeEvent, trigger: HTMLElement) => {
    review(event.cursor);
    openEvent(event, trigger);
  };
  const locateTrade = (trade: Trade) => {
    setPlaying(false);
    clearLatestPointFlash();
    setSelectedHolding(null);
    setSymbol(trade.symbol);
    drawerTrigger.current = priceTabRef.current;
    changeMode("price");
    closeDrawer();
  };

  return (
    <>
    <main ref={processRootRef} className="running-prototype" hidden={!visible || showingResults || showingComparison}>
      <header className="running-header">
        <div className="running-heading">
          <div className="running-kicker">策略实验 <span>/</span> {experimentName || "组合观察"}</div>
          <h1>回测工作台</h1>
        </div>
        <span className="synthetic-badge">交互原型 · 合成数据 · 刷新重置</span>
        <div className="running-header-actions">
          {!drawer && pendingSourceReturn === "results" && <button type="button" className="running-primary" onClick={returnToSourceResults}>返回来源结果</button>}
          {!drawer && pendingSourceReturn === "comparison" && <button type="button" className="running-primary" onClick={returnToSourceComparison}>返回来源比较</button>}
          <button type="button" className="running-secondary" onClick={event => openConfig(event.currentTarget)}>查看配置</button>
          <button type="button" className="running-list-button" onClick={() => leave(onList)}>实验列表</button>
        </div>
      </header>

      <div className="portfolio-selector">
        <div className="portfolio-tabs" role="tablist" aria-label="当前实验中的组合" onKeyDown={event => {
          if (event.target instanceof HTMLButtonElement && event.target.dataset.portfolioIndex !== undefined) {
            handlePortfolioKeyDown(event, Number(event.target.dataset.portfolioIndex));
          }
        }}>
          {portfolios.map((portfolio, index) => {
            const capital = Number(draft.capital) * portfolio.capitalMultiplier;
            return <button
              key={portfolio.id}
              ref={button => { if (button) portfolioTabRefs.current.set(portfolio.id, button); else portfolioTabRefs.current.delete(portfolio.id); }}
              type="button"
              role="tab"
              id={`${instanceId}-portfolio-tab-${portfolio.id}`}
              data-portfolio-index={index}
              data-portfolio-id={portfolio.id}
              tabIndex={selectedPortfolio.id === portfolio.id ? 0 : -1}
              aria-selected={selectedPortfolio.id === portfolio.id}
              aria-current={selectedPortfolio.id === portfolio.id ? "page" : undefined}
              className={`${selectedPortfolio.id === portfolio.id ? "active" : ""}${portfolio.demoOnly ? " demo-portfolio-tab" : ""}`}
              onClick={() => selectPortfolio(portfolio.id)}
            >
              <span title={portfolio.name}>{portfolio.name}</span><small>独立本金 {money(capital)}</small>
            </button>;
          })}
        </div>
        <div className="portfolio-more">
          <button ref={moreMenuButtonRef} type="button" className="portfolio-more-button" aria-haspopup="menu" aria-expanded={moreMenuOpen} onClick={() => setMoreMenuOpen(open => !open)} onKeyDown={event => {
            if (event.key === "Escape" && moreMenuOpen) {
              event.preventDefault();
              setMoreMenuOpen(false);
              moreMenuButtonRef.current?.focus();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setMoreMenuOpen(true);
              window.requestAnimationFrame(() => moreMenuButtonRef.current?.parentElement?.querySelector<HTMLButtonElement>(".portfolio-more-menu [role='menuitemradio']")?.focus());
            }
          }}>更多组合 <span aria-hidden="true">⌄</span></button>
          {moreMenuOpen && <div className="portfolio-more-menu" role="menu" aria-label="全部组合与合成展示样例" onKeyDown={handleMoreMenuKeyDown}>
            <p>当前组合 · 同步日期、独立账本</p>
            {portfolios.map(portfolio => (
              <button
                key={portfolio.id}
                type="button"
                role="menuitemradio"
                aria-checked={selectedPortfolio.id === portfolio.id}
                data-portfolio-id={portfolio.id}
                onClick={() => {
                  selectPortfolio(portfolio.id);
                  revealPortfolioTab(portfolioTabRefs.current, portfolio.id, true);
                }}
              >
                <span><b>{portfolio.name}</b><small>{portfolio.demoOnly ? "展示样例 · 非新增策略包" : STRATEGY_NAMES[portfolio.strategy]} · 独立本金 {money(Number(draft.capital) * portfolio.capitalMultiplier)}</small></span>
                {selectedPortfolio.id === portfolio.id && <i aria-hidden="true">✓</i>}
              </button>
            ))}
            {DEMO_PORTFOLIOS.some(portfolio => !shownDemoIds.includes(portfolio.id)) && <>
              <p className="portfolio-more-divider">添加合成展示样例 · 不代表新增策略包</p>
              {DEMO_PORTFOLIOS.filter(portfolio => !shownDemoIds.includes(portfolio.id)).map(portfolio => <button
                key={portfolio.id}
                type="button"
                role="menuitemradio"
                aria-checked={false}
                data-portfolio-id={portfolio.id}
                onClick={() => chooseDemoPortfolio(portfolio)}
              >
                <span><b>{portfolio.name}</b><small>点击加入并切换 · 独立本金 {money(Number(draft.capital) * portfolio.capitalMultiplier)}</small></span>
              </button>)}
            </>}
          </div>}
        </div>
      </div>

      <section className="running-summary" aria-label="组合资产摘要">
        <div><span>总资产</span><b>{metrics ? money(metrics.totalAssets) : "— · 此日不可用"}</b>{!metrics && <small>最后完整日 {selectedMaxDate}</small>}</div>
        <div><span>累计收益</span><b className={!metrics || metrics.cumulativeReturn === 0 ? "neutral" : metrics.cumulativeReturn > 0 ? "positive" : "negative"}>{metrics ? percent(metrics.cumulativeReturn) : "—"}</b></div>
        <div><span>组合当日收益</span><b className={!metrics || metrics.dailyAmount === null ? "neutral" : metrics.dailyAmount > 0 ? "positive" : metrics.dailyAmount < 0 ? "negative" : "neutral"}>{!metrics ? "— · 无可用估值" : metrics.dailyAmount === null ? "— · 尚未开始" : `${money(metrics.dailyAmount)} · ${percent(metrics.dailyReturn ?? 0)}`}</b></div>
        <div><span>现金比例</span><b>{metrics ? `${(metrics.cashRatio * 100).toFixed(1)}%` : "—"}</b></div>
      </section>

      <section className="running-timebar" aria-label="运行日期与播放控制">
        <div className="timebar-position">
          <span className={`timebar-state ${reviewing ? "reviewing" : atEnd ? "complete" : cursors.max === T0_CURSOR ? "pending" : ""}`}>{reviewing ? "回看中" : cursors.max === T0_CURSOR ? "待开始" : atEnd ? "运行已完成" : "当前观察日"}</span>
          <b>{cursors.view === T0_CURSOR ? `T0 · ${t0Text}` : `${currentDate} · 收盘后`}</b>
          <small>已展开至 {knownDate}{reviewing ? ` · 曾看至 ${knownDate}` : ""}</small>
        </div>
        <div className="timebar-actions">
          {reviewing ? <button type="button" className="running-primary" onClick={() => review(cursors.max)}>返回最新日期 <span>→</span></button> : atEnd ? <button type="button" className="running-primary" disabled={selectedMaxCursor <= T0_CURSOR} onClick={enterResults}>{selectedMaxCursor <= T0_CURSOR ? "该组合没有可查看区间" : "查看回测结果"} <span>→</span></button> : <button type="button" className="running-primary" disabled={!canAdvance || playing || bulkPhase !== "idle"} onClick={() => advance("manual")}>{cursors.max === T0_CURSOR ? "推进下一交易日" : "下一交易日"} <span>→</span></button>}
          {atEnd && <button type="button" className="running-secondary" disabled={Boolean(comparisonDisabledReason)} title={comparisonDisabledReason} onClick={() => enterComparison()}>比较组合</button>}
          {!reviewing && !atEnd && <button type="button" className="running-secondary" disabled={!canAdvance || bulkPhase !== "idle"} onClick={() => setPlaying(value => !value)}>{playing ? "暂停" : cursors.max === T0_CURSOR ? "自动播放" : "播放"}</button>}
          {!reviewing && !atEnd && <label className="speed-control">速度<select aria-label="播放速度" value={speed} onChange={event => setSpeed(event.target.value)}><option>0.5x</option><option>1x</option><option>2x</option></select></label>}
          {cursors.max > T0_CURSOR && !(atEnd && !reviewing) && <button type="button" className="running-secondary" disabled={selectedMaxCursor <= T0_CURSOR} onClick={enterResults}>{selectedMaxCursor <= T0_CURSOR ? "当前组合暂无结果" : "阶段结果"}</button>}
          {cursors.max === T0_CURSOR && <>
            <button type="button" className="running-secondary" disabled title="T0 尚无可分析区间；推进下一交易日后可查看阶段结果">阶段结果</button>
            <button type="button" className="running-secondary" disabled={Boolean(comparisonDisabledReason)} title={comparisonDisabledReason} onClick={() => enterComparison()}>比较组合</button>
            <small className="results-range-unavailable">{comparisonDisabledReason ?? "T0 暂无可分析区间"}</small>
          </>}
          <label className="date-control">回看<select aria-label="回看日期" value={cursors.view} onFocus={() => { setPlaying(false); setBulkPhase("idle"); }} onChange={event => review(Number(event.target.value))}>
            {calendar.dates.slice(T0_CURSOR, cursors.max + 1).map((date, index) => <option key={date} value={index + T0_CURSOR}>{index === 0 ? `T0 · ${t0Text}` : date}</option>)}
          </select></label>
        </div>
      </section>

      <RecoveryPrototype
        instanceId={instanceId}
        bulk={recoveryBulk}
        incident={recoveryIncident}
        lagging={recoveryLagging}
        checkpoint={recoveryCheckpoint}
        demo={recoveryDemo}
        onRequestBulk={requestBulk}
        onConfirmBulk={confirmBulk}
        onCancelBulk={() => setBulkPhase("idle")}
        onStopBulk={() => setBulkPhase("idle")}
        onRetry={retryIncident}
        onExclude={excludeIncident}
        onViewLastComplete={() => review(selectedMaxCursor)}
        onReturnToList={() => leave(onList)}
        onFaultModeChange={changeFaultMode}
        onNextOutcomeChange={changeNextOutcome}
        onCreateCheckpoint={createCheckpoint}
        onSimulateSaveFailure={simulateCheckpointFailure}
        onRetryCheckpoint={createCheckpoint}
        onReloadCheckpoint={reloadCheckpoint}
      />

      <div className="running-grid">
        <section className="running-main" aria-label="组合净值与标的图表">
          <div className="chart-heading">
            <div><span className="chart-kicker">{selectedName}</span><h2>{mode === "value" ? "组合净值" : `合成股票 ${chartSymbol} · 日K线`}</h2>{mode === "price" && !chartSymbolHeld && <small className="chart-not-held">当前组合未持有此标的</small>}</div>
            <div className="chart-origin" aria-label={`T0 起点 ${t0Text}`}>T0 起点 · {t0Text}</div>
            <div className="chart-switch" role="tablist" aria-label="图表视图">
              <button type="button" role="tab" aria-selected={mode === "value"} className={mode === "value" ? "active" : ""} onClick={() => changeMode("value")}>组合净值</button>
              <button ref={priceTabRef} type="button" role="tab" aria-selected={mode === "price"} className={mode === "price" ? "active" : ""} onClick={() => changeMode("price")}>标的 K 线</button>
              {mode === "price" && <select aria-label="图表标的" value={chartSymbol} onFocus={() => { setPlaying(false); setBulkPhase("idle"); }} onChange={event => { setPlaying(false); setBulkPhase("idle"); clearLatestPointFlash(); setSelectedHolding(null); setSymbol(event.target.value as SymbolId); }}>{selectableSymbols.map(id => <option key={id} value={id}>合成股票 {id}</option>)}</select>}
            </div>
          </div>
          <MarketChart bars={calendar.bars[chartSymbol]} snapshots={ledger} cursor={chartCursor} mode={mode} t0Date={calendar.dates[T0_CURSOR]} focusRevision={focusRevision} flashCursor={flashCursor} initialViewport={viewportRange} onViewportChange={recordViewport} viewLabel={unavailableAtView ? "Mᵢ" : "V"} />
          <div className="chart-caption"><span><i className="t0-key" />T0</span><span><i className="latest-key" />{unavailableAtView ? `Mᵢ · 最后完整日 ${selectedMaxDate}` : "当前 V"}</span><span>{mode === "price" ? `行情截至 ${chartCursor === T0_CURSOR ? calendar.dates[T0_CURSOR] : dateForCursor(chartCursor)}` : `净值截至 ${chartCursor === T0_CURSOR ? "T0" : dateForCursor(chartCursor)}`}</span></div>
          <div className="chart-disclosure">{unavailableAtView ? `此组合不在 ${currentDate} 提供估值；图形、轴范围与事件标记均截止最后完整日 ${selectedMaxDate}` : cursors.view === T0_CURSOR ? `T0 前最后完整日线：${calendar.dates[T0_CURSOR]} · 实际持仓为 0` : `查看日 ${currentDate} · 图形、轴范围与事件标记均截止当前日`}</div>
        </section>

        <aside className="running-side" aria-label="当前组合持仓与事件">
          <section className="side-block holdings-block">
            <div className="side-title"><div><span>当前组合</span><h2>持仓概览</h2></div><span className="portfolio-name">{selectedName}</span></div>
            <p className="side-muted">{activePreset} · 每组合独立本金 · 收盘估值{selectedPortfolio.demoOnly ? " · 合成展示样例" : ""}</p>
            {unavailableAtView ? <div className="cash-only"><b>此组合在该查看日不可用</b><span>账本已冻结在最后完整日 {selectedMaxDate}。不会用旧估值填充后续日期。</span></div> : current?.holdings.length ? <div className="holding-list">
              {current.holdings.map(holding => <button type="button" className="holding-row" key={holding.symbol} aria-pressed={selectedHolding === holding.symbol} onClick={() => { setPlaying(false); clearLatestPointFlash(); changeMode("price"); setSymbol(holding.symbol); setSelectedHolding(holding.symbol); }}>
                <span className="holding-identity"><b>合成股票 {holding.symbol}</b><small>{holding.quantity.toFixed(4)} 股 × {money(holding.price)}</small></span>
                <span className="holding-value"><b>{money(holding.value)}</b><small>{(holding.value / current.equity * 100).toFixed(1)}%</small></span>
              </button>)}
            </div> : <div className="cash-only"><b>{cursors.view === T0_CURSOR ? "起始持仓为 0" : "当前没有持仓"}</b><span>{draft.scenario === "empty" ? "策略没有选出候选，资产保持现金。" : "首次建仓前，实际持仓保持为零。"}</span></div>}
            {!unavailableAtView && current && <>
              <div className="account-total"><span>现金</span><b>{money(current.cash)}</b></div>
              <div className="account-total"><span>组合净值</span><b>{current.netValue.toFixed(4)}</b></div>
              <div className="holdings-foot"><span>总资产</span><b>{money(current.equity)}</b></div>
            </>}
          </section>

          <section className="side-block event-block">
            <div className="event-heading"><div><span>{unavailableAtView ? `最后完整日 ${selectedMaxDate} · ${displayEvents.length} 条` : `当前查看日 · ${displayEvents.length} 条`}</span><h2>调仓事件</h2></div>
              <div className="event-nav">
                <button type="button" aria-label="上一个已知事件" disabled={!previousEvent} onClick={event => previousEvent && eventClick(previousEvent, event.currentTarget)}>‹</button>
                <button type="button" disabled={!nextKnownEvent} onClick={event => nextKnownEvent && eventClick(nextKnownEvent, event.currentTarget)}>
                  <span>下一已知事件</span><b>{nextKnownEvent ? `${nextKnownEvent.date} · ${eventType(nextKnownEvent)}` : "当前进度内无后续事件"}</b>
                </button>
              </div>
            </div>
            {displayEvents.length === 0 ? <p className="no-events">{unavailableAtView ? `此组合在 ${currentDate} 不可用；下列事件边界截至 ${selectedMaxDate}。` : draft.scenario === "empty" ? "没有候选标的；组合保持现金，不生成调仓事件。" : cursors.view === T0_CURSOR ? "尚未发生模拟成交。推进下一交易日后，首次持仓会出现在这里。" : "截至当前查看日没有已发生的调仓事件。"}</p> : <div className="event-list">
              {[...displayEvents].reverse().map(event => <button type="button" className="event-card" key={event.cursor} onClick={click => eventClick(event, click.currentTarget)}>
                <span className="event-type">{eventType(event)}</span><time>{event.date}</time>
                <b>{event.reason}</b><small>{eventSummary(event)} · {event.oldWeight} → {event.actualWeight}</small>
              </button>)}
            </div>}
          </section>

          {revealSource && <p className="exposure-note">已看后续 · 最远至 {revealSource.date} · 来源：{exposureSourceLabel(revealSource.source)}<small>记录时间 Asia/Shanghai · {revealSource.time}</small></p>}
        </aside>
      </div>

      {drawer && <div className="drawer-layer" onMouseDown={event => { if (event.target === event.currentTarget) closeDrawer(); }}>
        <section className="running-drawer" role="dialog" aria-modal="true" aria-labelledby={drawerTitleId}>
          <header className="drawer-header"><div><span>{drawer.kind === "event" ? "组合事件" : "只读查看"}</span><h2 id={drawerTitleId}>{drawer.kind === "event" ? `${eventType(drawer.event)} · ${drawer.event.date}` : "运行配置"}</h2></div><button ref={drawerCloseButton} type="button" className="drawer-close" aria-label="关闭详情" onClick={closeDrawer}>×</button></header>
          {drawer.kind === "event" ? <div className="drawer-content">
            <section><h3>触发原因</h3><p>{drawer.event.reason}</p></section>
            <section><h3>当时可知依据</h3><p>{drawer.event.cursor === T0_CURSOR + 1 ? "目标组合在 T0 前已确定，模拟成交发生在 T0 后首个交易日开盘。" : "调仓模板在前一交易日确定；本次按当前交易日开盘执行，不使用当日收盘信息决定交易。"}</p></section>
            <section><h3>当时的权重</h3><dl><div><dt>旧仓位</dt><dd>{drawer.event.oldWeight}</dd></div><div><dt>目标仓位</dt><dd>{drawer.event.targetWeight}</dd></div><div><dt>实际成交</dt><dd>{drawer.event.actualWeight}</dd></div></dl></section>
            <section><h3>成交明细</h3>
              {(drawer.event.plannedTrades ?? drawer.event.trades).length > 0 ? <div className="drawer-trades">{(drawer.event.plannedTrades ?? drawer.event.trades).map(planned => {
                const actual = drawer.event.trades.find(trade => trade.symbol === planned.symbol);
                return <div key={planned.symbol}><button type="button" className="running-secondary" aria-label={`在日K线上查看合成股票 ${planned.symbol}`} onClick={() => locateTrade(planned)} style={{ gridColumn: "1 / -1", width: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "4px 10px", minHeight: "auto", padding: "8px 10px", textAlign: "left" }}><b style={{ gridColumn: "1 / -1", fontSize: 13 }}>合成股票 {planned.symbol}</b><span>计划：{planned.delta >= 0 ? "买入" : "卖出"} {Math.abs(planned.delta).toFixed(4)} 股 · 开盘价 {money(planned.price)}</span><span>实际：{actual ? `${Math.abs(actual.delta).toFixed(4)} 股` : "未成交"}</span><span style={{ gridColumn: "1 / -1" }}>查看该标的 K 线 →</span></button></div>;
              })}</div> : <p>本事件没有计划交易标的。</p>}
              <p>{drawer.event.executionStatus === "unfilled" ? "未成交：计划保留，实际交易明细为空。" : drawer.event.executionStatus === "partial" ? "部分成交：每笔计划差量执行 50%，其余未成交。" : "全部计划交易已执行。"} · 费用 ¥0 · 小数股演示</p>
            </section>
            <section><h3>费用与估值</h3><p>{drawer.event.executionNote ?? "模拟费用为 0；成交后使用当前查看日收盘价计算市值与组合净值。"} 全部数据均为合成演示。</p></section>
            <div className="drawer-actions">{drawer.origin === "results" && <button type="button" className="running-secondary" onClick={returnToSourceResults}>返回来源结果</button>}{drawer.origin === "comparison" && <button type="button" className="running-secondary" onClick={returnToSourceComparison}>返回来源比较</button>}<button type="button" className="running-secondary" onClick={closeDrawerAndFocusPortfolio}>关闭详情并切换组合</button><button type="button" className="running-primary" onClick={closeDrawer}>关闭详情</button></div>
          </div> : <div className="drawer-content config-content">
            {experimentName && <section><h3>实验</h3><p>{experimentName}</p></section>}
            <section><h3>运行范围</h3><dl><div><dt>起始时点</dt><dd>{t0Text} · Asia/Shanghai</dd></div><div><dt>最后完整日线</dt><dd>{calendar.dates[T0_CURSOR]}</dd></div><div><dt>计划结束日</dt><dd>{calendar.nominalEnd}（演示交易日 {calendarEndDate}）</dd></div><div><dt>观察期限</dt><dd>{draft.horizon}</dd></div></dl></section>
            <section><h3>当前组合</h3><dl><div><dt>策略模板</dt><dd>{STRATEGY_NAMES[selected]}</dd></div><div><dt>组合身份</dt><dd>{selectedName}{selectedPortfolio.demoOnly ? " · 展示样例" : ""}</dd></div><div><dt>调仓预设</dt><dd>{activePreset}</dd></div><div><dt>独立本金</dt><dd>{money(portfolioCapital)}</dd></div><div><dt>已展开至</dt><dd>{knownDate}</dd></div></dl></section>
            {sourceExposure && <section className="coverage-detail"><h3>来源链已知数据边界</h3><p>来源“{sourceExposure.experimentName}”及其上游实验链，已知数据边界至 {sourceExposure.knownDate}{sourceExposure.time ? ` · ${sourceExposure.time}` : ""}。此来源提示不推进当前实验的 M，也不生成成交。</p></section>}
            <section><h3>演示范围</h3><p>{draft.collection === "review" ? "复盘标的示例集合" : "自选标的示例集合"}；周末日历，没有接入节假日。行情、成交和指标均由合成数据生成，不是真实策略引擎；费用为 0。当前进度只保留在内存中，刷新页面会重置。</p></section>
            {draft.scenario === "partial" && <section className="coverage-detail"><h3>部分覆盖已确认</h3><p>{partialCoverageSummary([selected])}</p></section>}
            {draft.scenario === "missing" && <section className="coverage-detail"><h3>缺失数据</h3><p>{selected === "ema" ? "当前场景缺历史市值，EMA20 组合不可评估。" : "该质量组合仍按合成规则运行；当前缺失数据不影响质量模板的演示评估。"}</p></section>}
            {revealSource && <p className="config-exposure">已看后续最远至 {revealSource.date} · 来源：{exposureSourceLabel(revealSource.source)} · Asia/Shanghai {revealSource.time}</p>}
            <div className="drawer-actions">{onDerive && <button type="button" className="running-secondary" onClick={() => leave(() => onDerive(makeRuntimeProgress(status, knownDate, currentDate, atEnd, revealSource)))}>基于此配置新建实验</button>}<button type="button" className="running-secondary" onClick={() => leave(onReady)}>返回准备配置</button><button type="button" className="running-primary" onClick={closeDrawer}>关闭</button></div>
          </div>}
        </section>
      </div>}
    </main>
    <ResultsPrototype
      draft={portfolioDraft}
      calendar={calendar}
      strategy={selected}
      ledger={ledger}
      maxCursor={selectedMaxCursor}
      initialCursor={resultsInitialCursor}
      entryId={resultsEntryId}
      visible={visible && showingResults}
      portfolioName={selectedName}
      resultBoundary={{
        kind: selectedMaxCursor < cursors.max ? "excluded-partial" : atEnd ? "complete" : "stage",
        maxDate: selectedMaxDate,
      }}
      onReturnProcess={returnToProcess}
      onEvent={openResultEvent}
      onRevealResult={revealResult}
      onCompare={enterComparison}
      compareDisabledReason={comparisonDisabledReason}
    />
    <ComparisonPrototype
      portfolios={comparisonPortfolios}
      calendar={calendar}
      cursor={comparisonCursor}
      mode={comparisonMode}
      selectedPortfolioId={comparisonPortfolioId}
      entryId={comparisonEntryId}
      visible={visible && showingComparison}
      commonMaxCursor={commonMaxCursor}
      onCursorChange={changeComparisonCursor}
      onRevealCommon={revealCommonComparison}
      onRevealSingle={revealSingleComparison}
      onModeChange={changeComparisonMode}
      onReturn={returnFromComparison}
      onEvent={openComparisonEvent}
    />
    </>
  );
}
