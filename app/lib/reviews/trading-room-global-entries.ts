import type { MarketDataSyncStatus } from "../market/sync-status";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import type { SharedScope } from "./shared-scope";
import { filterEntriesBySharedScope } from "./shared-scope";
import { reviewState } from "./review-queue";
import { tradingViewEpisodeBusinessScope } from "../trades/tradingview-account-identity";

/**
 * The global tools deliberately share identity only.  They do not inherit a
 * dashboard observation/statistics period, a local library filter, or a page.
 */
export type GlobalEntryScope = Pick<SharedScope, "nature" | "accountIds" | "simulationRunId">;

export type GlobalSearchResult = {
  instrumentId: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  episodeId: string;
  episodeCount: number;
  openEpisodeCount: number;
  pendingEpisodeCount: number;
};

export type GlobalNotificationKind = "data" | "market" | "pending-review";

export type GlobalNotification = {
  id: string;
  kind: GlobalNotificationKind;
  label: string;
  description: string;
  instrumentId?: string;
  episodeId?: string;
  action: "open-data-check" | "open-market-data" | "open-review";
};

export type GlobalEntryState = "ready" | "needs-scope";

export type GlobalNotificationModel = {
  state: GlobalEntryState;
  items: GlobalNotification[];
};

type ScopedEpisode = {
  entry: TradeLibraryEntry;
  item: TradeLibraryEpisode;
};

const HEALTHY_MARKET_DATA = new Set<MarketDataSyncStatus>(["complete", "ready"]);

function normalized(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("zh-CN") ?? "";
}

function entryEpisodes(entries: readonly TradeLibraryEntry[], scope: GlobalEntryScope): ScopedEpisode[] {
  return filterEntriesBySharedScope(entries, {
    nature: scope.nature,
    accountIds: scope.accountIds,
    reportCurrency: "original",
    simulationRunId: scope.simulationRunId,
  }).flatMap(entry => entry.episodes.map(item => ({ entry, item })));
}

function hasCanonicalSimulationScope(entries: readonly TradeLibraryEntry[], scope: GlobalEntryScope): boolean {
  if (scope.nature !== "simulation" || scope.simulationRunId !== null) return false;
  return entries.some(entry => entry.episodes.some(({ episode }) => {
    const businessScope = tradingViewEpisodeBusinessScope(episode);
    return Boolean(
      businessScope &&
      (scope.accountIds.length === 0 || scope.accountIds.includes(businessScope.accountId)),
    );
  }));
}

function requiresSimulationRun(entries: readonly TradeLibraryEntry[], scope: GlobalEntryScope): boolean {
  return scope.nature === "simulation" &&
    scope.simulationRunId === null &&
    !hasCanonicalSimulationScope(entries, scope);
}

function episodeTime(item: TradeLibraryEpisode): string {
  return item.episode.endedAt ?? item.episode.startedAt;
}

function newestFirst(left: ScopedEpisode, right: ScopedEpisode): number {
  return episodeTime(right.item).localeCompare(episodeTime(left.item)) ||
    left.item.episode.id.localeCompare(right.item.episode.id);
}

function matchesQuery(entry: TradeLibraryEntry, query: string): boolean {
  const needle = normalized(query);
  if (!needle) return true;
  const instrument = entry.instrument;
  return [instrument.id, instrument.symbol, instrument.name, instrument.localizedName?.name]
    .some(value => normalized(value).includes(needle));
}

/** Search imported identities across all dates in the current shared scope. */
export function searchGlobalInstruments(
  entries: readonly TradeLibraryEntry[],
  scope: GlobalEntryScope,
  query: string,
): GlobalSearchResult[] {
  if (scope.nature === "unknown" || requiresSimulationRun(entries, scope)) return [];
  const grouped = new Map<string, ScopedEpisode[]>();
  for (const scoped of entryEpisodes(entries, scope)) {
    if (!matchesQuery(scoped.entry, query)) continue;
    const bucket = grouped.get(scoped.entry.instrument.id) ?? [];
    bucket.push(scoped);
    grouped.set(scoped.entry.instrument.id, bucket);
  }
  return [...grouped.entries()]
    .map(([instrumentId, rows]) => {
      const ordered = [...rows].sort(newestFirst);
      const first = ordered[0].entry.instrument;
      return {
        instrumentId,
        symbol: first.symbol,
        name: first.name || first.symbol,
        market: first.market,
        currency: first.currency,
        episodeId: ordered[0].item.episode.id,
        episodeCount: ordered.length,
        openEpisodeCount: ordered.filter(row => row.item.episode.status === "open").length,
        pendingEpisodeCount: ordered.filter(row => row.item.episode.status === "closed" && reviewState(row.item) === "pending").length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN") || left.symbol.localeCompare(right.symbol));
}

function dataIssueReason(item: TradeLibraryEpisode): string | null {
  if (item.episode.accuracy?.pnl === "unavailable") return "交易盈亏证据待核对";
  if (item.episode.executions.some(execution => execution.source.historyIncomplete?.length)) return "历史证据覆盖待核对";
  if (item.episode.executions.some(execution => execution.source.feeStatus === "unknown")) return "费用证据待核对";
  return null;
}

function marketIssueDescription(status: MarketDataSyncStatus): string {
  switch (status) {
    case "not-requested": return "尚未请求所需行情";
    case "syncing": return "行情正在更新";
    case "latest-available": return "行情仅覆盖到最新可用日期";
    case "partial": return "历史行情覆盖不完整";
    case "stale": return "行情已过期，可更新";
    case "source-rate-limited": return "行情源访问受限";
    case "source-forbidden": return "行情源拒绝访问";
    case "source-unavailable": return "行情源暂不可用";
    case "invalid-response": return "行情返回格式异常";
    case "storage-error": return "行情本地存储失败";
    case "needs-provider": return "行情源尚未连接";
    case "error": return "行情更新失败";
    default: return "行情状态待核对";
  }
}

/**
 * Build the red-dot panel from current shared identity.  Market status is
 * intentionally supplied by the workspace rather than inferred from a
 * dashboard quality model, whose period may be narrower than this entry.
 */
export function buildGlobalNotifications(
  entries: readonly TradeLibraryEntry[],
  scope: GlobalEntryScope,
  options: {
    marketDataStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
    marketDataLabels?: Readonly<Record<string, string | undefined>>;
  } = {},
): GlobalNotificationModel {
  if (scope.nature === "unknown" || requiresSimulationRun(entries, scope)) {
    return { state: "needs-scope", items: [] };
  }
  const scopedEntries = filterEntriesBySharedScope(entries, {
    nature: scope.nature,
    accountIds: scope.accountIds,
    reportCurrency: "original",
    simulationRunId: scope.simulationRunId,
  });
  const rows = entryEpisodes(entries, scope);
  const items: GlobalNotification[] = [];

  for (const row of [...rows].sort(newestFirst)) {
    // A currently open holding can still carry incomplete transaction or fee
    // evidence. Keep it visible until the data issue is actually resolved.
    const reason = dataIssueReason(row.item);
    if (reason) {
      items.push({
        id: `data:${row.item.episode.id}`,
        kind: "data",
        label: `${row.entry.instrument.name || row.entry.instrument.symbol}（${row.entry.instrument.symbol}）`,
        description: reason,
        instrumentId: row.entry.instrument.id,
        episodeId: row.item.episode.id,
        action: "open-data-check",
      });
    }
  }

  const uniqueEntries = new Map<string, TradeLibraryEntry>();
  for (const entry of scopedEntries) {
    if (!uniqueEntries.has(entry.instrument.id)) uniqueEntries.set(entry.instrument.id, entry);
  }
  for (const entry of uniqueEntries.values()) {
    const status = options.marketDataStatuses?.[entry.instrument.id] ?? "not-requested";
    if (HEALTHY_MARKET_DATA.has(status)) continue;
    const label = entry.instrument.name || entry.instrument.symbol;
    items.push({
      id: `market:${entry.instrument.id}`,
      kind: "market",
      label: `${label}（${entry.instrument.symbol}）`,
      description: options.marketDataLabels?.[entry.instrument.id] ?? marketIssueDescription(status),
      instrumentId: entry.instrument.id,
      action: "open-market-data",
    });
  }

  for (const row of [...rows]
    .filter(({ item }) => item.episode.status === "closed" && reviewState(item) === "pending")
    .sort(newestFirst)) {
    items.push({
      id: `pending-review:${row.item.episode.id}`,
      kind: "pending-review",
      label: `${row.entry.instrument.name || row.entry.instrument.symbol}（${row.entry.instrument.symbol}）`,
      description: `已平仓 · ${row.item.episode.endedAt?.slice(0, 10) ?? "日期待核对"}`,
      instrumentId: row.entry.instrument.id,
      episodeId: row.item.episode.id,
      action: "open-review",
    });
  }
  return { state: "ready", items };
}

export function globalEntryScopeKey(scope: GlobalEntryScope): string {
  return [scope.nature, scope.simulationRunId ?? "", [...scope.accountIds].sort().join(",")].join("|");
}
