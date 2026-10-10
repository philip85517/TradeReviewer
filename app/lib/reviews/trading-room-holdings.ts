import Decimal from "decimal.js";

import type { DailyCandleRecord, SupportedMarket } from "../market/contracts";
import { latestCompletedSessionAt, valuationInstantAt } from "../market/sync-range";
import { marketTimeZone, marketTradingDate } from "../market/trading-date";
import type { MarketDataSyncStatus } from "../market/sync-status";
import { replayPositionAtPrice, type PositionLedgerSnapshot } from "../replay/position-ledger";
import { canonicalInstrumentId } from "../instruments/display-name";
import { replayExecutionAt, statementPositionAt, statementEventAt } from "../import/statement-evidence";
import type { StatementPosition } from "../import/monthly-statement";
import { isBonusShareEvidence } from "../trades/bonus-share-evidence";
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
import { executionSettlementCurrency, type TradeEpisode, type TradeExecution } from "../trades/types";

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
  const parsedTo = dateOnly(to) ? null : new Date(to);
  if (parsedTo && !Number.isFinite(parsedTo.getTime())) return null;
  const endDate = dateOnly(to) ?? parsedTo!.toISOString().slice(0, 10);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((end - start) / 86_400_000);
}

function quoteFreshness(
  quoteDate: string | null,
  asOf: string,
  _staleAfterDays: number,
  supplied: TradingRoomQuoteFreshness,
): TradingRoomQuoteFreshness {
  if (!quoteDate) return supplied;
  const age = dayDistance(quoteDate, asOf);
  if (age !== null && age < 0) return "future";
  if (supplied === "future") return "future";
  if (supplied === "stale") return "stale";
  // Natural calendar age is not a validity rule. Session closure and missing
  // expected sessions are evaluated against the market-local cutoff below.
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

function expectedSettlementCurrencies(row: DashboardRow, asOf?: string): string[] {
  const market = row.item.episode.instrument.market;
  const executions = asOf ? row.item.episode.executions.filter(execution => executionAtOrBefore(execution, asOf, market)) : row.item.episode.executions;
  const currencies = executions.length > 0
    ? executions.map(executionSettlementCurrency)
    : [row.item.episode.instrument.currency];
  return [...new Set(currencies.map(currencyCode).filter(Boolean))];
}

function settlementCurrencyFor(row: DashboardRow, asOf?: string): string | null {
  const currencies = expectedSettlementCurrencies(row, asOf);
  return currencies.length === 1 ? currencies[0] : null;
}

function latestSourceTradingDate(row: DashboardRow, asOf?: string): string | null {
  const market = row.item.episode.instrument.market;
  const dates = row.item.episode.executions
    .filter(execution => !asOf || executionAtOrBefore(execution, asOf, market))
    .map(execution => [
      execution.source.tradingDate,
      execution.source.marketCalendarDate,
      marketTradingDate(execution.executedAt, market),
    ].map(dateOnly).find((value): value is string => value !== null))
    .filter((value): value is string => value !== undefined);
  return dates.sort().at(-1) ?? shanghaiDateOnly(row.item.episode.startedAt);
}

function quoteMatchesHolding(row: DashboardRow, quote: TradingRoomQuote | null, asOf?: string): boolean {
  if (!quote) return false;
  const settlementCurrency = settlementCurrencyFor(row, asOf);
  return settlementCurrency !== null && settlementCurrency === currencyCode(quote.currency);
}

function quoteIsAfterLatestExecution(row: DashboardRow, quote: TradingRoomQuote | null, asOf?: string): boolean {
  const latestTradeDate = latestSourceTradingDate(row, asOf);
  return Boolean(quote?.quoteDate && latestTradeDate && quote.quoteDate >= latestTradeDate);
}

function quoteSessionReason(
  row: DashboardRow,
  quote: TradingRoomQuote | null,
  asOf: string,
): string | null {
  if (!quote?.quoteDate) return null;
  const market = canonicalMarket(row.item.episode.instrument.market) as SupportedMarket;
  if (!["CN-SH", "CN-SZ", "HK", "US"].includes(market)) return null;
  let cutoff: ReturnType<typeof latestCompletedSessionAt>;
  try {
    cutoff = latestCompletedSessionAt(market, asOf);
  } catch {
    return "无法确认市场已完成交易时段，无法计算当前浮盈亏";
  }
  if (quote.quoteDate > cutoff.session) return "行情日期晚于当前已完成交易时段";
  if (quote.quoteDate < cutoff.session) return "缺少最近已完成交易时段行情，无法计算当前浮盈亏";
  // A same-session daily bar fetched before the close may still be rolling.
  const fetchedSession = quote.fetchedAt ? marketTradingDate(quote.fetchedAt, market) : null;
  if (fetchedSession === quote.quoteDate && Date.parse(quote.fetchedAt!) < Date.parse(cutoff.sessionCloseAt)) {
    return "同日行情尚未经过市场收盘，无法计算当前浮盈亏";
  }
  const latestExecution = row.item.episode.executions
    .filter(execution => executionAtOrBefore(execution, asOf, market))
    .map(execution => ({ raw: execution.executedAt, date: marketTradingDate(execution.executedAt, market) }))
    .filter(value => Number.isFinite(Date.parse(value.raw)))
    .sort((left, right) => Date.parse(left.raw) - Date.parse(right.raw))
    .at(-1);
  if (latestExecution && quote.quoteDate === latestExecution.date && quote.fetchedAt && Date.parse(latestExecution.raw) > Date.parse(cutoff.sessionCloseAt) && Date.parse(quote.fetchedAt) < Date.parse(latestExecution.raw)) {
    return "行情获取时间早于最近成交，无法计算当前浮盈亏";
  }
  return null;
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
  asOfCutoff: string,
): PositionLedgerSnapshot | null {
  const episode = row.item.episode;
  const replayed = replayEvidencePosition(row, quote, asOfCutoff);
  // External snapshots cannot establish identity for an evidence-free episode.
  const admittedExecutions = episode.executions.filter(execution => executionAtOrBefore(execution, asOfCutoff, episode.instrument.market));
  if (admittedExecutions.length === 0) return replayed;
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
    }, episode, admittedExecutions);
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

function admittedPosition(position: StatementPosition | undefined, episode: TradeEpisode, asOfCutoff: string): position is StatementPosition {
  if (!position || position.accountId !== episode.accountId ||
    canonicalInstrumentId(position.symbol, position.market) !== canonicalInstrumentId(episode.instrument.symbol, episode.instrument.market)) return false;
  try {
    if (position.date.length === 10) {
      const cutoffDate = marketTradingDate(asOfCutoff, episode.instrument.market);
      if (position.date < cutoffDate) return true;
      if (position.date > cutoffDate) return false;
      if (position.phase === "opening") return true;
    }
    const positionAt = statementPositionAt(position);
    const positionTime = Date.parse(positionAt);
    const cutoffTime = Date.parse(marketLocalCursor(asOfCutoff, episode.instrument.market));
    return Number.isFinite(positionTime) && Number.isFinite(cutoffTime) && positionTime <= cutoffTime;
  } catch {
    return false;
  }
}

/**
 * Evidence timestamps are statement-local clocks, while execution cutoffs
 * are absolute instants. Compare both on the market-local pseudo timeline so
 * a same-day closing statement is visible at a date-only cutoff but remains
 * hidden before the close for an intraday cutoff.
 */
function marketLocalCursor(asOfCutoff: string, market: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOfCutoff)) return `${asOfCutoff}T23:59:59.999Z`;
  const timestamp = Date.parse(asOfCutoff);
  if (!Number.isFinite(timestamp)) return asOfCutoff;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: marketTimeZone(market),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp))
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond ?? "000"}Z`;
}

function replayExecutionAtLocal(execution: TradeExecution, market: string): string {
  if (execution.executedAt.length === 10 || execution.source.timePrecision === "date-only") {
    return marketTradingDate(execution.executedAt, market);
  }
  const instant = new Date(execution.executedAt);
  if (!Number.isFinite(instant.getTime())) return execution.executedAt;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: marketTimeZone(market),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${instant.getUTCMilliseconds().toString().padStart(3, "0")}Z`;
}

function replayTradeDateBefore(date: string): string {
  const at = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return date;
  return new Date(at - 86_400_000).toISOString().slice(0, 10);
}

function executionAtOrBefore(execution: TradeExecution, asOfCutoff: string, market: string): boolean {
  const sourceDateOnly = execution.source.timePrecision === "date-only";
  if (execution.executedAt.length === 10 || sourceDateOnly) {
    // Use the shared replay ordering so source market-calendar/trading-date
    // precedence and the verified session-open/open-long exception remain
    // identical to ledger replay. Compare that pseudo-local date boundary to
    // the market-local absolute cutoff; timestamp formatting cannot signal
    // whether an input was date-only.
    const executionAt = Date.parse(replayExecutionAt(execution));
    const cutoffAt = Date.parse(marketLocalCursor(asOfCutoff, market));
    return Number.isFinite(executionAt) && Number.isFinite(cutoffAt) && executionAt <= cutoffAt;
  }
  const executionAt = Date.parse(execution.executedAt);
  const cutoffAt = Date.parse(asOfCutoff);
  return Number.isFinite(executionAt) && Number.isFinite(cutoffAt) && executionAt <= cutoffAt;
}

/** Date-only statement evidence is known at its statement boundary, never at
 * the start of the calendar day. This keeps transfer markers from making a
 * same-day receipt visible to an intraday valuation. */
function evidenceEventAtOrBefore(event: Parameters<typeof statementEventAt>[0], asOfCutoff: string, market: string): boolean {
  const eventAt = Date.parse(statementEventAt(event));
  const cutoffAt = Date.parse(marketLocalCursor(asOfCutoff, market));
  return Number.isFinite(eventAt) && Number.isFinite(cutoffAt) && eventAt <= cutoffAt;
}

function replayEvidencePosition(
  row: DashboardRow,
  quote: TradingRoomQuote | null,
  asOfCutoff: string,
): PositionLedgerSnapshot | null {
  const episode = row.item.episode;
  try {
    if (episode.executions.length === 0) {
      if (dashboardEpisodeNature(row) === "simulation") return null;
      const matches = (item: { accountId: string; symbol?: string; market?: string }) =>
        item.accountId === episode.accountId && Boolean(item.symbol && item.market &&
          canonicalInstrumentId(item.symbol, item.market) === canonicalInstrumentId(episode.instrument.symbol, episode.instrument.market));
      const cursor = marketLocalCursor(asOfCutoff, episode.instrument.market);
      const positions = admittedPosition(episode.initialPosition, episode, asOfCutoff)
        ? [episode.initialPosition] : [];
      const events = (episode.positionEvents ?? []).filter(event => {
        if (!matches(event)) return false;
        return evidenceEventAtOrBefore(event, asOfCutoff, episode.instrument.market);
      });
      // No admitted inventory evidence means unknown, never the ledger compatibility zero.
      const hasInventoryEvent = events.some(event => ["transfer-in", "transfer-out"].includes(event.kind) || event.kind === "ipo" && event.quantity !== undefined || isBonusShareEvidence(event));
      if (!positions.length && !hasInventoryEvent || events.some(event => event.kind === "corporate-action" && !isBonusShareEvidence(event))) return null;
      return preserveEpisodeAccuracy(replayPositionAtPrice({
        executions: [], markPrice: quote?.price ?? "0", cursor,
        inventoryIdentity: { accountId: episode.accountId, symbol: episode.instrument.symbol, market: episode.instrument.market },
        evidence: [{ positions, events }],
      }), episode);
    }
    // The ledger establishes quantity/cost from source evidence. When a quote
    // is absent, zero is only a non-displayed mark; no PnL from this mark is
    // exposed to the user.
    const admittedExecutions = episode.executions.filter(execution => executionAtOrBefore(execution, asOfCutoff, episode.instrument.market));
    // A row whose entire execution ledger is in the future has no admitted
    // inventory. Preserve unknown rather than manufacturing a zero position.
    if (!admittedExecutions.length) return null;
    const executions = admittedExecutions.map((execution, index) => ({
      ...execution,
      // replayPositionAtPrice intentionally uses a local pseudo clock for
      // statement evidence. Keep exact admission above, then convert every
      // admitted execution into that same clock without changing settlement
      // or fee metadata used by the ledger.
      executedAt: replayExecutionAtLocal(execution, episode.instrument.market),
      source: {
        ...execution.source,
        // Episode-level bonus evidence is a settled statement event. Keep it
        // after the admitted fill in the replay ordering when both carry the
        // same market date; the original execution metadata remains untouched
        // for exact admission and audit fields.
        ...(index === 0 && (episode.positionEvents ?? []).some(event =>
          isBonusShareEvidence(event) && event.date === marketTradingDate(execution.executedAt, episode.instrument.market),
        )
          ? { tradingDate: replayTradeDateBefore(marketTradingDate(execution.executedAt, episode.instrument.market)) }
          : {}),
        ...(execution.source.positionEvents
          ? { positionEvents: execution.source.positionEvents.filter(event => evidenceEventAtOrBefore(event, asOfCutoff, episode.instrument.market)) }
          : {}),
        ...(index === 0 && episode.initialPosition && !execution.source.openingPosition
          ? { openingPosition: episode.initialPosition }
          : {}),
        ...(index === 0 && episode.positionEvents?.length
          ? { positionEvents: [...(execution.source.positionEvents ?? []).filter(event => evidenceEventAtOrBefore(event, asOfCutoff, episode.instrument.market)), ...episode.positionEvents.filter(event => evidenceEventAtOrBefore(event, asOfCutoff, episode.instrument.market))] }
          : {}),
      },
    }));
    return preserveEpisodeAccuracy(replayPositionAtPrice({
      executions,
      markPrice: quote?.price ?? "0",
      cursor: marketLocalCursor(asOfCutoff, episode.instrument.market),
    }), episode, admittedExecutions);
  } catch {
    return null;
  }
}

function preserveEpisodeAccuracy(
  position: PositionLedgerSnapshot,
  episode: TradeEpisode,
  admittedExecutions = episode.executions,
): PositionLedgerSnapshot {
  const reasons = new Set([
    ...(position.accuracy?.reasons ?? []),
    ...(admittedExecutions.length === episode.executions.length ? (episode.accuracy?.reasons ?? []) : []),
    ...admittedExecutions.flatMap(execution => [
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
    ...(admittedExecutions.length === episode.executions.length && episode.warnings?.length ? {
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
  asOfCutoff: string,
): TradingRoomHoldingPositionEvidence {
  const episode = row.item.episode;
  const executions = episode.executions.filter(execution => executionAtOrBefore(execution, asOfCutoff, episode.instrument.market));
  const sourceFormatRuleIds = [...new Set(
    executions
      .map(execution => execution.source.formatRuleId)
      .filter((value): value is string => Boolean(value)),
  )];
  const hasExplicitOpenShort = executions.some(execution =>
    execution.source.positionEffect === "open-short" &&
    execution.source.positionEffectEvidence?.kind !== "inferred",
  );
  const admittedNegativeOpening = (position: StatementPosition | undefined) =>
    dashboardEpisodeNature(row) !== "simulation" && admittedPosition(position, episode, asOfCutoff) && negativeStatementPosition(position);
  const hasNegativeOpeningPosition = Boolean(
    admittedNegativeOpening(episode.initialPosition) ||
      executions.some(execution =>
        admittedNegativeOpening(execution.source.openingPosition) ||
        (execution.source.statementPositions ?? []).some(admittedNegativeOpening)),
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
  if (quoteReason?.includes("缺少最近") || quoteReason?.includes("收盘")) return "stale-quote";
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
    const quote = quoteFor(row, options, asOf, staleAfterDays);
    const settlementCurrency = settlementCurrencyFor(row, asOf);
    const latestTradeDate = latestSourceTradingDate(row, asOf);
    const quoteReason = quote?.price === null
      ? "行情价格无效，无法计算浮盈亏"
      : quote && !quoteMatchesHolding(row, quote, asOf)
      ? settlementCurrency === null
        ? "结算币种不明确，无法计算浮盈亏"
        : "行情币种与结算币种不一致，无法计算浮盈亏"
      : quote && !quoteIsAfterLatestExecution(row, quote, asOf)
        ? "行情早于最近一笔交易，无法计算浮盈亏"
        : quote?.freshness === "future"
          ? "行情日期晚于当前截点，无法计算浮盈亏"
          : null;
    const sessionReason = quoteSessionReason(row, quote, asOf);
    const effectiveQuoteReason = quoteReason ?? sessionReason;
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
      ? effectiveQuoteReason || quote.price === null
        ? (quote.price !== null && (effectiveQuoteReason?.includes("缺少最近已完成") || effectiveQuoteReason?.includes("收盘") || (!quoteReason && quote.freshness === "stale"))) ? "stale" : "unavailable"
        : quote.freshness === "stale" ? "stale" : "available"
      : "missing";
    const normalizedMarket = canonicalMarket(episode.instrument.market);
    const asOfCutoff = ["CN-SH", "CN-SZ", "HK", "US"].includes(normalizedMarket)
      ? valuationInstantAt(normalizedMarket as SupportedMarket, asOf)
      : (Date.parse(asOf) ? new Date(asOf).toISOString() : `${asOfDate}T23:59:59.999Z`);
    const position = derivePosition(row, quote, options.positionSnapshotsByEpisode?.[episode.id], asOfCutoff);
    const positionEvidence = positionEvidenceFor(row, position, asOfCutoff);
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
      statusReason: reasonFor(position, positionEvidence, quote, pnlStatus === "stale" ? "stale" : quoteStatus, settlementCurrency, effectiveQuoteReason, marketDataDiagnostic?.reason),
      direction: directionFor(row, position, positionEvidence),
      positionEvidence,
      diagnostic: diagnosticFor(position, positionEvidence, quote, quoteStatus, settlementCurrency, effectiveQuoteReason, marketDataDiagnostic),
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
