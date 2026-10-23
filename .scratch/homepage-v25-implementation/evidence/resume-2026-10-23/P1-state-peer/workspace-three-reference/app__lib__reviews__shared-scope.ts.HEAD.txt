import type { TradeLibraryEntry } from "../trades/library";
import { tradingViewEpisodeBusinessScope } from "../trades/tradingview-account-identity";
import { isCanonicalTradingViewAccountExecution } from "../trades/tradingview-account-identity";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../trades/tradingview-account-identity";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import Decimal from "decimal.js";

export type SharedTradeNature = "live" | "simulation" | "unknown";
export type SharedReportCurrency = "original" | "CNY" | "HKD";

/** Cross-page scope owned by the workspace shell. Page-local date/status/tag filters stay separate. */
export type SharedScope = {
  nature: SharedTradeNature;
  accountIds: readonly string[];
  reportCurrency: SharedReportCurrency;
  simulationRunId: string | null;
};

export const DEFAULT_SHARED_SCOPE: SharedScope = {
  nature: "live",
  accountIds: [],
  reportCurrency: "original",
  simulationRunId: null,
};

function entryEpisodeNature(entry: TradeLibraryEntry, episode: TradeLibraryEntry["episodes"][number]["episode"]): SharedTradeNature {
  const episodeNature = episode.tradeNature;
  if (episodeNature && episodeNature !== "unknown") return episodeNature;
  return entry.tradeNature ?? "unknown";
}

/**
 * Match one episode against the shared business scope. A canonical TradingView
 * episode is an account-level simulation scope, so its source run is never a
 * business filter. Other simulation episodes keep their legacy run boundary.
 */
export function sharedScopeMatchesEpisode(
  entry: TradeLibraryEntry,
  episode: TradeEpisode,
  scope: SharedScope,
): boolean {
  if (entryEpisodeNature(entry, episode) !== scope.nature) return false;
  if (scope.accountIds.length > 0 && !scope.accountIds.includes(episode.accountId)) return false;
  if (scope.nature !== "simulation") return true;

  const businessScope = tradingViewEpisodeBusinessScope(episode);
  if (businessScope) return scope.simulationRunId === businessScope.simulationRunId;
  if (scope.simulationRunId !== null) return episode.simulationRunId === scope.simulationRunId;

  // Keep the old no-execution fixtures usable for account-explicit callers,
  // while real legacy simulation rows still require an explicit run.
  return scope.accountIds.length > 0 && episode.executions.length === 0;
}

export function normalizeSharedScope(value: unknown): SharedScope {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nature = candidate.nature === "simulation" || candidate.nature === "unknown" ? candidate.nature : "live";
  const reportCurrency = candidate.reportCurrency === "CNY" || candidate.reportCurrency === "HKD"
    ? candidate.reportCurrency
    : "original";
  const accountIds = Array.isArray(candidate.accountIds) ? candidate.accountIds : [];
  const simulationRunId = nature === "simulation" && typeof candidate.simulationRunId === "string" && candidate.simulationRunId.length > 0
    ? candidate.simulationRunId
    : null;
  return {
    nature,
    accountIds: [...new Set(accountIds.filter((item): item is string => typeof item === "string" && item.length > 0))],
    reportCurrency,
    simulationRunId,
  };
}

export function sharedScopeMatchesEntry(entry: TradeLibraryEntry, scope: SharedScope): boolean {
  return entry.episodes.some(({ episode }) => sharedScopeMatchesEpisode(entry, episode, scope));
}

export function filterEntriesBySharedScope(entries: readonly TradeLibraryEntry[], scope: SharedScope): TradeLibraryEntry[] {
  return entries.flatMap((entry) => {
    if (!sharedScopeMatchesEntry(entry, scope)) return [];
    const episodes = entry.episodes.filter(({ episode }) => sharedScopeMatchesEpisode(entry, episode, scope));
    if (episodes.length === 0) return [];
    const executionIds = new Set(episodes.flatMap(({ episode }) => episode.executions.map(({ id }) => id)));
    const netValues = episodes.map(({ metrics }) => metrics.netPnl);
    const netPnl = netValues.every((value): value is string => value !== null)
      ? netValues.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString()
      : null;
    const grossExposure = episodes.reduce((sum, { metrics }) => sum.plus(metrics.grossExposure), new Decimal(0));
    const reviewedEpisodeCount = episodes.filter(({ reviewStatus }) => reviewStatus === "completed").length;
    const firstTradeAt = episodes.map(({ episode }) => episode.startedAt).sort()[0];
    const lastTradeAt = episodes.map(({ episode }) => episode.endedAt ?? episode.startedAt).sort().at(-1) ?? firstTradeAt;
    const rValues = episodes.map(({ rMultiple }) => rMultiple).filter((value): value is string => value !== null);
    return [{
      ...entry,
      executions: entry.executions.filter(({ id }) => executionIds.has(id)),
      episodes,
      accountCount: new Set(episodes.map(({ episode }) => episode.accountId)).size,
      tradeCount: executionIds.size,
      episodeCount: episodes.length,
      firstTradeAt,
      lastTradeAt,
      status: episodes.some(({ episode }) => episode.status === "open") ? "open" : "closed",
      netPnl,
      returnPercent: netPnl === null || grossExposure.isZero() ? null : new Decimal(netPnl).div(grossExposure).times(100).toString(),
      reviewedEpisodeCount,
      confirmedTagIds: [...new Set(episodes.flatMap(({ confirmedTagIds }) => confirmedTagIds))],
      cumulativeR: rValues.length === 0 ? null : rValues.reduce((sum, value) => sum.plus(value), new Decimal(0)).toString(),
    }];
  });
}

export function sharedScopeStorageKey(project = "default") {
  return `tradereview:shared-scope:v1:${project}`;
}

export function sharedScopeV2StorageKey(project = "default") {
  return `tradereview:shared-scope:v2:${project}`;
}

export function isCanonicalTradingViewSharedScope(scope: SharedScope): boolean {
  return scope.nature === "simulation" &&
    scope.simulationRunId === null &&
    scope.accountIds.length === 1 &&
    scope.accountIds[0] === TRADINGVIEW_CANONICAL_ACCOUNT_ID;
}

export function filterExecutionHistoryForEpisode(
  executions: readonly TradeExecution[],
  episode: Pick<TradeEpisode, "accountId" | "tradeNature" | "simulationRunId" | "executions">,
): TradeExecution[] {
  if (tradingViewEpisodeBusinessScope(episode)) {
    return executions.filter(isCanonicalTradingViewAccountExecution);
  }
  const first = episode.executions[0];
  if (!first) return [];
  const nature = episode.tradeNature ?? first.source.tradeNature ?? (first.source.tradingNature === "simulated" ? "simulation" : first.source.tradingNature) ?? "unknown";
  const episodeRun = episode.simulationRunId ?? first.source.simulationRunId ?? null;
  return executions.filter((execution) => {
    const executionNature = execution.source.tradeNature ?? (execution.source.tradingNature === "simulated" ? "simulation" : execution.source.tradingNature) ?? "unknown";
    return execution.accountId === episode.accountId &&
      executionNature === nature &&
      (nature !== "simulation" || execution.source.simulationRunId === episodeRun);
  });
}
