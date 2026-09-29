import {
  normalizeSharedScope,
  sharedScopeV2StorageKey,
  type SharedScope,
} from "../reviews/shared-scope";
import {
  classifyTradingViewExecution,
  tradingViewSourceRun,
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
} from "../trades/tradingview-account-identity";
import type { TradeExecution } from "../trades/types";
import {
  parseStoredReviewState,
  type EpisodeReviewState,
} from "./review-storage";
import {
  createTradingViewAccountMigrationClient,
  type TradingViewAccountMigrationAlias,
} from "./tradingview-account-migration-client";

const REVIEW_V1_PREFIX = "trade-reviewer:review:v1:";
const REVIEW_V2_PREFIX = "trade-reviewer:review:v2:";

export type ActiveAliasLoader = (
  signal?: AbortSignal,
) => Promise<readonly TradingViewAccountMigrationAlias[]>;

type AliasFetcher = (input: string, init?: RequestInit) => Promise<Response>;

function aliasMap(
  aliases: readonly TradingViewAccountMigrationAlias[],
  kind: TradingViewAccountMigrationAlias["kind"],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const alias of aliases) {
    if (alias.kind !== kind) continue;
    const oldId = alias.oldId.trim();
    const newId = alias.newId.trim();
    if (oldId && newId && oldId !== newId && !result.has(oldId)) {
      result.set(oldId, newId);
    }
  }
  return result;
}

function resolveAlias(id: string, aliases: ReadonlyMap<string, string>): string {
  let current = id;
  const visited = new Set<string>();
  while (!visited.has(current)) {
    visited.add(current);
    const next = aliases.get(current);
    if (!next) break;
    current = next;
  }
  return current;
}

/**
 * Creates the cancellable browser read used by the workspace bootstrap. The
 * migration client remains the response validator; this wrapper only attaches
 * the bootstrap AbortSignal to its request.
 */
export function createActiveAliasLoader(
  fetcher: AliasFetcher = fetch,
): ActiveAliasLoader {
  return async (signal) => {
    const client = createTradingViewAccountMigrationClient((input, init) =>
      fetcher(input, { ...init, ...(signal ? { signal } : {}) }),
    );
    return (await client.getActiveAliases()).aliases;
  };
}

/**
 * Resolve the persisted scope only from explicit migration aliases. A legacy
 * simulation run is cleared after a TradingView source row proves that it was
 * the old account's source run; unrelated legacy runs stay isolated.
 */
export function resolveSharedScopeWithAliases(
  scope: SharedScope,
  aliases: readonly TradingViewAccountMigrationAlias[],
  executions: readonly TradeExecution[],
): SharedScope {
  const normalized = normalizeSharedScope(scope);
  if (aliases.length === 0) return normalized;

  const accounts = aliasMap(aliases, "account");
  let accountIds = [...new Set(normalized.accountIds.map((id) => resolveAlias(id, accounts)))];
  let simulationRunId = normalized.simulationRunId;
  if (normalized.nature === "simulation" && simulationRunId !== null) {
    const runExecutions = executions.filter((execution) => tradingViewSourceRun(execution) === simulationRunId);
    const runIsProvenTradingView = runExecutions.length > 0 && runExecutions.every((execution) => {
      const identity = classifyTradingViewExecution(execution);
      return identity.eligible &&
        identity.sourceRunId === simulationRunId &&
        resolveAlias(execution.accountId, accounts) === TRADINGVIEW_CANONICAL_ACCOUNT_ID;
    });
    const selectedAccountsAreCanonical = normalized.accountIds.length > 0 &&
      accountIds.length > 0 &&
      accountIds.every((id) => id === TRADINGVIEW_CANONICAL_ACCOUNT_ID);
    if (runIsProvenTradingView && (selectedAccountsAreCanonical || normalized.accountIds.length === 0)) {
      simulationRunId = null;
      if (normalized.accountIds.length === 0) accountIds = [TRADINGVIEW_CANONICAL_ACCOUNT_ID];
    }
  }

  return normalizeSharedScope({ ...normalized, accountIds, simulationRunId });
}

type BrowserReviewState = EpisodeReviewState & { legacyThesis?: string };

function mapReviewState(state: BrowserReviewState, episodeId: string): BrowserReviewState {
  return {
    ...state,
    episodeId,
    drawings: state.drawings.map((drawing) => ({ ...drawing, episodeId })),
  };
}

/** Reads alias-covered browser review keys from both versions without writing compatibility keys. */
export function readAliasedReviewStates(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  aliases: readonly TradingViewAccountMigrationAlias[],
): BrowserReviewState[] {
  const episodes = aliasMap(aliases, "episode");
  const coveredEpisodes = new Set<string>();
  for (const [oldId, newId] of episodes) {
    coveredEpisodes.add(oldId);
    coveredEpisodes.add(newId);
  }
  const selected = new Map<string, { priority: number; state: BrowserReviewState }>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const prefix = key.startsWith(REVIEW_V2_PREFIX)
      ? REVIEW_V2_PREFIX
      : key.startsWith(REVIEW_V1_PREFIX)
        ? REVIEW_V1_PREFIX
        : null;
    if (!prefix) continue;
    const oldEpisodeId = key.slice(prefix.length);
    if (!coveredEpisodes.has(oldEpisodeId)) continue;
    const state = parseStoredReviewState(oldEpisodeId, storage.getItem(key));
    if (!state) continue;
    const episodeId = resolveAlias(state.episodeId || oldEpisodeId, episodes);
    const mapped = mapReviewState(state, episodeId);
    const priority = prefix === REVIEW_V2_PREFIX ? 2 : 1;
    const current = selected.get(episodeId);
    if (!current || priority > current.priority) selected.set(episodeId, { priority, state: mapped });
  }
  return [...selected.values()].map(({ state }) => state);
}

export function mergeAuthoritativeReviewStates(
  authoritative: Readonly<Record<string, EpisodeReviewState>>,
  browserStates: readonly EpisodeReviewState[],
): Record<string, EpisodeReviewState> {
  const merged: Record<string, EpisodeReviewState> = {};
  for (const state of browserStates) merged[state.episodeId] = state;
  for (const [episodeId, state] of Object.entries(authoritative)) merged[episodeId] = state;
  return merged;
}

/** Writes the post-alias scope in a separate key; errors remain recoverable. */
export function writeCanonicalSharedScope(
  storage: Pick<Storage, "setItem">,
  scope: SharedScope,
  project = "default",
): boolean {
  try {
    storage.setItem(sharedScopeV2StorageKey(project), JSON.stringify(normalizeSharedScope(scope)));
    return true;
  } catch {
    return false;
  }
}
