import type { HomepageAttachments, HomepageScope } from "../../lib/reviews/homepage-v25-state";
import Decimal from "decimal.js";
import { reviewState } from "../../lib/reviews/review-queue";
import { classifyTradingRoomAsset, normalizeRoomMetadata, type TradingRoomMetadataInput } from "../../lib/reviews/trading-room-scope";
import { buildTradeLibraryEntries, type TradeLibraryEntry, type TradeLibraryEpisode } from "../../lib/trades/library";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { replayExecutionAt } from "../../lib/import/statement-evidence";
import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { tradeNatureOf, type Instrument, type TradeExecution, type TradeNature } from "../../lib/trades/types";

export type HomepageAttachmentGroupIdentity = {
  accountId: string;
  instrumentId: string;
  nature: TradeNature;
  simulationRunId: string | null;
};
export type HomepageAttachmentFact<T> = { value: T | null; reasons: string[] };
export type HomepageAttachmentGroup = {
  key: string;
  identity: HomepageAttachmentGroupIdentity;
  sources: { entry: TradeLibraryEntry; executions: TradeExecution[]; episodes: TradeLibraryEpisode[] }[];
  category: HomepageAttachmentFact<"stock" | "etf">;
  open: HomepageAttachmentFact<boolean>;
  pendingReview: HomepageAttachmentFact<boolean>;
  eligible: boolean;
  exclusionReasons: string[];
};
export type HomepageAttachmentInput = {
  entries: readonly TradeLibraryEntry[];
  scope: HomepageScope;
  attachments: HomepageAttachments;
  asOf: string;
  /** Resolved by the owned catalog; external exchange identities are never guessed. */
  symbolInstrumentIds?: readonly string[];
  instrumentMetadata?: TradingRoomMetadataInput;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  marketDataStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  episodeCoverage: ReadonlyMap<string, { complete: boolean; reasons: readonly string[] }>;
  current?: {
    boundary: { asOf: string | null };
    instruments: readonly {
      identity: Omit<HomepageAttachmentGroupIdentity, "nature"> & { nature: TradeNature | "caller-scoped" };
      evidence: { current: { quantity: string | null; reasons: readonly string[] } };
    }[];
  };
};
export function homepageAttachmentGroupKey(identity: HomepageAttachmentGroupIdentity): string {
  return JSON.stringify([identity.accountId, identity.instrumentId, identity.nature, identity.simulationRunId]);
}
function scopeIncludes(scope: HomepageScope, identity: HomepageAttachmentGroupIdentity, instrument: Instrument, symbolInstrumentIds?: readonly string[]): boolean {
  if (identity.nature !== "live" || (!scope.accounts.includes("*") && !scope.accounts.includes(identity.accountId))) return false;
  if (scope.symbolIdentity && !(symbolInstrumentIds ?? [scope.symbolIdentity]).includes(identity.instrumentId)) return false;
  const market = instrument.market.trim().toUpperCase();
  return scope.market === "all" || (scope.market === "hk" && market === "HK") ||
    (scope.market === "us" && market === "US") ||
    (scope.market === "a" && ["CN", "CN-SH", "SH", "SSE", "CN-SZ", "SZ", "SZSE"].includes(market));
}

function executionIdentity(fill: TradeExecution): HomepageAttachmentGroupIdentity {
  const nature = tradeNatureOf(fill);
  return { accountId: fill.accountId, instrumentId: fill.instrument.id, nature,
    simulationRunId: nature === "simulation" ? fill.source.simulationRunId ?? null : null };
}
function episodeIdentity(item: TradeLibraryEpisode): HomepageAttachmentGroupIdentity {
  const episode = item.episode, nature = episode.tradeNature ?? "unknown";
  return { accountId: episode.accountId, instrumentId: episode.instrument.id, nature,
    simulationRunId: nature === "simulation" ? episode.simulationRunId ?? null : null };
}

/** Absence of pending is only evidence after the owned complete lineage was checked. */
export function homepageAttachmentEpisodeCoverage(entries: readonly TradeLibraryEntry[], asOf: string, summariesComplete: boolean): HomepageAttachmentInput["episodeCoverage"] {
  const groups = new Map<string, { executions: Map<string, TradeExecution>; episodes: Map<string, TradeLibraryEpisode> }>();
  const group = (key: string) => { let value = groups.get(key); if (!value) { value = { executions: new Map(), episodes: new Map() }; groups.set(key, value); } return value; };
  for (const entry of entries) {
    for (const fill of entry.executions) group(homepageAttachmentGroupKey(executionIdentity(fill))).executions.set(fill.id, fill);
    for (const item of entry.episodes) group(homepageAttachmentGroupKey(episodeIdentity(item))).episodes.set(item.episode.id, item);
  }
  const at = Date.parse(asOf);
  return new Map([...groups].map(([key, source]) => {
    const reasons: string[] = [];
    if (!summariesComplete) reasons.push("review-summary-read-incomplete");
    if (!Number.isFinite(at)) reasons.push("coverage-asof-invalid");
    const executions = [...source.executions.values()].filter(fill => {
      const time = Date.parse(fill.source.timePrecision === "date-only" || fill.executedAt.length === 10 ? replayExecutionAt(fill) : fill.executedAt);
      if (!Number.isFinite(time)) reasons.push("coverage-execution-time-invalid");
      return time <= at;
    });
    const episodes = [...source.episodes.values()].filter(item => {
      const time = Date.parse(item.episode.startedAt);
      if (!Number.isFinite(time)) reasons.push("coverage-episode-time-invalid");
      return time <= at;
    });
    if (!executions.length || !episodes.length) reasons.push("coverage-lineage-missing");
    const assigned = new Set<string>();
    for (const item of episodes) {
      const episode = item.episode;
      if (episode.initialPosition || episode.directionKnown === false || episode.warnings?.some(warning => warning.code === "statement-coverage-gap") ||
        episode.accuracy?.reasons.some(reason => ["history-incomplete", "ambiguous-event-order", "ambiguous-opening"].includes(reason))) reasons.push("coverage-history-incomplete");
      for (const fill of episode.executions) {
        if (homepageAttachmentGroupKey(executionIdentity(fill)) !== key) reasons.push("coverage-episode-identity-mismatch");
        else assigned.add(fill.id);
      }
    }
    if (executions.some(fill => !assigned.has(fill.id))) reasons.push("coverage-execution-unassigned");
    if (executions.some(fill => (fill.source.historyIncomplete?.length ?? 0) > 0)) reasons.push("coverage-history-incomplete");
    const unique = [...new Set(reasons)];
    return [key, { complete: unique.length === 0, reasons: unique }];
  }));
}

/** Select exact lineages before rebuilding the canonical per-instrument entries. */
function projectEntries(groups: readonly HomepageAttachmentGroup[], input: HomepageAttachmentInput): TradeLibraryEntry[] {
  const sources = groups.flatMap(group => group.sources);
  const fills = [...new Map(sources.flatMap(source => source.executions).map(fill => [fill.id, fill])).values()];
  const items = sources.flatMap(source => source.episodes);
  const reviews = Object.fromEntries(items.flatMap(item => item.review ? [[item.episode.id, item.review]] : []));
  const recalls = Object.fromEntries(items.flatMap(item => item.recallReview ? [[item.episode.id, item.recallReview]] : []));
  const instruments = new Map(sources.map(source => [source.entry.instrument.id, source.entry.instrument]));
  const summaries = buildInstrumentTradeSummaries(fills).map(summary => ({ ...summary, instrument: instruments.get(summary.instrument.id) ?? summary.instrument }));
  const candles = Object.fromEntries(Object.entries(input.candlesByInstrument ?? {}).map(([id, values]) => [id, [...values ?? []]]));
  const statuses = Object.fromEntries(Object.entries(input.marketDataStatuses ?? {}).map(([id, value]) => [id, value ?? "not-requested"]));
  return buildTradeLibraryEntries(summaries, candles, statuses, reviews, recalls);
}

function currentOpen(input: HomepageAttachmentInput, key: string): HomepageAttachmentFact<boolean> {
  const targetTime = Date.parse(input.asOf);
  if (!input.current || !Number.isFinite(targetTime) || Date.parse(input.current.boundary.asOf ?? "") !== targetTime) {
    return { value: null, reasons: [input.current ? "current-asof-mismatch" : "current-evidence-missing"] };
  }
  const facts = input.current.instruments.filter(item => item.identity.nature !== "caller-scoped" &&
    homepageAttachmentGroupKey({ ...item.identity, nature: item.identity.nature }) === key).map(item => item.evidence.current);
  if (!facts.length) return { value: null, reasons: ["current-group-missing"] };
  const quantities: Decimal[] = [];
  for (const fact of facts) {
    try {
      const quantity = fact.quantity === null ? null : new Decimal(fact.quantity);
      if (quantity?.isFinite()) quantities.push(quantity);
      else return { value: null, reasons: [...new Set(["current-quantity-unavailable", ...fact.reasons])] };
    } catch {
      return { value: null, reasons: ["current-quantity-invalid", ...fact.reasons] };
    }
  }
  if (quantities.some(quantity => !quantity.eq(quantities[0]))) return { value: null, reasons: ["current-quantity-conflict"] };
  return { value: !quantities[0].isZero(), reasons: [] };
}

function pendingFact(input: HomepageAttachmentInput, group: HomepageAttachmentGroup): HomepageAttachmentFact<boolean> {
  const at = Date.parse(input.asOf);
  if (!Number.isFinite(at)) return { value: null, reasons: ["pending-asof-invalid"] };
  const episodes = group.sources.flatMap(source => source.episodes);
  const applicable = episodes.filter(item => Date.parse(item.episode.startedAt) <= at);
  if (applicable.some(item => reviewState(item) === "pending")) return { value: true, reasons: [] };
  const coverage = input.episodeCoverage.get(group.key);
  const reasons = [
    ...(!applicable.length ? ["pending-applicable-episodes-missing"] : []),
    ...(episodes.some(item => !Number.isFinite(Date.parse(item.episode.startedAt))) ? ["pending-episode-time-invalid"] : []),
    ...(!coverage?.complete ? ["pending-episode-coverage-incomplete", ...(coverage?.reasons ?? [])] : []),
  ];
  return reasons.length ? { value: null, reasons: [...new Set(reasons)] } : { value: false, reasons: [] };
}

/**
 * Qualifies whole account/instrument/nature/run lineages. The caller must feed
 * these composite sources to each consumer; separate account/instrument lists
 * would broaden the selected set. Original finance/evidence objects are retained.
 */
export function qualifyHomepageAttachmentGroups(input: HomepageAttachmentInput): {
  groups: HomepageAttachmentGroup[]; eligibleGroups: HomepageAttachmentGroup[]; executions: TradeExecution[]; episodes: TradeLibraryEpisode[]; entries: TradeLibraryEntry[];
} {
  const byKey = new Map<string, HomepageAttachmentGroup>();
  const metadata = normalizeRoomMetadata(input.instrumentMetadata);
  for (const entry of input.entries) {
    function sourceFor(identity: HomepageAttachmentGroupIdentity, instrument: Instrument) {
      if (!scopeIncludes(input.scope, identity, instrument, input.symbolInstrumentIds)) return null;
      const key = homepageAttachmentGroupKey(identity);
      let group = byKey.get(key);
      if (!group) {
        group = { key, identity, sources: [], category: { value: null, reasons: [] }, open: { value: null, reasons: [] }, pendingReview: { value: null, reasons: [] }, eligible: false, exclusionReasons: [] };
        byKey.set(key, group);
      }
      let source = group.sources.find(source => source.entry === entry);
      if (!source) {
        source = { entry, executions: [], episodes: [] };
        group.sources.push(source);
      }
      return source;
    }
    for (const execution of entry.executions) {
      const nature = tradeNatureOf(execution);
      sourceFor({ accountId: execution.accountId, instrumentId: execution.instrument.id, nature, simulationRunId: nature === "simulation" ? execution.source.simulationRunId ?? null : null }, execution.instrument)?.executions.push(execution);
    }
    for (const item of entry.episodes) {
      const episode = item.episode;
      const nature = episode.tradeNature ?? "unknown";
      sourceFor({ accountId: episode.accountId, instrumentId: episode.instrument.id, nature, simulationRunId: nature === "simulation" ? episode.simulationRunId ?? null : null }, episode.instrument)?.episodes.push(item);
    }
  }
  const groups = [...byKey.values()].sort((a, b) => a.identity.accountId.localeCompare(b.identity.accountId) ||
    a.identity.instrumentId.localeCompare(b.identity.instrumentId) || a.key.localeCompare(b.key));
  const categories = new Set(input.attachments.categories);
  const pending = new Set(input.attachments.pendingReview);
  for (const group of groups) {
    const assets = group.sources.map(source => classifyTradingRoomAsset(source.entry.instrument, metadata.get(group.identity.instrumentId)));
    const known = assets[0]?.assetType;
    group.category = known && known !== "unknown" && assets.every(asset => asset.assetType === known)
      ? { value: known, reasons: [] }
      : { value: null, reasons: [...new Set(assets.flatMap(asset => asset.reason ? [asset.reason] : ["asset-metadata-conflict"]))] };
    group.open = currentOpen(input, group.key);
    group.pendingReview = pendingFact(input, group);
    if (categories.size && (group.category.value === null || !categories.has(group.category.value))) group.exclusionReasons.push(group.category.value === null ? "category-unknown" : "category-mismatch");
    if (input.attachments.openOnly && group.open.value !== true) group.exclusionReasons.push(group.open.value === null ? "open-unknown" : "open-mismatch");
    if (pending.size === 1 && (group.pendingReview.value === null || !pending.has(group.pendingReview.value))) group.exclusionReasons.push(group.pendingReview.value === null ? "pending-review-unknown" : "pending-review-mismatch");
    group.eligible = group.exclusionReasons.length === 0;
  }
  const eligibleGroups = groups.filter(group => group.eligible);
  return { groups, eligibleGroups,
    entries: projectEntries(eligibleGroups, input),
    executions: [...new Set(eligibleGroups.flatMap(group => group.sources.flatMap(source => source.executions)))],
    episodes: [...new Set(eligibleGroups.flatMap(group => group.sources.flatMap(source => source.episodes)))],
  };
}
