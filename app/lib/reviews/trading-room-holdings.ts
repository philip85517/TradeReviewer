import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import { marketTradingDate } from "../market/trading-date";
import type { MarketDataSyncStatus } from "../market/sync-status";
import { replayPositionAtPrice, type PositionLedgerSnapshot } from "../replay/position-ledger";
import type { StatementPosition } from "../import/monthly-statement";
import {
  classifyTradingRoomAsset,
  filterRoomRows,
  normalizeRoomMetadata,
  roomTodayKey,
  type RoomScope,
  type RoomTradeNature,
  type TradingRoomAssetProjection,
  type TradingRoomMetadataInput,
} from "./trading-room-scope";
import {
  dashboardEpisodeNature,
  dashboardEpisodeSimulationRunId,
  type DashboardRow,
} from "./dashboard";
import type { TradeLibraryEntry, TradeLibraryQuoteProjection } from "../trades/library";
import type { MarketDataJob } from "../storage/market-data-jobs";
import { executionSettlementCurrency, type TradeEpisode } from "../trades/types";

export type TradingRoomQuoteFreshness = "current" | "stale" | "future";

export type TradingRoomQuote = {
  price: string | null;
  currency: string;
  quoteDate: string | null;
  fetchedAt: string | null;
  provider: string | null;
  freshness: TradingRoomQuoteFreshness;
};

export type TradingRoomHoldingValueStatus = "available" | "unavailable" | "stale" | "missing";
export type TradingRoomHoldingDirection = "long" | "short" | "unknown";
export type TradingRoomHoldingPositionEvidenceStatus =
  | "verified-long"
  | "verified-short"
  | "unverified-negative"
  | "unavailable";
export type TradingRoomHoldingPositionEvidence = {
  status: TradingRoomHoldingPositionEvidenceStatus;
  summary: string;
  missing: readonly string[];
  sourceFormatRuleIds: readonly string[];
};
export type TradingRoomHoldingDiagnostic =
  | "available"
  | "position-evidence"
  | "missing-quote"
  | "stale-quote"
  | "future-quote"
  | "pre-trade-quote"
  | "currency-mismatch"
  | "invalid-quote"
  | "source-unavailable"
  | "source-unsupported"
  | "market-data-pending"
  | "market-data-storage-error";

export type TradingRoomMarketDataDiagnostic = {
  reason: string;
  sourceUnsupported: boolean;
};

export function diagnoseTradingRoomMarketData(
  status: MarketDataSyncStatus | undefined,
  label: string | undefined,
  job: MarketDataJob | undefined,
): TradingRoomMarketDataDiagnostic | null {
  const sourceText = `${label ?? ""} ${job?.message ?? ""}`;
  if (status === "needs-provider" || status === "source-forbidden" || (status === undefined && /源待连接|未连接|不支持/.test(sourceText))) {
    return { reason: "行情源不支持或尚未连接", sourceUnsupported: true };
  }
  if (status === "source-unavailable" || job?.status === "source-unavailable") {
    const detail = job?.error?.message ?? job?.message;
    return { reason: detail ? `行情源暂不可用：${detail}` : "行情源暂不可用", sourceUnsupported: false };
  }
  if (status === "storage-error" || job?.status === "storage-error") {
    const detail = job?.error?.message ?? job?.message;
    return { reason: detail ? `行情状态读取失败：${detail}` : "行情状态读取失败", sourceUnsupported: false };
  }
  if (status === "syncing" || job?.status === "syncing") {
    return { reason: "行情更新进行中", sourceUnsupported: false };
  }
  if (status === "not-requested" || !status && !job) {
    return { reason: "尚未开始行情更新", sourceUnsupported: false };
  }
  if (status === "stale" || status === "latest-available" || status === "partial") {
    return { reason: "行情覆盖不完整或已过期", sourceUnsupported: false };
  }
  return null;
}

export type TradingRoomHoldingsOptions = {
  scope: RoomScope;
  instrumentMetadata?: TradingRoomMetadataInput;
  quotesByInstrument?: Readonly<Record<string, TradingRoomQuote | undefined>>;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  marketDataStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  marketDataDailyStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  marketDataLabels?: Readonly<Record<string, string | undefined>>;
  marketDataJobs?: Readonly<Record<string, MarketDataJob | undefined>>;
  positionSnapshotsByEpisode?: Readonly<Record<string, PositionLedgerSnapshot | undefined>>;
  /** The local as-of instant used to classify candle age; injected for deterministic UI/tests. */
  asOf?: string;
  staleAfterDays?: number;
};

export type TradingRoomHoldingRow = {
  row: DashboardRow;
  instrumentId: string;
  instrumentName: string;
  symbol: string;
  market: string;
  marketLabel: string;
  accountId: string;
  accountLabel: string;
  episodeId: string;
  settlementCurrency: string | null;
  latestTradeDate: string | null;
  sourceNature: RoomTradeNature;
  simulationRunId: string | null;
  assetCategory: TradingRoomAssetProjection["category"];
  assetType: TradingRoomAssetProjection["assetType"];
  assetReason: string | null;
  lastActivityAt: string;
  position: PositionLedgerSnapshot | null;
  quantity: string | null;
  quantityStatus: TradingRoomHoldingValueStatus;
  averageCost: string | null;
  costStatus: TradingRoomHoldingValueStatus;
  quote: TradingRoomQuote | null;
  quoteStatus: TradingRoomHoldingValueStatus;
  unrealizedPnl: string | null;
  unrealizedPnlStatus: TradingRoomHoldingValueStatus;
  statusReason: string | null;
  direction: TradingRoomHoldingDirection;
  positionEvidence: TradingRoomHoldingPositionEvidence;
  diagnostic: TradingRoomHoldingDiagnostic;
};

export type TradingRoomHoldingGroup = {
  market: string;
  label: string;
  rows: TradingRoomHoldingRow[];
};

export type TradingRoomHoldingsModel = {
  scope: RoomScope;
  asOf: string;
  latestImportedTradeDate: string | null;
  rows: TradingRoomHoldingRow[];
  groups: TradingRoomHoldingGroup[];
  availablePnlCount: number;
  unavailablePnlCount: number;
};

function canonicalMarket(value: string): string {
  const market = value.trim().toUpperCase();
  if (["CN", "CN-SH", "SH", "SSE"].includes(market)) return "CN-SH";
  if (["CN-SZ", "SZ", "SZSE"].includes(market)) return "CN-SZ";
  return market;
}

function marketLabel(market: string): string {
  switch (market) {
    case "CN-SH": return "A股·沪市";
    case "CN-SZ": return "A股·深市";
    case "HK": return "港股";
    case "US": return "美股";
    default: return market || "市场未知";
  }
}

function currencyCode(value: string | null | undefined): string {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency === "人民币" || currency === "RMB") return "CNY";
  if (currency === "港币" || currency === "HK$") return "HKD";
  if (currency === "美元" || currency === "US$") return "USD";
  return currency;
}

function numeric(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === "") return false;
  try {
    return new Decimal(value).isFinite();
  } catch {
    return false;
  }
}

function positiveNumeric(value: string | null | undefined): boolean {
  if (!numeric(value)) return false;
  try {
    return new Decimal(value!).gt(0);
  } catch {
    return false;
  }
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[0]
    ? match[0]
    : null;
}

function shanghaiDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? roomTodayKey(parsed) : null;
}

function dayDistance(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((end - start) / 86_400_000);
}

function quoteFreshness(
  quoteDate: string | null,
  asOf: string,
  staleAfterDays: number,
  supplied: TradingRoomQuoteFreshness,
): TradingRoomQuoteFreshness {
  if (!quoteDate) return supplied;
  const age = dayDistance(quoteDate, asOf);
  if (age !== null && age < 0) return "future";
  if (supplied === "future") return "future";
  if (supplied === "stale" || (age !== null && age > staleAfterDays)) return "stale";
  return "current";
}

function normalizeQuote(
  value: TradingRoomQuote | undefined,
  asOf: string,
  staleAfterDays: number,
): TradingRoomQuote | null {
  if (!value || !value.currency.trim()) return null;
  const quoteDate = dateOnly(value.quoteDate);
  return {
    ...value,
    currency: currencyCode(value.currency),
    price: value.price && positiveNumeric(value.price) ? value.price : null,
    quoteDate,
    fetchedAt: value.fetchedAt || null,
    provider: value.provider || null,
    freshness: quoteFreshness(quoteDate, asOf, staleAfterDays, value.freshness),
  };
}

function quoteFromCandle(
  candle: DailyCandleRecord | undefined,
  asOf: string,
  staleAfterDays: number,
): TradingRoomQuote | null {
  if (!candle) return null;
  const quoteDate = dateOnly(candle.tradingDate);
  if (!quoteDate) return null;
  return {
    price: positiveNumeric(candle.close) ? candle.close : null,
    currency: currencyCode(candle.currency),
    quoteDate,
    fetchedAt: candle.fetchedAt,
    provider: candle.provider,
    freshness: quoteFreshness(quoteDate, asOf, staleAfterDays, "current"),
  };
}

function latestCandle(candles: readonly DailyCandleRecord[] | undefined): DailyCandleRecord | undefined {
  return [...(candles ?? [])]
    .filter(candle => Boolean(candle.tradingDate))
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate))
    .at(-1);
}

function quoteFromProjection(
  projection: TradeLibraryQuoteProjection | undefined,
): TradingRoomQuote | null {
  if (!projection) return null;
  return {
    price: projection.price,
    currency: projection.currency,
    quoteDate: projection.quoteDate,
    fetchedAt: projection.fetchedAt,
    provider: projection.provider,
    freshness: "current",
  };
}

function quoteFor(
  row: DashboardRow,
  options: TradingRoomHoldingsOptions,
  asOf: string,
  staleAfterDays: number,
): TradingRoomQuote | null {
  const instrumentId = row.item.episode.instrument.id;
  const explicit = normalizeQuote(options.quotesByInstrument?.[instrumentId], asOf, staleAfterDays);
  if (explicit) return explicit;
  const candle = quoteFromCandle(
    latestCandle(options.candlesByInstrument?.[instrumentId]),
    asOf,
    staleAfterDays,
  );
  if (candle) return candle;
  return normalizeQuote(quoteFromProjection(row.entry.latestQuote) ?? undefined, asOf, staleAfterDays);
}

function expectedSettlementCurrencies(row: DashboardRow): string[] {
  const executions = row.item.episode.executions;
  const currencies = executions.length > 0
    ? executions.map(executionSettlementCurrency)
    : [row.item.episode.instrument.currency];
  return [...new Set(currencies.map(currencyCode).filter(Boolean))];
}

function settlementCurrencyFor(row: DashboardRow): string | null {
  const currencies = expectedSettlementCurrencies(row);
  return currencies.length === 1 ? currencies[0] : null;
}

function latestSourceTradingDate(row: DashboardRow): string | null {
  const market = row.item.episode.instrument.market;
  const dates = row.item.episode.executions
    .map(execution => [
      execution.source.tradingDate,
      execution.source.marketCalendarDate,
      marketTradingDate(execution.executedAt, market),
    ].map(dateOnly).find((value): value is string => value !== null))
    .filter((value): value is string => value !== undefined);
  return dates.sort().at(-1) ?? shanghaiDateOnly(row.item.episode.startedAt);
}

function quoteMatchesHolding(row: DashboardRow, quote: TradingRoomQuote | null): boolean {
  if (!quote) return false;
  const settlementCurrency = settlementCurrencyFor(row);
  return settlementCurrency !== null && settlementCurrency === currencyCode(quote.currency);
}

function quoteIsAfterLatestExecution(row: DashboardRow, quote: TradingRoomQuote | null): boolean {
  const latestTradeDate = latestSourceTradingDate(row);
  return Boolean(quote?.quoteDate && latestTradeDate && quote.quoteDate >= latestTradeDate);
}

function lastActivity(row: DashboardRow): string {
  return row.item.episode.executions
    .map(execution => execution.executedAt)
    .sort()
    .at(-1) ?? row.item.episode.startedAt;
}

function derivePosition(
  row: DashboardRow,
  quote: TradingRoomQuote | null,
  explicit: PositionLedgerSnapshot | undefined,
): PositionLedgerSnapshot | null {
  const episode = row.item.episode;
  if (episode.executions.length === 0) return null;
  const replayed = replayEvidencePosition(row, quote);
  if (explicit) {
    const preserved = preserveEpisodeAccuracy({
      ...explicit,
      ...(replayed?.accuracy ? {
        accuracy: {
          pnl: "unavailable" as const,
          reasons: [...new Set([...(explicit.accuracy?.reasons ?? []), ...replayed.accuracy.reasons])],
        },
      } : {}),
      ...(replayed?.quantityKnown === false ? { quantityKnown: false as const } : {}),
      ...(replayed?.warnings ? { warnings: replayed.warnings } : {}),
    }, episode);
    return refreshPositionAtQuote(preserved, quote);
  }
  return replayed ? refreshPositionAtQuote(replayed, quote) : replayed;
}

function refreshPositionAtQuote(position: PositionLedgerSnapshot, quote: TradingRoomQuote | null): PositionLedgerSnapshot {
  if (!quote?.price || position.quantityKnown === false || position.costKnown === false || position.accuracy) return position;
  try {
    const quantity = new Decimal(position.quantity);
    const averageCost = new Decimal(position.averageCost);
    const price = new Decimal(quote.price);
    const unrealizedPnl = quantity.mul(price.minus(averageCost));
    const netPnl = new Decimal(position.realizedPnl).plus(unrealizedPnl).minus(new Decimal(position.fees));
    return {
      ...position,
      unrealizedPnl: unrealizedPnl.toDecimalPlaces(8).toString(),
      netPnl: netPnl.toDecimalPlaces(8).toString(),
    };
  } catch {
    return position;
  }
}

function replayEvidencePosition(
  row: DashboardRow,
  quote: TradingRoomQuote | null,
): PositionLedgerSnapshot | null {
  const episode = row.item.episode;
  try {
    // The ledger establishes quantity/cost from source evidence. When a quote
    // is absent, zero is only a non-displayed mark; no PnL from this mark is
    // exposed to the user.
    const executions = episode.executions.map((execution, index) => index === 0
      ? {
        ...execution,
        source: {
          ...execution.source,
          ...(episode.initialPosition && !execution.source.openingPosition
            ? { openingPosition: episode.initialPosition }
            : {}),
          ...(episode.positionEvents?.length
            ? { positionEvents: [...(execution.source.positionEvents ?? []), ...episode.positionEvents] }
            : {}),
        },
      }
      : execution);
    return preserveEpisodeAccuracy(replayPositionAtPrice({
      executions,
      markPrice: quote?.price ?? "0",
    }), episode);
  } catch {
    return null;
  }
}

function preserveEpisodeAccuracy(
  position: PositionLedgerSnapshot,
  episode: TradeEpisode,
): PositionLedgerSnapshot {
  const reasons = new Set([
    ...(position.accuracy?.reasons ?? []),
    ...(episode.accuracy?.reasons ?? []),
    ...episode.executions.flatMap(execution => [
      ...(execution.source.feeStatus === "unknown" ? ["unknown-fees"] : []),
      ...(execution.source.historyIncomplete?.length ? ["history-incomplete"] : []),
      ...(execution.source.settlement?.currency && currencyCode(execution.source.settlement.currency) !== currencyCode(execution.instrument.currency)
        ? ["settlement-currency-mismatch"]
        : []),
    ]),
  ]);
  const quantityKnown = episode.directionKnown === false || position.quantityKnown === false
    ? false as const
    : undefined;
  return {
    ...position,
    ...(reasons.size ? {
      costKnown: false as const,
      accuracy: { pnl: "unavailable" as const, reasons: [...reasons] },
    } : {}),
    ...(quantityKnown === false ? { quantityKnown } : {}),
    ...(episode.warnings?.length ? {
      warnings: [...(position.warnings ?? []), ...episode.warnings],
    } : {}),
  };
}

function negativeStatementPosition(position: StatementPosition | undefined): boolean {
  if (!position || position.phase !== "opening") return false;
  try {
    return new Decimal(position.quantity).lt(0);
  } catch {
    return false;
  }
}

function positionEvidenceFor(
  row: DashboardRow,
  position: PositionLedgerSnapshot | null,
): TradingRoomHoldingPositionEvidence {
  const episode = row.item.episode;
  const executions = episode.executions;
  const sourceFormatRuleIds = [...new Set(
    executions
      .map(execution => execution.source.formatRuleId)
      .filter((value): value is string => Boolean(value)),
  )];
  const hasExplicitOpenShort = executions.some(execution =>
    execution.source.positionEffect === "open-short" &&
    execution.source.positionEffectEvidence?.kind !== "inferred",
  );
  const hasNegativeOpeningPosition = Boolean(
    negativeStatementPosition(episode.initialPosition) ||
      executions.some(execution =>
        negativeStatementPosition(execution.source.openingPosition) ||
        (execution.source.statementPositions ?? []).some(negativeStatementPosition)),
  );
  if (!position || position.quantityKnown === false) {
    return {
      status: "unavailable",
      summary: "持仓证据不足，方向待核对",
      missing: ["positionEffect", "openingPosition", "statementPositions"],
      sourceFormatRuleIds,
    };
  }
  let quantity: Decimal;
  try {
    quantity = new Decimal(position.quantity);
  } catch {
    return {
      status: "unavailable",
      summary: "持仓证据不足，方向待核对",
      missing: ["positionEffect", "openingPosition", "statementPositions"],
      sourceFormatRuleIds,
    };
  }
  if (quantity.gt(0)) {
    return {
      status: "verified-long",
      summary: "成交证据支持当前多头数量",
      missing: [],
      sourceFormatRuleIds,
    };
  }
  if (quantity.lt(0) && (hasExplicitOpenShort || hasNegativeOpeningPosition)) {
    return {
      status: "verified-short",
      summary: hasExplicitOpenShort
        ? "成交证据明确标记开空"
        : "来源持仓证据包含可信期初负仓",
      missing: [],
      sourceFormatRuleIds,
    };
  }
  if (quantity.lt(0)) {
    const missing = [
      "positionEffect",
      "openingPosition",
      "statementPositions",
      ...(executions.some(execution => execution.source.statementMonth) ? [] : ["statementMonth"]),
      ...(executions.some(execution => execution.source.templateId) ? [] : ["templateId"]),
    ];
    const ruleDetail = sourceFormatRuleIds.length > 0
      ? `；来源规则 ${sourceFormatRuleIds.join("、")}`
      : "";
    return {
      status: "unverified-negative",
      summary: `负仓差额待核对：成交证据未证明开空或可信期初负仓${ruleDetail}`,
      missing,
      sourceFormatRuleIds,
    };
  }
  return {
    status: "unavailable",
    summary: "持仓证据不足，方向待核对",
    missing: ["positionEffect", "openingPosition", "statementPositions"],
    sourceFormatRuleIds,
  };
}

function reasonFor(
  position: PositionLedgerSnapshot | null,
  positionEvidence: TradingRoomHoldingPositionEvidence,
  quote: TradingRoomQuote | null,
  quoteStatus: TradingRoomHoldingValueStatus,
  settlementCurrency: string | null,
  quoteReason?: string | null,
  marketDataReason?: string | null,
): string | null {
  if (positionEvidence.status === "unverified-negative") return positionEvidence.summary;
  if (!position) return "持仓证据不足，数量与成本待核对";
  if (position.quantityKnown === false) return "持仓数量待核对";
  if (position.costKnown === false || position.accuracy) return "可用成本待核对";
  if (settlementCurrency === null) return "结算币种不明确，成本与浮盈亏待核对";
  if (marketDataReason) return marketDataReason;
  if (quoteReason) return quoteReason;
  if (quoteStatus === "missing") return "缺少行情，无法计算浮盈亏";
  if (quoteStatus === "stale") return "行情已过期，无法计算当前浮盈亏";
  if (!quote || quote.price === null) return "行情价格无效，无法计算浮盈亏";
  return null;
}

function directionFor(
  row: DashboardRow,
  position: PositionLedgerSnapshot | null,
  positionEvidence: TradingRoomHoldingPositionEvidence,
): TradingRoomHoldingDirection {
  if (positionEvidence.status === "verified-short") return "short";
  if (positionEvidence.status === "unverified-negative") return "unknown";
  if (!position || position.quantityKnown === false || row.item.episode.directionKnown === false) return "unknown";
  try {
    const quantity = new Decimal(position.quantity);
    if (quantity.lt(0)) return "unknown";
    if (quantity.gt(0)) return "long";
  } catch {
    return "unknown";
  }
  // A zero position is not an open short. Do not let the episode's historical
  // direction relabel a currently non-negative holding after it was closed.
  return "unknown";
}

function diagnosticFor(
  position: PositionLedgerSnapshot | null,
  positionEvidence: TradingRoomHoldingPositionEvidence,
  quote: TradingRoomQuote | null,
  quoteStatus: TradingRoomHoldingValueStatus,
  settlementCurrency: string | null,
  quoteReason: string | null,
  marketDataDiagnostic: TradingRoomMarketDataDiagnostic | null,
): TradingRoomHoldingDiagnostic {
  if (positionEvidence.status === "unverified-negative" || positionEvidence.status === "unavailable") return "position-evidence";
  if (!position || position.quantityKnown === false || position.costKnown === false || position.accuracy || settlementCurrency === null) return "position-evidence";
  if (marketDataDiagnostic?.sourceUnsupported) return "source-unsupported";
  if (marketDataDiagnostic?.reason === "行情更新进行中") return "market-data-pending";
  if (marketDataDiagnostic?.reason.startsWith("行情状态读取失败")) return "market-data-storage-error";
  if (marketDataDiagnostic) return "source-unavailable";
  if (quoteReason?.includes("币种")) return "currency-mismatch";
  if (quoteReason?.includes("早于")) return "pre-trade-quote";
  if (quoteReason?.includes("晚于")) return "future-quote";
  if (quoteStatus === "missing") return "missing-quote";
  if (quoteStatus === "stale") return "stale-quote";
  if (!quote || quote.price === null) return "invalid-quote";
  return "available";
}

function compareRows(left: TradingRoomHoldingRow, right: TradingRoomHoldingRow): number {
  return right.lastActivityAt.localeCompare(left.lastActivityAt)
    || left.instrumentId.localeCompare(right.instrumentId)
    || left.accountId.localeCompare(right.accountId)
    || left.episodeId.localeCompare(right.episodeId);
}

function groupOrder(market: string): number {
  return ["CN-SH", "CN-SZ", "HK", "US"].indexOf(market) === -1
    ? 99
    : ["CN-SH", "CN-SZ", "HK", "US"].indexOf(market);
}

export function buildTradingRoomHoldings(
  entries: readonly TradeLibraryEntry[],
  options: TradingRoomHoldingsOptions,
): TradingRoomHoldingsModel {
  const asOf = options.asOf ?? new Date().toISOString();
  const asOfDate = shanghaiDateOnly(asOf) ?? roomTodayKey(new Date());
  const staleAfterDays = options.staleAfterDays ?? 3;
  const metadata = normalizeRoomMetadata(options.instrumentMetadata);
  const selectedRows = filterRoomRows(entries, options.scope, {
    ignorePerformanceDates: true,
    instrumentMetadata: metadata,
  });
  const rows = selectedRows.map(row => {
    const episode = row.item.episode;
    const projection = classifyTradingRoomAsset(episode.instrument, metadata.get(episode.instrument.id));
    const quote = quoteFor(row, options, asOfDate, staleAfterDays);
    const settlementCurrency = settlementCurrencyFor(row);
    const latestTradeDate = latestSourceTradingDate(row);
    const quoteReason = quote && !quoteMatchesHolding(row, quote)
      ? settlementCurrency === null
        ? "结算币种不明确，无法计算浮盈亏"
        : "行情币种与结算币种不一致，无法计算浮盈亏"
      : quote && !quoteIsAfterLatestExecution(row, quote)
        ? "行情早于最近一笔交易，无法计算浮盈亏"
        : quote?.freshness === "future"
          ? "行情日期晚于当前截点，无法计算浮盈亏"
          : null;
    const marketDataStatus = options.marketDataDailyStatuses?.[episode.instrument.id]
      ?? options.marketDataStatuses?.[episode.instrument.id];
    const hasMarketDataDiagnosticInput = marketDataStatus !== undefined ||
      options.marketDataLabels?.[episode.instrument.id] !== undefined ||
      options.marketDataJobs?.[episode.instrument.id] !== undefined;
    const marketDataDiagnostic = (quote?.price === null || !quote) && hasMarketDataDiagnosticInput
      ? diagnoseTradingRoomMarketData(
        marketDataStatus,
        options.marketDataLabels?.[episode.instrument.id],
        options.marketDataJobs?.[episode.instrument.id],
      )
      : null;
    const quoteStatus: TradingRoomHoldingValueStatus = quote
      ? quoteReason || quote.price === null ? "unavailable" : quote.freshness === "stale" ? "stale" : "available"
      : "missing";
    const position = derivePosition(row, quote, options.positionSnapshotsByEpisode?.[episode.id]);
    const positionEvidence = positionEvidenceFor(row, position);
    const quantityUnavailable = !position || position.quantityKnown === false;
    const costUnavailable = !position || position.costKnown === false || Boolean(position.accuracy) || settlementCurrency === null || positionEvidence.status === "unverified-negative";
    const pnlUnavailable = quantityUnavailable || costUnavailable || quoteStatus !== "available";
    const pnlStatus: TradingRoomHoldingValueStatus = pnlUnavailable
      ? !position || quantityUnavailable || costUnavailable || quoteStatus === "unavailable" ? "unavailable" : quoteStatus
      : "available";
    return {
      row,
      instrumentId: episode.instrument.id,
      instrumentName: episode.instrument.name,
      symbol: episode.instrument.symbol,
      market: canonicalMarket(episode.instrument.market),
      marketLabel: marketLabel(canonicalMarket(episode.instrument.market)),
      accountId: episode.accountId,
      accountLabel: episode.accountLabel,
      episodeId: episode.id,
      settlementCurrency,
      latestTradeDate,
      sourceNature: dashboardEpisodeNature(row),
      simulationRunId: dashboardEpisodeSimulationRunId(row),
      assetCategory: projection.category,
      assetType: projection.assetType,
      assetReason: projection.reason,
      lastActivityAt: lastActivity(row),
      position,
      quantity: quantityUnavailable ? null : position.quantity,
      quantityStatus: quantityUnavailable ? "unavailable" : "available",
      averageCost: costUnavailable ? null : position.averageCost,
      costStatus: costUnavailable ? "unavailable" : "available",
      quote,
      quoteStatus,
      unrealizedPnl: pnlUnavailable ? null : position.unrealizedPnl,
      unrealizedPnlStatus: pnlStatus,
      statusReason: reasonFor(position, positionEvidence, quote, pnlStatus === "stale" ? "stale" : quoteStatus, settlementCurrency, quoteReason, marketDataDiagnostic?.reason),
      direction: directionFor(row, position, positionEvidence),
      positionEvidence,
      diagnostic: diagnosticFor(position, positionEvidence, quote, quoteStatus, settlementCurrency, quoteReason, marketDataDiagnostic),
    } satisfies TradingRoomHoldingRow;
  }).sort(compareRows);
  const groups = [...new Set(rows.map(row => row.market))]
    .sort((left, right) => groupOrder(left) - groupOrder(right) || left.localeCompare(right))
    .map(market => ({
      market,
      label: marketLabel(market),
      rows: rows.filter(row => row.market === market),
    }));
  return {
    scope: options.scope,
    asOf: asOfDate,
    latestImportedTradeDate: rows.map(row => row.latestTradeDate).filter((value): value is string => value !== null).sort().at(-1) ?? null,
    rows,
    groups,
    availablePnlCount: rows.filter(row => row.unrealizedPnlStatus === "available").length,
    unavailablePnlCount: rows.filter(row => row.unrealizedPnlStatus !== "available").length,
  };
}
