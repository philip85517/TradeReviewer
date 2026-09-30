"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { StrategyId } from "./creation-prototype";
import {
  calculateResultAnalysis,
  clampResultCursor,
  type ResultPoint,
} from "./results-model";
import type {
  Calendar,
  RunningDraft,
  Snapshot,
  SymbolId,
  TradeEvent,
} from "./running-model";
import { STRATEGY_NAMES, SYMBOL_IDS, T0_CURSOR } from "./running-model";
import "./results-prototype.css";

export type ResultsPrototypeProps = {
  draft: RunningDraft;
  calendar: Calendar;
  strategy: StrategyId;
  ledger: Snapshot[];
  maxCursor: number;
  initialCursor: number;
  entryId: number;
  visible: boolean;
  portfolioName?: string;
  resultBoundary?: { kind: "stage" | "complete" | "excluded-partial"; maxDate: string };
  onReturnProcess: () => void;
  onEvent: (event: TradeEvent, symbol?: SymbolId) => void;
  onRevealResult: (cursor: number) => void;
  onCompare?: (sourceCursor: number) => void;
  compareDisabledReason?: string;
};

type ChartMode = "value" | "drawdown" | "allocation";
type EventFilter = "all" | "rebalance" | "initial" | "partial" | "unfilled";
type ResultsViewState = { entryId: number; cursor: number; chartMode: ChartMode; eventFilter: EventFilter };

const SYMBOL_COLORS: Record<SymbolId, string> = {
  A: "#69aaf8",
  B: "#4bc5ab",
  C: "#ba9cf5",
  D: "#e2ad61",
};
const CASH_COLOR = "#71839a";

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `¥${Math.abs(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Math.round(Math.abs(value) * 100) === 0) return "¥0.00";
  return `${value > 0 ? "+" : "−"}${money(value)}`;
}

function signedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const percent = Math.abs(value * 100).toFixed(2);
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${percent}%`;
}

function drawdownPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(Math.abs(value) * 100).toFixed(2)}%`;
}

function changeClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value === 0) return "";
  return value > 0 ? "positive" : "negative";
}

function amountClass(value: number | null): string {
  if (value === null || !Number.isFinite(value) || Math.round(Math.abs(value) * 100) === 0) return "";
  return value > 0 ? "positive" : "negative";
}

function dateLabel(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

function eventLabel(event: TradeEvent): string {
  const kind = event.cursor === T0_CURSOR + 1 ? "首次建仓" : "再平衡";
  if (event.executionStatus === "unfilled") return `${kind} · 未成交`;
  return event.executionStatus === "partial" ? `${kind} · 部分成交` : kind;
}

function sampleCoverage(draft: RunningDraft, strategy: StrategyId): { label: string; detail: string; kind: "complete" | "partial" | "missing" | "empty" } {
  if (draft.scenario === "partial") {
    return strategy === "ema"
      ? {
          label: "部分样本覆盖",
          detail: "D 缺历史成交额，未纳入 EMA20 评估；C 缺财报披露时间与此包无关，仍按 EMA20 规则评估。缺失项不计作规则不符。",
          kind: "partial",
        }
      : {
          label: "部分样本覆盖",
          detail: "C 缺财报首次披露时间，未纳入低波动质量包评估；D 缺历史成交额与此包无关，仍按质量规则评估。缺失项不计作规则不符。",
          kind: "partial",
        };
  }
  if (draft.scenario === "missing") {
    return strategy === "ema"
      ? {
          label: "缺少策略依赖字段",
          detail: "当前场景缺少历史市值，EMA20 依赖该字段而不可评估。该场景不应显示为有效的 EMA20 结果。",
          kind: "missing",
        }
      : {
          label: "策略所需字段可用",
          detail: "当前缺少历史市值；EMA20 依赖此字段而不可评估，低波动质量模板不依赖该字段。此结果仅代表质量模板的合成演示评估。",
          kind: "missing",
        };
  }
  if (draft.scenario === "empty") {
    return {
      label: "无候选 · 全现金",
      detail: "此合成场景没有候选标的，资产保持现金且不生成首次建仓事件。净值与现金仓位如实展示，不代表候选筛选后的策略收益。",
      kind: "empty",
    };
  }
  return {
    label: "完整样本覆盖",
    detail: "当前合成演示场景内，所选策略依赖字段均可用。完整覆盖仅指此演示样本字段，不代表真实市场或生产数据完整性。",
    kind: "complete",
  };
}

function weightLabels(point: ResultPoint): { key: string; label: string; color: string; value: number }[] {
  return [
    ...SYMBOL_IDS.map(symbol => ({
      key: symbol,
      label: symbol,
      color: SYMBOL_COLORS[symbol],
      value: point.symbolWeights[symbol] ?? 0,
    })),
    { key: "cash", label: "现金", color: CASH_COLOR, value: point.cashWeight },
  ];
}

function chartPath(points: ResultPoint[], mode: "value" | "drawdown"): {
  line: string;
  area: string;
  xAt: (index: number) => number;
  yAt: (value: number) => number;
  min: number;
  max: number;
} {
  const left = 10;
  const right = 10;
  const top = 12;
  const bottom = 194;
  const width = 1000;
  const values = points.map(point => mode === "value" ? point.netValue : point.drawdown);
  if (values.length === 0) {
    const xAt = () => (left + width - right) / 2;
    const yAt = () => (bottom + top) / 2;
    return { line: "", area: "", xAt, yAt, min: 0, max: 1 };
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (mode === "value") {
    min = Math.min(min, 1);
    max = Math.max(max, 1);
  } else {
    min = Math.min(min, -0.005);
    max = 0;
  }
  if (max - min < 0.0001) {
    min -= 0.001;
    max += 0.001;
  }
  const padding = mode === "value" ? Math.max((max - min) * 0.12, 0.001) : 0;
  min -= padding;
  max += padding;
  const xAt = (index: number) => points.length <= 1
    ? (left + width - right) / 2
    : left + index / (points.length - 1) * (width - left - right);
  const yAt = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  const line = points.map((point, index) => {
    const value = mode === "value" ? point.netValue : point.drawdown;
    return `${index === 0 ? "M" : "L"}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`;
  }).join(" ");
  const baseY = mode === "value" ? yAt(1) : yAt(0);
  const area = `${line} L${xAt(points.length - 1).toFixed(2)},${baseY.toFixed(2)} L${xAt(0).toFixed(2)},${baseY.toFixed(2)} Z`;
  return { line, area, xAt, yAt, min, max };
}

function ResultChart({ points, mode, currentIndex, events, empty }: {
  points: ResultPoint[];
  mode: ChartMode;
  currentIndex: number;
  events: TradeEvent[];
  empty: boolean;
}) {
  const width = 1000;
  const left = 10;
  const right = 10;
  const top = 12;
  const bottom = 194;
  const current = points[currentIndex] ?? points.at(-1);
  const middleY = top + (bottom - top) / 2;
  const gridY = [top, middleY, bottom];
  const geometry = mode === "allocation" ? null : chartPath(points, mode);
  const allocationBands = useMemo(() => {
    if (mode !== "allocation" || points.length === 0) return [];
    const baseX = (index: number) => points.length <= 1
      ? (left + width - right) / 2
      : left + index / (points.length - 1) * (width - left - right);
    let previous = points.map(() => 0);
    const bands = [...SYMBOL_IDS.map(symbol => ({ key: symbol, color: SYMBOL_COLORS[symbol] })), { key: "cash", color: CASH_COLOR }]
      .map(series => {
        const before = previous;
        const after = points.map((point, index) => before[index] + (series.key === "cash"
          ? point.cashWeight
          : point.symbolWeights[series.key as SymbolId] ?? 0));
        const yAt = (weight: number) => bottom - Math.max(0, Math.min(1, weight)) * (bottom - top);
        const upper = points.map((_, index) => `${index === 0 ? "M" : "L"}${baseX(index).toFixed(2)},${yAt(after[index]).toFixed(2)}`).join(" ");
        const lower = points.map((_, reverseIndex) => {
          const index = points.length - reverseIndex - 1;
          return `L${baseX(index).toFixed(2)},${yAt(before[index]).toFixed(2)}`;
        }).join(" ");
        previous = after;
        return { key: series.key, color: series.color, path: `${upper} ${lower} Z` };
      });
    return bands;
  }, [mode, points]);

  const xForCursor = (cursor: number) => points.length <= 1
    ? (left + width - right) / 2
    : left + (cursor - points[0].cursor) / Math.max(1, points.at(-1)!.cursor - points[0].cursor) * (width - left - right);
  const cursorX = current ? xForCursor(current.cursor) : left;
  const valuePath = geometry?.line ?? "";
  const baselineY = geometry ? mode === "value" ? geometry.yAt(1) : geometry.yAt(0) : bottom;
  const currentY = geometry && current
    ? geometry.yAt(mode === "value" ? current.netValue : current.drawdown)
    : baselineY;
  const lineColor = mode === "drawdown" ? "#d47f87" : "#68a9fa";
  const eventDots = events.map(event => ({ event, x: xForCursor(event.cursor) }))
    .filter(({ x }) => Number.isFinite(x));
  const dateTicks = points.length <= 1
    ? [points[0]].filter(Boolean)
    : points.length === 2
      ? [points[0], points.at(-1)].filter(Boolean)
      : [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)].filter(Boolean);
  const axisLabels = empty
    ? ["—", "—", "—"]
    : mode === "allocation"
    ? ["100%", "50%", "0%"]
    : geometry
      ? mode === "value"
        ? [geometry.max.toFixed(4), ((geometry.min + geometry.max) / 2).toFixed(4), geometry.min.toFixed(4)]
        : [signedPercent(geometry.max), signedPercent((geometry.min + geometry.max) / 2), signedPercent(geometry.min)]
      : ["—", "—", "—"];

  return (
    <div className="result-chart-frame">
      <div className="result-chart-body">
        <div className="result-chart-y-axis" aria-hidden="true">
          {axisLabels.map((label, index) => <span key={`${label}-${index}`} className={`axis-${index}`}>{label}</span>)}
        </div>
        <div className="result-chart-plot">
          <svg className="result-svg-chart" viewBox={`0 0 ${width} 210`} preserveAspectRatio="none" role="img" aria-label={mode === "value" ? "组合净值曲线" : mode === "drawdown" ? "组合回撤曲线" : "标的与现金实际仓位曲线"}>
            {gridY.map((y, index) => (
              <line key={`grid-${index}`} x1={left} x2={width - right} y1={y} y2={y} className="result-grid-line" />
            ))}
            {mode !== "allocation" && geometry && (
              <>
                {mode === "value" && <line x1={left} x2={width - right} y1={geometry.yAt(1)} y2={geometry.yAt(1)} className="result-reference-line" />}
                {mode === "drawdown" && <line x1={left} x2={width - right} y1={geometry.yAt(0)} y2={geometry.yAt(0)} className="result-reference-line" />}
                <path d={geometry.area} className={mode === "drawdown" ? "result-drawdown-area" : "result-value-area"} />
                <path d={valuePath} fill="none" stroke={lineColor} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {mode === "allocation" && allocationBands.map(band => (
              <path key={band.key} d={band.path} fill={band.color} fillOpacity="0.72" stroke="#0e1828" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
            ))}
            {eventDots.map(({ event, x }) => (
              <circle key={`${event.cursor}-${event.date}`} cx={x} cy={top + 5} r="3" fill="#92afd0" stroke="#101a2a" strokeWidth="1.5" />
            ))}
            {!empty && <line x1={cursorX} x2={cursorX} y1={top} y2={bottom} className="result-cursor-line" />}
            {!empty && mode !== "allocation" && <circle cx={cursorX} cy={currentY} r="4" fill={lineColor} stroke="#e8f1ff" strokeWidth="1.5" />}
          </svg>
        </div>
      </div>
      <div className={`result-chart-date-axis ${dateTicks.length === 1 ? "single" : dateTicks.length === 2 ? "two" : ""}`} aria-hidden="true">
        {dateTicks.map((point, index) => point && <span key={`${point.cursor}-${index}`}>{point.date.slice(5, 10)}</span>)}
      </div>
      {empty && <div className="result-chart-empty"><b>尚无可分析区间</b><span>图表仅显示 T0 净值起点；推进后会按真实账本绘制。</span></div>}
    </div>
  );
}

function ResultReadout({ point, mode }: { point: ResultPoint | undefined; mode: ChartMode }) {
  return (
      <div className="result-chart-readout" aria-live="polite">
        <span>{point?.date ?? "等待 T0"}</span>
        {mode === "value" && <b>净值 {point?.netValue.toFixed(4) ?? "—"}</b>}
        {mode === "drawdown" && <b>回撤 {signedPercent(point?.drawdown ?? null)}</b>}
        {mode === "allocation" && point && weightLabels(point).map(item => (
          <span className="result-readout-weight" key={item.key}><i style={{ background: item.color }} />{item.label} {(item.value * 100).toFixed(1)}%</span>
        ))}
      </div>
  );
}

export function ResultsPrototype({
  draft,
  calendar,
  strategy,
  ledger,
  maxCursor,
  initialCursor,
  entryId,
  visible,
  portfolioName,
  resultBoundary,
  onReturnProcess,
  onEvent,
  onRevealResult,
  onCompare,
  compareDisabledReason,
}: ResultsPrototypeProps) {
  const [viewState, setViewState] = useState<ResultsViewState>(() => ({ entryId, cursor: initialCursor, chartMode: "value", eventFilter: "all" }));
  const scrollRoot = useRef<HTMLElement>(null);
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const cursorInputId = `result-cursor-${instanceId}`;
  const availableMax = Math.max(T0_CURSOR, Math.min(maxCursor, T0_CURSOR + Math.max(0, ledger.length - 1)));
  const baseCursor = clampResultCursor(initialCursor, maxCursor, ledger.length);
  const isNewEntry = viewState.entryId !== entryId;
  const activeCursor = isNewEntry ? baseCursor : viewState.cursor;
  const chartMode = isNewEntry ? "value" : viewState.chartMode;
  const eventFilter = isNewEntry ? "all" : viewState.eventFilter;

  useEffect(() => {
    if (isNewEntry && scrollRoot.current) scrollRoot.current.scrollTop = 0;
  }, [entryId, isNewEntry]);

  const analysis = useMemo(
    () => calculateResultAnalysis(ledger, activeCursor, maxCursor),
    [activeCursor, ledger, maxCursor],
  );
  const selectedName = portfolioName?.trim() || STRATEGY_NAMES[strategy];
  const currentSnapshot = ledger[analysis.cursor - T0_CURSOR] ?? ledger[0] ?? null;
  const lastExpandedDate = resultBoundary?.maxDate
    ?? calendar.dates[Math.min(maxCursor, calendar.dates.length - 1)]
    ?? analysis.endDate;
  const startDate = dateLabel(analysis.startDate);
  const endDate = dateLabel(analysis.endDate);
  const atAvailableBoundary = analysis.cursor >= availableMax;
  const completeBoundary = resultBoundary
    ? resultBoundary.kind === "complete"
    : maxCursor >= calendar.endIndex;
  const fullRange = atAvailableBoundary && completeBoundary;
  const excludedPartialBoundary = resultBoundary?.kind === "excluded-partial";
  const resultKind = excludedPartialBoundary ? "排除组合 · 部分区间" : fullRange ? "完整区间" : "阶段结果";
  const visibleEvents = analysis.events.filter(event => eventFilter === "all"
    || (eventFilter === "rebalance" && event.cursor > T0_CURSOR + 1 && event.executionStatus !== "unfilled")
    || (eventFilter === "initial" && event.cursor === T0_CURSOR + 1)
    || (eventFilter === "partial" && event.executionStatus === "partial")
    || (eventFilter === "unfilled" && event.executionStatus === "unfilled"));
  const contributions = analysis.symbolContributions;
  const cursorIndex = Math.max(0, analysis.cursor - T0_CURSOR);
  const chosenPreset = draft.presets[strategy];
  const noTrades = analysis.tradeCount === 0;
  const emptyPosition = (currentSnapshot?.holdings.length ?? 0) === 0;
  const accountPnl = analysis.totalPnl;
  const initialCapital = analysis.initialAssets;
  const previousSnapshot = ledger[analysis.cursor - T0_CURSOR - 1] ?? null;
  const dailyReturnAmount = previousSnapshot && currentSnapshot
    ? currentSnapshot.equity - previousSnapshot.equity
    : null;
  const dailyReturnRate = previousSnapshot && previousSnapshot.equity > 0 && dailyReturnAmount !== null
    ? dailyReturnAmount / previousSnapshot.equity
    : null;
  const coverage = sampleCoverage(draft, strategy);

  function selectCursor(value: number) {
    const nextCursor = clampResultCursor(value, maxCursor, ledger.length);
    setViewState(previous => ({
      entryId,
      cursor: nextCursor,
      chartMode: previous.entryId === entryId ? previous.chartMode : "value",
      eventFilter: previous.entryId === entryId ? previous.eventFilter : "all",
    }));
    if (nextCursor > baseCursor) onRevealResult(nextCursor);
  }

  function selectChartMode(nextMode: ChartMode) {
    setViewState(previous => ({
      entryId,
      cursor: previous.entryId === entryId ? previous.cursor : baseCursor,
      chartMode: nextMode,
      eventFilter: previous.entryId === entryId ? previous.eventFilter : "all",
    }));
  }

  function selectEventFilter(nextFilter: EventFilter) {
    setViewState(previous => ({
      entryId,
      cursor: previous.entryId === entryId ? previous.cursor : baseCursor,
      chartMode: previous.entryId === entryId ? previous.chartMode : "value",
      eventFilter: nextFilter,
    }));
  }

  return (
    <main className="results-prototype" hidden={!visible} ref={scrollRoot} aria-label="组合回测结果">
      <header className="results-header">
        <div className="results-title-block">
          <div className="results-eyebrow">策略实验 <span>/</span> 回测结果</div>
          <h1>{selectedName}</h1>
          <p>{STRATEGY_NAMES[strategy]} · {chosenPreset} · {draft.collection === "review" ? "复盘示例集合" : "自选示例集合"}</p>
        </div>
        <div className="results-header-actions">
          <span className="results-synthetic">交互原型 · 合成数据 · 刷新重置</span>
          {onCompare && (
            <span className="results-compare-entry">
              <button className="results-compare-button" type="button" onClick={() => onCompare(analysis.cursor)} disabled={Boolean(compareDisabledReason)} aria-describedby={compareDisabledReason ? "results-compare-disabled-reason" : undefined}>比较组合</button>
              {compareDisabledReason && <small id="results-compare-disabled-reason">{compareDisabledReason}</small>}
            </span>
          )}
          <button className="results-return-button" type="button" onClick={onReturnProcess}>返回过程回看</button>
        </div>
      </header>

      <section className="results-period" aria-label="结果截止与数据口径">
        <div className="results-period-main">
          <span className={`results-kind ${fullRange ? "complete" : excludedPartialBoundary ? "excluded" : "stage"}`}>{resultKind}</span>
          <b>{startDate} — {endDate}</b>
          <span>结果截至 R · {endDate}</span>
        </div>
        <div className="results-period-meta">
          <span>{excludedPartialBoundary ? "该组合最后完整日" : "可用数据边界"} {dateLabel(lastExpandedDate)}</span>
          <span>本金 {money(initialCapital)} · 收盘估值 · 次日开盘成交</span>
        </div>
      </section>

      <details className={`results-coverage ${coverage.kind}`}>
        <summary><span>{coverage.label}</span><b>查看数据覆盖说明</b></summary>
        <p>{coverage.detail}</p>
      </details>

      <section className="results-kpis" aria-label="核心结果指标">
        <article className="results-kpi">
          <span>累计收益</span>
          <strong className={changeClass(analysis.cumulativeReturn)}>{signedPercent(analysis.cumulativeReturn)}</strong>
          <small>净值 − 1</small>
        </article>
        <article className="results-kpi">
          <span>最大回撤</span>
          <strong className="neutral-number">{drawdownPercent(analysis.maxDrawdown)}</strong>
          <small>{analysis.maxDrawdown === null ? "尚无有效交易日" : "截至当前 R 的已知峰值"}</small>
        </article>
        <article className="results-kpi">
          <span>期末总资产</span>
          <strong className="neutral-number">{money(analysis.totalAssets)}</strong>
          <small>组合当日收益 <b className={amountClass(dailyReturnAmount)}>{dailyReturnAmount === null ? "— · 尚未开始" : `${signedMoney(dailyReturnAmount)} · ${signedPercent(dailyReturnRate)}`}</b></small>
        </article>
        <article className="results-kpi">
          <span>再平衡次数</span>
          <strong className="neutral-number">{analysis.rebalanceCount}</strong>
          <small>首次执行 {analysis.initialExecutionCount} · 部分成交 {analysis.partialExecutionCount} · 未成交 {analysis.unfilledExecutionCount}</small>
        </article>
      </section>

      {!analysis.hasAnalyzablePeriod && (
        <div className="results-empty-note" role="status">
          <b>暂无可分析区间</b>
          <span>T0 已确认初始本金 {money(initialCapital)}；尚未发生交易日，暂不显示区间收益与回撤。</span>
        </div>
      )}

      <section className="results-analysis-grid" aria-label="净值图与结果拆分">
        <article className="results-panel results-chart-panel">
          <div className="results-panel-heading">
            <div>
              <span className="results-section-kicker">结果走势</span>
              <h2>组合表现</h2>
            </div>
            <div className="results-chart-tabs" role="tablist" aria-label="结果图表类型">
              <button type="button" role="tab" aria-selected={chartMode === "value"} className={chartMode === "value" ? "active" : ""} onClick={() => selectChartMode("value")}>净值</button>
              <button type="button" role="tab" aria-selected={chartMode === "drawdown"} className={chartMode === "drawdown" ? "active" : ""} onClick={() => selectChartMode("drawdown")}>回撤</button>
              <button type="button" role="tab" aria-selected={chartMode === "allocation"} className={chartMode === "allocation" ? "active" : ""} onClick={() => selectChartMode("allocation")}>仓位</button>
            </div>
          </div>
          <div className="results-chart-subhead">
            <span>{chartMode === "value" ? "组合净值 · T0 = 1.0000" : chartMode === "drawdown" ? "相对截至 R 的历史峰值" : "标的及现金 · 每日收盘实际权重"}</span>
            {chartMode === "allocation" && <div className="results-legend">{weightLabels(analysis.points.at(-1) ?? { cursor: 0, date: "", equity: 0, netValue: 1, drawdown: 0, cashWeight: 1, symbolWeights: { A: 0, B: 0, C: 0, D: 0 } }).map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>}
          </div>
          <ResultChart points={analysis.points} mode={chartMode} currentIndex={cursorIndex} events={analysis.events} empty={!analysis.hasAnalyzablePeriod} />
          <ResultReadout point={analysis.points[cursorIndex]} mode={chartMode} />
          <div className="results-range-control">
            <button type="button" className="results-range-step" aria-label="上一个交易日" disabled={analysis.cursor <= T0_CURSOR} onClick={() => selectCursor(analysis.cursor - 1)}>−</button>
          <label htmlFor={cursorInputId}>
              <span>结果截止 R <b>{endDate}</b></span>
              <input id={cursorInputId} type="range" min={T0_CURSOR} max={availableMax} step={1} value={analysis.cursor} disabled={availableMax <= T0_CURSOR} onChange={event => selectCursor(Number(event.currentTarget.value))} />
            </label>
            <button type="button" className="results-range-step" aria-label="下一个已展开交易日" disabled={analysis.cursor >= availableMax} onClick={() => selectCursor(analysis.cursor + 1)}>+</button>
            <button type="button" className="results-range-latest" disabled={analysis.cursor >= availableMax} onClick={() => selectCursor(availableMax)}>最远已展开</button>
          </div>
        </article>

        <aside className="results-panel results-pnl-panel">
          <div className="results-panel-heading compact">
              <div><span className="results-section-kicker">账本损益</span><h2>损益构成</h2></div>
            <span className="results-asof">截至 {endDate}</span>
          </div>
          <div className="results-pnl-total">
            <span>组合总损益</span>
            <b className={amountClass(accountPnl)}>{signedMoney(accountPnl)}</b>
          </div>
          <div className="results-pnl-row"><span>已平仓回合净盈亏 <small>{analysis.closedRoundCount} 个</small></span><b className={amountClass(analysis.closedRoundNetPnl)}>{analysis.closedRoundNetPnl === null ? "— · 尚无已平仓回合" : signedMoney(analysis.closedRoundNetPnl)}</b></div>
          <div className="results-pnl-row"><span>部分减仓已实现 <small>未平仓回合</small></span><b className={amountClass(analysis.partialReductionRealized)}>{analysis.partialReductionRealized === null ? "— · 当前无部分减仓" : signedMoney(analysis.partialReductionRealized)}</b></div>
          <div className="results-pnl-row"><span>持仓浮动盈亏</span><b className={amountClass(analysis.openUnrealizedPnl)}>{emptyPosition ? "— · 当前无持仓" : signedMoney(analysis.openUnrealizedPnl)}</b></div>
          <div className="results-pnl-row"><span>现金损益 <small>原型现金不计息</small></span><b>{signedMoney(analysis.cashPnl)}</b></div>
          <div className="results-pnl-foot">
            <span>胜率</span>
            <b>{analysis.closedRoundWinRate === null ? "不可计算 · 尚无已平仓回合" : `${(analysis.closedRoundWinRate * 100).toFixed(1)}% · ${analysis.closedRoundWins}/${analysis.closedRoundCount} 回合`}</b>
          </div>
          <div className={`results-reconciliation ${analysis.reconcilesToLedger ? "ok" : "pending"}`}>
            <span>{analysis.reconcilesToLedger ? "✓" : "·"}</span>
            <div><b>{analysis.reconcilesToLedger ? "损益与账本对账" : "损益对账待完整数据"}</b><small>差额 {signedMoney(analysis.reconciliationDifference)}</small></div>
          </div>
        </aside>
      </section>

      <section className="results-detail-grid" aria-label="标的贡献与调仓明细">
        <article className="results-panel results-contribution-panel">
          <div className="results-panel-heading compact">
              <div><span className="results-section-kicker">损益归因</span><h2>标的贡献</h2></div>
            <span className="results-asof">按持仓回合拆分</span>
          </div>
          {contributions.length > 0 ? (
            <div className="results-table-scroll">
              <table className="results-contribution-table">
                <thead><tr><th>标的</th><th>已平仓回合</th><th>部分减仓</th><th>浮动损益</th><th>合计</th></tr></thead>
                <tbody>{contributions.map(item => (
                  <tr key={item.symbol}>
                    <th><i style={{ background: SYMBOL_COLORS[item.symbol] }} />{item.symbol}</th>
                    <td className={amountClass(item.closedRoundCount > 0 ? item.closedRoundNetPnl : null)}>{item.closedRoundCount > 0 ? signedMoney(item.closedRoundNetPnl) : "—"}</td>
                    <td className={amountClass(item.partialReductionRealized)}>{signedMoney(item.partialReductionRealized)}</td>
                    <td className={amountClass(item.unrealizedPnl)}>{emptyPosition ? "—" : signedMoney(item.unrealizedPnl)}</td>
                    <td className={`results-total-cell ${amountClass(item.totalPnl)}`}>{signedMoney(item.totalPnl)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="results-no-contribution">{noTrades ? "尚无成交；目前资产全部为现金。" : "当前无持仓或平仓活动。"}</div>
          )}
          <div className="results-cost-note">
            <span>费用 <b>¥0.00</b></span><span>滑点 <b>¥0.00</b></span>
            <small>损益按 FIFO 成本配对；合成执行不计费用或滑点。换手 = 双边总成交额 ÷ 初始本金：{analysis.turnoverOnInitialCapital === null ? "—" : `${(analysis.turnoverOnInitialCapital * 100).toFixed(2)}%`}（成交额 {money(analysis.turnoverNotional)}）。</small>
          </div>
        </article>

        <article className="results-panel results-events-panel">
          <div className="results-panel-heading compact">
              <div><span className="results-section-kicker">执行记录</span><h2>调仓与成交</h2></div>
            <span className="results-event-count">{analysis.eventCount} 个事件</span>
          </div>
          <div className="results-event-filters" role="group" aria-label="筛选结果事件及执行状态">
            <button type="button" className={eventFilter === "all" ? "active" : ""} aria-pressed={eventFilter === "all"} onClick={() => selectEventFilter("all")}>全部</button>
            <button type="button" className={eventFilter === "rebalance" ? "active" : ""} aria-pressed={eventFilter === "rebalance"} onClick={() => selectEventFilter("rebalance")}>再平衡</button>
            <button type="button" className={eventFilter === "initial" ? "active" : ""} aria-pressed={eventFilter === "initial"} onClick={() => selectEventFilter("initial")}>首次建仓</button>
            <button type="button" className={eventFilter === "partial" ? "active" : ""} aria-pressed={eventFilter === "partial"} onClick={() => selectEventFilter("partial")}>部分成交</button>
            <button type="button" className={eventFilter === "unfilled" ? "active" : ""} aria-pressed={eventFilter === "unfilled"} onClick={() => selectEventFilter("unfilled")}>未成交</button>
          </div>
          {visibleEvents.length > 0 ? (
            <div className="results-event-list">
              {[...visibleEvents].reverse().map(event => {
                const actualTrades = event.executionStatus === "unfilled" ? [] : event.trades;
                const firstTrade = actualTrades[0];
                const plannedCount = event.plannedTrades?.length ?? actualTrades.length;
                const fillSummary = event.executionStatus === "unfilled"
                  ? `计划 ${plannedCount} 笔 · 实际成交 0 笔`
                  : event.executionStatus === "partial"
                    ? `计划 ${plannedCount} 笔 · 部分成交 ${actualTrades.length} 笔${firstTrade ? ` · ${firstTrade.symbol} ${firstTrade.delta > 0 ? "买入" : "卖出"} ${Math.abs(firstTrade.delta).toFixed(2)} 股` : ""}`
                    : `${actualTrades.length} 笔实际成交 · ${firstTrade ? `${firstTrade.symbol} ${firstTrade.delta > 0 ? "买入" : "卖出"} ${Math.abs(firstTrade.delta).toFixed(2)} 股` : "无成交"}`;
                return (
                  <button type="button" className={`results-event-row ${event.executionStatus === "partial" ? "partial" : event.executionStatus === "unfilled" ? "unfilled" : ""}`} key={`${event.cursor}-${event.date}`} onClick={() => onEvent(event, firstTrade?.symbol ?? event.plannedTrades?.[0]?.symbol)}>
                    <span className="results-event-marker" aria-hidden="true" />
                    <span className="results-event-copy">
                      <b>{eventLabel(event)} <small>{event.date}</small></b>
                      <span>{fillSummary}</span>
                      {event.executionNote && <small className="results-event-execution-note">{event.executionNote}</small>}
                    </span>
                    <span className="results-event-open" aria-label="回看过程">›</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="results-no-events">{analysis.eventCount === 0 ? "此结果区间没有已执行事件。" : "当前筛选没有对应事件。"}</div>
          )}
          <p className="results-event-note">部分成交与未成交均是完整交易日的执行结果；未成交不计入已执行再平衡。点击事件按真实成交账本返回过程回看。</p>
        </article>
      </section>

      <footer className="results-footer-note">
        <span>金额按 ¥ 显示；净值 = 总资产 ÷ 初始本金，回撤只使用截至 R 的历史峰值。</span>
          <span>暂无可比较基准 · 不计算超额收益、年化或夏普比率。</span>
      </footer>
    </main>
  );
}
