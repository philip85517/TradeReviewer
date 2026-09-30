/** MIGRATION-ONLY: load/save access the retired browser rollback copy. */
import {
  normalizeReviewState,
  parsePersistedReviewState,
  parseStoredReviewState,
  type LoadedReviewState,
} from "./review-storage-parser";
import type { EpisodeReviewState, StoredReviewState } from "./review-storage-parser";

export { parseStoredReviewState };
export type { EpisodeReviewState, StoredReviewState };

const LEGACY_PREFIX = "trade-reviewer:review:v1";
const PREFIX = "trade-reviewer:review:v2";

function storageKey(episodeId: string) {
  return `${PREFIX}:${episodeId}`;
}

function legacyStorageKey(episodeId: string) {
  return `${LEGACY_PREFIX}:${episodeId}`;
}

function readStoredState(key: string) {
  return parsePersistedReviewState(window.localStorage.getItem(key));
}

function toPersistedState(state: LoadedReviewState): EpisodeReviewState {
  return {
    version: 2,
    episodeId: state.episodeId,
    replayCursor: state.replayCursor,
    timeframe: state.timeframe,
    activePanelTab: state.activePanelTab,
    drawings: state.drawings,
  };
}

export function saveReviewState(
  episodeId: string,
  state: StoredReviewState,
) {
  if (typeof window === "undefined") return;
  const normalized = normalizeReviewState(episodeId, state);
  window.localStorage.setItem(
    storageKey(episodeId),
    JSON.stringify(toPersistedState(normalized)),
  );
}

export function loadReviewState(
  episodeId: string,
): LoadedReviewState | null {
  if (typeof window === "undefined") return null;
  const current = parseStoredReviewState(
    episodeId,
    window.localStorage.getItem(storageKey(episodeId)),
  );
  if (current?.version === 2) return current;

  const legacy = readStoredState(legacyStorageKey(episodeId));
  if (!legacy || legacy.version !== 1) return null;
  const migrated = normalizeReviewState(episodeId, legacy);
  window.localStorage.setItem(
    storageKey(episodeId),
    JSON.stringify(toPersistedState(migrated)),
  );
  return migrated;
}
