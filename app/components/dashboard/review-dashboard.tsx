"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";

import { canonicalInstrumentId } from "../../lib/instruments/display-name";
import { marketTradingDate } from "../../lib/market/trading-date";
import { buildTradingRoomMetrics } from "../../lib/reviews/trading-room-metrics";
import { dashboardEpisodeDate, dashboardEpisodeNature } from "../../lib/reviews/dashboard";
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
import { buildReferenceReturnSummary } from "../../lib/principal/reference-capital-model";
import { useReferenceCapital } from "../../lib/principal/use-reference-capital";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { PositionLedgerSnapshot } from "../../lib/replay/position-ledger";
import {
  RoomHoldingsPanel,
} from "./room-holdings";
import { RoomPerformance, type RoomPerformanceCalendarBrowseState } from "./room-performance";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { buildCurrentPortfolio } from "../../lib/reviews/trading-room-portfolio";
import { buildHoldingsHistory } from "../../lib/reviews/trading-room-history";
import { buildRoomContribution } from "../../lib/reviews/trading-room-contribution";
import {
  buildPendingReviews,
  type HistoryLibraryNavigationRequest,
  type PendingLibraryNavigationRequest,
  type RoomPendingSourceSnapshot,
} from "../../lib/reviews/trading-room-pending";
import { statementEventAt } from "../../lib/import/statement-evidence";
import { RoomPortfolioSummary } from "./room-portfolio-summary";
import { RoomAllocation } from "./room-allocation";
import { RoomHoldingsHistory } from "./room-holdings-history";
import { RoomContribution } from "./room-contribution";
import { RoomPendingReviews } from "./room-pending-reviews";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { CashSummary } from "../../lib/cash/cash-model";
import {
  buildRoomDateRange,
  buildTradingRoomModel,
  createDefaultRoomScope,
  filterRoomRows,
  roomTodayKey,
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
import type { SharedReportCurrency, SharedScope } from "../../lib/reviews/shared-scope";
import {
  TradingRoomGlobalTools,
  type TradingRoomGlobalToolsProps,
} from "./trading-room-global-tools";
import type {
  GlobalNotification,
  GlobalSearchResult,
} from "../../lib/reviews/trading-room-global-entries";

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
  onOpenPrincipalSettings?: () => void;
  onRetryDataQuality?: (
    dimension: TradingRoomQualityDimensionId,
    instrumentIds: readonly string[],
  ) => void | Promise<void>;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
  onOpenSearchResult?: (result: GlobalSearchResult) => void;
  onOpenGlobalNotification?: (item: GlobalNotification) => void;
  onOpenAccountAndCurrency?: () => void;
  globalEntryStatus?: TradingRoomGlobalToolsProps["status"];
  /** Scope-valid cash read model for the current holdings/distribution owner. */
  cashSummary?: CashSummary | null;
  cashLoading?: boolean;
  cashError?: string | null;
  /** Navigate the current pending slice into the library while preserving homepage context. */
  onViewAllPending?: (request: PendingLibraryNavigationRequest) => void;
  /** Navigate the exact closed-history range into the library while preserving homepage context. */
  onViewHistoryLibrary?: (request: HistoryLibraryNavigationRequest) => void;
  /** Context restored after returning from the pending library view. */
  restoreBrowseContext?: RoomPendingSourceSnapshot | null;
  onQualityModelChange?: (model: TradingRoomQualityModel) => void;
  sharedScope?: SharedScope;
  onSharedScopeChange?: (patch: Partial<SharedScope>) => void;
  sharedAccountOptions?: readonly { id: string; label: string }[];
  referenceCapitalEnabled?: boolean;
  visible?: boolean;
};

function RadioGroup({
  label,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  options: DashboardFilterOption[];
  onChange: (value: string) => void;
}) {
  return <fieldset className={styles.radioField} aria-label={ariaLabel}>
    <legend>{label}</legend>
    <div className={styles.radioOptions}>
      {options.map(option => <label className={styles.radioOption} key={option.value}>
        <input type="radio" name={ariaLabel} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

function currencyCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "USD";
}

function formatDashboardDataTime(value: string | null): string {
  if (!value) return "不可用";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed).replaceAll("/", "-");
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

function validObservationDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function observationSignature(period: RoomScope["period"]): string {
  return `${period.preset}|${period.startDate}|${period.endDate}`;
}

function observationDateDraft(period: RoomScope["period"]) {
  return { ...period, baseSignature: observationSignature(period) };
}

type DashboardStateUpdate<T> = T | ((current: T) => T);

type DashboardBrowseState = {
  localRoomScope: RoomScope;
  observationPeriod: RoomScope["period"];
  observationDraft: ReturnType<typeof observationDateDraft>;
  holdingsBrowseState: { query: string; page: number };
  pendingPage: number;
  historyCalendar: RoomPerformanceCalendarBrowseState;
};

type DashboardBrowseAction =
  | { type: "restore"; context: RoomPendingSourceSnapshot }
  | { type: "room-scope"; next: DashboardStateUpdate<RoomScope> }
  | { type: "observation-period"; next: DashboardStateUpdate<RoomScope["period"]> }
  | { type: "observation-draft"; next: DashboardStateUpdate<ReturnType<typeof observationDateDraft>> }
  | { type: "holdings-browse"; next: DashboardStateUpdate<DashboardBrowseState["holdingsBrowseState"]> }
  | { type: "pending-page"; next: DashboardStateUpdate<number> }
  | { type: "history-calendar"; next: DashboardStateUpdate<RoomPerformanceCalendarBrowseState> };

function updateDashboardState<T>(current: T, next: DashboardStateUpdate<T>): T {
  return typeof next === "function" ? (next as (current: T) => T)(current) : next;
}

function createDashboardBrowseState(): DashboardBrowseState {
  const defaultScope = createDefaultRoomScope();
  return {
    localRoomScope: defaultScope,
    observationPeriod: defaultScope.period,
    observationDraft: observationDateDraft(defaultScope.period),
    holdingsBrowseState: { query: "", page: 1 },
    pendingPage: 1,
    historyCalendar: {
      displayMonth: defaultScope.period.endDate.slice(0, 7),
      selectedDate: null,
    },
  };
}

function dashboardBrowseReducer(state: DashboardBrowseState, action: DashboardBrowseAction): DashboardBrowseState {
  switch (action.type) {
    case "restore": {
      const sourceScope = action.context.roomScope;
      return {
        ...state,
        localRoomScope: sourceScope
          ? {
            ...sourceScope,
            accountIds: [...sourceScope.accountIds],
            instrumentIds: [...sourceScope.instrumentIds],
            markets: [...sourceScope.markets],
            currencies: [...sourceScope.currencies],
            reviewStatuses: [...sourceScope.reviewStatuses],
            period: action.context.historyPeriod,
          }
          : { ...state.localRoomScope, period: action.context.historyPeriod },
        observationPeriod: action.context.observationPeriod,
        observationDraft: observationDateDraft(action.context.observationPeriod),
        holdingsBrowseState: {
          query: action.context.holdings.query,
          page: Math.max(1, action.context.holdings.page),
        },
        pendingPage: Math.max(1, action.context.pending.page),
        historyCalendar: { ...action.context.historyCalendar },
      };
    }
    case "room-scope": return { ...state, localRoomScope: updateDashboardState(state.localRoomScope, action.next) };
    case "observation-period": return { ...state, observationPeriod: updateDashboardState(state.observationPeriod, action.next) };
    case "observation-draft": return { ...state, observationDraft: updateDashboardState(state.observationDraft, action.next) };
    case "holdings-browse": return { ...state, holdingsBrowseState: updateDashboardState(state.holdingsBrowseState, action.next) };
    case "pending-page": return { ...state, pendingPage: updateDashboardState(state.pendingPage, action.next) };
    case "history-calendar": return { ...state, historyCalendar: updateDashboardState(state.historyCalendar, action.next) };
  }
}

function entryHasNature(entry: TradeLibraryEntry, nature: "live" | "simulation"): boolean {
  return entry.episodes.some(item => dashboardEpisodeNature({ entry, item }) === nature);
}

function scopedEntriesForNature(entries: TradeLibraryEntry[], nature: "live" | "simulation"): TradeLibraryEntry[] {
  return entries.filter(entry => entryHasNature(entry, nature));
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

function roomMoneyLabel(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"], reportCurrency: SharedReportCurrency = "original"): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return "暂无样本";
  if (reportCurrency !== "original") {
    const converted = view.targetCurrency === reportCurrency ? view.converted : reportCurrency === "HKD" ? view.convertedHkd : view.convertedCny;
    return converted !== null && converted !== undefined ? money(converted, reportCurrency) : "暂不可用";
  }
  if (values.length > 1) return "无法合计";
  return values.map(([currency, value]) => money(value, currency)).join(" · ");
}

function roomMoneyDetail(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"], reportCurrency: SharedReportCurrency = "original"): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? "数据不足" : "暂无样本";
  const original = values.length > 0
    ? `原币小计：${values.map(([currency, value]) => money(value, currency)).join(" · ")}`
    : null;
  if (reportCurrency !== "original") return `${original}；${view.note}`;
  if (view.conversion === "same-currency" && values.length === 1 && values[0][0] === "CNY") return view.note;
  if (original) return `${original}；${view.note}`;
  if (view.note.includes("金额缺失") || view.note.includes("无效")) return `${view.note}；缺失部分未计入`;
  return `${view.note}；人民币估算待汇率补齐`;
}

function roomMoneySummary(view: ReturnType<typeof buildTradingRoomModel>["summary"]["money"], reportCurrency: SharedReportCurrency = "original"): string {
  const values = Object.entries(view.originalByCurrency);
  if (values.length === 0) return view.note.includes("金额缺失") ? "数据不足" : "暂无样本";
  if (reportCurrency !== "original") return view.targetCurrency === reportCurrency && view.converted !== null ? `已按汇率快照换算为${reportCurrency}` : `缺少${reportCurrency}汇率快照`;
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

function trendColors(colorScheme?: ChartSettings["colorScheme"]) {
  if (colorScheme === "green-red") return { positive: "#22c55e", negative: "#ef4444" };
  if (colorScheme === "blue-orange") return { positive: "#3b82f6", negative: "#f97316" };
  if (colorScheme === "teal-red") return { positive: "#26a69a", negative: "#ef5350" };
  return { positive: "#dc2626", negative: "#16a34a" };
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
  onRetryDataQuality,
  onOpenDataCheck,
  onOpenSearchResult,
  onOpenGlobalNotification,
  onOpenAccountAndCurrency,
  globalEntryStatus = "ready",
  cashSummary,
  cashLoading = false,
  cashError = null,
  onViewAllPending,
  onViewHistoryLibrary,
  restoreBrowseContext,
  onQualityModelChange,
  sharedScope,
  onSharedScopeChange,
  referenceCapitalEnabled = true,
  visible = true,
}: ReviewDashboardProps) {
  const [browseState, dispatchBrowse] = useReducer(dashboardBrowseReducer, undefined, createDashboardBrowseState);
  const { localRoomScope, observationPeriod, observationDraft, holdingsBrowseState, pendingPage, historyCalendar } = browseState;
  const setRoomScope = (next: DashboardStateUpdate<RoomScope>) => dispatchBrowse({ type: "room-scope", next });
  const setObservationPeriod = (next: DashboardStateUpdate<RoomScope["period"]>) => dispatchBrowse({ type: "observation-period", next });
  const setObservationDraft = (next: DashboardStateUpdate<ReturnType<typeof observationDateDraft>>) => dispatchBrowse({ type: "observation-draft", next });
  const setHoldingsBrowseState = (next: DashboardStateUpdate<DashboardBrowseState["holdingsBrowseState"]>) => dispatchBrowse({ type: "holdings-browse", next });
  const setPendingPage = (next: DashboardStateUpdate<number>) => dispatchBrowse({ type: "pending-page", next });
  const setHistoryCalendar = (next: DashboardStateUpdate<RoomPerformanceCalendarBrowseState>) => dispatchBrowse({ type: "history-calendar", next });
  const [observationError, setObservationError] = useState<string | null>(null);
  const [localReportCurrency, setLocalReportCurrency] = useState<SharedReportCurrency>("original");
  const initialRoomPeriod = createDefaultRoomScope().period;
  const [roomDateDraft, setRoomDateDraft] = useState(() => ({
    startDate: initialRoomPeriod.startDate,
    endDate: initialRoomPeriod.endDate,
    baseSignature: `${initialRoomPeriod.preset}|${initialRoomPeriod.startDate}|${initialRoomPeriod.endDate}`,
  }));
  const [roomPeriodError, setRoomPeriodError] = useState<string | null>(null);
  const [roomFiltersOpen, setRoomFiltersOpen] = useState(false);
  useEffect(() => {
    if (!restoreBrowseContext) return;
    dispatchBrowse({ type: "restore", context: restoreBrowseContext });
  }, [restoreBrowseContext]);
  // The shell owns the cross-page scope. Derive the room scope during render so
  // a nature/account/run change cannot briefly render stale live metrics.
  const baseRoomScope = useMemo<RoomScope>(() => sharedScope
    ? {
      ...localRoomScope,
      // Unknown is never a valid dashboard nature. Fall back to live until
      // the shell can persist a valid choice, keeping the page deterministic.
      nature: sharedScope.nature === "simulation" ? "simulation" : "live",
      accountIds: [...sharedScope.accountIds].filter(id => accountFilterOptions(scopedEntriesForNature(entries, sharedScope.nature === "simulation" ? "simulation" : "live")).some(option => option.value === id)),
      simulationRunId: sharedScope.nature === "simulation"
        && simulationFilterOptions(scopedEntriesForNature(entries, "simulation")).some(option => option.value === sharedScope.simulationRunId)
        ? sharedScope.simulationRunId
        : null,
    }
    : localRoomScope, [entries, localRoomScope, sharedScope]);
  const reportCurrency = sharedScope?.reportCurrency ?? localReportCurrency;
  const targetCurrency = reportCurrency === "original" ? undefined : reportCurrency;
  const displayFxSnapshot = reportCurrency === "original" ? undefined : fxSnapshot;
  const usableFxSnapshot = displayFxSnapshot?.status === "complete" && Object.keys(displayFxSnapshot.rates).length > 0
    ? displayFxSnapshot
    : undefined;

  const dashboardStyle = useMemo<CSSProperties>(() => {
    const colors = trendColors(colorScheme);
    return {
      "--dashboard-positive": colors.positive,
      "--dashboard-negative": colors.negative,
    } as CSSProperties;
  }, [colorScheme]);
  const roomHistoryModel = useMemo(() => {
    const today = buildRoomDateRange("month").endDate;
    return buildTradingRoomModel(entries, {
      scope: { ...baseRoomScope, period: buildRoomDateRange("custom", today, "1900-01-01", today) },
      instrumentMetadata,
      fxSnapshot: usableFxSnapshot,
      targetCurrency,
    });
  }, [entries, instrumentMetadata, baseRoomScope, targetCurrency, usableFxSnapshot]);
  const roomHistoryDates = useMemo(() => roomHistoryModel.rows
    .map(value => dashboardEpisodeDate(value.row))
    .filter(value => value <= roomHistoryModel.scope.period.endDate)
    .sort(), [roomHistoryModel.rows, roomHistoryModel.scope.period.endDate]);
  const roomScope = useMemo(() => {
    if (baseRoomScope.period.preset !== "all") return baseRoomScope;
    const earliest = roomHistoryDates[0];
    const latest = roomHistoryDates.at(-1);
    if (!earliest || !latest) return baseRoomScope;
    return { ...baseRoomScope, period: buildRoomDateRange("all", roomHistoryModel.scope.period.endDate, { startDate: earliest, endDate: latest }) };
  }, [baseRoomScope, roomHistoryDates, roomHistoryModel.scope.period.endDate]);
  const roomPeriodSignature = `${roomScope.period.preset}|${roomScope.period.startDate}|${roomScope.period.endDate}`;
  const effectiveRoomDateDraft = roomDateDraft.baseSignature === roomPeriodSignature
    ? roomDateDraft
    : { startDate: roomScope.period.startDate, endDate: roomScope.period.endDate, baseSignature: roomPeriodSignature };
  const roomCustomStartDate = effectiveRoomDateDraft.startDate;
  const roomCustomEndDate = effectiveRoomDateDraft.endDate;
  const roomModel = useMemo(
    () => buildTradingRoomModel(entries, { scope: roomScope, instrumentMetadata, fxSnapshot: usableFxSnapshot, targetCurrency }),
    [entries, instrumentMetadata, roomScope, targetCurrency, usableFxSnapshot],
  );
  const roomMetrics = useMemo(
    () => buildTradingRoomMetrics(roomModel.rows, { period: roomScope.period, fxSnapshot: usableFxSnapshot, targetCurrency }),
    [roomModel.rows, roomScope.period, targetCurrency, usableFxSnapshot],
  );
  const principalScope = useMemo<PrincipalScope>(
    () => ({ nature: roomScope.nature, simulationRunId: roomScope.simulationRunId }),
    [roomScope.nature, roomScope.simulationRunId],
  );
  const principalSettings = usePrincipalSettings({ scope: principalScope, enabled: principalEnabled });
  const principalSummary = useMemo(
    () => buildPrincipalReferenceSummary(roomModel.rows, roomScope, principalSettings.state, usableFxSnapshot, targetCurrency),
    [principalSettings.state, roomModel.rows, roomScope, targetCurrency, usableFxSnapshot],
  );
  const referenceCapital = useReferenceCapital({ enabled: referenceCapitalEnabled });
  const { refresh: refreshReferenceCapital } = referenceCapital;
  useEffect(() => {
    if (visible && referenceCapitalEnabled) void refreshReferenceCapital();
  }, [refreshReferenceCapital, referenceCapitalEnabled, visible]);
  const referenceReturnSummary = useMemo(() => {
    const pairs = [...new Map(roomModel.rows.map(({ row: value }) => {
      const currency = value.item.episode.instrument.currency.trim().toUpperCase();
      return [`${value.item.episode.accountId}:${currency}`, { accountId: value.item.episode.accountId, currency }];
    })).values()];
    const trustedClosedPnl = roomModel.rows
      .filter(value => value.trustedPnl !== null && value.row.item.episode.status === "closed")
      .map(value => ({
        accountId: value.row.item.episode.accountId,
        currency: value.row.item.episode.instrument.currency.trim().toUpperCase(),
        amount: value.trustedPnl!,
      }));
    if (roomScope.nature === "unknown") return { status: "missing" as const, returnPercent: null, netPnlByPair: {}, capitalByPair: {}, reason: "性质未知，不能并入实盘或模拟盘参考资本" };
    return buildReferenceReturnSummary(referenceCapital.state, {
      nature: roomScope.nature === "simulation" ? "simulation" : "live",
      simulationRunId: roomScope.nature === "simulation" ? roomScope.simulationRunId : null,
      pairs,
      fromDate: roomScope.period.startDate,
      toDate: roomScope.period.endDate,
      trustedClosedPnl,
      fxRatesToCny: reportCurrency === "CNY" ? usableFxSnapshot?.rates : undefined,
    });
  }, [referenceCapital.state, reportCurrency, roomModel.rows, roomScope.nature, roomScope.period.endDate, roomScope.period.startDate, roomScope.simulationRunId, usableFxSnapshot]);
  const { nature, assetCategory, assetType, simulationRunId, query, accountIds, instrumentIds, markets, currencies, reviewStatuses } = roomScope;
  // The shell may reconstruct equivalent account arrays on a closed-period change.
  // Canonicalize membership by value so those renders cannot replay holdings history.
  const holdingsIdentitySignature = JSON.stringify({
    nature, assetCategory, assetType, simulationRunId, query,
    accountIds: [...accountIds].sort(), instrumentIds: [...instrumentIds].sort(),
    markets: [...markets].sort(), currencies: [...currencies].sort(), reviewStatuses: [...reviewStatuses].sort(),
  });
  const holdingsIdentity = useMemo<Omit<RoomScope, "period">>(() => JSON.parse(holdingsIdentitySignature), [holdingsIdentitySignature]);
  const allObservationPeriod = useMemo(() => {
    const today = createDefaultRoomScope().period.endDate;
    const parsedAsOf = holdingsAsOf ? new Date(holdingsAsOf) : null;
    const evidenceEnd = holdingsAsOf && validObservationDate(holdingsAsOf)
      ? holdingsAsOf
      : parsedAsOf && Number.isFinite(parsedAsOf.getTime()) ? roomTodayKey(parsedAsOf) : today;
    const visibleEnd = evidenceEnd < today ? evidenceEnd : today;
    const rows = filterRoomRows(entries, { ...holdingsIdentity, period: { preset: "all", startDate: "0001-01-01", endDate: "9999-12-31" } }, { instrumentMetadata });
    const dates: string[] = [];
    for (const { item } of rows) {
      const episode = item.episode;
      for (const execution of episode.executions) {
        let date = validObservationDate(execution.source.tradingDate) ?? validObservationDate(execution.source.marketCalendarDate);
        if (!date) {
          try { date = validObservationDate(marketTradingDate(execution.executedAt, episode.instrument.market)); } catch { /* Invalid timestamps are not range evidence. */ }
        }
        if (date && date <= visibleEnd) dates.push(date);
      }
      const positions = [episode.initialPosition, ...episode.executions.flatMap(execution => [execution.source.openingPosition, ...(execution.source.statementPositions ?? [])])];
      for (const position of positions) {
        if (!position || position.accountId !== episode.accountId
          || canonicalInstrumentId(position.symbol, position.market) !== canonicalInstrumentId(episode.instrument.symbol, episode.instrument.market)
          || !position.quantity.trim() || !Number.isFinite(Number(position.quantity))) continue;
        const date = validObservationDate(position.date);
        if (date && date <= visibleEnd) dates.push(date);
      }
      const events = [...(episode.positionEvents ?? []), ...episode.executions.flatMap(execution => execution.source.positionEvents ?? [])];
      for (const event of events) {
        if (event.accountId !== episode.accountId || !event.symbol || !event.market
          || canonicalInstrumentId(event.symbol, event.market) !== canonicalInstrumentId(episode.instrument.symbol, episode.instrument.market)) continue;
        const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(event.date);
        if (!validMonth && !validObservationDate(event.date)) continue;
        try {
          const date = validObservationDate(statementEventAt(event).slice(0, 10));
          if (date && date <= visibleEnd) dates.push(date);
        } catch { /* Invalid event dates cannot expand a historical range. */ }
      }
    }
    dates.sort();
    return buildRoomDateRange("all", today, { startDate: dates[0] ?? visibleEnd, endDate: visibleEnd });
  }, [entries, holdingsIdentity, instrumentMetadata, holdingsAsOf]);
  const effectiveObservationPeriod = observationPeriod.preset === "all" ? allObservationPeriod : observationPeriod;
  const effectiveObservationDraft = observationDraft.baseSignature === observationSignature(effectiveObservationPeriod)
    ? observationDraft : observationDateDraft(effectiveObservationPeriod);
  const holdingsScope = useMemo(() => ({ ...holdingsIdentity, period: effectiveObservationPeriod }), [holdingsIdentity, effectiveObservationPeriod]);
  const updateObservationPeriod = (preset: RoomPeriodPreset) => {
    const period = preset === "all" ? allObservationPeriod : buildRoomDateRange(preset);
    setObservationPeriod(period);
    setObservationDraft(observationDateDraft(period));
    setObservationError(null);
  };
  const applyObservationPeriod = () => {
    try {
      const today = createDefaultRoomScope().period.endDate;
      if (!effectiveObservationDraft.startDate || !effectiveObservationDraft.endDate || effectiveObservationDraft.endDate > today) throw new RangeError("Invalid observation date");
      const period = buildRoomDateRange("custom", today, effectiveObservationDraft.startDate, effectiveObservationDraft.endDate);
      setObservationPeriod(period);
      setObservationDraft(observationDateDraft(period));
      setObservationError(null);
    } catch {
      setObservationError("持仓历史期间起止日期无效");
    }
  };
  const currentHoldingsScope = useMemo<RoomScope>(() => {
    const instant = holdingsAsOf ? new Date(holdingsAsOf) : new Date();
    const currentDate = holdingsAsOf && validObservationDate(holdingsAsOf) ? holdingsAsOf : Number.isFinite(instant.getTime()) ? roomTodayKey(instant) : createDefaultRoomScope().period.endDate;
    return { ...holdingsIdentity, period: { preset: "custom", startDate: currentDate, endDate: currentDate } };
  }, [holdingsIdentity, holdingsAsOf]);
  const portfolioModel = useMemo(
    () => buildCurrentPortfolio(entries, {
      scope: currentHoldingsScope,
      fxSnapshot: usableFxSnapshot,
      instrumentMetadata,
      quotesByInstrument: holdingsQuotesByInstrument,
      candlesByInstrument: holdingsCandlesByInstrument,
      targetCurrency,
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
      currentHoldingsScope,
      targetCurrency,
      usableFxSnapshot,
    ],
  );
  const roomHoldingsModel = portfolioModel.holdings;
  const holdingsHistoryModel = useMemo(() => buildHoldingsHistory(entries, {
    scope: holdingsScope, instrumentMetadata, candlesByInstrument: holdingsCandlesByInstrument,
    asOf: holdingsAsOf, fxSnapshot: usableFxSnapshot, targetCurrency,
  }), [entries, holdingsScope, instrumentMetadata, holdingsCandlesByInstrument, holdingsAsOf, targetCurrency, usableFxSnapshot]);
  // Current-day PnL must never come from the tail of a user-selected old observation window.
  const currentDayHistory = useMemo(() => buildHoldingsHistory(entries, {
    scope: currentHoldingsScope, instrumentMetadata, candlesByInstrument: holdingsCandlesByInstrument,
    asOf: holdingsAsOf, fxSnapshot: usableFxSnapshot, targetCurrency,
  }), [entries, currentHoldingsScope, instrumentMetadata, holdingsCandlesByInstrument, holdingsAsOf, targetCurrency, usableFxSnapshot]);
  const currentDayPoint = currentDayHistory.points.at(-1);
  const contributionModel = useMemo(() => buildRoomContribution(roomModel.rows, usableFxSnapshot, targetCurrency), [roomModel.rows, targetCurrency, usableFxSnapshot]);
  const pendingModel = useMemo(() => buildPendingReviews(roomModel.rows, usableFxSnapshot, targetCurrency), [roomModel.rows, targetCurrency, usableFxSnapshot]);
  const pendingPageCount = Math.max(1, Math.ceil(pendingModel.count / 3));
  const effectivePendingPage = Math.min(pendingPage, pendingPageCount);
  const pendingSourceSnapshot = useMemo<RoomPendingSourceSnapshot>(() => ({
    sharedScope: sharedScope ?? {
      nature: roomScope.nature,
      accountIds: [...roomScope.accountIds],
      reportCurrency,
      simulationRunId: roomScope.simulationRunId,
    },
    roomScope: {
      ...roomScope,
      accountIds: [...roomScope.accountIds],
      instrumentIds: [...roomScope.instrumentIds],
      markets: [...roomScope.markets],
      currencies: [...roomScope.currencies],
      reviewStatuses: [...roomScope.reviewStatuses],
    },
    observationPeriod: effectiveObservationPeriod,
    historyPeriod: roomScope.period,
    holdings: holdingsBrowseState,
    pending: { page: effectivePendingPage },
    historyCalendar,
  }), [effectiveObservationPeriod, effectivePendingPage, historyCalendar, holdingsBrowseState, reportCurrency, roomScope, sharedScope]);
  const canViewHoldings = roomScope.nature !== "simulation" || Boolean(roomScope.simulationRunId);
  const roomDataQuality = useMemo(
    () => qualityInput
      ? buildTradingRoomQuality({
        ...qualityInput,
        scope: roomScope,
        rows: roomModel.rows,
        holdings: roomHoldingsModel,
        fxSnapshot: qualityInput.fxSnapshot ?? usableFxSnapshot,
      })
      : null,
    [qualityInput, roomHoldingsModel, roomModel.rows, roomScope, usableFxSnapshot],
  );
  useEffect(() => {
    if (roomDataQuality) onQualityModelChange?.(roomDataQuality);
  }, [onQualityModelChange, roomDataQuality]);
  const roomMarkets = roomScope.markets ?? [];
  const roomDateDraftDirty = roomCustomStartDate !== roomScope.period.startDate || roomCustomEndDate !== roomScope.period.endDate;
  const roomRows = useMemo(() => roomModel.rows.map(value => value.row), [roomModel.rows]);
  const natureEntries = useMemo(() => scopedEntriesForNature(entries, roomScope.nature === "simulation" ? "simulation" : "live"), [entries, roomScope.nature]);
  const accountOptions = useMemo(() => accountFilterOptions(natureEntries), [natureEntries]);
  const currencyOptions = useMemo(() => [...new Set(natureEntries.map(entry => entry.instrument.currency.trim().toUpperCase()).filter(Boolean))]
    .sort()
    .map(value => ({ value, label: value })), [natureEntries]);
  const marketOptions = useMemo(() => marketFilterOptions(natureEntries), [natureEntries]);
  const simulationRunOptions = useMemo(() => simulationFilterOptions(natureEntries), [natureEntries]);
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
    || roomScope.period.preset !== "ytd"
    || roomFilterCount > 0;
  const updateRoomScope = (patch: Partial<RoomScope>) => {
    setRoomScope(current => {
      const next = { ...current, ...patch };
      if (patch.nature && patch.nature !== current.nature) {
        next.accountIds = [];
        next.simulationRunId = null;
      }
      return next;
    });
    if (onSharedScopeChange) {
      const sharedPatch: Partial<SharedScope> = {};
      if (patch.nature !== undefined) sharedPatch.nature = patch.nature;
      if (patch.accountIds !== undefined || patch.nature !== undefined) sharedPatch.accountIds = patch.nature && patch.nature !== roomScope.nature ? [] : [...(patch.accountIds ?? roomScope.accountIds)];
      if (patch.simulationRunId !== undefined || patch.nature !== undefined) sharedPatch.simulationRunId = patch.nature && patch.nature !== roomScope.nature ? null : (patch.simulationRunId ?? roomScope.simulationRunId);
      if (Object.keys(sharedPatch).length > 0) onSharedScopeChange(sharedPatch);
    }
    setRoomPeriodError(null);
    if (patch.period) setRoomDateDraft({ startDate: patch.period.startDate, endDate: patch.period.endDate, baseSignature: `${patch.period.preset}|${patch.period.startDate}|${patch.period.endDate}` });
  };
  const updateRoomPeriod = (preset: RoomPeriodPreset) => {
    if (preset === "all") {
      applyRoomHistoryPeriod("all");
      return;
    }
    if (preset === "custom") {
      setRoomPeriodError(null);
      setRoomDateDraft({ startDate: roomScope.period.startDate, endDate: roomScope.period.endDate, baseSignature: roomPeriodSignature });
      return;
    }
    setRoomPeriodError(null);
    const period = buildRoomDateRange(preset);
    setRoomDateDraft({ startDate: period.startDate, endDate: period.endDate, baseSignature: `${period.preset}|${period.startDate}|${period.endDate}` });
    updateRoomScope({ period });
  };
  const applyRoomCustomPeriod = (startDate = roomCustomStartDate, endDate = roomCustomEndDate) => {
    try {
      const today = createDefaultRoomScope().period.endDate;
      if (!startDate || !endDate || endDate > today) throw new RangeError("future date");
      const period = buildRoomDateRange("custom", today, startDate, endDate);
      setRoomPeriodError(null);
      updateRoomScope({ period });
    } catch {
      setRoomPeriodError("自定义期间起止日期无效");
    }
  };
  const applyRoomHistoryPeriod = (mode: "all" | "recent") => {
    const today = createDefaultRoomScope().period.endDate;
    const roomHistoryDates = roomHistoryModel.rows
      .map(value => dashboardEpisodeDate(value.row))
      .filter(value => value <= today)
      .sort();
    const latest = roomHistoryDates.at(-1);
    const earliest = roomHistoryDates[0];
    if (!latest || !earliest) {
      setRoomPeriodError("当前筛选没有可用的已平仓回合，无法跳转历史期间");
      return;
    }
    if (mode === "all") {
      try {
        const period = buildRoomDateRange("all", today, { startDate: earliest, endDate: latest });
        setRoomDateDraft({ startDate: period.startDate, endDate: period.endDate, baseSignature: `${period.preset}|${period.startDate}|${period.endDate}` });
        updateRoomScope({ period });
        setRoomPeriodError(null);
      } catch {
        setRoomPeriodError("当前筛选没有可用的有效历史期间");
      }
      return;
    }
    const month = latest.slice(0, 7);
    const end = new Date(`${month}-01T00:00:00.000Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    const monthEnd = end.toISOString().slice(0, 10);
    applyRoomCustomPeriod(`${month}-01`, monthEnd > today ? today : monthEnd);
  };
  const resetRoomScope = () => {
    const next = createDefaultRoomScope();
    setRoomScope(next);
    setObservationPeriod(next.period);
    setObservationDraft(observationDateDraft(next.period));
    setObservationError(null);
    setRoomDateDraft({ startDate: next.period.startDate, endDate: next.period.endDate, baseSignature: `${next.period.preset}|${next.period.startDate}|${next.period.endDate}` });
    setRoomPeriodError(null);
    onSharedScopeChange?.({ nature: "live", accountIds: [], simulationRunId: null });
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
    onSharedScopeChange?.({ nature: roomScope.nature === "simulation" ? "simulation" : "live", accountIds: [], simulationRunId: null });
    setRoomPeriodError(null);
  };
  const activeFilterChips = [
    roomScope.query ? { id: "query", label: `标的：${roomScope.query}`, remove: () => updateRoomScope({ query: undefined }) } : null,
    roomScope.accountIds[0] ? { id: "account", label: `账户：${accountOptions.find(option => option.value === roomScope.accountIds[0])?.label ?? roomScope.accountIds[0]}`, remove: () => updateRoomScope({ accountIds: [] }) } : null,
    roomScope.assetType && roomScope.assetType !== "all" ? { id: "asset-type", label: `资产类型：${roomScope.assetType === "etf" ? "ETF" : "股票"}`, remove: () => updateRoomScope({ assetType: "all" }) } : null,
    roomMarkets[0] ? { id: "market", label: `市场：${roomMarketLabel(roomMarkets[0])}`, remove: () => updateRoomScope({ markets: [] }) } : null,
    roomScope.currencies[0] ? { id: "currency", label: `币种：${roomScope.currencies[0]}`, remove: () => updateRoomScope({ currencies: [] }) } : null,
    roomScope.reviewStatuses[0] ? { id: "review", label: `复盘：${roomScope.reviewStatuses[0] === "pending" ? "待复盘" : roomScope.reviewStatuses[0] === "completed" ? "已复盘" : "暂不复盘"}`, remove: () => updateRoomScope({ reviewStatuses: [] }) } : null,
  ].filter((value): value is { id: string; label: string; remove: () => void } => Boolean(value));
  const emptyRoomMessage = entries.length === 0
    ? "导入交易后查看我的交易室；已有交易数据会按来源平仓日显示。"
    : roomRows.length === 0
      ? roomScopeIsNarrowed
        ? "当前交易室范围没有回合。调整期间、分类或高级筛选后重试。"
        : "当前交易室范围暂无已平仓回合。"
      : null;
  const latestDataUpdatedAt = useMemo(() => {
    const candidates: string[] = [];
    for (const candles of Object.values(qualityInput?.marketDataCandles ?? {})) {
      for (const candle of candles ?? []) if (candle.fetchedAt) candidates.push(candle.fetchedAt);
    }
    for (const quote of Object.values(holdingsQuotesByInstrument ?? {})) {
      if (quote?.fetchedAt) candidates.push(quote.fetchedAt);
    }
    if (fxSnapshot?.asOf) candidates.push(fxSnapshot.asOf);
    for (const dimension of roomDataQuality?.dimensions ?? []) {
      if (dimension.asOf) candidates.push(dimension.asOf);
    }
    return candidates
      .map(value => ({ value, time: Date.parse(value) }))
      .filter(item => Number.isFinite(item.time))
      .sort((left, right) => right.time - left.time)[0]?.value ?? null;
  }, [fxSnapshot, holdingsQuotesByInstrument, qualityInput?.marketDataCandles, roomDataQuality]);

  return (
    <section className={styles.dashboard} style={dashboardStyle} aria-label="我的交易室">
      <header className={styles.topbar}>
        <div className={styles.topbarTitle}>
          <span className={styles.topbarEyebrow}>TradeReview · 历史交易复盘</span>
          <h1>我的交易室</h1>
          <p>持仓照看 · 复盘总结 · 持续进化</p>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarScope} aria-label="交易室共享范围">
            <div className={styles.topbarSegment} aria-label="交易性质" role="group">
              {(["live", "simulation"] as const).map(value => <button type="button" key={value} aria-pressed={roomScope.nature === value} onClick={() => updateRoomScope({ nature: value })}>
                {value === "live" ? "实盘" : "模拟盘"}
              </button>)}
            </div>
            <label className={styles.topbarSelect}><span>账户范围</span><select aria-label="账户范围" value={roomScope.accountIds[0] ?? "all"} onChange={event => updateRoomScope({ accountIds: event.target.value === "all" ? [] : [event.target.value] })}>
              <option value="all">全部账户</option>{accountOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select></label>
            {roomScope.nature === "simulation" && <label className={styles.topbarSelect}><span>模拟运行</span><select aria-label="模拟运行" value={roomScope.simulationRunId ?? ""} onChange={event => updateRoomScope({ simulationRunId: event.target.value || null })}>
              <option value="">请选择运行</option>{simulationRunOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select></label>}
            <label className={styles.topbarSelect}><span>计价币种</span><select aria-label="报告计价" value={reportCurrency} onChange={event => {
              const next = event.target.value as SharedReportCurrency;
              setLocalReportCurrency(next);
              onSharedScopeChange?.({ reportCurrency: next });
            }}>
              <option value="original">原币</option><option value="HKD">HKD</option><option value="CNY">CNY</option>
            </select></label>
            <button
              type="button"
              className={styles.topbarFilterToggle}
              aria-expanded={roomFiltersOpen}
              aria-controls="trading-room-scope-filters"
              onClick={() => setRoomFiltersOpen(open => !open)}
            >
              筛选{roomFilterCount > 0 ? ` · ${roomFilterCount}` : ""}
            </button>
          </div>
          <div className={styles.topbarUpdated} aria-label="数据更新时间">
            <span className={styles.topbarUpdatedDot} aria-hidden="true" />
            <span>数据更新：</span>
            {latestDataUpdatedAt
              ? <time dateTime={latestDataUpdatedAt} title={`数据更新时间：${latestDataUpdatedAt}`}>{formatDashboardDataTime(latestDataUpdatedAt)}</time>
              : <span>不可用</span>}
          </div>
          <TradingRoomGlobalTools
            entries={entries}
            scope={roomScope}
            marketDataStatuses={qualityInput?.marketDataStatuses}
            marketDataLabels={qualityInput?.marketDataLabels}
            status={globalEntryStatus}
            onOpenSearchResult={result => onOpenSearchResult?.(result)}
            onOpenNotification={item => onOpenGlobalNotification?.(item)}
            onOpenAccountAndCurrency={() => onOpenAccountAndCurrency?.()}
          />
        </div>
      </header>

      <section aria-label="交易室范围">
      {roomFiltersOpen && <div id="trading-room-scope-filters" className={`${styles.roomScopeSection} ${styles.sharedToolbar}`}>
        <div className={styles.roomScopeHeading}><div><h2 className={styles.compactSectionTitle}>交易室共享范围</h2><p>{roomNatureLabel(roomScope.nature)} · {roomCategoryLabel(roomScope.assetCategory)} · 账户：{roomScope.accountIds[0] ? (accountOptions.find(option => option.value === roomScope.accountIds[0])?.label ?? roomScope.accountIds[0]) : "全部"} · 币种：{roomScope.currencies[0] ?? "全部"}</p></div><span className={styles.roomScopeBadge}>{roomRows.length} 个回合进入范围</span></div>
        <div className={styles.roomScopeControls}>
          <RadioGroup label="市场分类" ariaLabel="交易室市场分类筛选" value={roomScope.assetCategory} options={[{ value: "all", label: "全部市场" }, { value: "a-share-stock", label: "A股" }, { value: "us-stock", label: "美股" }, { value: "hk-stock", label: "港股" }]} onChange={value => updateRoomScope({ assetCategory: value as RoomAssetCategory, markets: [] })} />
          {roomScope.nature === "simulation" && <RadioGroup label="模拟运行" ariaLabel="交易室模拟运行筛选" value={roomScope.simulationRunId ?? ""} options={[{ value: "", label: "请选择运行" }, ...simulationRunOptions]} onChange={value => updateRoomScope({ simulationRunId: value || null })} />}
        </div>
        <div className={styles.roomAncillaryRow}>
        <details className={styles.roomAdvancedDetails}>
          <summary>更多筛选{roomFilterCount > 0 ? ` · ${roomFilterCount} 项已启用` : ""}</summary>
          <div className={styles.roomAdvancedGrid}>
            <label className={styles.searchField}><span>标的</span><div><Search size={15} /><input aria-label="交易室标的筛选" type="search" placeholder="名称或代码" value={roomScope.query ?? ""} onChange={event => updateRoomScope({ query: event.target.value })} /></div></label>
            <RadioGroup label="账户" ariaLabel="交易室账户筛选" value={roomScope.accountIds[0] ?? "all"} options={[{ value: "all", label: "全部账户" }, ...accountOptions]} onChange={value => updateRoomScope({ accountIds: value === "all" ? [] : [value] })} />
            <RadioGroup label="资产类型" ariaLabel="交易室资产类型筛选" value={roomScope.assetType ?? "all"} options={[{ value: "all", label: "全部资产" }, { value: "stock", label: "股票" }, { value: "etf", label: "ETF" }]} onChange={value => updateRoomScope({ assetType: value as RoomAssetTypeFilter })} />
            <RadioGroup label="交易市场" ariaLabel="交易室交易市场筛选" value={roomMarkets[0] ?? "all"} options={[{ value: "all", label: "全部市场" }, ...marketOptions]} onChange={value => updateRoomScope({ markets: value === "all" ? [] : [value] })} />
            <RadioGroup label="币种" ariaLabel="交易室币种筛选" value={roomScope.currencies[0] ?? "all"} options={[{ value: "all", label: "全部币种" }, ...currencyOptions]} onChange={value => updateRoomScope({ currencies: value === "all" ? [] : [value] })} />
            <RadioGroup label="复盘状态" ariaLabel="交易室复盘状态筛选" value={roomScope.reviewStatuses[0] ?? "all"} options={[{ value: "all", label: "全部状态" }, { value: "pending", label: "待复盘" }, { value: "completed", label: "已复盘" }, { value: "deferred", label: "暂不复盘" }]} onChange={value => updateRoomScope({ reviewStatuses: value === "all" ? [] : [value as RoomReviewStatus] })} />
            {roomFilterCount > 0 && <button type="button" className={styles.roomClearButton} onClick={clearRoomFilters}>清除附加筛选</button>}
            <button type="button" className={styles.roomClearButton} onClick={resetRoomScope}>恢复默认范围</button>
          </div>
        </details>
        {activeFilterChips.length > 0 && <ul className={styles.filterChips} aria-label="已启用交易室筛选">
          {activeFilterChips.map(chip => <li key={chip.id}><span>{chip.label}</span><button type="button" aria-label={`移除${chip.label.split("：")[0]}筛选`} onClick={chip.remove}>×</button></li>)}
        </ul>}
        </div>
      </div>}

      <section className={styles.workspace} aria-label="持仓照看">
        <header className={styles.workspaceHeading}><div><h2>持仓照看</h2><p>关注当前仓位，回看历史持仓变化</p></div><span>当前时点 · {roomHoldingsModel.asOf}</span></header>
        {canViewHoldings && <RoomPortfolioSummary model={portfolioModel} reportCurrency={reportCurrency}
          dailyPnl={currentDayPoint?.dailyPnlAvailable ? currentDayPoint.dailyPnl : undefined}
          dailyPnlReason={currentDayPoint?.dailyPnlAvailable
            ? reportCurrency === "original" ? "按原币显示当日净盈亏" : currentDayPoint.dailyPnl.note
            : currentDayPoint?.dailyPnlReasons.join("；") || "当前日期缺少可核对的估值证据"}
          dailyReturnPercent={currentDayPoint?.dailyReturnPercent}
          dailyReturnPercentAvailable={currentDayPoint?.dailyReturnPercentAvailable}
          dailyReturnPercentReasons={currentDayPoint?.dailyReturnPercentReasons} />}
        {canViewHoldings && <div className={styles.holdingsOverviewGrid}>
          <RoomHoldingsHistory
            model={holdingsHistoryModel}
            reportCurrency={reportCurrency}
            periodLabel="持仓历史观察期间"
            periodControls={<div className={styles.observationControls}>{/* The range controls live in the chart card header. */}
              <div className={styles.roomPeriodControl}><span>持仓历史观察期间</span><div className={styles.periodTabs} role="tablist" aria-label="持仓历史期间">
                {([['month', '近1月', '本自然月'], ['last-3-months', '近3月', '近3个自然月'], ['ytd', '今年', '今年至今'], ['all', '全部', '全部']] as const).map(([value, label, fullLabel]) => <button type="button" role="tab" className={styles.periodTab} aria-selected={observationPeriod.preset === value} aria-label={`持仓历史：${fullLabel}`} key={value} onClick={() => updateObservationPeriod(value)}>{label}<span className={styles.visuallyHidden}>{fullLabel}</span></button>)}
              </div></div>
              <details className={styles.dateDetails}><summary>自定义观察日期</summary>
                <div className={styles.roomCustomPeriodEditor} role="group" aria-label="自定义持仓历史期间">
                  <label className={styles.filterField}><span>起始日期</span><input type="date" aria-label="持仓历史起始日期" value={effectiveObservationDraft.startDate} onChange={event => setObservationDraft({ ...effectiveObservationDraft, startDate: event.target.value })} /></label>
                  <label className={styles.filterField}><span>结束日期</span><input type="date" aria-label="持仓历史结束日期" value={effectiveObservationDraft.endDate} onChange={event => setObservationDraft({ ...effectiveObservationDraft, endDate: event.target.value })} /></label>
                  <button type="button" className={styles.customPeriodApply} onClick={applyObservationPeriod}>应用观察期间</button>
                </div>
              </details>
              {observationError && <p role="alert" className={styles.roomScopeWarning}>{observationError}</p>}
            </div>}
          />
          <RoomAllocation model={portfolioModel} reportCurrency={reportCurrency} targetCurrency={targetCurrency} fxSnapshot={usableFxSnapshot} cashSummary={cashSummary} loading={cashLoading} error={cashError} />
        </div>}
      {canViewHoldings && <div id="trading-room-holdings" className={styles.holdingsAnchor} tabIndex={-1}>
        <RoomHoldingsPanel
          entries={entries}
          scope={currentHoldingsScope}
          portfolioModel={portfolioModel}
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
          reportCurrency={reportCurrency}
          fxSnapshot={usableFxSnapshot}
          browseState={holdingsBrowseState}
          onBrowseStateChange={setHoldingsBrowseState}
          onRetryQuote={instrumentId => onRetryDataQuality?.("holdings", [instrumentId])}
          onOpenDataCheck={(instrumentId, episodeId) => onOpenDataCheck?.("holdings", [instrumentId], episodeId)}
          onOpenInReview={onOpenInReview}
        />
      </div>}
        {!canViewHoldings && <p className={styles.roomScopeHint}>请选择一个模拟运行查看独立持仓与历史，不会跨运行合并。</p>}
      </section>

      <section className={`${styles.roomScopeSection} ${styles.workspace}`} aria-label="历史交易与复盘">
        <header className={styles.workspaceHeading}><div><h2>历史交易与复盘</h2><p>回顾已完成的交易，总结经验 · {roomScope.period.startDate} 至 {roomScope.period.endDate}</p></div>
          {onViewHistoryLibrary && <button type="button" className={styles.historyLibraryButton} onClick={() => onViewHistoryLibrary({
            reviewStatus: "all",
            positionStatus: "closed",
            closeDateFrom: roomScope.period.startDate,
            closeDateTo: roomScope.period.endDate,
            sourceSnapshot: pendingSourceSnapshot,
          })}>进入交易库 <span aria-hidden="true">→</span></button>}
          <div className={styles.historyPeriodControl}>
            <span>统计期间{roomScope.period.preset === "custom" || roomDateDraftDirty ? " · 自定义" : ""}{roomDateDraftDirty ? " · 待应用" : ""}</span>
            <div className={styles.periodTabs} role="tablist" aria-label="交易室期间">
              {([['last-3-months', '近3月', '近3个自然月'], ['ytd', '今年', '今年至今'], ['all', '全部', '全部']] as const).map(([value, label, fullLabel]) => (
                <button
                  type="button"
                  key={value}
                  role="tab"
                  className={styles.periodTab}
                  aria-label={fullLabel}
                  aria-selected={roomScope.period.preset === value}
                  onClick={() => updateRoomPeriod(value as RoomPeriodPreset)}
                >
                  {label}<span className={styles.visuallyHidden}>{fullLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <details className={styles.dateDetails}><summary>自定义统计日期</summary>
            <div className={styles.roomCustomPeriodEditor} id="custom-period-editor" role="group" aria-label="自定义统计期间">
              <label className={styles.filterField}><span>起始日期</span><input aria-label="交易室起始日期" type="date" value={roomCustomStartDate} onChange={event => setRoomDateDraft({ ...effectiveRoomDateDraft, startDate: event.target.value, baseSignature: roomPeriodSignature })} /></label>
              <label className={styles.filterField}><span>结束日期</span><input aria-label="交易室结束日期" type="date" value={roomCustomEndDate} onChange={event => setRoomDateDraft({ ...effectiveRoomDateDraft, endDate: event.target.value, baseSignature: roomPeriodSignature })} /></label>
              <div className={styles.roomCustomPeriodActions}>
                <button type="button" className={styles.customPeriodApply} onClick={() => applyRoomCustomPeriod()}>应用期间</button>
                <button type="button" className={styles.customPeriodCancel} onClick={() => applyRoomHistoryPeriod("all")}>全部历史</button>
              </div>
            </div>
          </details>
        </header>
        {roomPeriodError && <p className={styles.roomScopeWarning}>{roomPeriodError}</p>}
        <div className={styles.roomAncillaryRow}>
        <div className={styles.roomSummaryGrid} aria-label="交易室业绩摘要">
          {metricCard(
            "已平仓回合净盈亏",
            roomMoneyLabel(roomModel.summary.money, reportCurrency),
            `${roomScope.period.startDate} 至 ${roomScope.period.endDate} · ${roomMoneySummary(roomModel.summary.money, reportCurrency)} · 按平仓日期统计，已扣费用，不含浮盈亏`,
            signedClass(roomModel.summary.money.convertedCny),
          )}
          {metricCard("完整回合数", String(roomModel.rows.filter(value => value.row.item.episode.status === "closed").length), `可信已平仓回合 ${roomModel.summary.trustedClosedCount} · ${roomModel.summary.wins} 胜 · ${roomModel.summary.losses} 负 · 持平 ${roomModel.summary.breakEven}`)}
          {metricCard("合计胜率", percentLabel(roomMetrics.monthlyWinRate.ratePercent), `${roomMetrics.monthlyWinRate.wins}/${roomMetrics.monthlyWinRate.denominator} 个可信已平仓回合`)}
          {metricCard("待复盘", String(pendingModel.count), "当前范围内未完成且未暂缓的已平仓回合")}
        </div>
        <details className={styles.roomDetailsSummary}>
          <summary>查看口径说明</summary>
          <div className={styles.roomDetailsBody}>
            <details className={styles.roomScopeNotes}><summary>查看统计口径</summary><p className={styles.roomScopeHint}>累计盈亏按平仓日期统计，已扣交易费用，不含当前持仓浮盈亏；参考收益率使用已配置参考资本，不代表账户净值收益率。ETF 只作为资产类型筛选，不按 ETF 内部成分重新归因。原币模式保留各币种金额，不把不同币种直接相加；折算 CNY 使用现有汇率快照。未知资产类型保留提示，不纳入 A股 / 美股 / 港股合计。</p></details>
            <details className={styles.returnDetails}><summary>查看收益率解释与参考</summary><div className={styles.returnGrid}>
              {metricCard(
                "交易成本收益率",
                percentLabel(principalSummary.costReturn.costReturnPercent),
                "可信净盈亏 ÷ 完整回合买入成本 · 非账户收益率",
                signedClass(principalSummary.costReturn.costReturnPercent),
              )}
              {metricCard(
                "参考收益率",
                referenceReturnSummary.status === "available" ? percentLabel(referenceReturnSummary.returnPercent) : "不可用",
                referenceReturnSummary.status === "available"
                  ? "可信已平仓净盈亏 ÷ 已配置参考资本；不代表账户净值收益率"
                  : (referenceReturnSummary.reason ?? "参考资本未覆盖当前范围"),
                referenceReturnSummary.status === "available" ? signedClass(referenceReturnSummary.returnPercent) : undefined,
              )}
            </div></details>
            <details className={styles.roomMoneyDetails}>
              <summary>查看原币与汇率详情</summary>
              <p>{reportCurrency === "CNY" ? "人民币折算使用现有汇率快照；" : reportCurrency === "HKD" ? "港币折算使用同一汇率快照；" : "原币显示保留各币种单位；"}{roomMoneyDetail(roomModel.summary.money, reportCurrency)}</p>
            </details>
          </div>
        </details>
        {(roomModel.summary.excludedCount > 0 || roomModel.summary.unknownAssetEpisodeCount > 0) && <p className={styles.roomScopeStatus}>
          {roomModel.summary.excludedCount > 0 && `排除样本 ${roomModel.summary.excludedCount} 个`}
          {roomModel.summary.excludedCount > 0 && roomModel.summary.unknownAssetEpisodeCount > 0 && " · "}
          {roomModel.summary.unknownAssetEpisodeCount > 0 && `未知资产 ${roomModel.summary.unknownAssetEpisodeCount} 个，未纳入四类合计`}
        </p>}
        {roomScope.nature === "simulation" && !roomScope.simulationRunId && <p className={styles.roomScopeWarning}>请选择一个模拟运行后查看该运行的独立统计；不会跨运行合并。</p>}
        {roomRows.length === 0 && !(roomScope.nature === "simulation" && !roomScope.simulationRunId) && <p className={styles.emptyCalendar}>{emptyRoomMessage}</p>}
        </div>
        <RoomPerformance
          entries={entries}
          scope={roomScope}
          embedded
          layout="workspace"
          contributionSlot={<RoomContribution model={contributionModel} reportCurrency={reportCurrency} />}
          onScopeChange={patch => updateRoomScope(patch)}
          instrumentMetadata={instrumentMetadata}
          fxSnapshot={usableFxSnapshot}
          asOf={holdingsAsOf}
          onOpenInReview={onOpenInReview}
          reportCurrency={reportCurrency}
          calendarBrowseState={historyCalendar}
          onCalendarBrowseStateChange={setHistoryCalendar}
          renderMoney={view => roomMoneyLabel(view, reportCurrency)}
        />
        <RoomPendingReviews
          model={pendingModel}
          onOpenInReview={onOpenInReview}
          page={effectivePendingPage}
          onPageChange={setPendingPage}
          sourceSnapshot={pendingSourceSnapshot}
          onViewAllPending={onViewAllPending}
        />
      </section>

      </section>

    </section>
  );
}
