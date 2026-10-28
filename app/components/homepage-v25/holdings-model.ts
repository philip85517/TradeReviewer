import { resolvedTradeNatureOf, resolvedEpisodeTradeNatureOf } from "../../lib/trades/nature-resolution";
import Decimal from "decimal.js";
import { validateInstrumentExchange, type InstrumentExchange } from "../../lib/instruments/metadata-contracts";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import { classifyTradingRoomAsset, normalizeRoomMetadata, roomTodayKey, type TradingRoomMetadataInput } from "../../lib/reviews/trading-room-scope";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { readHomepageV25FinancialFacts } from "../../lib/reviews/homepage-v25-performance";
import type { HomepageOwnedFinancialSource } from "./source-contract";
import type { HomepagePeriodView } from "./financial-view-model";
import type { HomepageFinancialAcquisitionReceipt } from "./financial-acquisition";

type Facts = ReturnType<typeof readHomepageV25FinancialFacts>;
type GroupFacts = Facts["groups"][number];
export type HomepageHolding = {
  id: string; instrumentId: string; instrumentName: string; symbol: string; market: string; marketLabel: string;
  accountId: string; accountLabel: string; episodeId: string | null; settlementCurrency: string;
  assetType: ReturnType<typeof classifyTradingRoomAsset>["assetType"];
  identity: string | null; identityReason: string | null;
  days: number | null; daysReason: string | null;
  quantity: string | null; quantityStatus: "available" | "unavailable";
  averageCost: string | null; costStatus: "available" | "unavailable";
  quote: TradingRoomQuote | null; quoteStatus: "available" | "missing";
  unrealizedPnl: string | null; unrealizedPnlStatus: "available" | "unavailable";
  statusReason: string | null; marketValue: string | null; reportPnl: string | null;
  reportCurrency: "CNY" | "HKD" | "USD"; conversionReason: string | null; financialEvidence: string;
};
export type HomepageHoldingsView = Readonly<{
  rows: readonly HomepageHolding[]; asOf: string | null; reportCurrency: "CNY" | "HKD" | "USD";
  uniqueInstrumentCount: number; totalMarketValue: string | null; totalUnrealizedPnl: string | null; canSortMoney: boolean;
}>;
export type HomepageHoldingsPresentation = {
  exchangeByInstrument?: Readonly<Record<string, InstrumentExchange | undefined>>;
  instrumentMetadata?: TradingRoomMetadataInput;
  staleAfterDays?: number;
  receipt?: HomepageFinancialAcquisitionReceipt;
};
/** A loading display has no financial source and makes no empty-universe assertion. */
export const EMPTY_HOMEPAGE_HOLDINGS: HomepageHoldingsView = Object.freeze({ rows: Object.freeze([]), asOf: null, reportCurrency: "CNY",
  uniqueInstrumentCount: 0, totalMarketValue: null, totalUnrealizedPnl: null, canSortMoney: false });
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
    episodes: entry.episodes.filter(item => item.episode.executions.length > 0 && item.episode.executions.every(fill => resolvedTradeNatureOf(fill) === "live")),
  })).filter(entry => entry.episodes.length > 0);
}

export function homepageInstrumentIdentity(instrument: { market: string; symbol: string }, exchange?: InstrumentExchange): string | null {
  let usExchange: InstrumentExchange | undefined;
  if (instrument.market === "US" && exchange) {
    try { usExchange = validateInstrumentExchange(exchange); } catch { /* Historical metadata remains stored but cannot establish identity. */ }
  }
  const code = instrument.market === "CN-SH" ? "SSE" : instrument.market === "CN-SZ" ? "SZSE" : instrument.market === "HK" ? "HKEX" : instrument.market === "US" ? usExchange?.code : undefined;
  return code ? `${code}:${instrument.symbol}` : null;
}

function holdingAge(group: GroupFacts, asOf: string): { days: number | null; daysReason: string | null } {
  const unknown = { days: null, daysReason: "连续持仓起点证据不足" };
  const canonical = group.canonical;
  if (!canonical.coverage.quantity.available || !canonical.coverage.chronology.available
    || canonical.terminal.warnings.some(warning => warning.code.includes("gap"))
    || group.rawExecutions.some(fill => canonical.selectedExecutionIds.includes(fill.id) && (fill.source.historyIncomplete?.length ?? 0) > 0)) return unknown;
  let start: string | null = null;
  for (const fact of canonical.facts) {
    if (fact.effect !== "applied") continue;
    const before = fact.before.quantity, after = fact.after.quantity;
    if (!before.available || !after.available || before.value === null || after.value === null) { start = null; continue; }
    const a = new Decimal(before.value), b = new Decimal(after.value);
    if (b.isZero()) { start = null; continue; }
    const newCycle = a.isZero() || a.isPositive() !== b.isPositive();
    if (newCycle) start = fact.kind === "execution" && fact.time.precision !== "month" && fact.openedQuantity.available
      && fact.openedQuantity.value !== null && new Decimal(fact.openedQuantity.value).gt(0) ? fact.time.at : null;
  }
  if (!start) return unknown;
  const days = (Date.parse(`${roomTodayKey(new Date(asOf))}T00:00:00Z`) - Date.parse(`${roomTodayKey(new Date(start))}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 ? { days, daysReason: null } : unknown;
}

/** Display-only projection. Own/prepare/read facts occur once in the global caller. */
export function buildHomepageHoldings(source: HomepageOwnedFinancialSource, view: Pick<HomepagePeriodView, "stamp" | "current">,
  facts: Facts, options: HomepageHoldingsPresentation = {}): HomepageHoldingsView {
  const { stamp, current } = view;
  const revisionKeys = ["trades", "metadata", "quotes", "fx"] as const;
  if (source.prepared.sourceId !== source.receipt.sourceId || stamp.sourceId !== source.receipt.sourceId || facts.sourceId !== stamp.sourceId || stamp.selectionKey !== source.receipt.selectionKey
    || revisionKeys.some(key => stamp.revisions[key] !== source.revisions[key] || facts.revisions[key] !== source.revisions[key])
    || JSON.stringify(stamp.policies) !== JSON.stringify(facts.policies)
    || Date.parse(source.asOf.length === 10 ? `${source.asOf}T15:59:59.999Z` : source.asOf) !== Date.parse(current.asOf)
    || stamp.asOf !== current.asOf || facts.effectiveKnowledgeCursor !== current.asOf
    || stamp.reportCurrency !== source.reportCurrency
    || [current.currentMarketValue, current.currentUnrealized, current.currentOpenFees].some(metric => metric.money.targetCurrency !== source.reportCurrency))
    throw new Error("holdings-source-context-mismatch");
  const factsByKey = new Map(facts.groups.map(group => [group.key, group]));
  if (factsByKey.size !== facts.groups.length || current.instruments.length !== facts.groups.length || new Set(current.instruments.map(group => group.key)).size !== current.instruments.length) throw new Error("holdings-source-groups-mismatch");
  // F groups preserve the original carrier instrument ID; an entry display ID may be canonicalized.
  const entryKey = (account: string, instrument: string, nature: string, run: string | null, currency: string) => JSON.stringify([account, instrument, nature, run, currency]);
  // Several frozen identity entries can resolve to the same business group.
  // Keep every original carrier and locate navigation targets by fill membership.
  const entriesByGroup = new Map<string, Set<TradeLibraryEntry>>();
  const associate = (key: string, entry: TradeLibraryEntry) => {
    const carriers = entriesByGroup.get(key) ?? new Set<TradeLibraryEntry>();
    carriers.add(entry);
    entriesByGroup.set(key, carriers);
  };
  for (const entry of source.selectedEntries) {
    for (const fill of entry.executions) associate(entryKey(fill.accountId, fill.instrument.id, resolvedTradeNatureOf(fill), fill.source.simulationRunId ?? null, fill.instrument.currency), entry);
    for (const { episode } of entry.episodes) associate(entryKey(episode.accountId, episode.instrument.id, resolvedEpisodeTradeNatureOf(episode), episode.simulationRunId ?? null, episode.instrument.currency), entry);
  }
  const metadata = normalizeRoomMetadata(options.instrumentMetadata);
  const rows: HomepageHolding[] = [];
  for (const finance of current.instruments) {
    const group = factsByKey.get(finance.key), identity = finance.identity;
    const carriers = group && entriesByGroup.get(entryKey(identity.accountId, identity.instrumentId, identity.nature, identity.simulationRunId, group.identity.currency));
    const lastId = group?.canonical.selectedExecutionIds.at(-1);
    const episodes = [...(carriers ?? [])].flatMap(entry => entry.episodes
      .filter(({ episode }) => episode.accountId === identity.accountId && episode.executions.some(fill => fill.id === lastId))
      .map(({ episode }) => ({ entry, episode })));
    const target = episodes.length === 1 ? episodes[0] : null;
    const entry = target?.entry ?? carriers?.values().next().value;
    const episode = target?.episode ?? null;
    if (!group || !entry || group.identity.accountId !== identity.accountId || group.identity.instrumentId !== identity.instrumentId
      || group.identity.nature !== identity.nature || group.identity.simulationRunId !== identity.simulationRunId
      || group.identity.currency !== entry.instrument.currency
      || group.canonical.effectiveKnowledgeCursor !== facts.effectiveKnowledgeCursor)
      throw new Error("holdings-source-group-mismatch");
    const evidence = finance.evidence.current, quantity = evidence.quantity;
    if (quantity !== null && new Decimal(quantity).isZero()) continue;
    const cost = group.canonical.terminal.averageCost, terminalQuantity = group.canonical.terminal.quantity;
    const sameQuantity = group.quantityCoverage.available && terminalQuantity.available && terminalQuantity.value === quantity && quantity !== null;
    const averageCost = evidence.costKnown && sameQuantity && cost.available ? cost.value : null;
    const selectedQuote = evidence.quote;
    const quoteAge = selectedQuote ? (Date.parse(`${roomTodayKey(new Date(current.asOf))}T00:00:00Z`) - Date.parse(`${selectedQuote.date}T00:00:00Z`)) / 86_400_000 : null;
    const stale = quoteAge !== null && quoteAge > (options.staleAfterDays ?? 3);
    const quote: TradingRoomQuote | null = selectedQuote ? { price: selectedQuote.price, quoteDate: selectedQuote.date, currency: selectedQuote.currency,
      provider: selectedQuote.source, fetchedAt: null, freshness: stale ? "stale" : "current" } : null;
    const accountLabel = group.rawExecutions.find(fill => group.canonical.selectedExecutionIds.includes(fill.id))?.accountLabel || episode?.accountLabel || identity.accountId;
    const trusted = homepageInstrumentIdentity(entry.instrument, options.exchangeByInstrument?.[identity.instrumentId]);
    const statusReason = financialReason([...finance.currentMarketValue.reasons, ...finance.currentUnrealized.reasons])
      ?? (!sameQuantity && evidence.costKnown ? "数量精度与成本事实不一致，暂无可信成本" : stale ? `行情已陈旧：${selectedQuote?.date} 原始日线` : null);
    const fx = options.receipt?.fx;
    rows.push({ id: episode ? JSON.stringify([identity.accountId, episode.id]) : JSON.stringify([identity.accountId, identity.instrumentId, identity.nature, identity.simulationRunId]),
      instrumentId: identity.instrumentId, instrumentName: entry.instrument.name, symbol: entry.instrument.symbol, market: entry.instrument.market,
      marketLabel: entry.instrument.market, accountId: identity.accountId, accountLabel, episodeId: episode?.id ?? null,
      settlementCurrency: group.identity.currency, assetType: classifyTradingRoomAsset(entry.instrument, metadata.get(identity.instrumentId)).assetType,
      identity: trusted, identityReason: trusted ? null : "交易所证据尚未解析，暂不能定位交易集合",
      ...holdingAge(group, current.asOf), quantity, quantityStatus: quantity === null ? "unavailable" : "available",
      averageCost, costStatus: averageCost === null ? "unavailable" : "available", quote, quoteStatus: quote ? "available" : "missing",
      unrealizedPnl: finance.currentUnrealized.money.originalByCurrency[group.identity.currency] ?? null,
      unrealizedPnlStatus: finance.currentUnrealized.available ? "available" : "unavailable", statusReason,
      marketValue: finance.currentMarketValue.value, reportPnl: finance.currentUnrealized.value, reportCurrency: source.reportCurrency,
      conversionReason: financialReason([...finance.currentMarketValue.reasons, ...finance.currentUnrealized.reasons].filter(reason => reason.startsWith("fx-"))),
      financialEvidence: `行情 ${selectedQuote ? `${selectedQuote.date} · ${selectedQuote.source} · 原始日线${stale ? "（陈旧）" : ""}` : "缺失"}；报告币种 ${source.reportCurrency}；汇率 ${fx ? `${fx.state.source} · 发布时间 ${fx.state.publishedAt ?? "未知"} · 客户端观察 ${fx.observedAt}` : "未提供，同币种无需换算"}`,
    });
  }
  return Object.freeze({ rows: Object.freeze(rows), asOf: current.asOf, reportCurrency: source.reportCurrency,
    uniqueInstrumentCount: new Set(rows.map(row => row.instrumentId)).size,
    totalMarketValue: current.currentMarketValue.value, totalUnrealizedPnl: current.currentUnrealized.value,
    canSortMoney: rows.length > 0 && rows.every(row => row.marketValue !== null && row.reportPnl !== null) });
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
