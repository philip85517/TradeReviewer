"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StrategyId } from "./creation-prototype";
import {
  DEMO_PORTFOLIO_IDS,
  STRATEGY_NAMES,
  STRATEGY_PORTFOLIO_IDS,
  T0_CURSOR,
  type Calendar,
  type PortfolioId,
  type RunningDraft,
  type Snapshot,
  type SymbolId,
  type TradeEvent,
} from "./running-model";
import { calculateResultAnalysis, type ResultAnalysis } from "./results-model";
import { ComparisonChart, type ComparisonChartMode, type ComparisonChartSeries } from "./comparison-chart";
import "./comparison-prototype.css";

export type ComparisonMode = "synchronized" | "single";
export type ComparisonPortfolioStatus = "active" | "failed" | "excluded";

export type ComparisonPortfolio = {
  id: PortfolioId;
  name: string;
  strategy: StrategyId;
  capital: number;
  draft: RunningDraft;
  ledger: Snapshot[];
  maxCursor: number;
  status: ComparisonPortfolioStatus;
  failureDate?: string;
};

export type ComparisonPrototypeProps = {
  portfolios: ComparisonPortfolio[];
  calendar: Calendar;
  cursor: number;
  mode: ComparisonMode;
  selectedPortfolioId: PortfolioId;
  entryId: number;
  visible: boolean;
  commonMaxCursor: number;
  onCursorChange: (cursor: number) => void;
  onRevealCommon: () => void;
  onRevealSingle: (portfolioId: PortfolioId) => void;
  onModeChange: (mode: ComparisonMode, selectedPortfolioId?: PortfolioId) => void;
  onReturn: () => void;
  onEvent: (portfolioId: PortfolioId, event: TradeEvent, symbol?: SymbolId) => void;
};

type ComparisonDefinition = {
  id: string;
  label: string;
  value: (portfolio: ComparisonPortfolio) => string;
};
type SharedComparisonDefinition = { id: string; label: string; value: string };
type ExecutionFilter = "all" | "filled" | "partial" | "unfilled";
type PortfolioFilter = "all" | PortfolioId;

const COMPARISON_DEFINITIONS: ComparisonDefinition[] = [
  { id: "start", label: "起始时点", value: portfolio => portfolio.draft.date.replace("T", " · ") },
  { id: "dataset", label: "数据集合", value: portfolio => dataSetText(portfolio.draft) },
  { id: "execution", label: "币种与执行", value: () => "CNY · 收盘估值 · 次日开盘成交" },
  { id: "fees", label: "费用与滑点", value: () => "费用 ¥0.00 · 滑点 ¥0.00 · 合成演示" },
];

const PORTFOLIO_COLORS: Record<PortfolioId, string> = {
  [STRATEGY_PORTFOLIO_IDS.ema]: "#69aaf8",
  [STRATEGY_PORTFOLIO_IDS.quality]: "#b49af5",
  [DEMO_PORTFOLIO_IDS.longName]: "#a8b7c9",
  [DEMO_PORTFOLIO_IDS.extraEma]: "#d4b86a",
  [DEMO_PORTFOLIO_IDS.extraQuality]: "#7ebbd7",
  [DEMO_PORTFOLIO_IDS.extraBalanced]: "#c496ad",
};

const PORTFOLIO_DASHES: Record<PortfolioId, string> = {
  [STRATEGY_PORTFOLIO_IDS.ema]: "",
  [STRATEGY_PORTFOLIO_IDS.quality]: "8 4",
  [DEMO_PORTFOLIO_IDS.longName]: "2 4",
  [DEMO_PORTFOLIO_IDS.extraEma]: "10 3 2 3",
  [DEMO_PORTFOLIO_IDS.extraQuality]: "5 3",
  [DEMO_PORTFOLIO_IDS.extraBalanced]: "1 3",
};

function dateAt(calendar: Calendar, cursor: number): string {
  return calendar.dates[Math.max(0, Math.min(cursor, calendar.dates.length - 1))] ?? "—";
}

function portfolioDate(portfolio: ComparisonPortfolio | undefined, cursor: number): string {
  if (!portfolio) return "—";
  return portfolio.ledger[cursor - T0_CURSOR]?.date ?? portfolio.draft.date.slice(0, 10);
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "— · 不可用"
    : "¥" + Math.abs(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signedMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "— · 不可用";
  const amount = "¥" + Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value > 0 ? "+" + amount : value < 0 ? "−" + amount : amount;
}

function signedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "— · 不可用";
  const formatted = (Math.abs(value) * 100).toFixed(2) + "%";
  return value > 0 ? "+" + formatted : value < 0 ? "−" + formatted : formatted;
}

function drawdownPercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "— · 不可用" : (Math.abs(value) * 100).toFixed(2) + "%";
}

function percentage(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "— · 不可用" : (Math.abs(value) * 100).toFixed(2) + "%";
}

function cashPercentage(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "— · 不可用" : (Math.abs(value) * 100).toFixed(1) + "%";
}

function closedRoundWinRate(analysis: ResultAnalysis): string {
  if (analysis.closedRoundCount === 0) return "不可计算 · 无已平仓交易";
  return percentage(analysis.closedRoundWinRate);
}

function dataSetText(draft: RunningDraft): string {
  const collection = draft.collection === "review" ? "复盘示例集合" : "自选示例集合";
  const scenario: Record<RunningDraft["scenario"], string> = {
    complete: "完整样本",
    partial: "部分样本",
    missing: "缺字段样本",
    empty: "空集合样本",
  };
  return collection + " · " + scenario[draft.scenario] + " · 合成样本 v1";
}

function statusText(portfolio: ComparisonPortfolio, mode: ComparisonMode, selectedId: PortfolioId): string {
  const hiddenBySingleMode = mode === "single" && portfolio.id !== selectedId;
  if (portfolio.status === "failed") {
    return "失败" + (portfolio.failureDate ? " · " + portfolio.failureDate : "")
      + " · 最后完整日 " + portfolioDate(portfolio, portfolio.maxCursor)
      + (hiddenBySingleMode ? " · 单组合收益隐藏" : "");
  }
  if (portfolio.status === "excluded") {
    return "已排除 · 最后完整日 " + portfolioDate(portfolio, portfolio.maxCursor)
      + (hiddenBySingleMode ? " · 单组合收益隐藏" : "");
  }
  if (hiddenBySingleMode) return "单组合收益未显示 · 最后完整日 " + portfolioDate(portfolio, portfolio.maxCursor);
  return mode === "single" ? "单组合 · 截止 " + portfolioDate(portfolio, portfolio.maxCursor) : "共同区间可用";
}

function dataQualityText(portfolio: ComparisonPortfolio): string {
  if (portfolio.draft.scenario === "partial" && portfolio.strategy === "ema") {
    return "D 缺历史成交额，未纳入 EMA20 评估；C 缺财报披露时间与 EMA20 无关，仍按本包字段评估。";
  }
  if (portfolio.draft.scenario === "partial") {
    return "C 缺财报首次披露时间，未纳入低波动质量评估；D 缺历史成交额与质量规则无关，仍按本包字段评估。";
  }
  if (portfolio.draft.scenario === "missing" && portfolio.strategy === "ema") {
    return "演示场景缺少历史市值，EMA20 依赖此字段，暂不可评估。";
  }
  if (portfolio.draft.scenario === "missing") {
    return "此场景缺少 EMA20 所需历史市值；低波动质量包不依赖该字段。";
  }
  if (portfolio.draft.scenario === "empty") return "当前演示集合没有候选标的，不构成规则未通过。";
  return "演示范围内的必需字段齐全；不代表真实市场覆盖。";
}

function intervalLabel(
  portfolios: ComparisonPortfolio[],
  mode: ComparisonMode,
  selectedId: PortfolioId,
  cursor: number,
  effectiveMax: number,
  plannedEndCursor: number,
): string {
  if (mode === "single") {
    const selected = portfolios.find(portfolio => portfolio.id === selectedId);
    if (!selected) return "非同步 · 单组合";
    const complete = selected.status === "active" && selected.maxCursor >= plannedEndCursor;
    if (complete && cursor >= plannedEndCursor) return "非同步 · 完整区间";
    return "非同步 · " + (selected.status === "failed" || selected.status === "excluded" ? "部分区间" : "阶段结果");
  }
  if (portfolios.some(portfolio => portfolio.status === "failed" || portfolio.status === "excluded")) {
    return "共同部分区间";
  }
  if (cursor >= plannedEndCursor && effectiveMax >= plannedEndCursor) return "完整区间";
  return "阶段结果";
}

function comparisonDefinitionGroups(portfolios: ComparisonPortfolio[]) {
  const shared: SharedComparisonDefinition[] = [];
  const differences: ComparisonDefinition[] = [];
  if (portfolios.length === 0) return { shared, differences };

  for (const definition of COMPARISON_DEFINITIONS) {
    const values = portfolios.map(definition.value);
    const firstValue = values[0];
    if (firstValue !== undefined && values.every(value => value === firstValue)) {
      shared.push({ id: definition.id, label: definition.label, value: firstValue });
    } else {
      differences.push(definition);
    }
  }
  return { shared, differences };
}

function executionText(event: TradeEvent): string {
  if (event.executionStatus === "unfilled") return "未成交";
  if (event.executionStatus === "partial") return "部分成交";
  return "已执行";
}

function eventExecutionKind(event: TradeEvent): Exclude<ExecutionFilter, "all"> {
  return event.executionStatus === "unfilled" ? "unfilled" : event.executionStatus === "partial" ? "partial" : "filled";
}

function countText(value: number | null, missing = "不可用"): string {
  return value === null || !Number.isFinite(value) ? "— · " + missing : value.toLocaleString("zh-CN");
}

export function ComparisonPrototype({
  portfolios,
  calendar,
  cursor,
  mode,
  selectedPortfolioId,
  entryId,
  visible,
  commonMaxCursor,
  onCursorChange,
  onRevealCommon,
  onRevealSingle,
  onModeChange,
  onReturn,
  onEvent,
}: ComparisonPrototypeProps) {
  const scrollRoot = useRef<HTMLElement>(null);
  const entryDefaults = useRef({ ids: portfolios.slice(0, 4).map(portfolio => portfolio.id), selectedPortfolioId });
  const lastEntryId = useRef(entryId);
  const wasVisible = useRef(visible);
  const savedScrollTop = useRef(0);

  const [chartMode, setChartMode] = useState<ComparisonChartMode>("net-value");
  const [visibleSeriesIds, setVisibleSeriesIds] = useState<PortfolioId[]>(() => portfolios.slice(0, 4).map(item => item.id));
  const [allocationPortfolioId, setAllocationPortfolioId] = useState<PortfolioId>(selectedPortfolioId);
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>("all");
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>("all");
  const [legendLimitMessage, setLegendLimitMessage] = useState("");

  useEffect(() => {
    entryDefaults.current = { ids: portfolios.slice(0, 4).map(portfolio => portfolio.id), selectedPortfolioId };
  }, [entryId, portfolios, selectedPortfolioId]);

  useEffect(() => {
    if (lastEntryId.current !== entryId) {
      const defaults = entryDefaults.current;
      setChartMode("net-value");
      setVisibleSeriesIds(defaults.ids);
      setAllocationPortfolioId(defaults.selectedPortfolioId);
      setPortfolioFilter("all");
      setExecutionFilter("all");
      setLegendLimitMessage("");
      savedScrollTop.current = 0;
      scrollRoot.current?.scrollTo({ top: 0, behavior: "auto" });
      lastEntryId.current = entryId;
    } else if (visible && !wasVisible.current) {
      scrollRoot.current?.scrollTo({ top: savedScrollTop.current, behavior: "auto" });
    }
    wasVisible.current = visible;
  }, [entryId, visible]);

  const analyses = useMemo(() => new Map(portfolios.map(portfolio => {
    const isDisplayed = mode === "synchronized" || portfolio.id === selectedPortfolioId;
    const limit = mode === "synchronized" ? Math.min(commonMaxCursor, portfolio.maxCursor) : portfolio.maxCursor;
    const requested = isDisplayed ? cursor : T0_CURSOR;
    return [portfolio.id, calculateResultAnalysis(portfolio.ledger, requested, limit)] as const;
  })), [portfolios, mode, commonMaxCursor, cursor, selectedPortfolioId]);

  const allocationPortfolio = (mode === "single"
    ? portfolios.find(portfolio => portfolio.id === selectedPortfolioId)
    : portfolios.find(portfolio => portfolio.id === allocationPortfolioId))
    ?? portfolios.find(portfolio => portfolio.id === selectedPortfolioId)
    ?? portfolios[0];
  const allocationAnalysis = allocationPortfolio
    ? calculateResultAnalysis(
      allocationPortfolio.ledger,
      Math.min(cursor, allocationPortfolio.maxCursor),
      allocationPortfolio.maxCursor,
    )
    : undefined;
  const selectedPortfolio = portfolios.find(portfolio => portfolio.id === selectedPortfolioId);
  const displayedPortfolio = mode === "single" ? selectedPortfolio : portfolios[0];
  const currentDate = portfolioDate(displayedPortfolio, cursor);
  const chartDate = chartMode === "allocation" ? allocationAnalysis?.endDate ?? currentDate : currentDate;
  const startDate = portfolios[0]?.ledger[0]?.date ?? portfolios[0]?.draft.date.slice(0, 10) ?? "—";
  const effectiveMax = mode === "synchronized"
    ? commonMaxCursor
    : selectedPortfolio?.maxCursor ?? T0_CURSOR;
  const plannedEndCursor = calendar.endIndex;
  const interval = intervalLabel(portfolios, mode, selectedPortfolioId, cursor, effectiveMax, plannedEndCursor);
  const definitionGroups = comparisonDefinitionGroups(portfolios);
  const visibleSeries = mode === "single"
    ? portfolios.filter(portfolio => portfolio.id === selectedPortfolioId)
    : portfolios.filter(portfolio => visibleSeriesIds.includes(portfolio.id)).slice(0, 4);
  const lineSeries: ComparisonChartSeries[] = visibleSeries.map(portfolio => ({
    id: portfolio.id,
    name: portfolio.name,
    analysis: analyses.get(portfolio.id)!,
    color: PORTFOLIO_COLORS[portfolio.id],
    dash: PORTFOLIO_DASHES[portfolio.id],
  }));
  const plotSeries: ComparisonChartSeries[] = chartMode === "allocation" && allocationPortfolio && allocationAnalysis
    ? [{
      id: allocationPortfolio.id,
      name: allocationPortfolio.name,
      analysis: allocationAnalysis,
      color: PORTFOLIO_COLORS[allocationPortfolio.id],
      dash: PORTFOLIO_DASHES[allocationPortfolio.id],
    }]
    : lineSeries;
  const plotHasData = plotSeries.some(item => item.analysis.hasAnalyzablePeriod);
  const chartEmpty = !plotHasData;

  const filteredEvents = portfolios.flatMap(portfolio => {
    if (mode === "single" && portfolio.id !== selectedPortfolioId) return [];
    const analysis = analyses.get(portfolio.id);
    if (!analysis) return [];
    return analysis.events
      .filter(() => mode === "single" || portfolioFilter === "all" || portfolioFilter === portfolio.id)
      .filter(event => executionFilter === "all" || eventExecutionKind(event) === executionFilter)
      .map(event => ({ portfolio, event }));
  }).sort((left, right) => right.event.cursor - left.event.cursor);

  const shownMetrics = (portfolio: ComparisonPortfolio) => mode === "synchronized" || portfolio.id === selectedPortfolioId;

  function toggleSeries(id: PortfolioId) {
    setLegendLimitMessage("");
    if (mode === "single") {
      if (id !== selectedPortfolioId) {
        onModeChange("single", id);
        setAllocationPortfolioId(id);
      }
      return;
    }
    if (visibleSeriesIds.includes(id)) {
      if (visibleSeriesIds.length === 1) {
        setLegendLimitMessage("至少保留一条曲线；如需单独检查其他组，可选择该组或切换为单组合结果。");
        return;
      }
      setVisibleSeriesIds(current => current.filter(currentId => currentId !== id));
      return;
    }
    if (visibleSeriesIds.length >= 4) {
      setLegendLimitMessage("最多同时显示 4 条曲线；先关闭一组，再切换到其他组合。单组结果仍可从上方组合名称进入。");
      return;
    }
    setVisibleSeriesIds(current => [...current, id]);
  }

  return (
    <main
      className="comparison-prototype"
      hidden={!visible}
      ref={scrollRoot}
      onScroll={() => { savedScrollTop.current = scrollRoot.current?.scrollTop ?? 0; }}
      data-entry-id={entryId}
      aria-label="组合比较"
    >
      <header className="comparison-header">
        <div className="comparison-title-block">
          <div className="comparison-eyebrow">策略实验 <span>/</span> 组合比较</div>
          <h1>组合表现比较</h1>
          <p>
            {portfolios.length} 个组合 · 独立本金 · 结果仅截至当前 R
            <span className="comparison-prototype-badge">交互原型 · 合成数据 · 刷新重置</span>
          </p>
        </div>
        <div className="comparison-header-actions">
          {mode === "single" && (
            <button type="button" className="comparison-secondary" onClick={() => onModeChange("synchronized")}>
              返回共同区间
            </button>
          )}
          {mode === "synchronized" && commonMaxCursor > cursor && (
            <button type="button" className="comparison-primary" onClick={onRevealCommon}>
              查看共同已展开区间 · {dateAt(calendar, commonMaxCursor)}
            </button>
          )}
          <button type="button" className="comparison-secondary" onClick={onReturn}>返回过程回看</button>
        </div>
      </header>

      <section className="comparison-period" aria-label="比较区间与结果截止">
        <div>
          <span className={"comparison-kind" + (mode === "single" ? " single" : "")}>
            {mode === "single" ? "非同步 · 单组合" : "共同有效区间"}
          </span>
          <b>{startDate} — {currentDate}</b>
          <span>{interval} · 结果截至 R</span>
        </div>
        <p>
          {mode === "synchronized"
            ? "共同截止取各组合最后完整日中的最早日期 · " + portfolioDate(portfolios.find(item => item.maxCursor === commonMaxCursor), commonMaxCursor)
            : "当前组合：" + (selectedPortfolio?.name ?? "所选组合") + " · 其他组合收益不显示"}
          {" · 计划终点 " + calendar.nominalEnd}
        </p>
      </section>

      <section className="comparison-matrix-section" aria-label="组合配置与核心指标">
        <div className="comparison-section-heading comparison-matrix-heading">
          <div><span>比较口径</span><h2>方案与当前指标</h2></div>
          <span className="comparison-difference-note">
            {definitionGroups.differences.length ? "样本范围差异见表格" : "未提供可信基准 · 未计算超额收益"}
          </span>
        </div>

        <details className="comparison-shared-terms" key={entryId}>
          <summary>
            {definitionGroups.shared.length
              ? "相同计算口径 · " + definitionGroups.shared.map(item => item.label).join("、")
              : "起点、样本或执行口径存在差异，见下表"}
          </summary>
          {definitionGroups.shared.length > 0 && (
            <dl className="comparison-shared-terms-values">
              {definitionGroups.shared.map(item => (
                <div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>
              ))}
            </dl>
          )}
        </details>

        <div
          className="comparison-summary-scroll"
          role="region"
          aria-label="组合配置与指标，可纵向和横向滚动"
          tabIndex={0}
        >
          <table className="comparison-summary-table">
            <thead>
              <tr>
                <th scope="col">组合</th>
                <th scope="col">本金 · 策略 / 预设</th>
                {definitionGroups.differences.length > 0 && <th scope="col">本组口径差异</th>}
                <th scope="col">累计收益</th>
                <th scope="col">最大回撤</th>
                <th scope="col">期末总资产</th>
                <th scope="col">已执行再平衡</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map(portfolio => {
                const analysis = analyses.get(portfolio.id)!;
                const isShown = shownMetrics(portfolio);
                const differenceText = definitionGroups.differences
                  .map(definition => definition.label + "：" + definition.value(portfolio))
                  .join(" · ");
                return (
                  <tr key={portfolio.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className="comparison-portfolio-link"
                        onClick={() => onModeChange("single", portfolio.id)}
                        aria-label={"查看单组合结果：" + portfolio.name}
                      >
                        <i style={{ backgroundColor: PORTFOLIO_COLORS[portfolio.id] }} />
                        <span>{portfolio.name}<small>{statusText(portfolio, mode, selectedPortfolioId)}</small></span>
                      </button>
                    </th>
                    <td>
                      {money(portfolio.capital)}
                      <small>{STRATEGY_NAMES[portfolio.strategy]} · {portfolio.draft.presets[portfolio.strategy]}</small>
                    </td>
                    {definitionGroups.differences.length > 0 && (
                      <td className="comparison-summary-difference">{differenceText || "与其他组相同"}</td>
                    )}
                    <td>{isShown && analysis.hasAnalyzablePeriod ? signedPercent(analysis.cumulativeReturn) : isShown ? "— · 暂无可分析区间" : "— · 当前未显示"}</td>
                    <td>{isShown && analysis.maxDrawdown !== null ? drawdownPercent(analysis.maxDrawdown) : isShown ? "— · 暂无可分析区间" : "— · 当前未显示"}</td>
                    <td>{isShown ? money(analysis.totalAssets) : "— · 当前未显示"}</td>
                    <td>{isShown && analysis.hasAnalyzablePeriod ? analysis.rebalanceCount : isShown ? "— · 暂无可分析区间" : "— · 当前未显示"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {portfolios.length > 3 && <p className="comparison-scroll-hint">列表已限制高度，可在表格内滚动查看其余组合；所有组合均保留在这里。</p>}
      </section>

      <section className="comparison-chart-panel" aria-label="组合表现图表">
        <div className="comparison-chart-toolbar">
          <div className="comparison-chart-heading">
            <div><span className="comparison-section-kicker">当前可见账本 · {chartDate}</span><h2>结果走势</h2></div>
          </div>
          <div className="comparison-chart-tabs" role="tablist" aria-label="图表类型">
            {([
              ["net-value", "净值"],
              ["drawdown", "回撤"],
              ["allocation", "仓位"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={chartMode === value}
                className={chartMode === value ? "comparison-chart-tab is-active" : "comparison-chart-tab"}
                key={value}
                onClick={() => setChartMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {chartMode === "allocation" ? (
          <label className="comparison-allocation-choice">
            <span>选择一个组合查看仓位</span>
            <select
              value={allocationPortfolio?.id ?? ""}
              onChange={event => setAllocationPortfolioId(event.currentTarget.value as PortfolioId)}
              disabled={mode === "single"}
              aria-label="仓位图所选组合"
            >
              {portfolios.map(portfolio => <option value={portfolio.id} key={portfolio.id}>{portfolio.name}</option>)}
            </select>
            <span className="comparison-allocation-selected">当前仅显示：{allocationPortfolio?.name ?? "无可用组合"}</span>
          </label>
        ) : (
          <div className="comparison-legend-controls" role="group" aria-label="组合曲线选择" tabIndex={0}>
            {portfolios.map(portfolio => {
              const pressed = mode === "single" ? portfolio.id === selectedPortfolioId : visibleSeriesIds.includes(portfolio.id);
              return (
                <button
                  type="button"
                  key={portfolio.id}
                  className="comparison-series-toggle"
                  aria-pressed={pressed}
                  onClick={() => toggleSeries(portfolio.id)}
                  title={mode === "single" && portfolio.id !== selectedPortfolioId
                    ? "切换为此单组合结果"
                    : "切换曲线：" + portfolio.name}
                >
                  <i style={{ backgroundColor: PORTFOLIO_COLORS[portfolio.id] }} />
                  <b style={{
                    borderColor: PORTFOLIO_COLORS[portfolio.id],
                    borderTopStyle: PORTFOLIO_DASHES[portfolio.id] ? "dashed" : "solid",
                  }} />
                  <span>{portfolio.name}</span>
                  {portfolio.status !== "active" && <small>{portfolio.status === "failed" ? "失败" : "已排除"}</small>}
                </button>
              );
            })}
          </div>
        )}
        <ComparisonChart series={plotSeries} mode={chartMode} currentDate={chartDate} empty={chartEmpty} />
        {legendLimitMessage && <p className="comparison-legend-limit" role="status">{legendLimitMessage}</p>}
        <label className="comparison-range-control">
          <span>{mode === "single" ? "当前组合结果截止 R" : "共同结果截止 R"} <b>{currentDate}</b></span>
          <input
            type="range"
            min={T0_CURSOR}
            max={Math.max(T0_CURSOR, effectiveMax)}
            step={1}
            value={Math.max(T0_CURSOR, Math.min(cursor, effectiveMax))}
            disabled={effectiveMax <= T0_CURSOR}
            onChange={event => onCursorChange(Number(event.currentTarget.value))}
            aria-label={mode === "single" ? "单组合结果截止日" : "共同结果截止日"}
          />
        </label>
      </section>

      <details className="comparison-full-ledger" key={"ledger-" + entryId}>
        <summary>完整账本指标与数据质量 · 展开查看所有组合</summary>
        <div className="comparison-full-ledger-scroll" role="region" aria-label="完整账本指标，可横向滚动" tabIndex={0}>
          <table>
            <thead>
              <tr><th scope="col">指标</th>{portfolios.map(portfolio => <th scope="col" key={portfolio.id}>{portfolio.name}</th>)}</tr>
            </thead>
            <tbody>
              {[
                ["累计收益", (analysis: ResultAnalysis) => signedPercent(analysis.cumulativeReturn)],
                ["最大回撤", (analysis: ResultAnalysis) => drawdownPercent(analysis.maxDrawdown)],
                ["期末总资产", (analysis: ResultAnalysis) => money(analysis.totalAssets)],
                ["现金余额", (analysis: ResultAnalysis) => money(analysis.cashBalance)],
                ["现金占比", (analysis: ResultAnalysis) => cashPercentage(analysis.cashWeight)],
                ["现金损益", (analysis: ResultAnalysis) => signedMoney(analysis.cashPnl)],
                ["已平仓回合", (analysis: ResultAnalysis) => countText(analysis.closedRoundCount)],
                ["已平仓胜回合", (analysis: ResultAnalysis) => countText(analysis.closedRoundWins, "无已平仓交易")],
                ["已平仓胜率", (analysis: ResultAnalysis) => closedRoundWinRate(analysis)],
                ["已平仓净损益", (analysis: ResultAnalysis) => signedMoney(analysis.closedRoundNetPnl)],
                ["部分减仓已实现损益", (analysis: ResultAnalysis) => analysis.partialReductionRealized === null ? "— · 无部分减仓" : signedMoney(analysis.partialReductionRealized)],
                ["未平仓浮动损益", (analysis: ResultAnalysis) => signedMoney(analysis.openUnrealizedPnl)],
                ["总损益", (analysis: ResultAnalysis) => signedMoney(analysis.totalPnl)],
                ["成交额 / 初始本金", (analysis: ResultAnalysis) => percentage(analysis.turnoverOnInitialCapital)],
                ["成交额", (analysis: ResultAnalysis) => money(analysis.turnoverNotional)],
                ["交易笔数", (analysis: ResultAnalysis) => countText(analysis.tradeCount)],
                ["首次建仓执行", (analysis: ResultAnalysis) => countText(analysis.initialExecutionCount)],
                ["再平衡次数", (analysis: ResultAnalysis) => countText(analysis.rebalanceCount)],
                ["部分成交事件", (analysis: ResultAnalysis) => countText(analysis.partialExecutionCount)],
                ["未成交事件", (analysis: ResultAnalysis) => countText(analysis.unfilledExecutionCount)],
                ["账本对账差额", (analysis: ResultAnalysis) => signedMoney(analysis.reconciliationDifference)],
                ["账本核对", (analysis: ResultAnalysis) => analysis.reconcilesToLedger && analysis.accountingConsistent ? "一致" : "存在差额或数据不完整"],
              ].map(([label, format]) => (
                <tr key={label as string}>
                  <th scope="row">{label as string}</th>
                  {portfolios.map(portfolio => {
                    const analysis = analyses.get(portfolio.id)!;
                    return <td key={portfolio.id}>{shownMetrics(portfolio) ? (format as (value: ResultAnalysis) => string)(analysis) : "— · 当前未显示"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="comparison-quality-grid">
          {portfolios.map(portfolio => (
            <article key={portfolio.id}>
              <h3>{portfolio.name} · {statusText(portfolio, mode, selectedPortfolioId)}</h3>
              <p>{dataQualityText(portfolio)}</p>
            </article>
          ))}
        </div>
        <p className="comparison-accounting-note">
          损益依据当前 R 可见账本计算；已平仓胜率只使用已完成回合。合成演示设定现金收益、费用与滑点为 ¥0.00。
          未提供可信基准，因此不计算超额收益。
        </p>
      </details>

      <section className="comparison-events" aria-label="当前结果截止前的事件">
        <div className="comparison-section-heading">
          <div><span>仅显示当前 R 可见事件</span><h2>执行事件</h2></div>
          <span>{filteredEvents.length} 条</span>
        </div>
        <div className="comparison-event-filters">
          <label>
            <span>组合</span>
            <select
              value={mode === "single" ? selectedPortfolioId : portfolioFilter}
              onChange={event => setPortfolioFilter(event.currentTarget.value as PortfolioFilter)}
              disabled={mode === "single"}
              aria-label="按组合筛选事件"
            >
              {mode === "synchronized" && <option value="all">全部组合</option>}
              {(mode === "single" ? portfolios.filter(item => item.id === selectedPortfolioId) : portfolios)
                .map(portfolio => <option value={portfolio.id} key={portfolio.id}>{portfolio.name}</option>)}
            </select>
          </label>
          <label>
            <span>执行类型</span>
            <select
              value={executionFilter}
              onChange={event => setExecutionFilter(event.currentTarget.value as ExecutionFilter)}
              aria-label="按执行类型筛选事件"
            >
              <option value="all">全部类型</option>
              <option value="filled">已执行</option>
              <option value="partial">部分成交</option>
              <option value="unfilled">未成交</option>
            </select>
          </label>
        </div>
        {filteredEvents.length > 0 ? (
          <ul className="comparison-event-list">
            {filteredEvents.map(({ portfolio, event }) => {
              const symbol = event.trades[0]?.symbol ?? event.plannedTrades?.[0]?.symbol;
              const symbols = [...new Set([
                ...(event.trades ?? []).map(trade => trade.symbol),
                ...(event.plannedTrades ?? []).map(trade => trade.symbol),
              ])].join("、");
              return (
                <li key={portfolio.id + "-" + event.cursor}>
                  <button
                    type="button"
                    className="comparison-event-button"
                    onClick={() => onEvent(portfolio.id, event, symbol)}
                  >
                    <span>{event.date} · {portfolio.name} · {executionText(event)}</span>
                    <b>{event.reason}{symbols ? " · " + symbols : ""}</b>
                    {event.executionNote && <small>{event.executionNote}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="comparison-empty-events">
            {mode === "single" && portfolios.find(item => item.id === selectedPortfolioId)?.status !== "active"
              ? "此组合仅保留最后完整日之前的事件；当前筛选下没有可进入的事件。"
              : "当前 R 与所选筛选条件下没有可见事件。"}
          </p>
        )}
      </section>

      {mode === "synchronized" && portfolios.some(item => item.maxCursor > commonMaxCursor) && (
        <section className="comparison-single-actions" aria-label="较晚的单组合结果">
          <span>查看较晚的单组合区间</span>
          {portfolios.filter(item => item.maxCursor > commonMaxCursor).map(portfolio => (
            <button
              type="button"
              key={portfolio.id}
              className="comparison-secondary"
              onClick={() => onRevealSingle(portfolio.id)}
            >
              查看 {portfolio.name} · {portfolioDate(portfolio, portfolio.maxCursor)}
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
