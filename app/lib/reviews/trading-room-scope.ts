import Decimal from "decimal.js";

import {
  dashboardEpisodeDate,
  dashboardEpisodeNature,
  dashboardEpisodeSimulationRunId,
  dashboardRowExclusionReason,
  dashboardRowIsTrustedClosed,
  type DashboardRow,
} from "./dashboard";
import type { TradeNature, Instrument } from "../trades/types";
import type { TradeLibraryEntry } from "../trades/library";

export type RoomTradeNature = TradeNature;

export type RoomAssetType = "stock" | "etf" | "unknown";
export type RoomAssetTypeFilter = "all" | "stock" | "etf";

/**
 * These are display/query categories. They do not become an Instrument market
 * or change the identity of a transaction.
 */
export type RoomAssetCategory =
  | "all"
  | "a-share-stock"
  | "us-stock"
  | "hk-stock"
  | "etf"
  | "unknown";

export type RoomPeriodPreset = "month" | "last-3-months" | "ytd" | "custom";

export type RoomDateRange = {
  preset: RoomPeriodPreset;
  startDate: string;
  endDate: string;
};

export type RoomReviewStatus = "pending" | "completed" | "deferred";

export type RoomScope = {
  nature: RoomTradeNature;
  assetCategory: RoomAssetCategory;
  /** Secondary filter; market remains the primary attribution dimension. */
  assetType?: RoomAssetTypeFilter;
  period: RoomDateRange;
  simulationRunId: string | null;
  query?: string;
  accountIds: readonly string[];
  instrumentIds: readonly string[];
  /** Canonical market ids; useful for narrowing the all-market ETF category. */
  markets: readonly string[];
  currencies: readonly string[];
  reviewStatuses: readonly RoomReviewStatus[];
};

export type TradingRoomInstrumentMetadata = {
  market: string;
  symbol: string;
  assetType: Exclude<RoomAssetType, "unknown">;
};

export type TradingRoomMetadataInput =
  | ReadonlyMap<string, TradingRoomInstrumentMetadata | undefined>
  | Readonly<Record<string, TradingRoomInstrumentMetadata | undefined>>
  | undefined;

export type RoomFxSnapshot = {
  id: string;
  baseCurrency: "CNY";
  asOf: string;
  source: string;
  status: "complete" | "partial" | "missing";
  /** A rate is the amount of CNY for one unit of the source currency. */
  rates: Readonly<Record<string, string>>;
};

export type RoomMoneyView = {
  baseCurrency: "CNY";
  originalByCurrency: Readonly<Record<string, string>>;
  convertedCny: string | null;
  conversion: "same-currency" | "complete" | "partial" | "missing";
  fxSnapshotId: string | null;
  note: string;
};

export type RoomMoneyAmount = {
  currency: string;
  amount: string | null;
};

export type TradingRoomAssetProjection = {
  category: Exclude<RoomAssetCategory, "all">;
  assetType: RoomAssetType;
  reason: string | null;
};

export type TradingRoomRow = {
  row: DashboardRow;
  assetCategory: Exclude<RoomAssetCategory, "all">;
  assetType: RoomAssetType;
  sourceNature: RoomTradeNature;
  closeDate: string | null;
  trustedPnl: string | null;
  exclusionReason: string | null;
  assetReason: string | null;
};

export type TradingRoomSummary = {
  range: RoomDateRange;
  money: RoomMoneyView;
  trustedClosedCount: number;
  excludedCount: number;
  wins: number;
  losses: number;
  breakEven: number;
  unknownAssetCount: number;
  unknownAssetEpisodeCount: number;
  exclusionReasons: Readonly<Record<string, number>>;
};

export type TradingRoomCategory = {
  id: Exclude<RoomAssetCategory, "all">;
  label: string;
  rows: TradingRoomRow[];
  summary: TradingRoomSummary;
};

export type TradingRoomModel = {
  scope: RoomScope;
  rows: TradingRoomRow[];
  categories: TradingRoomCategory[];
  summary: TradingRoomSummary;
};

/** The product's source-date boundary is the Shanghai calendar day. */
export function roomTodayKey(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftMonth(value: string, delta: number): string {
  const date = dateFromKey(`${value.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return dateKey(date);
}

function assertDateRange(startDate: string, endDate: string): void {
  if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) {
    throw new RangeError("交易室日期范围无效");
  }
}

export function buildRoomDateRange(
  preset: RoomPeriodPreset,
  today: string = roomTodayKey(),
  custom?: { startDate: string; endDate: string } | string,
  customEndDate?: string,
): RoomDateRange {
  if (!isDateKey(today)) throw new RangeError("交易室今天日期无效");
  const endDate = today;
  if (preset === "custom") {
    const startDate = typeof custom === "string" ? custom : custom?.startDate;
    const end = typeof custom === "string" ? customEndDate : custom?.endDate;
    if (!startDate || !end) throw new RangeError("自定义交易室日期范围不完整");
    assertDateRange(startDate, end);
    return { preset, startDate, endDate: end };
  }
  const startDate = preset === "month"
    ? `${today.slice(0, 7)}-01`
    : preset === "last-3-months"
      ? `${shiftMonth(today, -2).slice(0, 7)}-01`
      : `${today.slice(0, 4)}-01-01`;
  assertDateRange(startDate, endDate);
  return { preset, startDate, endDate };
}

export function createDefaultRoomScope(today: string = roomTodayKey()): RoomScope {
  return {
    nature: "live",
    assetCategory: "all",
    assetType: "all",
    period: buildRoomDateRange("month", today),
    simulationRunId: null,
    accountIds: [],
    instrumentIds: [],
    markets: [],
    currencies: [],
    reviewStatuses: [],
  };
}

/**
 * A compatibility value for callers that need a default scope. Its period is
 * evaluated on access so a long-lived module does not retain yesterday's
 * Shanghai calendar date after midnight.
 */
export const DEFAULT_ROOM_SCOPE: RoomScope = {
  nature: "live",
  assetCategory: "all",
  assetType: "all",
  get period() {
    return buildRoomDateRange("month");
  },
  simulationRunId: null,
  accountIds: [],
  instrumentIds: [],
  markets: [],
  currencies: [],
  reviewStatuses: [],
};

function normalizedMarket(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function canonicalMarket(value: string | undefined): string {
  const market = normalizedMarket(value);
  if (["CN", "CN-SH", "SH", "SSE"].includes(market)) return "CN-SH";
  if (["CN-SZ", "SZ", "SZSE"].includes(market)) return "CN-SZ";
  return market;
}

function normalizedCurrency(value: string | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency;
}

function normalizedSymbol(value: string | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function validMetadata(value: TradingRoomInstrumentMetadata | undefined): value is TradingRoomInstrumentMetadata {
  return Boolean(
    value &&
      typeof value.market === "string" &&
      typeof value.symbol === "string" &&
      value.symbol.trim() &&
      (value.assetType === "stock" || value.assetType === "etf"),
  );
}

/** Convert the prop's map/object form to one immutable lookup shape. */
export function normalizeRoomMetadata(input: TradingRoomMetadataInput): Map<string, TradingRoomInstrumentMetadata> {
  const result = new Map<string, TradingRoomInstrumentMetadata>();
  const entries = input instanceof Map ? input.entries() : Object.entries(input ?? {});
  for (const [id, value] of entries) {
    if (!validMetadata(value)) continue;
    result.set(id, {
      market: normalizedMarket(value.market),
      symbol: value.symbol.trim(),
      assetType: value.assetType,
    });
  }
  return result;
}

export function classifyTradingRoomAsset(
  instrument: Instrument,
  metadata?: TradingRoomInstrumentMetadata,
): TradingRoomAssetProjection {
  const instrumentMarket = canonicalMarket(instrument.market);
  const category = instrumentMarket === "CN-SH" || instrumentMarket === "CN-SZ"
    ? "a-share-stock"
    : instrumentMarket === "US"
      ? "us-stock"
      : instrumentMarket === "HK"
        ? "hk-stock"
        : null;
  if (!category) {
    return { category: "unknown", assetType: "unknown", reason: "市场不在交易室支持范围" };
  }
  if (!metadata || !validMetadata(metadata)) {
    return { category, assetType: "unknown", reason: "缺少可信资产类型元数据" };
  }
  if (canonicalMarket(metadata.market) !== instrumentMarket) {
    return { category, assetType: "unknown", reason: "资产元数据市场与交易身份不一致" };
  }
  if (normalizedSymbol(metadata.symbol) !== normalizedSymbol(instrument.symbol)) {
    return { category, assetType: "unknown", reason: "资产元数据代码与交易身份不一致" };
  }
  const assetType = metadata.assetType;
  return { category, assetType, reason: null };
}

function decimal(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function formatDecimal(value: Decimal): string {
  return value.toString();
}

function rateFor(snapshot: RoomFxSnapshot, currency: string): Decimal | null {
  if (currency === snapshot.baseCurrency) return new Decimal(1);
  const candidates = [`${currency}/${snapshot.baseCurrency}`, `${currency}:${snapshot.baseCurrency}`];
  for (const key of candidates) {
    const value = decimal(snapshot.rates[key]);
    if (value && value.gt(0)) return value;
  }
  return null;
}

export function buildRoomMoneyView(
  amounts: readonly RoomMoneyAmount[],
  snapshot?: RoomFxSnapshot,
): RoomMoneyView {
  const original = new Map<string, Decimal>();
  let missingAmount = false;
  for (const item of amounts) {
    const currency = normalizedCurrency(item.currency);
    const value = decimal(item.amount);
    if (!currency || value === null) {
      missingAmount = true;
      continue;
    }
    original.set(currency, (original.get(currency) ?? new Decimal(0)).plus(value));
  }
  const originalByCurrency = Object.fromEntries([...original.entries()].map(([currency, value]) => [currency, formatDecimal(value)]));
  const currencies = [...original.keys()];
  const baseValue = original.get("CNY");
  if (currencies.length === 0) {
    return {
      baseCurrency: "CNY",
      originalByCurrency,
      convertedCny: null,
      conversion: missingAmount ? "partial" : "same-currency",
      fxSnapshotId: snapshot?.id ?? null,
      note: missingAmount ? "部分原币金额缺失或无效" : "暂无可信原币金额",
    };
  }
  if (!missingAmount && currencies.length === 1 && baseValue) {
    return {
      baseCurrency: "CNY",
      originalByCurrency,
      convertedCny: formatDecimal(baseValue),
      conversion: "same-currency",
      fxSnapshotId: snapshot?.id ?? null,
      note: "原币为人民币，无需汇率换算",
    };
  }
  if (missingAmount) {
    return {
      baseCurrency: "CNY",
      originalByCurrency,
      convertedCny: null,
      conversion: "partial",
      fxSnapshotId: snapshot?.id ?? null,
      note: "部分原币金额缺失或无效，按已知币种小计",
    };
  }
  if (!snapshot) {
    return {
      baseCurrency: "CNY",
      originalByCurrency,
      convertedCny: null,
      conversion: "missing",
      fxSnapshotId: null,
      note: "尚无完整汇率快照，按币种显示原币小计",
    };
  }
  const rates = currencies.map(currency => rateFor(snapshot, currency));
  if (snapshot.status !== "complete" || rates.some(rate => rate === null)) {
    return {
      baseCurrency: "CNY",
      originalByCurrency,
      convertedCny: null,
      conversion: "partial",
      fxSnapshotId: snapshot.id,
      note: "汇率快照不完整，按币种显示原币小计",
    };
  }
  const converted = currencies.reduce(
    (total, currency, index) => total.plus(original.get(currency)!.times(rates[index]!)),
    new Decimal(0),
  );
  return {
    baseCurrency: "CNY",
    originalByCurrency,
    convertedCny: formatDecimal(converted),
    conversion: "complete",
    fxSnapshotId: snapshot.id,
    note: `按最新汇率估算（${snapshot.source}，${snapshot.asOf}）`,
  };
}

function rowAccountId(row: DashboardRow): string {
  return row.item.episode.accountId;
}

function rowInstrumentId(row: DashboardRow): string {
  return row.item.episode.instrument.id;
}

function rowCloseOrStartDate(row: DashboardRow): string | null {
  const value = dashboardEpisodeDate(row);
  return isDateKey(value) ? value : null;
}

function rowCurrency(row: DashboardRow): string {
  return normalizedCurrency(row.item.episode.instrument.currency);
}

function reviewStatus(row: DashboardRow): RoomReviewStatus {
  if (row.item.review?.review.completed) return "completed";
  if (row.item.review?.review.deferredReason?.trim()) return "deferred";
  return "pending";
}

function rowMatchesDate(row: DashboardRow, period: RoomDateRange, ignorePerformanceDates: boolean): boolean {
  if (ignorePerformanceDates) return row.item.episode.status === "open";
  const date = rowCloseOrStartDate(row);
  return Boolean(date && date >= period.startDate && date <= period.endDate);
}

function rowMatchesQuery(row: DashboardRow, query: string | undefined): boolean {
  const normalized = query?.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const instrument = row.item.episode.instrument;
  return `${instrument.name} ${instrument.symbol}`.toLocaleLowerCase().includes(normalized);
}

function flattenRows(input: readonly DashboardRow[] | readonly TradeLibraryEntry[]): DashboardRow[] {
  if (input.length === 0) return [];
  const first = input[0] as DashboardRow | TradeLibraryEntry;
  if ("item" in first) return input as DashboardRow[];
  return (input as TradeLibraryEntry[]).flatMap(entry => entry.episodes.map(item => ({ entry, item })));
}

function normalizedScope(scope: RoomScope): RoomScope {
  return {
    ...scope,
    assetType: scope.assetType ?? "all",
    simulationRunId: scope.simulationRunId?.trim() || null,
    query: scope.query?.trim() || undefined,
    accountIds: scope.accountIds.map(value => value.trim()).filter(Boolean),
    instrumentIds: scope.instrumentIds.map(value => value.trim()).filter(Boolean),
    markets: (scope.markets ?? []).map(value => canonicalMarket(value)).filter(Boolean),
    currencies: scope.currencies.map(normalizedCurrency).filter(Boolean),
    reviewStatuses: [...scope.reviewStatuses],
  };
}

export type RoomRowFilterOptions = {
  ignorePerformanceDates?: boolean;
  instrumentMetadata?: TradingRoomMetadataInput;
};

export function filterRoomRows(
  input: readonly DashboardRow[] | readonly TradeLibraryEntry[],
  scope: RoomScope,
  options: RoomRowFilterOptions = {},
): DashboardRow[] {
  const rows = flattenRows(input);
  const normalized = normalizedScope(scope);
  const metadata = normalizeRoomMetadata(options.instrumentMetadata);
  return rows.filter(row => {
    const nature = dashboardEpisodeNature(row);
    if (nature !== normalized.nature) return false;
    if (normalized.nature === "simulation") {
      if (!normalized.simulationRunId || dashboardEpisodeSimulationRunId(row) !== normalized.simulationRunId) return false;
    }
    if (!rowMatchesQuery(row, normalized.query)) return false;
    const projection = classifyTradingRoomAsset(row.item.episode.instrument, metadata.get(rowInstrumentId(row)));
    const legacyEtfCategory = normalized.assetCategory === "etf";
    if (!legacyEtfCategory && normalized.assetCategory !== "all" && projection.category !== normalized.assetCategory) return false;
    if (legacyEtfCategory || normalized.assetType === "etf") {
      if (projection.assetType !== "etf") return false;
    } else if (normalized.assetType === "stock" && projection.assetType !== "stock") {
      return false;
    }
    if (normalized.accountIds.length > 0 && !normalized.accountIds.includes(rowAccountId(row))) return false;
    if (normalized.instrumentIds.length > 0 && !normalized.instrumentIds.includes(rowInstrumentId(row))) return false;
    if (normalized.markets.length > 0 && !normalized.markets.includes(canonicalMarket(row.item.episode.instrument.market))) return false;
    if (normalized.currencies.length > 0 && !normalized.currencies.includes(rowCurrency(row))) return false;
    if (normalized.reviewStatuses.length > 0 && !normalized.reviewStatuses.includes(reviewStatus(row))) return false;
    return rowMatchesDate(row, normalized.period, options.ignorePerformanceDates ?? false);
  });
}

function categoryLabel(category: Exclude<RoomAssetCategory, "all">): string {
  switch (category) {
    case "a-share-stock": return "A股";
    case "us-stock": return "美股";
    case "hk-stock": return "港股";
    case "etf": return "ETF";
    case "unknown": return "未知资产类型";
  }
}

function summaryForRows(
  rows: TradingRoomRow[],
  range: RoomDateRange,
  snapshot?: RoomFxSnapshot,
  includeUnknown = true,
): TradingRoomSummary {
  const money: RoomMoneyAmount[] = [];
  let trustedClosedCount = 0;
  let excludedCount = 0;
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  const reasons: Record<string, number> = {};
  const unknownInstrumentIds = new Set<string>();
  let unknownAssetEpisodeCount = 0;
  for (const value of rows) {
    if (value.assetCategory === "unknown") {
      unknownInstrumentIds.add(value.row.entry.instrument.id);
      unknownAssetEpisodeCount += 1;
      continue;
    }
    // Open rounds belong to the holdings view. Keep performance exclusion
    // counts aligned with the closed-round calendar and quality metrics.
    if (value.row.item.episode.status !== "closed") continue;
    if (value.trustedPnl === null) {
      excludedCount += 1;
      const reason = value.exclusionReason ?? "unavailable";
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      continue;
    }
    trustedClosedCount += 1;
    money.push({ currency: rowCurrency(value.row), amount: value.trustedPnl });
    const pnl = decimal(value.trustedPnl);
    if (pnl?.gt(0)) wins += 1;
    else if (pnl?.lt(0)) losses += 1;
    else breakEven += 1;
  }
  return {
    range,
    money: buildRoomMoneyView(money, snapshot),
    trustedClosedCount,
    excludedCount,
    wins,
    losses,
    breakEven,
    unknownAssetCount: includeUnknown ? unknownInstrumentIds.size : 0,
    unknownAssetEpisodeCount: includeUnknown ? unknownAssetEpisodeCount : 0,
    exclusionReasons: reasons,
  };
}

export type BuildTradingRoomModelOptions = {
  scope: RoomScope;
  instrumentMetadata?: TradingRoomMetadataInput;
  fxSnapshot?: RoomFxSnapshot;
};

export function buildTradingRoomModel(
  input: readonly DashboardRow[] | readonly TradeLibraryEntry[],
  options: BuildTradingRoomModelOptions,
): TradingRoomModel {
  const metadata = normalizeRoomMetadata(options.instrumentMetadata);
  const selectedRows = filterRoomRows(input, options.scope, { instrumentMetadata: metadata });
  const roomRows: TradingRoomRow[] = selectedRows.map(row => {
    const projection = classifyTradingRoomAsset(row.item.episode.instrument, metadata.get(rowInstrumentId(row)));
    const trusted = dashboardRowIsTrustedClosed(row) ? row.item.metrics.netPnl : null;
    return {
      row,
      assetCategory: projection.category,
      assetType: projection.assetType,
      sourceNature: dashboardEpisodeNature(row),
      closeDate: row.item.episode.status === "closed" ? rowCloseOrStartDate(row) : null,
      trustedPnl: trusted,
      exclusionReason: trusted === null ? dashboardRowExclusionReason(row) : null,
      assetReason: projection.reason,
    };
  });
  const order: Array<Exclude<RoomAssetCategory, "all">> = ["a-share-stock", "us-stock", "hk-stock", "unknown"];
  const categories = order
    .map(id => roomRows.filter(row => row.assetCategory === id))
    .filter(categoryRows => categoryRows.length > 0)
    .map(categoryRows => {
      const id = categoryRows[0].assetCategory;
      return {
        id,
        label: categoryLabel(id),
        rows: categoryRows,
        summary: summaryForRows(categoryRows, options.scope.period, options.fxSnapshot),
      };
    });
  return {
    scope: normalizedScope(options.scope),
    rows: roomRows,
    categories,
    summary: summaryForRows(roomRows, options.scope.period, options.fxSnapshot),
  };
}
