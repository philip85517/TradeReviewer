import type { TradeLibraryEntry } from "../trades/library";
import Decimal from "decimal.js";

export type SharedTradeNature = "live" | "simulation" | "unknown";
export type SharedReportCurrency = "original" | "CNY";

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

export function normalizeSharedScope(value: unknown): SharedScope {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nature = candidate.nature === "simulation" || candidate.nature === "unknown" ? candidate.nature : "live";
  const reportCurrency = candidate.reportCurrency === "CNY" ? "CNY" : "original";
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
  const hasNature = entry.episodes.some(({ episode }) => entryEpisodeNature(entry, episode) === scope.nature);
  if (!hasNature) return false;
  if (scope.accountIds.length > 0 && !entry.episodes.some(({ episode }) => scope.accountIds.includes(episode.accountId))) return false;
  if (scope.simulationRunId !== null && !entry.episodes.some(({ episode }) => episode.simulationRunId === scope.simulationRunId)) return false;
  return true;
}

export function filterEntriesBySharedScope(entries: readonly TradeLibraryEntry[], scope: SharedScope): TradeLibraryEntry[] {
  return entries.flatMap((entry) => {
    if (!sharedScopeMatchesEntry(entry, scope)) return [];
    const episodes = entry.episodes.filter(({ episode }) => {
      const nature = entryEpisodeNature(entry, episode);
      return nature === scope.nature &&
        (scope.accountIds.length === 0 || scope.accountIds.includes(episode.accountId)) &&
        (scope.simulationRunId === null || episode.simulationRunId === scope.simulationRunId);
    });
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
