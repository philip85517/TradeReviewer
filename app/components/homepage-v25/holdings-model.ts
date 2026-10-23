import Decimal from "decimal.js";
import { validateInstrumentExchange, type InstrumentExchange } from "../../lib/instruments/metadata-contracts";
import type { HomepageAttachments, HomepageScope } from "../../lib/reviews/homepage-v25-state";
import { buildTradingRoomHoldings, type TradingRoomHoldingRow, type TradingRoomHoldingsOptions } from "../../lib/reviews/trading-room-holdings";
import { roomTodayKey, type RoomFxSnapshot, type RoomScope } from "../../lib/reviews/trading-room-scope";
import { tradeNatureOf } from "../../lib/trades/types";
import { buildTradeLibraryEntries, type TradeLibraryEntry } from "../../lib/trades/library";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildHomepageV25PerformanceFromEntries, type HomepageV25InstrumentResult } from "../../lib/reviews/homepage-v25-performance";
import { replayExecutionAt } from "../../lib/import/statement-evidence";
import { homepageAttachmentEpisodeCoverage, qualifyHomepageAttachmentGroups } from "./attachment-groups";

export type HomepageHolding = TradingRoomHoldingRow & {
  id: string;
  identity: string | null;
  identityReason: string | null;
  days: number | null;
  daysReason: string | null;
  marketValue: string | null;
  reportPnl: string | null;
  reportCurrency: "CNY" | "HKD" | "USD";
  conversionReason: string | null;
  financialEvidence: string;
};

export type HomepageHoldingsOptions = Omit<TradingRoomHoldingsOptions, "scope"> & {
  scope: HomepageScope;
  fxSnapshot?: RoomFxSnapshot;
  exchangeByInstrument?: Readonly<Record<string, InstrumentExchange | undefined>>;
  attachments?: HomepageAttachments;
  reviewSummariesComplete?: boolean;
  symbolInstrumentIds?: readonly string[];
};

function financialReason(reasons: readonly string[]): string | null {
  if (!reasons.length) return null;
  if (reasons.some(reason => reason.startsWith("fx-"))) return "汇率证据不完整或晚于当前截点，无法换算";
  if (reasons.some(reason => reason.includes("quantity") || reason.includes("inventory"))) return "持仓数量证据不足";
  if (reasons.some(reason => reason.includes("quote"))) return "缺少当前截点前已完成的原始日线行情";
  if (reasons.some(reason => reason.includes("fee"))) return "持仓费用归属证据不足，无法计算净浮盈亏";
  return "持仓成本或来源证据不足，暂不能计算";
}

/** The source nature is evidence, rather than a broker-name default. */
export function explicitLiveEntries(entries: readonly TradeLibraryEntry[]): TradeLibraryEntry[] {
  return entries.map(entry => ({
    ...entry,
    episodes: entry.episodes.filter(item => item.episode.executions.length > 0 && item.episode.executions.every(fill => tradeNatureOf(fill) === "live")),
  })).filter(entry => entry.episodes.length > 0);
}

/** Reuse canonical episode construction at the same instant as current finance. */
function currentEntries(entries: readonly TradeLibraryEntry[], asOf: string): TradeLibraryEntry[] {
  const cursor = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(asOf) ? `${asOf}T23:59:59.999+08:00` : asOf);
  const fills = [...new Map(entries.flatMap(entry => entry.executions).map(fill => [fill.id, fill])).values()]
    .filter(fill => {
      const at = Date.parse(fill.source.timePrecision === "date-only" || fill.executedAt.length === 10 ? replayExecutionAt(fill) : fill.executedAt);
      return Number.isFinite(at) && at <= cursor;
    });
  const originals = new Map(entries.map(entry => [entry.instrument.id, entry.instrument]));
  const reviews = Object.fromEntries(entries.flatMap(entry => entry.episodes.flatMap(item => item.review ? [[item.episode.id, item.review]] : [])));
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries(fills), {}, {}, reviews)
    .map(entry => ({ ...entry, instrument: originals.get(entry.instrument.id) ?? entry.instrument }));
}

function holdingsScope(scope: HomepageScope): RoomScope {
  return {
    nature: "live", assetCategory: "all", simulationRunId: null,
    period: { preset: "all", startDate: "", endDate: "" },
    accountIds: scope.accounts.includes("*") ? [] : scope.accounts,
    instrumentIds: [], currencies: [], reviewStatuses: [],
    markets: scope.market === "all" ? [] : scope.market === "a" ? ["CN-SH", "CN-SZ"] : [scope.market.toUpperCase()],
  };
}

export function homepageInstrumentIdentity(instrument: { market: string; symbol: string }, exchange?: InstrumentExchange): string | null {
  let usExchange: InstrumentExchange | undefined;
  if (instrument.market === "US" && exchange) {
    try { usExchange = validateInstrumentExchange(exchange); } catch { /* Historical metadata remains stored but cannot establish identity. */ }
  }
  const code = instrument.market === "CN-SH" ? "SSE" : instrument.market === "CN-SZ" ? "SZSE" : instrument.market === "HK" ? "HKEX" : instrument.market === "US" ? usExchange?.code : undefined;
  return code ? `${code}:${instrument.symbol}` : null;
}
function trustedIdentity(row: TradingRoomHoldingRow, exchange?: InstrumentExchange) {
  const identity = homepageInstrumentIdentity(row, exchange);
  return { identity, identityReason: identity ? null : "交易所证据尚未解析，暂不能定位交易集合" };
}

function holdingAge(row: TradingRoomHoldingRow, asOf: string): { days: number | null; daysReason: string | null } {
  const episode = row.row.item.episode;
  const uncertain = episode.initialPosition || episode.directionKnown === false || episode.executions.length === 0 || episode.executions.some(fill => (fill.source.historyIncomplete?.length ?? 0) > 0);
  const start = new Date(episode.startedAt);
  const end = /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : roomTodayKey(new Date(asOf));
  if (uncertain || !Number.isFinite(start.getTime())) return { days: null, daysReason: "连续持仓起点证据不足" };
  const startDay = roomTodayKey(start);
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) && days >= 0
    ? { days, daysReason: null }
    : { days: null, daysReason: "连续持仓起点晚于当前业务日" };
}

export function buildHomepageHoldings(entries: readonly TradeLibraryEntry[], options: HomepageHoldingsOptions) {
  const { scope, fxSnapshot, attachments = { categories: [], openOnly: false, pendingReview: [] }, reviewSummariesComplete = false, symbolInstrumentIds, ...holdingsOptions } = options;
  const asOf = holdingsOptions.asOf ?? new Date().toISOString();
  const reportCurrency = scope.market === "hk" ? "HKD" : scope.market === "us" ? "USD" : "CNY";
  const current = buildHomepageV25PerformanceFromEntries({ entries, asOf, period: { start: roomTodayKey(new Date(asOf)), end: roomTodayKey(new Date(asOf)) },
    scope: { nature: "live", ...(scope.accounts.includes("*") ? {} : { accountIds: scope.accounts }), ...(scope.market === "all" ? {} : { markets: holdingsScope(scope).markets }) },
    targetCurrency: reportCurrency, candlesByInstrument: options.candlesByInstrument, fxSnapshot, instrumentMetadata: options.instrumentMetadata,
  });
  const selection = qualifyHomepageAttachmentGroups({ entries, scope, attachments, asOf, symbolInstrumentIds,
    instrumentMetadata: options.instrumentMetadata, candlesByInstrument: options.candlesByInstrument,
    episodeCoverage: homepageAttachmentEpisodeCoverage(entries, asOf, reviewSummariesComplete), current });
  const holdings = buildTradingRoomHoldings(explicitLiveEntries(currentEntries(selection.entries, asOf)), { ...holdingsOptions, asOf, scope: holdingsScope(scope) });
  const financeKey = (account: string, instrument: string) => JSON.stringify([account, instrument]);
  const financials = new Map(current.instruments.filter(item => item.identity.nature === "live" && item.identity.simulationRunId === null)
    .map(item => [financeKey(item.identity.accountId, item.identity.instrumentId), item]));
  const multiplicity = new Map<string, number>();
  for (const row of holdings.rows) { const key = financeKey(row.accountId, row.instrumentId); multiplicity.set(key, (multiplicity.get(key) ?? 0) + 1); }
  const rows: HomepageHolding[] = holdings.rows.map(row => {
    const key = financeKey(row.accountId, row.instrumentId);
    // A whole financial group cannot be duplicated across multiple episode rows.
    const finance: HomepageV25InstrumentResult | undefined = multiplicity.get(key) === 1 ? financials.get(key) : undefined;
    const evidence = finance?.evidence.current;
    const selectedQuote = evidence?.quote;
    const quoteAge = selectedQuote ? (Date.parse(`${roomTodayKey(new Date(asOf))}T00:00:00Z`) - Date.parse(`${selectedQuote.date}T00:00:00Z`)) / 86_400_000 : null;
    const stale = quoteAge !== null && quoteAge > (options.staleAfterDays ?? 3);
    const quote = selectedQuote ? { price: selectedQuote.price, quoteDate: selectedQuote.date, currency: selectedQuote.currency, provider: selectedQuote.source,
      fetchedAt: options.candlesByInstrument?.[row.instrumentId]?.find(candle => candle.tradingDate === selectedQuote.date && candle.adjustmentMode === "raw")?.fetchedAt ?? null, freshness: stale ? "stale" as const : "current" as const } : null;
    const statusReason = finance ? financialReason([...finance.currentMarketValue.reasons, ...finance.currentUnrealized.reasons]) ?? (stale ? `行情已陈旧：${selectedQuote?.date} 原始日线` : null) : "同账户证券的多个持仓回合尚无法唯一分配财务证据";
    return {
      ...row, id: JSON.stringify([row.accountId, row.episodeId]),
      quantity: evidence?.quantity ?? null, quantityStatus: evidence?.quantity !== null && evidence?.quantity !== undefined ? "available" : "unavailable",
      averageCost: evidence?.costKnown ? row.averageCost : null, costStatus: evidence?.costKnown && row.averageCost !== null ? "available" : "unavailable",
      quote, quoteStatus: quote?.price !== null && quote?.price !== undefined ? "available" : "missing",
      unrealizedPnl: finance?.currentUnrealized.money.originalByCurrency[row.settlementCurrency ?? ""] ?? null,
      unrealizedPnlStatus: finance?.currentUnrealized.available ? "available" : "unavailable", statusReason,
      ...trustedIdentity(row, options.exchangeByInstrument?.[row.instrumentId]), ...holdingAge(row, asOf),
      financialEvidence: `行情 ${selectedQuote ? `${selectedQuote.date} · ${selectedQuote.source} · 原始日线${stale ? "（陈旧）" : ""}` : "缺失"}；报告币种 ${reportCurrency}；汇率 ${fxSnapshot ? `${fxSnapshot.source} · ${fxSnapshot.asOf.slice(0, 10)} · ${fxSnapshot.status === "complete" ? "已发布" : "覆盖不足"}` : "未提供，同币种无需换算"}`,
      marketValue: finance?.currentMarketValue.value ?? null, reportPnl: finance?.currentUnrealized.value ?? null, reportCurrency,
      conversionReason: finance ? financialReason([...finance.currentMarketValue.reasons, ...finance.currentUnrealized.reasons].filter(reason => reason.startsWith("fx-"))) : statusReason,
    };
  });
  const sum = (values: readonly (string | null)[]) => values.some(value => value === null)
    ? null : values.reduce<Decimal>((total, value) => total.plus(value ?? 0), new Decimal(0)).toString();
  return {
    rows, asOf, reportCurrency, selection,
    uniqueInstrumentCount: new Set(rows.map(row => row.instrumentId)).size,
    totalMarketValue: sum(rows.map(row => row.marketValue)),
    totalUnrealizedPnl: sum(rows.map(row => row.reportPnl)),
    canSortMoney: rows.every(row => row.marketValue !== null && row.reportPnl !== null),
  };
}

export function filterHomepageHoldings(rows: readonly HomepageHolding[], query: string, sort: string): HomepageHolding[] {
  const needle = query.trim().toLocaleLowerCase();
  const direction = sort.endsWith("-desc") ? -1 : 1;
  return rows.filter(row => !needle || [row.instrumentName, row.symbol, row.identity ?? "", row.accountLabel].some(value => value.toLocaleLowerCase().includes(needle)))
    .sort((left, right) => {
      const field = sort.startsWith("market-value") ? "marketValue" : sort.startsWith("pnl") ? "reportPnl" : null;
      if (field) {
        const a = left[field]; const b = right[field];
        if (a === null || b === null) return a === b ? left.id.localeCompare(right.id) : a === null ? 1 : -1;
        return new Decimal(a).comparedTo(b) * direction || left.id.localeCompare(right.id);
      }
      return left.instrumentName.localeCompare(right.instrumentName, "zh-CN") * direction || left.id.localeCompare(right.id);
    });
}

function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function holdingsCsv(rows: readonly HomepageHolding[]): string {
  return [
    ["证券", "证券身份", "账户", "持仓天数", "数量", "成本价", "现价", "市值", "浮盈亏", "报告币种"],
    ...rows.map(row => [row.instrumentName, row.identity ?? "交易所待解析", row.accountLabel, row.days?.toString() ?? "", row.quantity ?? "", row.averageCost ?? "", row.quoteStatus === "available" ? row.quote?.price ?? "" : "", row.marketValue ?? "", row.reportPnl ?? "", row.reportCurrency]),
  ].map(cells => cells.map(csvCell).join(",")).join("\r\n");
}
