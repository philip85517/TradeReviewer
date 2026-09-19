import Decimal from "decimal.js";

import type { DailyCandleRecord } from "../market/contracts";
import { marketTradingDate } from "../market/trading-date";
import { replayPositionAtPrice, type PositionLedgerSnapshot } from "../replay/position-ledger";
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

export type TradingRoomHoldingsOptions = {
  scope: RoomScope;
  instrumentMetadata?: TradingRoomMetadataInput;
  quotesByInstrument?: Readonly<Record<string, TradingRoomQuote | undefined>>;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
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

function reasonFor(
  position: PositionLedgerSnapshot | null,
  quote: TradingRoomQuote | null,
  quoteStatus: TradingRoomHoldingValueStatus,
  settlementCurrency: string | null,
  quoteReason?: string | null,
): string | null {
  if (!position) return "持仓证据不足，数量与成本待核对";
  if (position.quantityKnown === false) return "持仓数量待核对";
  if (position.costKnown === false || position.accuracy) return "可用成本待核对";
  if (settlementCurrency === null) return "结算币种不明确，成本与浮盈亏待核对";
  if (quoteReason) return quoteReason;
  if (quoteStatus === "missing") return "缺少行情，无法计算浮盈亏";
  if (quoteStatus === "stale") return "行情已过期，无法计算当前浮盈亏";
  if (!quote || quote.price === null) return "行情价格无效，无法计算浮盈亏";
  return null;
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
    const quoteStatus: TradingRoomHoldingValueStatus = quote
      ? quoteReason || quote.price === null ? "unavailable" : quote.freshness === "stale" ? "stale" : "available"
      : "missing";
    const position = derivePosition(row, quote, options.positionSnapshotsByEpisode?.[episode.id]);
    const quantityUnavailable = !position || position.quantityKnown === false;
    const costUnavailable = !position || position.costKnown === false || Boolean(position.accuracy) || settlementCurrency === null;
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
      statusReason: reasonFor(position, quote, pnlStatus === "stale" ? "stale" : quoteStatus, settlementCurrency, quoteReason),
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
