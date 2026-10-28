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
} from "./review-storage-parser";
import {
  createTradingViewAccountMigrationClient,
  type TradingViewAccountMigrationAlias,
} from "./tradingview-account-migration-client";

const REVIEW_V1_PREFIX = "trade-reviewer:review:v1:";
const REVIEW_V2_PREFIX = "trade-reviewer:review:v2:";

export type BrowserReviewWriteResolution = {
  ready: boolean;
  conflicts: readonly BrowserReviewConflict[];
};

/** Public write seam shared by automatic, retry and completion saves. */
export function createBrowserReviewStateWriter(
  currentResolution: () => BrowserReviewWriteResolution,
  write: (state: EpisodeReviewState) => Promise<unknown>,
): (state: EpisodeReviewState) => Promise<void> {
  return async state => {
    // Read at dispatch, never capture permission when the caller enqueues work.
    const resolution = currentResolution();
    if (!resolution.ready) throw new Error("复盘来源尚未核实，已暂停保存，请等待恢复读取完成后重试。");
    if (resolution.conflicts.some(conflict => conflict.episodeId === state.episodeId)) {
      throw new Error("浏览器复盘内容冲突，已暂停保存；所有原始内容均已保留。请先解决恢复冲突。");
    }
    await write(state);
  };
}

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

export type BrowserReviewConflict = { episodeId: string; sourceKeys: string[] };
type BrowserReviewResolution = { states: BrowserReviewState[]; conflicts: BrowserReviewConflict[] };

function mapReviewState(state: BrowserReviewState, episodeId: string): BrowserReviewState {
  return {
    ...state,
    episodeId,
    drawings: state.drawings.map((drawing) => ({ ...drawing, episodeId })),
  };
}

function reviewContent(state: BrowserReviewState): string {
  const { legacyThesis, ...content } = state;
  // v1 always has a thesis field; an empty field carries no extra user content.
  return JSON.stringify(legacyThesis ? { ...content, legacyThesis } : content, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
      : value,
  );
}

/**
 * Reads only exact alias-covered keys. Different-name disagreements pause that
 * episode's compatibility restore; callers can expose the source keys without
 * changing any original bytes. SQLite-owned episodes need no browser fallback.
 */
export function readAliasedReviewStates(
  storage: Pick<Storage, "getItem">,
  aliases: readonly TradingViewAccountMigrationAlias[],
  authoritative: Readonly<Record<string, EpisodeReviewState>> = {},
): BrowserReviewResolution {
  const episodes = aliasMap(aliases, "episode");
  if (episodes.size === 0) return { states: [], conflicts: [] };
  const coveredEpisodes = new Set<string>();
  for (const [oldId, newId] of episodes) {
    coveredEpisodes.add(oldId);
    coveredEpisodes.add(newId);
  }
  const selected = new Map<string, { key: string; state: BrowserReviewState }[]>();
  for (const oldEpisodeId of coveredEpisodes) {
    // v2 then v1 is the existing same-name compatibility protocol, not
    // evidence that one differently named episode has newer user content.
    for (const prefix of [REVIEW_V2_PREFIX, REVIEW_V1_PREFIX]) {
      const key = `${prefix}${oldEpisodeId}`;
      const state = parseStoredReviewState(oldEpisodeId, storage.getItem(key));
      if (!state) continue;
      const episodeId = resolveAlias(state.episodeId || oldEpisodeId, episodes);
      if (!Object.hasOwn(authoritative, episodeId)) {
        const sources = selected.get(episodeId) ?? [];
        sources.push({ key, state: mapReviewState(state, episodeId) });
        selected.set(episodeId, sources);
      }
      break;
    }
  }
  const result: BrowserReviewResolution = { states: [], conflicts: [] };
  for (const [episodeId, sources] of [...selected].sort(([left], [right]) => left.localeCompare(right))) {
    if (new Set(sources.map(({ state }) => reviewContent(state))).size > 1) {
      result.conflicts.push({ episodeId, sourceKeys: sources.map(({ key }) => key).sort() });
    } else result.states.push(sources[0].state);
  }
  return result;
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
