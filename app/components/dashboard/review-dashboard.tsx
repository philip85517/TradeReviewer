"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { buildTradingRoomMetrics } from "../../lib/reviews/trading-room-metrics";
import {
  buildTradingRoomQuality,
  type TradingRoomQualityBuildOptions,
  type TradingRoomQualityDimensionId,
  type TradingRoomQualityModel,
} from "../../lib/reviews/trading-room-quality";
import {
  buildPrincipalReferenceSummary,
  type PrincipalScope,
} from "../../lib/principal/principal-model";
import { usePrincipalSettings } from "../../lib/principal/use-principal-settings";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { PositionLedgerSnapshot } from "../../lib/replay/position-ledger";
import {
  RoomHoldingsPanel,
} from "./room-holdings";
import { RoomPerformance } from "./room-performance";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { buildTradingRoomHoldings } from "../../lib/reviews/trading-room-holdings";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import {
  buildRoomDateRange,
  buildTradingRoomModel,
  createDefaultRoomScope,
  type RoomAssetCategory,
  type RoomAssetTypeFilter,
  type RoomFxSnapshot,
  type RoomPeriodPreset,
  type RoomReviewStatus,
  type RoomScope,
  type RoomTradeNature,
  type TradingRoomMetadataInput,
} from "../../lib/reviews/trading-room-scope";
import styles from "./review-dashboard.module.css";

export type ReviewDashboardProps = {
  entries: TradeLibraryEntry[];
  onOpenInReview: (
    instrumentId: string,
    episodeId: string,
    queueIds?: string[],
  ) => void;
  /** Optional setting loaded from SQLite; teal-red is the safe default. */
  colorScheme?: ChartSettings["colorScheme"];
  /** Cached metadata keyed by the original Instrument.id; used only for room classification. */
  instrumentMetadata?: TradingRoomMetadataInput;
  /** A single display snapshot supplied by the future FX module. */
  fxSnapshot?: RoomFxSnapshot;
  /** Optional current quote projection supplied by the market data/navigation layer. */
  holdingsQuotesByInstrument?: Readonly<Record<string, TradingRoomQuote | undefined>>;
  holdingsCandlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  positionSnapshotsByEpisode?: Readonly<Record<string, PositionLedgerSnapshot | undefined>>;
  holdingsAsOf?: string;
  holdingsStaleAfterDays?: number;
  /** Enable the persisted principal settings adapter in the real workspace. */
  principalEnabled?: boolean;
  /** Optional workspace projections used by the four-dimension data-quality summary. */
  qualityInput?: Omit<TradingRoomQualityBuildOptions, "scope" | "rows">;
  onOpenDataManagement?: (model: TradingRoomQualityModel) => void;
  onRetryDataQuality?: (
    dimension: TradingRoomQualityDimensionId,
    instrumentIds: readonly string[],
  ) => void | Promise<void>;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
  onQualityModelChange?: (model: TradingRoomQualityModel) => void;
};

type FilterSelectProps = {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

function FilterSelect({ label, ariaLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function currencyCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "USD";
}

function money(value: string | null, currency: string | null | undefined): string {
  if (value === null) return "不可用";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: currencyCode(currency),
      maximumFractionDigits: 2,
      signDisplay: "always",
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

function signedClass(value: string | null): string {
  if (value === null) return styles.neutral;
  return Number(value) > 0 ? styles.positive : Number(value) < 0 ? styles.negative : styles.neutral;
}

function allEntryExecutions(entry: TradeLibraryEntry) {
  return [
    ...entry.executions,
    ...entry.episodes.flatMap(item => item.episode.executions),
  ];
}

type DashboardFilterOption = { value: string; label: string };

function disambiguateFilterOptionLabels(options: DashboardFilterOption[]): DashboardFilterOption[] {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return options.map(option => {
    const count = counts.get(option.label) ?? 0;
    if (count < 2) return option;
    const ordinal = (seen.get(option.label) ?? 0) + 1;
    seen.set(option.label, ordinal);
    return { ...option, label: `${option.label} · ${ordinal}` };
  });
}

function accountFilterOptions(entries: TradeLibraryEntry[]) {
  const values = new Map<string, string>();
  for (const entry of entries) {
    for (const execution of allEntryExecutions(entry)) {
      if (!values.has(execution.accountId)) values.set(execution.accountId, execution.accountLabel.trim());
    }
  }
  const labels = new Map<string, number>();
  for (const label of values.values()) labels.set(label, (labels.get(label) ?? 0) + 1);
  return disambiguateFilterOptionLabels([...values.entries()]
    .sort((left, right) => left[1].localeCompare(right[1], "zh-CN") || left[0].localeCompare(right[0]))
    .map(([value, label]) => ({ value, label: label || value })));
}

function roomMarketValue(value: string): string {
  const market = value.trim().toUpperCase();
  if (["CN", "CN-SH", "SH", "SSE"].includes(market)) return "CN-SH";
  if (["CN-SZ", "SZ", "SZSE"].includes(market)) return "CN-SZ";
  return market;
}

function roomMarketLabel(value: string): string {
  switch (value) {
    case "CN-SH": return "A股·沪市";
    case "CN-SZ": return "A股·深市";
    case "US": return "美股";
    case "HK": return "港股";
    default: return value;
  }
}

function marketFilterOptions(entries: TradeLibraryEntry[]) {
  const values = new Set<string>();
  for (const entry of entries) {
    values.add(roomMarketValue(entry.instrument.market));
    for (const item of entry.episodes) values.add(roomMarketValue(item.episode.instrument.market));
  }
  return [...values]
    .filter(Boolean)
    .sort()
    .map(value => ({ value, label: roomMarketLabel(value) }));
}

function simulationFilterOptions(entries: TradeLibraryEntry[]) {
  const values = new Map<string, Set<string>>();
  for (const entry of entries) {
    const instruments = [entry.instrument, ...entry.episodes.map(item => item.episode.instrument)];
    const labels = new Set(instruments.map(instrument => `${instrument.name}（${instrument.symbol}）`));
    const runIds = [
      entry.simulationRunId,
      ...entry.episodes.map(item => item.episode.simulationRunId),
      ...allEntryExecutions(entry).map(execution => execution.source.simulationRunId),
    ].filter((value): value is string => Boolean(value));
    for (const runId of runIds) {
      const subjects = values.get(runId) ?? new Set<string>();
      for (const label of labels) subjects.add(label);
      values.set(runId, subjects);
    }
  }
  return disambiguateFilterOptionLabels([...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, instruments]) => ({
      value,
      label: `${[...instruments].sort((left, right) => left.localeCompare(right, "zh-CN")).slice(0, 2).join("、")} · 模拟运行`,
    })));
}

type MetricCardOptions = {
  disclosureDetail?: string;
  disclosureLabel?: string;
};

function metricCard(label: string, value: string, detail: string, className?: string, options?: MetricCardOptions) {
  return <div className={styles.metricCard}>
    <span>{label}</span>
    <strong className={className}>{value}</strong>
    <small title={detail} aria-label={detail}>{detail}</small>
    {options?.disclosureDetail && <details className={styles.metricDetails}>
      <summary>{options.disclosureLabel ?? "查看详情"}</summary>
      <div>{options.disclosureDetail}</div>
    </details>}
  </div>;
}

function roomCategoryLabel(value: RoomAssetCategory): string {
  switch (value) {
    case "all": return "全部市场";
    case "a-share-stock": return "A股";
    case "us-stock": return "美股";
    case "hk-stock": return "港股";
    case "etf": return "ETF";
    case "unknown": return "未知资产类型";
  }
}

function roomNatureLabel(value: RoomTradeNature): string {
  switch (value) {
    case "live": return "实盘";
    case "simulation": return "模拟盘";
    case "unknown": return "来源未知";
  }
}

function roomMoneyLabel(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"]): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return "暂无样本";
  if (view.convertedCny !== null) return money(view.convertedCny, "CNY");
  if (values.length > 1) return "无法合计";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function roomMoneyDetail(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"]): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? "数据不足" : "暂无样本";
  const original = values.length > 0
    ? `原币小计：${values.map(([currency, value]) => money(value, currency)).join(" · ")}`
    : null;
  if (view.conversion === "same-currency" && values.length === 1 && values[0][0] === "CNY") return view.note;
  if (original) return `${original}；${view.note}`;
  if (view.note.includes("金额缺失") || view.note.includes("无效")) return `${view.note}；缺失部分未计入`;
  return `${view.note}；人民币估算待汇率补齐`;
}

function roomMoneySummary(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"]): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? "数据不足" : "暂无样本";
  if (view.conversion === "same-currency") return `${values[0][0]} 原币`;
  if (view.convertedCny !== null) return "已按汇率快照换算";
  if (values.length > 1) return "多币种无法合计";
  return `${values[0][0]} 原币`;
}

function percentLabel(value: string | null): string {
  if (value === null) return "数据不足";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "数据不足";
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numericValue)}%`;
}

function trendColors(colorScheme: ChartSettings["colorScheme"]) {
  if (colorScheme === "green-red") return { positive: "#22c55e", negative: "#ef4444" };
  if (colorScheme === "blue-orange") return { positive: "#3b82f6", negative: "#f97316" };
  return { positive: "#26a69a", negative: "#ef5350" };
}

export function ReviewDashboard({
  entries,
  onOpenInReview,
  colorScheme,
  instrumentMetadata,
  fxSnapshot,
  holdingsQuotesByInstrument,
  holdingsCandlesByInstrument,
  positionSnapshotsByEpisode,
  holdingsAsOf,
  holdingsStaleAfterDays,
  principalEnabled = false,
  qualityInput,
  onOpenDataManagement,
  onRetryDataQuality,
  onOpenDataCheck,
  onQualityModelChange,
}: ReviewDashboardProps) {
  const [roomScope, setRoomScope] = useState<RoomScope>(() => createDefaultRoomScope());
  const [roomCustomStartDate, setRoomCustomStartDate] = useState(() => createDefaultRoomScope().period.startDate);
  const [roomCustomEndDate, setRoomCustomEndDate] = useState(() => createDefaultRoomScope().period.endDate);
  const [roomCustomPeriodOpen, setRoomCustomPeriodOpen] = useState(false);
  const [roomPeriodError, setRoomPeriodError] = useState<string | null>(null);

  const dashboardStyle = useMemo<CSSProperties>(() => {
    const colors = trendColors(colorScheme ?? "teal-red");
    return {
      "--dashboard-positive": colors.positive,
      "--dashboard-negative": colors.negative,
    } as CSSProperties;
  }, [colorScheme]);
  const roomModel = useMemo(
    () => buildTradingRoomModel(entries, { scope: roomScope, instrumentMetadata, fxSnapshot }),
    [entries, fxSnapshot, instrumentMetadata, roomScope],
  );
  const roomMetrics = useMemo(
    () => buildTradingRoomMetrics(roomModel.rows, { period: roomScope.period, fxSnapshot }),
    [fxSnapshot, roomModel.rows, roomScope.period],
  );
  const principalScope = useMemo<PrincipalScope>(
    () => ({ nature: roomScope.nature, simulationRunId: roomScope.simulationRunId }),
    [roomScope.nature, roomScope.simulationRunId],
  );
  const principalSettings = usePrincipalSettings({ scope: principalScope, enabled: principalEnabled });
  const principalSummary = useMemo(
    () => buildPrincipalReferenceSummary(roomModel.rows, roomScope, principalSettings.state, fxSnapshot),
    [fxSnapshot, principalSettings.state, roomModel.rows, roomScope],
  );
  const roomHoldingsModel = useMemo(
    () => buildTradingRoomHoldings(entries, {
      scope: roomScope,
      instrumentMetadata,
      quotesByInstrument: holdingsQuotesByInstrument,
      candlesByInstrument: holdingsCandlesByInstrument,
      marketDataStatuses: qualityInput?.marketDataStatuses,
      marketDataDailyStatuses: qualityInput?.marketDataDailyStatuses,
      marketDataLabels: qualityInput?.marketDataLabels,
      marketDataJobs: qualityInput?.marketDataJobs,
      positionSnapshotsByEpisode,
      asOf: holdingsAsOf,
      staleAfterDays: holdingsStaleAfterDays,
    }),
    [
      entries,
      holdingsAsOf,
      holdingsCandlesByInstrument,
      holdingsQuotesByInstrument,
      holdingsStaleAfterDays,
      instrumentMetadata,
      qualityInput?.marketDataDailyStatuses,
      qualityInput?.marketDataJobs,
      qualityInput?.marketDataLabels,
      qualityInput?.marketDataStatuses,
      positionSnapshotsByEpisode,
      roomScope,
    ],
  );
  const roomDataQuality = useMemo(
    () => qualityInput
      ? buildTradingRoomQuality({
        ...qualityInput,
        scope: roomScope,
        rows: roomModel.rows,
        holdings: roomHoldingsModel,
        fxSnapshot: qualityInput.fxSnapshot ?? fxSnapshot,
      })
      : null,
    [fxSnapshot, qualityInput, roomHoldingsModel, roomModel.rows, roomScope],
  );
  useEffect(() => {
    if (roomDataQuality) onQualityModelChange?.(roomDataQuality);
  }, [onQualityModelChange, roomDataQuality]);
  const roomMarkets = roomScope.markets ?? [];
  const roomRows = useMemo(() => roomModel.rows.map(value => value.row), [roomModel.rows]);
  const accountOptions = useMemo(() => accountFilterOptions(entries), [entries]);
  const currencyOptions = useMemo(() => [...new Set(entries.map(entry => entry.instrument.currency.trim().toUpperCase()).filter(Boolean))]
    .sort()
    .map(value => ({ value, label: value })), [entries]);
  const marketOptions = useMemo(() => marketFilterOptions(entries), [entries]);
  const simulationRunOptions = useMemo(() => simulationFilterOptions(entries), [entries]);
  const roomFilterCount = [
    roomScope.query,
    roomScope.accountIds.length,
    roomScope.instrumentIds.length,
    roomScope.assetType && roomScope.assetType !== "all",
    roomMarkets.length,
    roomScope.currencies.length,
    roomScope.reviewStatuses.length,
    roomScope.nature === "simulation" && roomScope.simulationRunId,
  ].filter(Boolean).length;
  const roomScopeIsNarrowed = roomScope.nature !== "live"
    || roomScope.assetCategory !== "all"
    || (roomScope.assetType ?? "all") !== "all"
    || roomScope.period.preset !== "month"
    || roomFilterCount > 0;
  const updateRoomScope = (patch: Partial<RoomScope>) => {
    setRoomScope(current => ({ ...current, ...patch }));
    setRoomCustomPeriodOpen(false);
    setRoomPeriodError(null);
    if (patch.period) {
      setRoomCustomStartDate(patch.period.startDate);
      setRoomCustomEndDate(patch.period.endDate);
    }
  };
  const updateRoomPeriod = (preset: RoomPeriodPreset) => {
    if (preset === "custom") {
      setRoomCustomStartDate(roomScope.period.startDate);
      setRoomCustomEndDate(roomScope.period.endDate);
      setRoomPeriodError(null);
      setRoomCustomPeriodOpen(true);
      return;
    }
    updateRoomScope({ period: buildRoomDateRange(preset) });
  };
  const applyRoomCustomPeriod = () => {
    try {
      const period = buildRoomDateRange("custom", roomCustomEndDate, roomCustomStartDate, roomCustomEndDate);
      setRoomPeriodError(null);
      updateRoomScope({ period });
    } catch {
      setRoomPeriodError("自定义期间起止日期无效");
    }
  };
  const clearRoomFilters = () => {
    setRoomScope(current => ({
      ...current,
      query: undefined,
      accountIds: [],
      instrumentIds: [],
      assetType: "all",
      markets: [],
      currencies: [],
      reviewStatuses: [],
    }));
    setRoomPeriodError(null);
    setRoomCustomPeriodOpen(false);
  };
  const emptyRoomMessage = entries.length === 0
    ? "导入交易后查看统计总览；已有交易数据会按来源平仓日显示。"
    : roomRows.length === 0
      ? roomScopeIsNarrowed
        ? "当前交易室范围没有回合。调整期间、分类或高级筛选后重试。"
        : "当前交易室范围暂无已平仓回合。"
      : null;

  return (
    <section className={styles.dashboard} style={dashboardStyle} aria-label="统计总览">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Trading room</span>
          <h1>我的交易室</h1>
          <p>统一范围查看已平仓回合净盈亏、样本质量和后续复盘入口。</p>
        </div>
        <div className={styles.headerMeta}>
          <strong>{entries.length} 个标的</strong>
          <span>{roomRows.length} 个回合入选</span>
        </div>
      </header>

      <section className={styles.roomScopeSection} aria-label="交易室范围">
        <div className={styles.roomScopeHeading}>
          <div>
            <span className={styles.eyebrow}>Performance scope</span>
            <h2>收益概览</h2>
            <p>{roomNatureLabel(roomScope.nature)} · {roomCategoryLabel(roomScope.assetCategory)} · {roomScope.period.startDate} 至 {roomScope.period.endDate}</p>
          </div>
          <div className={styles.roomScopeBadgeGroup}>
            <div className={styles.scopeViewControl} role="group" aria-label="交易室视图">
              {(["live", "simulation"] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  className={styles.segmentedButton}
                  aria-pressed={roomScope.nature === value}
                  onClick={() => updateRoomScope({ nature: value })}
                >
                  {value === "live" ? "实盘" : "模拟盘"}
                </button>
              ))}
              <button
                type="button"
                className={styles.segmentedButton}
                aria-controls="trading-room-holdings"
                onClick={() => {
                  const target = document.getElementById("trading-room-holdings");
                  if (target && typeof target.scrollIntoView === "function") target.scrollIntoView({ behavior: "smooth", block: "start" });
                  target?.focus({ preventScroll: true });
                }}
              >
                当前持仓
              </button>
            </div>
            <span className={styles.roomScopeBadge}>{roomRows.length} 个回合进入范围</span>
          </div>
        </div>
        <div className={styles.roomScopeControls}>
          <FilterSelect label="市场分类" ariaLabel="交易室市场分类筛选" value={roomScope.assetCategory} options={[{ value: "all", label: "全部市场" }, { value: "a-share-stock", label: "A股" }, { value: "us-stock", label: "美股" }, { value: "hk-stock", label: "港股" }]} onChange={value => updateRoomScope({ assetCategory: value as RoomAssetCategory, markets: [] })} />
          <div className={styles.roomPeriodControl}>
            <span>统计期间</span>
            <div className={styles.periodTabs} role="tablist" aria-label="交易室期间">
              {([
                ["month", "本月"],
                ["last-3-months", "近3个自然月"],
                ["ytd", "今年至今"],
              ] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  role="tab"
                  className={styles.periodTab}
                  aria-selected={roomScope.period.preset === value}
                  onClick={() => updateRoomPeriod(value as RoomPeriodPreset)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.customPeriodButton}
              aria-pressed={roomCustomPeriodOpen}
              onClick={() => updateRoomPeriod("custom")}
            >
              更多期间
            </button>
          </div>
          {roomScope.nature === "simulation" && <FilterSelect label="模拟运行" ariaLabel="交易室模拟运行筛选" value={roomScope.simulationRunId ?? ""} options={[{ value: "", label: "请选择运行" }, ...simulationRunOptions]} onChange={value => updateRoomScope({ simulationRunId: value || null })} />}
        </div>
        {roomCustomPeriodOpen && <div className={styles.roomCustomPeriodEditor} id="custom-period-editor" role="group" aria-label="自定义统计期间">
          <label className={styles.filterField}><span>自定义起始日期</span><input aria-label="交易室自定义起始日期" type="date" value={roomCustomStartDate} onChange={event => setRoomCustomStartDate(event.target.value)} /></label>
          <label className={styles.filterField}><span>自定义结束日期</span><input aria-label="交易室自定义结束日期" type="date" value={roomCustomEndDate} onChange={event => setRoomCustomEndDate(event.target.value)} /></label>
          <div className={styles.roomCustomPeriodActions}>
            <button type="button" className={styles.customPeriodApply} onClick={applyRoomCustomPeriod}>应用期间</button>
            <button type="button" className={styles.customPeriodCancel} onClick={() => { setRoomCustomPeriodOpen(false); setRoomPeriodError(null); }}>取消</button>
          </div>
        </div>}
        {roomPeriodError && <p className={styles.roomScopeWarning}>{roomPeriodError}</p>}
        <details className={styles.roomAdvancedDetails}>
          <summary>更多筛选{roomFilterCount > 0 ? ` · ${roomFilterCount} 项已启用` : ""}</summary>
          <div className={styles.roomAdvancedGrid}>
            <label className={styles.searchField}><span>标的</span><div><Search size={15} /><input aria-label="交易室标的筛选" type="search" placeholder="名称或代码" value={roomScope.query ?? ""} onChange={event => updateRoomScope({ query: event.target.value })} /></div></label>
            <FilterSelect label="账户" ariaLabel="交易室账户筛选" value={roomScope.accountIds[0] ?? "all"} options={[{ value: "all", label: "全部账户" }, ...accountOptions]} onChange={value => updateRoomScope({ accountIds: value === "all" ? [] : [value] })} />
            <FilterSelect label="资产类型" ariaLabel="交易室资产类型筛选" value={roomScope.assetType ?? "all"} options={[{ value: "all", label: "全部资产" }, { value: "stock", label: "股票" }, { value: "etf", label: "ETF" }]} onChange={value => updateRoomScope({ assetType: value as RoomAssetTypeFilter })} />
            <FilterSelect label="交易市场" ariaLabel="交易室交易市场筛选" value={roomMarkets[0] ?? "all"} options={[{ value: "all", label: "全部市场" }, ...marketOptions]} onChange={value => updateRoomScope({ markets: value === "all" ? [] : [value] })} />
            <FilterSelect label="币种" ariaLabel="交易室币种筛选" value={roomScope.currencies[0] ?? "all"} options={[{ value: "all", label: "全部币种" }, ...currencyOptions]} onChange={value => updateRoomScope({ currencies: value === "all" ? [] : [value] })} />
            <FilterSelect label="复盘状态" ariaLabel="交易室复盘状态筛选" value={roomScope.reviewStatuses[0] ?? "all"} options={[{ value: "all", label: "全部状态" }, { value: "pending", label: "待复盘" }, { value: "completed", label: "已复盘" }, { value: "deferred", label: "暂不复盘" }]} onChange={value => updateRoomScope({ reviewStatuses: value === "all" ? [] : [value as RoomReviewStatus] })} />
            {roomFilterCount > 0 && <button type="button" className={styles.roomClearButton} onClick={clearRoomFilters}>清除交易室筛选</button>}
          </div>
        </details>
        <p className={styles.roomScopeHint}>收益按交易市场归属；ETF 只作为资产类型筛选，不按 ETF 内部成分重新归因。未知资产类型保留提示，不纳入 A股 / 美股 / 港股合计。</p>
        <div className={styles.roomSummaryGrid} aria-label="交易室业绩摘要">
          {metricCard(
            "已平仓回合净盈亏",
            roomMoneyLabel(roomModel.summary.money),
            `${roomScope.period.startDate} 至 ${roomScope.period.endDate} · ${roomMoneySummary(roomModel.summary.money)}`,
            signedClass(roomModel.summary.money.convertedCny),
            {
              disclosureLabel: "查看原币与汇率详情",
              disclosureDetail: `${roomScope.period.startDate} 至 ${roomScope.period.endDate} · ${roomMoneyDetail(roomModel.summary.money)}`,
            },
          )}
          {metricCard("可信已平仓回合", String(roomModel.summary.trustedClosedCount), `${roomModel.summary.wins} 胜 · ${roomModel.summary.losses} 负 · 持平 ${roomModel.summary.breakEven}`)}
          {metricCard("合计胜率", percentLabel(roomMetrics.monthlyWinRate.ratePercent), `${roomMetrics.monthlyWinRate.wins}/${roomMetrics.monthlyWinRate.denominator} 个可信已平仓回合`)}
          {metricCard(
            principalSummary.mode === "principal" ? "本金参考收益率" : "交易成本收益率",
            principalSummary.mode === "principal"
              ? percentLabel(principalSummary.principalReturnPercent)
              : percentLabel(principalSummary.costReturn.costReturnPercent),
            principalSummary.mode === "principal"
              ? `已填本金 · ${roomMoneyLabel(principalSummary.principal)}`
              : principalSummary.fallbackReason ?? `${principalSummary.costReturn.applicableCount} 个适用回合 · ${principalSummary.costReturn.excludedCount} 个排除回合`,
              principalSummary.mode === "principal"
                ? signedClass(principalSummary.principalReturnPercent)
                : signedClass(principalSummary.costReturn.costReturnPercent),
          )}
        </div>
        {(roomModel.summary.excludedCount > 0 || roomModel.summary.unknownAssetEpisodeCount > 0) && <p className={styles.roomScopeStatus}>
          {roomModel.summary.excludedCount > 0 && `排除样本 ${roomModel.summary.excludedCount} 个`}
          {roomModel.summary.excludedCount > 0 && roomModel.summary.unknownAssetEpisodeCount > 0 && " · "}
          {roomModel.summary.unknownAssetEpisodeCount > 0 && `未知资产 ${roomModel.summary.unknownAssetEpisodeCount} 个，未纳入四类合计`}
        </p>}
        {roomScope.nature === "simulation" && !roomScope.simulationRunId && <p className={styles.roomScopeWarning}>请选择一个模拟运行后查看该运行的独立统计；不会跨运行合并。</p>}
        {roomRows.length === 0 && !(roomScope.nature === "simulation" && !roomScope.simulationRunId) && <p className={styles.emptyCalendar}>{emptyRoomMessage}</p>}
        <RoomPerformance
          entries={entries}
          scope={roomScope}
          embedded
          onScopeChange={patch => updateRoomScope(patch)}
          instrumentMetadata={instrumentMetadata}
          fxSnapshot={fxSnapshot}
          asOf={holdingsAsOf}
          onOpenInReview={onOpenInReview}
          renderMoney={view => roomMoneyLabel(view)}
        />
      </section>

      <div id="trading-room-holdings" className={styles.holdingsAnchor} tabIndex={-1}>
        <RoomHoldingsPanel
          entries={entries}
          scope={roomScope}
          instrumentMetadata={instrumentMetadata}
          quotesByInstrument={holdingsQuotesByInstrument}
          candlesByInstrument={holdingsCandlesByInstrument}
          marketDataStatuses={qualityInput?.marketDataStatuses}
          marketDataDailyStatuses={qualityInput?.marketDataDailyStatuses}
          marketDataLabels={qualityInput?.marketDataLabels}
          marketDataJobs={qualityInput?.marketDataJobs}
          positionSnapshotsByEpisode={positionSnapshotsByEpisode}
          asOf={holdingsAsOf}
          staleAfterDays={holdingsStaleAfterDays}
          onRetryQuote={instrumentId => onRetryDataQuality?.("holdings", [instrumentId])}
          onOpenDataCheck={(instrumentId, episodeId) => onOpenDataCheck?.("holdings", [instrumentId], episodeId)}
          onOpenInReview={onOpenInReview}
        />
      </div>

      {roomDataQuality && (
        <div className={styles.roomDataStatus} role="status" aria-label="数据状态">
          <span>数据状态：{roomDataQuality.summary}</span>
          {onOpenDataManagement && <button type="button" onClick={() => onOpenDataManagement(roomDataQuality)}>打开数据管理</button>}
        </div>
      )}
    </section>
  );
}
